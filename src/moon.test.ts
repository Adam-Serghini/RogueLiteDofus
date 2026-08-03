// =============================================================================
//  moon.test.ts — Arbre de Moon (zone 12 et DERNIÈRE de la Tranche 2)
//  la finale est un examen : son sortilège tire une des quatre leçons de la tranche.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const ELEMENT_DE = {
  trukikol: "terre", moon: "terre",
  gloutovore: "eau", domoizelle: "eau",
  fourbasse: "air", dostrogo: "air",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  trukikol: "Trukul le Lent",
  gloutovore: "Gloubibou le Gars",
  fourbasse: "Fourapin le Chaud",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire de l'Arbre de Moon", () => {
  it("les 6 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("3 espèces sur 6 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("aucun monstre de la zone n'est feu", () => {
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(dominante(id), `${id}`).not.toBe("intelligence");
    }
  });

  it("aucun sprite en doublon dans la zone", () => {
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("qui frappe deux fois frappe plus faible", () => {
    expect(MONSTRES.fourbasse.pa).toBe(8);
    for (const lent of ["trukikol", "gloutovore"]) {
      expect(dom("fourbasse"), `contre ${lent}`).toBeLessThan(dom(lent));
    }
  });

  it("aucune escorte n'atteint le budget de PA du boss", () => {
    // Inégalité STRICTE ici : la salle est à boss unique (10 PA). Au Repaire du Kharnozor
    // et au Domaine Ancestral, les salles JUMELÉES mettent les boss à 6 PA, ce qui avait
    // forcé à assouplir ce garde-fou — cet assouplissement n'est pas la règle générale.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (!MONSTRES[id].boss) expect(MONSTRES[id].pa, `${id}`).toBeLessThan(MONSTRES.moon.pa);
    }
  });
});

describe("le sortilège de Moon est un examen de la tranche", () => {
  it("il tire parmi EXACTEMENT les quatre leçons de la Tranche 2", () => {
    // Le contraste avec l'Antre du Dragon Cochon est DÉLIBÉRÉ : là-bas `procAleatoire`
    // n'a qu'UNE entrée pour être déterministe, et deux tests l'y verrouillent. Ici la
    // pluralité est le propos. Ne PAS « harmoniser » les deux zones : ce sont deux
    // usages opposés du même champ, chacun voulu.
    const procs = SORTS.sortilege_lunaire.procAleatoire!;
    expect(procs, "quatre leçons, une par tirage").toHaveLength(4);
    const signatures = procs.map((p) => (p.dissipePositifs ? "dissipePositifs" : p.effet!.stat)).sort();
    expect(signatures, "les quatre leçons nommées, pour qu'un retrait silencieux se voie")
      .toEqual(["dissipePositifs", "friction", "poison", "tetanise"]);
  });

  it("la signature de Moon est cadencée et à 6 PA", () => {
    const s = SORTS.sortilege_lunaire;
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
  });

  it("le caprice du Dostrogo a DEUX entrées — une préparation, pas une copie du boss", () => {
    const procs = SORTS.souffle_capricieux.procAleatoire!;
    expect(procs).toHaveLength(2);
    const signatures = procs.map((p) => p.effet!.stat).sort();
    expect(signatures).toEqual(["friction", "tetanise"]);
    expect(SORTS.souffle_capricieux.coutPA).toBe(4);
  });
});
