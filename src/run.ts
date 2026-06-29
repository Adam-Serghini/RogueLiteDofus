// =============================================================================
//  run.ts — État de run par personnage, fabrication des combattants, Meta.
//  Ce qui survit à la mort : Meta.dofus (localStorage). Le reste (niveaux,
//  points, PV courants) vit dans RunState et repart à zéro à chaque run.
// =============================================================================
import { CLASSES, MONSTRES, COMBATS, DOFUS, ITEMS, PANOPLIES, DROP, ARCHI, OCRE_PALIERS } from "./data";
import { progressionInitiale, statsFinales, pvMaxFor, PV_PAR_VITA } from "./progression";
import { chargerConfig } from "./config";
import type { Combatant, Element, EquipSlot, GameMap, Meta, Monstre, Progression, Stats } from "./types";

// --- État de run -------------------------------------------------------------
export interface PersoState {
  classeId: string;
  progression: Progression;
  pvActuels: number; // PV conservés d'un nœud à l'autre
  position: number; // case de grille 0..7 (0-3 ligne avant, 4-7 arrière)
  elementChoisi?: Element; // élément de frappe choisi, conservé d'un combat à l'autre
  equipement: Partial<Record<EquipSlot, string>>; // objet équipé par slot (id d'objet)
}

export interface RunState {
  persos: PersoState[];
  carte: GameMap | null;
  inventaire: string[]; // objets non équipés trouvés cette run (perdus à la mort)
}

export const EQUIPE_DEPART = ["iop", "cra", "eniripsa", "sadida"]; // roster par défaut (tests)
export const TAILLE_MAX_EQUIPE = 4;

/** Toutes les classes jouables (ordre d'insertion de CLASSES). */
export const classesDisponibles = (): string[] => Object.keys(CLASSES);

/** Case de grille (0..7) de chaque membre, depuis la formation sauvegardée.
 *  Garantit l'unicité et le domaine ; complète les manquants par la 1re case libre. */
function cellulesPour(ids: string[]): Record<string, number> {
  const f = chargerConfig().formation;
  const cells: Record<string, number> = {};
  const pris = new Set<number>();
  for (const id of ids) {
    const c = f[id];
    if (typeof c === "number" && c >= 0 && c < 8 && !pris.has(c)) {
      cells[id] = c;
      pris.add(c);
    }
  }
  let libre = 0;
  for (const id of ids) {
    if (cells[id] === undefined) {
      while (pris.has(libre)) libre++;
      cells[id] = libre;
      pris.add(libre);
    }
  }
  return cells;
}

export function nouvelleRun(choix: string[] = EQUIPE_DEPART): RunState {
  const cells = cellulesPour(choix);
  const persos: PersoState[] = choix.map((classeId) => {
    const progression = progressionInitiale();
    return {
      classeId,
      progression,
      pvActuels: pvMaxFor(CLASSES[classeId], progression),
      position: cells[classeId],
      equipement: {},
    };
  });
  return { persos, carte: null, inventaire: [] };
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
  chance: 0, wakfu: 0, stasis: 0, soin: 0, prospection: 0,
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
  stats: Stats; pvBonus: number; resistances: Partial<Record<Element, number>>;
} {
  const stats = statsVides();
  let pvBonus = 0;
  const resistances: Partial<Record<Element, number>> = {};
  const comptePano: Record<string, number> = {};
  for (const slot of Object.keys(state.equipement) as EquipSlot[]) {
    const item = state.equipement[slot] ? ITEMS[state.equipement[slot]!] : undefined;
    if (!item) continue;
    ajouterStats(stats, item.stats);
    pvBonus += item.pvBonus ?? 0;
    ajouterRes(resistances, item.resistances);
    comptePano[item.panoplie] = (comptePano[item.panoplie] ?? 0) + 1;
  }
  for (const [panoId, n] of Object.entries(comptePano)) {
    for (const b of PANOPLIES[panoId]?.bonus ?? []) {
      if (n >= b.seuil) { ajouterStats(stats, b.stats); pvBonus += b.pvBonus ?? 0; ajouterRes(resistances, b.resistances); }
    }
  }
  return { stats, pvBonus, resistances };
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
  return {
    ref: `j_${state.classeId}`,
    nom: classe.nom,
    pvBase: pvMax, // base de référence pour les buffs de vitalité en %
    pvMax,
    pvActuels: Math.min(state.pvActuels, pvMax),
    stats,
    paMax: classe.pa,
    paActuels: classe.pa,
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
    retraitPANextTurn: 0,
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
/** Pièces d'une panoplie ni équipées ni déjà dans l'inventaire. */
export function piecesEligibles(run: RunState, panoplieId: string): string[] {
  const pano = PANOPLIES[panoplieId];
  if (!pano) return [];
  const possedees = new Set<string>(run.inventaire);
  for (const p of run.persos) for (const id of Object.values(p.equipement)) if (id) possedees.add(id);
  return pano.pieces.filter((id) => !possedees.has(id));
}

/** Prospection cumulée de l'équipe (stat de classe + équipement). */
export function prospectionEquipe(run: RunState): number {
  return run.persos.reduce((s, p) => {
    const base = statsFinales(CLASSES[p.classeId], p.progression).prospection ?? 0;
    return s + base + (bonusEquipement(p).stats.prospection ?? 0);
  }, 0);
}

/** Tire le butin d'une victoire : ajoute les pièces tombées à l'inventaire, les renvoie. */
export function tenterButin(run: RunState, panoplieId: string, type: string, rng: () => number): string[] {
  const taux = DROP.taux[type] ?? 0;
  if (taux <= 0) return [];
  const mult = 1 + Math.min(DROP.capProspection, prospectionEquipe(run) * DROP.coefProspection);
  const p = taux * mult;
  const drops: string[] = [];
  for (const id of piecesEligibles(run, panoplieId)) {
    if (rng() < p) { run.inventaire.push(id); drops.push(id); }
  }
  return drops;
}

/** Équipe un objet de l'inventaire sur un perso (l'ancienne pièce du slot y retourne). */
export function equiper(inventaire: string[], perso: PersoState, itemId: string): void {
  const item = ITEMS[itemId];
  const idx = inventaire.indexOf(itemId);
  if (!item || idx < 0) return;
  inventaire.splice(idx, 1);
  const ancien = perso.equipement[item.slot];
  if (ancien) inventaire.push(ancien);
  perso.equipement[item.slot] = itemId;
  perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
}

/** Déséquipe le slot d'un perso (l'objet retourne à l'inventaire). */
export function desequiper(inventaire: string[], perso: PersoState, slot: EquipSlot): void {
  const id = perso.equipement[slot];
  if (!id) return;
  delete perso.equipement[slot];
  inventaire.push(id);
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
    effets: [],
    img: m.img,
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
    dofusLache: m.dofus,
  };
}

export function fabriquerEnnemis(combatKey: string): Combatant[] {
  const def = COMBATS[combatKey];
  return def.ennemis.map((e, i) => depuisMonstre(MONSTRES[e.monstre], `e${i}_${e.monstre}`, e.position));
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
      wakfu: Math.round((s.wakfu ?? 0) * ARCHI.statMult),
      stasis: Math.round((s.stasis ?? 0) * ARCHI.statMult),
    };
  }
}

// --- Meta (persistance) ------------------------------------------------------
const STORAGE_KEY = "rld_meta_v0";

export function chargerMeta(): Meta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Partial<Meta>;
      return { dofus: m.dofus ?? [], archis: m.archis ?? [] }; // rétro-compat
    }
  } catch {
    /* localStorage indisponible : on reste en mémoire */
  }
  return { dofus: [], archis: [] };
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
export function bonusEquipe(meta: Meta): { damageMult: number; paBonus: number } {
  const ocre = paliersOcre(meta);
  return { damageMult: bonusDegatsDofus(meta) + ocre.degats, paBonus: ocre.paBonus };
}
