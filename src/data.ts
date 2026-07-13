// =============================================================================
//  data.ts — Données du jeu (data-driven)
//  Classes, sorts, monstres et séquence de la run. Aucune logique ici.
// =============================================================================
import type { Classe, Item, Monstre, Panoplie, Rarete, Spell } from "./types";
import sortsJson from "./content/sorts.json";
import classesJson from "./content/classes.json";
import monstresJson from "./content/monstres.json";
import combatsJson from "./content/combats.json";
import zonesPoolsJson from "./content/zones_pools.json";
import itemsToilesJson from "./content/items.json";
import butinToilesJson from "./content/butin_toiles.json";

export const SORTS = sortsJson as unknown as Record<string, Spell>;
export const CLASSES = classesJson as unknown as Record<string, Classe>;
export const MONSTRES = monstresJson as unknown as Record<string, Monstre>;
export const COMBATS = combatsJson as unknown as Record<string, CombatDef>;
const ZONES_POOLS = zonesPoolsJson as unknown as Record<string, ZonePools>;
export interface PoolsToile { normales: string[]; elites: string[]; boss: string[] }
export const ITEMS_TOILES = itemsToilesJson as unknown as Record<string, Item>;
export const BUTIN_TOILES = butinToilesJson as unknown as Record<string, PoolsToile>;

// --- Dofus (reliques permanentes) --------------------------------------------
export interface DofusDef {
  id: string;
  nom: string;
  desc: string;
  bonusDegatsParCopie: number; // +% dégâts d'équipe par copie (Pourpre)
  vitaParCopie?: number; // +vitalité d'équipe par copie (Dofawa)
  resAllParCopie?: number; // +résistance toutes par copie (Argenté)
  maxCopies?: number; // nombre de copies max prises en compte pour l'effet
  img?: string;
}

// Catalogue complet des Dofus (assets DofusDB). L'ordre = ordre d'affichage.
// Seul le Pourpre a un effet en V0 ; les autres sont « à débloquer ».
const CATALOGUE_DOFUS: Array<[string, string]> = [
  // les six primordiaux d'abord
  ["dofus_pourpre", "Dofus Pourpre"], ["dofus_turquoise", "Dofus Turquoise"],
  ["dofus_emeraude", "Dofus Émeraude"], ["dofus_ocre", "Dofus Ocre"],
  ["dofus_ivoire", "Dofus Ivoire"], ["dofus_ebene", "Dofus Ébène"],
  // autres Dofus notables
  ["dofus_vulbis", "Dofus Vulbis"], ["dofus_abyssal", "Dofus Abyssal"],
  ["dofus_cawotte", "Dofus Cawotte"], ["dolmanax", "Dolmanax"],
  ["dofus_des_veilleurs", "Dofus des Veilleurs"], ["dofus_du_cauchemar", "Dofus du Cauchemar"],
  ["dofus_des_glaces", "Dofus des Glaces"], ["dofus_forgelave", "Dofus Forgelave"],
  ["dofus_kaliptus", "Dofus Kaliptus"], ["dofus_nebuleux", "Dofus Nébuleux"],
  ["dofus_sylvestre", "Dofus Sylvestre"], ["dofus_verdoyant", "Dofus Verdoyant"],
  ["dofus_tachete", "Dofus Tacheté"], ["dofus_argente", "Dofus Argenté"],
  ["dofus_argente_scintillant", "Dofus Argenté Scintillant"], ["dofus_cacao", "Dofus Cacao"],
  // Dofus fantaisistes
  ["dofawa", "Dofawa"], ["dofoozbz", "Dofoozbz"], ["dokille", "Dokille"],
  ["dokoko", "Dokoko"], ["dom_de_pin", "Dom de Pin"], ["domakuro", "Domakuro"],
  ["dorigami", "Dorigami"], ["dotruche", "Dotruche"], ["jyfus", "Jyfus"],
];

// Effets des Dofus dotés (les autres restent « à débloquer »).
type DofusEffet = Partial<Omit<DofusDef, "id" | "nom" | "img">>;
const DOFUS_EFFETS: Record<string, DofusEffet> = {
  dofus_pourpre: { desc: "+15 % de dégâts pour toute l'équipe (cumulable).", bonusDegatsParCopie: 0.15 },
  dofawa: { desc: "+1 Vitalité à toute l'équipe par copie (max 10).", vitaParCopie: 1, maxCopies: 10 },
  dofus_argente: { desc: "+1 % de résistance à tous les éléments par copie, pour l'équipe (max 10).", resAllParCopie: 0.01, maxCopies: 10 },
};

export const DOFUS: Record<string, DofusDef> = Object.fromEntries(
  CATALOGUE_DOFUS.map(([id, nom]) => {
    const eff = DOFUS_EFFETS[id];
    return [
      id,
      {
        id, nom,
        desc: eff?.desc ?? "Relique légendaire — effet à venir.",
        bonusDegatsParCopie: eff?.bonusDegatsParCopie ?? 0,
        vitaParCopie: eff?.vitaParCopie,
        resAllParCopie: eff?.resAllParCopie,
        maxCopies: eff?.maxCopies,
        img: `/assets/dofus/${id}.png`,
      },
    ];
  }),
);

/** Dofus → boss qui le lâche (nom + sprite), dérivé des monstres `dofus`. */
export const DOFUS_DROP: Record<string, { nom: string; img?: string }> = Object.fromEntries(
  Object.values(MONSTRES)
    .filter((m) => m.dofus)
    .map((m) => [m.dofus as string, { nom: m.nom, img: m.img }]),
);

// --- Composition des combats (séquence linéaire de la run) -------------------
// position : ordre dans la ligne ennemie (1 = devant). Recalculé à la mort.
export interface EnnemiPlace {
  monstre: string;
  position: number;
}
export interface CombatDef {
  nom: string;
  ennemis: EnnemiPlace[];
}

// --- Zones (mondes traversés successivement durant une run) ------------------
export interface ZonePools { normales: string[]; elite: string[]; boss: string; }
export interface ZoneDef {
  id: string;
  nom: string;
  pools: ZonePools;
  sansNoeuds?: string[]; // types de nœuds exclus du plateau de cette zone
}

type ZoneDefSansPools = Omit<ZoneDef, "pools">;
const ZONES_DEFS: ZoneDefSansPools[] = [
  { id: "incarnam", nom: "Incarnam",
    sansNoeuds: ["otomai", "forgemagie"] }, // pas de restat ni de forge en zone de départ (l'HDV, lui, sert à revendre)
  { id: "astrub", nom: "Champs d'Astrub" },
  { id: "tainela", nom: "Tainéla" },
  { id: "tofus", nom: "Donjon des Tofus" },
  { id: "scarafeuilles", nom: "Donjon des Scarafeuilles" },
  { id: "forgerons", nom: "Donjon des Forgerons" },
  { id: "akademie", nom: "Akadémie des Gobs" },
  { id: "kankreblath", nom: "Cache de Kankreblath" },
  { id: "maison_fantome", nom: "Maison Fantôme" },
  { id: "larves", nom: "Donjon des Larves" },
  { id: "grotte_hesque", nom: "Grotte Hesque" },
  { id: "kwakwa", nom: "Nid du Kwakwa" },
];

export const ZONES: ZoneDef[] = ZONES_DEFS.map((z) => ({ ...z, pools: ZONES_POOLS[z.id]! }));

// --- Tranches (paliers de niveau — une run = une tranche) ---------------------
// NB : les donjons ÉVÉNEMENTIELS (Nowel/Sapik, Halouine, Pwak…) sont réservés à un
// futur contenu saisonnier et ne doivent JAMAIS figurer dans les zones d'une tranche.
export interface TrancheDef {
  id: string;
  nom: string;
  niveaux: [number, number]; // fourchette de niveaux affichée (fiction Dofus)
  zones: string[]; // ids de ZONES, dans l'ordre de jeu
  active: boolean; // false = affichée verrouillée à l'accueil (pas encore jouable)
}

export const TRANCHES: TrancheDef[] = [
  { id: "t1", nom: "Tranche 1", niveaux: [1, 50], active: true,
    // ordre de jeu = niveau officiel des donjons (cf. PLAN-CONTENU.md §4)
    zones: ["incarnam", "astrub", "tainela", "tofus", "akademie", "kankreblath",
      "maison_fantome", "scarafeuilles", "forgerons", "larves", "grotte_hesque", "kwakwa"] },
  { id: "t2", nom: "Tranche 2", niveaux: [51, 100], active: false, zones: [] },
  { id: "t3", nom: "Tranche 3", niveaux: [101, 150], active: false, zones: [] },
  { id: "t4", nom: "Tranche 4", niveaux: [151, 199], active: false, zones: [] },
  { id: "t5", nom: "Tranche 5", niveaux: [200, 200], active: false, zones: [] },
];

/** Zones (dans l'ordre de jeu) de la tranche active. */
export function zonesDeTranche(tranche: TrancheDef): ZoneDef[] {
  return tranche.zones.map((id) => ZONES.find((z) => z.id === id)!);
}

/** Récompense d'XP par type de nœud de combat (tunable), multipliée par
 *  1 + XP_PAR_TOILE × (toile − 1) : calibrée pour finir la tranche ~niveau 50. */
export const XP_PAR_TYPE = { combat: 110, combat_dur: 195 } as const;
export const XP_PAR_TOILE = 0.3;

/** Fraction de PV max rendue par la Taverne. */
export const TAVERNE_PCT = 0.5;

/** Paramètres de génération de la carte (tunable). */
export const GEN_CARTE = {
  // bornes du nombre de rangées, donjon inclus (arrondi au PAIR : l'alternance
  // Pokelike 2/3 doit finir sur une rangée de 2 qui converge vers le donjon)
  lignesMin: 10,
  lignesMax: 12,
  // poids des types pour les rangées intermédiaires
  poids: { combat: 60, combat_dur: 12, taverne: 12, otomai: 8, zaap: 8, hdv: 8, forgemagie: 6 } as Record<string, number>,
};

// --- Rareté d'équipement --------------------------------------------------------
export const RARETES = ["commun", "rare", "epique", "legendaire"] as const;
export const RARETE_INFO: Record<Rarete, { nom: string; poids: number }> = {
  commun: { nom: "Commun", poids: 60 },
  rare: { nom: "Rare", poids: 25 },
  epique: { nom: "Épique", poids: 12 },
  legendaire: { nom: "Légendaire", poids: 3 },
};

// --- Équipement & panoplies --------------------------------------------------
// Stats en FOURCHETTES (rolls) tirées au drop — valeurs réelles DofusDB,
// filtrées aux stats gérées par le moteur (vita/force/int/agi/chance/prospection).
// 4 slots par perso : coiffe, cape, anneau, arme (amulette/ceinture/bottes retirés).
export const ITEMS: Record<string, Item> = {
  // ===== Panoplie de l'Aventurier (Incarnam, set #5 : +toutes carac) =====
  aventurier_coiffe: { id: "aventurier_coiffe", nom: "Chapeau de l'Aventurier", slot: "coiffe", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_cape: { id: "aventurier_cape", nom: "Cape de l'Aventurier", slot: "cape", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_anneau: { id: "aventurier_anneau", nom: "Anneau de l'Aventurier", slot: "anneau", panoplie: "aventurier", rolls: { force: [0, 2], intelligence: [0, 2], chance: [0, 2], agilite: [0, 2] } },
  aventurier_arme: { id: "aventurier_arme", nom: "Épée de l'Aventurier", slot: "arme", panoplie: "aventurier", rolls: { force: [0, 4], intelligence: [0, 4], chance: [0, 4], agilite: [0, 4] }, attaque: { coutPA: 3, baseMin: 7, baseMax: 11, scaling: 0.3 } },

  // ===== Panoplie du Paysan (Champs d'Astrub, set #47 : vita / chance) =====
  paysan_coiffe: { id: "paysan_coiffe", nom: "Bob du Paysan", slot: "coiffe", panoplie: "paysan", rolls: { vitalite: [26, 30] } },
  paysan_cape: { id: "paysan_cape", nom: "Sac du Paysan", slot: "cape", panoplie: "paysan", rolls: { chance: [16, 20] } },
  paysan_anneau: { id: "paysan_anneau", nom: "Mitaines Mitées du Paysan", slot: "anneau", panoplie: "paysan", rolls: { chance: [11, 15] } },
  paysan_arme: { id: "paysan_arme", nom: "Faux usée du Paysan", slot: "arme", panoplie: "paysan", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 3, baseMin: 9, baseMax: 14, scaling: 0.35 } },

  // ===== Panoplie du Bouftou (Tainéla, set #1 : vita/force/int) =====
  bouftou_coiffe: { id: "bouftou_coiffe", nom: "Coiffe du Bouftou", slot: "coiffe", panoplie: "bouftou", rolls: { force: [16, 20], intelligence: [16, 20] } },
  bouftou_cape: { id: "bouftou_cape", nom: "Cape Bouffante", slot: "cape", panoplie: "bouftou", rolls: { vitalite: [26, 30] } },
  bouftou_anneau: { id: "bouftou_anneau", nom: "Anneau de Bouze le Clerc", slot: "anneau", panoplie: "bouftou", rolls: { vitalite: [21, 30] } },
  bouftou_arme: { id: "bouftou_arme", nom: "Marteau du Bouftou", slot: "arme", panoplie: "bouftou", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 4, baseMin: 16, baseMax: 22, scaling: 0.45 } },

  // ===== Panoplie du Tofu (Donjon des Tofus : vita / agilité, thème Air) =====
  tofu_coiffe: { id: "tofu_coiffe", nom: "Coiffe du Tofu", slot: "coiffe", panoplie: "tofu", rolls: { vitalite: [16, 20], agilite: [16, 20] } },
  tofu_cape: { id: "tofu_cape", nom: "Cape Tofue", slot: "cape", panoplie: "tofu", rolls: { vitalite: [26, 30] } },
  tofu_anneau: { id: "tofu_anneau", nom: "Anneau du Tofu", slot: "anneau", panoplie: "tofu", rolls: { agilite: [11, 15] } },
  tofu_arme: { id: "tofu_arme", nom: "Aile du Batofu", slot: "arme", panoplie: "tofu", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 4, baseMin: 14, baseMax: 20, scaling: 0.4 } },

  // ===== Panoplie du Scarafeuille (Donjon des Scarafeuilles : défensif, résist. toutes) =====
  scarafeuille_coiffe: { id: "scarafeuille_coiffe", nom: "Coiffe du Scarafeuille", slot: "coiffe", panoplie: "scarafeuille", rolls: { vitalite: [20, 24] } },
  scarafeuille_cape: { id: "scarafeuille_cape", nom: "Élytre du Scarafeuille", slot: "cape", panoplie: "scarafeuille", rolls: { vitalite: [21, 25] } },
  scarafeuille_anneau: { id: "scarafeuille_anneau", nom: "Anneau du Scarafeuille", slot: "anneau", panoplie: "scarafeuille", rolls: { vitalite: [11, 15] } },
  scarafeuille_arme: { id: "scarafeuille_arme", nom: "Rostre du Scarabosse", slot: "arme", panoplie: "scarafeuille", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 4, baseMin: 15, baseMax: 21, scaling: 0.4 } },

  // ===== Panoplie du Forgeron (Donjon des Forgerons : force/vita + prospection au set) =====
  forgeron_coiffe: { id: "forgeron_coiffe", nom: "Heaume du Forgeron", slot: "coiffe", panoplie: "forgeron", rolls: { force: [16, 20], vitalite: [16, 20] } },
  forgeron_cape: { id: "forgeron_cape", nom: "Tablier du Forgeron", slot: "cape", panoplie: "forgeron", rolls: { vitalite: [26, 30] } },
  forgeron_anneau: { id: "forgeron_anneau", nom: "Anneau du Forgeron", slot: "anneau", panoplie: "forgeron", rolls: { vitalite: [21, 25] } },
  forgeron_arme: { id: "forgeron_arme", nom: "Marteau du Forgeron Sombre", slot: "arme", panoplie: "forgeron", rolls: { force: [11, 15] }, attaque: { coutPA: 5, baseMin: 20, baseMax: 28, scaling: 0.5 } },

  // ===== Panoplie du Gladiateur (Akadémie des Gobs : force/agi de bagarreur) =====
  gladiateur_coiffe: { id: "gladiateur_coiffe", nom: "Casque du Gladiateur", slot: "coiffe", panoplie: "gladiateur", rolls: { force: [11, 15], vitalite: [11, 15] } },
  gladiateur_cape: { id: "gladiateur_cape", nom: "Cape du Gladiateur", slot: "cape", panoplie: "gladiateur", rolls: { agilite: [11, 15], vitalite: [11, 15] } },
  gladiateur_anneau: { id: "gladiateur_anneau", nom: "Anneau du Gladiateur", slot: "anneau", panoplie: "gladiateur", rolls: { force: [8, 12], agilite: [8, 12] } },
  gladiateur_arme: { id: "gladiateur_arme", nom: "Lance du Gob-Lancier", slot: "arme", panoplie: "gladiateur", rolls: { force: [8, 12] }, attaque: { coutPA: 4, baseMin: 16, baseMax: 22, scaling: 0.42 } },

  // ===== Panoplie de Kankreblath (Cache de Kankreblath : intelligence/vita) =====
  kankreblath_coiffe: { id: "kankreblath_coiffe", nom: "Chitine de Kankreblath", slot: "coiffe", panoplie: "kankreblath", rolls: { intelligence: [12, 16], vitalite: [11, 15] } },
  kankreblath_cape: { id: "kankreblath_cape", nom: "Élytres de Kankreblath", slot: "cape", panoplie: "kankreblath", rolls: { intelligence: [11, 15], vitalite: [12, 16] } },
  kankreblath_anneau: { id: "kankreblath_anneau", nom: "Anneau grouillant", slot: "anneau", panoplie: "kankreblath", rolls: { intelligence: [11, 15] } },
  kankreblath_arme: { id: "kankreblath_arme", nom: "Dard de Kankreblath", slot: "arme", panoplie: "kankreblath", rolls: { intelligence: [8, 12] }, attaque: { coutPA: 4, baseMin: 16, baseMax: 23, scaling: 0.45 } },

  // ===== Panoplie Fantomatique (Maison Fantôme : agilité/esquive) =====
  fantome_coiffe: { id: "fantome_coiffe", nom: "Capuche Fantomatique", slot: "coiffe", panoplie: "fantome", rolls: { agilite: [12, 16], vitalite: [11, 15] } },
  fantome_cape: { id: "fantome_cape", nom: "Suaire Fantomatique", slot: "cape", panoplie: "fantome", rolls: { agilite: [12, 16], vitalite: [11, 15] } },
  fantome_anneau: { id: "fantome_anneau", nom: "Anneau Spectral", slot: "anneau", panoplie: "fantome", rolls: { agilite: [11, 15] } },
  fantome_arme: { id: "fantome_arme", nom: "Canne de Boostache", slot: "arme", panoplie: "fantome", rolls: { agilite: [8, 12] }, attaque: { coutPA: 4, baseMin: 17, baseMax: 23, scaling: 0.45 } },

  // ===== Panoplie de la Larve (Donjon des Larves : vita + résistances) =====
  larve_coiffe: { id: "larve_coiffe", nom: "Coiffe de la Larve", slot: "coiffe", panoplie: "larve", rolls: { vitalite: [24, 28] } },
  larve_cape: { id: "larve_cape", nom: "Mue de la Shin Larve", slot: "cape", panoplie: "larve", rolls: { vitalite: [26, 30] } },
  larve_anneau: { id: "larve_anneau", nom: "Anneau Larvesque", slot: "anneau", panoplie: "larve", rolls: { vitalite: [16, 20], chance: [8, 12] } },
  larve_arme: { id: "larve_arme", nom: "Dard de la Shin Larve", slot: "arme", panoplie: "larve", rolls: { chance: [11, 15] }, attaque: { coutPA: 5, baseMin: 21, baseMax: 29, scaling: 0.5 } },

  // ===== Panoplie du Corailleur (Grotte Hesque : chance/eau, 2e set Eau après le Paysan) =====
  corailleur_coiffe: { id: "corailleur_coiffe", nom: "Coiffe de Corail", slot: "coiffe", panoplie: "corailleur", rolls: { chance: [14, 18], vitalite: [12, 16] } },
  corailleur_cape: { id: "corailleur_cape", nom: "Cape Récifale", slot: "cape", panoplie: "corailleur", rolls: { chance: [12, 16], vitalite: [14, 18] } },
  corailleur_anneau: { id: "corailleur_anneau", nom: "Anneau de Nacre", slot: "anneau", panoplie: "corailleur", rolls: { chance: [12, 16] } },
  corailleur_arme: { id: "corailleur_arme", nom: "Rostre du Magistral", slot: "arme", panoplie: "corailleur", rolls: { chance: [8, 12] }, attaque: { coutPA: 5, baseMin: 22, baseMax: 31, scaling: 0.52 } },

  // ===== Panoplie du Kwak (Nid du Kwakwa : toutes carac — meilleur set de la T1) =====
  kwak_coiffe: { id: "kwak_coiffe", nom: "Coiffe du Kwak", slot: "coiffe", panoplie: "kwak", rolls: { force: [8, 13], intelligence: [8, 13], agilite: [8, 13], chance: [8, 13] } },
  kwak_cape: { id: "kwak_cape", nom: "Cape du Kwak", slot: "cape", panoplie: "kwak", rolls: { force: [8, 13], intelligence: [8, 13], agilite: [8, 13], chance: [8, 13], vitalite: [11, 15] } },
  kwak_anneau: { id: "kwak_anneau", nom: "Anneau du Kwak", slot: "anneau", panoplie: "kwak", rolls: { force: [6, 10], intelligence: [6, 10], agilite: [6, 10], chance: [6, 10] } },
  kwak_arme: { id: "kwak_arme", nom: "Bec du Kwakwa", slot: "arme", panoplie: "kwak", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 5, baseMin: 24, baseMax: 33, scaling: 0.55 } },
};
// objets à rareté (générés depuis scripts/items.csv — voir import-items.mjs)
Object.assign(ITEMS, ITEMS_TOILES);

/** Pools d'objets à rareté d'une zone, par source de drop ; null = zone legacy. */
export function butinToile(zoneId: string): PoolsToile | null {
  const idx = TRANCHES[0].zones.indexOf(zoneId);
  if (idx < 0) return null;
  return BUTIN_TOILES[idx + 1] ?? null;
}

/** Tous les objets d'un pool de toile, sources confondues (normales + élite + boss). */
export function itemsDeToile(pools: PoolsToile | null): string[] {
  return pools ? [...pools.normales, ...pools.elites, ...pools.boss] : [];
}

// Sets de 4 pièces : bonus à 2/4 (moitié / complet).
export const PANOPLIES: Record<string, Panoplie> = {
  aventurier: {
    id: "aventurier", nom: "Panoplie de l'Aventurier",
    pieces: ["aventurier_coiffe", "aventurier_cape", "aventurier_anneau", "aventurier_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 10 } },
      { seuil: 4, stats: { vitalite: 15 }, resistances: { terre: 0.05, feu: 0.05, eau: 0.05, air: 0.05 } },
    ],
  },
  paysan: {
    id: "paysan", nom: "Panoplie du Paysan",
    pieces: ["paysan_coiffe", "paysan_cape", "paysan_anneau", "paysan_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 12, chance: 8 } },
      { seuil: 4, stats: { vitalite: 18, prospection: 30 } },
    ],
  },
  bouftou: {
    id: "bouftou", nom: "Panoplie du Bouftou",
    pieces: ["bouftou_coiffe", "bouftou_cape", "bouftou_anneau", "bouftou_arme"],
    bonus: [
      { seuil: 2, stats: { force: 12 }, pvBonus: 15 },
      { seuil: 4, stats: { force: 22 }, resistances: { terre: 0.12 } },
    ],
  },
  tofu: {
    id: "tofu", nom: "Panoplie du Tofu",
    pieces: ["tofu_coiffe", "tofu_cape", "tofu_anneau", "tofu_arme"],
    bonus: [
      { seuil: 2, stats: { agilite: 12 }, pvBonus: 12 },
      { seuil: 4, stats: { agilite: 22 }, resistances: { air: 0.12 } },
    ],
  },
  scarafeuille: {
    id: "scarafeuille", nom: "Panoplie du Scarafeuille",
    pieces: ["scarafeuille_coiffe", "scarafeuille_cape", "scarafeuille_anneau", "scarafeuille_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 12 }, resistances: { terre: 0.04, feu: 0.04, eau: 0.04, air: 0.04 } },
      { seuil: 4, pvBonus: 20, resistances: { terre: 0.06, feu: 0.06, eau: 0.06, air: 0.06 } },
    ],
  },
  forgeron: {
    id: "forgeron", nom: "Panoplie du Forgeron",
    pieces: ["forgeron_coiffe", "forgeron_cape", "forgeron_anneau", "forgeron_arme"],
    bonus: [
      { seuil: 2, stats: { force: 12 }, pvBonus: 15 },
      { seuil: 4, stats: { force: 18, prospection: 40 } },
    ],
  },
  gladiateur: {
    id: "gladiateur", nom: "Panoplie du Gladiateur",
    pieces: ["gladiateur_coiffe", "gladiateur_cape", "gladiateur_anneau", "gladiateur_arme"],
    bonus: [
      { seuil: 2, stats: { force: 8, agilite: 8 } },
      { seuil: 4, stats: { force: 14, agilite: 14 }, pvBonus: 15 },
    ],
  },
  kankreblath: {
    id: "kankreblath", nom: "Panoplie de Kankreblath",
    pieces: ["kankreblath_coiffe", "kankreblath_cape", "kankreblath_anneau", "kankreblath_arme"],
    bonus: [
      { seuil: 2, stats: { intelligence: 10 }, pvBonus: 10 },
      { seuil: 4, stats: { intelligence: 20 }, resistances: { feu: 0.1 } },
    ],
  },
  fantome: {
    id: "fantome", nom: "Panoplie Fantomatique",
    pieces: ["fantome_coiffe", "fantome_cape", "fantome_anneau", "fantome_arme"],
    bonus: [
      { seuil: 2, stats: { agilite: 10 }, pvBonus: 10 },
      { seuil: 4, stats: { agilite: 20 }, resistances: { air: 0.1 } },
    ],
  },
  larve: {
    id: "larve", nom: "Panoplie de la Larve",
    pieces: ["larve_coiffe", "larve_cape", "larve_anneau", "larve_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 14 }, resistances: { terre: 0.04, feu: 0.04, eau: 0.04, air: 0.04 } },
      { seuil: 4, pvBonus: 25, resistances: { terre: 0.07, feu: 0.07, eau: 0.07, air: 0.07 } },
    ],
  },
  corailleur: {
    id: "corailleur", nom: "Panoplie du Corailleur",
    pieces: ["corailleur_coiffe", "corailleur_cape", "corailleur_anneau", "corailleur_arme"],
    bonus: [
      { seuil: 2, stats: { chance: 12 }, pvBonus: 12 },
      { seuil: 4, stats: { chance: 20 }, resistances: { eau: 0.12 } },
    ],
  },
  kwak: {
    id: "kwak", nom: "Panoplie du Kwak",
    pieces: ["kwak_coiffe", "kwak_cape", "kwak_anneau", "kwak_arme"],
    bonus: [
      { seuil: 2, stats: { force: 8, intelligence: 8, agilite: 8, chance: 8 } },
      { seuil: 4, stats: { force: 14, intelligence: 14, agilite: 14, chance: 14 }, resistances: { terre: 0.06, feu: 0.06, eau: 0.06, air: 0.06 } },
    ],
  },
};

/** Panoplie qui droppe dans chaque zone (id de zone → id de panoplie). */
export const BUTIN_ZONE: Record<string, string> = {
  incarnam: "aventurier",
  astrub: "paysan",
  tainela: "bouftou",
  tofus: "tofu",
  scarafeuilles: "scarafeuille",
  forgerons: "forgeron",
  akademie: "gladiateur",
  kankreblath: "kankreblath",
  maison_fantome: "fantome",
  larves: "larve",
  grotte_hesque: "corailleur",
  kwakwa: "kwak",
};

// --- Kamas & Hôtel de vente ------------------------------------------------------
/** Économie (par run — les kamas meurent avec l'équipe). Tunable. */
export const KAMAS = {
  // gain par victoire, selon le type de nœud, × (1 + parToile × (toile-1))
  gain: { combat: 15, combat_dur: 30, donjon: 60 } as Record<string, number>,
  gainParToile: 0.3,
  // prix d'achat HDV par rareté, × (1 + prixParToile × (toile-1))
  prix: { commun: 40, rare: 90, epique: 200, legendaire: 450 } as Record<Rarete, number>,
  prixParToile: 0.3,
  tauxRevente: 0.5, // revente = 50 % du prix d'achat
  tailleStock: 5, // objets proposés par visite d'HDV
  // Forgemagie : monter un objet au palier de rareté suivant.
  // coût = prix HDV du palier CIBLE × coef (on possède déjà la base)
  forgeCoef: 0.6,
  forgeTemeraire: { coef: 0.3, pEchec: 0.3 }, // le Forgemage téméraire : moitié prix, 30 % d'échec (kamas perdus, objet intact)
};

/** Taux de drop par victoire et par pièce éligible (tunable). */
export const DROP = {
  taux: { combat: 0.2, combat_dur: 0.32, donjon: 0.5 } as Record<string, number>,
  coefProspection: 0.001, // dropChance ×= 1 + min(cap, prospectionÉquipe × coef)
  capProspection: 0.75,
};

/** Chance qu'un boss de zone lâche son Dofus (tunable). */
export const DOFUS_DROP_RATE = 0.01;

// --- Modificateurs d'élites (cases « combat dur ») ------------------------------
/** Chaque combat dur tire un modificateur : toute la meute est boostée, et la
 *  récompense grimpe (butin au taux donjon). Appliqué par appliquerModificateurElite. */
export interface ModificateurElite {
  id: string;
  nom: string; // suffixe du titre de la rencontre
  desc: string;
  statMult?: number; // multiplie les stats OFFENSIVES (pas la vitalité)
  pvMult?: number;
  resAll?: number;
  initBonus?: number;
  paBonus?: number;
}
export const MODIFICATEURS_ELITE: ModificateurElite[] = [
  { id: "enrage", nom: "Enragés", desc: "+20 % aux caractéristiques offensives", statMult: 1.2 },
  { id: "cuirasse", nom: "Cuirassés", desc: "+20 % de PV et +5 % de résistances", pvMult: 1.2, resAll: 0.05 },
  { id: "veloce", nom: "Véloces", desc: "+4 d'initiative et +1 PA", initBonus: 4, paBonus: 1 },
];

// --- Archimonstres & Dofus Ocre ----------------------------------------------
/** Paramètres des Archimonstres (variante rare et boostée, capturable). */
export const ARCHI = {
  chance: 0.01, // probabilité par ennemi d'apparaître en Archimonstre

  pvMult: 2, // multiplicateur de PV
  statMult: 1.5, // multiplicateur des caractéristiques
};

/** Paliers du Dofus Ocre : tous les 50 archis (valeur TOTALE du Dofus à ce palier). */
export interface OcrePalier { seuil: number; paBonus: number; degats: number }
export const OCRE_PALIERS: OcrePalier[] = [
  { seuil: 50, paBonus: 1, degats: 0 },
  { seuil: 100, paBonus: 2, degats: 0.1 },
  { seuil: 150, paBonus: 2, degats: 0.2 },
  { seuil: 200, paBonus: 3, degats: 0.2 },
  { seuil: 250, paBonus: 3, degats: 0.3 },
];

/** Sous-dossier d'icône de chaque sort (rangé par classe propriétaire ; sorts de mobs → « monstres »). */
export const SORT_DOSSIER: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of Object.values(CLASSES)) for (const s of c.sorts) m[s] = c.id;
  for (const mon of Object.values(MONSTRES)) for (const s of mon.sorts) if (!(s in m)) m[s] = "monstres";
  return m;
})();

/** Espèces de monstres apparaissant dans une zone (uniques) — pour l'encyclopédie. */
export function monstresDeZone(zone: ZoneDef): string[] {
  const combatIds = [...zone.pools.normales, ...zone.pools.elite, zone.pools.boss];
  const ids = new Set<string>();
  for (const cid of combatIds) {
    for (const e of COMBATS[cid]?.ennemis ?? []) ids.add(e.monstre);
  }
  return [...ids];
}
