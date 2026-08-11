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
  // --- bonus chiffrés, repliés dans le combattant à la construction du combat ---
  degatsPct?: number; // dégâts finaux (multiplicatif) — 0.01 = +1 %
  resAll?: number; // résistance à tous les éléments — 0.05 = +5 %
  critPlat?: number; // taux de critique, en POINTS de pourcentage (la formule divise par 100)
  perceResistances?: number; // FRACTION de la résistance ignorée — 0.05 = 5 % de la résistance
  statsElementaires?: number; // +N sur force, intelligence, agilité et chance
  pvBonus?: number; // PV max plats
  paBonus?: number; // PA
  prospectionJet?: [number, number]; // bornes du tirage, pour les reliques à jet
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
  dofus_pourpre: { desc: "+6 en force, intelligence, agilité et chance.", statsElementaires: 6 },
  dolmanax: { desc: "+10 en force, intelligence, agilité et chance.", statsElementaires: 10 },
  dofus_ivoire: { desc: "+5 % de résistance dans chaque élément.", resAll: 0.05 },
  dofus_ebene: { desc: "+1 % de dégâts finaux.", degatsPct: 0.01 },
  dofus_turquoise: { desc: "+10 % de chance de coup critique.", critPlat: 10 },
  dofus_des_glaces: { desc: "Les dégâts ignorent 5 % des résistances ennemies.", perceResistances: 0.05 },
  dofawa: { desc: "+1 PV max.", pvBonus: 1 },
  dofus_kaliptus: { desc: "+1 à 30 en prospection, selon le meilleur exemplaire obtenu.", prospectionJet: [1, 30] },
  dofus_argente: { desc: "Une fois par combat, sous 20 % de ses PV, soigne de 20 % des PV max au début du tour suivant." },
  dofus_argente_scintillant: { desc: "Une fois par combat, sous 20 % de ses PV, soigne de 20 % des PV max au début du tour suivant. +10 % de dégâts finaux.", degatsPct: 0.10 },
  dokoko: { desc: "Un tour sur deux, soigne de 10 % des PV max en début de tour." },
  dofus_nebuleux: { desc: "+5 % de dégâts finaux les tours pairs, −5 % les tours impairs." },
  dofus_ocre: { desc: "+1 PA à toute l'équipe, une fois tous les archimonstres capturés.", paBonus: 1 },
};

export const DOFUS: Record<string, DofusDef> = Object.fromEntries(
  CATALOGUE_DOFUS.map(([id, nom]) => {
    const eff = DOFUS_EFFETS[id];
    return [
      id,
      {
        id, nom,
        desc: eff?.desc ?? "Relique légendaire — effet à venir.",
        ...(eff?.degatsPct !== undefined ? { degatsPct: eff.degatsPct } : {}),
        ...(eff?.resAll !== undefined ? { resAll: eff.resAll } : {}),
        ...(eff?.critPlat !== undefined ? { critPlat: eff.critPlat } : {}),
        ...(eff?.perceResistances !== undefined ? { perceResistances: eff.perceResistances } : {}),
        ...(eff?.statsElementaires !== undefined ? { statsElementaires: eff.statsElementaires } : {}),
        ...(eff?.pvBonus !== undefined ? { pvBonus: eff.pvBonus } : {}),
        ...(eff?.paBonus !== undefined ? { paBonus: eff.paBonus } : {}),
        ...(eff?.prospectionJet !== undefined ? { prospectionJet: eff.prospectionJet } : {}),
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
export interface ZonePools { normales: string[]; elite: string[]; boss: string[]; }
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
  { id: "clos_des_blops", nom: "Clos des Blops" },
  { id: "cale_de_l_arche", nom: "Cale de l'Arche d'Otomaï" },
  { id: "gelaxieme_dimension", nom: "Gelaxième Dimension" },
  { id: "laboratoire_brumen", nom: "Laboratoire de Brumen Tinctorias" },
  { id: "terrier_wa_wabbit", nom: "Terrier du Wa Wabbit" },
  { id: "pitons_rocheux", nom: "Pitons Rocheux des Craqueleurs" },
  { id: "bateau_du_chouque", nom: "Bateau du Chouque & Village Kanniboul" },
  { id: "antre_dragon_cochon", nom: "Antre du Dragon Cochon" },
  { id: "repaire_kharnozor", nom: "Repaire du Kharnozor & Épreuve de Draegnerys" },
  { id: "taniere_meulou", nom: "Tanière du Meulou" },
  { id: "domaine_ancestral", nom: "Domaine Ancestral & Antre de la Reine Nyée" },
  { id: "arbre_de_moon", nom: "Arbre de Moon" },
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
  /** Tranche dont le contenu existe mais dont l'équilibrage n'est pas terminé :
   *  elle reste visible, déverrouillable et mesurée par `npm run sim`, mais ne
   *  peut pas être lancée (l'accueil l'affiche « en construction »). Retirer le
   *  drapeau suffit à l'ouvrir, sans autre changement. */
  enChantier?: boolean;
  /** Multiplicateur d'XP de la tranche — compense la croissance linéaire de
   *  `xpRequis` (le multiplicateur de toile, lui, ne croît que de 0,3/toile) ;
   *  absent = 1. NE PAS le mettre sur t1 : son absence garantit que la
   *  tranche 1, éprouvée en jeu réel, ne bouge pas. */
  xpMult?: number;
}

export const TRANCHES: TrancheDef[] = [
  { id: "t1", nom: "Tranche 1", niveaux: [1, 50],
    // ordre de jeu = niveau officiel des donjons (cf. PLAN-CONTENU.md §4)
    zones: ["incarnam", "astrub", "tainela", "tofus", "akademie", "kankreblath",
      "maison_fantome", "scarafeuilles", "forgerons", "larves", "grotte_hesque", "kwakwa"] },
  { id: "t2", nom: "Tranche 2", niveaux: [50, 100], xpMult: 1.35, enChantier: true, zones: ["clos_des_blops", "cale_de_l_arche", "gelaxieme_dimension", "laboratoire_brumen", "terrier_wa_wabbit", "pitons_rocheux", "bateau_du_chouque", "antre_dragon_cochon", "repaire_kharnozor", "taniere_meulou", "domaine_ancestral", "arbre_de_moon"] },
  { id: "t3", nom: "Tranche 3", niveaux: [100, 150], zones: [] },
  { id: "t4", nom: "Tranche 4", niveaux: [150, 199], zones: [] },
  { id: "t5", nom: "Tranche 5", niveaux: [200, 200], zones: [] },
];

/** Zones (dans l'ordre de jeu) d'une tranche. */
export function zonesDeTranche(tranche: TrancheDef): ZoneDef[] {
  return tranche.zones.map((id) => ZONES.find((z) => z.id === id)!);
}

/** Tranche par id — t1 par défaut si l'id est inconnu (rétro-compat des saves). */
export function trancheDe(trancheId: string, tranches: TrancheDef[] = TRANCHES): TrancheDef {
  return tranches.find((t) => t.id === trancheId) ?? tranches[0];
}

/** Localise une zone : sa tranche et son index (0-based) dans l'ordre de jeu. */
export function localiserZone(
  zoneId: string,
  tranches: TrancheDef[] = TRANCHES,
): { tranche: TrancheDef; index: number } | null {
  for (const tranche of tranches) {
    const index = tranche.zones.indexOf(zoneId);
    if (index >= 0) return { tranche, index };
  }
  return null;
}

/** Toiles consommées par les tranches PRÉCÉDENTES (t1 → 0, t2 → 12) : la
 *  numérotation des toiles est continue d'une tranche à l'autre. */
export function offsetToile(trancheId: string, tranches: TrancheDef[] = TRANCHES): number {
  let total = 0;
  for (const t of tranches) {
    if (t.id === trancheId) return total;
    total += t.zones.length;
  }
  return 0;
}

/** Récompense d'XP par type de nœud de combat (tunable), multipliée par
 *  1 + XP_PAR_TOILE × (toile − 1) : calibrée pour finir la tranche ~niveau 50. */
export const XP_PAR_TYPE = { combat: 110, combat_dur: 195 } as const;
export const XP_PAR_TOILE = 0.3;

/** XP réellement accordée pour un gain de base à une toile donnée, dans une
 *  tranche donnée : applique le multiplicateur de toile puis le multiplicateur
 *  d'XP éventuel de la tranche (`TrancheDef.xpMult`, absent = 1). Fonction pure,
 *  partagée par le jeu (`main.ts`) et le banc d'équilibrage (`sim.ts`). */
export function xpEffective(xpBase: number, toile: number, trancheId: string): number {
  const mult = 1 + XP_PAR_TOILE * (toile - 1);
  return Math.round(xpBase * mult * (trancheDe(trancheId).xpMult ?? 1));
}

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
  const loc = localiserZone(zoneId);
  if (!loc) return null;
  return BUTIN_TOILES[offsetToile(loc.tranche.id) + loc.index + 1] ?? null;
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
  chance: 0.008, // probabilité de BASE par ennemi
  philtre: 0.004, // bonus par philtre d'Otomai bu (cf. chanceArchi — nerf : +0,8 %/philtre laissait finir la run à ~10 %)
  /** Nombre de philtres au-delà duquel boire n'apporte plus rien. Sans ce plafond,
   *  un joueur qui détourne son chemin vers chaque Otomai en ramassait ~11 par run
   *  (mesuré) et finissait à 5,2 % par ennemi, soit ~8 archis par run : le bestiaire
   *  se remplissait en quelques runs alors que les paliers du Dofus Ocre visent le
   *  long terme. Plafonné, l'Otomai cesse d'être un détour toujours rentable. */
  philtresMax: 4,

  pvMult: 2, // multiplicateur de PV
  statMult: 1.5, // multiplicateur des caractéristiques
};

/** Archimonstres ERRANTS : espèces qui n'appartiennent à AUCUNE zone et surgissent
 *  rarement en plus d'un pack de combat NORMAL, toujours déjà sous forme d'archi.
 *
 *  Cette dernière contrainte est structurelle et non cosmétique : soumis au tirage
 *  habituel (`chanceArchi`, 0,8 % à 2,4 %), capturer un Piou précis vaudrait
 *  P(apparition) × 1/6 × 2,4 %, soit ~0,04 % par combat même à 10 % d'apparition —
 *  autant dire jamais. Ils arrivent donc déjà mutés (cf. `appliquerErrants`).
 *
 *  `chance` est le SEUL bouton de réglage, délibérément sans levier : il ne dépend ni des
 *  philtres d'Otomai, ni de la Prospection, ni du palier d'Ascension — c'est le seul archi
 *  du jeu sur lequel le joueur n'a aucune prise, et c'est assumé. 0,5 % ≈ 0,36 Piou par run
 *  de t1 (~72 combats normaux), soit ~40 runs pour les six : la rencontre est voulue comme
 *  exceptionnelle, pas comme un objectif de collection à court terme. Aucun test ne code la
 *  valeur en dur — `errants.test.ts` la lit et vérifie un ordre de grandeur. */
export const ERRANTS: Record<string, { especes: string[]; chance: number }> = {
  t1: {
    especes: ["piou_rouge", "piou_vert", "piou_bleu", "piou_jaune", "piou_rose", "piou_violet"],
    chance: 0.005,
  },
};

// --- Ascension (difficulté opt-in — 5 crans, affichés en étoiles) ---------------
// Le palier est l'INDEX du cran (0..ASCENSION_MAX), pas un nombre de paliers
// appliqués : `effetsAscension` lit la ligne, elle ne fusionne plus rien. Chaque
// cran redéclare TOUT son tableau, en absolu — les chiffres voulus (+20/+30/+50 %
// de PV) ne sont pas une composition propre de deltas, et les écrire en facteurs
// composés coupleraient les crans entre eux.
export interface EffetsAscension {
  degatsMult?: number; // multiplicateur des dégâts infligés par le camp ennemi
  pvMult?: number; // PV des monstres
  renfortAvant?: boolean; // +1 monstre en LIGNE AVANT (combats normaux et durs)
  tavernePct?: number; // remplace TAVERNE_PCT
  mortDefinitive?: boolean; // un héros à 0 PV n'est plus relevé hors combat
  tavernesCoupeesAPlein?: boolean; // équipe au complet → plus aucune taverne
}
export interface PalierAscension { id: string; nom: string; desc: string; effets: EffetsAscension }
export const ASCENSION: PalierAscension[] = [
  { id: "normal", nom: "Normal", desc: "Le jeu de base.", effets: {} },
  { id: "difficile", nom: "Difficile",
    desc: "Monstres : +10 % de dégâts, +20 % de PV. Un monstre de plus en ligne avant.",
    effets: { degatsMult: 1.1, pvMult: 1.2, renfortAvant: true } },
  { id: "extreme", nom: "Extrême",
    desc: "Monstres : +15 % de dégâts, +30 % de PV. Un monstre de plus en ligne avant. Les tavernes ne soignent que 30 %.",
    effets: { degatsMult: 1.15, pvMult: 1.3, renfortAvant: true, tavernePct: 0.3 } },
  { id: "cauchemar", nom: "Cauchemar",
    desc: "Monstres : +30 % de dégâts, +50 % de PV. Un monstre de plus en ligne avant. Tavernes à 30 %. Un héros mort ne se relève plus : il faut le remplacer.",
    effets: { degatsMult: 1.3, pvMult: 1.5, renfortAvant: true, tavernePct: 0.3, mortDefinitive: true } },
  { id: "ultime", nom: "Ultime",
    desc: "Tout Cauchemar, et plus aucune taverne une fois l'équipe au complet.",
    effets: { degatsMult: 1.3, pvMult: 1.5, renfortAvant: true, tavernePct: 0.3, mortDefinitive: true, tavernesCoupeesAPlein: true } },
];
/** Palier maximum = INDEX du dernier cran (et NON le nombre de crans : la table
 *  compte 5 entrées, le palier va de 0 à 4). Toute borne du type
 *  `Math.min(record + 1, ASCENSION_MAX)` dépend de cette définition. */
export const ASCENSION_MAX = ASCENSION.length - 1;

/** Sous-dossier d'icône de chaque sort (rangé par classe propriétaire ; sorts de mobs → « monstres »). */
export const SORT_DOSSIER: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of Object.values(CLASSES)) for (const s of c.sorts) m[s] = c.id;
  for (const mon of Object.values(MONSTRES)) for (const s of mon.sorts) if (!(s in m)) m[s] = "monstres";
  return m;
})();

/** Espèces de monstres apparaissant dans une zone (uniques) — pour l'encyclopédie. */
export function monstresDeZone(zone: ZoneDef): string[] {
  const combatIds = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  const ids = new Set<string>();
  for (const cid of combatIds) {
    for (const e of COMBATS[cid]?.ennemis ?? []) ids.add(e.monstre);
  }
  return [...ids];
}

/** Contenu que l'éditeur peut injecter dans le moteur (banc d'essai). */
export interface ContenuEditable {
  sorts?: Record<string, Spell>;
  classes?: Record<string, Classe>;
  monstres?: Record<string, Monstre>;
  items?: Record<string, Item>;
  /** Pools de butin par toile. Injectable comme les autres : l'éditeur permet de
   *  DÉPLACER un objet d'une toile à l'autre (`editor/js/20-items.js`), et le
   *  banc d'essai choisit l'équipement du héros via `butinToile()`. Sans cette
   *  table, un objet qu'on vient de ranger en toile 5 serait mesuré à son
   *  ancienne place, en silence. */
  butin_toiles?: Record<string, PoolsToile>;
}

/** Remplace le contenu des tables du moteur par celui en cours d'édition.
 *
 *  Les tables sont mutées EN PLACE, jamais réaffectées : `combat.ts` et `run.ts`
 *  les ont importées, et remplacer la liaison ne changerait rien pour eux. C'est
 *  ce qui permet à `SORTS[piege.sortId]` (déclenchement d'un piège) et à
 *  `SORTS.aiguille` (Écho d'Aiguille) de lire les valeurs éditées, alors que ces
 *  deux lectures ne passent par aucun argument.
 *
 *  Chaque table est VIDÉE avant réassignation : un simple `Object.assign`
 *  laisserait survivre une entrée supprimée dans l'éditeur, qui continuerait
 *  d'exister pour le moteur seul. */
export function appliquerContenuEdite(contenu: ContenuEditable): void {
  const remplacer = <T>(table: Record<string, T>, source?: Record<string, T>): void => {
    if (!source) return; // table absente de l'objet : on n'y touche pas
    // `source` peut être LE MÊME objet que `table` (ex. un test qui restaure la
    // table depuis le JSON livré, importé sous le même chemin — les modules JSON
    // sont mis en cache par chemin résolu, donc les deux références coïncident) :
    // il faut donc capturer ses entrées avant de vider `table`, sous peine de
    // vider `source` en même temps et de ne plus rien avoir à réassigner.
    const entrees = Object.entries(source);
    for (const cle of Object.keys(table)) delete table[cle];
    for (const [cle, valeur] of entrees) table[cle] = valeur;
  };
  remplacer(SORTS as Record<string, Spell>, contenu.sorts);
  remplacer(CLASSES as Record<string, Classe>, contenu.classes);
  remplacer(MONSTRES as Record<string, Monstre>, contenu.monstres);
  remplacer(ITEMS as Record<string, Item>, contenu.items);
  remplacer(BUTIN_TOILES as Record<string, PoolsToile>, contenu.butin_toiles);
}
