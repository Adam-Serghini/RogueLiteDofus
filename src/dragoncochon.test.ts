// =============================================================================
//  dragoncochon.test.ts — Antre du Dragon Cochon (zone 8 de la Tranche 2)
//  voracité (dissipePositifs : boucliers ET buffs retirés), budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";

const ELEMENT_DE = {
  porsalu: "terre", cochon_de_farle: "terre",
  gorgouille: "eau", berger_porkass: "eau",
  cavalier_porkass: "air", don_duss_ang: "air", don_dorgan: "air",
  dragon_cochon: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  porsalu: "Porsalé le Râleur",
  cochon_de_farle: "Farlon l'Enfant",
  berger_porkass: "Porfavor le Quémandeur",
  cavalier_porkass: "Cavordemal le Sorcier",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire de l'Antre du Dragon Cochon", () => {
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

  it("aucun sprite en doublon dans la zone", () => {
    // Garde-fou permanent : le Cochon de Lait a été écarté de cette zone parce qu'il
    // partage le gfx 68 avec Porsalu (le Bestiaire aurait montré deux fois la même
    // image), comme Kirboule l'Érodé l'avait été aux Pitons. Ce test l'aurait
    // attrapé tout seul.
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("le boss est le SEUL monstre feu de la zone", () => {
    // L'intelligence compte DEUX fois — scaling élémentaire ET `multOffensif`, qu'elle
    // plafonne à +50 % dès 100 — donc un monstre feu frappe ~38 % plus fort qu'un
    // autre à dominante égale. Au Bateau du Chouque, cela avait fait du seul monstre
    // feu de la zone son meilleur DPS, AU-DESSUS des deux boss. Ici la règle est
    // retournée : le doublement joue pour le boss, et rien n'est à brider.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (MONSTRES[id].boss) expect(dominante(id), `${id} (boss) doit être feu`).toBe("intelligence");
      else expect(dominante(id), `${id} ne doit pas être feu`).not.toBe("intelligence");
    }
  });

  it("qui frappe deux fois frappe plus faible", () => {
    // Sinon deux morsures d'un ennemi à 8 PA dépassent le boss (4e inversion évitée).
    for (const rapide of ["don_duss_ang", "don_dorgan"]) {
      expect(MONSTRES[rapide].pa).toBe(8);
      for (const lent of ["porsalu", "cochon_de_farle"]) {
        expect(dom(rapide), `${rapide} doit frapper plus faible que ${lent}`).toBeLessThan(dom(lent));
      }
    }
  });

  it("aucune escorte n'a le budget de PA du boss", () => {
    // Leçon du Grand Pa Wabbit au Terrier : une escorte à 10 PA serre inutilement le
    // garde-fou de domination.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (!MONSTRES[id].boss) expect(MONSTRES[id].pa, `${id}`).toBeLessThan(MONSTRES.dragon_cochon.pa);
    }
  });
});

describe("les sorts de la voracité", () => {
  it("les deux sorts désenvoûtent leur cible", () => {
    for (const id of ["morsure_vorace", "goinfrerie"]) {
      const s = SORTS[id];
      expect(s, `${id} manquant`).toBeTruthy();
      expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
      expect(s.procAleatoire?.[0]?.dissipePositifs, `${id}`).toBe(true);
    }
  });

  it("le désenvoûtement est DÉTERMINISTE : un seul proc possible", () => {
    // `procAleatoire` tire `Math.floor(rng() × longueur)`. À une entrée l'index vaut
    // toujours 0 ; à deux, la leçon de la zone ne sortirait qu'une fois sur deux, sans
    // que rien ne le signale.
    for (const id of ["morsure_vorace", "goinfrerie"]) {
      expect(SORTS[id].procAleatoire, `${id}`).toHaveLength(1);
    }
  });

  it("la signature du boss est plus chère et rechargée, la morsure non", () => {
    expect(SORTS.goinfrerie.coutPA).toBe(6);
    expect(SORTS.goinfrerie.cooldownTours).toBe(2);
    expect(SORTS.morsure_vorace.coutPA).toBe(4);
    expect(SORTS.morsure_vorace.cooldownTours).toBeUndefined();
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "antre_dragon_cochon")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Antre du Dragon Cochon", () => {
  it("est la 8e zone de la Tranche 2, sur la toile 20", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[7]).toBe("antre_dragon_cochon");
    const loc = localiserZone("antre_dragon_cochon")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(20); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale a UN boss, qui lâche le Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "antre_dragon_cochon")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss)).toEqual(["dragon_cochon"]);
    expect(MONSTRES.dragon_cochon.dofus).toBe("dofus_turquoise");
  });

  it("chaque pack normal contient un porteur de désenvoûtement", () => {
    // La leçon se paie tôt et sur un petit ennemi, avant de la subir face au boss.
    const zone = ZONES.find((z) => z.id === "antre_dragon_cochon")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) =>
        MONSTRES[e.monstre].sorts.some((s) => SORTS[s].procAleatoire?.[0]?.dissipePositifs));
      expect(porte, `${id} n'enseigne pas la voracité`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "antre_dragon_cochon")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "antre_dragon_cochon")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "antre_dragon_cochon")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 20 ne lâche rien pour l'instant", () => {
    expect(butinToile("antre_dragon_cochon")).toBeNull();
  });
});
