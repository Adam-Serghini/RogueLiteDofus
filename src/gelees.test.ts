// =============================================================================
//  gelees.test.ts — Gelaxième Dimension (zone 3 de la Tranche 2) : bestiaire,
//  absorption des Gelées Royales, budget de PA, salles de boss et zone.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const COULEURS = ["fraise", "bleuet", "menthe", "citron"] as const;
const ELEM_DE_COULEUR = { fraise: "feu", bleuet: "eau", menthe: "air", citron: "terre" } as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  fraise: "Gelaviv le Glaçon",
  bleuet: "Gelanal le Huileux",
  menthe: "Geloliaine l'Aérien",
} as const;

/** Statistique offensive dominante d'un monstre (vitalité exclue). */
const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire de la Gelaxième Dimension", () => {
  it("les 4 Gelées normales frappent ET résistent dans leur couleur", () => {
    for (const c of COULEURS) {
      const m = MONSTRES[`gelee_${c}`];
      expect(m, `gelee_${c} manquante`).toBeTruthy();
      expect(dominante(`gelee_${c}`)).toBe(STAT_DE_ELEMENT[ELEM_DE_COULEUR[c]]);
      expect(m.resistances?.[ELEM_DE_COULEUR[c]]).toBeGreaterThan(0);
    }
  });

  it("3 Gelées sur 8 portent un archimonstre ; la Citron et les Royales n'en ont pas", () => {
    for (const [c, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[`gelee_${c}`].archiNom, `gelee_${c}`).toBe(nom);
    }
    expect(MONSTRES.gelee_citron.archiNom).toBeUndefined();
    for (const c of COULEURS) expect(MONSTRES[`gelee_royale_${c}`].archiNom).toBeUndefined();
  });

  it("les Royales sont des boss qui lâchent le Dofus Pourpre et frappent dans leur couleur", () => {
    for (const c of COULEURS) {
      const r = MONSTRES[`gelee_royale_${c}`];
      expect(r, `gelee_royale_${c} manquante`).toBeTruthy();
      expect(r.boss).toBe(true);
      expect(r.dofus).toBe("dofus_pourpre"); // la paire est tirée au hasard : les 4 doivent le porter
      expect(dominante(`gelee_royale_${c}`)).toBe(STAT_DE_ELEMENT[ELEM_DE_COULEUR[c]]);
      expect(r.pv).toBeGreaterThan(MONSTRES[`gelee_${c}`].pv);
    }
  });
});

describe("l'absorption : la leçon propre à cette zone", () => {
  it("les Royales n'ont AUCUN pic de résistance — le puzzle élémentaire du Clos ne se rejoue pas", () => {
    for (const c of COULEURS) {
      const res = MONSTRES[`gelee_royale_${c}`].resistances ?? {};
      for (const [elem, v] of Object.entries(res)) {
        expect(v, `gelee_royale_${c} : pic de résistance en ${elem}`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it("les QUATRE Royales partagent la même signature d'absorption", () => {
    for (const c of COULEURS) {
      // même signature pour les quatre : au Clos, des signatures différentes ont rendu
      // les six paires inégales alors que le joueur ne choisit pas sa paire.
      expect(MONSTRES[`gelee_royale_${c}`].sorts[0]).toBe("gelification");
    }
  });

  it("Gélification donne un bouclier proportionnel aux dégâts infligés", () => {
    const s = SORTS.gelification;
    expect(s, "sort gelification manquant").toBeTruthy();
    expect(s.bouclierRatioDegats).toBeGreaterThan(0);
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBeGreaterThanOrEqual(2);
  });
});
