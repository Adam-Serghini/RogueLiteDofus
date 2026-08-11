// =============================================================================
//  run.ts — État de run par personnage, fabrication des combattants, Meta.
//  Ce qui survit à la mort : Meta.dofus (localStorage). Le reste (niveaux,
//  points, PV courants) vit dans RunState et repart à zéro à chaque run.
// =============================================================================
import { CLASSES, MONSTRES, COMBATS, DOFUS, ITEMS, DROP, ARCHI, ERRANTS, OCRE_PALIERS, MODIFICATEURS_ELITE, type ModificateurElite, ASCENSION, ASCENSION_MAX, type EffetsAscension, ZONES, type ZoneDef, monstresDeZone, RARETES, RARETE_INFO, butinToile, itemsDeToile, KAMAS, TRANCHES, TAVERNE_PCT, DOFUS_DROP_RATE, localiserZone, offsetToile, trancheDe, type TrancheDef } from "./data";
import { progressionInitiale, statsFinales, pvMaxFor, PV_PAR_VITA, gagnerXP, STAT_PAR_ELEMENT } from "./progression";
import { etatCombatInitial } from "./combat";
import { chargerConfig, rangClasse } from "./config";
import type { Combatant, DofusInstance, Element, EquipSlot, GameMap, ItemInstance, Meta, Monstre, NodeType, Progression, Rarete, Spell, Stats } from "./types";

// --- État de run -------------------------------------------------------------
export interface PersoState {
  classeId: string;
  progression: Progression;
  pvActuels: number; // PV conservés d'un nœud à l'autre
  position: number; // case de grille 0..7 (0-3 ligne avant, 4-7 arrière)
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
  ascension: number; // palier d'Ascension de la run (0 = jeu de base)
  philtres: number; // philtres d'Otomai bus : chaque philtre ajoute +ARCHI.philtre au taux d'archi
  trancheId: string; // tranche jouée par cette run (cap de niveau, zones, toile)
}

export const EQUIPE_DEPART = ["iop", "cra", "eniripsa", "ecaflip"]; // roster par défaut (tests)
export const TAILLE_MAX_EQUIPE = 4;

/** Niveau maximum (cap d'XP) de la tranche donnée. */
export const niveauMaxTranche = (trancheId: string): number => trancheDe(trancheId).niveaux[1];

/** XP d'un perso : monte de niveau (les stats suivent automatiquement, voir
 *  `statsFinales`). Renvoie les niveaux gagnés. */
export function gagnerXPPerso(perso: PersoState, gain: number, trancheId: string): number {
  return gagnerXP(perso.progression, gain, niveauMaxTranche(trancheId));
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

/** Perso neuf à un niveau donné (les stats en découlent automatiquement, voir
 *  `statsFinales`). */
export function persoAuNiveau(classeId: string, niveau: number, position: number): PersoState {
  const progression = progressionInitiale();
  progression.niveau = niveau;
  return { classeId, progression, pvActuels: pvMaxFor(CLASSES[classeId], progression), position, equipement: {} };
}

/** Trie une équipe par rang de jeu (copie ; le tri de `Array.prototype.sort` est stable). */
export function trierParOrdre(persos: PersoState[], ordre: Record<string, number>): PersoState[] {
  return [...persos].sort((a, b) => rangClasse(ordre, a.classeId) - rangClasse(ordre, b.classeId));
}

/** Insère une recrue devant le premier héros de rang strictement moins bon ; en queue
 *  si elle est la moins bien classée. Reste défini même si le joueur a réorganisé sa
 *  liste à la main : on ne suppose jamais que la liste suit les rangs. */
export function insererSelonOrdre(persos: PersoState[], recrue: PersoState, ordre: Record<string, number>): void {
  const r = rangClasse(ordre, recrue.classeId);
  const i = persos.findIndex((p) => rangClasse(ordre, p.classeId) > r);
  if (i < 0) persos.push(recrue);
  else persos.splice(i, 0, recrue);
}

export function nouvelleRun(choix: string[] = EQUIPE_DEPART, ascension = 0, trancheId = "t1"): RunState {
  const cells = cellulesPour(choix);
  const niveauDepart = trancheDe(trancheId).niveaux[0];
  const persos: PersoState[] = choix.map((classeId) => {
    const perso = persoAuNiveau(classeId, niveauDepart, cells[classeId]);
    // `persoAuNiveau` a figé les PV sans l'équipement (encore vide à cet instant,
    // mais `pvMaxPerso` inclut aussi les bonus de Vitalité de l'équipement) : on
    // resynchronise sur le vrai maximum pour rester correct si ça change.
    perso.pvActuels = pvMaxPerso(perso);
    return perso;
  });
  return { persos: trierParOrdre(persos, chargerConfig().ordre), carte: null, inventaire: [], stats: statsRunVides(), kamas: 0, choixDepart: [...choix], ascension, philtres: 0, trancheId };
}

// --- Recrutement (Taverne) ---------------------------------------------------
export const equipePleine = (run: RunState): boolean => run.persos.length >= TAILLE_MAX_EQUIPE;

/** Types de nœuds exclus du plateau d'une zone : ceux que la zone refuse, plus
 *  ceux que le palier d'Ascension coupe.
 *
 *  Source UNIQUE, consommée par la génération de carte ET par la roue du Zaap :
 *  sans elle, un Zaap recracherait la taverne qu'on vient d'interdire.
 *
 *  Le compte des membres inclut les MORTS (`run.persos.length`) : à Ultime, un
 *  héros mort après le 4ᵉ recrutement occupe sa case pour le reste de la run. */
export function sansNoeudsDeZone(run: RunState, zone: ZoneDef): NodeType[] {
  const exclus = [...((zone.sansNoeuds ?? []) as NodeType[])];
  const eff = effetsAscension(run.ascension);
  if (eff.tavernesCoupeesAPlein && run.persos.length >= TAILLE_MAX_EQUIPE && !exclus.includes("taverne")) {
    exclus.push("taverne");
  }
  return exclus;
}

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

/** Crée un nouveau perso au niveau de l'équipe. */
function nouveauPerso(run: RunState, classeId: string, position: number): PersoState {
  return persoAuNiveau(classeId, niveauMoyen(run), position);
}

/** Recrute une classe : l'ajoute (équipe < 4) ou remplace un membre (équipe pleine). */
export function recruter(run: RunState, classeId: string, remplaceClasseId?: string): void {
  if (remplaceClasseId) {
    const idx = run.persos.findIndex((p) => p.classeId === remplaceClasseId);
    if (idx >= 0) {
      // le partant rend son équipement à l'inventaire de la run
      for (const inst of Object.values(run.persos[idx].equipement)) {
        if (inst) run.inventaire.push(inst);
      }
      // remplacement : la recrue hérite de la CASE DE GRILLE du partant (position),
      // elle prend donc aussi sa place dans la file `run.persos` — délibéré, pas
      // d'appel à `insererSelonOrdre` ici : elle joue à l'emplacement qu'occupait
      // le partant en formation comme dans l'ordre de jeu.
      run.persos[idx] = nouveauPerso(run, classeId, run.persos[idx].position);
      return;
    }
  }
  const pris = new Set(run.persos.map((p) => p.position));
  const recrue = nouveauPerso(run, classeId, caseLibrePreferee(classeId, pris));
  insererSelonOrdre(run.persos, recrue, chargerConfig().ordre);
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

/** Bonus de PA quand les 4 pièces d'une même panoplie sont équipées. */
export const PANOPLIE_BONUS_PA = 1;

/** Compte des pièces équipées par panoplie (pour le bonus et l'affichage inventaire). */
export function comptePanoplies(state: PersoState): Record<string, number> {
  const compte: Record<string, number> = {};
  for (const inst of Object.values(state.equipement)) {
    const pano = inst && ITEMS[inst.id]?.panoplie;
    if (pano) compte[pano] = (compte[pano] ?? 0) + 1;
  }
  return compte;
}

/** Bonus total apporté par l'équipement d'un perso (objets équipés + panoplie complète). */
export function bonusEquipement(state: PersoState): {
  stats: Stats; pvBonus: number; resistances: Partial<Record<Element, number>>; paBonus: number;
} {
  const stats = statsVides();
  let pvBonus = 0;
  let paBonus = 0;
  const resistances: Partial<Record<Element, number>> = {};
  for (const slot of Object.keys(state.equipement) as EquipSlot[]) {
    const inst = state.equipement[slot];
    const item = inst ? ITEMS[inst.id] : undefined;
    if (!inst || !item) continue;
    ajouterStats(stats, inst.stats); // stats de l'exemplaire (rollées ou du palier de rareté)
    // ligne adaptative : les DEUX éléments de la classe, à pleine valeur sur chacun.
    // Un seul élément frappe à la fois, donc la puissance effective ne change pas — on
    // supprime le gaspillage, on ne double pas la mise. L'objet cesse d'être un piège.
    if (inst.adaptatif) {
      for (const el of CLASSES[state.classeId].elements) {
        const k = STAT_PAR_ELEMENT[el];
        stats[k] = (stats[k] ?? 0) + inst.adaptatif;
      }
    }
    pvBonus += item.pvBonus ?? 0;
    paBonus += inst.pa ?? 0; // PA d'équipement (paliers de rareté)
    ajouterRes(resistances, item.resistances);
    ajouterRes(resistances, inst.resistances); // résistances du palier de rareté
  }
  // panoplie complète (4 pièces du même set, rareté indifférente) → +1 PA
  if (Object.values(comptePanoplies(state)).some((n) => n >= 4)) paBonus += PANOPLIE_BONUS_PA;
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
  const attaque = armeInst?.rarete ? armeItem?.tiers?.[armeInst.rarete]?.attaque : undefined;
  const armeSort: Spell | undefined = armeItem && attaque
    ? {
      id: "arme_attaque", nom: armeItem.nom, type: "degats",
      cible: attaque.cible ?? "ennemi_ligne", // ennemi_tous : l'arme atteint la ligne arrière
      coutPA: attaque.coutPA, baseMin: attaque.baseMin,
      baseMax: attaque.baseMax, scaling: attaque.scaling,
      ...(attaque.vampirisme ? { vampirismeRatio: attaque.vampirisme } : {}),
      ...(armeItem.perceResistances ? { perceResistances: armeItem.perceResistances } : {}),
      ...(armeItem.frappeDerriere ? { toucheDerriere: true } : {}),
      ...(armeItem.poisonArme ? { poison: armeItem.poisonArme } : {}),
      ...(armeItem.soinAllieBlesse ? { soinAllieBlesseRatio: armeItem.soinAllieBlesse } : {}),
      ...(armeItem.retraitPA ? { retraitPA: armeItem.retraitPA } : {}),
      img: `/assets/items/${armeItem.id}.png`,
      desc: attaque.cible === "ennemi_tous"
        ? "Attaque d'arme — atteint la ligne arrière."
        : attaque.vampirisme
          ? `Attaque d'arme — rend ${Math.round(attaque.vampirisme * 100)} % des dégâts en PV.`
          : "Attaque d'arme.",
    }
    : undefined;
  // Effets spéciaux d'équipement (premier objet porteur, non cumulables)
  const special = <K extends "paGamble" | "riposteAvant" | "esquiveArriere" | "soinDegatsRecus" | "changeLigne" | "bouclierDebut" | "elementLibre" | "renaissance">(k: K) =>
    (Object.values(state.equipement).map((i) => i && ITEMS[i.id]?.[k]).find(Boolean)) ?? undefined;
  // Dagues Eurfolles : l'objet confère le sort « Changer de ligne »
  const sortsEquipement = special("changeLigne") ? ["changer_ligne"] : [];
  const renaissance = special("renaissance");
  return {
    armeSort,
    paGamble: special("paGamble"),
    riposteAvant: special("riposteAvant"),
    esquiveArriere: special("esquiveArriere"),
    soinDegatsRecus: special("soinDegatsRecus"),
    elementLibre: special("elementLibre"),
    renaissance,
    renaissancesRestantes: renaissance ? 1 : 0,
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
    sorts: [...classe.sorts, ...sortsEquipement],
    camp: "joueur",
    position: state.position,
    niveau: state.progression.niveau,
    elements: classe.elements,
    img: classe.img,
    ...etatCombatInitial(),
    // Bonnet Spairance : chaque combat démarre avec un bouclier (fraction des PV max)
    bouclier: Math.round(pvMax * (special("bouclierDebut") ?? 0)),
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

/** Réécrit l'état conservé d'un combat à l'autre (PV courants). */
export function synchroniserPV(run: RunState, combatants: Combatant[]): void {
  for (const s of run.persos) {
    const c = combatants.find((x) => x.ref === `j_${s.classeId}`);
    if (c) {
      s.pvActuels = c.pvActuels;
    }
  }
}

/** Taverne : rend une fraction des PV max à toute l'équipe.
 *
 *  À partir de Cauchemar (`mortDefinitive`), un héros à 0 PV n'est PAS relevé. La
 *  règle vit ici et non chez les appelants parce qu'il y a deux résurrections à
 *  couvrir : la taverne, et le soin à 100 % automatique après chaque boss de zone.
 *  La seule exception du jeu reste le Kwakwanneau (`renaissance`), qui agit en
 *  combat et ne passe pas par cette fonction. */
export function soignerEquipe(run: RunState, pct: number): void {
  const mortDefinitive = !!effetsAscension(run.ascension).mortDefinitive;
  for (const s of run.persos) {
    if (mortDefinitive && s.pvActuels <= 0) continue;
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

/** Fige les stats d'un palier de rareté en exemplaire concret. SOURCE UNIQUE de
 *  la conversion palier → ItemInstance (jeu ET sim). null si le palier n'existe pas. */
export function instanceDuTier(itemId: string, rarete: Rarete): ItemInstance | null {
  const tier = ITEMS[itemId]?.tiers?.[rarete];
  if (!tier) return null;
  return { id: itemId, rarete, stats: { ...tier.stats }, adaptatif: tier.adaptatif, resistances: tier.resistances, pa: tier.pa };
}

/** Meilleur objet du pool de toile pour un slot et une stat (celui qui maximise
 *  la stat visée du membre, vitalité en départage) — ce qu'un joueur garderait.
 *  Vit ici et non dans `sim.ts` : le banc d'essai de l'éditeur s'en sert aussi,
 *  et deux implémentations du choix d'équipement finiraient par diverger. */
export function meilleurItemToile(pool: string[], slot: string, stat: keyof Stats): string | null {
  const candidats = pool.filter((id) => ITEMS[id].slot === slot && ITEMS[id].tiers?.commun);
  if (!candidats.length) return null;
  const score = (id: string) => {
    const t = ITEMS[id].tiers!.commun!;
    // la vitalité pèse : un vrai joueur prend la coiffe tank face aux boss burst
    return ((t.stats[stat] ?? 0) + (t.adaptatif ?? 0)) * 10 + (t.stats.vitalite ?? 0) * 4;
  };
  return candidats.sort((a, b) => score(b) - score(a))[0];
}

/** Exemplaire d'un objet à rareté, tirage restreint aux paliers `autorisees`
 *  (∩ paliers réellement définis sur l'objet). null si aucun palier ne convient. */
export function rollItemRarete(itemId: string, rng: () => number, autorisees: readonly Rarete[] = RARETES): ItemInstance | null {
  const tiers = ITEMS[itemId]?.tiers;
  if (!tiers) return null;
  const disponibles = autorisees.filter((r) => tiers[r]);
  if (!disponibles.length) return null;
  return instanceDuTier(itemId, tirerRarete(rng, disponibles));
}

/** Crée un exemplaire d'item : palier de rareté tiré, stats fixes figées. */
export function rollItem(itemId: string, rng: () => number): ItemInstance {
  return rollItemRarete(itemId, rng)!;
}

/** Prospection cumulée de l'équipe (stat de classe + équipement).
 *  Caskoffre : +X par PV manquant du porteur — évaluée au moment du butin,
 *  donc plus l'équipe a saigné, plus le coffre paie. */
export function prospectionEquipe(run: RunState): number {
  return run.persos.reduce((s, p) => {
    const base = statsFinales(CLASSES[p.classeId], p.progression).prospection ?? 0;
    const parPvManquant = Object.values(p.equipement)
      .map((i) => i && ITEMS[i.id]?.prospParPvManquant)
      .find(Boolean);
    const bonusCoffre = parPvManquant ? Math.round(parPvManquant * Math.max(0, pvMaxPerso(p) - p.pvActuels)) : 0;
    return s + base + (bonusEquipement(p).stats.prospection ?? 0) + bonusCoffre;
  }, 0);
}

/** Multiplicateur de kamas de combat de l'équipe (Ann'or, multiplicatif si plusieurs). */
export function multKamasEquipe(run: RunState): number {
  return run.persos.reduce((m, p) => {
    for (const inst of Object.values(p.equipement)) {
      const mult = inst && ITEMS[inst.id]?.multKamas;
      if (mult) m *= mult;
    }
    return m;
  }, 1);
}

/**
 * Tire le butin d'une victoire. Zone à toile (objets à rareté) : 4 tirages, chacun
 * pioche un objet au hasard dans le pool de la zone. Doublons autorisés.
 */
export function tenterButin(run: RunState, zoneId: string, type: string, rng: () => number, tauxType: string = type): ItemInstance[] {
  // tauxType découple le TAUX de drop du POOL : un combat dur modifié paie au taux
  // donjon (tauxType="donjon") mais pioche toujours ses exclusifs ÉLITE (type)
  const taux = DROP.taux[tauxType] ?? 0;
  if (taux <= 0) return [];
  const mult = 1 + Math.min(DROP.capProspection, prospectionEquipe(run) * DROP.coefProspection);
  const p = taux * mult;
  const drops: ItemInstance[] = [];
  const pools = butinToile(zoneId);
  if (!pools) return [];
  const tirages = pools.normales;
  for (let i = 0; i < Math.min(Math.max(tirages.length, 1), 4); i++) {
    if (rng() < p) {
      let source = tirages;
      // le PREMIER tirage vient de la source exclusive du nœud (la carotte) :
      // objets « boss » au donjon, objets « élite » aux combats durs
      if (i === 0) {
        if (type === "donjon" && pools.boss.length) source = pools.boss;
        else if (type === "combat_dur" && pools.elites.length) source = pools.elites;
      }
      if (!source.length) continue;
      const id = source[Math.floor(rng() * source.length)];
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
    armure: m.armure,
    nullifieParTour: m.nullifieParTour,
    // armé dès la fabrication : un héros plus rapide frapperait sinon avant le premier
    // tour du porteur, et l'annulation ne serait pas encore en place
    coupsAnnulesRestants: m.nullifieParTour,
    img: m.img,
    ...etatCombatInitial(),
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

/** Applique le modificateur d'élite (id imposé si fourni, sinon tiré). */
export function appliquerModificateursElite(
  enemies: Combatant[], rng: () => number, modifIds?: string[],
): ModificateurElite[] {
  const restants = [...MODIFICATEURS_ELITE];
  const choisis: ModificateurElite[] = [];
  for (const id of modifIds ?? []) {
    const i = restants.findIndex((m) => m.id === id);
    if (i >= 0 && !choisis.length) choisis.push(restants.splice(i, 1)[0]);
  }
  if (!choisis.length && restants.length) choisis.push(restants.splice(Math.floor(rng() * restants.length), 1)[0]);
  for (const m of choisis) appliquerModificateurElite(enemies, rng, m.id);
  return choisis;
}

// --- Ascension : application aux ennemis ----------------------------------------
/** Espèces (uniques) des combats NORMAUX d'une zone — vivier du renfort d'Ascension. */
export function especesNormalesDeZone(zone: ZoneDef): string[] {
  const ids = new Set<string>();
  for (const cid of zone.pools.normales) for (const e of COMBATS[cid]?.ennemis ?? []) ids.add(e.monstre);
  return [...ids];
}

/** Applique les malus d'Ascension à une meute (voir EffetsAscension). */
export function appliquerAscensionEnnemis(
  ennemis: Combatant[], eff: EffetsAscension,
  opts: { type: "combat" | "combat_dur" | "donjon"; especesZone?: string[]; rng: () => number },
): void {
  // Renfort : une espèce ordinaire de la zone vient grossir le pack, en LIGNE
  // AVANT uniquement (0-3). Si la ligne avant est pleine, pas de renfort — un
  // repli sur l'arrière ferait mentir le libellé du cran. Posé AVANT les
  // multiplicateurs pour qu'il les subisse comme les autres.
  const renforçable = opts.type === "combat" || opts.type === "combat_dur";
  if (eff.renfortAvant && renforçable && opts.especesZone?.length) {
    const occupees = new Set(ennemis.map((e) => e.position));
    const cell = [0, 1, 2, 3].find((c) => !occupees.has(c));
    if (cell !== undefined) {
      const espece = opts.especesZone[Math.floor(opts.rng() * opts.especesZone.length)];
      ennemis.push(depuisMonstre(MONSTRES[espece], `asc_${espece}`, cell));
    }
  }
  for (const e of ennemis) {
    if (eff.pvMult) {
      e.pvMax = Math.round(e.pvMax * eff.pvMult);
      e.pvBase = e.pvMax;
      e.pvActuels = e.pvMax;
    }
  }
}

// --- Ascension -----------------------------------------------------------------
/** Effets du cran `palier` — lecture DIRECTE de la table, aucune fusion : chaque
 *  cran porte déjà tout son tableau (voir `ASCENSION`). L'index est écrêté pour
 *  qu'une sauvegarde abîmée ne renvoie jamais `undefined`. */
export function effetsAscension(palier: number): EffetsAscension {
  const i = Math.max(0, Math.min(Math.trunc(palier) || 0, ASCENSION.length - 1));
  return ASCENSION[i].effets;
}

/** Taux d'apparition d'archimonstre effectif : base + ARCHI.philtre par philtre
 *  d'Otomai bu, le cumul saturant à `ARCHI.philtresMax` philtres. */
export function chanceArchi(run: RunState): number {
  return ARCHI.chance + ARCHI.philtre * Math.min(run.philtres ?? 0, ARCHI.philtresMax);
}

/** Mute un combattant en Archimonstre : vrai nom, PV doublés, stats × `ARCHI.statMult`.
 *  Partagé par le tirage de zone (`appliquerArchimonstres`) et par les errants, qui eux
 *  arrivent DÉJÀ mutés. Sans effet sur un archi (garde anti-double-mutation). */
export function muterEnArchi(e: Combatant): void {
  if (e.archi || !e.archiNom) return;
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

/** Transforme aléatoirement des ennemis en Archimonstres (boostés + capturables). */
export function appliquerArchimonstres(enemies: Combatant[], rng: () => number, chance = ARCHI.chance): void {
  for (const e of enemies) {
    if (!e.archiNom) continue; // seules les espèces ayant un Archimonstre réel peuvent muter
    if (rng() >= chance) continue;
    muterEnArchi(e);
  }
}

/** Archimonstre ERRANT : ajoute rarement une espèce hors zone (les Piou) au pack, déjà
 *  mutée en archi. Renvoie son nom d'archimonstre pour l'annonce, `undefined` sinon.
 *
 *  Deux restrictions volontaires : uniquement en combat NORMAL (les nœuds élite et les
 *  salles de boss sont équilibrés — un archi de plus les déréglerait, et une salle tendue
 *  pourrait devenir infaisable), et à appeler APRÈS `appliquerArchimonstres` pour ne pas
 *  subir un second doublement (`muterEnArchi` s'en garde de son côté). */
export function appliquerErrants(
  ennemis: Combatant[], rng: () => number,
  opts: { type: "combat" | "combat_dur" | "donjon"; tranche: string },
): string | undefined {
  if (opts.type !== "combat") return undefined;
  const def = ERRANTS[opts.tranche];
  if (!def?.especes.length) return undefined;
  if (rng() >= def.chance) return undefined; // tirage d'apparition D'ABORD, choix ensuite
  const occupees = new Set(ennemis.map((e) => e.position));
  const cell = [0, 1, 2, 3, 4, 5, 6, 7].find((c) => !occupees.has(c));
  if (cell === undefined) return undefined; // grille pleine : il n'apparaît pas
  const espece = def.especes[Math.floor(rng() * def.especes.length)];
  const piou = depuisMonstre(MONSTRES[espece], `err_${espece}`, cell);
  muterEnArchi(piou);
  ennemis.push(piou);
  return piou.nom;
}

// --- Run en cours (persistance) ------------------------------------------------
// La run est sauvegardée à chaque étape du plateau : on peut fermer la page et
// reprendre où on en était. Un combat en cours n'est PAS sauvegardé (nœud à
// refaire à la reprise). Effacée au wipe, à la victoire ou à l'abandon.
const RUN_KEY = "rld_run_v0";

/** Version du schéma de `Meta`. 2 = après la refonte de l'Ascension (records remis à
 *  zéro une seule fois pour une sauvegarde antérieure). 3 = les reliques sont passées
 *  d'identifiants à des exemplaires (`DofusInstance`), conversion elle-même idempotente
 *  (voir `chargerMeta`) donc sans garde de version dédiée. */
export const META_VERSION = 3;
/** Version du schéma de la run sauvegardée. 2 = après la refonte de l'Ascension. */
export const RUN_VERSION = 2;

export interface RunSauvee {
  version: number;
  zoneIdx: number; // index dans les zones de la tranche active
  run: RunState;
}

export function sauverRunEnCours(zoneIdx: number, run: RunState): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: RUN_VERSION, zoneIdx, run } satisfies RunSauvee));
  } catch {
    /* localStorage indisponible : pas de reprise possible */
  }
}

export function chargerRunEnCours(): RunSauvee | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<RunSauvee>;
    // validation légère : version connue, persos existants dans CLASSES, zoneIdx sain.
    // Les versions 1 (avant la refonte de l'Ascension) et 2 sont toutes deux acceptées —
    // n'accepter que la dernière jetterait la run en cours de tous les joueurs.
    if (typeof s.version !== "number" || s.version < 1 || s.version > RUN_VERSION ||
        typeof s.zoneIdx !== "number" || !s.run?.persos?.length) return null;
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
    // Refonte de l'Ascension : une run sauvée AVANT (version 1) porte un palier de
    // l'ancienne échelle 0-8. On la ramène à Normal au lieu de la convertir — un 7
    // écrêté à 4 ferait basculer le joueur, en pleine partie, sous des règles qu'il n'a
    // jamais choisies (mort définitive, tavernes coupées). Les runs sauvées depuis sont
    // laissées telles quelles, simplement bornées.
    s.run.ascension = s.version < RUN_VERSION
      ? 0
      : Math.max(0, Math.min(s.run.ascension ?? 0, ASCENSION_MAX));
    s.run.philtres = s.run.philtres ?? 0; // rétro-compat : saves d'avant les philtres
    s.run.trancheId = s.run.trancheId ?? "t1"; // rétro-compat : saves d'avant le multi-tranches
    // rétro-compat : ancien champ scalaire eliteModif → tableau eliteModifs
    for (const n of s.run.carte?.noeuds ?? []) {
      const legacy = (n as { eliteModif?: string }).eliteModif;
      if (legacy && !n.eliteModifs) n.eliteModifs = [legacy];
    }
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
  { id: "quatre_par_quatre", nom: "Quatre par quatre", desc: "Finir une run avec 4 héros entièrement équipés.",
    cond: (c) => !!c.run && c.run.persos.length === 4 &&
      c.run.persos.every((p) => (["arme", "coiffe", "cape", "anneau"] as const).every((s) => p.equipement[s])) },
  { id: "asc_difficile", nom: "Difficile", desc: "Vaincre la tranche en Difficile (★★).",
    cond: (c) => c.victoire === true && (c.run?.ascension ?? 0) >= 1 },
  { id: "asc_extreme", nom: "Extrême", desc: "Vaincre la tranche en Extrême (★★★).",
    cond: (c) => c.victoire === true && (c.run?.ascension ?? 0) >= 2 },
  { id: "asc_cauchemar", nom: "Cauchemar", desc: "Vaincre la tranche en Cauchemar (★★★★).",
    cond: (c) => c.victoire === true && (c.run?.ascension ?? 0) >= 3 },
  { id: "asc_ultime", nom: "Ultime", desc: "Vaincre la tranche en Ultime (★★★★★) — le sommet.",
    cond: (c) => c.victoire === true && (c.run?.ascension ?? 0) >= ASCENSION_MAX },
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
/** Toile (1-based) d'une zone — numérotation continue entre tranches ; 1 par défaut. */
export function toileDeZone(zoneId: string, tranches: TrancheDef[] = TRANCHES): number {
  const loc = localiserZone(zoneId, tranches);
  return loc ? offsetToile(loc.tranche.id, tranches) + loc.index + 1 : 1;
}

/** Toile d'origine d'un objet (pool de toile) — parcourt TOUTES les tranches,
 *  numérotation continue ; 1 par défaut si l'objet n'est trouvé nulle part. */
export function toileDeItem(itemId: string, tranches: TrancheDef[] = TRANCHES): number {
  for (const tranche of tranches) {
    for (let i = 0; i < tranche.zones.length; i++) {
      if (itemsDeToile(butinToile(tranche.zones[i])).includes(itemId)) {
        return offsetToile(tranche.id, tranches) + i + 1;
      }
    }
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
  const loc = localiserZone(zoneId);
  const zones = loc ? loc.tranche.zones : TRANCHES[0].zones;
  const idx = loc ? loc.index : 0; // index DANS SA TRANCHE (l'ancien code lisait toile-1)
  const tout = (z?: string) => itemsDeToile(z ? butinToile(z) : null);
  const poolCourante = tout(zones[idx]);
  const poolSuivante = tout(zones[idx + 1]);
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

// --- Forgemagie ------------------------------------------------------------------
/** Palier de rareté SUIVANT réellement défini sur l'objet (null si au max / non forgeable). */
export function rareteSuivante(inst: ItemInstance): Rarete | null {
  const tiers = ITEMS[inst.id]?.tiers;
  if (!tiers || !inst.rarete) return null; // pas d'objet à rareté / instance sans rareté : non forgeable
  for (let i = RARETES.indexOf(inst.rarete) + 1; i < RARETES.length; i++) {
    if (tiers[RARETES[i]]) return RARETES[i];
  }
  return null;
}

/** Coût de la forge vers le palier suivant (prix HDV du palier CIBLE × coef). */
export function coutForge(inst: ItemInstance, temeraire = false): number | null {
  const cible = rareteSuivante(inst);
  if (!cible) return null;
  const coef = temeraire ? KAMAS.forgeTemeraire.coef : KAMAS.forgeCoef;
  return Math.round(prixAchat({ ...inst, rarete: cible }) * coef);
}

/** Forge un exemplaire vers son palier suivant. Mutation EN PLACE : l'exemplaire
 *  peut être dans l'inventaire OU équipé, la référence reste valide.
 *  Renvoie "forge" (réussi), "echec" (téméraire raté : kamas perdus, objet intact)
 *  ou null (non forgeable / kamas insuffisants — rien n'est débité). */
export function forgerInstance(run: RunState, inst: ItemInstance, temeraire: boolean, rng: () => number): "forge" | "echec" | null {
  const cible = rareteSuivante(inst);
  const cout = coutForge(inst, temeraire);
  if (!cible || cout === null || run.kamas < cout) return null;
  run.kamas -= cout;
  if (temeraire && rng() < KAMAS.forgeTemeraire.pEchec) return "echec";
  const forge = instanceDuTier(inst.id, cible)!;
  inst.rarete = forge.rarete;
  inst.stats = forge.stats;
  inst.adaptatif = forge.adaptatif;
  inst.resistances = forge.resistances;
  inst.pa = forge.pa;
  return "forge";
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
      // rétro-compat : les vieux saves n'ont ni compteurs ni archis ni ascension.
      // `Meta.ascension` n'existe que depuis le mode Ascension, or c'est lui qui
      // prouve le clear d'une tranche (et déverrouille la suivante) : une save
      // qui a remporté la T1 AVANT cette fonctionnalité ne porte que `victoires`.
      // On lui crédite donc un clear de t1 en A0 — seule tranche qui existait.
      const ascension = m.ascension ?? ((m.victoires ?? 0) > 0 ? { t1: 0 } : undefined);
      // Refonte de l'Ascension : l'échelle est passée de 9 valeurs (nombre de paliers
      // appliqués, 0-8) à 5 crans (index, 0-4). On ne convertit pas — TOUT LE MONDE
      // REPART À ZÉRO et refait l'échelle sur la nouvelle grille.
      //
      // La clé de tranche est conservée, remise à 0, JAMAIS supprimée : c'est elle qui
      // prouve le clear d'une tranche et déverrouille la suivante (`trancheDeverrouillee`
      // teste seulement qu'elle est définie). L'effacer reverrouillerait T2 chez quelqu'un
      // qui a bel et bien fini T1.
      //
      // Passage UNIQUE, gardé par `version` : sans ce garde, chaque chargement effacerait
      // la progression de la session précédente, indéfiniment. Seuil FIGÉ à 2 (version de
      // la refonte de l'Ascension) : quelqu'un déjà en version 2 ne doit pas revoir ses
      // records remis à zéro simplement parce que META_VERSION a depuis grimpé à 3.
      const aMigrerAscension = (m.version ?? 0) < 2;
      const ascensionFinale = ascension && (aMigrerAscension
        ? Object.fromEntries(Object.keys(ascension).map((t) => [t, 0]))
        : ascension);
      // Les reliques sont passées d'une liste d'identifiants à une liste d'exemplaires
      // (le Kalyptus porte un jet). Une sauvegarde antérieure ne contient que des chaînes.
      const dofusBrut = (m.dofus ?? []) as unknown[];
      const dofus: DofusInstance[] = dofusBrut.map((d) =>
        typeof d === "string" ? { id: d } : (d as DofusInstance));
      return { version: META_VERSION, dofus, archis: m.archis ?? [], runs: m.runs ?? 0, victoires: m.victoires ?? 0, succes: m.succes ?? [], collection: m.collection ?? {}, ascension: ascensionFinale };
    }
  } catch {
    /* localStorage indisponible : on reste en mémoire */
  }
  return { version: META_VERSION, dofus: [], archis: [], runs: 0, victoires: 0, succes: [], collection: {} };
}

export function sauverMeta(meta: Meta): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function ajouterDofus(meta: Meta, id: string, jet?: number): void {
  meta.dofus.push(jet === undefined ? { id } : { id, jet });
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

/** % de soin de taverne effectif au palier donné. */
export function tavernePctAscension(palier: number): number {
  return effetsAscension(palier).tavernePct ?? TAVERNE_PCT;
}
/** Chance de drop de Dofus par boss au palier donné (+1 %/palier). Écrêté comme
 *  `effetsAscension` : une sauvegarde de l'ancienne échelle (0-8) ne doit jamais
 *  produire un taux au-delà de celui du dernier cran réel. */
export function tauxDofusAscension(palier: number): number {
  const i = Math.max(0, Math.min(Math.trunc(palier) || 0, ASCENSION_MAX));
  return DOFUS_DROP_RATE + 0.01 * i;
}
/** Record d'Ascension d'une tranche (undefined = jamais vaincue). */
export function recordAscension(meta: Meta, trancheId: string): number | undefined {
  return meta.ascension?.[trancheId];
}
/** Toute victoire enregistre max(record, palier) et persiste la Meta. */
export function enregistrerAscension(meta: Meta, trancheId: string, palier: number): void {
  meta.ascension = { ...(meta.ascension ?? {}), [trancheId]: Math.max(meta.ascension?.[trancheId] ?? 0, palier) };
  sauverMeta(meta);
}

/** Palier « Cauchemar » = index dans `ASCENSION`. Nommé plutôt que codé en dur à
 *  chaque lecture : le jour où un cran s'insère, la constante suit. `findIndex`
 *  renvoie -1 si l'id disparaît de la table — on refuse de laisser ce -1 vivre
 *  comme un palier valide : sans ce garde, il collisionnerait avec le -1 utilisé
 *  ailleurs comme sentinelle « jamais vaincue » et rendrait la condition triviale. */
export const PALIER_CAUCHEMAR = ASCENSION.findIndex((p) => p.id === "cauchemar");
if (PALIER_CAUCHEMAR < 0) {
  throw new Error('PALIER_CAUCHEMAR : aucun palier "cauchemar" dans ASCENSION — table incohérente.');
}

/** Nombre de tranches dont le record atteint au moins Cauchemar. Compare
 *  explicitement à `undefined` (jamais vaincue) plutôt que de replier sur -1 :
 *  un repli numérique collisionnerait avec un `PALIER_CAUCHEMAR` qui vaudrait
 *  lui-même -1 si l'id venait à manquer, rendant la condition vraie pour toute
 *  tranche jamais jouée. */
export function tranchesEnCauchemar(meta: Meta): number {
  return TRANCHES.filter((t) => {
    const record = recordAscension(meta, t.id);
    return record !== undefined && record >= PALIER_CAUCHEMAR;
  }).length;
}

/** Accorde le Dofus du Cauchemar si LES CINQ tranches déclarées sont clean en
 *  Cauchemar. Évalué sur `TRANCHES` et non sur les tranches jouables : sur les
 *  seules jouables, la relique tomberait dès le premier Cauchemar de t1 et
 *  l'intention « toutes les tranches » serait perdue pour de bon.
 *
 *  Renvoie true UNIQUEMENT au moment où elle est accordée (pour l'annonce). */
export function verifierDofusCauchemar(meta: Meta): boolean {
  if (meta.dofus.some((d) => d.id === "dofus_du_cauchemar")) return false;
  if (tranchesEnCauchemar(meta) < TRANCHES.length) return false;
  ajouterDofus(meta, "dofus_du_cauchemar"); // persiste la Meta
  return true;
}

/** Une tranche est déverrouillée si la PRÉCÉDENTE a été vaincue au moins une fois
 *  (Meta.ascension[id] n'est renseigné qu'à la victoire). t1 est toujours ouverte. */
export function trancheDeverrouillee(meta: Meta, trancheId: string): boolean {
  const idx = TRANCHES.findIndex((t) => t.id === trancheId);
  if (idx <= 0) return idx === 0;
  return recordAscension(meta, TRANCHES[idx - 1].id) !== undefined;
}

/** Jouable = déverrouillée, pourvue de zones (t3-t5 attendent leur contenu) et
 *  hors chantier (t2 a du contenu mais son équilibrage n'est pas fini). */
export function trancheJouable(meta: Meta, trancheId: string): boolean {
  const tranche = trancheDe(trancheId);
  return trancheDeverrouillee(meta, trancheId) && tranche.zones.length > 0 && !tranche.enChantier;
}

/** Identifiants des reliques possédées, sans doublon. Les exemplaires ne cumulent
 *  plus : posséder la relique suffit, la posséder trois fois n'ajoute rien. */
export function reliquesActives(meta: Meta): Set<string> {
  return new Set(meta.dofus.map((d) => d.id));
}

/** Meilleur jet possédé pour une relique à tirage. `undefined` si non possédée ou
 *  sans jet — refarmer ne peut donc qu'améliorer, jamais dégrader. */
export function meilleurJet(meta: Meta, id: string): number | undefined {
  const jets = meta.dofus.filter((d) => d.id === id && d.jet !== undefined).map((d) => d.jet!);
  return jets.length ? Math.max(...jets) : undefined;
}

// Armurerie : rang des paliers de collection, dérivé de l'ordre canonique RARETES
const RANG_COLLECTION: string[] = [...RARETES];

/** Enregistre des exemplaires obtenus dans la collection persistante (Armurerie) :
 *  on retient, par objet, la meilleure rareté jamais obtenue. */
export function enregistrerCollection(meta: Meta, insts: ItemInstance[]): void {
  if (!insts.length) return;
  const coll = (meta.collection ??= {});
  let modifie = false;
  for (const inst of insts) {
    const palier = inst.rarete;
    if (!palier) continue; // instance sans rareté (ne devrait plus exister)
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

export interface BonusEquipe {
  damageMult: number;
  paBonus: number;
  pvBonus: number;
  resAllBonus: number;
  statsElementaires: number;
  critPlat: number;
  perceResistances: number;
  prospection: number;
}

/** Bonus d'équipe issus des reliques possédées. Chaque relique compte UNE fois : les
 *  exemplaires ne cumulent plus. Les paliers du Dofus Ocre ne sont pas encore rendus
 *  ici (chantier à part). */
export function bonusEquipe(meta: Meta): BonusEquipe {
  const b: BonusEquipe = {
    damageMult: 1, paBonus: 0, pvBonus: 0, resAllBonus: 0,
    statsElementaires: 0, critPlat: 0, perceResistances: 0, prospection: 0,
  };
  for (const id of reliquesActives(meta)) {
    const d = DOFUS[id];
    if (!d) continue;
    if (d.degatsPct) b.damageMult *= 1 + d.degatsPct;
    if (d.paBonus) b.paBonus += d.paBonus;
    if (d.pvBonus) b.pvBonus += d.pvBonus;
    if (d.resAll) b.resAllBonus += d.resAll;
    if (d.statsElementaires) b.statsElementaires += d.statsElementaires;
    if (d.critPlat) b.critPlat += d.critPlat;
    if (d.perceResistances) b.perceResistances += d.perceResistances;
    if (d.prospectionJet) b.prospection += meilleurJet(meta, id) ?? 0;
  }
  return b;
}

/** Applique les bonus d'équipe (Dofus) aux combattants du joueur, à la construction
 *  du combat. Un héros MORT (0 PV) voit ses maxima montés mais reste mort — le
 *  bonus de PV du Dofawa ne ressuscite personne. */
export function appliquerBonusEquipeCombat(
  equipe: Combatant[],
  bonus: BonusEquipe,
): void {
  for (const c of equipe) {
    if (bonus.paBonus) { c.paMax += bonus.paBonus; c.paActuels = c.paMax; }
    if (bonus.pvBonus) {
      c.pvBase += bonus.pvBonus;
      c.pvMax += bonus.pvBonus;
      if (c.pvActuels > 0) c.pvActuels += bonus.pvBonus; // jamais de résurrection par le bonus
    }
    if (bonus.resAllBonus) {
      for (const el of ["terre", "feu", "eau", "air"] as Element[]) {
        c.resistances[el] = (c.resistances[el] ?? 0) + bonus.resAllBonus;
      }
    }
    if (bonus.statsElementaires) {
      c.stats = {
        ...c.stats,
        force: c.stats.force + bonus.statsElementaires,
        intelligence: c.stats.intelligence + bonus.statsElementaires,
        agilite: c.stats.agilite + bonus.statsElementaires,
        chance: (c.stats.chance ?? 0) + bonus.statsElementaires,
      };
    }
    if (bonus.critPlat) c.stats = { ...c.stats, crit: (c.stats.crit ?? 0) + bonus.critPlat };
    if (bonus.perceResistances) c.perceResistances = (c.perceResistances ?? 0) + bonus.perceResistances;
  }
}
