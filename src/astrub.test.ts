// =============================================================================
//  astrub.test.ts — Champs d'Astrub (zone 2 de la Tranche 1, toile 2)
//  La zone d'initiation : deux espèces restent volontairement nues, et
//  l'Épouvanteur y enseigne que la règle de ligne peut se retourner contre toi.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, COMBATS } from "./data";

const zone = () => ZONES.find((z) => z.id === "astrub")!;

const especesDeLaZone = (): Set<string> => {
  const z = zone();
  return new Set([...z.pools.normales, ...z.pools.elite, ...z.pools.boss]
    .flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

/** PA perdus par tour, en simulant `iaAgressif` : le plus cher d'abord, sans
 *  mémoire du tour. Un budget non dépensable est un monstre qui frappe moins
 *  fort que son fiche ne le laisse croire — c'est le piège « PA orphelins ». */
const paPerdus = (id: string): number => {
  const mo = MONSTRES[id];
  const couts = mo.sorts
    .map((sid) => SORTS[sid])
    .filter((s) => s && ["degats", "invocation", "soin"].includes(s.type))
    .map((s) => s.coutPA)
    .filter((c) => c <= mo.pa)
    .sort((a, b) => b - a);
  let reste = mo.pa;
  for (let garde = 0; garde < 30; garde++) {
    const c = couts.find((x) => x <= reste);
    if (c === undefined) break;
    reste -= c;
  }
  return reste;
};

describe("Champs d'Astrub — hygiène des kits", () => {
  it("aucune espèce ne porte un sort qu'elle ne peut pas payer", () => {
    for (const id of especesDeLaZone()) {
      for (const sid of MONSTRES[id].sorts) {
        expect(SORTS[sid].coutPA, `${id} ne pourra jamais lancer ${sid}`)
          .toBeLessThanOrEqual(MONSTRES[id].pa);
      }
    }
  });

  it("chaque espèce peut dépenser tout son budget de PA", () => {
    for (const id of especesDeLaZone()) {
      expect(paPerdus(id), `${id} gaspille des PA chaque tour`).toBe(0);
    }
  });
});
