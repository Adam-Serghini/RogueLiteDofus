// =============================================================================
//  larves.test.ts — Donjon des Larves (zone 10, toile 10)
//  Elles drainent : l'ordre dans lequel tu tues compte.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, COMBATS } from "./data";

const zone = () => ZONES.find((z) => z.id === "larves")!;

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

describe("Donjon des Larves — hygiène des kits", () => {
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

describe("Donjon des Larves — elles drainent", () => {
  it("les larves d'EAU portent la signature, sur un sort de DÉGÂTS", () => {
    const s = SORTS.succion;
    expect(s, "le sort succion doit exister").toBeTruthy();
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.vampirismeRatio).toBeGreaterThan(0);
    for (const id of ["larve_bleue", "larve_saphir"]) {
      expect(MONSTRES[id].sorts, `${id} doit drainer`).toContain("succion");
    }
  });

  it("l'eau est bien l'élément qui draine — cohérence couleur/mécanique", () => {
    // La couleur décide qui porte la signature : c'est ce qui rend la salle
    // lisible d'un coup d'œil. Une larve de terre qui drainerait casserait
    // la grammaire de la zone.
    for (const id of ["larve_bleue", "larve_saphir"]) {
      const st = MONSTRES[id].stats as unknown as Record<string, number>;
      const dominante = Object.entries(st)
        .filter(([k]) => k !== "vitalite")
        .sort((a, b) => b[1] - a[1])[0][0];
      expect(dominante, `${id} doit dominer en chance (eau)`).toBe("chance");
    }
  });

  it("les six autres larves restent nues — neuf mécaniques seraient illisibles", () => {
    for (const id of ["larve_verte", "larve_orange", "larve_rubis",
      "larve_champetre", "larve_emeraude", "larve_jaune"]) {
      // `[...x].sort()` : `sort` mute, et `MONSTRES` est partagé par toute la suite.
      expect([...MONSTRES[id].sorts].sort(), `${id} doit rester simple`)
        .toEqual(["grignotage", "morsure"]);
    }
  });

  it("la ponte du boss peut faire naître une larve qui draine", () => {
    // Le design se referme tout seul : le pool de `ponte_larvaire` contient la
    // Larve Bleue, donc le combat de boss devient une course contre son propre
    // soutien — sans une ligne de contenu de plus.
    expect(SORTS.ponte_larvaire.invoqueMonstre!.pool).toContain("larve_bleue");
  });

  it("la Larve Dorée peut enfin lancer sa charge", () => {
    expect(MONSTRES.larve_doree.pa).toBe(6);
    expect(SORTS.charge.coutPA).toBeLessThanOrEqual(MONSTRES.larve_doree.pa);
  });
});
