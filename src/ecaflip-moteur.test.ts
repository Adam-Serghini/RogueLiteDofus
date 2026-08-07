// =============================================================================
//  ecaflip-moteur.test.ts — Task 1 du rework Ecaflip : les primitives du pipeline
//  de dégâts (rembPASiCrit, elementPire/elementImpose, secondCoupSiCrit,
//  degatsCritSubis, effetLigneCible, soinAvantBlesseRatio).
//
//  Aucun contenu réel n'utilise encore ces champs (Task 3) : chaque bloc construit
//  un sort synthétique à partir d'un sort existant (SORTS.morsure).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, degatsCible, elementsCandidats, estAvant, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant, Element, Spell } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit (seuils ≤ 0.5)
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Ecaflip prêt à combattre, agilité nulle par défaut (esquive/crit déterministes). */
function ecaflip(): Combatant {
  const c = equipeCombattante(nouvelleRun(["ecaflip"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

/** Un mannequin ennemi sans résistances, PV confortables. */
function mannequin(id = "combat_1"): Combatant {
  const e = fabriquerEnnemis(id)[0];
  e.stats = { ...e.stats, agilite: 0 };
  e.resistances = {};
  e.pvMax = 500; e.pvActuels = 500;
  return e;
}

describe("rembPASiCrit", () => {
  it("rend les PA sur critique, et rien sans critique", () => {
    const spell: Spell = { ...SORTS.morsure, id: "test_remb_crit", rembPASiCrit: 2 };

    const lanceurCrit = ecaflip();
    const cibleCrit = mannequin();
    const avantCrit = lanceurCrit.paActuels;
    // rng()=0 : 0 < seuil d'esquive (0) est faux (pas d'esquive), et 0 < chanceCritEffective
    // (0.05 au plancher) est vrai → critique.
    lancerSort(lanceurCrit, spell, cibleCrit.ref, [lanceurCrit, cibleCrit], ctx({ rng: () => 0 }));
    expect(avantCrit).toBeDefined();
    expect(lanceurCrit.paActuels).toBe(avantCrit + spell.rembPASiCrit!);

    const lanceurSansCrit = ecaflip();
    const cibleSansCrit = mannequin();
    const avantSansCrit = lanceurSansCrit.paActuels;
    // rng()=0.5 : ni esquive (seuil 0), ni critique (seuil 0.05).
    lancerSort(lanceurSansCrit, spell, cibleSansCrit.ref, [lanceurSansCrit, cibleSansCrit], ctx({ rng: () => 0.5 }));
    expect(lanceurSansCrit.paActuels).toBe(avantSansCrit);
  });
});

describe("elementPire / elementImpose", () => {
  /** Ecaflip avec l'élément libre (les 4 candidats) et des stats qui donnent un
   *  classement net et sans ambiguïté : terre > eau > air > feu. */
  function ecaflipLibre(): Combatant {
    const c = ecaflip();
    c.elementLibre = true;
    c.stats = { ...c.stats, force: 100, chance: 50, agilite: 10, intelligence: 1 };
    return c;
  }

  it("elementPire choisit le DERNIER du classement (le pire), pas le meilleur", () => {
    const lanceur = ecaflipLibre();
    const cible = mannequin();
    const spell: Spell = { ...SORTS.morsure, id: "test_pire", elementPire: true };
    const r = degatsCible(lanceur, spell, cible, { useMax: true, mult: 1, ctx: ctx() });
    expect(r.element).toBe("feu"); // stat la plus faible (intelligence = 1)
  });

  it("sans elementPire, le meilleur élément (le premier du classement) est employé", () => {
    const lanceur = ecaflipLibre();
    const cible = mannequin();
    const spell: Spell = { ...SORTS.morsure, id: "test_meilleur" };
    const r = degatsCible(lanceur, spell, cible, { useMax: true, mult: 1, ctx: ctx() });
    expect(r.element).toBe("terre"); // stat la plus forte (force = 100)
  });

  it("elementImpose court-circuite le choix, même avec elementPire", () => {
    const lanceur = ecaflipLibre();
    const cible = mannequin();
    const spell: Spell = { ...SORTS.morsure, id: "test_impose", elementPire: true, elementImpose: "air" };
    const r = degatsCible(lanceur, spell, cible, { useMax: true, mult: 1, ctx: ctx() });
    expect(r.element).toBe("air");
  });
});

describe("neutralité du refactor meilleurElement → elementsClasses", () => {
  it("à égalité de score, le classement conserve l'ordre des candidats déclarés", () => {
    // Ecaflip normal (pas elementLibre) : ses 2 candidats sont sa paire déclarée
    // ["terre", "eau"], dans cet ordre. Force = Chance et cible sans résistance
    // → les deux éléments ont EXACTEMENT le même score.
    const lanceur = ecaflip();
    lanceur.stats = { ...lanceur.stats, force: 50, chance: 50 };
    const cible = mannequin();
    expect(elementsCandidats(lanceur)).toEqual(["terre", "eau"]);

    const spell: Spell = { ...SORTS.morsure, id: "test_egalite" };
    const r = degatsCible(lanceur, spell, cible, { useMax: true, mult: 1, ctx: ctx() });
    // Le premier candidat déclaré doit gagner l'égalité — c'est ce que choisissait
    // la boucle « premier strictement supérieur » d'avant le refactor.
    expect(r.element).toBe("terre");
    expect(r.element).toBe(elementsCandidats(lanceur)[0]);
  });
});

describe("secondCoupSiCrit", () => {
  /** Même Ecaflip que le bloc elementPire : classement net terre > eau > air > feu. */
  function ecaflipLibre(): Combatant {
    const c = ecaflip();
    c.elementLibre = true;
    c.stats = { ...c.stats, force: 100, chance: 50, agilite: 10, intelligence: 1 };
    return c;
  }

  it("sur critique : deux coups, le second dans l'AUTRE (meilleur) élément, et le second ne critique pas", () => {
    const lanceur = ecaflipLibre();
    const cible = mannequin();
    const spell: Spell = { ...SORTS.morsure, id: "test_bluff", elementPire: true, secondCoupSiCrit: true };

    const elements: Element[] = [];
    // Séquence de rng consommée par degatsAvec, DEUX fois (un coup, puis le retour) :
    // [esquive, jet, crit] × 2. On force le crit du PREMIER coup (0 < 0.05) et
    // on force l'ABSENCE de crit du second (0.5 ≥ 0.05), sans jamais esquiver (seuil 0).
    const seq = [0, 0, 0, 0, 0, 0.5];
    let i = 0;
    const rngSeq = () => seq[Math.min(i++, seq.length - 1)];
    const logCtx = ctx({
      rng: rngSeq,
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
    });

    lancerSort(lanceur, spell, cible.ref, [lanceur, cible], logCtx);

    expect(elements).toEqual(["feu", "terre"]); // pire, puis meilleur
  });

  it("sans critique : un seul coup est porté", () => {
    const lanceur = ecaflipLibre();
    const cible = mannequin();
    const spell: Spell = { ...SORTS.morsure, id: "test_bluff_sans_crit", elementPire: true, secondCoupSiCrit: true };

    const elements: Element[] = [];
    const logCtx = ctx({
      rng: () => 0.5, // jamais d'esquive (seuil 0), jamais de critique (seuil 0.05)
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
    });

    lancerSort(lanceur, spell, cible.ref, [lanceur, cible], logCtx);

    expect(elements).toEqual(["feu"]);
  });
});

describe("degatsCritSubis", () => {
  it("majore de 5 % un critique subi par une cible marquée, à jet identique, SEULEMENT sur critique", () => {
    const lanceur = ecaflip();
    lanceur.stats = { ...lanceur.stats, force: 100 };
    const cibleSaine = mannequin();
    const cibleMarquee = mannequin();
    cibleMarquee.effets.push({ stat: "degatsCritSubis", valeur: 0.05, toursRestants: 3 });
    const spell: Spell = { ...SORTS.morsure, id: "test_crit_subi" };

    // --- critique forcé (rng=0 : pas d'esquive, jet bas, crit) ---
    const rCritSain = degatsCible(lanceur, spell, cibleSaine, { useMax: true, mult: 1, ctx: ctx({ rng: () => 0 }) });
    const rCritMarque = degatsCible(lanceur, spell, cibleMarquee, { useMax: true, mult: 1, ctx: ctx({ rng: () => 0 }) });
    expect(rCritSain.crit).toBe(true);
    expect(rCritMarque.crit).toBe(true);
    // ±1 : le pipeline n'arrondit qu'en bout de chaîne (convention du projet, voir ouginak.test.ts).
    expect(Math.abs(rCritMarque.dmg - Math.round(rCritSain.dmg * 1.05))).toBeLessThanOrEqual(1);

    // --- pas de critique (rng=0.5) : le débuff ne doit PAS s'appliquer hors du bloc crit ---
    const rSain = degatsCible(lanceur, spell, cibleSaine, { useMax: true, mult: 1, ctx: ctx({ rng: () => 0.5 }) });
    const rMarque = degatsCible(lanceur, spell, cibleMarquee, { useMax: true, mult: 1, ctx: ctx({ rng: () => 0.5 }) });
    expect(rSain.crit).toBe(false);
    expect(rMarque.crit).toBe(false);
    expect(rMarque.dmg).toBe(rSain.dmg);
  });
});

describe("effetLigneCible", () => {
  it("applique le débuff à TOUTE la rangée de la cible, sans cumul (durée rafraîchie)", () => {
    const lanceur = ecaflip();
    const ennemis = fabriquerEnnemis("combat_elite"); // 4 ennemis
    ennemis.forEach((e, i) => {
      e.stats = { ...e.stats, agilite: 0 };
      e.position = i < 3 ? i : 4; // 3 en rangée avant, 1 en arrière (témoin)
      e.pvMax = 500; e.pvActuels = 500; e.resistances = {};
    });
    const [e0, e1, e2, arriere] = ennemis;
    const cs = [lanceur, ...ennemis];
    const spell: Spell = {
      ...SORTS.morsure, id: "test_ligne_cible",
      effetLigneCible: { stat: "degatsInfliges", valeur: -0.1, duree: 2 },
    };

    lancerSort(lanceur, spell, e0.ref, cs, ctx());

    for (const e of [e0, e1, e2]) {
      const marques = e.effets.filter((x) => x.stat === "degatsInfliges");
      expect(marques.length, e.ref).toBe(1);
      expect(marques[0].valeur).toBe(-0.1);
      expect(marques[0].toursRestants).toBe(2);
    }
    expect(estAvant(arriere)).toBe(false);
    expect(arriere.effets.some((x) => x.stat === "degatsInfliges")).toBe(false);

    // Simule un tour écoulé, puis un second lancer (ciblant un AUTRE membre de la
    // même rangée) : pas de cumul, la durée est rafraîchie pour tout le monde.
    e0.effets.find((x) => x.stat === "degatsInfliges")!.toursRestants = 1;
    lancerSort(lanceur, spell, e1.ref, cs, ctx());

    const marquesE0 = e0.effets.filter((x) => x.stat === "degatsInfliges");
    expect(marquesE0.length).toBe(1); // pas de doublon
    expect(marquesE0[0].valeur).toBe(-0.1); // pas doublé
    expect(marquesE0[0].toursRestants).toBe(2); // durée rafraîchie
  });
});

describe("soinAvantBlesseRatio", () => {
  it("soigne le plus blessé de la RANGÉE AVANT, pas un allié plus blessé de l'arrière", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, front, back] = team;
    eca.position = 0;
    front.position = 1; front.pvMax = 100; front.pvActuels = 80; // avant, peu blessé
    back.position = 4; back.pvMax = 100; back.pvActuels = 50; // arrière, PLUS blessé
    expect(estAvant(front)).toBe(true);
    expect(estAvant(back)).toBe(false);

    const ennemi = mannequin();
    const cs = [eca, front, back, ennemi];
    const spell: Spell = { ...SORTS.morsure, id: "test_soin_avant", soinAvantBlesseRatio: 0.5 };

    lancerSort(eca, spell, ennemi.ref, cs, ctx());

    expect(front.pvActuels).toBeGreaterThan(80);
    expect(back.pvActuels).toBe(50); // inchangé : plus blessé, mais pas en rangée avant
  });
});
