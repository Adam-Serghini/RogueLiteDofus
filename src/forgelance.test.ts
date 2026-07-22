// =============================================================================
//  forgelance.test.ts — Kit du Forgelance : la Lance, Muspel, Hydra, Jormun,
//  Vajra, Étreinte de Valkyr. Interactions croisées avec le socle (Flèche de
//  recul, Pendule, bombes).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, poserBombe, degatsCible, LANCE_DURABILITE,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Forgelance prêt à combattre (agilité 0 pour le déterminisme). */
function forgelance(): Combatant {
  const c = equipeCombattante(nouvelleRun(["forgelance"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
/** Un ennemi « bouche-trou » placé à une position précise. */
function ennemiA(position: number): Combatant {
  const c = equipeCombattante(nouvelleRun(["cra"]))[0];
  c.camp = "ennemi";
  c.position = position;
  c.ref = `e_${position}_${Math.random().toString(36).slice(2)}`;
  c.resistances = {};
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
/** Un allié « bouche-trou » placé à une position précise. */
function allieA(position: number): Combatant {
  const c = equipeCombattante(nouvelleRun(["iop"]))[0];
  c.position = position;
  c.ref = `a_${position}_${Math.random().toString(36).slice(2)}`;
  c.resistances = {};
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

const laLance = (cs: Combatant[]) => cs.find((c) => c.estLance);

describe("classe Forgelance", () => {
  it("est recrutable, avec son kit de 6 sorts", () => {
    expect(CLASSES.forgelance).toBeDefined();
    expect(CLASSES.forgelance.sorts).toEqual([
      "muspel", "hydra", "jormun", "lance", "vajra", "etreinte_de_valkyr",
    ]);
    expect(CLASSES.forgelance.sorts.length).toBe(6);
    for (const id of CLASSES.forgelance.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Lance", () => {
  it("se plante dans la rangée de la cible (avant), limitée à 2/tour", () => {
    const f = forgelance();
    const en0 = ennemiA(0); // avant
    const cs = [f, en0];
    expect(SORTS.lance.maxParTour).toBe(2);
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance).toBeDefined();
    expect(lance.position).toBeLessThan(4);
    expect(lance.lanceurRef).toBe(f.ref);
    expect(lance.pvActuels).toBe(LANCE_DURABILITE);
  });

  it("se plante dans la rangée de la cible (arrière)", () => {
    const f = forgelance();
    const en1 = ennemiA(4); // arrière
    const cs = [f, en1];
    lancerSort(f, SORTS.lance, en1.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.position).toBeGreaterThanOrEqual(4);
  });

  it("est grisée (aucune cible) tant qu'une lance du lanceur est vivante", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const cs = [f, en0];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    expect(ciblesValides(f, SORTS.lance, cs)).toEqual([]);
  });
});

describe("Muspel", () => {
  it("multiplie chaque jet ×1,30 à 2 ennemis touchés", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    const base = degatsCible(f, SORTS.muspel, en0, { useMax: false, mult: 1, ctx: ctx() }).dmg;

    const avant0 = en0.pvActuels;
    lancerSort(f, SORTS.muspel, en0.ref, cs, ctx());
    const dmgZone = avant0 - en0.pvActuels;

    expect(Math.abs(dmgZone - Math.round(base * 1.3))).toBeLessThanOrEqual(1);
    expect(en1.pvActuels).toBeLessThan(500); // toute la rangée avant est touchée
  });

  it("la lance de la zone prend −1 durabilité et NE compte PAS dans le bonus", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx()); // plante en rangée avant
    const lance = laLance(cs)!;
    expect(lance.pvActuels).toBe(LANCE_DURABILITE);

    const base = degatsCible(f, SORTS.muspel, en0, { useMax: false, mult: 1, ctx: ctx() }).dmg;

    const avant0 = en0.pvActuels;
    lancerSort(f, SORTS.muspel, en0.ref, cs, ctx());
    const dmgZone = avant0 - en0.pvActuels;

    expect(lance.pvActuels).toBe(LANCE_DURABILITE - 1); // touchée, mais pas comptée
    // toujours ×1,30 (2 ennemis RÉELS : en0 + en1), la lance ne s'ajoute pas au calcul
    expect(Math.abs(dmgZone - Math.round(base * 1.3))).toBeLessThanOrEqual(1);
  });
});

describe("Hydra", () => {
  it("octroie 6 de bouclier par ennemi (non-lance) touché", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    expect(f.bouclier).toBe(0);
    lancerSort(f, SORTS.hydra, en0.ref, cs, ctx());
    expect(f.bouclier).toBe(6 * 2);
  });

  it("la lance touchée dans la zone ne compte pas dans le bouclier", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    lancerSort(f, SORTS.hydra, en0.ref, cs, ctx());
    expect(f.bouclier).toBe(6 * 2); // en0 + en1, pas la lance
  });
});

describe("Jormun", () => {
  it("sur un ennemi avant : ne touche que la rangée avant", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(4);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.jormun, en0.ref, cs, ctx());
    expect(en0.pvActuels).toBeLessThan(500);
    expect(en1.pvActuels).toBe(500);
  });

  it("sur la lance en rangée ARRIÈRE : touche TOUS les ennemis", () => {
    const f = forgelance();
    const en0 = ennemiA(0); // avant
    const en1 = ennemiA(4); // arrière — la lance ira ici
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en1.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.position).toBeGreaterThanOrEqual(4);

    lancerSort(f, SORTS.jormun, lance.ref, cs, ctx());
    expect(en0.pvActuels).toBeLessThan(500);
    expect(en1.pvActuels).toBeLessThan(500);
    expect(lance.pvActuels).toBe(LANCE_DURABILITE - 1);
  });

  it("la lance en rangée AVANT est une cible valide, mais ne déclenche pas le tous-azimuts", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(4);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx()); // plante en AVANT
    const lance = laLance(cs)!;
    expect(lance.position).toBeLessThan(4);
    expect(ciblesValides(f, SORTS.jormun, cs).some((c) => c.ref === lance.ref)).toBe(true);

    lancerSort(f, SORTS.jormun, lance.ref, cs, ctx());
    expect(en1.pvActuels).toBe(500); // arrière épargnée : lance en AVANT
  });
});

describe("Vajra", () => {
  it("est injouable sans lance vivante du lanceur", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    expect(ciblesValides(f, SORTS.vajra, [f, en0])).toEqual([]);
  });

  it("rappelle la lance intacte : soigne 2×7 (multSoin=1) + bouclier de bris", () => {
    const f = forgelance();
    f.stats = { ...f.stats, intelligence: 0, soin: 0 }; // multSoin = 1
    f.pvActuels = 100;
    const en0 = ennemiA(0);
    const cs = [f, en0];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.pvActuels).toBe(LANCE_DURABILITE); // intacte

    expect(ciblesValides(f, SORTS.vajra, cs)).toEqual([f]);
    lancerSort(f, SORTS.vajra, f.ref, cs, ctx());
    expect(f.pvActuels).toBe(100 + 7 * LANCE_DURABILITE); // soin selon durabilité restante
    expect(f.bouclier).toBeGreaterThan(0); // bouclier de bris standard, en plus du soin
    expect(cs.filter((c) => c.pvActuels > 0 && c.estLance).length).toBe(0); // la lance a disparu
  });

  it("rappelle la lance endommagée : soin réduit à la durabilité restante", () => {
    const f = forgelance();
    f.stats = { ...f.stats, intelligence: 0, soin: 0 };
    const en0 = ennemiA(0);
    const cs = [f, en0];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    const lance = laLance(cs)!;
    // simule un coup déjà encaissé : il ne reste qu'1 point de durabilité
    lance.pvActuels = LANCE_DURABILITE - 1;

    f.pvActuels = 100;
    lancerSort(f, SORTS.vajra, f.ref, cs, ctx());
    expect(f.pvActuels).toBe(100 + 7 * (LANCE_DURABILITE - 1));
  });
});

describe("Étreinte de Valkyr", () => {
  it("pose une redirection 1 tour, expire ensuite, cooldown de 2", () => {
    const f = forgelance();
    const cs = [f];
    lancerSort(f, SORTS.etreinte_de_valkyr, f.ref, cs, ctx());
    expect(f.redirection).toEqual({ ratio: 0.5, tours: 1 });
    expect(f.cooldowns["etreinte_de_valkyr"]).toBe(2);
  });

  it("dévie la moitié des dégâts destinés à un allié arrière vers le porteur", () => {
    const f = forgelance();
    f.position = 0; // avant
    const alliéArriere = allieA(4);
    alliéArriere.pvActuels = 200; alliéArriere.pvMax = 200;
    f.pvActuels = 200; f.pvMax = 200;
    const en0 = ennemiA(0);
    const cs = [f, alliéArriere, en0];
    lancerSort(f, SORTS.etreinte_de_valkyr, f.ref, cs, ctx());

    lancerSort(en0, SORTS.morsure, alliéArriere.ref, cs, ctx());
    const dmgAllie = 200 - alliéArriere.pvActuels;
    const dmgF = 200 - f.pvActuels;
    expect(dmgAllie).toBeGreaterThan(0);
    expect(dmgF).toBeGreaterThan(0);
    expect(Math.abs(dmgAllie - dmgF)).toBeLessThanOrEqual(1);
  });
});

describe("interactions croisées", () => {
  it("Flèche de recul : la poussée qui percute la lance lui retire 1 durabilité", () => {
    const cra = equipeCombattante(nouvelleRun(["cra"]))[0];
    cra.stats = { ...cra.stats, agilite: 0 };
    const f = forgelance();
    const cible = ennemiA(0); // avant, sera repoussée
    const cs = [cra, f, cible];
    // plante la lance en rangée arrière : elle occupera la case d'arrivée de la poussée
    lancerSort(f, SORTS.lance, cible.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.position).toBeLessThan(4); // la lance suit la rangée de sa cible (avant)

    // on replante manuellement une situation où la lance occupe la rangée ARRIÈRE de la cible
    lance.position = 4;
    const avantDurabilite = lance.pvActuels;
    lancerSort(cra, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(lance.pvActuels).toBe(avantDurabilite - 1);
  });

  it("Pendule : si la seule case libre de la rangée opposée est occupée par la lance, le déplacement échoue", () => {
    const xelor = equipeCombattante(nouvelleRun(["xelor"]))[0];
    xelor.stats = { ...xelor.stats, agilite: 0 };
    const f = forgelance();
    const cible = ennemiA(0); // avant
    const bloque1 = ennemiA(5);
    const bloque2 = ennemiA(6);
    const cs = [xelor, f, cible, bloque1, bloque2];
    lancerSort(f, SORTS.lance, bloque1.ref, cs, ctx()); // plante en arrière (rangée de bloque1)
    const lance = laLance(cs)!;
    expect(lance.position).toBeGreaterThanOrEqual(4);
    // la rangée arrière (4-7) est désormais : bloque1, bloque2, lance → 3/4 cases prises,
    // il reste une case libre ; on la comble aussi pour forcer l'échec du déplacement.
    const positionsPrises = new Set([bloque1.position, bloque2.position, lance.position]);
    const derniereCaseLibre = [4, 5, 6, 7].find((p) => !positionsPrises.has(p))!;
    const bloqueur = ennemiA(derniereCaseLibre);
    const csComplet = [...cs, bloqueur];

    const posAvant = cible.position;
    lancerSort(xelor, SORTS.pendule, cible.ref, csComplet, ctx());
    expect(cible.position).toBe(posAvant); // rangée arrière pleine (dont la lance) : échec silencieux
  });

  it("les bombes (Roublard) refusent de coller à la lance", () => {
    const f = forgelance();
    const cible = ennemiA(0);
    const cs = [f, cible];
    lancerSort(f, SORTS.lance, cible.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(poserBombe(lance)).toBe(false);
    expect(lance.bombes ?? 0).toBe(0);
  });
});
