// =============================================================================
//  kanniboul.test.ts — Bateau du Chouque & Village Kanniboul (zone 7 de la T2)
//  curare (friction : soins ET boucliers bloqués), festin du Chouque, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const ELEMENT_DE = {
  kanniboul_ark: "terre", kanniboul_eth: "feu", kanniboul_jav: "air",
  kanniboul_sarbak: "eau", kanniboul_tam: "terre",
  ricanif: "air", ivremor: "eau",
  le_chouque: "feu", kanniboul_ebil: "eau",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  kanniboul_ark: "Kannibal le Lecteur",
  kanniboul_eth: "Kannisterik le Forcené",
  kanniboul_jav: "Kapota la Fraise",
  kanniboul_sarbak: "Kannémik le Maigre",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire du Bateau du Chouque", () => {
  it("les 9 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 9 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("les trois gardes de la Cale de l'Arche ne sont PAS réutilisés", () => {
    // Le donjon 91 les contient, mais ils sont déjà à la toile 14 avec des stats
    // calibrées cinq toiles plus bas : les réutiliser serait une redite sans archi
    // neuf. Ce test fige la décision.
    for (const id of ["boomba", "nakunbra", "canondorf"]) {
      expect(Object.keys(ELEMENT_DE)).not.toContain(id);
    }
  });

  it("qui frappe deux fois frappe plus faible", () => {
    // Sans cet écart, deux morsures d'un ennemi à 8 PA dépassent un boss à 6 PA :
    // ce serait la 4e inversion boss/escorte du projet.
    for (const rapide of ["kanniboul_jav", "ivremor"]) {
      expect(MONSTRES[rapide].pa).toBe(8);
      for (const lent of ["kanniboul_ark", "kanniboul_eth"]) {
        expect(dom(rapide), `${rapide} doit frapper plus faible que ${lent}`).toBeLessThan(dom(lent));
      }
    }
  });
});

describe("les sorts du curare", () => {
  it("la sarbacane pose la friction sur sa CIBLE", () => {
    // `friction` s'applique à la cible : bon sens pour un sort de monstre, à la
    // différence de `nullifieProchain`, écarté aux Pitons pour cette raison.
    const s = SORTS.sarbacane_curare;
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.effet?.stat).toBe("friction");
    expect(s.effet!.duree).toBeGreaterThan(0);
  });

  it("la fumée frappe la rangée entière et l'empoisonne de curare", () => {
    const s = SORTS.fumee_de_curare;
    expect(s.zoneLigne).toBe(true);
    expect(s.effet?.stat).toBe("friction");
    expect(s.cooldownTours).toBe(2);
  });

  it("la ripaille nourrit son lanceur", () => {
    const s = SORTS.ripaille;
    expect(s.type).toBe("degats");
    expect(s.vampirismeRatio!).toBeGreaterThan(0);
    expect(s.cooldownTours).toBe(2);
  });

  it("les deux boss n'ont que des sorts à 6 PA — une action par tour, zéro PA orphelin", () => {
    // Précédent des Blops Royaux : une salle jumelée aligne deux budgets. Au
    // Terrier, 10 PA chacun avaient fait la salle la plus lourde de la tranche.
    for (const id of ["le_chouque", "kanniboul_ebil"]) {
      expect(MONSTRES[id].pa).toBe(6);
      for (const s of MONSTRES[id].sorts) expect(SORTS[s].coutPA, `${id} / ${s}`).toBe(6);
    }
  });
});
