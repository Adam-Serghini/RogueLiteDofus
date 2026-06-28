// =============================================================================
//  feca.test.ts — Feca : boucliers, échec critique, réduction de dégâts, glyphes.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, degatsCible, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";

const rngMax: () => number = () => 0.99;
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

const equipe = (ids: string[] = ["feca", "iop"]) => equipeCombattante(nouvelleRun(ids));
const mannequin = () => {
  const e = fabriquerEnnemis("combat_1")[0];
  e.pvMax = 500;
  e.pvActuels = 500;
  return e;
};

describe("boucliers", () => {
  it("Attaque céleste octroie un bouclier proportionnel aux dégâts", () => {
    const [f] = equipe();
    const e = mannequin();
    expect(f.bouclier).toBe(0);
    lancerSort(f, SORTS.attaque_celeste, e.ref, [f, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
    expect(f.bouclier).toBeGreaterThan(0);
  });

  it("Onde : dégâts sur un ennemi, bouclier sur un allié", () => {
    const team = equipe();
    const [f, iop] = team;
    const e = mannequin();
    lancerSort(f, SORTS.onde, e.ref, [...team, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
    lancerSort(f, SORTS.onde, iop.ref, [...team, e], ctx());
    expect(iop.bouclier).toBeGreaterThan(0);
  });
});

describe("échec critique (déstabilisation)", () => {
  it("Ouragan applique l'échec critique et peut faire rater le sort de la cible", () => {
    const [f] = equipe();
    const e = mannequin();
    lancerSort(f, SORTS.ouragan, e.ref, [f, e], ctx());
    expect(e.effets.some((x) => x.stat === "echecCritique")).toBe(true);
    const pvAvant = f.pvActuels;
    lancerSort(e, SORTS.morsure, f.ref, [f, e], ctx({ rng: () => 0 })); // rng bas → échec
    expect(f.pvActuels).toBe(pvAvant); // la morsure a échoué
  });
});

describe("réduction de dégâts", () => {
  it("Bâton du berger réduit fortement les dégâts subis", () => {
    const team = equipe();
    const [f, iop] = team;
    const e = mannequin();
    const avant = degatsCible(e, SORTS.morsure, iop, { useMax: true, mult: 1, ctx: ctx() }).dmg;
    lancerSort(f, SORTS.baton_du_berger, iop.ref, [...team, e], ctx());
    const apres = degatsCible(e, SORTS.morsure, iop, { useMax: true, mult: 1, ctx: ctx() }).dmg;
    expect(apres).toBeLessThan(avant);
  });

  it("Armures réduit les dégâts subis de toute l'équipe (réduction plate)", () => {
    const team = equipe();
    const [f, iop] = team;
    const e = mannequin();
    const avant = degatsCible(e, SORTS.morsure, iop, { useMax: true, mult: 1, ctx: ctx() }).dmg;
    lancerSort(f, SORTS.armures, f.ref, [...team, e], ctx());
    const apres = degatsCible(e, SORTS.morsure, iop, { useMax: true, mult: 1, ctx: ctx() }).dmg;
    expect(apres).toBeLessThan(avant);
  });
});

describe("glyphes & provocation", () => {
  it("Glyphe stimulant booste les dégâts finaux de 2 alliés", () => {
    const team = equipe(["feca", "iop", "cra"]);
    const [f] = team;
    lancerSort(f, SORTS.glyphe_stimulant, team[1].ref, team, ctx());
    const buffes = team.filter((c) => c.effets.some((e) => e.stat === "degatsInfliges" && e.valeur > 0));
    expect(buffes.length).toBe(2);
  });

  it("Glyphe naturel affaiblit les dégâts des 3 ennemis touchés", () => {
    const [f] = equipe();
    const ennemis = fabriquerEnnemis("combat_2"); // 3 ennemis
    ennemis.forEach((x) => { x.pvMax = 500; x.pvActuels = 500; });
    const front = [...ennemis].sort((a, b) => a.position - b.position)[0];
    lancerSort(f, SORTS.glyphe_naturel, front.ref, [f, ...ennemis], ctx());
    expect(ennemis.filter((x) => x.effets.some((e) => e.stat === "degatsInfliges" && e.valeur < 0)).length).toBeGreaterThanOrEqual(2);
  });

  it("Provocation rend le Feca provocateur (temporisé)", () => {
    const [f] = equipe();
    lancerSort(f, SORTS.provocation, f.ref, [f], ctx());
    expect(f.provoque).toBe(true);
    expect(f.provoqueTours).toBe(2);
  });
});
