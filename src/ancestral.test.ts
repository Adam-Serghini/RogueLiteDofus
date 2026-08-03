// =============================================================================
//  ancestral.test.ts — Domaine Ancestral & Antre de la Reine Nyée (zone 11, T2)
//  la toile coupe l'accès à la rangée arrière (`tetanise` côté ennemi, une première).
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const ELEMENT_DE = {
  abraknyde_venerable: "terre", abraknyde_sombre: "terre",
  abrakne_sombre: "eau", abraknyde_ancestral: "eau",
  arapex: "air", araknotron: "air", nefileuse: "air", reine_nyee: "air",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  abraknyde_venerable: "Abrakildas le Vénérable",
  abraknyde_sombre: "Abrakanette l'Encapsulé",
  abrakne_sombre: "Abraklette le Fondant",
  arapex: "Arapliké la Calligraphe",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire du Domaine Ancestral", () => {
  it("les 8 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 8 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("aucun monstre de la zone n'est feu", () => {
    // Règle reprise de la Tanière du Meulou : personne n'est feu, donc le doublement de
    // l'intelligence n'entre pas en jeu et il n'y a rien à compenser entre les deux boss.
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(dominante(id), `${id}`).not.toBe("intelligence");
    }
  });

  it("aucun sprite en doublon dans la zone", () => {
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("deux espèces tissent : la Néfileuse et la Reine", () => {
    const tisseuses = Object.keys(ELEMENT_DE).filter((id) =>
      MONSTRES[id].sorts.some((s) => SORTS[s].effet?.stat === "tetanise"));
    expect(tisseuses.sort()).toEqual(["nefileuse", "reine_nyee"]);
  });

  it("qui frappe deux fois frappe plus faible", () => {
    expect(MONSTRES.araknotron.pa).toBe(8);
    for (const lent of ["abraknyde_venerable", "abraknyde_sombre"]) {
      expect(dom("araknotron"), `contre ${lent}`).toBeLessThan(dom(lent));
    }
  });

  it("une escorte ne dépasse le budget de PA d'un boss QUE si elle frappe plus faible", () => {
    // Dans une salle jumelée les boss sont à 6 PA (précédent des Blops Royaux, refus de
    // refaire les 20 PA du Terrier), et `charge` en coûte 6 : un cogneur de la zone y est
    // donc à 6 PA lui aussi, et un frappeur-deux-fois à 8 DÉPASSE le boss. L'invariant
    // « escorte ≤ boss » est donc faux pour cette forme de zone — c'était déjà le cas au
    // Bateau du Chouque, où ce test n'existait pas.
    //
    // La règle réelle, elle, tient : un budget de PA supérieur doit être payé par une
    // dominante strictement plus faible. C'est ce qui empêche l'inversion boss/escorte,
    // et la garantie finale reste le test de domination sur les dégâts par tour.
    const paBoss = MONSTRES.reine_nyee.pa;
    const dominanteMax = Math.max(
      ...Object.keys(ELEMENT_DE).filter((id) => !MONSTRES[id].boss && MONSTRES[id].pa <= paBoss)
        .map(dom),
    );
    for (const id of Object.keys(ELEMENT_DE)) {
      if (MONSTRES[id].boss || MONSTRES[id].pa <= paBoss) continue;
      expect(dom(id), `${id} a plus de PA qu'un boss, il doit frapper plus faible`)
        .toBeLessThan(dominanteMax);
    }
  });
});

describe("les sorts de la toile", () => {
  it("le fil et la toile posent `tetanise` sur leur cible", () => {
    for (const id of ["fil_collant", "toile_gluante"]) {
      const s = SORTS[id];
      expect(s, `${id} manquant`).toBeTruthy();
      expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
      expect(s.effet?.stat, `${id}`).toBe("tetanise");
      expect(s.effet!.duree, `${id} : 1 tour, c'est la soupape anti-frustration`).toBe(1);
    }
  });

  it("la toile de la Reine couvre une rangée et recharge", () => {
    const s = SORTS.toile_gluante;
    expect(s.zoneLigne).toBe(true);
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2); // l'autre soupape : jamais un verrou permanent
  });

  it("les racines atteignent n'importe qui", () => {
    const s = SORTS.racines_ancestrales;
    expect(s.cible).toBe("ennemi_tous");
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
  });
});
