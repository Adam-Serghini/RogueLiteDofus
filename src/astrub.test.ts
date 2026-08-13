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

describe("Champs d'Astrub — la peur déplace", () => {
  it("l'Épouvanteur porte la signature, sur un sort de DÉGÂTS", () => {
    // `iaAgressif` ne joue que les invocations et les sorts `type: "degats"` :
    // un `buff` ou un `debuff` ne partirait jamais. C'est la contrainte qui
    // décide de la forme de toutes les signatures de zone.
    const s = SORTS.epouvante;
    expect(s, "le sort epouvante doit exister").toBeTruthy();
    expect(s.type).toBe("degats");
    // Valeur EXACTE, pas `toBeTruthy` : `"arriere"` passerait aussi, alors que
    // la description promet « bascule dans la rangée opposée » — donc un aller
    // ET un retour. Une desc est un engagement.
    expect(s.deplaceCible).toBe("toggle");
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
