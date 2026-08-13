// =============================================================================
//  scarafeuilles.test.ts — Donjon des Scarafeuilles (zone 8, toile 8)
//  La poussière aveugle : ton soin n'est pas garanti.
// =============================================================================
import { describe, it, expect } from "vitest";
import combatUiSrc from "./ui/combat.ts?raw";
import { MONSTRES, SORTS, ZONES, COMBATS } from "./data";

const zone = () => ZONES.find((z) => z.id === "scarafeuilles")!;

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

describe("Donjon des Scarafeuilles — hygiène des kits", () => {
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

describe("Donjon des Scarafeuilles — la poussière aveugle", () => {
  it("le Rouge porte la signature, sur un sort de DÉGÂTS", () => {
    const s = SORTS.poussiere_incandescente;
    expect(s, "le sort poussiere_incandescente doit exister").toBeTruthy();
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.effet?.stat).toBe("echecCritique");
    expect(MONSTRES.scarafeuille_rouge.sorts).toContain("poussiere_incandescente");
  });

  it("la durée DOIT rester à 1 tour : l'échec critique se cumule", () => {
    // `appliquerEffet` EMPILE (il ne remplace pas l'entrée existante) et
    // `sommeEffet` ADDITIONNE, et le tirage n'a aucun plafond. À `duree: 2`, un
    // seul porteur qui relance chaque tour installe donc un régime permanent à
    // 2 × valeur, et deux porteurs peuvent dépasser 1,0 : le héros ne lance plus
    // jamais rien tout en payant ses PA. Le taux effectif se raisonne toujours
    // « valeur × nombre de porteurs qui tirent sur la même cible ».
    expect(SORTS.poussiere_incandescente.effet!.duree).toBe(1);
    expect(SORTS.poussiere_incandescente.effet!.valeur).toBeLessThanOrEqual(0.2);
  });

  it("la signature culmine sur le boss, et il la lance VRAIMENT", () => {
    // Une signature de zone portée par une seule escorte se lit comme une
    // bizarrerie ; portée aussi par le boss, elle se lit comme l'identité du lieu.
    expect(MONSTRES.scarabosse_dore.sorts).toContain("poussiere_incandescente");
    // Mais la porter ne suffit pas : `iaAgressif` trie les sorts de dégâts par
    // coût DÉCROISSANT avec un tri STABLE, donc à coût égal c'est l'ordre du
    // tableau qui tranche. Tant que `morsure` (4 PA) précédait la poussière
    // (4 PA), le boss ne l'a jamais lancée une seule fois — signature morte.
    const sorts = MONSTRES.scarabosse_dore.sorts;
    expect(sorts.indexOf("poussiere_incandescente")).toBeLessThan(sorts.indexOf("morsure"));
  });

  it("le Scarafeuille Noir peut enfin lancer sa charge", () => {
    // Il la portait avec 5 PA pour un coût de 6 : elle ne partait jamais.
    expect(MONSTRES.scarafeuille_noir.pa).toBe(6);
    expect(SORTS.charge.coutPA).toBeLessThanOrEqual(MONSTRES.scarafeuille_noir.pa);
  });

  it("aucune leçon de la Tranche 2 n'est dépensée ici", () => {
    // friction, tetanise, contre, armure, poison et dissipePositifs sont la
    // pédagogie des zones 13-24 : les utiliser en T1 la grillerait.
    const RESERVES = ["friction", "tetanise", "contre", "armure", "poison"];
    for (const id of especesDeLaZone()) {
      for (const sid of MONSTRES[id].sorts) {
        const s = SORTS[sid];
        expect(RESERVES, `${sid} dépense une leçon de T2`).not.toContain(s.effet?.stat);
        expect(s.poison, `${sid} dépense la leçon poison de T2`).toBeUndefined();
        expect(s.dissipePositifs, `${sid} dépense la leçon dissipePositifs de T2`).toBeFalsy();
      }
    }
  });
});

describe("l'échec critique est visible en combat", () => {
  it("le badge existe dans la carte de combattant", () => {
    // Jurisprudence : « une réduction ou un compteur invisible se lit comme un
    // bug ». Un sort qui rate sans rien afficher serait illisible.
    // `?raw` (import statique Vite) plutôt que `node:fs` : même raison que le
    // test des icônes du Sram — pas de déclaration ambiante pour `node:fs` qui
    // rendrait `readFileSync` légal depuis n'importe quel module de src/.
    expect(combatUiSrc, "carteCombattant doit afficher un badge pour echecCritique")
      .toContain('e.stat === "echecCritique"');
  });
});
