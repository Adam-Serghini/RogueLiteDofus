// =============================================================================
//  roublard.test.ts — Kit du Roublard : Bombe collante, Kaboom, Dagues
//  Boomerang, Roublabot, Roublardise, Resquille.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, poserBombe, BOMBES_MAX, estAvant, effetsDebutTour, degatsCible,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Roublard prêt à combattre (agilité 0 pour le déterminisme). */
function roublard(): Combatant {
  const c = equipeCombattante(nouvelleRun(["roublard"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
function ennemis(combatId = "gob_boss"): Combatant[] {
  return fabriquerEnnemis(combatId).map((e) => {
    e.stats = { ...e.stats, agilite: 0 };
    e.resistances = {}; // neutralise les résistances pour des jets comparables
    e.pvActuels = 500; e.pvMax = 500;
    return e;
  });
}
/** Un « bouche-trou » ennemi placé en ligne arrière (résistances neutres). */
function boucheTrouArriere(position: number): Combatant {
  const c = equipeCombattante(nouvelleRun(["cra"]))[0];
  c.camp = "ennemi";
  c.position = position;
  c.resistances = {};
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

describe("classe Roublard", () => {
  it("est recrutable, avec son kit de 6 sorts", () => {
    expect(CLASSES.roublard).toBeDefined();
    expect(CLASSES.roublard.sorts).toEqual([
      "bombe_collante", "kaboom", "dagues_boomerang", "roublabot", "roublardise", "resquille",
    ]);
    expect(CLASSES.roublard.sorts.length).toBe(6);
    for (const id of CLASSES.roublard.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Bombe collante", () => {
  it("2 lancers max par tour (ciblesValides vide au 3e essai)", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    expect(ciblesValides(r, SORTS.bombe_collante, cs)).toEqual([e]);
    lancerSort(r, SORTS.bombe_collante, e.ref, cs, ctx());
    expect(ciblesValides(r, SORTS.bombe_collante, cs)).toEqual([e]);
    lancerSort(r, SORTS.bombe_collante, e.ref, cs, ctx());
    expect(ciblesValides(r, SORTS.bombe_collante, cs)).toEqual([]); // 3e lancer refusé
    expect(e.bombes).toBe(2);
  });

  it("cap à 5 bombes sur une même cible (échec silencieux au-delà)", () => {
    const [e] = ennemis();
    for (let i = 0; i < 6; i++) poserBombe(e);
    expect(e.bombes).toBe(BOMBES_MAX);
  });

  it("peut viser la ligne arrière (ennemi_tous)", () => {
    const r = roublard();
    const [e1] = ennemis();
    const arriere = boucheTrouArriere(5);
    const cs = [r, e1, arriere];
    expect(ciblesValides(r, SORTS.bombe_collante, cs).some((c) => c.ref === arriere.ref)).toBe(true);
  });
});

describe("Kaboom", () => {
  it("injouable sans bombe posée (ciblesValides vide)", () => {
    const r = roublard();
    const cs = [r, ...ennemis()];
    expect(ciblesValides(r, SORTS.kaboom, cs)).toEqual([]);
  });

  it("détonne toutes les bombes du porteur + 50 % à sa rangée, épargne l'arrière, remet les bombes à 0", () => {
    const r = roublard();
    const pack = ennemis(); // gob_boss : 3 ennemis en ligne avant
    const porteur = pack[0];
    const voisin = pack[1];
    const arriereAlliee = boucheTrouArriere(5); // ligne arrière du camp ennemi : ne doit PAS être touché
    const cs = [r, ...pack, arriereAlliee];

    poserBombe(porteur);
    poserBombe(porteur);
    expect(porteur.bombes).toBe(2);

    const pvPorteurAvant = porteur.pvActuels;
    const pvVoisinAvant = voisin.pvActuels;
    const pvArriereAvant = arriereAlliee.pvActuels;

    lancerSort(r, SORTS.kaboom, r.ref, cs, ctx());

    const jetPlein = SORTS.kaboom.baseMax; // rng max : jet plein à chaque fois
    const dmgPorteur = pvPorteurAvant - porteur.pvActuels;
    const dmgVoisin = pvVoisinAvant - voisin.pvActuels;
    expect(dmgPorteur).toBeGreaterThan(0);
    // 2 bombes : le porteur encaisse 2 jets pleins (± arrondi des étapes de la pipeline)
    expect(Math.abs(dmgPorteur - jetPlein * 2)).toBeLessThanOrEqual(2);
    // le voisin de rangée encaisse ~50 % par bombe (2 bombes)
    expect(dmgVoisin).toBeGreaterThan(0);
    expect(dmgVoisin).toBeLessThan(dmgPorteur);
    // l'arrière n'est jamais touché
    expect(arriereAlliee.pvActuels).toBe(pvArriereAvant);
    // toutes les bombes sont consommées
    expect(porteur.bombes).toBe(0);
  });

  it("les bombes sont perdues à la mort du porteur : Kaboom redevient injouable", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    poserBombe(e);
    poserBombe(e);
    e.pvActuels = 0; // le porteur meurt
    expect(ciblesValides(r, SORTS.kaboom, cs)).toEqual([]);
  });
});

describe("Kaboom — aura Portails / marque Conjuration (cross-classe, handler dédié)", () => {
  // dégâts amplifiés (force haute) : à faible magnitude, 4-5 % se noie dans
  // l'arrondi et le test ne distingue plus rien — ici l'écart est net.
  const roublardPuissant = (): Combatant => {
    const r = roublard();
    r.stats = { ...r.stats, force: 300, intelligence: 0, chance: 0 };
    r.elementChoisi = "terre";
    return r;
  };
  const cibleResistante = (): Combatant => {
    const [e] = ennemis();
    e.pvMax = 5000; e.pvActuels = 5000;
    return e;
  };

  it("porte l'aura des Portails d'un allié Éliotrope de même rangée (×1,04 à 4 portails)", () => {
    const r = roublardPuissant();
    r.position = 0; // avant
    const allieAura: Combatant = { ...roublardPuissant(), ref: "elio_aura", position: 1, portails: 4 }; // même rangée
    const e = cibleResistante();
    const cs = [r, allieAura, e];
    poserBombe(e);

    const base = degatsCible(r, SORTS.kaboom, e, { useMax: false, mult: 1, ctx: ctx() }).dmg;
    const avant = e.pvActuels;
    lancerSort(r, SORTS.kaboom, r.ref, cs, ctx());
    const dmg = avant - e.pvActuels;
    expect(dmg).toBeGreaterThan(base); // l'aura des portails doit s'appliquer même via Kaboom
    expect(Math.abs(dmg - Math.round(base * 1.04))).toBeLessThanOrEqual(1);
  });

  it("frappe plus fort une cible marquée par Conjuration (×1,05), même via Kaboom", () => {
    const r = roublardPuissant();
    r.position = 0; // avant
    const marqueur: Combatant = { ...roublardPuissant(), ref: "elio_marqueur", position: 1 }; // même rangée que r
    const e = cibleResistante();
    e.conjuration = { pct: 0.05, lanceurRef: marqueur.ref, tours: 2 };
    const cs = [r, marqueur, e];
    poserBombe(e);

    const base = degatsCible(r, SORTS.kaboom, e, { useMax: false, mult: 1, ctx: ctx() }).dmg;
    const avant = e.pvActuels;
    lancerSort(r, SORTS.kaboom, r.ref, cs, ctx());
    const dmg = avant - e.pvActuels;
    expect(dmg).toBeGreaterThan(base); // la marque Conjuration doit s'appliquer même via Kaboom
    expect(Math.abs(dmg - Math.round(base * 1.05))).toBeLessThanOrEqual(1);
  });
});

describe("Resquille", () => {
  it("Resquille + Kaboom : chaque ennemi touché perd exactement 2 PA (pas 2×n bombes)", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    poserBombe(e);
    poserBombe(e);
    const paAvant = e.paActuels;
    lancerSort(r, SORTS.resquille, r.ref, cs, ctx());
    expect(r.resquilleActive).toBe(2);
    lancerSort(r, SORTS.kaboom, r.ref, cs, ctx());
    expect(paAvant - e.paActuels).toBe(2); // pas 4
    expect(r.resquilleActive).toBeUndefined(); // consommé
  });

  it("sans Resquille, Kaboom ne retire aucun PA", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    poserBombe(e);
    const paAvant = e.paActuels;
    lancerSort(r, SORTS.kaboom, r.ref, cs, ctx());
    expect(e.paActuels).toBe(paAvant);
  });
});

describe("Dagues Boomerang", () => {
  it("3 jets si un ennemi est derrière la cible (cible = base − 2 jets, arrière = base − 1 jet)", () => {
    const r = roublard();
    const [devant] = ennemis();
    const arriere = boucheTrouArriere(devant.position + 4);
    const cs = [r, devant, arriere];

    const pvDevantAvant = devant.pvActuels;
    const pvArriereAvant = arriere.pvActuels;
    lancerSort(r, SORTS.dagues_boomerang, devant.ref, cs, ctx());
    const dmgUnJet = pvDevantAvant - devant.pvActuels; // sera 2 jets en tout sur la cible
    const dmgArriere = pvArriereAvant - arriere.pvActuels;
    expect(dmgArriere).toBeGreaterThan(0);
    expect(dmgUnJet).toBeGreaterThan(0);
    // la cible a subi 2 jets, l'arrière 1 seul jet : ratio ≈ 2
    expect(Math.abs(dmgUnJet - dmgArriere * 2)).toBeLessThanOrEqual(2);
  });

  it("1 seul jet si personne derrière", () => {
    const r = roublard();
    const [e] = ennemis(); // gob_boss : aucun ennemi en ligne arrière par défaut
    const cs = [r, e];
    const avant = e.pvActuels;
    lancerSort(r, SORTS.dagues_boomerang, e.ref, cs, ctx());
    const dmgUnSeulJet = avant - e.pvActuels;
    // référence : jet plein calculé indépendamment (agilité 0, rng max)
    const jetPlein = SORTS.dagues_boomerang.baseMax;
    expect(dmgUnSeulJet).toBeGreaterThan(0);
    expect(Math.abs(dmgUnSeulJet - jetPlein)).toBeLessThanOrEqual(1);
  });

  it("1 seul lancer par tour (maxParTour)", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    expect(ciblesValides(r, SORTS.dagues_boomerang, cs)).toEqual([e]);
    lancerSort(r, SORTS.dagues_boomerang, e.ref, cs, ctx());
    expect(ciblesValides(r, SORTS.dagues_boomerang, cs)).toEqual([]);
  });
});

describe("Roublabot", () => {
  it("déplace la cible en rangée opposée (+4/−4) et pose un cooldown de 3", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    const posAvant = e.position;
    expect(estAvant(e)).toBe(true);
    lancerSort(r, SORTS.roublabot, e.ref, cs, ctx());
    expect(e.position).toBe(posAvant + 4);
    expect(estAvant(e)).toBe(false);
    expect(r.cooldowns["roublabot"]).toBe(3);
  });

  it("ne fait aucun jet de dégâts/esquive (baseMax 0) et ne logue ni « dégâts » ni « esquive »", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    let appelsRng = 0;
    const logs: string[] = [];
    lancerSort(r, SORTS.roublabot, e.ref, cs, ctx({ rng: () => { appelsRng++; return 0.99; }, log: (m) => logs.push(m) }));
    expect(appelsRng).toBe(0); // aucun jet de dégâts/esquive consommé
    expect(logs.some((m) => /dégâts|esquive/i.test(m))).toBe(false);
  });
});

describe("Roublardise", () => {
  it("annule le prochain coup direct reçu et pose un cooldown de 5", () => {
    const r = roublard();
    const [e] = ennemis();
    const cs = [r, e];
    lancerSort(r, SORTS.roublardise, r.ref, cs, ctx());
    expect(r.nullifieProchainCoup).toBe(true);
    expect(r.cooldowns["roublardise"]).toBe(5);

    // un coup direct est annulé (0 dégâts) et consomme le flag
    const pvAvant = r.pvActuels;
    lancerSort(e, SORTS.morsure, r.ref, cs, ctx());
    expect(r.pvActuels).toBe(pvAvant);
    expect(r.nullifieProchainCoup).toBe(false);

    // le flag consommé ne protège plus du coup suivant
    lancerSort(e, SORTS.morsure, r.ref, cs, ctx());
    expect(r.pvActuels).toBeLessThan(pvAvant);
  });

  it("n'annule pas un poison (mécanique générique déjà couverte par combat.test.ts)", () => {
    const r = roublard();
    lancerSort(r, SORTS.roublardise, r.ref, [r], ctx());
    r.effets.push({ stat: "poison", valeur: 15, toursRestants: 2 });
    const pvAvant = r.pvActuels;
    effetsDebutTour(r, [r], ctx());
    expect(r.pvActuels).toBe(pvAvant - 15); // le poison a bien tické malgré nullifieProchainCoup
    expect(r.nullifieProchainCoup).toBe(true); // le flag n'est PAS consommé par un poison
  });
});
