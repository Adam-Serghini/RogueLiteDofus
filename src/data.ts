// =============================================================================
//  data.ts — Données du jeu (data-driven)
//  Classes, sorts, monstres et séquence de la run. Aucune logique ici.
// =============================================================================
import type { Classe, Item, Monstre, Rarete, Spell } from "./types";
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

// --- Équipement (objets à rareté, importés de src/content/items.json) --------
export const ITEMS: Record<string, Item> = ITEMS_TOILES;

/** Pools d'objets à rareté d'une zone, par source de drop ; null = zone inconnue (hors tranche). */
export function butinToile(zoneId: string): PoolsToile | null {
  const idx = TRANCHES[0].zones.indexOf(zoneId);
  if (idx < 0) return null;
  return BUTIN_TOILES[idx + 1] ?? null;
}

/** Tous les objets d'un pool de toile, sources confondues (normales + élite + boss). */
export function itemsDeToile(pools: PoolsToile | null): string[] {
  return pools ? [...pools.normales, ...pools.elites, ...pools.boss] : [];
}

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
