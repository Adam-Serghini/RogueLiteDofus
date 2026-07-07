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
function enrichir(rng: Rng, node: MapNode, pools: ZonePools): void {
  switch (node.type) {
    case "combat":
      node.combatId = pick(rng, pools.normales);
      node.xp = XP_PAR_TYPE.combat;
      break;
    case "combat_dur":
      node.combatId = pick(rng, pools.elite);
      node.xp = XP_PAR_TYPE.combat_dur;
      node.eliteModif = pick(rng, MODIFICATEURS_ELITE).id; // connu d'avance → affiché au survol
      break;
    case "donjon":
      node.combatId = pools.boss;
      break;
    // taverne / otomai / zaap : pas de combatId fixe (zaap résolu à l'entrée)
  }
}

/**
 * Génère une carte en grille de losanges (façon Pokelike) :
 *  - profil de largeur : monte 2→largeurMax, plateau, puis redescend →1 (donjon)
 *  - `colonne` = offset CENTRÉ autour de 0 (rangées décalées « en brique »)
 *  - arêtes : chaque nœud relie ses 2 diagonales (bas-gauche + bas-droite) → 2
 *    enfants, SAUF les nœuds de bord qui n'en ont qu'une (1 enfant)
 *  - ligne 0 : combats ; dernière ligne : un unique donjon centré
 */
function profilLargeur(rng: Rng): number[] {
  const { largeurMax: W, lignesMin, lignesMax } = GEN_CARTE;
  const nbLignes = randInt(rng, lignesMin, lignesMax);
  const montee: number[] = []; // 2, 3, …, W
  for (let k = 2; k <= W; k++) montee.push(k);
  const descente: number[] = []; // W-1, …, 1 (donjon)
  for (let k = W - 1; k >= 1; k--) descente.push(k);
  const plateau = Math.max(0, nbLignes - montee.length - descente.length);
  return [...montee, ...Array(plateau).fill(W), ...descente];
}

export function genererCarte(rng: Rng, pools: ZonePools, sansNoeuds: NodeType[] = []): GameMap {
  // types de nœuds exclus par la zone (ex. pas d'Otomai à Incarnam)
  const poids = Object.fromEntries(
    Object.entries(GEN_CARTE.poids).filter(([t]) => !sansNoeuds.includes(t as NodeType)),
  );
  const profil = profilLargeur(rng);
  const nbLignes = profil.length;
  const lignes: MapNode[][] = [];

  for (let l = 0; l < nbLignes; l++) {
    const nb = profil[l];
    const ligne: MapNode[] = [];
    for (let c = 0; c < nb; c++) {
      const type: NodeType =
        l === 0 ? "combat" : l === nbLignes - 1 ? "donjon" : pickType(rng, poids);
      const colonne = c - (nb - 1) / 2; // offset centré
      const node: MapNode = { id: `n${l}_${c}`, type, ligne: l, colonne, suivants: [] };
      enrichir(rng, node, pools);
      ligne.push(node);
    }
    lignes.push(ligne);
  }

  // --- Arêtes : les 2 diagonales (voisin strictement à gauche + à droite, ≤ 1 colonne) ---
  const ADJ = 1.0001;
  for (let l = 0; l < nbLignes - 1; l++) {
    const cur = lignes[l];
    const next = lignes[l + 1];
    for (const node of cur) {
      const gauche = next
        .filter((n) => n.colonne < node.colonne && node.colonne - n.colonne <= ADJ)
        .sort((a, b) => b.colonne - a.colonne)[0];
      const droite = next
        .filter((n) => n.colonne > node.colonne && n.colonne - node.colonne <= ADJ)
        .sort((a, b) => a.colonne - b.colonne)[0];
      const ids = [gauche?.id, droite?.id].filter((x): x is string => !!x);
      // filet de sécurité (ne devrait pas arriver avec un profil en ±1) : le plus proche
      if (!ids.length) {
        ids.push([...next].sort((a, b) => Math.abs(a.colonne - node.colonne) - Math.abs(b.colonne - node.colonne))[0].id);
      }
      node.suivants = ids;
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
