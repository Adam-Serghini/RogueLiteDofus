// =============================================================================
//  laboratoire.test.ts — Laboratoire de Brumen Tinctorias (zone 4 de la Tranche 2)
//  bestiaire, poison qui ignore boucliers et résistances, contagion, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const ELEMENT_DE = {
  scorbute: "feu", croc_gland: "terre", crowneille: "air",
  macien: "terre", kolerat: "eau", nelween: "eau",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  scorbute: "Scorpitène l'Enflammé",
  croc_gland: "Cromikay le Néophyte",
  crowneille: "Crognan le Barbare",
  kolerat: "Kolforthe l'Indécollable",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Laboratoire", () => {
  it("les 6 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      const m = MONSTRES[id];
      expect(m, `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} ne frappe pas en ${element}`).toBe(STAT_DE_ELEMENT[element]);
      expect(m.resistances?.[element], `${id} doit résister en ${element}`).toBeGreaterThan(0);
    }
  });

  it("4 espèces sur 6 portent un archimonstre, et deux espèces n'ont jamais le MÊME", () => {
    for (const [id, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[id].archiNom, `${id}`).toBe(nom);
    }
    expect(MONSTRES.macien.archiNom).toBeUndefined();
    expect(MONSTRES.nelween.archiNom).toBeUndefined();
    // Metamob attribue « Crognan le Barbare » à Croc Gland ET à Crowneille : on
    // donne à Croc Gland son autre archi référencé pour que le Bestiaire n'affiche
    // pas deux fois le même nom.
    const noms = Object.values(ARCHIS);
    expect(new Set(noms).size, "deux espèces partagent le même nom d'archi").toBe(noms.length);
  });

  it("Nelween est le boss, à 10 PA, et lâche le Dofus Pourpre", () => {
    const n = MONSTRES.nelween;
    expect(n.boss).toBe(true);
    expect(n.pa).toBe(10);
    expect(n.dofus).toBe("dofus_pourpre");
    expect(n.sorts[0]).toBe("vapeurs_corrosives"); // signature en tête : l'IA joue le plus cher, à égalité l'ordre de la liste
  });
});

describe("la leçon de la zone : le poison ignore ce qui protège", () => {
  it("les trois sorts de poison existent avec les bons coûts", () => {
    expect(SORTS.dard_venimeux?.poison, "dard_venimeux sans poison").toBeTruthy();
    expect(SORTS.dard_venimeux.coutPA).toBe(4);
    expect(SORTS.contagion?.poison, "contagion sans poison").toBeTruthy();
    expect(SORTS.contagion.coutPA).toBe(4);
    expect(SORTS.vapeurs_corrosives?.poison, "vapeurs_corrosives sans poison").toBeTruthy();
    expect(SORTS.vapeurs_corrosives.coutPA).toBe(6);
    expect(SORTS.vapeurs_corrosives.cooldownTours).toBeGreaterThanOrEqual(2);
  });

  it("seule la Contagion se transmet — c'est la signature du Kolérat", () => {
    expect(SORTS.contagion.poison!.transmet).toBe(true);
    expect(SORTS.dard_venimeux.poison!.transmet).toBeFalsy();
    expect(SORTS.vapeurs_corrosives.poison!.transmet).toBeFalsy();
    expect(MONSTRES.kolerat.sorts).toContain("contagion");
  });

  it("la signature du boss frappe toute la rangée ET l'empoisonne", () => {
    expect(SORTS.vapeurs_corrosives.zoneLigne).toBe(true);
  });

  it("les trois empoisonneuses portent le dard ; le Macien, lui, ne porte aucun poison", () => {
    for (const id of ["scorbute", "croc_gland", "crowneille"]) {
      expect(MONSTRES[id].sorts, `${id}`).toContain("dard_venimeux");
    }
    // le cogneur banal existe pour qu'un pack ne soit pas qu'une accumulation de DoT
    expect(MONSTRES.macien.sorts.some((s) => SORTS[s]?.poison)).toBe(false);
  });
});
