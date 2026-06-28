// =============================================================================
//  carte.test.ts — Invariants de génération & navigation du plateau.
// =============================================================================
import { describe, it, expect } from "vitest";
import { genererCarte, noeud, atteignables } from "./carte";
import type { GameMap } from "./types";

// PRNG déterministe (mulberry32) pour des cartes reproductibles.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// BFS depuis les départs : l'ensemble des nœuds accessibles.
function accessibles(carte: GameMap): Set<string> {
  const vus = new Set<string>(carte.depart);
  const file = [...carte.depart];
  while (file.length) {
    const id = file.shift()!;
    for (const s of noeud(carte, id)?.suivants ?? []) {
      if (!vus.has(s)) {
        vus.add(s);
        file.push(s);
      }
    }
  }
  return vus;
}

// pools de test (les ids historiques existent toujours dans data.ts)
const POOLS = { normales: ["combat_1", "combat_2", "combat_3"], elite: ["combat_elite"], boss: "boss" };

// 30 graines variées : les invariants doivent tenir pour toutes.
const cartes = Array.from({ length: 30 }, (_, i) => genererCarte(mulberry32(i * 2654435761), POOLS));

describe("génération de carte", () => {
  it("la ligne 0 ne contient que des combats", () => {
    for (const c of cartes) {
      const l0 = c.noeuds.filter((n) => n.ligne === 0);
      expect(l0.length).toBeGreaterThan(0);
      expect(l0.every((n) => n.type === "combat")).toBe(true);
      expect(c.depart.sort()).toEqual(l0.map((n) => n.id).sort());
    }
  });

  it("la dernière ligne est un unique donjon", () => {
    for (const c of cartes) {
      const maxL = Math.max(...c.noeuds.map((n) => n.ligne));
      const derniere = c.noeuds.filter((n) => n.ligne === maxL);
      expect(derniere.length).toBe(1);
      expect(derniere[0].type).toBe("donjon");
      expect(derniere[0].combatId).toBe("boss");
      expect(derniere[0].suivants.length).toBe(0);
    }
  });

  it("chaque nœud hors-départ a une arête entrante, chaque nœud hors-donjon une sortante", () => {
    for (const c of cartes) {
      const maxL = Math.max(...c.noeuds.map((n) => n.ligne));
      const cibles = new Set(c.noeuds.flatMap((n) => n.suivants));
      for (const n of c.noeuds) {
        if (n.ligne !== 0) expect(cibles.has(n.id)).toBe(true); // entrante
        if (n.ligne !== maxL) expect(n.suivants.length).toBeGreaterThan(0); // sortante
      }
    }
  });

  it("un chemin complet existe : le donjon est accessible depuis le départ", () => {
    for (const c of cartes) {
      const maxL = Math.max(...c.noeuds.map((n) => n.ligne));
      const donjon = c.noeuds.find((n) => n.ligne === maxL)!;
      expect(accessibles(c).has(donjon.id)).toBe(true);
    }
  });

  it("tous les nœuds sont accessibles depuis le départ", () => {
    for (const c of cartes) {
      const acc = accessibles(c);
      expect(acc.size).toBe(c.noeuds.length);
    }
  });

  it("les combats portent un combatId et de l'XP", () => {
    for (const c of cartes) {
      for (const n of c.noeuds) {
        if (n.type === "combat" || n.type === "combat_dur") {
          expect(n.combatId).toBeTruthy();
          expect(n.xp).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("atteignables", () => {
  it("renvoie les départs quand courant est null, puis les suivants", () => {
    const c = genererCarte(mulberry32(42), POOLS);
    const dep = atteignables(c);
    expect(dep.map((n) => n.id).sort()).toEqual([...c.depart].sort());

    c.courant = c.depart[0];
    const suite = atteignables(c);
    expect(suite.map((n) => n.id).sort()).toEqual([...noeud(c, c.depart[0])!.suivants].sort());
  });
});
