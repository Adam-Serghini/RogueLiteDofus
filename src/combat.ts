// =============================================================================
//  combat.ts — Moteur de combat (pur, sans DOM)
//  Boucle de tour, calcul de dégâts, règle de ligne, effets, IA.
//  Pilotable sans UI : voir test.ts (deux IA qui s'affrontent en console).
// =============================================================================
import { SORTS, MONSTRES } from "./data";
import { multOffensif, multSoin, pctRembPA } from "./progression";
import type {
  Camp, Combatant, EffetSpec, EffetStat, Element, Monstre, Spell, Stats, Action,
} from "./types";

// --- Aléatoire (injectable pour les tests) -----------------------------------
export type Rng = () => number;
const jet = (min: number, max: number, rng: Rng): number =>
  min + Math.floor(rng() * (max - min + 1));

// --- Contexte d'un combat ----------------------------------------------------
/** Événement purement visuel (crit, esquive…) — consommé par l'UI, ignoré en headless. */
export interface FxEvent {
  type: "crit" | "esquive";
  ref: string; // combattant concerné (cible du coup / esquiveur)
}

export interface CombatCtx {
  rng: Rng;
  log: (msg: string) => void;
  playerDamageBonus: number; // multiplicateur Dofus appliqué au camp joueur
  fx?: (ev: FxEvent) => void; // effets visuels (optionnel)
  onDegats?: (attaquantRef: string, dmg: number) => void; // stats de run (optionnel)
  combatants?: Combatant[]; // référence vivante de la liste en cours (posée par lancerSort) — lookup Lance/redirection
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
  fx?: (ev: FxEvent) => void; // effets visuels (crit, esquive…)
  onDegats?: (attaquantRef: string, dmg: number) => void; // stats de run (récap de fin)
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
  }
};

/** Stat (buffable) portant chaque élément — pour buffer la carac d'un élément. */
const ELEMENT_STAT: Record<Element, EffetStat> = {
  terre: "force", feu: "intelligence", eau: "chance", air: "agilite",
};

/** Liste des 4 éléments (ordre stable d'affichage). */
export const ELEMENTS: Element[] = ["terre", "feu", "eau", "air"];

const sommeEffet = (c: Combatant, stat: EffetStat): number =>
  c.effets.filter((e) => e.stat === stat).reduce((s, e) => s + e.valeur, 0);

/** Stats effectives = stats de base + buffs/debuffs temporaires de caractéristique. */
const STATS_BUFFABLES = ["force", "intelligence", "agilite", "chance"] as const;
export function statsEffectives(c: Combatant): Stats {
  const s: Stats = { ...c.stats };
  for (const k of STATS_BUFFABLES) {
    const bonus = sommeEffet(c, k);
    if (bonus) s[k] = (s[k] ?? 0) + bonus;
  }
  // crit plat temporaire (Tir Puissant) : propagé vers se.crit, lu par chanceCrit/critExcedent
  const bonusCrit = sommeEffet(c, "crit");
  if (bonusCrit) s.crit = (s.crit ?? 0) + bonusCrit;
  return s;
}

/** Les 2 éléments les plus forts d'un combattant (ordre décroissant de stat effective). */
export function elementsForts(c: Combatant): [Element, Element] {
  const se = statsEffectives(c);
  const tri = ELEMENTS.map((el): [Element, number] => [el, statElement(se, el)])
    .sort((a, b) => b[1] - a[1]);
  return [tri[0][0], tri[1][0]];
}

/** Élément de frappe : le choix explicite du joueur (fiche) prime ; sinon sa plus haute stat. */
export function elementDeFrappe(c: Combatant): Element {
  if (c.elementChoisi) return c.elementChoisi;
  return elementsForts(c)[0];
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
      // règle de ligne SYMÉTRIQUE : on ne vise que la ligne avant (cases 0-3),
      // sauf si le lanceur ignore la ligne (Œil perçant…) : alors comme ennemi_tous
      const adv = adverses(acteur, cs);
      base = sommeEffet(acteur, "ignoreLigne") > 0 ? adv : ligneFront(adv);
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

  // zoneLance (Forgelance : Muspel/Hydra/Jormun) : la lance VIVANTE du lanceur
  // est toujours une cible valide, où qu'elle soit (résolution = sa rangée).
  if (sort.zoneLance) {
    const lance = vivants(cs).find((c) => c.estLance && c.lanceurRef === acteur.ref);
    if (lance && !base.some((c) => c.ref === lance.ref)) base = [...base, lance];
  }

  // Tétanisation (Ouginak) : le porteur ne peut pas viser la ligne arrière adverse
  if ((sort.cible === "ennemi_tous" || sort.cible === "ennemi_ligne" || sort.cible === "mixte") &&
      sommeEffet(acteur, "tetanise") > 0) {
    base = base.filter((c) => c.camp === acteur.camp || estAvant(c));
  }

  // Apaisement (Ouginak) : ne se lance qu'avec au moins 1 état de Rage
  if (sort.consommeRage && !(acteur.rage ?? 0)) return [];

  // Kaboom (Roublard) : ne se lance que si un adversaire vivant porte au moins 1 bombe
  if (sort.kaboom && !adverses(acteur, cs).some((e) => (e.bombes ?? 0) > 0)) return [];

  // Lance (Forgelance) : une seule vivante par lanceur — grisée si déjà plantée
  if (sort.invoqueLance && vivants(cs).some((c) => c.ref === `lance_${acteur.ref}`)) return [];
  // Vajra (Forgelance) : injouable sans lance vivante du lanceur
  if (sort.rappelleLance && !vivants(cs).some((c) => c.ref === `lance_${acteur.ref}`)) return [];

  // Changer de ligne (Dagues Eurfolles) : il faut une case libre dans la rangée opposée
  if (sort.changeLigne && caseLibreRangeeOpposee(acteur, cs) === null) return [];

  // cooldown par sort (côté lanceur) : sort entièrement indisponible pendant Nt
  if (enCooldownSort(acteur, sort)) return [];
  // un sort à cooldown n'est plus ciblable sur une cible en attente de recharge
  if (sort.cooldown) base = base.filter((c) => !enCooldown(acteur, sort, c.ref));
  // limites de lancer « par tour » (maxParTour / maxParCibleParTour)
  if (sort.maxParTour && (acteur.lancersCeTour?.[sort.id] ?? 0) >= sort.maxParTour) return [];
  if (sort.maxParCibleParTour) {
    base = base.filter((c) => (acteur.lancersCeTour?.[`${sort.id}:${c.ref}`] ?? 0) < sort.maxParCibleParTour!);
  }
  return base;
}

/** Remise à zéro des limites de lancer « par tour » (appelée au début du tour du combatant). */
export function reinitialiserLancersTour(c: Combatant): void { c.lancersCeTour = {}; }

/** Cibles effectivement touchées par un sort de dégâts (primaire + rebonds). */
function ciblesDegats(acteur: Combatant, sort: Spell, primaire: Combatant, cs: Combatant[]): Combatant[] {
  // Forgelance (Muspel/Hydra/Jormun) : résolution = la rangée de la cible cliquée
  // (front row normale, ou celle de la lance si c'est elle qui est visée) —
  // Jormun (tousSiLanceArriere) : si la cible est la lance en rangée ARRIÈRE, TOUS les ennemis.
  if (sort.zoneLance) {
    if (sort.tousSiLanceArriere && primaire.estLance && !estAvant(primaire)) {
      return adverses(acteur, cs);
    }
    const memeRangee = estAvant(primaire);
    return adverses(acteur, cs).filter((e) => estAvant(e) === memeRangee);
  }
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

// --- Fabrique de combattants ---------------------------------------------------
/** Champs d'ÉTAT DE COMBAT initialisés à zéro, communs à toute création de
 *  Combatant (héros, monstre, invocation). SOURCE UNIQUE : un nouveau champ
 *  d'état s'ajoute ici, pas dans chacune des quatre fabriques. */
export function etatCombatInitial(): Pick<Combatant,
  "effets" | "maxRollCharges" | "passeProchainTour" | "bouclier" | "paBonusNextTurn" |
  "cooldowns" | "bonusOffensifProchain" | "poisonAmpliTours" | "bonusDe" | "bonusDeTours"> {
  return {
    effets: [],
    maxRollCharges: 0,
    passeProchainTour: false,
    bouclier: 0,
    paBonusNextTurn: 0,
    cooldowns: {},
    bonusOffensifProchain: 0,
    poisonAmpliTours: 0,
    bonusDe: 0,
    bonusDeTours: 0,
  };
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
  perceResistances?: number; // fraction des résistances ignorée (Dagues Aj'Deh'La)
  bonusParPADispo?: number; // Flèche Punitive : +X % par PA dispo AVANT paiement (opts.paAvant)
  bonusParTelefrag?: number; // Rayon Obscur : +X % par Téléfrag posé sur la cible
}

// --- Rage (Ouginak) -----------------------------------------------------------
export const RAGE_MAX = 3; // charges maximum
export const RAGE_BONUS = 0.05; // +5 % de dégâts infligés par charge

function gagnerRage(lanceur: Combatant, ctx: CombatCtx): void {
  const avant = lanceur.rage ?? 0;
  lanceur.rage = Math.min(RAGE_MAX, avant + 1);
  if (lanceur.rage > avant) ctx.log(`🐺 ${lanceur.nom} entre en Rage (×${lanceur.rage}).`);
}

/** Chance de coup critique : Force (+ crit plat d'équipement), plafonnée à 50 %.
 *  SOURCE UNIQUE de la formule — l'UI l'affiche via cette fonction. */
export function chanceCrit(se: Stats): number {
  return Math.min(0.5, se.force * 0.005 + (se.crit ?? 0) / 100);
}

// --- Bombes (Roublard) / Téléfrags (Xélor) -----------------------------------
export const BOMBES_MAX = 5;
export const TELEFRAGS_MAX = 4;

/** Colle une bombe (Roublard). false si le cap est atteint. */
export function poserBombe(cible: Combatant, ctx?: CombatCtx): boolean {
  if (cible.estLance) return false; // la lance (Forgelance) n'est pas une cible de compteur
  if ((cible.bombes ?? 0) >= BOMBES_MAX) return false;
  cible.bombes = (cible.bombes ?? 0) + 1;
  ctx?.log(`💣 Une bombe colle à ${cible.nom} (${cible.bombes}/${BOMBES_MAX}).`);
  return true;
}

/** Pose un Téléfrag (Xélor), sous cap. Écho d'Aiguille : si la cible est aiguillée,
 *  un nouveau jet de SORTS.aiguille (par l'acteur courant `lanceur`) la reblesse. */
export function poserTelefrag(cible: Combatant, _cs: Combatant[], ctx: CombatCtx, lanceur?: Combatant): void {
  if (cible.estLance) return; // la lance (Forgelance) n'est pas une cible de compteur
  if ((cible.telefrags ?? 0) >= TELEFRAGS_MAX) return;
  cible.telefrags = (cible.telefrags ?? 0) + 1;
  ctx.log(`⏳ Téléfrag sur ${cible.nom} (${cible.telefrags}/${TELEFRAGS_MAX}).`);
  if (lanceur && sommeEffet(cible, "aiguille") > 0) {
    frappe(lanceur, SORTS.aiguille, cible, { useMax: false, mult: 1, ctx }, "Écho d'Aiguille");
  }
}

// --- Portails (Éliotrope) -----------------------------------------------------
export const PORTAILS_MAX = 4;

/** Ouvre un portail (Éliotrope) — compteur cumulable, cap 4. */
export function poserPortail(lanceur: Combatant, ctx: CombatCtx): void {
  if ((lanceur.portails ?? 0) >= PORTAILS_MAX) return;
  lanceur.portails = (lanceur.portails ?? 0) + 1;
  ctx.log(`🌀 ${lanceur.nom} ouvre un portail (${lanceur.portails}/${PORTAILS_MAX}).`);
}

/** Aura des portails : ×(1+2 %/portail) pour le porteur, ×(1+1 %/portail) pour sa rangée. */
export function multPortails(lanceur: Combatant, cs: Combatant[]): number {
  if (lanceur.portails) return 1 + 0.02 * lanceur.portails;
  const meilleur = Math.max(0, ...cs.filter((c) =>
    c.camp === lanceur.camp && c.ref !== lanceur.ref && c.pvActuels > 0 &&
    (c.portails ?? 0) > 0 && estAvant(c) === estAvant(lanceur)).map((c) => c.portails ?? 0));
  return 1 + 0.01 * meilleur;
}

/** Part du crit au-delà du cap 50 %, convertie en dégâts finaux (Tir Puissant).
 *  Seule la stat de crit PLATE peut déborder du cap — la Force seule ne le peut jamais. */
export function critExcedent(se: Stats): number {
  return Math.max(0, Math.min(0.5, se.force * 0.005) + (se.crit ?? 0) / 100 - 0.5);
}

/** Bonus de dégâts d'un critique : +25 % de base + Agilité, plafonné à +60 %. */
export function bonusDegatsCrit(se: Stats): number {
  return Math.min(0.6, 0.25 + se.agilite * 0.004);
}

export function degatsCible(
  lanceur: Combatant,
  sort: Spell,
  cible: Combatant,
  opts: { useMax: boolean; mult: number; ctx: CombatCtx; paAvant?: number },
): ResultatDegats {
  return degatsAvec(lanceur, sort, cible, opts);
}

function degatsAvec(
  lanceur: Combatant,
  base: BaseDegats,
  cible: Combatant,
  opts: { useMax: boolean; mult: number; ctx: CombatCtx; paAvant?: number },
): ResultatDegats {
  const { ctx } = opts;
  const se = statsEffectives(lanceur);
  const seCible = statsEffectives(cible);

  // esquive (Agilité de la cible + buffs + équipement « ligne arrière », plafonnée à 50 %)
  const esquiveEquip = !estAvant(cible) ? (cible.esquiveArriere ?? 0) : 0; // Baguette Rikiki
  if (ctx.rng() < Math.min(0.5, seCible.agilite * 0.002 + sommeEffet(cible, "esquive") + esquiveEquip)) {
    return { dmg: 0, esquive: true, crit: false };
  }

  // jet (max si buff "maxRoll" actif)
  let dmg = opts.useMax ? base.baseMax : jet(base.baseMin, base.baseMax, ctx.rng);

  // stat de l'élément de frappe
  const el = elementDeFrappe(lanceur);
  dmg += statElement(se, el) * base.scaling;

  // critique : chance via Force (≤ 50 %), bonus de dégâts via Agilité (+25 % à +60 %)
  let crit = false;
  if (ctx.rng() < chanceCrit(se)) {
    dmg *= 1 + bonusDegatsCrit(se);
    crit = true;
  }

  // malus/bonus de dégâts infligés par le lanceur (= « dégâts finaux »)
  dmg *= 1 + sommeEffet(lanceur, "degatsInfliges");

  // Rage (Ouginak) : +RAGE_BONUS par charge accumulée
  if (lanceur.rage) dmg *= 1 + RAGE_BONUS * Math.min(lanceur.rage, RAGE_MAX);

  // Ascension « Boss enragés » : dégâts cumulés tour après tour
  if (lanceur.enrageCumul) dmg *= 1 + lanceur.enrageCumul;

  // Flèche Punitive : +X % par PA disponible avant le lancer
  if (base.bonusParPADispo && opts.paAvant !== undefined) dmg *= 1 + base.bonusParPADispo * opts.paAvant;
  // Rayon Obscur : +X % par Téléfrag de la cible
  if (base.bonusParTelefrag) dmg *= 1 + base.bonusParTelefrag * (cible.telefrags ?? 0);
  // Tir Puissant : le crit au-delà du cap devient des dégâts finaux
  dmg *= 1 + critExcedent(se);

  // bonus de rebond (saut)
  dmg *= opts.mult;

  // résistance de l'élément (+ resAll), sauf ignoreResistances ;
  // perceResistances (arme) : seule une fraction de la résistance compte
  if (!base.ignoreResistances) {
    const res = (cible.resistances[el] ?? 0) + sommeEffet(cible, "resAll");
    dmg *= 1 - res * (1 - (base.perceResistances ?? 0));
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
  const benefiques: EffetStat[] = ["hot", "esquive", "reductionDegats", "armure", "resAll", "vitalite", "force", "intelligence", "agilite", "chance"];
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
function infligerDegats(
  cible: Combatant,
  dmg: number,
  attaquant?: Combatant,
  ctx?: CombatCtx,
  ignoreBouclier?: boolean,
  viaRedirection?: boolean,
): void {
  // Lance (Forgelance) : durabilité forfaitaire, ignore le montant réel, pas de
  // crit/esquive/log normal ; à 0 → détruite, bouclier au propriétaire.
  if (cible.estLance) {
    if (cible.pvActuels <= 0) return; // déjà détruite
    cible.pvActuels -= 1;
    ctx?.log(`🔱 La lance encaisse (${Math.max(0, cible.pvActuels)}/${LANCE_DURABILITE}).`);
    if (cible.pvActuels <= 0) {
      cible.pvActuels = 0;
      const proprio = ctx?.combatants && parRef(ctx.combatants, cible.lanceurRef ?? "");
      if (proprio && proprio.pvActuels > 0) {
        const bonus = Math.round(8 * multSoin(proprio.stats));
        proprio.bouclier += bonus;
        ctx?.log(`🔱 La lance de ${proprio.nom} vole en éclats : ${proprio.nom} gagne ${bonus} bouclier.`);
      }
    }
    return;
  }

  // nullification (buff soi) : annule UN coup DIRECT (pas un tick de poison, qui ne
  // passe pas par cette fonction), consommée dès le premier coup direct qui suit
  if (dmg > 0 && cible.nullifieProchainCoup) {
    cible.nullifieProchainCoup = false;
    ctx?.log(`${cible.nom} annule le coup grâce à sa nullification !`);
    dmg = 0;
  }

  // Redirection (Étreinte) : un allié porteur dévie une fraction des dégâts
  // destinés à un allié en ligne ARRIÈRE (jamais le porteur lui-même). La part
  // redirigée passe par un appel gardé (viaRedirection) pour ne jamais se
  // re-rediriger, mais garde bouclier/nullification normaux côté porteur.
  if (!viaRedirection && dmg > 0 && ctx?.combatants && cible.camp === "joueur" && !estAvant(cible)) {
    const porteur = vivants(ctx.combatants).find((c) =>
      c.camp === cible.camp && c.ref !== cible.ref && c.redirection && c.redirection.tours > 0);
    if (porteur) {
      const ratio = porteur.redirection!.ratio;
      const versPorteur = Math.floor(dmg * ratio);
      const versVictime = Math.ceil(dmg * (1 - ratio));
      ctx.log(`🌀 ${porteur.nom} dévie une partie du coup destiné à ${cible.nom}.`);
      infligerDegats(porteur, versPorteur, attaquant, ctx, false, true);
      dmg = versVictime;
    }
  }

  if (attaquant && dmg > 0) ctx?.onDegats?.(attaquant.ref, dmg); // stats de run
  let reste = dmg;
  if (cible.bouclier > 0 && !ignoreBouclier) {
    const absorbe = Math.min(cible.bouclier, reste);
    cible.bouclier -= absorbe;
    reste -= absorbe;
  }
  cible.pvActuels = Math.max(0, cible.pvActuels - reste);
  verifierRenaissance(cible, ctx); // Kwakwanneau : renaît une fois par combat
  // récupération (Goyave) : le porteur survivant régénère une fraction des dégâts subis
  if (cible.soinDegatsRecus && dmg > 0 && cible.pvActuels > 0) {
    const soin = Math.round(dmg * cible.soinDegatsRecus);
    if (soin > 0) {
      cible.pvActuels = Math.min(cible.pvMax, cible.pvActuels + soin);
      ctx?.log(`${cible.nom} récupère ${soin} PV (Goyave).`);
    }
  }
  // Proie (Ouginak) : quiconque frappe la proie vole une fraction des dégâts
  if (attaquant && ctx && dmg > 0 && attaquant.camp !== cible.camp && attaquant.pvActuels > 0) {
    const ratio = sommeEffet(cible, "proie");
    if (ratio > 0) {
      const vol = Math.round(dmg * ratio);
      if (vol > 0) {
        attaquant.pvActuels = Math.min(attaquant.pvMax, attaquant.pvActuels + vol);
        ctx.log(`${attaquant.nom} dévore sa proie : +${vol} PV.`);
      }
    }
  }
  // riposte : posture de contre (Duel) + équipement « ligne avant » (Sabre Shodanwa)
  const pRiposte = attaquant && ctx
    ? sommeEffet(cible, "contre") + (estAvant(cible) ? (cible.riposteAvant ?? 0) : 0)
    : 0;
  if (
    attaquant && ctx && dmg > 0 &&
    cible.pvActuels > 0 && attaquant.pvActuels > 0 &&
    attaquant.camp !== cible.camp &&
    pRiposte > 0 && // ne consomme le RNG que si une riposte est possible
    ctx.rng() < pRiposte
  ) {
    const r = degatsAvec(cible, { baseMin: 8, baseMax: 12, scaling: 0.3 }, attaquant, { useMax: false, mult: 1, ctx });
    // pas d'attaquant → pas de contre-riposte ; pas de ctx non plus, donc la redirection
    // (Étreinte) ne s'applique jamais ici — de toute façon inatteignable avec le contenu
    // actuel (contre/riposteAvant sont des mécaniques côté joueur uniquement).
    infligerDegats(attaquant, r.dmg);
    ctx.log(`${cible.nom} riposte : ${r.dmg} dégâts à ${attaquant.nom}.`);
  }
}

/** Première case libre (0-3 ou 4-7) de la rangée OPPOSÉE à celle de `c`, dans son camp. */
function caseLibreRangeeOpposee(c: Combatant, cs: Combatant[]): number | null {
  const prises = new Set(vivants(cs).filter((x) => x.camp === c.camp).map((x) => x.position));
  const [debut, fin] = estAvant(c) ? [4, 7] : [0, 3];
  // on privilégie la case de la même colonne (±4), sinon la première libre
  const memeColonne = estAvant(c) ? c.position + 4 : c.position - 4;
  if (!prises.has(memeColonne)) return memeColonne;
  for (let p = debut; p <= fin; p++) if (!prises.has(p)) return p;
  return null;
}

/** Déplace une CIBLE vers la rangée opposée de son propre camp (échec silencieux
 *  si celle-ci est pleine). "arriere" : ne pousse que si la cible est en avant. */
function deplacerCible(cible: Combatant, mode: "toggle" | "arriere", cs: Combatant[], ctx: CombatCtx): void {
  if (mode === "arriere" && !estAvant(cible)) return; // déjà en arrière : rien à faire
  const dest = caseLibreRangeeOpposee(cible, cs);
  if (dest === null) return; // rangée opposée pleine : échec silencieux
  cible.position = dest;
  ctx.log(`${cible.nom} est repoussé en ligne ${dest < NB_COLONNES ? "AVANT" : "ARRIÈRE"}.`);
}

/** Les `n` combattants de `pool` les plus proches en COLONNE de `ref` (rework Cra :
 *  Flèche enflammée / Flèche de recul — éclaboussure/bousculade sur les voisins). */
function plusProches(ref: Combatant, pool: Combatant[], n: number): Combatant[] {
  const col = ref.position % NB_COLONNES;
  return [...pool]
    .sort((a, b) => Math.abs((a.position % NB_COLONNES) - col) - Math.abs((b.position % NB_COLONNES) - col))
    .slice(0, n);
}

/** Ennemi vivant de la ligne ARRIÈRE le plus proche de la colonne de `cible`
 *  (la « victime derrière » de la Masse Aj Taye). null si cible déjà derrière. */
function derriereEnLigne(cible: Combatant, cs: Combatant[]): Combatant | null {
  if (!estAvant(cible)) return null;
  const arrieres = vivants(cs).filter((x) => x.camp === cible.camp && !estAvant(x));
  if (!arrieres.length) return null;
  return arrieres.sort((a, b) =>
    Math.abs(a.position - 4 - cible.position) - Math.abs(b.position - 4 - cible.position))[0];
}

/** Renaissance (Kwakwanneau) : si le porteur vient de tomber et qu'il lui reste
 *  une renaissance, il se relève aussitôt à la fraction de PV de l'anneau. */
function verifierRenaissance(c: Combatant, ctx?: CombatCtx): void {
  if (c.pvActuels > 0 || !c.renaissance || !(c.renaissancesRestantes ?? 0)) return;
  c.renaissancesRestantes = (c.renaissancesRestantes ?? 1) - 1;
  c.pvActuels = Math.max(1, Math.round(c.pvMax * c.renaissance));
  c.bombes = 0; // purge des compteurs du porteur mort (§B3), même logique que ressusciter()
  c.telefrags = 0;
  ctx?.log(`🥚 ${c.nom} renaît de son Kwakwanneau à ${c.pvActuels} PV !`);
}

/** Combattant vivant juste derrière `c` dans sa ligne (position supérieure). */
function derriere(c: Combatant, cs: Combatant[]): Combatant | undefined {
  return vivants(cs)
    .filter((x) => x.camp === c.camp && x.position > c.position)
    .sort((a, b) => a.position - b.position)[0];
}

/** Retire immédiatement des PA à la cible (visible sur sa carte avant son tour). */
function retirerPA(cible: Combatant, n: number, ctx: CombatCtx): void {
  const avant = cible.paActuels;
  cible.paActuels = Math.max(0, cible.paActuels - n);
  if (cible.paActuels < avant) ctx.log(`${cible.nom} perd ${avant - cible.paActuels} PA.`);
}

/**
 * Effets de début de tour. Renvoie true si le combattant n'agit pas
 * (passe son tour, ou est mort d'un poison).
 */
export function effetsDebutTour(acteur: Combatant, cs: Combatant[], ctx: CombatCtx): boolean {
  // gain de PA (Mot d'ivation)
  if (acteur.paBonusNextTurn > 0) {
    acteur.paActuels += acteur.paBonusNextTurn;
    ctx.log(`${acteur.nom} gagne ${acteur.paBonusNextTurn} PA (Mot d'ivation).`);
    acteur.paBonusNextTurn = 0;
  }
  // PA par tour (Cadran…) : crédite tant que l'effet dure (posé par paParTourLigne)
  for (const e of acteur.effets.filter((x) => x.stat === "paParTour")) {
    acteur.paActuels += e.valeur;
    ctx.log(`${acteur.nom} gagne ${e.valeur} PA (effet de ligne).`);
  }
  // poison (DoT) — peut tuer, et se transmet alors au combattant derrière
  for (const e of acteur.effets.filter((x) => x.stat === "poison")) {
    acteur.pvActuels = Math.max(0, acteur.pvActuels - e.valeur);
    ctx.log(`${acteur.nom} subit ${e.valeur} dégâts de poison.`);
  }
  verifierRenaissance(acteur, ctx); // le Kwakwanneau sauve aussi d'une mort au poison
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
  acteur.resquilleActive = undefined; // Resquille (Roublard) : ne dure que le tour où elle est posée

  // redirection (Étreinte) : décompte sur le porteur, retirée à 0
  if (acteur.redirection && --acteur.redirection.tours <= 0) acteur.redirection = undefined;

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
  if (sort.paProchainTour) {
    // Math.max() volontaire : ce gain ne se CUMULE avec AUCUNE autre source de PA au
    // prochain tour (dont paGain juste au-dessus) — poser Mot d'ivation puis Prémonition
    // ne garde que le plus gros des deux, le premier posé est perdu. Comportement voulu
    // (Prémonition est un plancher garanti, pas un stack).
    cible.paBonusNextTurn = Math.max(cible.paBonusNextTurn, sort.paProchainTour);
    ctx.log(`${cible.nom} anticipe : +${sort.paProchainTour} PA au prochain tour (Prémonition).`);
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
  if (sort.nullifieProchain) {
    cible.nullifieProchainCoup = true;
    ctx.log(`${cible.nom} se prépare à annuler le prochain coup direct.`);
  }
  if (sort.resquille) {
    cible.resquilleActive = sort.resquille;
    ctx.log(`${cible.nom} prépare une Resquille (−${sort.resquille} PA au prochain Kaboom).`);
  }
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
    img: "/assets/divers/poupee.png",
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    provoque: invo.provoque,
  });
  ctx.log(`${lanceur.nom} invoque une ${invo.nom} (${invo.pv} PV) qui provoque les ennemis.`);
}

// --- La Lance (Forgelance) -----------------------------------------------------
/** Durabilité forfaitaire de la Lance : encaisse 2 coups quel qu'en soit le montant. */
export const LANCE_DURABILITE = 2;

/** Invoque une Lance (camp ENNEMI) à la case libre la plus proche en colonne de
 *  la rangée de `cibleEnnemie`. Une seule lance vivante par lanceur ; null si
 *  une lance du lanceur est déjà vivante, ou si la rangée cible est pleine. */
export function invoquerLance(
  lanceur: Combatant,
  cibleEnnemie: Combatant,
  cs: Combatant[],
  ctx: CombatCtx,
): Combatant | null {
  const ref = `lance_${lanceur.ref}`;
  if (vivants(cs).some((c) => c.ref === ref)) return null; // une seule lance vivante à la fois

  const [debut, fin] = estAvant(cibleEnnemie) ? [0, NB_COLONNES - 1] : [NB_COLONNES, 2 * NB_COLONNES - 1];
  const prises = new Set(vivants(cs).filter((c) => c.camp === "ennemi").map((c) => c.position));
  const colCible = cibleEnnemie.position % NB_COLONNES;
  let position: number | null = null;
  let meilleureDist = Infinity;
  for (let p = debut; p <= fin; p++) {
    if (prises.has(p)) continue;
    const d = Math.abs((p % NB_COLONNES) - colCible);
    if (d < meilleureDist) { meilleureDist = d; position = p; }
  }
  if (position === null) return null; // rangée cible pleine

  // une vieille lance morte du même lanceur ne doit pas traîner dans cs
  const idx = cs.findIndex((c) => c.ref === ref);
  if (idx >= 0) cs.splice(idx, 1);

  const lance: Combatant = {
    ref,
    nom: "Lance",
    pvBase: LANCE_DURABILITE,
    pvMax: LANCE_DURABILITE,
    pvActuels: LANCE_DURABILITE,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0 },
    paMax: 0,
    paActuels: 0,
    initiative: 0,
    resistances: {},
    sorts: [],
    camp: "ennemi",
    position,
    niveau: 1,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    estLance: true,
    lanceurRef: lanceur.ref,
  };
  cs.push(lance);
  ctx.log(`🔱 ${lanceur.nom} plante une Lance.`);
  return lance;
}

// --- Invocations de monstres (signatures de boss) ------------------------------
/** Première case libre (0-7) du camp — les invocations arrivent devant d'abord. */
function caseLibre(camp: Camp, cs: Combatant[]): number | null {
  const prises = new Set(vivants(cs).filter((c) => c.camp === camp).map((c) => c.position));
  for (let p = 0; p < 8; p++) if (!prises.has(p)) return p;
  return null;
}

/** Combatant complet depuis une espèce de MONSTRES (invocation en cours de combat).
 *  Contrairement à la Poupée (estInvocation), il JOUE ses tours normalement. */
function combattantInvoque(m: Monstre, ref: string, position: number, camp: Camp, invoquePar: string): Combatant {
  return {
    ref, nom: m.nom, pvBase: m.pv, pvMax: m.pv, pvActuels: m.pv,
    stats: { ...m.stats }, paMax: m.pa, paActuels: m.pa, initiative: m.initiative,
    resistances: { ...m.resistances }, sorts: [...m.sorts], camp, position,
    niveau: 1, monstreId: m.id, ia: m.ia, img: m.img,
    ...etatCombatInitial(), invoquePar,
  };
}

/** Alliés monstres vaincus, réinvocables par `acteur` (ni boss, ni invocation). */
const morteRessuscitable = (acteur: Combatant, cs: Combatant[]): Combatant[] =>
  cs.filter((c) =>
    c.camp === acteur.camp && c.pvActuels <= 0 && c.ref !== acteur.ref &&
    !c.estInvocation && !MONSTRES[c.monstreId ?? ""]?.boss);

/** Un sort d'invocation a-t-il un effet utile là, tout de suite ? (guide l'IA) */
export function invocationUtile(acteur: Combatant, sort: Spell, cs: Combatant[]): boolean {
  if (sort.invoqueMonstre) {
    const actives = vivants(cs).filter((c) => c.invoquePar === acteur.ref).length;
    return actives < sort.invoqueMonstre.max && caseLibre(acteur.camp, cs) !== null;
  }
  if (sort.ressuscite) return morteRessuscitable(acteur, cs).length > 0;
  return !!sort.invocation; // Poupée : géré par invoquerPoupee (refus si déjà active)
}

/** Invoque un monstre du pool (signature Kankreblath / Shin Larve). */
function invoquerMonstre(lanceur: Combatant, spec: { pool: string[]; max: number }, cs: Combatant[], ctx: CombatCtx): void {
  if (!invocationUtile(lanceur, { invoqueMonstre: spec } as Spell, cs)) {
    ctx.log(`L'invocation de ${lanceur.nom} échoue (plus de place).`);
    return;
  }
  const m = MONSTRES[spec.pool[Math.floor(ctx.rng() * spec.pool.length)]];
  const pos = caseLibre(lanceur.camp, cs)!;
  const ref = `invoc_${lanceur.ref}_${cs.length}`;
  cs.push(combattantInvoque(m, ref, pos, lanceur.camp, lanceur.ref));
  ctx.log(`${lanceur.nom} invoque ${m.nom} !`);
}

/** Réinvoque un allié monstre vaincu (signature Boostache). */
function ressusciter(lanceur: Combatant, spec: { pvPct: number }, cs: Combatant[], ctx: CombatCtx): void {
  const morts = morteRessuscitable(lanceur, cs);
  if (!morts.length) {
    ctx.log(`${lanceur.nom} appelle les morts… mais personne ne répond.`);
    return;
  }
  const c = morts[Math.floor(ctx.rng() * morts.length)];
  const prises = new Set(vivants(cs).filter((u) => u.camp === c.camp).map((u) => u.position));
  if (prises.has(c.position)) {
    const libre = caseLibre(c.camp, cs);
    if (libre === null) { ctx.log(`${lanceur.nom} appelle les morts… mais il n'y a plus de place.`); return; }
    c.position = libre;
  }
  c.pvActuels = Math.max(1, Math.round(c.pvMax * spec.pvPct));
  c.effets = [];
  c.bouclier = 0;
  c.bombes = 0; // purge des compteurs du porteur mort (§B3) : un ressuscité revient "propre"
  c.telefrags = 0;
  ctx.log(`${lanceur.nom} réinvoque ${c.nom} d'entre les morts (${c.pvActuels} PV) !`);
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
  opts: { useMax: boolean; mult: number; ctx: CombatCtx; paAvant?: number },
  nomSort: string,
): number {
  const r = degatsAvec(lanceur, base, t, opts);
  if (r.esquive) {
    opts.ctx.log(`${t.nom} esquive ${nomSort} !`);
    opts.ctx.fx?.({ type: "esquive", ref: t.ref });
    return 0;
  }
  if (r.crit) opts.ctx.fx?.({ type: "crit", ref: t.ref });
  infligerDegats(t, r.dmg, lanceur, opts.ctx);
  // la lance (Forgelance) loggue déjà sa propre ligne 🔱 dans infligerDegats —
  // pas besoin de la ligne de dégâts générique en plus.
  if (!t.estLance) {
    opts.ctx.log(
      `${lanceur.nom} → ${nomSort} sur ${t.nom} : ${r.dmg} dégâts${r.crit ? " (CRIT)" : ""}.` +
        (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
    );
  }
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
        retirerPA(u, 2, ctx);
        lanceur.paBonusNextTurn += 2;
        ctx.log(`${lanceur.nom} vole 2 PA à ${u.nom}.`);
      } else if (r === 1) appliquerEffet(u, { stat: "resAll", valeur: -0.1, duree: 2 });
      else if (r === 2) appliquerEffet(u, { stat: "degatsInfliges", valeur: -0.1, duree: 2 });
      else dissiperPositifs(u, ctx);
    }
  }
}

/** Kaboom (Roublard) : détonne toutes les bombes posées sur les ennemis vivants.
 *  Chaque bombe inflige un jet plein au porteur + 50 % (arrondi) aux AUTRES
 *  vivants de sa rangée. Si le lanceur a une Resquille active, chaque ennemi
 *  touché au moins une fois perd son montant en PA (une seule fois par ennemi).
 *  `adverses()` ne renvoie que les VIVANTS : les bombes d'un porteur mort avant
 *  la détonation (au fil du combat, entre la pose et Kaboom) sont perdues (voulu). */
function lancerKaboom(lanceur: Combatant, sort: Spell, cs: Combatant[], ctx: CombatCtx): void {
  const touches = new Set<string>();
  for (const porteur of adverses(lanceur, cs).filter((e) => (e.bombes ?? 0) > 0)) {
    const n = porteur.bombes ?? 0;
    const rangee = adverses(lanceur, cs).filter(
      (e) => e.ref !== porteur.ref && estAvant(e) === estAvant(porteur),
    );
    for (let i = 0; i < n && porteur.pvActuels > 0; i++) {
      if (frappe(lanceur, sort, porteur, { useMax: false, mult: 1, ctx }, sort.nom) > 0) touches.add(porteur.ref);
      for (const voisin of rangee) {
        if (voisin.pvActuels <= 0) continue;
        if (frappe(lanceur, sort, voisin, { useMax: false, mult: 0.5, ctx }, sort.nom) > 0) touches.add(voisin.ref);
      }
    }
  }
  if (lanceur.resquilleActive) {
    for (const ref of touches) {
      const c = parRef(cs, ref);
      if (c && c.pvActuels > 0) retirerPA(c, lanceur.resquilleActive, ctx);
    }
  }
  lanceur.resquilleActive = undefined;
  for (const c of cs) c.bombes = 0;
}

/** Flèche enflammée (Cra) : jet plein sur la cible ; si elle est en ligne AVANT,
 *  50 % du jet éclabousse les 2 ennemis ARRIÈRE les plus proches en colonne ;
 *  si elle est déjà en ligne ARRIÈRE, 100 % du jet touche aussi les 2 plus
 *  proches de sa propre rangée. */
function lancerFlecheEnflammee(
  lanceur: Combatant, sort: Spell, cible: Combatant, cs: Combatant[], ctx: CombatCtx, paAvant: number,
): void {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  const base: BaseDegats = { baseMin: sort.baseMin, baseMax: sort.baseMax, scaling: sort.scaling };
  const opts = { useMax: false, mult: 1, ctx, paAvant };
  frappe(lanceur, base, cible, opts, sort.nom);
  if (estAvant(cible)) {
    const arrieres = adverses(lanceur, cs).filter((e) => !estAvant(e));
    for (const t of plusProches(cible, arrieres, 2)) {
      frappe(lanceur, base, t, { ...opts, mult: 0.5 }, `${sort.nom} (éclaboussure)`);
    }
  } else {
    const memeRangee = adverses(lanceur, cs).filter((e) => e.ref !== cible.ref && !estAvant(e));
    for (const t of plusProches(cible, memeRangee, 2)) {
      frappe(lanceur, base, t, opts, `${sort.nom} (éclaboussure)`);
    }
  }
}

/** Flèche de recul (Cra) : repousse la cible en ligne arrière. La bousculade
 *  ne fait de dégâts (ignoreResistances) que s'il y a réellement collision :
 *  - Cas 1 : un AUTRE ennemi partage la rangée de DÉPART de la cible → aucun
 *    déplacement (même si la rangée d'arrivée est libre), dégâts aux deux.
 *  - Cas 2 : rangée de départ libre → déplacement tenté ; si la rangée
 *    d'arrivée contenait déjà un ennemi (occupation évaluée AVANT le
 *    déplacement) → dégâts aux deux.
 *  - Cas 3 : déplacée, arrivée vide → aucun dégât.
 *  - Rangée de départ libre mais arrivée PLEINE : deplacerCible() échoue en
 *    silence (comme tout déplacement moteur quand la case est prise) → aucun
 *    déplacement, donc aucune collision, donc aucun dégât (lecture retenue
 *    du texte de conception face à ce cas non explicitement traité). */
function lancerFlecheDeRecul(
  lanceur: Combatant, sort: Spell, cible: Combatant, cs: Combatant[], ctx: CombatCtx, paAvant: number,
): void {
  ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
  const base: BaseDegats = { baseMin: sort.baseMin, baseMax: sort.baseMax, scaling: sort.scaling, ignoreResistances: true };
  const opts = { useMax: false, mult: 1, ctx, paAvant };

  const rangeeDepart = vivants(cs).filter(
    (x) => x.camp === cible.camp && x.ref !== cible.ref && estAvant(x) === estAvant(cible),
  );
  if (rangeeDepart.length > 0) {
    // Cas 1 : rangée de départ occupée → pas de déplacement, bousculade aux deux.
    const autre = plusProches(cible, rangeeDepart, 1)[0];
    frappe(lanceur, base, cible, opts, `${sort.nom} (bousculade)`);
    frappe(lanceur, base, autre, opts, `${sort.nom} (bousculade)`);
    return;
  }

  const occupantsArriveeAvant = vivants(cs).filter(
    (x) => x.camp === cible.camp && x.ref !== cible.ref && !estAvant(x),
  );
  const posAvant = cible.position;
  deplacerCible(cible, "arriere", cs, ctx);
  if (cible.position === posAvant) return; // déplacement échoué (arrivée pleine, ou déjà en arrière) : aucun dégât

  const autre = plusProches(cible, occupantsArriveeAvant, 1)[0];
  if (!autre) return; // arrivée vide (cas 3) : rien à bousculer

  frappe(lanceur, base, cible, opts, `${sort.nom} (bousculade)`);
  frappe(lanceur, base, autre, opts, `${sort.nom} (bousculade)`);
}

export function lancerSort(
  lanceur: Combatant,
  sort: Spell,
  cibleRef: string,
  cs: Combatant[],
  ctx: CombatCtx,
): void {
  ctx.combatants = cs; // Lance/redirection : lookup depuis infligerDegats, référence à jour
  // Flèche Punitive : PA dispo AVANT paiement — la boucle de combat débite paActuels
  // avant d'appeler lancerSort, donc « avant paiement » = paActuels + coutPA ici.
  const paAvant = lanceur.paActuels + sort.coutPA;
  const cible = parRef(cs, cibleRef);
  if (sort.maxParTour || sort.maxParCibleParTour) {
    const l = (lanceur.lancersCeTour ??= {});
    l[sort.id] = (l[sort.id] ?? 0) + 1;
    if (cibleRef) l[`${sort.id}:${cibleRef}`] = (l[`${sort.id}:${cibleRef}`] ?? 0) + 1;
  }
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

  // --- BOMBE COLLANTE (Roublard) : pose une charge, pas de dégâts ---
  if (sort.poseBombe && cible) {
    if (!poserBombe(cible, ctx)) ctx.log(`La bombe glisse : ${cible.nom} est déjà chargé au maximum.`);
    poseCooldown(cible);
    return;
  }

  // --- KABOOM (Roublard) : détonne toutes les bombes posées ---
  if (sort.kaboom) {
    lancerKaboom(lanceur, sort, cs, ctx);
    return;
  }

  // --- DAGUES BOOMERANG (Roublard) : cible → arrière (100 %) → re-cible ---
  if (sort.boomerang && cible) {
    ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
    frappe(lanceur, sort, cible, { useMax: false, mult: 1, ctx }, sort.nom);
    const arriere = derriereEnLigne(cible, cs);
    if (arriere && arriere.pvActuels > 0) {
      frappe(lanceur, sort, arriere, { useMax: false, mult: 1, ctx }, sort.nom);
      if (cible.pvActuels > 0) frappe(lanceur, sort, cible, { useMax: false, mult: 1, ctx }, sort.nom);
    }
    poseCooldown(cible);
    return;
  }

  // --- FLÈCHE ENFLAMMÉE (Cra) : éclaboussure asymétrique avant/arrière ---
  if (sort.enflammee && cible) {
    lancerFlecheEnflammee(lanceur, sort, cible, cs, ctx, paAvant);
    poseCooldown(cible);
    return;
  }

  // --- FLÈCHE DE RECUL (Cra) : bousculade — dégâts seulement si ça bouscule ---
  if (sort.degatsPoussee && cible) {
    lancerFlecheDeRecul(lanceur, sort, cible, cs, ctx, paAvant);
    poseCooldown(cible);
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
    if (sort.invoqueMonstre) invoquerMonstre(lanceur, sort.invoqueMonstre, cs, ctx);
    if (sort.ressuscite) ressusciter(lanceur, sort.ressuscite, cs, ctx);
    poseCooldown(lanceur);
    return;
  }

  // --- APAISEMENT (Ouginak) : consomme TOUTE la Rage, soigne par charge ---
  if (sort.consommeRage) {
    const charges = lanceur.rage ?? 0;
    if (charges <= 0) return; // gardé aussi par ciblesValides
    lanceur.rage = 0;
    const soin = Math.round(jet(sort.baseMin, sort.baseMax, ctx.rng) * charges * multSoin(lanceur.stats));
    ctx.log(`${lanceur.nom} lance ${sort.nom} : ${charges} Rage consommée${charges > 1 ? "s" : ""}.`);
    soigner(lanceur, soin, ctx);
    poseCooldown(lanceur);
    return;
  }

  // --- CHANGER DE LIGNE (Dagues Eurfolles) : bascule avant ↔ arrière ---
  if (sort.changeLigne) {
    const dest = caseLibreRangeeOpposee(lanceur, cs);
    if (dest === null) return; // gardé aussi par ciblesValides
    lanceur.position = dest;
    ctx.log(`${lanceur.nom} se glisse en ligne ${dest < 4 ? "AVANT" : "ARRIÈRE"} (Dagues Eurfolles).`);
    poseCooldown(lanceur);
    return;
  }

  // --- LANCE (Forgelance) : plante la lance dans la rangée de la cible ---
  if (sort.invoqueLance) {
    if (!cible) return;
    invoquerLance(lanceur, cible, cs, ctx);
    poseCooldown(lanceur);
    return;
  }

  // --- VAJRA (Forgelance) : rappelle la lance (bris standard) et soigne selon sa durabilité restante ---
  if (sort.rappelleLance) {
    const lance = cs.find((c) => c.ref === `lance_${lanceur.ref}` && c.pvActuels > 0);
    if (!lance) return; // gardé aussi par ciblesValides
    const durabiliteRestante = lance.pvActuels;
    ctx.log(`${lanceur.nom} rappelle sa lance (Vajra).`);
    while (lance.pvActuels > 0) infligerDegats(lance, 1, undefined, ctx);
    const soin = Math.round(sort.rappelleLance.soinParDurabilite * durabiliteRestante * multSoin(lanceur.stats));
    soigner(lanceur, soin, ctx);
    poseCooldown(lanceur);
    return;
  }

  // --- ÉTREINTE DE VALKYR (Forgelance) : redirige une fraction des dégâts de la rangée arrière ---
  if (sort.redirigeArriere) {
    lanceur.redirection = { ratio: sort.redirigeArriere.ratio, tours: sort.redirigeArriere.duree };
    ctx.log(`${lanceur.nom} lance ${sort.nom} : protège sa rangée arrière.`);
    poseCooldown(lanceur);
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

  // --- PROIE (Ouginak) : marque UNIQUE — l'équipe vole des PV en frappant la proie ---
  if (sort.marqueProie && cible) {
    for (const c of cs) c.effets = c.effets.filter((e) => e.stat !== "proie"); // une seule proie
    cible.effets.push({ stat: "proie", valeur: sort.marqueProie, toursRestants: 99 });
    ctx.log(`🎯 ${lanceur.nom} désigne ${cible.nom} comme Proie : l'équipe vole ${Math.round(sort.marqueProie * 100)} % des dégâts qu'elle lui inflige.`);
    poseCooldown(cible);
    return;
  }

  // --- PA PAR TOUR DE LIGNE (Cadran…) : toute la rangée de l'allié ciblé gagne l'effet ---
  if (sort.paParTourLigne && cible) {
    const rangee = allies(lanceur, cs).filter((a) => estAvant(a) === estAvant(cible));
    for (const a of rangee) {
      appliquerEffet(a, { stat: "paParTour", valeur: sort.paParTourLigne.valeur, duree: sort.paParTourLigne.duree });
    }
    ctx.log(`${lanceur.nom} lance ${sort.nom} : la ligne de ${cible.nom} gagne +${sort.paParTourLigne.valeur} PA/tour.`);
    poseCooldown(cible);
    return;
  }

  // --- PORTAIL (Éliotrope) : ouvre un portail (compteur), pas de cible ni d'effet direct ---
  if (sort.posePortail) {
    poserPortail(lanceur, ctx);
    poseCooldown(lanceur);
    return;
  }

  // --- COALITION (Éliotrope) : += paBonusNextTurn sur le lanceur et sa rangée (cumulable) ---
  if (sort.paProchainTourLigne) {
    const valeur = (lanceur.portails ?? 0) >= sort.paProchainTourLigne.seuil
      ? sort.paProchainTourLigne.valeurSeuil
      : sort.paProchainTourLigne.valeur;
    const rangee = allies(lanceur, cs).filter((a) => estAvant(a) === estAvant(lanceur));
    for (const a of rangee) a.paBonusNextTurn += valeur;
    ctx.log(`${lanceur.nom} lance ${sort.nom} : sa rangée gagne +${valeur} PA au prochain tour.`);
    poseCooldown(lanceur);
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
  // Signature de Grunob (« Travail d'équipe ») : +X % par allié vivant dans sa rangée
  let multLigne = 1 + (lanceur.bonusParAllieLigne ?? 0) *
    allies(lanceur, cs).filter((a) => a.ref !== lanceur.ref && estAvant(a) === estAvant(lanceur)).length;
  // Portails (Éliotrope) : aura de dégâts pour le porteur et sa rangée
  multLigne *= multPortails(lanceur, cs);
  // Conjuration (Éliotrope) : marque posée sur la cible, bonus pour le marqueur et sa rangée
  if (cible.conjuration) {
    const marqueur = parRef(cs, cible.conjuration.lanceurRef);
    const enRangeeDuMarqueur = !!marqueur && marqueur.pvActuels > 0 &&
      marqueur.camp === lanceur.camp && estAvant(marqueur) === estAvant(lanceur);
    if (lanceur.ref === cible.conjuration.lanceurRef || enRangeeDuMarqueur) {
      multLigne *= 1 + cible.conjuration.pct;
    }
  }
  // Dépouille (Ouginak) : +X % par AUTRE ennemi vivant sur la ligne de la cible
  if (sort.bonusParEnnemiLigneCible) {
    multLigne *= 1 + sort.bonusParEnnemiLigneCible *
      adverses(lanceur, cs).filter((e) => e.ref !== cible.ref && estAvant(e) === estAvant(cible)).length;
  }
  // Muspel (Forgelance) : ×(1 + taux × nb d'ennemis non-lance de la zone), calculé AVANT les jets
  if (sort.bonusParEnnemiToucheZone) {
    const nbNonLance = ciblesDegats(lanceur, sort, cible, cs).filter((t) => !t.estLance).length;
    multLigne *= 1 + sort.bonusParEnnemiToucheZone * nbNonLance;
  }
  let totalDmg = 0;

  // Rayon de Wakfu (Éliotrope) : zoneLigne — les dégâts RÉELLEMENT infligés (post
  // résistances/esquive) soignent à parts égales la rangée avant alliée du lanceur.
  if (sort.soinLigneAvantRatio) {
    ctx.log(`${lanceur.nom} lance ${sort.nom}.`);
    let total = 0;
    for (const t of ciblesDegats(lanceur, sort, cible, cs)) {
      const r = degatsCible(lanceur, sort, t, { useMax, mult: (1 + bonusVigueur) * multLigne, ctx, paAvant });
      if (r.esquive) {
        ctx.log(`${t.nom} esquive ${sort.nom} !`);
        ctx.fx?.({ type: "esquive", ref: t.ref });
        continue;
      }
      if (r.crit) ctx.fx?.({ type: "crit", ref: t.ref });
      infligerDegats(t, r.dmg, lanceur, ctx);
      total += r.dmg;
      ctx.log(
        `${lanceur.nom} → ${sort.nom} sur ${t.nom} : ${r.dmg} dégâts${r.crit ? " (CRIT)" : ""}.` +
          (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
      );
    }
    const rangeeAvant = allies(lanceur, cs).filter(estAvant);
    if (total > 0 && rangeeAvant.length) {
      // convention des soins dérivés de dégâts (vampirismeRatio, soinEquipeRatio,
      // soinAllieBlesseRatio) : le montant scale avec multSoin(lanceur.stats)
      const part = Math.round((total * sort.soinLigneAvantRatio / rangeeAvant.length) * multSoin(lanceur.stats));
      for (const a of rangeeAvant) soigner(a, part, ctx);
    }
    poseCooldown(cible);
    return;
  }

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
      const dmg = frappe(lanceur, { baseMin: p.baseMin, baseMax: p.baseMax, scaling: p.scaling }, t, { useMax: false, mult: (1 + bonusVigueur) * multLigne, ctx }, sort.nom);
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
      const dmg = frappe(lanceur, coup, cible, { useMax, mult: (1 + bonusVigueur) * multLigne, ctx }, sort.nom);
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

  // Sorts purement utilitaires (Pendule/Roublabot : repositionnement via deplaceCible ;
  // Conjuration : pose une marque sans jet — baseMin/baseMax = 0) : pas de jet de
  // dégâts ni de jet d'esquive à faire consommer/logguer pour un résultat
  // systématiquement nul — le déplacement/la marque plus bas fait tout le travail.
  const sauteJetDegats = sort.baseMax === 0 && (!!sort.deplaceCible || !!sort.conjuration);

  touchees.forEach((t, i) => {
    if (sauteJetDegats) return;
    const mult = (sort.rebond ? 1 + sort.rebond.bonusParSaut * i : 1) * (1 + bonusVigueur) * deMult * multLigne;
    const r = degatsCible(lanceur, sort, t, { useMax, mult, ctx, paAvant });
    if (r.esquive) {
      ctx.log(`${t.nom} esquive ${sort.nom} !`);
      ctx.fx?.({ type: "esquive", ref: t.ref });
    } else {
      if (r.crit) ctx.fx?.({ type: "crit", ref: t.ref });
      infligerDegats(t, r.dmg, lanceur, ctx, sort.ignoreBouclier);
      totalDmg += r.dmg;
      // la lance (Forgelance) loggue déjà sa propre ligne 🔱 dans infligerDegats.
      if (!t.estLance) {
        ctx.log(
          `${lanceur.nom} → ${sort.nom} sur ${t.nom} : ${r.dmg} dégâts${r.crit ? " (CRIT)" : ""}.` +
            (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
        );
      }
      if (t.pvActuels > 0) {
        if (sort.poison) appliquerPoison(t, lanceur, etirer(sort.poison, doubleDuree));
        // Parasite (Éliotrope) : poison = jet (dégâts réellement infligés) × ratio, si portails ≥ seuil
        if (sort.poisonSiPortails && (lanceur.portails ?? 0) >= sort.poisonSiPortails.seuil) {
          appliquerPoison(t, lanceur, etirer(
            { degats: Math.round(r.dmg * sort.poisonSiPortails.ratio), duree: sort.poisonSiPortails.duree },
            doubleDuree,
          ));
        }
        if (sort.effet) {
          // Sarcasme (Éliotrope) : remplace la valeur de l'effet si portails du lanceur ≥ seuil
          const effetFinal = sort.effetSiPortails && (lanceur.portails ?? 0) >= sort.effetSiPortails.seuil
            ? { ...sort.effet, valeur: sort.effetSiPortails.valeur }
            : sort.effet;
          appliquerEffet(t, etirer(effetFinal, doubleDuree));
        }
        if (sort.procAleatoire && sort.procAleatoire.length) {
          const proc = sort.procAleatoire[Math.floor(ctx.rng() * sort.procAleatoire.length)];
          if (proc.dissipePositifs) dissiperPositifs(t, ctx);
          if (proc.effet) appliquerEffet(t, etirer(proc.effet, doubleDuree));
        }
      }
    }
    if (i === 0 && t.pvActuels <= 0) primaireMorte = true;
  });

  // Conjuration (Éliotrope) : pose la marque sur la cible (aucun jet — sauteJetDegats)
  if (sort.conjuration) {
    const pct = (lanceur.portails ?? 0) >= sort.conjuration.seuil
      ? sort.conjuration.pctSeuil
      : sort.conjuration.pct;
    cible.conjuration = { pct, lanceurRef: lanceur.ref, tours: sort.conjuration.duree };
    ctx.log(`${lanceur.nom} lance ${sort.nom} : ${cible.nom} est marqué (+${Math.round(pct * 100)} %, ${sort.conjuration.duree}t).`);
  }

  // Masse Aj Taye : l'attaque traverse et touche l'ennemi derrière la cible
  if (sort.toucheDerriere) {
    const t = derriereEnLigne(cible, cs);
    if (t && t.pvActuels > 0) {
      totalDmg += frappe(lanceur, sort, t, { useMax, mult: (1 + bonusVigueur) * multLigne, ctx }, sort.nom);
    }
  }

  // Épée hostile : rebond x2 si la cible primaire meurt
  if (sort.siCibleMeurt && primaireMorte) {
    const t = adverses(lanceur, cs)
      .filter((e) => e.ref !== cible.ref)
      .sort((a, b) => a.position - b.position)[0];
    if (t) {
      const r = degatsCible(lanceur, sort, t, { useMax: false, mult: sort.siCibleMeurt.rebondDegatsX, ctx, paAvant });
      if (r.esquive) {
        ctx.log(`${t.nom} esquive le rebond de ${sort.nom} !`);
        ctx.fx?.({ type: "esquive", ref: t.ref });
      } else {
        if (r.crit) ctx.fx?.({ type: "crit", ref: t.ref });
        infligerDegats(t, r.dmg, lanceur, ctx);
        totalDmg += r.dmg;
        ctx.log(
          `${sort.nom} rebondit sur ${t.nom} : ${r.dmg} dégâts !` +
            (t.pvActuels <= 0 ? ` ${t.nom} est K.O. !` : ""),
        );
      }
    }
  }

  // Masse du Corailleur : soigne l'allié le plus blessé d'une fraction des dégâts
  if (sort.soinAllieBlesseRatio && totalDmg > 0) {
    const blesse = allies(lanceur, cs)
      .sort((a, b) => a.pvActuels / a.pvMax - b.pvActuels / b.pvMax)[0];
    if (blesse && blesse.pvActuels < blesse.pvMax) {
      soigner(blesse, Math.round(totalDmg * sort.soinAllieBlesseRatio * multSoin(lanceur.stats)), ctx);
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

  // Hydra (Forgelance) : bouclier au lanceur = valeur × nb d'ennemis non-lance touchés
  if (sort.bouclierParEnnemiTouche) {
    const nbNonLance = touchees.filter((t) => !t.estLance).length;
    if (nbNonLance > 0) {
      const b = sort.bouclierParEnnemiTouche * nbNonLance;
      lanceur.bouclier += b;
      ctx.log(`${lanceur.nom} gagne un bouclier de ${b} (Hydra).`);
    }
  }

  // Pattounes : soigne le lanceur d'une fraction des dégâts infligés
  if (sort.vampirismeRatio && totalDmg > 0) {
    soigner(lanceur, Math.round(totalDmg * sort.vampirismeRatio * multSoin(lanceur.stats)), ctx);
  }

  // Fracas / Arc des Rivages : retrait de PA immédiat — 30 % de chance par défaut
  if (sort.retraitPA && cible.pvActuels > 0 && ctx.rng() < (sort.retraitPAChance ?? 0.3)) {
    retirerPA(cible, sort.retraitPA, ctx);
  }

  // Déplacement de cible : pousse la cible dans la rangée opposée (ou seulement vers l'arrière)
  if (sort.deplaceCible && cible.pvActuels > 0) {
    // Pendule : si la rangée de destination était déjà occupée AVANT le déplacement,
    // double Téléfrag (la cible déplacée + l'occupant le plus proche en colonne).
    const rangeeDestOccupee = sort.telefragSiOccupee
      ? vivants(cs).some((x) => x.camp === cible.camp && estAvant(x) !== estAvant(cible))
      : false;
    const posAvant = cible.position;
    deplacerCible(cible, sort.deplaceCible, cs, ctx);
    if (sort.telefragSiOccupee && rangeeDestOccupee && cible.position !== posAvant) {
      poserTelefrag(cible, cs, ctx, lanceur);
      const occupant = vivants(cs)
        .filter((x) => x.camp === cible.camp && x.ref !== cible.ref && estAvant(x) === estAvant(cible))
        .sort((a, b) => Math.abs(a.position - cible.position) - Math.abs(b.position - cible.position))[0];
      if (occupant) poserTelefrag(occupant, cs, ctx, lanceur);
    }
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

  // Rage (Ouginak) : la charge se gagne APRÈS la résolution (ne boost pas ce lancer)
  if (sort.rage) gagnerRage(lanceur, ctx);

  poseCooldown(cible);
}

// --- Signatures de boss --------------------------------------------------------
/** Ascension « Boss enragés » : au début de chaque tour de l'enragé, ses dégâts
 *  infligés montent de `enrage` (cumulatif, sans cap). */
export function appliquerEnrage(acteur: Combatant, ctx: CombatCtx): void {
  if (!acteur.enrage) return;
  acteur.enrageCumul = (acteur.enrageCumul ?? 0) + acteur.enrage;
  ctx.log(`🔥 ${acteur.nom} s'enrage : +${Math.round(acteur.enrageCumul * 100)} % de dégâts.`);
}

/** Mue élémentaire (Kwakwa) : au début de son tour, le porteur devient très
 *  résistant partout SAUF dans un élément tiré au hasard (résistance 0) —
 *  force le joueur à changer d'élément de frappe à chaque tour du boss. */
export function appliquerMueElementaire(acteur: Combatant, ctx: CombatCtx): void {
  if (acteur.mueElementaire === undefined) return;
  const faible = ELEMENTS[Math.floor(ctx.rng() * ELEMENTS.length)];
  const haut = acteur.mueElementaire;
  acteur.resistances = { terre: haut, feu: haut, eau: haut, air: haut, [faible]: 0 };
  ctx.log(`${acteur.nom} mue : son plumage ne protège plus contre l'élément ${faible.toUpperCase()} !`);
}

/** Chance d'Ecaflip : au début du tour du porteur, pari de PA (33 % : +1 / 66 % : −1). */
export function appliquerChanceEcaflip(acteur: Combatant, ctx: CombatCtx): void {
  if (!acteur.paGamble) return;
  const g = acteur.paGamble;
  if (ctx.rng() < g.pPlus) {
    acteur.paActuels += g.plus;
    ctx.log(`😼 La Chance d'Ecaflip sourit à ${acteur.nom} : +${g.plus} PA !`);
  } else {
    acteur.paActuels = Math.max(0, acteur.paActuels - g.moins);
    ctx.log(`🙀 La Chance d'Ecaflip grimace : ${acteur.nom} perd ${g.moins} PA.`);
  }
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
    fx: hooks.fx,
    onDegats: hooks.onDegats,
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

      reinitialiserLancersTour(acteur); // remise à zéro des limites de lancer par tour
      appliquerMueElementaire(acteur, ctx); // signature du Kwakwa
      appliquerEnrage(acteur, ctx); // Ascension : boss enragés
      appliquerChanceEcaflip(acteur, ctx); // pari de PA (anneau Chance d'Ecaflip)
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
      // Conjuration (Éliotrope) : décompte les marques posées par cet acteur, s'éteint à 0
      for (const c of combatants) {
        if (c.conjuration?.lanceurRef === acteur.ref && --c.conjuration.tours <= 0) {
          delete c.conjuration;
        }
      }
      // recharge des PA en FIN de tour : entre deux tours, la gemme PA montre
      // le pool réel — un retrait de PA adverse se voit immédiatement.
      acteur.paActuels = acteur.paMax;
    }
  }

  return joueurGagne(combatants);
}

// --- IA ----------------------------------------------------------------------
function iaAgressif(acteur: Combatant, cs: Combatant[]): Action | null {
  // signatures d'invocation (boss) : jouées en priorité si utiles et hors cooldown
  const invoc = acteur.sorts
    .map((id) => SORTS[id])
    .find((s) =>
      s.type === "invocation" && acteur.paActuels >= s.coutPA &&
      ciblesValides(acteur, s, cs).length > 0 && invocationUtile(acteur, s, cs));
  if (invoc) return { sort: invoc, cibleRef: acteur.ref };

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
