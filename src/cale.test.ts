// =============================================================================
//  cale.test.ts — Cale de l'Arche d'Otomaï (zone 2 de la Tranche 2) : bestiaire,
//  archis, artillerie qui ignore la ligne, salle de Gourlo et zone.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

/** Élément de chaque espèce → statistique dominante et résistance attendues. */
const ELEMENT_DE = {
  le_flib: "eau", sparo: "air", barbroussa: "terre",
  boomba: "terre", nakunbra: "air", canondorf: "feu",
  gourlo_le_terrible: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;

const ARCHIS = {
  sparo: "Sparoket le Lanceur",
  barbroussa: "Barebourd le Comte",
  boomba: "Boombata le Garde",
  nakunbra: "Nakuneuye le Borgne",
  canondorf: "Caboume l'Artilleur",
} as const;

describe("bestiaire de la Cale de l'Arche", () => {
  it("les 7 espèces existent et frappent/résistent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      const m = MONSTRES[id];
      expect(m, `${id} manquant`).toBeTruthy();
      expect(m.resistances?.[element], `${id} doit résister en ${element}`).toBeGreaterThan(0);
      const stats = m.stats as unknown as Record<string, number>;
      const dominante = Object.entries(stats)
        .filter(([k]) => k !== "vitalite")
        .sort((a, b) => b[1] - a[1])[0][0];
      expect(dominante, `${id} ne frappe pas dans son élément (${element})`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("5 espèces sur 7 portent un archimonstre ; Le Flib et Gourlo n'en ont pas", () => {
    for (const [id, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[id].archiNom, `${id} sans archi`).toBe(nom);
    }
    expect(MONSTRES.le_flib.archiNom).toBeUndefined();
    expect(MONSTRES.gourlo_le_terrible.archiNom).toBeUndefined();
  });

  it("les gardes de la cale sont plus robustes que l'équipage de pont", () => {
    const equipage = ["le_flib", "sparo"].map((id) => MONSTRES[id].pv);
    const gardes = ["boomba", "nakunbra", "canondorf"].map((id) => MONSTRES[id].pv);
    expect(Math.min(...gardes)).toBeGreaterThan(Math.max(...equipage));
  });
});

describe("la leçon de la zone : la rangée arrière n'est plus un abri", () => {
  /** Un sort en `ennemi_tous` peut viser n'importe qui, rangée arrière comprise. */
  const ignoreLaLigne = (sortId: string) => SORTS[sortId]?.cible === "ennemi_tous";

  it("les deux artilleurs portent un sort qui ignore la règle de ligne", () => {
    for (const id of ["sparo", "canondorf"]) {
      expect(MONSTRES[id].sorts.some(ignoreLaLigne), `${id} n'a aucun sort qui ignore la ligne`).toBe(true);
    }
  });

  it("la Bordée de Gourlo ignore la ligne ET frappe toute la rangée visée", () => {
    const s = SORTS.bordee;
    expect(s, "sort bordee manquant").toBeTruthy();
    expect(s.cible).toBe("ennemi_tous"); // pointable même sur la rangée arrière
    expect(s.zoneLigne).toBe(true); // et elle balaie toute la rangée
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBeGreaterThanOrEqual(2);
  });
});

describe("Gourlo le Terrible", () => {
  it("est un boss à 10 PA qui lâche le Dofus Pourpre, signature en tête", () => {
    const g = MONSTRES.gourlo_le_terrible;
    expect(g.boss).toBe(true);
    expect(g.pa).toBe(10); // salle à boss UNIQUE : le kit de T1 (6 + 4) est entièrement dépensé
    expect(g.dofus).toBe("dofus_pourpre");
    expect(g.sorts[0]).toBe("bordee"); // l'IA agressive joue le plus cher, à égalité l'ordre de la liste
    expect(g.sorts).toContain("morsure"); // les 4 PA restants trouvent preneur
  });
});
