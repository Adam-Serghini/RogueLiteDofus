// =============================================================================
//  eniripsa.test.ts — Mécaniques de soutien (Eniripsa) : soins, bouclier,
//  poison, HoT, vol de vie, dissipe, don de PA, cooldown.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, ciblesValides, effetsDebutTour, type CombatCtx } from "./combat";
import { multSoin } from "./progression";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";

const rngMax: () => number = () => 0.99; // pas d'esquive, jets au max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

// L'équipe de départ est désormais [Iop, Cra, Eniripsa].
const equipe = () => fabriquerEquipe();

describe("soins", () => {
  it("Mot Alternatif soigne un allié (× puissance de soin de l'Eniripsa)", () => {
    const [iop, , eni] = equipe();
    iop.pvActuels = 10;
    lancerSort(eni, SORTS.mot_alternatif, iop.ref, [iop, eni], ctx());
    // 10 + jet max du soin (20) × multSoin(Eniripsa)
    expect(iop.pvActuels).toBe(10 + Math.round(20 * multSoin(eni.stats)));
  });

  it("la puissance de soin (stat Soin) amplifie les soins", () => {
    const [iop, , eni] = equipe();
    expect(multSoin(eni.stats)).toBeGreaterThan(1); // l'Eniripsa a une stat Soin
    iop.pvActuels = 1;
    const sansBonus = SORTS.mot_alternatif.mixte?.surAllie.soin?.max ?? 0; // jet max sans bonus
    lancerSort(eni, SORTS.mot_alternatif, iop.ref, [iop, eni], ctx());
    expect(iop.pvActuels - 1).toBeGreaterThan(sansBonus);
  });

  it("Mot de reconstitution soigne entièrement", () => {
    const [iop, , eni] = equipe();
    iop.pvActuels = 7;
    lancerSort(eni, SORTS.mot_reconstitution, iop.ref, [iop, eni], ctx());
    expect(iop.pvActuels).toBe(iop.pvMax);
  });

  it("Mot d'entraide soigne toute l'équipe", () => {
    const team = equipe();
    team.forEach((c) => (c.pvActuels = 10));
    lancerSort(team[2], SORTS.mot_revitalisant, team[2].ref, team, ctx());
    expect(team.every((c) => c.pvActuels > 10)).toBe(true);
  });

  it("Mot vampirique soigne l'équipe d'une fraction des dégâts", () => {
    const team = equipe();
    team.forEach((c) => (c.pvActuels = 20));
    const boss = fabriquerEnnemis("boss")[0];
    lancerSort(team[2], SORTS.mot_vampirique, boss.ref, [...team, boss], ctx());
    expect(team.some((c) => c.pvActuels > 20)).toBe(true);
  });

  it("Mot Alternatif inflige des dégâts sur un ennemi (pas de soin)", () => {
    const [, , eni] = equipe();
    const boss = fabriquerEnnemis("boss")[0];
    const pvAvant = boss.pvActuels;
    lancerSort(eni, SORTS.mot_alternatif, boss.ref, [eni, boss], ctx());
    expect(boss.pvActuels).toBeLessThan(pvAvant); // ennemi blessé, non soigné
  });
});

describe("bouclier", () => {
  it("Mot préventif applique un bouclier + un HoT", () => {
    const [iop, , eni] = equipe();
    lancerSort(eni, SORTS.mot_prevention, iop.ref, [iop, eni], ctx());
    expect(iop.bouclier).toBe(Math.round(iop.pvMax * 0.15));
    expect(iop.effets.some((e) => e.stat === "hot")).toBe(true);
  });

  it("le bouclier encaisse les dégâts avant les PV", () => {
    const [iop] = equipe();
    iop.bouclier = 100;
    const pvAvant = iop.pvActuels;
    const [bouftou] = fabriquerEnnemis("combat_1");
    lancerSort(bouftou, SORTS.morsure, iop.ref, [iop, bouftou], ctx());
    expect(iop.pvActuels).toBe(pvAvant); // dégâts absorbés
    expect(iop.bouclier).toBeLessThan(100);
  });
});

describe("poison", () => {
  it("Fiole de douleur applique un poison transmissible", () => {
    const [, , eni] = equipe();
    const boss = fabriquerEnnemis("boss")[0]; // Tournesol Affamé, gros PV : survit au coup
    lancerSort(eni, SORTS.mot_interdit, boss.ref, [eni, boss], ctx());
    expect(boss.pvActuels).toBeGreaterThan(0);
    expect(boss.effets.some((e) => e.stat === "poison" && e.transmet)).toBe(true);
  });

  it("le poison inflige des dégâts au début du tour", () => {
    const [iop] = equipe();
    iop.pvActuels = 50;
    iop.effets.push({ stat: "poison", valeur: 6, toursRestants: 2 });
    effetsDebutTour(iop, [iop], ctx());
    expect(iop.pvActuels).toBe(44);
  });

  it("le poison se transmet au combattant derrière si la cible meurt", () => {
    const ennemis = fabriquerEnnemis("combat_2"); // cases 0, 1, 4
    const front = [...ennemis].sort((a, b) => a.position - b.position)[0]; // le plus devant
    front.pvActuels = 4;
    front.effets.push({ stat: "poison", valeur: 6, toursRestants: 2, transmet: true });
    const passe = effetsDebutTour(front, ennemis, ctx());
    expect(front.pvActuels).toBe(0);
    expect(passe).toBe(true);
    const autres = ennemis.filter((e) => e !== front);
    expect(autres.some((e) => e.effets.some((x) => x.stat === "poison"))).toBe(true);
  });
});

describe("HoT, dissipe, PA", () => {
  it("le HoT régénère des PV au début du tour", () => {
    const [iop] = equipe();
    iop.pvActuels = 10;
    iop.effets.push({ stat: "hot", valeur: 5, toursRestants: 2 });
    effetsDebutTour(iop, [iop], ctx());
    expect(iop.pvActuels).toBe(15);
  });

  it("Antivenin dissipe le poison et applique un HoT", () => {
    const [iop, , eni] = equipe();
    iop.effets.push({ stat: "poison", valeur: 5, toursRestants: 2 });
    lancerSort(eni, SORTS.mot_jouvence, iop.ref, [iop, eni], ctx());
    expect(iop.effets.some((e) => e.stat === "poison")).toBe(false);
    expect(iop.effets.some((e) => e.stat === "hot")).toBe(true);
  });

  it("Mot d'ivation octroie des PA puis se met en cooldown sur la cible", () => {
    const [iop, , eni] = equipe();
    const cs = [iop, eni];
    expect(ciblesValides(eni, SORTS.mot_stimulant, cs).some((c) => c.ref === iop.ref)).toBe(true);
    lancerSort(eni, SORTS.mot_stimulant, iop.ref, cs, ctx());
    expect(iop.paBonusNextTurn).toBe(2);
    // la cible n'est plus ciblable par ce sort tant que le cooldown court
    expect(ciblesValides(eni, SORTS.mot_stimulant, cs).some((c) => c.ref === iop.ref)).toBe(false);
  });

  it("le don de PA s'applique à la recharge du tour suivant", () => {
    const [iop] = equipe();
    iop.paActuels = iop.paMax;
    iop.paBonusNextTurn = 2;
    effetsDebutTour(iop, [iop], ctx());
    expect(iop.paActuels).toBe(iop.paMax + 2);
    expect(iop.paBonusNextTurn).toBe(0);
  });
});
