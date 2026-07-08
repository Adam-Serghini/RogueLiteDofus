// =============================================================================
//  run.ts — État de run par personnage, fabrication des combattants, Meta.
//  Ce qui survit à la mort : Meta.dofus (localStorage). Le reste (niveaux,
//  points, PV courants) vit dans RunState et repart à zéro à chaque run.
// =============================================================================
import { CLASSES, MONSTRES, COMBATS, DOFUS, ITEMS, PANOPLIES, DROP, ARCHI, OCRE_PALIERS, MODIFICATEURS_ELITE, type ModificateurElite, ZONES, monstresDeZone, RARETES, RARETE_INFO, BUTIN_ZONE, butinToile, KAMAS, TRANCHES } from "./data";
import { progressionInitiale, statsFinales, pvMaxFor, PV_PAR_VITA, POINTS_PAR_NIVEAU, gagnerXP, investirN } from "./progression";
import { chargerConfig } from "./config";
import type { Combatant, Element, EquipSlot, GameMap, ItemInstance, Meta, Monstre, Progression, Rarete, Spell, Stats } from "./types";

// --- État de run -------------------------------------------------------------
/** Choix d'allocation automatique : un élément (frappe + points dans sa stat),
 *  la vitalité (points en PV, frappe = plus haute carac), ou rien (manuel). */
export type Allocation = Element | "vitalite";

export interface PersoState {
  classeId: string;
  progression: Progression;
  pvActuels: number; // PV conservés d'un nœud à l'autre
  position: number; // case de grille 0..7 (0-3 ligne avant, 4-7 arrière)
  elementChoisi?: Element; // élément de frappe choisi, conservé d'un combat à l'autre
  statAuto?: keyof Stats; // stat d'auto-allocation (dérivée de l'élément, ou « vitalite »)
  equipement: Partial<Record<EquipSlot, ItemInstance>>; // exemplaire équipé par slot
  flashNiveau?: boolean; // transitoire (UI) : a monté de niveau au dernier combat → anime dans le panneau d'équipe
}

/** Statistiques de la run (récap de fin) — sérialisées avec la sauvegarde. */
export interface RunStats {
  degats: Record<string, number>; // classeId → dégâts infligés
  combats: number; // combats gagnés
  archis: number; // âmes capturées pendant cette run
  objets: number; // pièces d'équipement trouvées
  zones: number; // zones terminées
  kamasGagnes?: number; // kamas engrangés (combats + reventes)
}
export const statsRunVides = (): RunStats => ({ degats: {}, combats: 0, archis: 0, objets: 0, zones: 0, kamasGagnes: 0 });

export interface RunState {
  persos: PersoState[];
  carte: GameMap | null;
  inventaire: ItemInstance[]; // exemplaires non équipés trouvés cette run (perdus à la mort)
  stats: RunStats; // récap de fin de run
  kamas: number; // monnaie de la run (perdue à la mort)
  choixDepart?: string[]; // roster choisi au départ (pour « recommencer avec les mêmes héros »)
}

export const EQUIPE_DEPART = ["iop", "cra", "eniripsa", "ecaflip"]; // roster par défaut (tests)
export const TAILLE_MAX_EQUIPE = 4;

/** Stat de caractéristique portant chaque élément (pour l'allocation par élément). */
export const STAT_PAR_ELEMENT: Record<Element, keyof Stats> = {
  terre: "force", feu: "intelligence", air: "agilite", eau: "chance",
};

/**
 * Fixe (ou retire, si null) l'élément de frappe choisi d'un perso.
 * En mode « élément » : investit immédiatement les points dispo dans sa stat
 * (les futurs points de niveau suivront via `gagnerXPPerso`).
 */
export function appliquerElement(perso: PersoState, choix: Allocation | null): void {
  if (choix === "vitalite") {
    perso.elementChoisi = undefined; // frappe = plus haute carac
    perso.statAuto = "vitalite";
  } else {
    perso.elementChoisi = choix ?? undefined;
    perso.statAuto = choix ? STAT_PAR_ELEMENT[choix] : undefined;
  }
  if (perso.statAuto) investirN(perso.progression, perso.statAuto, Infinity);
}

/**
 * XP d'un perso : monte de niveau ; si un élément est choisi, alloue
 * automatiquement les points gagnés dans sa stat. Renvoie les niveaux gagnés.
 */
/** Niveau maximum de la tranche active (cap d'XP). */
export const niveauMaxTranche = (): number => (TRANCHES.find((t) => t.active) ?? TRANCHES[0]).niveaux[1];

export function gagnerXPPerso(perso: PersoState, gain: number): number {
  const niveaux = gagnerXP(perso.progression, gain, niveauMaxTranche());
  // rétro-compat : les saves d'avant statAuto ne portent que elementChoisi
  const stat = perso.statAuto ?? (perso.elementChoisi ? STAT_PAR_ELEMENT[perso.elementChoisi] : undefined);
  if (stat) investirN(perso.progression, stat, Infinity);
  return niveaux;
}

/** Classes retirées du jeu (données conservées pour les tests/saves) — pas
 *  sélectionnables au départ ni recrutables en taverne. */
const CLASSES_DESACTIVEES = new Set(["sadida"]); // déséquilibré, en attente de refonte

/** Toutes les classes jouables (ordre d'insertion de CLASSES). */
export const classesDisponibles = (): string[] =>
  Object.keys(CLASSES).filter((id) => !CLASSES_DESACTIVEES.has(id));

/** Case de grille (0..7) de chaque membre, depuis la RANGÉE préférée sauvegardée
 *  (avant = cases 0-3, arrière = 4-7). Les héros s'EMPILENT dans leur rangée
 *  (1re case libre) → la préférence marche à tous les coups ; si la rangée est
 *  pleine, on déborde dans l'autre. */
/** Première case libre de la rangée PRÉFÉRÉE de la classe (débordement dans
 *  l'autre rangée si pleine) — utilisée au départ ET au recrutement. */
function caseLibrePreferee(classeId: string, pris: Set<number>): number {
  const pref = chargerConfig().formation[classeId] === "arriere" ? "arriere" : "avant";
  const caseLibreDans = (rangee: "avant" | "arriere"): number | undefined => {
    const [debut, fin] = rangee === "avant" ? [0, 4] : [4, 8];
    for (let c = debut; c < fin; c++) if (!pris.has(c)) return c;
    return undefined;
  };
  return caseLibreDans(pref) ?? caseLibreDans(pref === "avant" ? "arriere" : "avant")!;
}

function cellulesPour(ids: string[]): Record<string, number> {
  const cells: Record<string, number> = {};
  const pris = new Set<number>();
  for (const id of ids) {
    const cell = caseLibrePreferee(id, pris);
    cells[id] = cell;
    pris.add(cell);
  }
  return cells;
}

export function nouvelleRun(choix: string[] = EQUIPE_DEPART): RunState {
  const cells = cellulesPour(choix);
  const elemsPref = chargerConfig().elements; // élément préféré par classe (préréglages)
  const persos: PersoState[] = choix.map((classeId) => {
    const progression = progressionInitiale();
    const perso: PersoState = {
      classeId,
      progression,
      pvActuels: pvMaxFor(CLASSES[classeId], progression),
      position: cells[classeId],
      equipement: {},
    };
    const pref = elemsPref[classeId]; // préréglage (absent = Libre)
    if (pref) appliquerElement(perso, pref);
    return perso;
  });
  return { persos, carte: null, inventaire: [], stats: statsRunVides(), kamas: 0, choixDepart: [...choix] };
}

// --- Recrutement (Taverne) ---------------------------------------------------
export const equipePleine = (run: RunState): boolean => run.persos.length >= TAILLE_MAX_EQUIPE;

/** Niveau moyen (arrondi, ≥ 1) de l'équipe — niveau d'arrivée d'une recrue. */
function niveauMoyen(run: RunState): number {
  if (!run.persos.length) return 1;
  return Math.max(1, Math.round(run.persos.reduce((s, p) => s + p.progression.niveau, 0) / run.persos.length));
}

/** Classes pas encore dans l'équipe. */
export function classesHorsEquipe(run: RunState): string[] {
  const pris = new Set(run.persos.map((p) => p.classeId));
  return classesDisponibles().filter((id) => !pris.has(id));
}

/** Deux propositions de recrutement tirées au hasard parmi les classes hors équipe. */
export function propositionsRecrutement(run: RunState, rng: () => number): string[] {
  const copie = classesHorsEquipe(run);
  const res: string[] = [];
  for (let i = 0; i < 2 && copie.length; i++) {
    res.push(copie.splice(Math.floor(rng() * copie.length), 1)[0]);
  }
  return res;
}

/** Crée un nouveau perso au niveau de l'équipe (avec points à dépenser). */
function nouveauPerso(run: RunState, classeId: string, position: number): PersoState {
  const niveau = niveauMoyen(run);
  const progression = progressionInitiale();
  progression.niveau = niveau;
  progression.pointsDispo = (niveau - 1) * POINTS_PAR_NIVEAU; // points cumulés des montées de niveau
  return { classeId, progression, pvActuels: pvMaxFor(CLASSES[classeId], progression), position, equipement: {} };
}

/** Recrute une classe : l'ajoute (équipe < 4) ou remplace un membre (équipe pleine). */
export function recruter(run: RunState, classeId: string, remplaceClasseId?: string): void {
  if (remplaceClasseId) {
    const idx = run.persos.findIndex((p) => p.classeId === remplaceClasseId);
    if (idx >= 0) {
      run.persos[idx] = nouveauPerso(run, classeId, run.persos[idx].position);
      return;
    }
  }
  const pris = new Set(run.persos.map((p) => p.position));
  run.persos.push(nouveauPerso(run, classeId, caseLibrePreferee(classeId, pris)));
}

// --- Équipement --------------------------------------------------------------
const statsVides = (): Stats => ({
  force: 0, intelligence: 0, agilite: 0, vitalite: 0,
  chance: 0, soin: 0, prospection: 0,
});
function ajouterStats(acc: Stats, ajout?: Partial<Stats>): void {
  if (!ajout) return;
  for (const k of Object.keys(ajout) as (keyof Stats)[]) acc[k] = (acc[k] ?? 0) + (ajout[k] ?? 0);
}
function ajouterRes(acc: Partial<Record<Element, number>>, ajout?: Partial<Record<Element, number>>): void {
  if (!ajout) return;
  for (const k of Object.keys(ajout) as Element[]) acc[k] = (acc[k] ?? 0) + (ajout[k] ?? 0);
}

/** Carac PRINCIPALE d'un perso (sa « voie ») : l'élément de frappe choisi,
 *  sinon son auto-allocation élémentaire, sinon sa plus haute carac investie.
 *  Cible des stats ADAPTATIVES d'équipement (calculée hors équipement). */
export function statPrincipale(state: PersoState): keyof Stats {
  if (state.elementChoisi) return STAT_PAR_ELEMENT[state.elementChoisi];
  if (state.statAuto && state.statAuto !== "vitalite") return state.statAuto;
  const finals = statsFinales(CLASSES[state.classeId], state.progression);
  let best: keyof Stats = "force";
  for (const el of ["terre", "feu", "eau", "air"] as Element[]) {
    const k = STAT_PAR_ELEMENT[el];
    if ((finals[k] ?? 0) > (finals[best] ?? 0)) best = k;
  }
  return best;
}

/** Bonus total apporté par l'équipement d'un perso (objets + bonus de panoplie). */
export function bonusEquipement(state: PersoState): {
  stats: Stats; pvBonus: number; resistances: Partial<Record<Element, number>>; paBonus: number;
} {
  const stats = statsVides();
  let pvBonus = 0;
  let paBonus = 0;
  const resistances: Partial<Record<Element, number>> = {};
  const comptePano: Record<string, number> = {};
  for (const slot of Object.keys(state.equipement) as EquipSlot[]) {
    const inst = state.equipement[slot];
    const item = inst ? ITEMS[inst.id] : undefined;
    if (!inst || !item) continue;
    ajouterStats(stats, inst.stats); // stats de l'exemplaire (rollées ou du palier de rareté)
    if (inst.adaptatif) stats[statPrincipale(state)] = (stats[statPrincipale(state)] ?? 0) + inst.adaptatif; // stat adaptative
    pvBonus += item.pvBonus ?? 0;
    paBonus += inst.pa ?? 0; // PA d'équipement (paliers de rareté)
    ajouterRes(resistances, item.resistances);
    ajouterRes(resistances, inst.resistances); // résistances du palier de rareté
    if (item.panoplie) comptePano[item.panoplie] = (comptePano[item.panoplie] ?? 0) + 1;
  }
  for (const [panoId, n] of Object.entries(comptePano)) {
    for (const b of PANOPLIES[panoId]?.bonus ?? []) {
      if (n >= b.seuil) { ajouterStats(stats, b.stats); pvBonus += b.pvBonus ?? 0; ajouterRes(resistances, b.resistances); }
    }
  }
  return { stats, pvBonus, resistances, paBonus };
}

/** PV max d'un perso, équipement inclus (vitalité d'équipement + PV plats). */
export function pvMaxPerso(state: PersoState): number {
  const b = bonusEquipement(state);
  return pvMaxFor(CLASSES[state.classeId], state.progression) + b.pvBonus + (b.stats.vitalite ?? 0) * PV_PAR_VITA;
}

// --- Fabrication des combattants ---------------------------------------------
export function combattantDepuisPerso(state: PersoState): Combatant {
  const classe = CLASSES[state.classeId];
  const bonus = bonusEquipement(state);
  const stats = statsFinales(classe, state.progression);
  ajouterStats(stats, bonus.stats);
  const pvMax = pvMaxPerso(state);
  // attaque d'arme (case 1 « corps à corps ») dérivée de l'arme équipée ;
  // pour un objet à rareté, l'attaque du palier prime (elle peut progresser)
  const armeInst = state.equipement.arme;
  const armeItem = armeInst ? ITEMS[armeInst.id] : undefined;
  const attaque = (armeInst?.rarete ? armeItem?.tiers?.[armeInst.rarete]?.attaque : undefined) ?? armeItem?.attaque;
  const armeSort: Spell | undefined = armeItem && attaque
    ? {
      id: "arme_attaque", nom: armeItem.nom, type: "degats",
      cible: attaque.cible ?? "ennemi_ligne", // ennemi_tous : l'arme atteint la ligne arrière
      coutPA: attaque.coutPA, baseMin: attaque.baseMin,
      baseMax: attaque.baseMax, scaling: attaque.scaling,
      ...(attaque.vampirisme ? { vampirismeRatio: attaque.vampirisme } : {}),
      img: `/assets/items/${armeItem.id}.png`,
      desc: attaque.cible === "ennemi_tous"
        ? "Attaque d'arme — atteint la ligne arrière."
        : attaque.vampirisme
          ? `Attaque d'arme — rend ${Math.round(attaque.vampirisme * 100)} % des dégâts en PV.`
          : "Attaque d'arme.",
    }
    : undefined;
  // Chance d'Ecaflip : le pari de PA du premier objet porteur (non cumulable)
  const paGamble = (Object.values(state.equipement).map((i) => i && ITEMS[i.id]?.paGamble).find(Boolean)) ?? undefined;
  return {
    armeSort,
    paGamble,
    ref: `j_${state.classeId}`,
    nom: classe.nom,
    pvBase: pvMax, // base de référence pour les buffs de vitalité en %
    pvMax,
    pvActuels: Math.min(state.pvActuels, pvMax),
    stats,
    paMax: classe.pa + bonus.paBonus,
    paActuels: classe.pa + bonus.paBonus,
    initiative: classe.initiative,
    resistances: bonus.resistances, // résistances issues de l'équipement
    sorts: [...classe.sorts],
    camp: "joueur",
    position: state.position,
    niveau: state.progression.niveau,
    elementChoisi: state.elementChoisi,
    effets: [],
    img: classe.img,
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

/** Combattants joueur pour un combat (reconstruits depuis l'état de run). */
export function equipeCombattante(run: RunState): Combatant[] {
  return run.persos.map((s) => combattantDepuisPerso(s));
}

/** Équipe de départ niveau 1 (utile pour les tests et un combat simple). */
export function fabriquerEquipe(): Combatant[] {
  return equipeCombattante(nouvelleRun());
}

/** Réécrit l'état conservé d'un combat à l'autre (PV courants + élément de frappe choisi). */
export function synchroniserPV(run: RunState, combatants: Combatant[]): void {
  for (const s of run.persos) {
    const c = combatants.find((x) => x.ref === `j_${s.classeId}`);
    if (c) {
      s.pvActuels = c.pvActuels;
      s.elementChoisi = c.elementChoisi;
    }
  }
}

/** Taverne : rend une fraction des PV max à toute l'équipe. */
export function soignerEquipe(run: RunState, pct: number): void {
  for (const s of run.persos) {
    const pvMax = pvMaxPerso(s);
    s.pvActuels = Math.min(pvMax, s.pvActuels + Math.round(pvMax * pct));
  }
}

// --- Butin (drops d'équipement) ----------------------------------------------
/** Tire une rareté selon les poids du catalogue (commun 60 / rare 25 / épique 12 /
 *  légendaire 3), renormalisés sur les paliers réellement disponibles. */
export function tirerRarete(rng: () => number, disponibles: readonly Rarete[] = RARETES): Rarete {
  const total = disponibles.reduce((s, r) => s + RARETE_INFO[r].poids, 0);
  let t = rng() * total;
  for (const r of disponibles) {
    t -= RARETE_INFO[r].poids;
    if (t < 0) return r;
  }
  return disponibles[0];
}

/** Exemplaire d'un objet à rareté, tirage restreint aux paliers `autorisees`
 *  (∩ paliers réellement définis sur l'objet). null si aucun palier ne convient. */
export function rollItemRarete(itemId: string, rng: () => number, autorisees: readonly Rarete[] = RARETES): ItemInstance | null {
  const tiers = ITEMS[itemId]?.tiers;
  if (!tiers) return null;
  const disponibles = autorisees.filter((r) => tiers[r]);
  if (!disponibles.length) return null;
  const rarete = tirerRarete(rng, disponibles);
  const tier = tiers[rarete]!;
  return { id: itemId, rarete, stats: { ...tier.stats }, adaptatif: tier.adaptatif, resistances: tier.resistances, pa: tier.pa };
}

/** Crée un exemplaire d'item. Objet à rareté : palier tiré, stats fixes figées.
 *  Objet legacy : chaque stat tirée dans sa fourchette (jet façon Dofus). */
export function rollItem(itemId: string, rng: () => number): ItemInstance {
  const item = ITEMS[itemId];
  if (item?.tiers) return rollItemRarete(itemId, rng)!;
  const stats: Partial<Stats> = {};
  const rolls = item?.rolls ?? {};
  for (const k of Object.keys(rolls) as (keyof Stats)[]) {
    const [lo, hi] = rolls[k]!;
    stats[k] = lo + Math.floor(rng() * (hi - lo + 1));
  }
  return { id: itemId, stats };
}

/** Prospection cumulée de l'équipe (stat de classe + équipement). */
export function prospectionEquipe(run: RunState): number {
  return run.persos.reduce((s, p) => {
    const base = statsFinales(CLASSES[p.classeId], p.progression).prospection ?? 0;
    return s + base + (bonusEquipement(p).stats.prospection ?? 0);
  }, 0);
}

/**
 * Tire le butin d'une victoire. Zone à toile (objets à rareté) : 4 tirages, chacun
 * pioche un objet au hasard dans le pool de la zone. Zone legacy : chaque pièce de
 * la panoplie a sa chance. Doublons autorisés.
 */
export function tenterButin(run: RunState, zoneId: string, type: string, rng: () => number): ItemInstance[] {
  const taux = DROP.taux[type] ?? 0;
  if (taux <= 0) return [];
  const mult = 1 + Math.min(DROP.capProspection, prospectionEquipe(run) * DROP.coefProspection);
  const p = taux * mult;
  const drops: ItemInstance[] = [];
  const pools = butinToile(zoneId);
  const tirages = pools ? pools.normales : (PANOPLIES[BUTIN_ZONE[zoneId]]?.pieces ?? []);
  for (let i = 0; i < Math.min(Math.max(tirages.length, 1), 4); i++) {
    if (rng() < p) {
      let source = tirages;
      // le PREMIER tirage vient de la source exclusive du nœud (la carotte) :
      // objets « boss » au donjon, objets « élite » aux combats durs
      if (pools && i === 0) {
        if (type === "donjon" && pools.boss.length) source = pools.boss;
        else if (type === "combat_dur" && pools.elites.length) source = pools.elites;
      }
      if (!source.length) continue;
      const id = pools ? source[Math.floor(rng() * source.length)] : source[i];
      const inst = rollItem(id, rng);
      run.inventaire.push(inst);
      drops.push(inst);
    }
  }
  return drops;
}

/** L'objet est-il équipable par ce perso ? (contrainte « ligne avant uniquement »). */
export function peutEquiper(perso: PersoState, itemId: string): boolean {
  const item = ITEMS[itemId];
  if (!item) return false;
  if (item.ligneAvant && perso.position >= 4) return false;
  return true;
}

/** Équipe l'exemplaire d'inventaire `index` sur son perso (l'ancien du slot y retourne). */
export function equiper(inventaire: ItemInstance[], perso: PersoState, index: number): void {
  const inst = inventaire[index];
  const item = inst ? ITEMS[inst.id] : undefined;
  if (!inst || !item) return;
  if (!peutEquiper(perso, inst.id)) return; // ex. Cape Edepee sur un perso arrière
  inventaire.splice(index, 1);
  const ancien = perso.equipement[item.slot];
  if (ancien) inventaire.push(ancien);
  perso.equipement[item.slot] = inst;
  perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
}

/** Déséquipe le slot d'un perso (l'exemplaire retourne à l'inventaire). */
export function desequiper(inventaire: ItemInstance[], perso: PersoState, slot: EquipSlot): void {
  const inst = perso.equipement[slot];
  if (!inst) return;
  delete perso.equipement[slot];
  inventaire.push(inst);
  perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
}

function depuisMonstre(m: Monstre, ref: string, position: number): Combatant {
  return {
    ref,
    nom: m.nom,
    pvBase: m.pv,
    pvMax: m.pv,
    pvActuels: m.pv,
    stats: { ...m.stats },
    paMax: m.pa,
    paActuels: m.pa,
    initiative: m.initiative,
    resistances: { ...m.resistances },
    sorts: [...m.sorts],
    camp: "ennemi",
    position,
    niveau: 1,
    monstreId: m.id,
    archiNom: m.archiNom,
    ia: m.ia,
    mueElementaire: m.mueElementaire,
    bonusParAllieLigne: m.bonusParAllieLigne,
    effets: [],
    img: m.img,
    maxRollCharges: 0,
    passeProchainTour: false,
    bouclier: 0,
    paBonusNextTurn: 0,
    cooldowns: {},
    bonusOffensifProchain: 0,
    poisonAmpliTours: 0,
    bonusDe: 0,
    bonusDeTours: 0,
    dofusLache: m.dofus,
  };
}

export function fabriquerEnnemis(combatKey: string): Combatant[] {
  const def = COMBATS[combatKey];
  return def.ennemis.map((e, i) => depuisMonstre(MONSTRES[e.monstre], `e${i}_${e.monstre}`, e.position));
}

/** Applique un modificateur d'élite à TOUTE la meute (combat dur). `modifId`
 *  vient du nœud (tiré à la génération, affiché au survol) ; absent (zaap,
 *  vieille save) → tirage aléatoire. */
export function appliquerModificateurElite(enemies: Combatant[], rng: () => number, modifId?: string): ModificateurElite {
  const m = MODIFICATEURS_ELITE.find((x) => x.id === modifId)
    ?? MODIFICATEURS_ELITE[Math.floor(rng() * MODIFICATEURS_ELITE.length)];
  for (const e of enemies) {
    if (m.statMult) {
      const st = e.stats;
      e.stats = {
        ...st,
        force: Math.round(st.force * m.statMult),
        intelligence: Math.round(st.intelligence * m.statMult),
        agilite: Math.round(st.agilite * m.statMult),
        chance: Math.round((st.chance ?? 0) * m.statMult),
      };
    }
    if (m.pvMult) {
      e.pvMax = Math.round(e.pvMax * m.pvMult);
      e.pvBase = e.pvMax;
      e.pvActuels = e.pvMax;
    }
    if (m.resAll) {
      for (const el of ["terre", "feu", "eau", "air"] as Element[]) {
        e.resistances[el] = (e.resistances[el] ?? 0) + m.resAll;
      }
    }
    if (m.initBonus) e.initiative += m.initBonus;
    if (m.paBonus) { e.paMax += m.paBonus; e.paActuels = e.paMax; }
  }
  return m;
}

/** Transforme aléatoirement des ennemis en Archimonstres (boostés + capturables). */
export function appliquerArchimonstres(enemies: Combatant[], rng: () => number, chance = ARCHI.chance): void {
  for (const e of enemies) {
    if (!e.archiNom) continue; // seules les espèces ayant un Archimonstre réel peuvent muter
    if (rng() >= chance) continue;
    e.archi = true;
    e.nom = e.archiNom; // vrai nom d'Archimonstre (DofusDB)
    e.pvMax = Math.round(e.pvMax * ARCHI.pvMult);
    e.pvBase = e.pvMax;
    e.pvActuels = e.pvMax;
    const s = e.stats;
    e.stats = {
      force: Math.round(s.force * ARCHI.statMult),
      intelligence: Math.round(s.intelligence * ARCHI.statMult),
      agilite: Math.round(s.agilite * ARCHI.statMult),
      vitalite: Math.round(s.vitalite * ARCHI.statMult),
      chance: Math.round((s.chance ?? 0) * ARCHI.statMult),
    };
  }
}

// --- Run en cours (persistance) ------------------------------------------------
// La run est sauvegardée à chaque étape du plateau : on peut fermer la page et
// reprendre où on en était. Un combat en cours n'est PAS sauvegardé (nœud à
// refaire à la reprise). Effacée au wipe, à la victoire ou à l'abandon.
const RUN_KEY = "rld_run_v0";

export interface RunSauvee {
  version: 1;
  zoneIdx: number; // index dans les zones de la tranche active
  run: RunState;
}

export function sauverRunEnCours(zoneIdx: number, run: RunState): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 1, zoneIdx, run } satisfies RunSauvee));
  } catch {
    /* localStorage indisponible : pas de reprise possible */
  }
}

export function chargerRunEnCours(): RunSauvee | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<RunSauvee>;
    // validation légère : version connue, persos existants dans CLASSES, zoneIdx sain
    if (s.version !== 1 || typeof s.zoneIdx !== "number" || !s.run?.persos?.length) return null;
    if (!s.run.persos.every((p) => CLASSES[p.classeId])) return null;
    // refontes d'items : purger les exemplaires dont l'espèce n'existe plus
    s.run.inventaire = (s.run.inventaire ?? []).filter((inst) => ITEMS[inst.id]);
    for (const perso of s.run.persos) {
      for (const slot of Object.keys(perso.equipement ?? {}) as EquipSlot[]) {
        if (perso.equipement[slot] && !ITEMS[perso.equipement[slot]!.id]) delete perso.equipement[slot];
      }
    }
    s.run.stats = s.run.stats ?? statsRunVides(); // rétro-compat : anciennes saves sans stats
    s.run.kamas = s.run.kamas ?? 0; // rétro-compat : anciennes saves sans kamas
    return s as RunSauvee;
  } catch {
    return null;
  }
}

export function effacerRunEnCours(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}

// --- Succès --------------------------------------------------------------------
/** Contexte d'évaluation : méta persistante + run qui vient de se terminer. */
export interface SuccesCtx {
  meta: Meta;
  run?: RunState;
  victoire?: boolean;
}
export interface Succes {
  id: string;
  nom: string;
  desc: string;
  cond: (c: SuccesCtx) => boolean;
}

/** Catalogue (récompenses : à brancher sur le futur système d'items). */
export const SUCCES: Succes[] = [
  { id: "bapteme_du_feu", nom: "Baptême du feu", desc: "Terminer sa première run (même dans la douleur).",
    cond: (c) => c.meta.runs >= 1 },
  { id: "tour_du_monde", nom: "Tour du Monde", desc: "Traverser toute la Tranche 1.",
    cond: (c) => c.victoire === true },
  { id: "veteran", nom: "Vétéran", desc: "Jouer 10 runs.",
    cond: (c) => c.meta.runs >= 10 },
  { id: "chasseur_de_reliques", nom: "Chasseur de reliques", desc: "Posséder un Dofus.",
    cond: (c) => c.meta.dofus.length >= 1 },
  { id: "collectionneur", nom: "Collectionneur", desc: "Capturer 10 âmes d'Archimonstres.",
    cond: (c) => c.meta.archis.length >= 10 },
  { id: "chasseur_dames", nom: "Chasseur d'âmes", desc: "Capturer 25 âmes d'Archimonstres.",
    cond: (c) => c.meta.archis.length >= 25 },
  { id: "zoologiste", nom: "Zoologiste", desc: "Capturer tous les Archimonstres d'une zone.",
    cond: (c) => ZONES.some((z) => {
      const capturables = monstresDeZone(z).filter((id) => MONSTRES[id]?.archiNom);
      return capturables.length > 0 && capturables.every((id) => c.meta.archis.includes(id));
    }) },
  { id: "quatre_par_quatre", nom: "Quatre par quatre", desc: "Finir une run avec 4 héros en panoplie complète.",
    cond: (c) => !!c.run && c.run.persos.length === 4 &&
      c.run.persos.every((p) => (["arme", "coiffe", "cape", "anneau"] as const).every((s) => p.equipement[s])) },
];

/** Évalue les succès non débloqués ; persiste et renvoie les nouveaux. */
export function verifierSucces(meta: Meta, run?: RunState, victoire?: boolean): Succes[] {
  const deja = new Set(meta.succes ?? []);
  const nouveaux = SUCCES.filter((s) => !deja.has(s.id) && s.cond({ meta, run, victoire }));
  if (nouveaux.length) {
    meta.succes = [...(meta.succes ?? []), ...nouveaux.map((s) => s.id)];
    sauverMeta(meta);
  }
  return nouveaux;
}

// --- Kamas & Hôtel de vente ------------------------------------------------------
/** Toile (1-based) d'une zone dans l'ordre de jeu de la tranche active ; 1 par défaut. */
export function toileDeZone(zoneId: string): number {
  const idx = TRANCHES[0].zones.indexOf(zoneId);
  return idx >= 0 ? idx + 1 : 1;
}

/** Toile d'origine d'un objet (pool de toile, sinon zone de sa panoplie legacy). */
export function toileDeItem(itemId: string): number {
  for (let t = 1; t <= TRANCHES[0].zones.length; t++) {
    const pools = butinToile(TRANCHES[0].zones[t - 1]);
    if (pools && [...pools.normales, ...pools.elites, ...pools.boss].includes(itemId)) return t;
  }
  const panoId = ITEMS[itemId]?.panoplie;
  if (panoId) {
    const zoneId = Object.keys(BUTIN_ZONE).find((z) => BUTIN_ZONE[z] === panoId);
    if (zoneId) return toileDeZone(zoneId);
  }
  return 1;
}

/** Kamas gagnés pour une victoire (type de nœud × progression de toile). */
export function gainKamas(type: string, toile: number, rng: () => number): number {
  const base = KAMAS.gain[type] ?? 0;
  if (!base) return 0;
  const mult = 1 + KAMAS.gainParToile * (toile - 1);
  return Math.round(base * mult * (0.85 + rng() * 0.3)); // ±15 % de variance
}

/** Ajoute des kamas à la run (et au compteur du récap). */
export function crediterKamas(run: RunState, montant: number): void {
  run.kamas += montant;
  run.stats.kamasGagnes = (run.stats.kamasGagnes ?? 0) + montant;
}

/** Prix d'achat HDV d'un exemplaire (rareté × toile d'origine). */
export function prixAchat(inst: ItemInstance): number {
  const base = KAMAS.prix[inst.rarete ?? "commun"];
  const toile = toileDeItem(inst.id);
  return Math.round(base * (1 + KAMAS.prixParToile * (toile - 1)));
}

/** Prix de revente (fraction du prix d'achat). */
export const prixVente = (inst: ItemInstance): number =>
  Math.max(1, Math.round(prixAchat(inst) * KAMAS.tauxRevente));

/** Article en rayon à l'HDV. */
export interface ArticleHDV {
  inst: ItemInstance;
  prix: number;
}

/** Stock d'un HDV — boutique premium : les objets de la toile COURANTE n'y
 *  paraissent qu'en épique/légendaire (l'excellence locale — le commun/rare
 *  se gagne au combat), ceux de la toile SUIVANTE dès le rare (avant-première). */
export function genererStockHDV(zoneId: string, rng: () => number): ArticleHDV[] {
  const t = toileDeZone(zoneId);
  const zones = TRANCHES[0].zones;
  const tout = (z?: string) => {
    const pools = z ? butinToile(z) : null;
    return pools ? [...pools.normales, ...pools.elites, ...pools.boss] : [];
  };
  const poolCourante = tout(zones[t - 1]);
  const poolSuivante = t < zones.length ? tout(zones[t]) : [];
  const stock: ArticleHDV[] = [];
  for (let i = 0; i < KAMAS.tailleStock; i++) {
    // ~40 % d'avant-première quand la toile suivante existe
    const suivante = poolSuivante.length > 0 && (poolCourante.length === 0 || rng() < 0.4);
    const pool = suivante ? poolSuivante : poolCourante;
    if (!pool.length) break;
    const autorisees: Rarete[] = suivante ? ["rare", "epique", "legendaire"] : ["epique", "legendaire"];
    const inst = rollItemRarete(pool[Math.floor(rng() * pool.length)], rng, autorisees);
    if (inst) stock.push({ inst, prix: prixAchat(inst) });
  }
  return stock;
}

/** Achète l'article `index` du stock (retiré du rayon, ajouté à l'inventaire). */
export function acheterArticle(run: RunState, stock: ArticleHDV[], index: number): boolean {
  const art = stock[index];
  if (!art || run.kamas < art.prix) return false;
  run.kamas -= art.prix;
  run.inventaire.push(art.inst);
  stock.splice(index, 1);
  return true;
}

/** Vend TOUT l'inventaire (au taux de revente). Renvoie le total encaissé. */
export function vendreTout(run: RunState): number {
  let total = 0;
  for (const inst of run.inventaire) total += prixVente(inst);
  run.inventaire.length = 0;
  if (total) crediterKamas(run, total);
  return total;
}

/** Vend l'exemplaire `index` de l'inventaire (au taux de revente). */
export function vendreItem(run: RunState, index: number): boolean {
  const inst = run.inventaire[index];
  if (!inst) return false;
  run.inventaire.splice(index, 1);
  crediterKamas(run, prixVente(inst));
  return true;
}

// --- Export / import de sauvegarde (changement de PC) ---------------------------
const CLES_SAUVEGARDE = ["rld_meta_v0", "rld_settings_v0", "rld_run_v0"] as const;

/** Toutes les données persistées, en un JSON portable (fichier téléchargeable). */
export function exporterSauvegarde(): string {
  const donnees: Record<string, unknown> = {};
  for (const cle of CLES_SAUVEGARDE) {
    try {
      const raw = localStorage.getItem(cle);
      if (raw) donnees[cle] = JSON.parse(raw);
    } catch {
      /* clé illisible : ignorée */
    }
  }
  return JSON.stringify({ jeu: "roguefus-lite", version: 1, date: new Date().toISOString(), donnees }, null, 2);
}

/** Restaure une sauvegarde exportée. Renvoie false si le fichier est invalide.
 *  Les validations fines (rétro-compat…) sont faites par les loaders au reload. */
export function importerSauvegarde(json: string): boolean {
  try {
    const s = JSON.parse(json) as { jeu?: string; version?: number; donnees?: Record<string, unknown> };
    if (s.jeu !== "roguefus-lite" || typeof s.donnees !== "object" || !s.donnees) return false;
    if (!s.donnees["rld_meta_v0"]) return false; // une sauvegarde sans Meta n'en est pas une
    for (const cle of CLES_SAUVEGARDE) {
      if (s.donnees[cle] !== undefined) localStorage.setItem(cle, JSON.stringify(s.donnees[cle]));
      else localStorage.removeItem(cle); // ex. pas de run en cours dans l'export
    }
    return true;
  } catch {
    return false;
  }
}

// --- Meta (persistance) ------------------------------------------------------
const STORAGE_KEY = "rld_meta_v0";

export function chargerMeta(): Meta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Partial<Meta>;
      // rétro-compat : les vieux saves n'ont ni compteurs ni archis
      return { dofus: m.dofus ?? [], archis: m.archis ?? [], runs: m.runs ?? 0, victoires: m.victoires ?? 0, succes: m.succes ?? [], collection: m.collection ?? {} };
    }
  } catch {
    /* localStorage indisponible : on reste en mémoire */
  }
  return { dofus: [], archis: [], runs: 0, victoires: 0, succes: [], collection: {} };
}

export function sauverMeta(meta: Meta): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function ajouterDofus(meta: Meta, id: string): void {
  meta.dofus.push(id);
  sauverMeta(meta);
}

export function reinitialiserMeta(meta: Meta): void {
  meta.dofus = [];
  sauverMeta(meta);
}

/** Enregistre une run terminée : +1 run, +1 victoire si les 6 zones sont vaincues. */
export function enregistrerRun(meta: Meta, reussie: boolean): void {
  meta.runs += 1;
  if (reussie) meta.victoires += 1;
  sauverMeta(meta);
}

/** Multiplicateur de dégâts d'équipe issu des Dofus possédés (cumulable). */
export function bonusDegatsDofus(meta: Meta): number {
  let bonus = 1;
  for (const id of meta.dofus) {
    const d = DOFUS[id];
    if (d) bonus += d.bonusDegatsParCopie;
  }
  return bonus;
}

// Armurerie : rang des paliers de collection (« base » = objet legacy sans rareté)
const RANG_COLLECTION = ["base", "commun", "rare", "epique", "legendaire"];

/** Enregistre des exemplaires obtenus dans la collection persistante (Armurerie) :
 *  on retient, par objet, la meilleure rareté jamais obtenue. */
export function enregistrerCollection(meta: Meta, insts: ItemInstance[]): void {
  if (!insts.length) return;
  const coll = (meta.collection ??= {});
  let modifie = false;
  for (const inst of insts) {
    const palier = inst.rarete ?? "base";
    const actuel = coll[inst.id];
    if (!actuel || RANG_COLLECTION.indexOf(palier) > RANG_COLLECTION.indexOf(actuel)) {
      coll[inst.id] = palier;
      modifie = true;
    }
  }
  if (modifie) sauverMeta(meta);
}

/** Capture l'âme d'une espèce d'Archimonstre (unique). Renvoie true si nouvelle. */
export function capturerArchi(meta: Meta, monstreId: string): boolean {
  if (meta.archis.includes(monstreId)) return false;
  meta.archis.push(monstreId);
  sauverMeta(meta);
  return true;
}

/** Palier de Dofus Ocre atteint selon le nombre d'archis capturés (null si < 50). */
export function paliersOcre(meta: Meta): { tier: number; paBonus: number; degats: number } {
  const n = meta.archis.length;
  let tier = 0, paBonus = 0, degats = 0;
  OCRE_PALIERS.forEach((p, i) => {
    if (n >= p.seuil) { tier = i + 1; paBonus = p.paBonus; degats = p.degats; }
  });
  return { tier, paBonus, degats };
}

/** Bonus d'équipe combinés (Dofus + paliers Ocre) appliqués en combat. */
export function bonusEquipe(meta: Meta): { damageMult: number; paBonus: number; vitaBonus: number; resAllBonus: number } {
  const ocre = paliersOcre(meta);
  // effets « par copie, plafonnés à maxCopies » (Dofawa vita, Argenté résistance)
  const copies: Record<string, number> = {};
  for (const id of meta.dofus) copies[id] = (copies[id] ?? 0) + 1;
  let vitaBonus = 0, resAllBonus = 0;
  for (const [id, n] of Object.entries(copies)) {
    const d = DOFUS[id];
    if (!d) continue;
    const eff = Math.min(n, d.maxCopies ?? Infinity);
    if (d.vitaParCopie) vitaBonus += d.vitaParCopie * eff;
    if (d.resAllParCopie) resAllBonus += d.resAllParCopie * eff;
  }
  return { damageMult: bonusDegatsDofus(meta) + ocre.degats, paBonus: ocre.paBonus, vitaBonus, resAllBonus };
}
