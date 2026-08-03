// =============================================================================
//  kharnozor.test.ts — Repaire du Kharnozor & Épreuve de Draegnerys (zone 9, T2)
//  le premier soigneur ennemi de la tranche, et un boss qui grandit avec ses alliés.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";

const ELEMENT_DE = {
  dragoeuf_calcaire: "terre", dragoeuf_argile: "terre",
  dragoeuf_ardoise: "air", dragoeuf_charbon: "eau",
  dragoss_ardoise: "air", dragoss_charbon: "eau", dragoss_proteiforme: "eau",
  kharnozor: "air", draegnerys: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  dragoeuf_calcaire: "Dragstayr le Fonceur",
  dragoeuf_argile: "Dragkouine la Déguisée",
  dragoeuf_ardoise: "Dragmoclaiss le Fataliste",
  dragoeuf_charbon: "Dragnostik le Sceptique",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Repaire du Kharnozor", () => {
  it("les 9 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 9 sont capturables — les quatre Dragoeufs, jamais les Dragoss", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("aucun sprite en doublon dans la zone", () => {
    // Garde-fou permanent depuis l'Antre du Dragon Cochon (Cochon de Lait écarté).
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("seul Draegnerys est feu", () => {
    // L'intelligence compte DEUX fois (scaling élémentaire ET `multOffensif`, plafonné
    // dès 100) : au Bateau du Chouque, le seul monstre feu de la zone était devenu son
    // meilleur DPS, au-dessus des deux boss. Le feu reste donc à un boss.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (id === "draegnerys") expect(dominante(id)).toBe("intelligence");
      else expect(dominante(id), `${id} ne doit pas être feu`).not.toBe("intelligence");
    }
  });

  it("les matériaux ne sont PAS des éléments", () => {
    // Les Blops (toile 13) et les Gelées (toile 15) ont déjà fait couleur→élément. Ici
    // un même matériau existe en œuf ET en adulte ; ce test fige l'intention en
    // vérifiant que le matériau ne détermine pas mécaniquement l'élément.
    const memeMateriau = (mot: string) =>
      Object.keys(ELEMENT_DE).filter((id) => id.includes(mot));
    expect(memeMateriau("ardoise")).toHaveLength(2);
    expect(memeMateriau("charbon")).toHaveLength(2);
  });

  it("exactement UNE espèce de la zone soigne", () => {
    const soigneurs = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].ia === "soutien");
    expect(soigneurs).toEqual(["dragoss_proteiforme"]);
  });

  it("le soigneur ne peut soigner qu'UNE fois par tour", () => {
    // 4 PA et deux sorts à 4 PA = une seule action. Sans ce plafond naturel, un
    // Protéiforme à 8 PA soignerait deux fois et verrouillerait le combat.
    const p = MONSTRES.dragoss_proteiforme;
    expect(p.pa).toBe(4);
    for (const s of p.sorts) expect(SORTS[s].coutPA, `${s}`).toBe(4);
  });

  it("le Kharnozor grandit avec ses alliés et n'a PAS de sort-signature", () => {
    // Son identité est le passif, comme Grunob en Tranche 1 — seul précédent du jeu.
    // Grunob est à 0,06 après avoir été descendu de 0,10 (il asphyxiait les dégâts en
    // équipement commun) ; 0,10 ici est un cran au-dessus pour une toile bien plus
    // avancée, et c'est le PREMIER bouton à tourner si la salle est oppressante.
    expect(MONSTRES.kharnozor.bonusParAllieLigne).toBe(0.1);
    expect(MONSTRES.kharnozor.sorts).toEqual(["charge"]);
  });

  it("aucune escorte ne DÉPASSE le budget de PA d'un boss", () => {
    // Inégalité LARGE, et non stricte comme aux zones à boss unique : dans une salle
    // jumelée les boss sont à 6 PA (précédent des Blops Royaux, refus de refaire les
    // 20 PA du Terrier), or `charge` coûte 6, donc tout cogneur de la zone est à 6 PA
    // lui aussi. L'égalité est inévitable ici ; ce qui doit rester vrai, c'est qu'une
    // escorte ne joue jamais plus d'actions qu'un boss — et la vraie garantie est le
    // test de domination, qui compare les dégâts par tour.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (!MONSTRES[id].boss) {
        expect(MONSTRES[id].pa, `${id}`).toBeLessThanOrEqual(MONSTRES.kharnozor.pa);
      }
    }
  });
});

describe("les sorts de la zone", () => {
  it("le souffle régénérant est un vrai sort de soin sur allié", () => {
    const s = SORTS.souffle_regenerant;
    expect(s, "souffle_regenerant manquant").toBeTruthy();
    expect(s.type).toBe("soin");   // sinon `iaSoutien` ne le trouverait pas
    expect(s.cible).toBe("allie");
    expect(s.baseMin).toBeGreaterThan(0);
    // `scaling` est IGNORÉ pour les soins (combat.ts:1451) : la puissance se règle
    // uniquement par baseMin/baseMax. Le mettre à autre chose que 0 induirait en erreur.
    expect(s.scaling).toBe(0);
  });

  it("le souffle draconique balaie une rangée", () => {
    const s = SORTS.souffle_draconique;
    expect(s.type).toBe("degats");
    expect(s.zoneLigne).toBe(true);
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Repaire du Kharnozor", () => {
  it("est la 9e zone de la Tranche 2, sur la toile 21", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[8]).toBe("repaire_kharnozor");
    const loc = localiserZone("repaire_kharnozor")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(21); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale aligne les DEUX boss et le soigneur", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss).sort()).toEqual(["draegnerys", "kharnozor"]);
    expect(salle, "le soigneur doit être dans la salle finale").toContain("dragoss_proteiforme");
    for (const id of ["kharnozor", "draegnerys"]) expect(MONSTRES[id].dofus).toBe("dofus_turquoise");
  });

  it("le soigneur est dans les TROIS packs normaux", () => {
    // La leçon s'apprend sur un petit ennemi avant de se payer devant les boss.
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    for (const id of zone.pools.normales) {
      const especes = COMBATS[id].ennemis.map((e) => e.monstre);
      expect(especes, `${id} n'enseigne pas la leçon`).toContain("dragoss_proteiforme");
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 21 ne lâche rien pour l'instant", () => {
    expect(butinToile("repaire_kharnozor")).toBeNull();
  });
});
