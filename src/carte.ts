// =============================================================================
//  carte.ts — Génération et navigation du plateau (pur, rng injecté).
// =============================================================================
import { GEN_CARTE, XP_PAR_TYPE, MODIFICATEURS_ELITE } from "./data";
import type { ZonePools } from "./data";
import type { GameMap, MapNode, NodeType } from "./types";

type Rng = () => number;

const randInt = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

/** Tire `n` éléments DISTINCTS de `arr` (sans remise), dans l'ordre du tirage. */
function tirerDistincts<T>(rng: Rng, arr: T[], n: number): T[] {
  const restants = [...arr];
  const choisis: T[] = [];
  while (choisis.length < n && restants.length) {
    choisis.push(restants.splice(Math.floor(rng() * restants.length), 1)[0]);
  }
  return choisis;
}

function pickType(rng: Rng, poids: Record<string, number>): NodeType {
  const entries = Object.entries(poids);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r < 0) return type as NodeType;
  }
  return "combat";
}

/** Renseigne combatId / xp d'un nœud selon son type, depuis les pools de la zone. */
function enrichir(rng: Rng, node: MapNode, pools: ZonePools, nbModifsElite: number): void {
  switch (node.type) {
    case "combat":
      node.combatId = pick(rng, pools.normales);
      node.xp = XP_PAR_TYPE.combat;
      break;
    case "combat_dur":
      node.combatId = pick(rng, pools.elite);
      node.xp = XP_PAR_TYPE.combat_dur;
      // connus d'avance → affichés au survol
      node.eliteModifs = tirerDistincts(rng, MODIFICATEURS_ELITE, nbModifsElite).map((m) => m.id);
      break;
    case "donjon":
      node.combatId = pools.boss;
      break;
    // taverne / otomai / zaap : pas de combatId fixe (zaap résolu à l'entrée)
  }
}

/**
 * Génère une carte en treillis de losanges façon Pokelike :
 *  - rangées ALTERNÉES en quinconce : 2 nœuds (colonnes ±0.5) puis 3 (−1, 0, +1)
 *  - arêtes = les diagonales EXACTES (|Δcolonne| = 0.5) → des losanges parfaits,
 *    les nœuds de bord d'une rangée de 3 n'ont qu'un enfant (vers le centre)
 *  - ligne 0 : 2 combats (le Départ s'ouvre en Y) ; avant-dernière : 2 nœuds
 *    qui convergent sur l'unique donjon centré
 */
function profilLargeur(rng: Rng): number[] {
  const { lignesMin, lignesMax } = GEN_CARTE;
  // nombre PAIR de lignes (donjon inclus) : l'alternance 2/3 démarre et finit à 2
  let nbLignes = randInt(rng, lignesMin, lignesMax);
  if (nbLignes % 2 !== 0) nbLignes += nbLignes < lignesMax ? 1 : -1;
  const profil: number[] = [];
  for (let l = 0; l < nbLignes - 1; l++) profil.push(l % 2 === 0 ? 2 : 3);
  profil.push(1); // donjon
  return profil;
}

/** Colonnes (centrées) d'une rangée : 2 → ±0.5 (quinconce), 3 → −1/0/+1, 1 → 0. */
const colonnesDe = (nb: number): number[] =>
  nb === 2 ? [-0.5, 0.5] : nb === 3 ? [-1, 0, 1] : [0];

export function genererCarte(
  rng: Rng, pools: ZonePools, sansNoeuds: NodeType[] = [], nbModifsElite = 1,
): GameMap {
  // types de nœuds exclus par la zone (ex. pas d'Otomai à Incarnam)
  const poids = Object.fromEntries(
    Object.entries(GEN_CARTE.poids).filter(([t]) => !sansNoeuds.includes(t as NodeType)),
  );
  const profil = profilLargeur(rng);
  const nbLignes = profil.length;
  const lignes: MapNode[][] = [];

  for (let l = 0; l < nbLignes; l++) {
    const cols = colonnesDe(profil[l]);
    const ligne: MapNode[] = [];
    cols.forEach((colonne, c) => {
      const type: NodeType =
        l === 0 ? "combat" : l === nbLignes - 1 ? "donjon" : pickType(rng, poids);
      const node: MapNode = { id: `n${l}_${c}`, type, ligne: l, colonne, suivants: [] };
      enrichir(rng, node, pools, nbModifsElite);
      ligne.push(node);
    });
    lignes.push(ligne);
  }

  // --- Arêtes : uniquement les diagonales exactes du treillis (|Δcol| = 0.5) ---
  for (let l = 0; l < nbLignes - 1; l++) {
    for (const node of lignes[l]) {
      node.suivants = lignes[l + 1]
        .filter((n) => Math.abs(n.colonne - node.colonne) === 0.5)
        .map((n) => n.id);
    }
  }

  const noeuds = lignes.flat();
  return { noeuds, courant: null, depart: lignes[0].map((n) => n.id) };
}

// --- Navigation --------------------------------------------------------------
export const noeud = (carte: GameMap, id: string): MapNode | undefined =>
  carte.noeuds.find((n) => n.id === id);

/** Nœuds que le joueur peut choisir maintenant. */
export function atteignables(carte: GameMap): MapNode[] {
  const ids =
    carte.courant === null ? carte.depart : (noeud(carte, carte.courant)?.suivants ?? []);
  return ids.map((id) => noeud(carte, id)).filter((n): n is MapNode => n !== undefined);
}
