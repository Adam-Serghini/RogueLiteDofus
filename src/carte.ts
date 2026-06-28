// =============================================================================
//  carte.ts — Génération et navigation du plateau (pur, rng injecté).
// =============================================================================
import { GEN_CARTE, XP_PAR_TYPE } from "./data";
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
      break;
    case "donjon":
      node.combatId = pools.boss;
      break;
    // taverne / otomai / zaap : pas de combatId fixe (zaap résolu à l'entrée)
  }
}

/**
 * Génère une carte par rangées :
 *  - ligne 0 : combats uniquement (départ sûr)
 *  - dernière ligne : un unique donjon
 *  - lignes intermédiaires : types pondérés
 *  - arêtes garantissant connectivité (≥1 entrante hors départ, ≥1 sortante hors donjon)
 */
export function genererCarte(rng: Rng, pools: ZonePools): GameMap {
  const cfg = GEN_CARTE;
  const nbLignes = randInt(rng, cfg.lignesMin, cfg.lignesMax);
  const lignes: MapNode[][] = [];

  for (let l = 0; l < nbLignes; l++) {
    let nb: number;
    if (l === 0) nb = randInt(rng, cfg.departNoeudsMin, cfg.departNoeudsMax);
    else if (l === nbLignes - 1) nb = 1; // donjon
    else nb = randInt(rng, cfg.noeudsMin, cfg.noeudsMax);

    const ligne: MapNode[] = [];
    for (let c = 0; c < nb; c++) {
      const type: NodeType =
        l === 0 ? "combat" : l === nbLignes - 1 ? "donjon" : pickType(rng, cfg.poids);
      const node: MapNode = { id: `n${l}_${c}`, type, ligne: l, colonne: c, suivants: [] };
      enrichir(rng, node, pools);
      ligne.push(node);
    }
    lignes.push(ligne);
  }

  // --- Arêtes ---
  const clamp = (x: number, len: number) => Math.max(0, Math.min(len - 1, x));
  for (let l = 0; l < nbLignes - 1; l++) {
    const cur = lignes[l];
    const next = lignes[l + 1];

    if (next.length === 1) {
      // avant-dernière rangée → donjon : tout le monde pointe dessus
      for (const node of cur) node.suivants.push(next[0].id);
      continue;
    }

    for (const node of cur) {
      const approx =
        cur.length === 1
          ? Math.floor(rng() * next.length)
          : Math.round((node.colonne / (cur.length - 1)) * (next.length - 1));
      const cibles = new Set<number>([clamp(approx, next.length)]);
      if (rng() < 0.5) cibles.add(clamp(approx + (rng() < 0.5 ? -1 : 1), next.length));
      for (const t of cibles) node.suivants.push(next[t].id);
    }

    // garantir une arête entrante à chaque nœud de la rangée suivante
    next.forEach((nn, t) => {
      const aEntrante = cur.some((node) => node.suivants.includes(nn.id));
      if (!aEntrante) {
        const back = cur.length === 1 ? 0 : Math.round((t / (next.length - 1)) * (cur.length - 1));
        cur[clamp(back, cur.length)].suivants.push(nn.id);
      }
    });

    for (const node of cur) node.suivants = [...new Set(node.suivants)];
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
