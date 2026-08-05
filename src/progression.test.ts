// =============================================================================
//  progression.test.ts — Validation du système de niveaux & XP.
//  Les tests de la courbe de caractéristiques (base + gains d'archétype)
//  vivent dans archetypes.test.ts, avec la table archétype/éléments.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  progressionInitiale, xpRequis, coutPoint, gagnerXP,
  statsFinales, pvMaxFor, multOffensif, multSoin, PV_PAR_VITA,
} from "./progression";
import { CLASSES } from "./data";

describe("xpRequis", () => {
  it("suit la courbe 50 + (niveau-1)*25", () => {
    expect(xpRequis(1)).toBe(50);
    expect(xpRequis(2)).toBe(75);
    expect(xpRequis(5)).toBe(150);
  });
});

describe("coutPoint", () => {
  it("augmente aux seuils 200 et 300", () => {
    expect(coutPoint(0)).toBe(1);
    expect(coutPoint(199)).toBe(1);
    expect(coutPoint(200)).toBe(2);
    expect(coutPoint(299)).toBe(2);
    expect(coutPoint(300)).toBe(3);
  });
});

describe("gagnerXP", () => {
  it("monte d'un niveau", () => {
    const p = progressionInitiale();
    const niv = gagnerXP(p, 50); // xpRequis(1) = 50
    expect(niv).toBe(1);
    expect(p.niveau).toBe(2);
    expect(p.xp).toBe(0);
  });

  it("enchaîne plusieurs niveaux d'un coup", () => {
    const p = progressionInitiale();
    const niv = gagnerXP(p, 200); // 50 + 75 + ... → 2 niveaux (50+75=125), reste 75 → niv3 ? 125<200
    // niveaux : 50 (→2), 75 (→3), 100 (→4) = 225 > 200 ; donc 2 niveaux, reste 200-125=75
    expect(niv).toBe(2);
    expect(p.niveau).toBe(3);
    expect(p.xp).toBe(75);
  });

  it("plafonne au niveau max de la tranche (surplus d'XP perdu)", () => {
    const p = progressionInitiale();
    gagnerXP(p, 999999, 5); // cap niveau 5
    expect(p.niveau).toBe(5);
    expect(p.xp).toBe(0); // surplus jeté
    expect(gagnerXP(p, 500, 5)).toBe(0); // au cap : plus rien ne rentre
    expect(p.niveau).toBe(5);
  });
});

describe("stats finales & PV", () => {
  it("statsFinales = base de classe au niveau 1 (aucun gain d'archétype encore acquis)", () => {
    const p = progressionInitiale();
    const s = statsFinales(CLASSES.iop, p);
    expect(s.force).toBe(CLASSES.iop.stats.force);
  });

  it("pvMaxFor compose bien pvBase et la vitalité via PV_PAR_VITA", () => {
    // Ce test recalcule EXACTEMENT le corps de `pvMaxFor` : il passerait même si
    // `statsFinales` renvoyait vitalite: 0 pour tout le monde. Il vérifie la
    // COMPOSITION (pvBase + vitalité × PV_PAR_VITA), pas la courbe de vitalité —
    // celle-ci, avec des valeurs en dur par niveau, est couverte par
    // `src/archetypes.test.ts` (~ligne 222).
    const p = progressionInitiale();
    const base = pvMaxFor(CLASSES.iop, p);
    expect(base).toBe(CLASSES.iop.pvBase + statsFinales(CLASSES.iop, p).vitalite);
    p.niveau = 50;
    expect(pvMaxFor(CLASSES.iop, p))
      .toBe(CLASSES.iop.pvBase + statsFinales(CLASSES.iop, p).vitalite * PV_PAR_VITA);
  });
});

describe("multOffensif", () => {
  it("croît avec l'Intelligence et plafonne à +20 %", () => {
    // Plafond et coefficient revus (rework des 4 éléments) : +20 % à 200
    // d'intelligence (coefficient 0,001) et non plus +50 % à 100 (0,005) —
    // la marge doit encore servir en T2-T5, où la stat de frappe monte à 432.
    expect(multOffensif({ force: 0, intelligence: 0, agilite: 0, vitalite: 0 })).toBeCloseTo(1);
    expect(multOffensif({ force: 0, intelligence: 100, agilite: 0, vitalite: 0 })).toBeCloseTo(1.1);
    expect(multOffensif({ force: 0, intelligence: 1000, agilite: 0, vitalite: 0 })).toBeCloseTo(1.2);
  });
});

describe("multSoin", () => {
  it("vaut 1 sans stat, croît avec Soin ET la caractéristique de frappe passée en second argument, plafonne à +50 %", () => {
    // Signature changée (rework des 4 éléments) : multSoin ne lit plus l'Intelligence
    // en dur, elle reçoit la caractéristique de FRAPPE du lanceur en second argument —
    // un soigneur dont les éléments ne comprennent pas le feu (Ouginak, Ecaflip…)
    // doit quand même soigner avec sa propre stat de frappe. Coefficient et plafond
    // inchangés : 0,005, cap +50 %.
    const s = { force: 0, intelligence: 0, agilite: 0, vitalite: 0 };
    expect(multSoin(s, 0)).toBeCloseTo(1); // aucune stat → pas de bonus
    expect(multSoin({ ...s, soin: 40 }, 0)).toBeCloseTo(1.2);
    expect(multSoin(s, 40)).toBeCloseTo(1.2); // la caractéristique de frappe scale les soins
    expect(multSoin({ ...s, soin: 20 }, 20)).toBeCloseTo(1.2); // cumul
    expect(multSoin({ ...s, soin: 1000 }, 0)).toBeCloseTo(1.5); // plafond
  });
});
