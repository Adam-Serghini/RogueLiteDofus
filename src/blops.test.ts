// =============================================================================
//  blops.test.ts — Clos des Blops (zone 1 de la Tranche 2) : bestiaire, archis,
//  signatures des Blops Royaux, salles de boss et butin.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, zonesDeTranche, localiserZone, offsetToile } from "./data";
import { toileDeZone } from "./run";
import { multStatFrappe } from "./progression";

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

  it("les 4 Royaux sont des boss à 6 PA qui résistent fortement dans leur couleur", () => {
    for (const c of COULEURS) {
      const r = MONSTRES[`blop_${c}_royal`];
      expect(r, `blop_${c}_royal manquant`).toBeTruthy();
      expect(r.boss).toBe(true);
      // salle à DEUX boss : 6 PA et non 10 — et 6 exactement, parce qu'un Royal
      // ne lance QU'UN sort par tour (signature ou charge, 6 PA chacun) :
      // les 8 PA d'origine laissaient 2 PA morts, indépassables.
      expect(r.pa).toBe(6);
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
      // 6 PA = EXACTEMENT une action par tour : la signature quand elle est
      // prête, `charge` (6 PA aussi) pendant sa recharge. Le repli doit exister.
      expect(r.sorts).toContain("charge");
      expect(SORTS.charge.coutPA).toBe(6);
    }
  });

  it("les Royaux frappent nettement plus fort que leurs escortes (fiction de boss)", () => {
    // `charge` (6 PA, scaling 0.72) est le sort de référence des deux camps de
    // la salle : on compare le coup type d'un Royal à celui de son escorte.
    const coupType = (id: string, stat: string, sort: string) => {
      const s = SORTS[sort];
      const st = MONSTRES[id].stats as unknown as Record<string, number>;
      return ((s.baseMin + s.baseMax) / 2) * multStatFrappe(st[stat]);
    };
    const glouto = coupType("gloutoblop", "force", "charge");
    const blopignon = coupType("blopignon", "agilite", "morsure");
    for (const c of COULEURS) {
      const royal = coupType(`blop_${c}_royal`, STAT_DE_COULEUR[c], "charge");
      expect(royal, `blop_${c}_royal doit dominer le Gloutoblop`).toBeGreaterThan(glouto * 1.25);
      expect(royal, `blop_${c}_royal doit dominer le Blopignon`).toBeGreaterThan(blopignon * 1.25);
      // ... et le Blop normal de sa propre couleur
      expect(royal).toBeGreaterThan(coupType(`blop_${c}`, STAT_DE_COULEUR[c], "morsure") * 1.25);
    }
  });

  it("chaque signature porte son rider thématique", () => {
    expect(SORTS.confiture_bouillante.poison).toBeTruthy();
    expect(SORTS.maree_d_encre.effet?.stat).toBe("degatsInfliges");
    expect(SORTS.bourrasque_de_pollen.deplaceCible).toBe("arriere");
    expect(SORTS.pluie_de_pommes.zoneLigne).toBe(true);
  });
});

describe("zone Clos des Blops", () => {
  it("ouvre la Tranche 2 et porte la toile 13", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[0]).toBe("clos_des_blops");
    expect(zonesDeTranche(t2)[0].nom).toBe("Clos des Blops");
    expect(localiserZone("clos_des_blops")!.tranche.id).toBe("t2");
    expect(toileDeZone("clos_des_blops")).toBe(13); // T1 = toiles 1-12
    expect(offsetToile("t2")).toBe(12);
  });

  it("propose 6 salles de boss, chacune avec DEUX Royaux distincts et les deux escortes", () => {
    const zone = ZONES.find((z) => z.id === "clos_des_blops")!;
    expect(zone.pools.boss.length).toBe(6);
    const paires = new Set<string>();
    for (const id of zone.pools.boss) {
      const ennemis = COMBATS[id].ennemis.map((e) => e.monstre);
      const royaux = ennemis.filter((m) => m.endsWith("_royal"));
      expect(royaux.length, `${id} : il faut exactement 2 Royaux`).toBe(2);
      expect(new Set(royaux).size, `${id} : les 2 Royaux doivent être distincts`).toBe(2);
      expect(ennemis).toContain("gloutoblop");
      expect(ennemis).toContain("blopignon");
      expect(ennemis.length).toBe(4); // salle 4v4
      paires.add([...royaux].sort().join("+"));
    }
    expect(paires.size, "les 6 paires doivent être différentes").toBe(6);
  });

  it("les Biblops tiennent la rangée avant dans le pack le plus dense", () => {
    const zone = ZONES.find((z) => z.id === "clos_des_blops")!;
    const dense = COMBATS[zone.pools.normales[zone.pools.normales.length - 1]];
    const biblops = dense.ennemis.filter((e) => e.monstre.startsWith("biblop_"));
    expect(biblops.length).toBeGreaterThanOrEqual(2);
    for (const b of biblops) expect(b.position).toBeLessThan(4); // rangée avant
    const blops = dense.ennemis.filter((e) => /^blop_[a-z]+$/.test(e.monstre));
    for (const b of blops) expect(b.position).toBeGreaterThanOrEqual(4); // rangée arrière
  });

});

// La panoplie de la toile 13 est retirée en attendant que le contenu d'objets
// soit fourni : le Clos des Blops ne lâche donc rien pour l'instant, et sa toile
// n'a pas de pool. Les tests de butin de cette zone reviendront avec les objets.
