// =============================================================================
//  feca-moteur.test.ts — Task 1 du rework Féca : les primitives de rangée
//  (effetRangeeAlliee, retraitPAProchainTour).
//
//  Aucun contenu réel n'utilise encore ces champs (Task 3) : chaque bloc construit
//  un sort synthétique à partir d'un sort existant (SORTS.morsure pour les
//  dégâts, un buff « soi » synthétique pour le soutien).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, effetsDebutTour, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { BuffRangeeAlliee, Combatant, Spell } from "./types";

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
