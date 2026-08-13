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

/** Sorts qu'un kit peut RÉELLEMENT lancer, en rejouant la boucle de décision de
 *  `iaAgressif`/`iaSoutien` sur plusieurs tours (cooldowns compris).
 *
 *  `paPerdus` ne voit qu'une chose : le budget part-il en entier ? Il ne voit pas
 *  qu'un sort peut être payable et pourtant n'être JAMAIS choisi. `iaAgressif`
 *  trie par coût DÉCROISSANT avec un tri STABLE puis renvoie le PREMIER sort dont
 *  la cible est valide : à coût égal, l'ordre du tableau `sorts` tranche
 *  définitivement, et un sort qui consomme tout le budget masque tous les autres.
 *  Un sort inatteignable est du contenu qui ment — il s'affiche sur la fiche, il
 *  ne part jamais.
 *
 *  L'union des quatre scénarios rend la mesure PESSIMISTE sur le verdict « mort » :
 *  un sort n'est signalé que s'il reste injouable dans TOUS les cas de figure.
 *  - `avecInvocation` : `iaAgressif` ne joue une invocation que si `invocationUtile`
 *    l'autorise (terrain plein → non). Les deux branches existent en jeu.
 *  - `avecSoin` : `iaSoutien` ne consomme son soin que s'il a un allié blessé.
 *  Le coût lu est `coutPA` et non `coutEffectif` : c'est une garde de CONTENU, elle
 *  ne connaît ni buff ni réduction de coût en cours de combat. */
const TOURS_SIMULES = 12; // > au plus long cooldown des kits, marge comprise

const sortsJoues = (id: string, avecInvocation: boolean, avecSoin: boolean): Set<string> => {
  const mo = MONSTRES[id];
  const sorts = mo.sorts.map((sid) => SORTS[sid]).filter((s) => s);
  const atteints = new Set<string>();
  const cooldowns: Record<string, number> = {};

  for (let tour = 0; tour < TOURS_SIMULES; tour++) {
    let reste = mo.pa;
    const posesCeTour = new Set<string>();
    const dispo = (s: typeof sorts[number]) => !cooldowns[s.id] && s.coutPA <= reste;
    const jouer = (s: typeof sorts[number]) => {
      atteints.add(s.id);
      reste -= s.coutPA;
      // le cooldown prend effet IMMÉDIATEMENT, donc dès la décision suivante
      if (s.cooldownTours) { cooldowns[s.id] = s.cooldownTours; posesCeTour.add(s.id); }
    };

    if (mo.ia === "soutien" && avecSoin) {
      const soin = sorts.find((s) => s.type === "soin" && dispo(s));
      if (soin) jouer(soin);
    }
    for (let garde = 0; garde < 30; garde++) {
      const invoc = avecInvocation
        ? sorts.find((s) => s.type === "invocation" && dispo(s))
        : undefined;
      const choisi = invoc ?? sorts
        .filter((s) => s.type === "degats" && dispo(s))
        .sort((a, b) => b.coutPA - a.coutPA)[0]; // tri STABLE : à coût égal, l'ordre du kit tranche
      if (!choisi) break;
      jouer(choisi);
    }
    // fin de tour : un cooldown posé PENDANT ce tour n'est pas décompté ici
    for (const k of Object.keys(cooldowns)) {
      if (posesCeTour.has(k)) continue;
      if (--cooldowns[k] <= 0) delete cooldowns[k];
    }
  }
  return atteints;
};

const sortsMorts = (id: string): string[] => {
  const atteignables = new Set([
    ...sortsJoues(id, true, true), ...sortsJoues(id, true, false),
    ...sortsJoues(id, false, true), ...sortsJoues(id, false, false),
  ]);
  return MONSTRES[id].sorts.filter((sid) => !atteignables.has(sid));
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

  it("aucun sort d'un kit n'est inatteignable par le contrôleur IA", () => {
    // Troisième occurrence du même piège dans ce dépôt, et il est PUREMENT
    // mécanique, donc entièrement testable : un sort masqué par un autre de coût
    // égal (l'ordre du tableau tranche) ou par un sort qui avale le budget entier
    // ne part jamais. Le kit ment alors sur ce que l'espèce sait faire.
    for (const id of especesDeLaZone()) {
      expect(sortsMorts(id), `${id} porte un sort que l'IA ne lancera jamais`).toEqual([]);
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

  it("la Larve Dorée peut enfin lancer sa charge — et elle ne porte QU'elle", () => {
    expect(MONSTRES.larve_doree.pa).toBe(6);
    expect(SORTS.charge.coutPA).toBeLessThanOrEqual(MONSTRES.larve_doree.pa);
    // Même bascule que le Scarafeuille Noir : à 6 PA, `charge` consomme le
    // budget entier chaque tour, donc `morsure` ne partait plus jamais. Elle a
    // été retirée — le kit dit maintenant ce que la Larve fait vraiment.
    expect(MONSTRES.larve_doree.sorts).toEqual(["charge"]);
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
