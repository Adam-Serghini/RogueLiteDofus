// =============================================================================
//  sram.test.ts — Sram : poisons, exécution, multi-coups, Arsenic, esquive.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";

const rngMax: () => number = () => 0.99; // pas d'esquive, jets au max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

const sram = () => equipeCombattante(nouvelleRun(["sram", "iop"]))[0];
/** Un ennemi avec beaucoup de PV pour survivre aux coups et observer les effets. */
const mannequin = () => {
  const e = fabriquerEnnemis("combat_1")[0];
  e.pvMax = 500;
  e.pvActuels = 500;
  return e;
};

describe("poisons", () => {
  it("Coupe Jarret inflige des dégâts et un poison", () => {
    const s = sram();
    const e = mannequin();
    lancerSort(s, SORTS.coupe_jarret, e.ref, [s, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
    expect(e.effets.some((x) => x.stat === "poison")).toBe(true);
  });

  it("Flasque vénimeuse empoisonne 3 cibles", () => {
    const s = sram();
    const ennemis = fabriquerEnnemis("combat_2"); // 3 ennemis (cases 0,1,4)
    ennemis.forEach((x) => { x.pvMax = 500; x.pvActuels = 500; });
    const front = [...ennemis].sort((a, b) => a.position - b.position)[0];
    lancerSort(s, SORTS.flasque_venimeuse, front.ref, [s, ...ennemis], ctx());
    expect(ennemis.filter((x) => x.effets.some((e) => e.stat === "poison")).length).toBeGreaterThanOrEqual(2);
  });

  it("Arsenic double les dégâts des poisons appliqués ensuite", () => {
    const s = sram();
    const e = mannequin();
    lancerSort(s, SORTS.arsenic, s.ref, [s, e], ctx());
    expect(s.poisonAmpliTours).toBe(2);
    lancerSort(s, SORTS.dagues_insidieuses, e.ref, [s, e], ctx());
    const poison = e.effets.find((x) => x.stat === "poison");
    expect(poison?.valeur).toBe(10); // 5 × 2
  });
});

describe("Mise à mort (exécution)", () => {
  it("exécute une cible affaiblie", () => {
    const s = sram();
    const e = fabriquerEnnemis("combat_1")[0];
    e.pvActuels = 5;
    lancerSort(s, SORTS.mise_a_mort, e.ref, [s, e], ctx());
    expect(e.pvActuels).toBe(0);
  });

  it("échoue (aucun dégât) si la cible survivrait", () => {
    const s = sram();
    const boss = fabriquerEnnemis("boss")[0]; // gros PV
    const avant = boss.pvActuels;
    lancerSort(s, SORTS.mise_a_mort, boss.ref, [s, boss], ctx());
    expect(boss.pvActuels).toBe(avant);
  });
});

describe("multi-coups & projectiles", () => {
  it("Coup double frappe deux fois et peut poser poison puis friction", () => {
    const s = sram();
    const e = mannequin();
    // séquence par coup : [esquive haut, jet, crit haut, proc bas]
    const seq = [0.9, 0.5, 0.9, 0.0, 0.9, 0.5, 0.9, 0.0];
    let i = 0;
    const rng = () => seq[Math.min(i++, seq.length - 1)];
    lancerSort(s, SORTS.coup_double, e.ref, [s, e], ctx({ rng }));
    expect(e.pvActuels).toBeLessThan(500);
    expect(e.effets.some((x) => x.stat === "poison")).toBe(true);
    expect(e.effets.some((x) => x.stat === "friction")).toBe(true);
  });

  it("Déluge de lames inflige plusieurs frappes", () => {
    const s = sram();
    const e = mannequin();
    lancerSort(s, SORTS.deluge_de_lames, e.ref, [s, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
  });
});

describe("Maître des ombres", () => {
  it("octroie de l'esquive et un boost d'Agilité scalé au niveau", () => {
    const s = sram();
    lancerSort(s, SORTS.maitre_des_ombres, s.ref, [s], ctx());
    expect(s.effets.some((x) => x.stat === "esquive" && x.valeur === 0.25)).toBe(true);
    const agi = s.effets.find((x) => x.stat === "agilite");
    expect(agi?.valeur).toBe(15 + 0.5 * s.niveau);
  });
});
