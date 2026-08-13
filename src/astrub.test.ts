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

describe("Champs d'Astrub — la peur déplace", () => {
  it("l'Épouvanteur porte la signature, sur un sort de DÉGÂTS", () => {
    // `iaAgressif` ne joue que les invocations et les sorts `type: "degats"` :
    // un `buff` ou un `debuff` ne partirait jamais. C'est la contrainte qui
    // décide de la forme de toutes les signatures de zone.
    const s = SORTS.epouvante;
    expect(s, "le sort epouvante doit exister").toBeTruthy();
    expect(s.type).toBe("degats");
    expect(s.deplaceCible).toBeTruthy();
    expect(MONSTRES.epouvanteur.sorts).toContain("epouvante");
  });

  it("Épouvante REMPLACE la morsure — sinon elle ne partirait jamais", () => {
    // 5 PA, un sort à 4 et un à 1 : le budget passe entier. Garder `morsure`
    // (4 PA) à côté d'Épouvante (4 PA) ferait jouer l'un OU l'autre au hasard
    // de l'ordre de tri, et la signature deviendrait intermittente.
    // `.sort()` mute en place : trier une COPIE, jamais `MONSTRES.epouvanteur.sorts`
    // directement — `MONSTRES` est l'objet de contenu partagé par toute la suite.
    expect([...MONSTRES.epouvanteur.sorts].sort()).toEqual(["epouvante", "grignotage"]);
    expect(MONSTRES.epouvanteur.pa).toBe(5);
  });

  it("deux espèces sur quatre restent NUES — c'est la toile 2", () => {
    // La zone d'initiation ne doit pas devenir un festival de mécaniques :
    // le socle « je tape, tu tapes » a une valeur pédagogique propre.
    for (const id of ["tournesol_sauvage", "pissenlit_diabolique"]) {
      const riders = MONSTRES[id].sorts
        .flatMap((sid) => Object.keys(SORTS[sid]))
        .filter((k) => !["id", "nom", "type", "coutPA", "cible", "baseMin", "baseMax", "desc", "img"].includes(k));
      expect(riders, `${id} doit rester sans mécanique`).toEqual([]);
    }
  });
});
