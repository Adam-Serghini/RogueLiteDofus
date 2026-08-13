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

/** PA perdus par tour, en simulant le VRAI contrôleur (`src/combat.ts`) :
 *  - `ia: "agressif"` → `iaAgressif` seul : le sort `degats`/`invocation` le
 *    plus cher payable d'abord, sans mémoire du tour. Il ne joue JAMAIS de
 *    `soin` — un monstre agressif qui en porterait un le gaspillerait
 *    entièrement, ce que ce helper reflète en excluant `soin` de son calcul.
 *  - `ia: "soutien"` → `iaSoutien` : tente D'ABORD un `soin` payable (un seul,
 *    comme le vrai contrôleur qui le retenterait mais n'a en pratique droit
 *    qu'à un lancer avant que son coût n'excède le budget restant), puis
 *    retombe sur `iaAgressif` pour le reste du budget.
 *  Un budget non dépensable est un monstre qui frappe moins fort que sa
 *  fiche ne le laisse croire — c'est le piège « PA orphelins ». */
const paPerdus = (id: string): number => {
  const mo = MONSTRES[id];
  const sorts = mo.sorts.map((sid) => SORTS[sid]).filter((s) => s);
  let reste = mo.pa;

  if (mo.ia === "soutien") {
    const soin = sorts.find((s) => s.type === "soin" && s.coutPA <= reste);
    if (soin) reste -= soin.coutPA;
  }

  const couts = sorts
    .filter((s) => ["degats", "invocation"].includes(s.type))
    .map((s) => s.coutPA)
    .filter((c) => c <= reste)
    .sort((a, b) => b - a);
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
