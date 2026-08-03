// =============================================================================
//  moon.test.ts — Arbre de Moon (zone 12 et DERNIÈRE de la Tranche 2)
//  la finale est un examen : son sortilège tire une des quatre leçons de la tranche.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";

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

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Arbre de Moon", () => {
  it("est la 12e et DERNIÈRE zone de la Tranche 2, sur la toile 24", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[11]).toBe("arbre_de_moon");
    expect(t2.zones, "la Tranche 2 est complète").toHaveLength(12);
    const loc = localiserZone("arbre_de_moon")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(24); // 12 toiles consommées par la t1
  });

  it("la Tranche 2 reste EN CHANTIER malgré ses 12 zones", () => {
    // Le contenu existe, l'équilibrage non : la tranche doit rester non lançable jusqu'à
    // ce qu'Adam la juge prête. Retirer `enChantier` est un choix, pas un effet de bord
    // de la complétion du contenu — d'où ce test.
    expect(TRANCHES.find((t) => t.id === "t2")!.enChantier).toBe(true);
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale a UN boss, qui lâche le Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss)).toEqual(["moon"]);
    expect(MONSTRES.moon.dofus).toBe("dofus_turquoise");
  });

  it("chaque pack normal contient un porteur de proc aléatoire", () => {
    // Ce n'est pas un effet qu'il faut apprendre ici — les quatre le sont déjà — mais
    // l'IMPRÉVISIBILITÉ, et elle se découvre sur un petit ennemi.
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) =>
        MONSTRES[e.monstre].sorts.some((s) => SORTS[s].procAleatoire?.length));
      expect(porte, `${id} n'enseigne pas l'imprévisibilité`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 3 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 24 ne lâche rien pour l'instant", () => {
    expect(butinToile("arbre_de_moon")).toBeNull();
  });
});
