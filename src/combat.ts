// =============================================================================
//  combat.ts — Moteur de combat (pur, sans DOM)
//  Boucle de tour, calcul de dégâts, règle de ligne, effets, IA.
//  Pilotable sans UI : voir test.ts (deux IA qui s'affrontent en console).
// =============================================================================
import { SORTS } from "./data";
import { multOffensif, multSoin, pctRetraitPA, pctRembPA } from "./progression";
import type {
  Camp, Combatant, EffetSpec, EffetStat, Element, Spell, Stats, Action,
} from "./types";

// --- Aléatoire (injectable pour les tests) -----------------------------------
export type Rng = () => number;
const jet = (min: number, max: number, rng: Rng): number =>
  min + Math.floor(rng() * (max - min + 1));

// --- Contexte d'un combat ----------------------------------------------------
export interface CombatCtx {
  rng: Rng;
  log: (msg: string) => void;
  playerDamageBonus: number; // multiplicateur Dofus appliqué au camp joueur
}

export type Controller = (
  acteur: Combatant,
  combatants: Combatant[],
) => Promise<Action | null> | Action | null;

export interface CombatHooks {
  controllers: Record<Camp, Controller>;
  log?: (msg: string) => void;
  onUpdate?: () => Promise<void> | void; // re-render entre deux actions
  rng?: Rng;
  playerDamageBonus?: number;
}

// --- Helpers de base ---------------------------------------------------------
export const vivants = (cs: Combatant[]): Combatant[] => cs.filter((c) => c.pvActuels > 0);
const parRef = (cs: Combatant[], ref: string): Combatant | undefined => cs.find((c) => c.ref === ref);
const adverses = (acteur: Combatant, cs: Combatant[]): Combatant[] =>
  vivants(cs).filter((c) => c.camp !== acteur.camp);
const allies = (acteur: Combatant, cs: Combatant[]): Combatant[] =>
  vivants(cs).filter((c) => c.camp === acteur.camp);

/** Stat élémentaire associée à un élément (terre→force, feu→int, eau→chance, … ). */
export const statElement = (stats: Stats, el: Element): number => {
  switch (el) {
    case "terre": return stats.force;
    case "feu": return stats.intelligence;
    case "eau": return stats.chance ?? 0;
    case "air": return stats.agilite;
    case "wakfu": return stats.wakfu ?? 0;
    case "stasis": return stats.stasis ?? 0;
  }
};

/** Stat (buffable) portant chaque élément — pour buffer la carac d'un élément. */
const ELEMENT_STAT: Record<Element, EffetStat> = {
  terre: "force", feu: "intelligence", eau: "chance",
  air: "agilite", wakfu: "wakfu", stasis: "stasis",
};

/** Liste des 6 éléments (ordre stable d'affichage). */
export const ELEMENTS: Element[] = ["terre", "feu", "eau", "air", "wakfu", "stasis"];

const sommeEffet = (c: Combatant, stat: EffetStat): number =>
  c.effets.filter((e) => e.stat === stat).reduce((s, e) => s + e.valeur, 0);

/** Stats effectives = stats de base + buffs/debuffs temporaires de caractéristique. */
const STATS_BUFFABLES = ["force", "intelligence", "agilite", "chance", "wakfu", "stasis"] as const;
export function statsEffectives(c: Combatant): Stats {
  const s: Stats = { ...c.stats };
  for (const k of STATS_BUFFABLES) {
    const bonus = sommeEffet(c, k);
    if (bonus) s[k] = (s[k] ?? 0) + bonus;
  }
  return s;
}

/** Les 2 éléments les plus forts d'un combattant (ordre décroissant de stat effective). */
export function elementsForts(c: Combatant): [Element, Element] {
  const se = statsEffectives(c);
  const tri = ELEMENTS.map((el): [Element, number] => [el, statElement(se, el)])
    .sort((a, b) => b[1] - a[1]);
  return [tri[0][0], tri[1][0]];
}

/** Élément de frappe : le choix du joueur s'il est l'un des 2 plus forts, sinon le plus fort. */
export function elementDeFrappe(c: Combatant): Element {
  const [premier, second] = elementsForts(c);
  if (c.elementChoisi === premier || c.elementChoisi === second) return c.elementChoisi;
  return premier;
}

/** Initiative effective = base + effets (négatifs = ralentissement). */
const initOf = (c: Combatant): number => c.initiative + sommeEffet(c, "initiative");

// --- Grille & règle de ligne -------------------------------------------------
// position = case de grille 0..7 : 0-3 = ligne avant, 4-7 = ligne arrière.
export const NB_COLONNES = 4;
export const estAvant = (c: Combatant): boolean => c.position < NB_COLONNES;

/** Combattants ciblables par un sort de ligne dans un camp : la ligne avant,
 *  ou (si elle est vide) toute la ligne arrière qui devient exposée. */
function ligneFront(cibles: Combatant[]): Combatant[] {
  const avant = cibles.filter(estAvant);
  return avant.length ? avant : cibles;
}

const enCooldown = (acteur: Combatant, sort: Spell, cibleRef: string): boolean =>
  (acteur.cooldowns[`${sort.id}:${cibleRef}`] ?? 0) > 0;

/** Cooldown par sort côté lanceur (clé = id du sort, sans cible) : le sort est
 *  indisponible pour toutes les cibles pendant `cooldownTours` tours. */
const enCooldownSort = (acteur: Combatant, sort: Spell): boolean =>
  !!sort.cooldownTours && (acteur.cooldowns[sort.id] ?? 0) > 0;

/** Cibles valides pour un sort lancé par `acteur` (règle de ligne symétrique). */
export function ciblesValides(acteur: Combatant, sort: Spell, cs: Combatant[]): Combatant[] {
  let base: Combatant[];
  switch (sort.cible) {
    case "soi":
      base = [acteur];
      break;
    case "allie":
      base = allies(acteur, cs);
      break;
    case "allie_tous":
      base = allies(acteur, cs);
      break;
    case "ennemi_tous":
      base = adverses(acteur, cs);
      break;
    case "ennemi_ligne": {
      // règle de ligne SYMÉTRIQUE : on ne vise que la ligne avant (cases 0-3)
      base = ligneFront(adverses(acteur, cs));
      break;
    }
    case "mixte":
      // toute unité vivante (l'effet dépend du camp ciblé, résolu dans lancerSort)
      base = vivants(cs);
      break;
  }
  // provocation : un ennemi doit viser en priorité un allié (joueur) qui provoque
  if (acteur.camp === "ennemi") {
    const prov = base.filter((c) => c.camp === "joueur" && c.provoque && c.pvActuels > 0);
    if (prov.length) base = prov;
  }

  // cooldown par sort (côté lanceur) : sort entièrement indisponible pendant Nt
  if (enCooldownSort(acteur, sort)) return [];
  // un sort à cooldown n'est plus ciblable sur une cible en attente de recharge
  if (sort.cooldown) base = base.filter((c) => !enCooldown(acteur, sort, c.ref));
  return base;
}

/** Cibles effectivement touchées par un sort de dégâts (primaire + rebonds). */
function ciblesDegats(acteur: Combatant, sort: Spell, primaire: Combatant, cs: Combatant[]): Combatant[] {
  // zone : toute la rangée (avant/arrière) de la cible cliquée (Tempête de lames)
  if (sort.zoneLigne) {
    const memeRangee = estAvant(primaire);
    return adverses(acteur, cs).filter((e) => estAvant(e) === memeRangee);
  }
  const touchees = [primaire];
  if (sort.rebond) {
    const ennemis = adverses(acteur, cs).sort((a, b) => a.position - b.position);
    const idx = ennemis.findIndex((e) => e.ref === primaire.ref);
    for (let s = 1; s <= sort.rebond.sauts; s++) {
      const suiv = ennemis[idx + s];
      if (suiv) touchees.push(suiv);
    }
  }
  return touchees;
}

// --- Calcul de dégâts sur une cible ------------------------------------------
export interface ResultatDegats {
  dmg: number;
  esquive: boolean;
  crit: boolean;
}

/** Base de dégâts d'une frappe (sort entier ou coup/projectile individuel). */
interface BaseDegats {
  baseMin: number;
  baseMax: number;
  scaling: number;
  ignoreResistances?: boolean;
}

export function degatsCible(
  lanceur: Combatant,
  sort: Spell,
  cible: Combatant,
  opts: { useMax: boolean; mult: number; ctx: CombatCtx },
): ResultatDegats {
  return degatsAvec(lanceur, sort, cible, opts);
}

function degatsAvec(
  lanceur: Combatant,
  base: BaseDegats,
  cible: Combatant,
  opts: { useMax: boolean; mult: number; ctx: CombatCtx },
): ResultatDegats {
  const { ctx } = opts;
  const se = statsEffectives(lanceur);
  const seCible = statsEffectives(cible);

  // esquive (Agilité de la cible + buffs d'esquive, plafonnée à 50 %)
  if (ctx.rng() < Math.min(0.5, seCible.agilite * 0.002 + sommeEffet(cible, "esquive"))) {
    return { dmg: 0, esquive: true, crit: false };
  }

  // jet (max si buff "maxRoll" actif)
  let dmg = opts.useMax ? base.baseMax : jet(base.baseMin, base.baseMax, ctx.rng);

  // stat de l'élément de frappe
  const el = elementDeFrappe(lanceur);
  dmg += statElement(se, el) * base.scaling;

  // critique : chance via Force (≤ 50 %), bonus de dégâts via Agilité (+25 % à +60 %)
  let crit = false;
  if (ctx.rng() < Math.min(0.5, se.force * 0.005)) {
    dmg *= 1 + Math.min(0.6, 0.25 + se.agilite * 0.004);
    crit = true;
  }

  // malus/bonus de dégâts infligés par le lanceur (= « dégâts finaux »)
  dmg *= 1 + sommeEffet(lanceur, "degatsInfliges");

  // bonus de rebond (saut)
  dmg *= opts.mult;

  // résistance de l'élément (+ resAll), sauf ignoreResistances
  if (!base.ignoreResistances) {
    dmg *= 1 - ((cible.resistances[el] ?? 0) + sommeEffet(cible, "resAll"));
  }

  // réduction de dégâts subis (Bâton du berger), plafonnée à 80 %
  dmg *= 1 - Math.min(0.8, sommeEffet(cible, "reductionDegats"));

  // bonus permanent d'équipe (Dofus), côté joueur uniquement
  if (lanceur.camp === "joueur") dmg *= ctx.playerDamageBonus;

  // puissance offensive (Intelligence) — s'applique à tout lanceur
  dmg *= multOffensif(se);

  // armure : réduction plate des dégâts subis (Armures)
  dmg -= sommeEffet(cible, "armure");

  return { dmg: Math.max(0, Math.round(dmg)), esquive: false, crit };
}

// --- Effets temporaires ------------------------------------------------------
function recomputePvMax(c: Combatant): void {
  const pct = sommeEffet(c, "vitalite");
  const nouveauMax = Math.round(c.pvBase * (1 + pct));
  const delta = nouveauMax - c.pvMax;
  c.pvMax = nouveauMax;
  if (delta > 0) c.pvActuels += delta; // le buff agit comme un bouclier
  else c.pvActuels = Math.min(c.pvActuels, nouveauMax);
}

function appliquerEffet(cible: Combatant, effet: EffetSpec): void {
  if (effet.stat === "maxRoll") {
    cible.maxRollCharges += effet.valeur;
    return;
  }
  cible.effets.push({
    stat: effet.stat,
    valeur: effet.valeur,
    toursRestants: effet.duree,
    transmet: effet.transmet,
  });
  if (effet.stat === "vitalite") recomputePvMax(cible);
}

/** Friction : tant qu'elle est active, la cible ne peut être ni soignée ni protégée. */
const aFriction = (c: Combatant): boolean => sommeEffet(c, "friction") > 0;

/** Double la durée d'un effet/poison si `x` (Tir Puissant), sinon le renvoie tel quel. */
const etirer = <T extends { duree: number }>(e: T, x: boolean): T =>
  x ? { ...e, duree: e.duree * 2 } : e;

/** Applique un poison, doublé si le lanceur est sous Arsenic. */
function appliquerPoison(
  cible: Combatant,
  lanceur: Combatant,
  p: { degats: number; duree: number; transmet?: boolean },
): void {
  const degats = lanceur.poisonAmpliTours > 0 ? p.degats * 2 : p.degats;
  appliquerEffet(cible, { stat: "poison", valeur: degats, duree: p.duree, transmet: p.transmet });
}

/** Retire les boucliers et les effets bénéfiques d'une cible (désenvoûtement). */
function dissiperPositifs(cible: Combatant, ctx: CombatCtx): void {
  cible.bouclier = 0;
  const benefiques: EffetStat[] = ["hot", "esquive", "reductionDegats", "armure", "resAll", "vitalite", "force", "intelligence", "agilite", "chance", "wakfu", "stasis"];
  const avant = cible.effets.length;
  cible.effets = cible.effets.filter(
    (e) => !(benefiques.includes(e.stat) || (e.stat === "degatsInfliges" && e.valeur > 0)),
  );
  cible.bonusOffensifProchain = 0;
  if (cible.effets.length < avant) ctx.log(`${cible.nom} est désenvoûté.`);
}

/** Inflige des dégâts en consommant d'abord le bouclier, puis les PV.
 *  Si `attaquant`/`ctx` sont fournis et que la cible a une posture de contre
 *  (Duel), elle peut riposter d'une frappe modeste (sans re-déclenchement). */
function infligerDegats(cible: Combatant, dmg: number, attaquant?: Combatant, ctx?: CombatCtx, ignoreBouclier?: boolean): void {
  let reste = dmg;
  if (cible.bouclier > 0 && !ignoreBouclier) {
    const absorbe = Math.min(cible.bouclier, reste);
    cible.bouclier -= absorbe;
    reste -= absorbe;
  }
  cible.pvActuels = Math.max(0, cible.pvActuels - reste);
  // riposte (Duel) : la cible survivante contre-attaque l'attaquant adverse
  if (
    attaquant && ctx && dmg > 0 &&
    cible.pvActuels > 0 && attaquant.pvActuels > 0 &&
    attaquant.camp !== cible.camp &&
    sommeEffet(cible, "contre") > 0 && // ne consomme le RNG que si une posture est active
    ctx.rng() < sommeEffet(cible, "contre")
  ) {
    const r = degatsAvec(cible, { baseMin: 8, baseMax: 12, scaling: 0.3 }, attaquant, { useMax: false, mult: 1, ctx });
    infligerDegats(attaquant, r.dmg); // pas d'attaquant → pas de contre-riposte
    ctx.log(`${cible.nom} riposte : ${r.dmg} dégâts à ${attaquant.nom}.`);
  }
}

/** Combattant vivant juste derrière `c` dans sa ligne (position supérieure). */
function derriere(c: Combatant, cs: Combatant[]): Combatant | undefined {
  return vivants(cs)
    .filter((x) => x.camp === c.camp && x.position > c.position)
    .sort((a, b) => a.position - b.position)[0];
}

/**
 * Effets de début de tour. Renvoie true si le combattant n'agit pas
 * (passe son tour, ou est mort d'un poison).
 */
export function effetsDebutTour(acteur: Combatant, cs: Combatant[], ctx: CombatCtx): boolean {
  // retrait de PA (Fracas)
  if (acteur.retraitPANextTurn > 0) {
    acteur.paActuels = Math.max(0, acteur.paActuels - acteur.retraitPANextTurn);
    ctx.log(`${acteur.nom} subit un retrait de ${acteur.retraitPANextTurn} PA.`);
    acteur.retraitPANextTurn = 0;
  }
  // gain de PA (Mot d'ivation)
  if (acteur.paBonusNextTurn > 0) {
    acteur.paActuels += acteur.paBonusNextTurn;
    ctx.log(`${acteur.nom} gagne ${acteur.paBonusNextTurn} PA (Mot d'ivation).`);
    acteur.paBonusNextTurn = 0;
  }
  // poison (DoT) — peut tuer, et se transmet alors au combattant derrière
  for (const e of acteur.effets.filter((x) => x.stat === "poison")) {
    acteur.pvActuels = Math.max(0, acteur.pvActuels - e.valeur);
    ctx.log(`${acteur.nom} subit ${e.valeur} dégâts de poison.`);
  }
  if (acteur.pvActuels <= 0) {
    ctx.log(`${acteur.nom} succombe au poison !`);
    const suivant = derriere(acteur, cs);
    for (const e of acteur.effets.filter((x) => x.stat === "poison" && x.transmet)) {
      if (suivant) {
        suivant.effets.push({ stat: "poison", valeur: e.valeur, toursRestants: e.toursRestants, transmet: true });
        ctx.log(`Le poison se transmet à ${suivant.nom} !`);
      }
    }
    return true;
  }
  // HoT (soin sur la durée) — bloqué par la friction
  if (!aFriction(acteur)) {
    for (const e of acteur.effets.filter((x) => x.stat === "hot")) {
      const avant = acteur.pvActuels;
      acteur.pvActuels = Math.min(acteur.pvMax, acteur.pvActuels + e.valeur);
      if (acteur.pvActuels > avant) ctx.log(`${acteur.nom} régénère ${acteur.pvActuels - avant} PV.`);
    }
  }
  // passe le tour (Colère)
  if (acteur.passeProchainTour) {
    acteur.passeProchainTour = false;
    ctx.log(`${acteur.nom} passe son tour (Colère).`);
    return true;
  }
  return false;
}

function decrementerEffets(acteur: Combatant): void {
  let toucheVitalite = false;
  acteur.effets.forEach((e) => {
    e.toursRestants -= 1;
    if (e.toursRestants <= 0 && e.stat === "vitalite") toucheVitalite = true;
  });
  acteur.effets = acteur.effets.filter((e) => e.toursRestants > 0);
  if (toucheVitalite) recomputePvMax(acteur);

  // compteurs temporisés (Arsenic, Bonne pioche, Provocation)
  if (acteur.poisonAmpliTours > 0) acteur.poisonAmpliTours -= 1;
  if (acteur.bonusDeTours > 0 && --acteur.bonusDeTours <= 0) acteur.bonusDe = 0;
  if (acteur.provoqueTours && --acteur.provoqueTours <= 0) {
    acteur.provoqueTours = 0;
    acteur.provoque = false;
  }

  // cooldowns par cible
  for (const k of Object.keys(acteur.cooldowns)) {
    acteur.cooldowns[k] -= 1;
    if (acteur.cooldowns[k] <= 0) delete acteur.cooldowns[k];
  }
}

const consommeMaxRoll = (lanceur: Combatant): boolean => {
  if (lanceur.maxRollCharges > 0) {
    lanceur.maxRollCharges -= 1;
    return true;
  }
  return false;
};

// --- Lancement d'un sort -----------------------------------------------------
function soigner(cible: Combatant, montant: number, ctx: CombatCtx): void {
  if (aFriction(cible)) {
    ctx.log(`${cible.nom} ne peut pas être soigné (friction).`);
    return;
  }
  const avant = cible.pvActuels;
  cible.pvActuels = Math.min(cible.pvMax, cible.pvActuels + montant);
  if (cible.pvActuels > avant) ctx.log(`${cible.nom} récupère ${cible.pvActuels - avant} PV.`);
}

/** Applique les effets de soutien d'un sort (Eniripsa) à une cible. */
function appliquerSoutien(sort: Spell, cible: Combatant, lanceur: Combatant, ctx: CombatCtx): void {
  if (sort.dissipe) {
    const avant = cible.effets.length;
    cible.effets = cible.effets.filter((e) => e.stat !== "poison" && e.stat !== "degatsInfliges");
    cible.retraitPANextTurn = 0;
    if (cible.effets.length < avant) ctx.log(`${cible.nom} est purgé de ses effets négatifs.`);
  }
  if (sort.bouclierPct && !aFriction(cible)) {
    const b = Math.round(cible.pvMax * sort.bouclierPct);
    cible.bouclier += b;
    ctx.log(`${cible.nom} gagne un bouclier de ${b}.`);
  }
  if (sort.hotPct && !aFriction(cible)) {
    const h = Math.max(1, Math.round(cible.stats.vitalite * sort.hotPct * multSoin(lanceur.stats)));
    appliquerEffet(cible, { stat: "hot", valeur: h, duree: sort.hotDuree ?? 2 });
  }
  if (sort.paGain) {
    cible.paBonusNextTurn += sort.paGain;
    ctx.log(`${cible.nom} recevra ${sort.paGain} PA au prochain tour.`);
  }
  if (sort.bonusProchainSortPct) {
    cible.bonusOffensifProchain += sort.bonusProchainSortPct;
    ctx.log(`${cible.nom} prépare un sort renforcé (+${Math.round(sort.bonusProchainSortPct * 100)} %).`);
  }
  if (sort.effet) appliquerEffet(cible, sort.effet);
  if (sort.effets) for (const e of sort.effets) appliquerEffet(cible, e);
  if (sort.effetParNiveau) {
    const ep = sort.effetParNiveau;
    appliquerEffet(cible, { stat: ep.stat, valeur: ep.base + ep.parNiveau * lanceur.niveau, duree: ep.duree });
  }
  if (sort.poisonAmpli) {
    cible.poisonAmpliTours = sort.poisonAmpli;
    ctx.log(`${cible.nom} empoisonne ses lames (Arsenic).`);
  }
  if (sort.donneBonusDe) {
    cible.bonusDe = jet(sort.donneBonusDe.min, sort.donneBonusDe.max, ctx.rng);
    cible.bonusDeTours = sort.donneBonusDe.duree;
    ctx.log(`${cible.nom} affûte sa chance (+${cible.bonusDe} aux tirages).`);
  }
  if (sort.provoqueTours) {
    cible.provoque = true;
    cible.provoqueTours = sort.provoqueTours;
    ctx.log(`${cible.nom} provoque les ennemis !`);
  }
  if (sort.contre) {
    appliquerEffet(cible, { stat: "contre", valeur: sort.contre.chance, duree: sort.contre.duree });
    ctx.log(`${cible.nom} prend une posture de contre (${Math.round(sort.contre.chance * 100)} %).`);
  }
  if (sort.maitriseArc) {
    const [princ, sec] = elementsForts(cible); // buffe les 2 éléments de frappe du lanceur
    appliquerEffet(cible, { stat: ELEMENT_STAT[princ], valeur: sort.maitriseArc.principal, duree: sort.maitriseArc.duree });
    if (ELEMENT_STAT[sec] !== ELEMENT_STAT[princ]) {
      appliquerEffet(cible, { stat: ELEMENT_STAT[sec], valeur: sort.maitriseArc.secondaire, duree: sort.maitriseArc.duree });
    }
    ctx.log(`${cible.nom} affûte sa maîtrise de l'arc (+${sort.maitriseArc.principal}/+${sort.maitriseArc.secondaire}).`);
  }
  if (sort.doubleEffetProchain) {
    cible.doubleEffetProchain = true;
    ctx.log(`${cible.nom} prépare un Tir Puissant (effet de la prochaine flèche doublé).`);
  }
  if (sort.dissipePositifs) dissiperPositifs(cible, ctx);
}

/** Invoque une Poupée de garde (une seule active par invocateur). */
function invoquerPoupee(
  lanceur: Combatant,
  invo: { nom: string; pv: number; provoque: boolean },
  cs: Combatant[],
  ctx: CombatCtx,
): void {
  const ref = `poupee_${lanceur.ref}`;
  if (cs.some((c) => c.ref === ref && c.pvActuels > 0)) {
    ctx.log(`${lanceur.nom} a déjà une ${invo.nom} active.`);
    return;
  }
  // si une ancienne poupée morte traîne, on la retire
  const idx = cs.findIndex((c) => c.ref === ref);
  if (idx >= 0) cs.splice(idx, 1);

  cs.push({
    ref,
    nom: invo.nom,
    pvBase: invo.pv,
    pvMax: invo.pv,
    pvActuels: invo.pv,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: invo.pv },
    paMax: 0,
    paActuels: 0,
    initiative: 0,
    resistances: {},
    sorts: [],
    camp: "joueur",
    position: 0, // devant l'équipe (mur)
    niveau: 1,
    effets: [],
    img: "/assets/divers/poupee.png",
    maxRollCharges: 0,
    passeProchainTour: false,
    retraitPANextTurn: 0,
    bouclier: 0,
    paBonusNextTurn: 0,
    cooldowns: {},
    bonusOffensifProchain: 0,
    poisonAmpliTours: 0,
    bonusDe: 0,
    bonusDeTours: 0,
    estInvocation: true,
    joueTour: false,
    provoque: invo.provoque,
  });
  ctx.log(`${lanceur.nom} invoque une ${invo.nom} (${invo.pv} PV) qui provoque les ennemis.`);
}

// --- Helpers des nouvelles mécaniques ----------------------------------------
/** Cases voisines (haut/bas/gauche/droite) sur la grille 4×2 (positions 0-7). */
function adjacents(pos: number): number[] {
  const col = pos % NB_COLONNES;
  const ligne = Math.floor(pos / NB_COLONNES);
  const res: number[] = [];
  if (col > 0) res.push(pos - 1);
  if (col < NB_COLONNES - 1) res.push(pos + 1);
  if (ligne > 0) res.push(pos - NB_COLONNES);
  if (ligne < 1) res.push(pos + NB_COLONNES);
  return res;
}

/** n tirages aléatoires (avec remise, en ignorant les morts) parmi un camp. */
function ciblesAleatoires(pool: Combatant[], n: number, rng: Rng): Combatant[] {
  const res: Combatant[] = [];
  for (let i = 0; i < n; i++) {
    const vivantsPool = pool.filter((c) => c.pvActuels > 0);
    if (!vivantsPool.length) break;
    res.push(vivantsPool[Math.floor(rng() * vivantsPool.length)]);
  }
  return res;
}

/** Tirage normalisé 0..1 d'un dé à `faces` faces (+ bonus de dé du lanceur). */
function tirageDe(lanceur: Combatant, faces: number, rng: Rng): number {
  const roll = Math.min(faces, 1 + Math.floor(rng() * faces) + lanceur.bonusDe);
  return faces > 1 ? (roll - 1) / (faces - 1) : 1;
}

/** Applique une frappe de dégâts ; renvoie les dégâts infligés (0 si esquive). */
function frappe(
  lanceur: Combatant,
  base: BaseDegats,
  t: Combatant,
  opts: { useMax: boolean; mult: number; ctx: CombatCtx },
  nomSort: string,
): number {
  const r = degatsAvec(lanceur, base, t, opts);
  if (r.esquive) {
    opts.ctx.log(`${t.nom} esquive ${nomSort} !`);
    return 0;
  }
  infligerDegats(t, r.dmg, lanceur, opts.ctx);
  opts.ctx.log(
    `${lanceur.nom} → ${nomSort} sur ${t.nom} : ${r.dmg} dégâts${r.crit ? " (CRIT)" : ""}.` +
      (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
  );
  return r.dmg;
}

const COULEURS = ["pique", "trefle", "carreau", "coeur"] as const;

/** Tarot (Ecaflip) : tire une couleur et applique l'effet ennemi ou allié. */
function lancerTarot(lanceur: Combatant, sort: Spell, cible: Combatant | undefined, cs: Combatant[], ctx: CombatCtx): void {
  const couleur = COULEURS[Math.floor(ctx.rng() * 4)];
  ctx.log(`${lanceur.nom} tire un Tarot : ${couleur}.`);
  const base: BaseDegats = { baseMin: sort.baseMin, baseMax: sort.baseMax, scaling: sort.scaling };
  const opts = { useMax: false, mult: 1, ctx };

  if (cible && cible.camp !== lanceur.camp) {
    // --- variante ennemie ---
    if (couleur === "pique") {
      frappe(lanceur, { ...base, ignoreResistances: true }, cible, opts, "Tarot (Pique)");
    } else if (couleur === "carreau") {
      const t = ciblesAleatoires(adverses(lanceur, cs), 1, ctx.rng)[0];
      if (t) frappe(lanceur, base, t, opts, "Tarot (Carreau)");
    } else if (couleur === "coeur") {
      const dmg = frappe(lanceur, base, cible, opts, "Tarot (Cœur)");
      if (dmg > 0) soigner(lanceur, dmg, ctx);
    } else {
      // trèfle : relance (deux frappes)
      frappe(lanceur, base, cible, opts, "Tarot (Trèfle)");
      if (cible.pvActuels > 0) frappe(lanceur, base, cible, opts, "Tarot (Trèfle, relance)");
    }
  } else if (cible) {
    // --- variante alliée ---
    if (couleur === "pique") {
      appliquerEffet(cible, { stat: "degatsInfliges", valeur: 0.15, duree: 2 });
      ctx.log(`${cible.nom} gagne +15 % de dégâts finaux.`);
    } else if (couleur === "carreau") {
      const b = Math.round(cible.pvMax * (0.15 + 0.005 * lanceur.niveau));
      if (!aFriction(cible)) cible.bouclier += b;
      ctx.log(`${cible.nom} gagne un bouclier de ${b}.`);
    } else if (couleur === "coeur") {
      soigner(cible, Math.round(cible.pvMax * 0.2 * multSoin(lanceur.stats)), ctx);
    } else {
      // trèfle : + toutes caractéristiques
      for (const k of STATS_BUFFABLES) appliquerEffet(cible, { stat: k, valeur: 8, duree: 2 });
      ctx.log(`${cible.nom} gagne +8 à toutes ses caractéristiques (2t).`);
    }
  }
}

/** Esprit félin (Ecaflip) : effet aléatoire (25 % chacun) sur chaque unité. */
function lancerEspritFelin(lanceur: Combatant, cs: Combatant[], ctx: CombatCtx): void {
  ctx.log(`${lanceur.nom} libère l'Esprit félin sur le champ de bataille !`);
  for (const u of vivants(cs)) {
    const r = Math.floor(ctx.rng() * 4);
    if (u.camp === lanceur.camp) {
      if (r === 0 && !aFriction(u)) u.bouclier += Math.round(u.pvMax * 0.15);
      else if (r === 1) soigner(u, Math.round(u.pvMax * 0.15 * multSoin(lanceur.stats)), ctx);
      else if (r === 2) appliquerEffet(u, { stat: "degatsInfliges", valeur: 0.15, duree: 2 });
      else appliquerEffet(u, { stat: "resAll", valeur: 0.1, duree: 2 });
    } else {
      if (r === 0) {
        u.retraitPANextTurn += 2;
        lanceur.paBonusNextTurn += 2;
        ctx.log(`${lanceur.nom} vole 2 PA à ${u.nom}.`);
      } else if (r === 1) appliquerEffet(u, { stat: "resAll", valeur: -0.1, duree: 2 });
      else if (r === 2) appliquerEffet(u, { stat: "degatsInfliges", valeur: -0.1, duree: 2 });
      else dissiperPositifs(u, ctx);
    }
  }
}

export function lancerSort(
  lanceur: Combatant,
  sort: Spell,
  cibleRef: string,
  cs: Combatant[],
  ctx: CombatCtx,
): void {
  const cible = parRef(cs, cibleRef);
  const poseCooldown = (t: Combatant) => {
    if (sort.cooldown) lanceur.cooldowns[`${sort.id}:${t.ref}`] = sort.cooldown;
    if (sort.cooldownTours) lanceur.cooldowns[sort.id] = sort.cooldownTours;
  };

  // --- ÉCHEC CRITIQUE : le sort peut rater (PA déjà consommés) ---
  const pEchec = sommeEffet(lanceur, "echecCritique");
  if (pEchec > 0 && ctx.rng() < pEchec) {
    ctx.log(`${lanceur.nom} subit un échec critique : ${sort.nom} échoue !`);
    return;
  }

  // --- HANDLERS DÉDIÉS ---
  if (sort.tarot) {
    lancerTarot(lanceur, sort, cible, cs, ctx);
    if (cible) poseCooldown(cible);
    return;
  }
  if (sort.espritFelin) {
    lancerEspritFelin(lanceur, cs, ctx);
    return;
  }

  // --- MIXTE : ennemi → dégâts ; allié → soutien ---
  if (sort.cible === "mixte" && cible) {
    if (cible.camp === lanceur.camp && sort.mixte) {
      ctx.log(`${lanceur.nom} lance ${sort.nom} sur ${cible.nom}.`); // annonce avant les effets
      const sa = sort.mixte.surAllie;
      if (sa.bouclierPct && !aFriction(cible)) {
        const b = Math.round(cible.pvMax * sa.bouclierPct);
        cible.bouclier += b;
        ctx.log(`${cible.nom} gagne un bouclier de ${b}.`);
      }
      if (sa.effet) {
        if (sa.nonCumulable) cible.effets = cible.effets.filter((e) => e.stat !== sa.effet!.stat);
        appliquerEffet(cible, sa.effet);
      }
      if (sa.soin) soigner(cible, Math.round(jet(sa.soin.min, sa.soin.max, ctx.rng) * multSoin(lanceur.stats)), ctx);
      poseCooldown(cible);
      return;
    }
    // sinon : tombe dans la branche dégâts ci-dessous
  }

  // --- INVOCATION ---
  if (sort.type === "invocation") {
    if (sort.invocation) invoquerPoupee(lanceur, sort.invocation, cs, ctx);
    return;
  }

  // --- SOIN ---
  if (sort.type === "soin") {
    ctx.log(`${lanceur.nom} lance ${sort.nom}.`); // annonce avant les effets (ordre du journal)
    const cibles = sort.cible === "allie_tous" ? allies(lanceur, cs) : cible ? [cible] : [];
    for (const t of cibles) {
      const montant = sort.soinComplet
        ? t.pvMax - t.pvActuels
        : Math.round(jet(sort.baseMin, sort.baseMax, ctx.rng) * multSoin(lanceur.stats));
      soigner(t, montant, ctx);
      poseCooldown(t);
    }
    return;
  }

  // --- BUFF / DEBUFF (soutien) ---
  if (sort.type === "buff" || sort.type === "debuff") {
    ctx.log(`${lanceur.nom} lance ${sort.nom}.`); // annonce avant les effets (ordre du journal)
    // Tactique féline : +PA aux alliés des cases adjacentes
    if (sort.paGainAdjacents) {
      const voisines = adjacents(lanceur.position);
      for (const a of allies(lanceur, cs)) {
        if (a.ref !== lanceur.ref && voisines.includes(a.position)) {
          a.paBonusNextTurn += sort.paGainAdjacents;
          ctx.log(`${a.nom} gagne ${sort.paGainAdjacents} PA (Tactique féline).`);
        }
      }
    }
    let cibles: Combatant[];
    if (sort.cible === "allie_tous") {
      cibles = allies(lanceur, cs);
    } else if (cible) {
      cibles = [cible];
      if (sort.nbCibles && sort.nbCibles > 1) {
        const autres = allies(lanceur, cs)
          .filter((a) => a.ref !== cible.ref)
          .sort((a, b) => Math.abs(a.position - cible.position) - Math.abs(b.position - cible.position));
        cibles.push(...autres.slice(0, sort.nbCibles - 1));
      }
    } else {
      cibles = [];
    }
    for (const t of cibles) {
      appliquerSoutien(sort, t, lanceur, ctx);
      poseCooldown(t);
    }
    return;
  }

  // --- DEGATS ---
  if (!cible) return;
  const useMax = consommeMaxRoll(lanceur);
  // Vigueur des bois : bonus % consommé sur ce sort offensif (tous les coups)
  const bonusVigueur = lanceur.bonusOffensifProchain;
  lanceur.bonusOffensifProchain = 0;
  // Tir Puissant : la prochaine flèche applique ses effets à durée doublée (one-shot)
  const doubleDuree = !!lanceur.doubleEffetProchain;
  lanceur.doubleEffetProchain = false;
  let totalDmg = 0;

  // Mise à mort : échoue si la cible survivrait au coup (projection au max roll)
  if (sort.executeSeulement) {
    const se = statsEffectives(lanceur);
    let proj = sort.baseMax + statElement(se, elementDeFrappe(lanceur)) * sort.scaling;
    proj *= (1 + sommeEffet(lanceur, "degatsInfliges")) * multOffensif(se);
    if (lanceur.camp === "joueur") proj *= ctx.playerDamageBonus;
    if (proj < cible.pvActuels + cible.bouclier) {
      ctx.log(`${sort.nom} échoue : ${cible.nom} aurait survécu.`);
      return;
    }
  }

  // Déluge de lames : N projectiles sur cibles ennemies aléatoires
  if (sort.projectiles) {
    const p = sort.projectiles;
    for (const t of ciblesAleatoires(adverses(lanceur, cs), p.nb, ctx.rng)) {
      const dmg = frappe(lanceur, { baseMin: p.baseMin, baseMax: p.baseMax, scaling: p.scaling }, t, { useMax: false, mult: 1 + bonusVigueur, ctx }, sort.nom);
      totalDmg += dmg;
      if (dmg > 0 && t.pvActuels > 0 && p.poison && p.pProc && ctx.rng() < p.pProc) {
        appliquerPoison(t, lanceur, p.poison);
      }
    }
    return;
  }

  // Coup double : plusieurs frappes sur la cible primaire
  if (sort.coups) {
    for (const coup of sort.coups) {
      if (cible.pvActuels <= 0) break;
      const dmg = frappe(lanceur, coup, cible, { useMax, mult: 1 + bonusVigueur, ctx }, sort.nom);
      totalDmg += dmg;
      if (dmg > 0 && cible.pvActuels > 0 && coup.proc && ctx.rng() < coup.proc.p) {
        if (coup.proc.poison) appliquerPoison(cible, lanceur, coup.proc.poison);
        if (coup.proc.friction) appliquerEffet(cible, { stat: "friction", valeur: 1, duree: coup.proc.friction });
      }
    }
    if (sort.bouclierRatioDegats && totalDmg > 0) {
      const b = Math.round(totalDmg * sort.bouclierRatioDegats);
      lanceur.bouclier += b;
      ctx.log(`${lanceur.nom} gagne un bouclier de ${b}.`);
    }
    if (sort.vampirismeRatio && totalDmg > 0) soigner(lanceur, Math.round(totalDmg * sort.vampirismeRatio * multSoin(lanceur.stats)), ctx);
    poseCooldown(cible);
    return;
  }

  // Multiplicateur de dé (All in)
  const deMult = sort.de ? sort.de.multMin + tirageDe(lanceur, sort.de.faces, ctx.rng) * (sort.de.multMax - sort.de.multMin) : 1;

  const touchees = ciblesDegats(lanceur, sort, cible, cs);
  let primaireMorte = false;

  touchees.forEach((t, i) => {
    const mult = (sort.rebond ? 1 + sort.rebond.bonusParSaut * i : 1) * (1 + bonusVigueur) * deMult;
    const r = degatsCible(lanceur, sort, t, { useMax, mult, ctx });
    if (r.esquive) {
      ctx.log(`${t.nom} esquive ${sort.nom} !`);
    } else {
      infligerDegats(t, r.dmg, lanceur, ctx, sort.ignoreBouclier);
      totalDmg += r.dmg;
      ctx.log(
        `${lanceur.nom} → ${sort.nom} sur ${t.nom} : ${r.dmg} dégâts${r.crit ? " (CRIT)" : ""}.` +
          (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
      );
      if (t.pvActuels > 0) {
        if (sort.poison) appliquerPoison(t, lanceur, etirer(sort.poison, doubleDuree));
        if (sort.effet) appliquerEffet(t, etirer(sort.effet, doubleDuree));
        if (sort.procAleatoire && sort.procAleatoire.length) {
          const proc = sort.procAleatoire[Math.floor(ctx.rng() * sort.procAleatoire.length)];
          if (proc.dissipePositifs) dissiperPositifs(t, ctx);
          if (proc.effet) appliquerEffet(t, etirer(proc.effet, doubleDuree));
        }
      }
    }
    if (i === 0 && t.pvActuels <= 0) primaireMorte = true;
  });

  // Épée hostile : rebond x2 si la cible primaire meurt
  if (sort.siCibleMeurt && primaireMorte) {
    const t = adverses(lanceur, cs)
      .filter((e) => e.ref !== cible.ref)
      .sort((a, b) => a.position - b.position)[0];
    if (t) {
      const r = degatsCible(lanceur, sort, t, { useMax: false, mult: sort.siCibleMeurt.rebondDegatsX, ctx });
      if (r.esquive) {
        ctx.log(`${t.nom} esquive le rebond de ${sort.nom} !`);
      } else {
        infligerDegats(t, r.dmg, lanceur, ctx);
        totalDmg += r.dmg;
        ctx.log(
          `${sort.nom} rebondit sur ${t.nom} : ${r.dmg} dégâts !` +
            (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
        );
      }
    }
  }

  // Mot vampirique : soigne l'équipe d'une fraction des dégâts infligés
  if (sort.soinEquipeRatio && totalDmg > 0) {
    const soin = Math.round(totalDmg * sort.soinEquipeRatio * multSoin(lanceur.stats));
    for (const a of allies(lanceur, cs)) soigner(a, soin, ctx);
    ctx.log(`${lanceur.nom} draine ${soin} PV pour l'équipe.`);
  }

  // Attaque céleste : bouclier au lanceur = pct des dégâts infligés
  if (sort.bouclierRatioDegats && totalDmg > 0) {
    const b = Math.round(totalDmg * sort.bouclierRatioDegats);
    lanceur.bouclier += b;
    ctx.log(`${lanceur.nom} gagne un bouclier de ${b}.`);
  }

  // Pattounes : soigne le lanceur d'une fraction des dégâts infligés
  if (sort.vampirismeRatio && totalDmg > 0) {
    soigner(lanceur, Math.round(totalDmg * sort.vampirismeRatio * multSoin(lanceur.stats)), ctx);
  }

  // Fracas : retrait de PA au prochain tour — chance scalée par le Wakfu du lanceur
  if (sort.retraitPA && cible.pvActuels > 0 && ctx.rng() < pctRetraitPA(statsEffectives(lanceur))) {
    cible.retraitPANextTurn += sort.retraitPA;
  }

  // Colère : passe le tour si la cible survit
  if (sort.passeTourSiSurvie && cible.pvActuels > 0) lanceur.passeProchainTour = true;

  // Épée du Jugement : buff appliqué au lanceur (ex. +résistances)
  if (sort.effetLanceur) appliquerEffet(lanceur, sort.effetLanceur);

  // Flèche magique : chance (scale Chance) de rembourser le coût en PA du sort
  if (sort.rembPA && ctx.rng() < pctRembPA(statsEffectives(lanceur))) {
    lanceur.paActuels += sort.coutPA;
    ctx.log(`${lanceur.nom} récupère ${sort.coutPA} PA (Flèche magique).`);
  }

  poseCooldown(cible);
}

// --- Fin de combat -----------------------------------------------------------
const campMort = (cs: Combatant[], camp: Camp): boolean => vivants(cs).every((c) => c.camp !== camp);
export const combatTermine = (cs: Combatant[]): boolean => campMort(cs, "joueur") || campMort(cs, "ennemi");
export const joueurGagne = (cs: Combatant[]): boolean => campMort(cs, "ennemi") && !campMort(cs, "joueur");

// --- Boucle de combat --------------------------------------------------------
export async function runCombat(combatants: Combatant[], hooks: CombatHooks): Promise<boolean> {
  const ctx: CombatCtx = {
    rng: hooks.rng ?? Math.random,
    log: hooks.log ?? (() => {}),
    playerDamageBonus: hooks.playerDamageBonus ?? 1,
  };

  let garde = 0;
  while (!combatTermine(combatants)) {
    if (++garde > 1000) break; // sécurité anti-boucle infinie

    // Un round : chaque combattant agit une fois, dans l'ordre de l'initiative
    // EFFECTIVE (recalculée à chaque pick, pour que les baisses d'init pendant
    // le round repoussent les acteurs qui n'ont pas encore joué). Les invocations
    // occupent une place mais ne jouent pas.
    const aJoue = new Set<string>();
    for (;;) {
      if (combatTermine(combatants)) break;
      const candidats = vivants(combatants).filter((c) => !c.estInvocation && !aJoue.has(c.ref));
      if (!candidats.length) break;
      candidats.sort((a, b) => initOf(b) - initOf(a));
      const acteur = candidats[0];
      aJoue.add(acteur.ref);

      acteur.paActuels = acteur.paMax; // recharge des PA
      if (effetsDebutTour(acteur, combatants, ctx)) {
        await hooks.onUpdate?.();
        continue;
      }

      ctx.log(`▶ Tour de ${acteur.nom} (${acteur.paActuels} PA).`);
      await hooks.onUpdate?.();

      let secu = 0;
      while (acteur.pvActuels > 0 && !combatTermine(combatants)) {
        if (++secu > 50) break;
        const action = await hooks.controllers[acteur.camp](acteur, combatants);
        if (!action) break; // fin de tour volontaire
        if (acteur.paActuels < action.sort.coutPA) break;
        acteur.paActuels -= action.sort.coutPA;
        lancerSort(acteur, action.sort, action.cibleRef, combatants, ctx);
        await hooks.onUpdate?.();
      }

      decrementerEffets(acteur);
    }
  }

  return joueurGagne(combatants);
}

// --- IA ----------------------------------------------------------------------
function iaAgressif(acteur: Combatant, cs: Combatant[]): Action | null {
  const sorts = acteur.sorts
    .map((id) => SORTS[id])
    .filter((s) => s.type === "degats" && acteur.paActuels >= s.coutPA)
    .sort((a, b) => b.coutPA - a.coutPA); // le plus cher d'abord
  for (const s of sorts) {
    const cibles = ciblesValides(acteur, s, cs).sort((a, b) => a.pvActuels - b.pvActuels);
    if (cibles.length) return { sort: s, cibleRef: cibles[0].ref };
  }
  return null;
}

function iaSoutien(acteur: Combatant, cs: Combatant[]): Action | null {
  const soin = acteur.sorts.map((id) => SORTS[id]).find((s) => s.type === "soin" && acteur.paActuels >= s.coutPA);
  if (soin) {
    const blesses = allies(acteur, cs)
      .filter((a) => a.pvActuels < a.pvMax)
      .sort((a, b) => a.pvActuels - b.pvActuels);
    if (blesses.length) return { sort: soin, cibleRef: blesses[0].ref };
  }
  return iaAgressif(acteur, cs);
}

/** Contrôleur IA : choisit selon le comportement du combattant. */
export const controllerIA: Controller = (acteur, cs) =>
  acteur.ia === "soutien" ? iaSoutien(acteur, cs) : iaAgressif(acteur, cs);
