// =============================================================================
//  feca-moteur.test.ts — Task 1 & 2 du rework Féca.
//
//  Task 1 : les primitives de rangée (effetRangeeAlliee, retraitPAProchainTour).
//  Task 2 : l'Égide — invocation qui intercepte pour autrui, une première dans
//  le moteur (la Poupée encaisse parce qu'elle provoque, la Lance encaisse ses
//  propres coups).
//
//  Aucun contenu réel n'utilise encore ces champs (Task 3) : chaque bloc construit
//  un sort synthétique à partir d'un sort existant (SORTS.morsure pour les
//  dégâts, un buff « soi » synthétique pour le soutien).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, effetsDebutTour, ciblesValides, invoquerEgide,
  purgerInvocationsOrphelines, runCombat, type CombatCtx,
} from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Action, BuffRangeeAlliee, Combatant, Spell } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

// `equipeCombattante` fabrique toujours un ref `j_${classeId}` : chaque héros de
// test a besoin d'un ref DISTINCT (les tests de rangée en placent plusieurs dans
// le même camp), d'où ce compteur.
let heroSeq = 0;

/** Un héros joueur prêt à combattre, agilité nulle par défaut (esquive/crit
 *  déterministes), positionnable librement pour les tests de rangée. */
function hero(position: number): Combatant {
  const c = equipeCombattante(nouvelleRun(["feca"]))[0];
  c.ref = `${c.ref}_${heroSeq++}`;
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  c.position = position;
  return c;
}

/** Une invocation alliée (Égide) : ne joue pas de tour, ne doit jamais recevoir
 *  de buff de rangée ni compter dans le seuil « deux héros devant ». */
function invocationAlliee(position: number): Combatant {
  const c = hero(position);
  c.estInvocation = true;
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

/** Sort de dégâts synthétique (chemin Vigie/Pâturage) portant un effetRangeeAlliee. */
function sortDegatsRangee(effetRangeeAlliee: BuffRangeeAlliee): Spell {
  return { ...SORTS.morsure, id: "test_degats_rangee", effetRangeeAlliee };
}

/** Sort de soutien synthétique, lancé sur soi (chemin Fortification). */
function sortSoutienRangee(effetRangeeAlliee: BuffRangeeAlliee): Spell {
  return {
    ...SORTS.morsure, id: "test_soutien_rangee", type: "buff", cible: "soi",
    baseMin: 0, baseMax: 0, effetRangeeAlliee,
  };
}

describe("effetRangeeAlliee — ciblage de rangée", () => {
  it("\"arriere\" buffe les alliés de la rangée arrière et AUCUN allié de la rangée avant", () => {
    const lanceur = hero(0); // avant
    const alliéAvant = hero(1); // avant
    const alliéArriere = hero(4); // arrière
    const ennemi = mannequin();
    const cs = [lanceur, alliéAvant, alliéArriere, ennemi];
    const spell = sortDegatsRangee({ rangee: "arriere", effets: [{ stat: "force", valeur: 5, duree: 2 }] });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(alliéArriere.effets.some((e) => e.stat === "force" && e.valeur === 5)).toBe(true);
    expect(alliéAvant.effets.some((e) => e.stat === "force")).toBe(false);
    expect(lanceur.effets.some((e) => e.stat === "force")).toBe(false);
  });

  it("\"avant\" buffe symétriquement les alliés de la rangée avant et AUCUN de la rangée arrière", () => {
    const lanceur = hero(0); // avant
    const alliéAvant = hero(1); // avant
    const alliéArriere = hero(4); // arrière
    const ennemi = mannequin();
    const cs = [lanceur, alliéAvant, alliéArriere, ennemi];
    const spell = sortDegatsRangee({ rangee: "avant", effets: [{ stat: "force", valeur: 5, duree: 2 }] });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(lanceur.effets.some((e) => e.stat === "force" && e.valeur === 5)).toBe(true);
    expect(alliéAvant.effets.some((e) => e.stat === "force" && e.valeur === 5)).toBe(true);
    expect(alliéArriere.effets.some((e) => e.stat === "force")).toBe(false);
  });

  it("une liste de DEUX effets les applique tous les deux (cas Vigie)", () => {
    const lanceur = hero(0);
    const alliéArriere = hero(4);
    const ennemi = mannequin();
    const cs = [lanceur, alliéArriere, ennemi];
    const spell = sortDegatsRangee({
      rangee: "arriere",
      effets: [
        { stat: "force", valeur: 5, duree: 2 },
        { stat: "resAll", valeur: 0.1, duree: 2 },
      ],
    });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(alliéArriere.effets.some((e) => e.stat === "force" && e.valeur === 5)).toBe(true);
    expect(alliéArriere.effets.some((e) => e.stat === "resAll" && e.valeur === 0.1)).toBe(true);
  });

  it("les invocations ne reçoivent AUCUN effet, même sur la rangée visée", () => {
    const lanceur = hero(0);
    const egideAvant = invocationAlliee(1);
    const ennemi = mannequin();
    const cs = [lanceur, egideAvant, ennemi];
    const spell = sortDegatsRangee({ rangee: "avant", effets: [{ stat: "force", valeur: 5, duree: 2 }] });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(lanceur.effets.some((e) => e.stat === "force")).toBe(true); // témoin : le lanceur, lui, est buffé
    expect(egideAvant.effets.length).toBe(0);
  });
});

describe("effetRangeeAlliee — valeurSiDeuxDevant", () => {
  it("un seul héros devant : la valeur de BASE s'applique", () => {
    const lanceur = hero(0); // seul héros en avant
    const alliéArriere = hero(4);
    const ennemi = mannequin();
    const cs = [lanceur, alliéArriere, ennemi];
    const spell = sortDegatsRangee({
      rangee: "arriere",
      effets: [{ stat: "force", valeur: 5, valeurSiDeuxDevant: 10, duree: 2 }],
    });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(alliéArriere.effets.find((e) => e.stat === "force")!.valeur).toBe(5);
  });

  it("deux héros devant : la valeur MAJORÉE s'applique", () => {
    const lanceur = hero(0);
    const alliéAvant = hero(1); // second héros en avant
    const alliéArriere = hero(4);
    const ennemi = mannequin();
    const cs = [lanceur, alliéAvant, alliéArriere, ennemi];
    const spell = sortDegatsRangee({
      rangee: "arriere",
      effets: [{ stat: "force", valeur: 5, valeurSiDeuxDevant: 10, duree: 2 }],
    });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(alliéArriere.effets.find((e) => e.stat === "force")!.valeur).toBe(10);
  });

  it("une invocation en rangée avant ne compte PAS dans le seuil de deux", () => {
    const lanceur = hero(0); // seul héros réel en avant
    const egideAvant = invocationAlliee(1); // invocation : ne compte pas
    const alliéArriere = hero(4);
    const ennemi = mannequin();
    const cs = [lanceur, egideAvant, alliéArriere, ennemi];
    const spell = sortDegatsRangee({
      rangee: "arriere",
      effets: [{ stat: "force", valeur: 5, valeurSiDeuxDevant: 10, duree: 2 }],
    });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    // Sans la garde, 2 unités (lanceur + Égide) seraient comptées « devant » et la
    // valeur majorée s'appliquerait à tort.
    expect(alliéArriere.effets.find((e) => e.stat === "force")!.valeur).toBe(5);
  });

  it("piège de conception : la garde de non-cumul écrase aussi la VALEUR, pas seulement la durée", () => {
    // Une première Fortification à un seul héros devant (valeur de base), puis un
    // second héros rejoint la rangée avant et une seconde Fortification est relancée :
    // sans réécriture de la valeur, l'effet resterait bloqué à la valeur de base.
    const lanceur = hero(0);
    const alliéArriere = hero(4);
    const ennemi = mannequin();
    const cs = [lanceur, alliéArriere, ennemi];
    const spell = sortDegatsRangee({
      rangee: "arriere",
      effets: [{ stat: "force", valeur: 5, valeurSiDeuxDevant: 10, duree: 2 }],
    });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());
    expect(alliéArriere.effets.find((e) => e.stat === "force")!.valeur).toBe(5);

    const alliéAvant = hero(1); // rejoint la rangée avant : deux héros désormais
    cs.push(alliéAvant);
    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    const marques = alliéArriere.effets.filter((e) => e.stat === "force");
    expect(marques.length).toBe(1); // pas de doublon
    expect(marques[0].valeur).toBe(10); // la valeur a bien été relevée
    expect(marques[0].toursRestants).toBe(2); // et la durée rafraîchie
  });
});

describe("effetRangeeAlliee — deux chemins de résolution", () => {
  it("fonctionne depuis un sort de DÉGÂTS (Vigie, Pâturage)", () => {
    const lanceur = hero(0);
    const alliéArriere = hero(4);
    const ennemi = mannequin();
    const cs = [lanceur, alliéArriere, ennemi];
    const spell = sortDegatsRangee({ rangee: "arriere", effets: [{ stat: "force", valeur: 7, duree: 2 }] });

    lancerSort(lanceur, spell, ennemi.ref, cs, ctx());

    expect(alliéArriere.effets.some((e) => e.stat === "force" && e.valeur === 7)).toBe(true);
    // C'est bien un sort de dégâts : la cible ennemie encaisse aussi des PV perdus.
    expect(ennemi.pvActuels).toBeLessThan(ennemi.pvMax);
  });

  it("fonctionne depuis un sort de SOUTIEN (Fortification), sans infliger de dégâts", () => {
    const lanceur = hero(0);
    const alliéArriere = hero(4);
    const cs = [lanceur, alliéArriere];
    const spell = sortSoutienRangee({ rangee: "arriere", effets: [{ stat: "force", valeur: 7, duree: 2 }] });

    lancerSort(lanceur, spell, lanceur.ref, cs, ctx());

    expect(alliéArriere.effets.some((e) => e.stat === "force" && e.valeur === 7)).toBe(true);
  });
});

describe("retraitPAProchainTour — chemin dégâts (Tétanie)", () => {
  it("la cible commence son prochain tour avec N PA de moins", () => {
    const lanceur = hero(0);
    const cible = mannequin();
    cible.stats = { ...cible.stats, agilite: 0 }; // pas d'esquive : le coup porte
    cible.paActuels = 6;
    const spell: Spell = { ...SORTS.morsure, id: "test_tetanie", retraitPAProchainTour: 2 };

    lancerSort(lanceur, spell, cible.ref, [lanceur, cible], ctx());
    expect(cible.paBonusNextTurn).toBe(-2);

    effetsDebutTour(cible, [lanceur, cible], ctx());
    expect(cible.paActuels).toBe(4);
  });

  it("les PA de la cible ne deviennent JAMAIS négatifs, même si le malus dépasse le stock", () => {
    const lanceur = hero(0);
    const cible = mannequin();
    cible.stats = { ...cible.stats, agilite: 0 };
    cible.paActuels = 1;
    const spell: Spell = { ...SORTS.morsure, id: "test_tetanie_excedent", retraitPAProchainTour: 5 };

    lancerSort(lanceur, spell, cible.ref, [lanceur, cible], ctx());
    effetsDebutTour(cible, [lanceur, cible], ctx());

    expect(cible.paActuels).toBe(0);
  });

  it("un coup ESQUIVÉ n'applique AUCUN malus de PA (même précédent que sort.effet/effetLigneCible)", () => {
    const lanceur = hero(0);
    const cible = mannequin();
    // Agilité haute → chance d'esquive non nulle (min(0.5, agilite*0.002)) ; rng()=0
    // est alors < chance d'esquive : l'esquive est garantie.
    cible.stats = { ...cible.stats, agilite: 300 };
    cible.paActuels = 6;
    const spell: Spell = { ...SORTS.morsure, id: "test_tetanie_esquive", retraitPAProchainTour: 2 };

    lancerSort(lanceur, spell, cible.ref, [lanceur, cible], ctx({ rng: () => 0 }));

    expect(cible.paBonusNextTurn).toBe(0);
    expect(cible.pvActuels).toBe(cible.pvMax); // témoin : le coup n'a bien rien infligé
  });
});

// =============================================================================
//  Task 2 — L'Égide
// =============================================================================
describe("Égide — interception pour la rangée", () => {
  it("intercepte un coup destiné à un héros de SA rangée : le héros ne perd rien, l'Égide perd les PV", () => {
    const feca = hero(0); // avant
    const allie = hero(1); // avant, même rangée
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    const egide = invoquerEgide(feca, allie, 3, cs, ctx())!;
    expect(egide).toBeTruthy();
    expect(egide.pvActuels).toBe(egide.pvMax);

    lancerSort(ennemi, { ...SORTS.morsure }, allie.ref, cs, ctx());

    expect(allie.pvActuels).toBe(allie.pvMax);
    expect(egide.pvActuels).toBeLessThan(egide.pvMax);
  });

  it("laisse le bouclier du héros intact — le point qui diverge de l'Étreinte de Valkyr", () => {
    const feca = hero(0);
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    invoquerEgide(feca, allie, 3, cs, ctx());
    allie.bouclier = 50;

    lancerSort(ennemi, { ...SORTS.morsure }, allie.ref, cs, ctx());

    expect(allie.bouclier).toBe(50); // pas entamé : l'Égide a tout pris avant lui
    expect(allie.pvActuels).toBe(allie.pvMax);
  });

  it("un héros de l'AUTRE rangée n'est PAS protégé", () => {
    const feca = hero(0); // avant
    const allieAvant = hero(1); // avant : posée ici
    const allieArriere = hero(4); // arrière : pas protégée
    const ennemi = mannequin();
    const cs = [feca, allieAvant, allieArriere, ennemi];
    invoquerEgide(feca, allieAvant, 3, cs, ctx());

    lancerSort(ennemi, { ...SORTS.morsure }, allieArriere.ref, cs, ctx());

    expect(allieArriere.pvActuels).toBeLessThan(allieArriere.pvMax);
  });

  it("posée en rangée ARRIÈRE, elle protège la rangée arrière — c'est la moitié du sort", () => {
    const feca = hero(0); // avant
    const allieArriere = hero(4); // arrière
    const ennemi = mannequin();
    const cs = [feca, allieArriere, ennemi];
    const egide = invoquerEgide(feca, allieArriere, 3, cs, ctx())!;
    expect(egide.position).toBeGreaterThanOrEqual(4); // bien plantée en arrière

    lancerSort(ennemi, { ...SORTS.morsure }, allieArriere.ref, cs, ctx());

    expect(allieArriere.pvActuels).toBe(allieArriere.pvMax);
    expect(egide.pvActuels).toBeLessThan(egide.pvMax);
  });

  it("tombe quand ses PV sont épuisés, et cesse alors de protéger", () => {
    const feca = hero(0);
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    const egide = invoquerEgide(feca, allie, 3, cs, ctx())!;
    egide.pvMax = 10; egide.pvActuels = 10; egide.pvBase = 10; // petite Égide, facile à percer

    // Un coup qui dépasse largement ses PV la tue — entièrement absorbé, rien ne déborde.
    lancerSort(ennemi, { ...SORTS.morsure, baseMin: 999, baseMax: 999, scaling: 0 }, allie.ref, cs, ctx());
    expect(egide.pvActuels).toBe(0);
    expect(allie.pvActuels).toBe(allie.pvMax);

    // Un second coup n'est plus intercepté : l'Égide est morte (absente de `vivants`).
    lancerSort(ennemi, { ...SORTS.morsure }, allie.ref, cs, ctx());
    expect(allie.pvActuels).toBeLessThan(allie.pvMax);
  });

  it("n'est pas ciblable (ciblesValides)", () => {
    const feca = hero(0);
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    invoquerEgide(feca, allie, 3, cs, ctx());

    const cibles = ciblesValides(ennemi, { ...SORTS.morsure, cible: "ennemi_tous" }, cs);

    expect(cibles.some((c) => c.estEgide)).toBe(false);
  });

  it("meurt avec son lanceur (purgerInvocationsOrphelines)", () => {
    const feca = hero(0);
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    const egide = invoquerEgide(feca, allie, 3, cs, ctx())!;
    feca.pvActuels = 0; // le Féca tombe

    purgerInvocationsOrphelines(cs, ctx());

    expect(egide.pvActuels).toBe(0);
  });

  it("frappée directement, elle ne se redirige pas elle-même (pas de récursion infinie)", () => {
    const feca = hero(0);
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    const egide = invoquerEgide(feca, allie, 3, cs, ctx())!;

    // La cible du sort est directement l'Égide elle-même : si la garde `!cible.estInvocation`
    // n'existait pas, `infligerDegats` la trouverait comme protectrice d'ELLE-MÊME
    // (`c.camp === cible.camp && estAvant(c) === estAvant(cible)` est vrai pour elle contre
    // elle-même) et boucleraient à l'infini via l'appel imbriqué.
    lancerSort(ennemi, { ...SORTS.morsure }, egide.ref, cs, ctx());

    expect(egide.pvActuels).toBeLessThan(egide.pvMax);
  });

  it("ses PV valent les PV MAX du lanceur au moment du lancer", () => {
    const feca = hero(0);
    feca.pvMax = 777; feca.pvActuels = 400; // dégâts déjà subis : l'Égide n'en hérite pas
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];

    const egide = invoquerEgide(feca, allie, 3, cs, ctx())!;

    expect(egide.pvMax).toBe(777);
    expect(egide.pvActuels).toBe(777);
  });

  it("garde-fou : une seule Égide vivante par lanceur — le second lancer échoue", () => {
    const feca = hero(0);
    const allieA = hero(1);
    const allieB = hero(2);
    const ennemi = mannequin();
    const cs = [feca, allieA, allieB, ennemi];
    const premiere = invoquerEgide(feca, allieA, 3, cs, ctx());
    expect(premiere).toBeTruthy();

    const seconde = invoquerEgide(feca, allieB, 3, cs, ctx());

    expect(seconde).toBeNull();
    expect(cs.filter((c) => c.estEgide).length).toBe(1);
  });

  it("garde-fou : sort grisé (ciblesValides vide) tant qu'une Égide du lanceur est vivante", () => {
    const feca = hero(0);
    const allieA = hero(1);
    const allieB = hero(2);
    const cs = [feca, allieA, allieB];
    invoquerEgide(feca, allieA, 3, cs, ctx());

    const cibles = ciblesValides(feca, { ...SORTS.morsure, cible: "allie", invoqueEgide: { tours: 3 } }, cs);

    expect(cibles.length).toBe(0);
  });

  it("garde-fou : injouable si la rangée visée n'a aucune case libre (4 héros dessus)", () => {
    const feca = hero(0);
    const h1 = hero(1);
    const h2 = hero(2);
    const h3 = hero(3);
    const arriere = hero(4); // rangée arrière encore libre
    const cs = [feca, h1, h2, h3, arriere];

    const cibles = ciblesValides(feca, { ...SORTS.morsure, cible: "allie", invoqueEgide: { tours: 3 } }, cs);

    // La rangée avant (feca/h1/h2/h3) est pleine : aucune de ses 4 occupantes n'est une
    // cible valide. La rangée arrière (allié seul) a de la place : elle reste valide.
    expect(cibles.some((c) => estAvantDe(c))).toBe(false);
    expect(cibles.some((c) => c.ref === arriere.ref)).toBe(true);

    function estAvantDe(c: Combatant): boolean { return c.position < 4; }
  });

  it("expire au bout de N tours et cesse alors de protéger (intégration complète, runCombat)", async () => {
    const feca = hero(0);
    feca.initiative = 100; feca.paMax = 1; feca.paActuels = 1;
    const allie = hero(1);
    allie.initiative = 90; allie.paMax = 0; allie.paActuels = 0;
    const ennemi = mannequin();
    ennemi.initiative = 1;
    ennemi.paMax = SORTS.morsure.coutPA; ennemi.paActuels = ennemi.paMax;
    const cs = [feca, allie, ennemi];

    const spellEgide: Spell = {
      ...SORTS.morsure, id: "test_egide", type: "buff", cible: "allie",
      baseMin: 0, baseMax: 0, coutPA: 1, invoqueEgide: { tours: 1 },
    };
    const spellTue: Spell = {
      ...SORTS.morsure, id: "test_tue_ennemi", baseMin: 999, baseMax: 999, scaling: 0, coutPA: 1,
    };

    // Plan de Féca : round 1 → pose l'Égide ; round 2 → passe (le minuteur tombe à 0
    // au DÉBUT de ce tour, avant que Féca n'agisse) ; round 3 → achève l'ennemi (borne
    // le nombre de rounds, sans quoi runCombat tournerait jusqu'à sa sécurité à 1000).
    let plan = 0;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref !== feca.ref) return null; // l'allié ne joue jamais
      if (acteur.paActuels <= 0) return null; // déjà agi ce tour-ci
      if (plan === 0) { plan = 1; return { sort: spellEgide, cibleRef: allie.ref }; }
      if (plan === 1) { plan = 2; return null; } // round 2 : passe
      if (plan === 2) { plan = 3; return { sort: spellTue, cibleRef: ennemi.ref }; }
      return null;
    };
    const controllerEnnemi = (acteur: Combatant): Action | null => {
      if (acteur.paActuels <= 0) return null; // déjà agi ce tour-ci
      return { sort: SORTS.morsure, cibleRef: allie.ref };
    };

    await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: controllerEnnemi },
      rng: rngMax,
    });

    const egide = cs.find((c) => c.ref === `egide_${feca.ref}`);
    expect(egide).toBeTruthy();
    expect(egide!.pvActuels).toBe(0); // expirée au round 2, avant le second coup ennemi
    expect(allie.pvActuels).toBeLessThan(allie.pvMax); // round 1 intercepté, round 2 non
    expect(ennemi.pvActuels).toBe(0); // témoin : le combat s'est terminé par la mort de l'ennemi, pas la sécurité anti-boucle
  });
});
