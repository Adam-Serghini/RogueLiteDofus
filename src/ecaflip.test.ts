// =============================================================================
//  ecaflip.test.ts — Ecaflip : hasard (dé/cartes), vol de vie, adjacence, aléa.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";

const rngMax: () => number = () => 0.99;
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

const equipe = (ids: string[] = ["ecaflip", "iop"]) => equipeCombattante(nouvelleRun(ids));
const mannequin = () => {
  const e = fabriquerEnnemis("combat_1")[0];
  e.pvMax = 500;
  e.pvActuels = 500;
  return e;
};

describe("mixte & vol de vie", () => {
  it("Pattounes inflige des dégâts et soigne le lanceur", () => {
    const [eca] = equipe();
    eca.pvActuels = 10;
    const e = mannequin();
    lancerSort(eca, SORTS.pattounes, e.ref, [eca, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
    expect(eca.pvActuels).toBeGreaterThan(10);
  });

  it("Pelote chaude : rebondit sur les ennemis, buffe un allié", () => {
    const team = equipe(["ecaflip", "iop"]);
    const [eca, iop] = team;
    const ennemis = fabriquerEnnemis("combat_2");
    ennemis.forEach((x) => { x.pvMax = 500; x.pvActuels = 500; });
    const front = [...ennemis].sort((a, b) => a.position - b.position)[0];
    lancerSort(eca, SORTS.pelote_chaude, front.ref, [eca, ...ennemis], ctx());
    expect(ennemis.filter((x) => x.pvActuels < 500).length).toBeGreaterThanOrEqual(2);
    lancerSort(eca, SORTS.pelote_chaude, iop.ref, team, ctx());
    expect(iop.effets.some((x) => x.stat === "degatsInfliges" && x.valeur > 0)).toBe(true);
  });
});

describe("hasard (dé & cartes)", () => {
  it("All in inflige des dégâts (mise au dé)", () => {
    const [eca] = equipe();
    const e = mannequin();
    lancerSort(eca, SORTS.all_in, e.ref, [eca, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
  });

  it("Bonne pioche octroie un bonus de dé temporisé", () => {
    const [eca] = equipe();
    lancerSort(eca, SORTS.bonne_pioche, eca.ref, [eca], ctx());
    expect(eca.bonusDe).toBeGreaterThanOrEqual(1);
    expect(eca.bonusDeTours).toBe(2);
  });

  it("Tarot (Cœur, rng max) inflige des dégâts et soigne le lanceur", () => {
    const [eca] = equipe();
    eca.pvActuels = 20;
    const e = mannequin();
    lancerSort(eca, SORTS.tarot, e.ref, [eca, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
    expect(eca.pvActuels).toBeGreaterThan(20);
  });

  it("Tarot sur un allié applique un effet bénéfique (soin)", () => {
    const team = equipe(["ecaflip", "iop"]);
    const [eca, iop] = team;
    iop.pvActuels = 10;
    lancerSort(eca, SORTS.tarot, iop.ref, team, ctx());
    expect(iop.pvActuels).toBeGreaterThan(10);
  });
});

describe("effets aléatoires & adjacence", () => {
  it("Langue râpeuse applique un effet aléatoire (friction ici)", () => {
    const [eca] = equipe();
    const e = mannequin();
    // esquive 0.9, jet 0.5, crit 0.9, proc 0.5 → index floor(0.5×3)=1 = friction
    const seq = [0.9, 0.5, 0.9, 0.5];
    let i = 0;
    const rng = () => seq[Math.min(i++, seq.length - 1)];
    lancerSort(eca, SORTS.langue_rapeuse, e.ref, [eca, e], ctx({ rng }));
    expect(e.effets.some((x) => x.stat === "friction")).toBe(true);
  });

  it("Tactique féline donne +1 PA aux alliés des cases adjacentes", () => {
    const team = equipe(["ecaflip", "iop"]);
    const [eca, iop] = team;
    lancerSort(eca, SORTS.tactique_feline, eca.ref, team, ctx());
    expect(iop.paBonusNextTurn).toBe(1);
  });

  it("Esprit félin applique un effet à chaque unité (rng max → res all aux alliés)", () => {
    const team = equipe(["ecaflip", "iop"]);
    const [eca, iop] = team;
    const e = mannequin();
    lancerSort(eca, SORTS.esprit_felin, eca.ref, [...team, e], ctx());
    expect(eca.effets.some((x) => x.stat === "resAll")).toBe(true);
    expect(iop.effets.some((x) => x.stat === "resAll")).toBe(true);
  });
});
