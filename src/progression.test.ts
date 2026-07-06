// =============================================================================
//  progression.test.ts — Validation du système de niveaux & points.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  progressionInitiale, xpRequis, coutPoint, gagnerXP, investir, restat,
  statsFinales, pvMaxFor, multOffensif, multSoin, STAT_KEYS, investirN,
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
  it("monte d'un niveau et octroie 5 points", () => {
    const p = progressionInitiale();
    const niv = gagnerXP(p, 50); // xpRequis(1) = 50
    expect(niv).toBe(1);
    expect(p.niveau).toBe(2);
    expect(p.pointsDispo).toBe(5);
    expect(p.xp).toBe(0);
  });

  it("enchaîne plusieurs niveaux d'un coup", () => {
    const p = progressionInitiale();
    const niv = gagnerXP(p, 200); // 50 + 75 + ... → 2 niveaux (50+75=125), reste 75 → niv3 ? 125<200
    // niveaux : 50 (→2), 75 (→3), 100 (→4) = 225 > 200 ; donc 2 niveaux, reste 200-125=75
    expect(niv).toBe(2);
    expect(p.niveau).toBe(3);
    expect(p.pointsDispo).toBe(10);
    expect(p.xp).toBe(75);
  });
});

describe("investir / restat", () => {
  it("débite le bon coût et incrémente la stat", () => {
    const p = progressionInitiale();
    p.pointsDispo = 3;
    expect(investir(p, "force")).toBe(true);
    expect(p.pointsInvestis.force).toBe(1);
    expect(p.pointsDispo).toBe(2);
  });

  it("refuse si pas assez de points", () => {
    const p = progressionInitiale();
    p.pointsDispo = 0;
    expect(investir(p, "vitalite")).toBe(false);
    expect(p.pointsInvestis.vitalite).toBe(0);
  });

  it("investirN dépense jusqu'à n points ; Max vide le pool", () => {
    const p = progressionInitiale();
    p.pointsDispo = 10;
    expect(investirN(p, "force", 3)).toBe(3);
    expect(p.pointsInvestis.force).toBe(3);
    expect(p.pointsDispo).toBe(7);
    expect(investirN(p, "agilite", Infinity)).toBe(7); // « Max »
    expect(p.pointsDispo).toBe(0);
  });

  it("restat rembourse tout dans le pool", () => {
    const p = progressionInitiale();
    p.pointsDispo = 10;
    investir(p, "force");
    investir(p, "agilite");
    restat(p);
    expect(p.pointsDispo).toBe(10);
    expect(p.pointsInvestis.force).toBe(0);
    expect(p.pointsInvestis.agilite).toBe(0);
  });
});

describe("stats finales & PV", () => {
  it("statsFinales = base + investis", () => {
    const p = progressionInitiale();
    p.pointsInvestis.force = 10;
    const s = statsFinales(CLASSES.iop, p);
    expect(s.force).toBe(CLASSES.iop.stats.force + 10);
  });

  it("pvMaxFor = pvBase + vitalité finale", () => {
    const p = progressionInitiale();
    const base = pvMaxFor(CLASSES.iop, p); // 60 + 50 = 110
    expect(base).toBe(CLASSES.iop.pvBase + CLASSES.iop.stats.vitalite);
    p.pointsInvestis.vitalite = 20;
    expect(pvMaxFor(CLASSES.iop, p)).toBe(base + 20);
  });
});

describe("multOffensif", () => {
  it("croît avec l'Intelligence et plafonne à +50 %", () => {
    expect(multOffensif({ force: 0, intelligence: 0, agilite: 0, vitalite: 0 })).toBeCloseTo(1);
    expect(multOffensif({ force: 0, intelligence: 20, agilite: 0, vitalite: 0 })).toBeCloseTo(1.1);
    expect(multOffensif({ force: 0, intelligence: 1000, agilite: 0, vitalite: 0 })).toBeCloseTo(1.5);
  });
});

describe("multSoin", () => {
  it("vaut 1 sans stat, croît avec Soin ET Intelligence, plafonne à +50 %", () => {
    const s = { force: 0, intelligence: 0, agilite: 0, vitalite: 0 };
    expect(multSoin(s)).toBeCloseTo(1); // aucune stat → pas de bonus
    expect(multSoin({ ...s, soin: 40 })).toBeCloseTo(1.2);
    expect(multSoin({ ...s, intelligence: 40 })).toBeCloseTo(1.2); // l'Intelligence scale les soins
    expect(multSoin({ ...s, soin: 20, intelligence: 20 })).toBeCloseTo(1.2); // cumul
    expect(multSoin({ ...s, soin: 1000 })).toBeCloseTo(1.5); // plafond
  });
});

describe("stats étendues", () => {
  it("Chance est investable ; Soin et Prospection non", () => {
    expect(STAT_KEYS).toContain("chance");
    expect(STAT_KEYS).not.toContain("soin");
    expect(STAT_KEYS).not.toContain("prospection");
  });

  it("statsFinales : Chance investie (base+points) ; Soin/Prospection = valeur de classe", () => {
    const p = progressionInitiale();
    p.pointsInvestis.chance = 15;
    const s = statsFinales(CLASSES.eniripsa, p);
    expect(s.chance).toBe((CLASSES.eniripsa.stats.chance ?? 0) + 15);
    expect(s.soin).toBe(CLASSES.eniripsa.stats.soin ?? 0); // non investable
    expect(s.prospection).toBe(CLASSES.eniripsa.stats.prospection ?? 0);
  });
});
