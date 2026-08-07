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
    // témoin : l'Égide (posée en avant) n'a strictement rien pris de ce coup — sans cette
    // assertion, le test passerait à l'identique même si l'Égide protégeait TOUTE la grille.
    const egide = cs.find((c) => c.estEgide)!;
    expect(egide.pvActuels).toBe(egide.pvMax);
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

  it("n'est pas ciblable (ciblesValides), pour ennemi_tous ET ennemi_ligne", () => {
    const feca = hero(0);
    const allie = hero(1);
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    invoquerEgide(feca, allie, 3, cs, ctx());

    const ciblesTous = ciblesValides(ennemi, { ...SORTS.morsure, cible: "ennemi_tous" }, cs);
    const ciblesLigne = ciblesValides(ennemi, { ...SORTS.morsure, cible: "ennemi_ligne" }, cs);

    expect(ciblesTous.some((c) => c.estEgide)).toBe(false);
    // ennemi_ligne est le chemin exact du défaut critique de revue : `ligneFront` calculée
    // AVANT le retrait de l'Égide la voyait occuper la rangée avant sans être ciblable.
    expect(ciblesLigne.some((c) => c.estEgide)).toBe(false);
  });

  it("CRITIQUE (revue) — Égide seule vivante en rangée avant : la rangée arrière reste atteignable pour ennemi_ligne", () => {
    // Reproduit le bug trouvé en revue : `base.filter((c) => !c.estEgide)` appliqué APRÈS
    // `ligneFront` laissait l'Égide compter comme occupante de la rangée avant (elle y est
    // physiquement), donc `ligneFront` ne considérait JAMAIS la rangée avant comme vide et
    // n'exposait jamais la rangée arrière — puis le filtre retirait l'Égide, laissant une
    // liste de cibles VIDE pour `ennemi_ligne` (75 sorts sur 125, dont le kit partagé de tous
    // les monstres) alors que des héros vivent en rangée arrière. Atteignable en jeu réel dès
    // que le seul héros de rangée avant meurt, est repoussé (Bourrasque de pollen) ou se
    // déplace lui-même (Dagues Eurfolles) après la pose de l'Égide.
    const feca = hero(0); // avant : va "mourir", laissant l'Égide seule vivante en avant
    const arriere1 = hero(4);
    const arriere2 = hero(5);
    const ennemi = mannequin();
    const cs = [feca, arriere1, arriere2, ennemi];
    const egide = invoquerEgide(feca, feca, 3, cs, ctx())!; // posée sur SA PROPRE rangée (avant)
    expect(egide.position).toBeLessThan(4); // bien plantée en avant
    feca.pvActuels = 0; // le Féca tombe : l'Égide devient la SEULE unité vivante en avant

    const cibles = ciblesValides(ennemi, { ...SORTS.morsure, cible: "ennemi_ligne" }, cs);

    expect(cibles.length).toBe(2);
    expect(cibles).toContain(arriere1);
    expect(cibles).toContain(arriere2);
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
    const logs: string[] = [];

    // La cible du sort est directement l'Égide elle-même : si la garde `!cible.estInvocation`
    // n'existait pas, `infligerDegats` la trouverait comme protectrice d'ELLE-MÊME
    // (`c.camp === cible.camp && estAvant(c) === estAvant(cible)` est vrai pour elle contre
    // elle-même) et logguerait « L'Égide encaisse… » avant de se rediriger vers elle-même —
    // borné par la seconde garde (`viaRedirection`), mais ce n'est PAS ce qui doit se produire :
    // une frappe directe ne doit jamais passer par le chemin d'interception, point.
    lancerSort(ennemi, { ...SORTS.morsure }, egide.ref, cs, ctx({ log: (msg) => logs.push(msg) }));

    expect(egide.pvActuels).toBeLessThan(egide.pvMax);
    // Épingle `!cible.estInvocation` : sans cette garde, le message d'interception apparaîtrait
    // au moins une fois (la revue a montré que le retirer seul passe 26/26 en silence sinon).
    expect(logs.some((m) => m.includes("L'Égide encaisse"))).toBe(false);
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

  it("caractérisation : une frappe de ZONE sur sa propre rangée touche l'Égide QUATRE fois "
    + "(les 3 redirections + son propre coup direct) — fond ~33 % plus vite qu'en cible unique", () => {
    // Documenté en commentaire au-dessus du site d'interception (`infligerDegats`) comme une
    // conséquence ASSUMÉE, pas un bug : ce test la FIGE, pour que le jour où les sorts de zone
    // filtreraient les invocations, la régression (fonte ×1,33 qui disparaît en silence) se
    // voie dans un test plutôt que d'être découverte en playtest.
    const zoneLigne: Spell = { ...SORTS.morsure, id: "test_zone_egide", zoneLigne: true, scaling: 0 };

    // Témoin : le MÊME sort, sur une cible UNIQUE (pas de zone, pas d'Égide), même rng
    // déterministe (pas de crit/esquive) → la référence « un seul coup ».
    const temoin = mannequin();
    const ennemiTemoin = mannequin();
    lancerSort(ennemiTemoin, { ...zoneLigne, zoneLigne: false }, temoin.ref, [temoin, ennemiTemoin], ctx());
    const unCoup = temoin.pvMax - temoin.pvActuels;
    expect(unCoup).toBeGreaterThan(0); // témoin : le coup de référence porte bien

    // Scénario réel : l'Égide (posée par le Féca sur SA PROPRE rangée arrière) partage cette
    // rangée avec 3 autres héros — elle est donc elle-même membre de la rangée que `zoneLigne`
    // balaie en entier (`ciblesDegats` ne l'exclut pas, contrairement à `ciblesValides`).
    const feca = hero(0); // avant, seul : hors de la rangée touchée, témoin de non-effet
    const a1 = hero(4); const a2 = hero(5); const a3 = hero(6); // rangée arrière : 3 places sur 4
    const ennemi = mannequin();
    const cs = [feca, a1, a2, a3, ennemi];
    const egide = invoquerEgide(feca, a1, 5, cs, ctx())!; // rangée arrière : la 4ᵉ et dernière place
    expect(egide).toBeTruthy();
    expect(egide.position).toBeGreaterThanOrEqual(4); // bien plantée en arrière, avec a1/a2/a3

    lancerSort(ennemi, zoneLigne, a1.ref, cs, ctx());

    // Les 3 héros protégés n'ont rien perdu (l'Égide a tout absorbé, à chaque redirection).
    expect(a1.pvActuels).toBe(a1.pvMax);
    expect(a2.pvActuels).toBe(a2.pvMax);
    expect(a3.pvActuels).toBe(a3.pvMax);
    // Le témoin hors-rangée n'a rien pris non plus (il n'était pas dans la zone).
    expect(feca.pvActuels).toBe(feca.pvMax);
    // L'Égide a encaissé 4 coups (3 redirections + son propre coup direct, elle est elle-même
    // membre de la rangée touchée par `zoneLigne`) : à dégâts identiques par coup (même sort,
    // mêmes stats de lanceur/cibles, même rng), elle a perdu exactement 4× la référence à
    // cible unique — jamais 1× ni 3×.
    const perdu = egide.pvMax - egide.pvActuels;
    expect(perdu).toBe(unCoup * 4);
  });
});

// =============================================================================
//  Correctifs de revue finale (2026-08-07)
// =============================================================================
describe("l'Égide n'est jamais un ALLIÉ pour les effets automatiques (soins/boucliers/buffs)", () => {
  it("un soin `allie_tous` ne soigne JAMAIS l'Égide, même blessée", () => {
    const feca = hero(0);
    const allie = hero(1); // même rangée : protégé par l'Égide
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    const egide = invoquerEgide(feca, allie, 5, cs, ctx())!;
    // L'Égide encaisse un coup pour être blessée (donc potentiellement « la plus blessée »
    // si un effet automatique la considérait comme un allié normal).
    lancerSort(ennemi, { ...SORTS.morsure }, allie.ref, cs, ctx());
    const pvEgideAvant = egide.pvActuels;
    expect(pvEgideAvant).toBeLessThan(egide.pvMax); // témoin : elle a bien encaissé

    const soinTous: Spell = {
      ...SORTS.morsure, id: "test_soin_tous", type: "soin", cible: "allie_tous",
      baseMin: 50, baseMax: 50, scaling: 0,
    };
    lancerSort(feca, soinTous, feca.ref, cs, ctx());

    expect(egide.pvActuels).toBe(pvEgideAvant); // AUCUN soin reçu
  });

  it("le soin « au plus blessé » (soinAvantBlesseRatio) siphonnait l'Égide : il soigne "
    + "désormais le héros réellement le plus blessé, malgré la présence de l'Égide", () => {
    const feca = hero(0);
    const allie = hero(1); // même rangée que l'Égide : très blessé, DOIT recevoir le soin
    const ennemi = mannequin();
    const cs = [feca, allie, ennemi];
    const egide = invoquerEgide(feca, allie, 5, cs, ctx())!;
    // L'Égide encaisse un très gros coup direct — sans la correction, elle deviendrait
    // « la plus blessée » et siphonnerait le soin dérivé de dégâts.
    lancerSort(ennemi, { ...SORTS.morsure, baseMin: 400, baseMax: 400, scaling: 0 }, allie.ref, cs, ctx());
    expect(egide.pvActuels).toBeLessThan(egide.pvMax / 2); // témoin : très blessée
    allie.pvActuels = allie.pvMax; // l'allié protégé, lui, n'a subi AUCUN dégât (interception)
    // On blesse légèrement l'allié pour qu'il soit éligible au soin (pvActuels < pvMax).
    allie.pvActuels -= 10;
    const pvEgideAvant = egide.pvActuels;

    const soinAvant: Spell = {
      ...SORTS.morsure, id: "test_soin_avant", soinAvantBlesseRatio: 1, scaling: 0, baseMin: 20, baseMax: 20,
    };
    lancerSort(feca, soinAvant, ennemi.ref, cs, ctx());

    expect(allie.pvActuels).toBe(allie.pvMax); // le héros réellement blessé a été soigné
    expect(egide.pvActuels).toBe(pvEgideAvant); // l'Égide n'a RIEN reçu
  });

  it("une face de Roulette (bouclier ou buff) ne s'applique jamais à l'Égide", () => {
    const feca = hero(0);
    const allie = hero(1); // même rangée avant que le lanceur : dans la « rangee_avant »
    const cs = [feca, allie];
    const egide = invoquerEgide(feca, allie, 5, cs, ctx())!;
    const pvEgideAvant = egide.pvActuels;

    const roulette: Spell = {
      ...SORTS.morsure, id: "test_roulette_egide", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, scaling: 0,
      facesAleatoires: [{ portee: "rangee_avant", bouclierPct: 0.5, effet: { stat: "crit", valeur: 10, duree: 2 } }],
    };
    lancerSort(feca, roulette, feca.ref, cs, ctx());

    expect(allie.bouclier).toBeGreaterThan(0); // témoin : la face s'applique bien à un allié réel
    expect(allie.effets.some((e) => e.stat === "crit")).toBe(true);
    expect(egide.bouclier).toBe(0); // l'Égide n'a reçu AUCUN bouclier
    expect(egide.effets.length).toBe(0); // ni AUCUN buff
    expect(egide.pvActuels).toBe(pvEgideAvant); // et rien n'a changé côté PV
  });
});

describe("la garde de non-cumul du buff de rangée ne touche que SES PROPRES effets", () => {
  it("un débuff ÉTRANGER de même stat (ex. Rostre broyeur, -15 % dégâts) n'est ni écrasé "
    + "ni raccourci par Pâturage (+10 %/+15 %) : les deux coexistent", () => {
    const lanceur = hero(0);
    const cible = mannequin();
    const cs = [lanceur, cible];
    // Débuff étranger posé manuellement (simule le Rostre broyeur, un sort de boss T1).
    lanceur.effets.push({ stat: "degatsInfliges", valeur: -0.15, toursRestants: 2 });

    const spell: Spell = {
      ...SORTS.morsure, id: "test_paturage_etranger",
      effetRangeeAlliee: { rangee: "avant", effets: [{ stat: "degatsInfliges", valeur: 0.10, valeurSiDeuxDevant: 0.15, duree: 1 }] },
    };
    lancerSort(lanceur, spell, cible.ref, cs, ctx());

    const marques = lanceur.effets.filter((e) => e.stat === "degatsInfliges");
    expect(marques.length).toBe(2); // les deux COEXISTENT, aucun n'a écrasé l'autre
    expect(marques.some((e) => e.valeur === -0.15 && e.toursRestants === 2)).toBe(true); // étranger intact
    expect(marques.some((e) => e.valeur === 0.10)).toBe(true); // le buff de rangée s'est bien posé
  });

  it("un `resAll` étranger (Épée du jugement, une face de Roulette) n'est ni écrasé "
    + "ni réduit par Fortification (+10 %/+15 %)", () => {
    const lanceur = hero(0);
    const cs = [lanceur];
    lanceur.effets.push({ stat: "resAll", valeur: 0.2, toursRestants: 3 }); // étranger, plus fort

    const spell: Spell = {
      ...SORTS.morsure, id: "test_fortif_etranger", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, scaling: 0,
      effetRangeeAlliee: { rangee: "avant", effets: [{ stat: "resAll", valeur: 0.10, valeurSiDeuxDevant: 0.15, duree: 2 }] },
    };
    lancerSort(lanceur, spell, lanceur.ref, cs, ctx());

    const marques = lanceur.effets.filter((e) => e.stat === "resAll");
    expect(marques.length).toBe(2);
    expect(marques.some((e) => e.valeur === 0.2 && e.toursRestants === 3)).toBe(true); // intact
    expect(marques.some((e) => e.valeur === 0.10)).toBe(true);
  });

  it("l'escalade 10 % → 15 % de SA PROPRE valeur (piège de conception déjà testé plus haut) "
    + "continue de fonctionner : seul SON effet est mis à jour, pas un doublon", () => {
    const lanceur = hero(0);
    const cible = mannequin();
    const cs = [lanceur, cible];
    const spell = sortSoutienRangee({
      rangee: "avant",
      effets: [{ stat: "force", valeur: 5, valeurSiDeuxDevant: 10, duree: 2 }],
    });
    lancerSort(lanceur, spell, lanceur.ref, cs, ctx());
    expect(lanceur.effets.find((e) => e.stat === "force")!.valeur).toBe(5);

    const alliéAvant = hero(1);
    cs.push(alliéAvant); // deux héros devant désormais
    lancerSort(lanceur, spell, lanceur.ref, cs, ctx());

    const marques = lanceur.effets.filter((e) => e.stat === "force");
    expect(marques.length).toBe(1); // toujours pas de doublon
    expect(marques[0].valeur).toBe(10);
  });
});

describe("Fortification (buff pur) grisée si sa rangée cible est vide", () => {
  it("ciblesValides est vide pour une équipe 100 % rangée arrière", () => {
    const lanceur = hero(4); // le seul héros, en rangée ARRIÈRE
    const cs = [lanceur];

    const cibles = ciblesValides(lanceur, SORTS_FORTIFICATION_LIKE, cs);

    expect(cibles.length).toBe(0);
  });

  it("reste jouable dès qu'au moins un héros réel (hors invocation) occupe la rangée avant", () => {
    const lanceur = hero(0); // rangée avant
    const cs = [lanceur];

    const cibles = ciblesValides(lanceur, SORTS_FORTIFICATION_LIKE, cs);

    expect(cibles.length).toBeGreaterThan(0);
  });

  it("une invocation seule en rangée avant ne suffit pas : reste grisé", () => {
    const lanceur = hero(4); // le lanceur est en arrière
    const egideAvant = invocationAlliee(0); // seule occupante de la rangée avant : une invocation
    const cs = [lanceur, egideAvant];

    const cibles = ciblesValides(lanceur, SORTS_FORTIFICATION_LIKE, cs);

    expect(cibles.length).toBe(0);
  });

  it("un sort de DÉGÂTS portant `effetRangeeAlliee` (Vigie/Pâturage) n'est PAS concerné "
    + "par ce garde-fou : il reste jouable même rangée bonus vide", () => {
    const lanceur = hero(4); // rangée arrière : sa Vigie viserait la rangée arrière (peuplée)
    const ennemi = mannequin();
    const cs = [lanceur, ennemi];
    const spellDegatsRangee: Spell = {
      ...SORTS.morsure, id: "test_degats_rangee_vide", cible: "ennemi_ligne",
      effetRangeeAlliee: { rangee: "avant", effets: [{ stat: "force", valeur: 5, duree: 2 }] },
    };

    const cibles = ciblesValides(lanceur, spellDegatsRangee, cs);

    expect(cibles.length).toBeGreaterThan(0); // toujours jouable : c'est un sort de dégâts
  });
});

/** Sort de soutien synthétique « soi », dont l'UNIQUE effet est `effetRangeeAlliee` sur la
 *  rangée avant — calque exact de Fortification, pour le garde-fou de rangée vide. */
const SORTS_FORTIFICATION_LIKE: Spell = {
  ...SORTS.morsure, id: "test_fortification_like", type: "buff", cible: "soi",
  baseMin: 0, baseMax: 0, scaling: 0,
  effetRangeeAlliee: { rangee: "avant", effets: [{ stat: "resAll", valeur: 0.10, valeurSiDeuxDevant: 0.15, duree: 2 }] },
};
