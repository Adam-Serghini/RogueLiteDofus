// =============================================================================
//  run.ts — État de run par personnage, fabrication des combattants, Meta.
//  Ce qui survit à la mort : Meta.dofus (localStorage). Le reste (niveaux,
//  points, PV courants) vit dans RunState et repart à zéro à chaque run.
// =============================================================================
import { CLASSES, MONSTRES, COMBATS, DOFUS, ITEMS, PANOPLIES, DROP, ARCHI, OCRE_PALIERS, MODIFICATEURS_ELITE, type ModificateurElite, ZONES, monstresDeZone, RARETES, RARETE_INFO, BUTIN_ZONE, butinToile } from "./data";
import { progressionInitiale, statsFinales, pvMaxFor, PV_PAR_VITA, gagnerXP, investirN } from "./progression";
import { chargerConfig } from "./config";
import type { Combatant, Element, EquipSlot, GameMap, ItemInstance, Meta, Monstre, Progression, Rarete, Spell, Stats } from "./types";

// --- État de run -------------------------------------------------------------
export interface PersoState {
  classeId: string;
  progression: Progression;
  pvActuels: number; // PV conservés d'un nœud à l'autre
  position: number; // case de grille 0..7 (0-3 ligne avant, 4-7 arrière)
  elementChoisi?: Element; // élément de frappe choisi, conservé d'un combat à l'autre
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
}
export const statsRunVides = (): RunStats => ({ degats: {}, combats: 0, archis: 0, objets: 0, zones: 0 });

export interface RunState {
  persos: PersoState[];
  carte: GameMap | null;
  inventaire: ItemInstance[]; // exemplaires non équipés trouvés cette run (perdus à la mort)
  stats: RunStats; // récap de fin de run
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
export function appliquerElement(perso: PersoState, element: Element | null): void {
  perso.elementChoisi = element ?? undefined;
  if (element) investirN(perso.progression, STAT_PAR_ELEMENT[element], Infinity);
}

/**
 * XP d'un perso : monte de niveau ; si un élément est choisi, alloue
 * automatiquement les points gagnés dans sa stat. Renvoie les niveaux gagnés.
 */
export function gagnerXPPerso(perso: PersoState, gain: number): number {
  const niveaux = gagnerXP(perso.progression, gain);
  if (perso.elementChoisi) investirN(perso.progression, STAT_PAR_ELEMENT[perso.elementChoisi], Infinity);
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
function cellulesPour(ids: string[]): Record<string, number> {
  const f = chargerConfig().formation;
  const cells: Record<string, number> = {};
  const pris = new Set<number>();
  const caseLibreDans = (rangee: "avant" | "arriere"): number | undefined => {
    const [debut, fin] = rangee === "avant" ? [0, 4] : [4, 8];
    for (let c = debut; c < fin; c++) if (!pris.has(c)) return c;
    return undefined;
  };
  for (const id of ids) {
    const pref = f[id] === "arriere" ? "arriere" : "avant"; // défaut : avant
    const cell = caseLibreDans(pref) ?? caseLibreDans(pref === "avant" ? "arriere" : "avant")!;
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
    return {
      classeId,
      progression,
      pvActuels: pvMaxFor(CLASSES[classeId], progression),
      position: cells[classeId],
      elementChoisi: elemsPref[classeId], // préréglage (absent = Libre)
      equipement: {},
    };
  });
  return { persos, carte: null, inventaire: [], stats: statsRunVides() };
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
  progression.pointsDispo = (niveau - 1) * 5; // points cumulés des montées de niveau
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
  let libre = 0;
  while (pris.has(libre)) libre++;
  run.persos.push(nouveauPerso(run, classeId, libre));
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
      id: "arme_attaque", nom: armeItem.nom, type: "degats", cible: "ennemi_ligne",
      coutPA: attaque.coutPA, baseMin: attaque.baseMin,
      baseMax: attaque.baseMax, scaling: attaque.scaling,
      img: `/assets/items/${armeItem.id}.png`, desc: "Attaque d'arme.",
    }
    : undefined;
  return {
    armeSort,
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
/** Tire une rareté selon les poids du catalogue (commun 60 / rare 25 / épique 12 / légendaire 3). */
export function tirerRarete(rng: () => number): Rarete {
  const total = RARETES.reduce((s, r) => s + RARETE_INFO[r].poids, 0);
  let t = rng() * total;
  for (const r of RARETES) {
    t -= RARETE_INFO[r].poids;
    if (t < 0) return r;
  }
  return "commun";
}

/** Crée un exemplaire d'item. Objet à rareté : palier tiré, stats fixes figées.
 *  Objet legacy : chaque stat tirée dans sa fourchette (jet façon Dofus). */
export function rollItem(itemId: string, rng: () => number): ItemInstance {
  const item = ITEMS[itemId];
  const tiers = item?.tiers;
  if (tiers) {
    const rarete = tirerRarete(rng);
    const tier = tiers[rarete]!;
    return { id: itemId, rarete, stats: { ...tier.stats }, resistances: tier.resistances, pa: tier.pa };
  }
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
  const pool = butinToile(zoneId);
  const tirages = pool ?? PANOPLIES[BUTIN_ZONE[zoneId]]?.pieces ?? [];
  for (let i = 0; i < Math.min(tirages.length, 4); i++) {
    if (rng() < p) {
      const id = pool ? pool[Math.floor(rng() * pool.length)] : tirages[i];
      const inst = rollItem(id, rng);
      run.inventaire.push(inst);
      drops.push(inst);
    }
  }
  return drops;
}

/** Équipe l'exemplaire d'inventaire `index` sur son perso (l'ancien du slot y retourne). */
export function equiper(inventaire: ItemInstance[], perso: PersoState, index: number): void {
  const inst = inventaire[index];
  const item = inst ? ITEMS[inst.id] : undefined;
  if (!inst || !item) return;
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

/** Applique un modificateur d'élite tiré au sort à TOUTE la meute (combat dur). */
export function appliquerModificateurElite(enemies: Combatant[], rng: () => number): ModificateurElite {
  const m = MODIFICATEURS_ELITE[Math.floor(rng() * MODIFICATEURS_ELITE.length)];
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
    s.run.stats = s.run.stats ?? statsRunVides(); // rétro-compat : anciennes saves sans stats
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

// --- Meta (persistance) ------------------------------------------------------
const STORAGE_KEY = "rld_meta_v0";

export function chargerMeta(): Meta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Partial<Meta>;
      // rétro-compat : les vieux saves n'ont ni compteurs ni archis
      return { dofus: m.dofus ?? [], archis: m.archis ?? [], runs: m.runs ?? 0, victoires: m.victoires ?? 0, succes: m.succes ?? [] };
    }
  } catch {
    /* localStorage indisponible : on reste en mémoire */
  }
  return { dofus: [], archis: [], runs: 0, victoires: 0, succes: [] };
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
