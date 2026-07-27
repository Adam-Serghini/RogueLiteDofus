// =============================================================================
//  blops.test.ts — Clos des Blops (zone 1 de la Tranche 2) : bestiaire, archis,
//  signatures des Blops Royaux, salles de boss et butin.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const COULEURS = ["griotte", "indigo", "reinette", "coco"] as const;
const STAT_DE_COULEUR = { griotte: "intelligence", indigo: "chance", reinette: "force", coco: "agilite" } as const;
const ELEM_DE_COULEUR = { griotte: "feu", indigo: "eau", reinette: "terre", coco: "air" } as const;

describe("bestiaire du Clos des Blops", () => {
  it("les 8 Blops et Biblops existent, portent un archimonstre et résistent dans leur couleur", () => {
    for (const c of COULEURS) {
      for (const prefixe of ["blop", "biblop"]) {
        const m = MONSTRES[`${prefixe}_${c}`];
        expect(m, `${prefixe}_${c} manquant`).toBeTruthy();
        expect(m.archiNom, `${prefixe}_${c} sans archi`).toBeTruthy();
        expect(m.resistances?.[ELEM_DE_COULEUR[c]]).toBeGreaterThan(0);
        // stat dominante = celle de sa couleur
        const stats = m.stats as unknown as Record<string, number>;
        const dominante = Object.entries(stats)
          .filter(([k]) => k !== "vitalite")
          .sort((a, b) => b[1] - a[1])[0][0];
        expect(dominante, `${prefixe}_${c} ne frappe pas dans sa couleur`).toBe(STAT_DE_COULEUR[c]);
      }
    }
  });

  it("les Biblops sont plus petits que les Blops (chair à canon)", () => {
    for (const c of COULEURS) {
      expect(MONSTRES[`biblop_${c}`].pv).toBeLessThan(MONSTRES[`blop_${c}`].pv);
    }
  });

  it("les 3 variantes existent et n'ont PAS d'archi (absentes du catalogue Metamob)", () => {
    for (const id of ["gloutoblop", "blopignon", "tronkoblop"]) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(MONSTRES[id].archiNom).toBeUndefined();
    }
  });

  it("les 4 Royaux sont des boss à 8 PA qui résistent fortement dans leur couleur", () => {
    for (const c of COULEURS) {
      const r = MONSTRES[`blop_${c}_royal`];
      expect(r, `blop_${c}_royal manquant`).toBeTruthy();
      expect(r.boss).toBe(true);
      expect(r.pa).toBe(8); // salle à DEUX boss : 8 PA et non 10
      expect(r.resistances?.[ELEM_DE_COULEUR[c]]).toBeGreaterThanOrEqual(0.5);
      expect(r.archiNom).toBeUndefined();
    }
  });
});

describe("signatures des Blops Royaux", () => {
  const SIGNATURES = {
    griotte: "confiture_bouillante",
    indigo: "maree_d_encre",
    coco: "bourrasque_de_pollen",
    reinette: "pluie_de_pommes",
  } as const;

  it("chaque Royal porte SA signature en tête de sa liste de sorts, à 6 PA et en recharge", () => {
    for (const c of COULEURS) {
      const r = MONSTRES[`blop_${c}_royal`];
      const sig = SIGNATURES[c];
      expect(r.sorts[0], `blop_${c}_royal : signature pas en tête`).toBe(sig);
      expect(SORTS[sig].coutPA).toBe(6);
      expect(SORTS[sig].cooldownTours).toBeGreaterThanOrEqual(2);
      // 8 PA = signature (6) + une action du kit commun (2) : le kit doit être là
      expect(r.sorts.length).toBeGreaterThan(1);
    }
  });

  it("chaque signature porte son rider thématique", () => {
    expect(SORTS.confiture_bouillante.poison).toBeTruthy();
    expect(SORTS.maree_d_encre.effet?.stat).toBe("degatsInfliges");
    expect(SORTS.bourrasque_de_pollen.deplaceCible).toBe("arriere");
    expect(SORTS.pluie_de_pommes.zoneLigne).toBe(true);
  });
});
