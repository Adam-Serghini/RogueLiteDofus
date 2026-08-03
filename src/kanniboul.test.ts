// =============================================================================
//  kanniboul.test.ts — Bateau du Chouque & Village Kanniboul (zone 7 de la T2)
//  curare (friction : soins ET boucliers bloqués), festin du Chouque, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";

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

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Bateau du Chouque", () => {
  it("est la 7e zone de la Tranche 2, sur la toile 19", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[6]).toBe("bateau_du_chouque");
    const loc = localiserZone("bateau_du_chouque")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(19); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale aligne les DEUX boss, tous deux porteurs du Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss).sort()).toEqual(["kanniboul_ebil", "le_chouque"]);
    for (const id of ["le_chouque", "kanniboul_ebil"]) {
      expect(MONSTRES[id].dofus).toBe("dofus_turquoise");
    }
  });

  it("chaque pack normal contient un porteur de curare", () => {
    // La leçon se paie tôt et sur un petit ennemi, avant qu'Ebil n'enfume une rangée.
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) =>
        MONSTRES[e.monstre].sorts.some((s) => SORTS[s].effet?.stat === "friction"));
      expect(porte, `${id} n'enseigne pas le curare`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 19 ne lâche rien pour l'instant", () => {
    expect(butinToile("bateau_du_chouque")).toBeNull();
  });
});
