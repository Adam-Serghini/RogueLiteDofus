// =============================================================================
//  combat.test.ts — Validation headless du moteur (avant toute UI).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  degatsCible, elementDeFrappe, ciblesValides, runCombat, controllerIA,
  type CombatCtx,
} from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis, bonusDegatsDofus } from "./run";

// rng=0.99 → jamais d'esquive, jet au max, jamais de crit (déterministe).
const rngMax: () => number = () => 0.99;
// rng=0 → force l'esquive si la cible a de l'agilité.
const rngZero: () => number = () => 0;

const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

describe("élément de frappe", () => {
  it("est déterminé par la plus haute stat élémentaire", () => {
    const [iop, cra] = fabriquerEquipe();
    iop.stats = { ...iop.stats, force: 60 }; // build Terre
    cra.stats = { ...cra.stats, agilite: 55 }; // build Air
    expect(elementDeFrappe(iop)).toBe("terre");
    expect(elementDeFrappe(cra)).toBe("air");
  });

  it("bascule sur les nouveaux éléments (eau / wakfu / stasis)", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, chance: 999 };
    expect(elementDeFrappe(iop)).toBe("eau"); // Chance domine
    iop.stats = { ...iop.stats, chance: 0, wakfu: 999 };
    expect(elementDeFrappe(iop)).toBe("wakfu");
    iop.stats = { ...iop.stats, wakfu: 0, stasis: 999 };
    expect(elementDeFrappe(iop)).toBe("stasis");
  });

  it("le joueur peut choisir son élément de frappe parmi les 2 plus forts", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, force: 60, agilite: 20 }; // Terre (1er) puis Air (2e)
    expect(elementDeFrappe(iop)).toBe("terre");
    iop.elementChoisi = "air"; // 2e plus fort → autorisé
    expect(elementDeFrappe(iop)).toBe("air");
    iop.elementChoisi = "feu"; // ni 1er ni 2e → ignoré, retombe sur le plus fort
    expect(elementDeFrappe(iop)).toBe("terre");
  });

  it("applique la résistance de l'élément de frappe basculé", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, stasis: 999 }; // frappe désormais en Stasis
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.resistances = { stasis: 0.5 }; // -50 % subis en Stasis
    const sansRes = degatsCible(iop, SORTS.pression, { ...cible, resistances: {} }, { useMax: true, mult: 1, ctx: ctx() });
    const avecRes = degatsCible(iop, SORTS.pression, cible, { useMax: true, mult: 1, ctx: ctx() });
    expect(avecRes.dmg).toBeLessThan(sansRes.dmg);
  });
});

describe("degatsCible", () => {
  it("applique jet max + scaling + résistance + puissance offensive", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, force: 60, intelligence: 10 };
    const [cible] = fabriquerEnnemis("combat_1");
    cible.resistances = { terre: 0.15 }; // résiste +15 % à la Terre
    const r = degatsCible(iop, SORTS.pression, cible, { useMax: true, mult: 1, ctx: ctx() });
    // (12 + 60*0.3) * (1 - 0.15) * multOffensif(Int 10 = 1.05) = 25.5 * 1.05 = 26.775 → 27
    expect(r.dmg).toBe(27);
    expect(r.esquive).toBe(false);
    expect(r.crit).toBe(false);
  });

  it("le bonus Dofus augmente les dégâts du joueur", () => {
    const [iop] = fabriquerEquipe();
    const [bouftou] = fabriquerEnnemis("combat_1");
    const base = degatsCible(iop, SORTS.pression, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    const boost = degatsCible(iop, SORTS.pression, bouftou, {
      useMax: true, mult: 1, ctx: ctx({ playerDamageBonus: 1.3 }),
    });
    expect(boost.dmg).toBeGreaterThan(base.dmg);
  });

  it("ignoreResistances : Flèche intrusive ignore la ligne de résistance", () => {
    const [, cra] = fabriquerEquipe();
    cra.stats = { ...cra.stats, agilite: 55, intelligence: 20 };
    const [bouftou] = fabriquerEnnemis("combat_1");
    const r = degatsCible(cra, SORTS.fleche_intrusive, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    // (7 + 55*0.2) * multOffensif(Int 20 = 1.10) = 18 * 1.10 = 19.8 → 20, aucune résistance
    expect(r.dmg).toBe(20);
  });

  it("esquive (Agilité) annule les dégâts", () => {
    const [iop, cra] = fabriquerEquipe();
    cra.stats = { ...cra.stats, agilite: 55 }; // esquive via Agilité
    const r = degatsCible(iop, SORTS.pression, cra, { useMax: true, mult: 1, ctx: ctx({ rng: rngZero }) });
    expect(r.esquive).toBe(true);
    expect(r.dmg).toBe(0);
  });

  it("le coup critique multiplie les dégâts (Dégât crit %)", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, force: 60, agilite: 20 }; // chance de crit via Force
    const [bouftou] = fabriquerEnnemis("combat_1");
    // séquence rng : pas d'esquive (0.9), crit déclenché (0.0)
    const seq = [0.9, 0.0];
    let i = 0;
    const rngCrit = () => seq[Math.min(i++, seq.length - 1)];
    const base = degatsCible(iop, SORTS.pression, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    const crit = degatsCible(iop, SORTS.pression, bouftou, { useMax: true, mult: 1, ctx: ctx({ rng: rngCrit }) });
    expect(crit.crit).toBe(true);
    expect(crit.dmg).toBeGreaterThan(base.dmg); // crit = bonus multiplicatif
  });
});

describe("règle de ligne (grille avant/arrière)", () => {
  it("un sort de ligne ne vise que la ligne avant (cases 0-3)", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2"); // cases 0, 1 (avant) + 4 (arrière)
    const cibles = ciblesValides(iop, SORTS.pression, [iop, ...ennemis]);
    expect(cibles.length).toBeGreaterThan(0);
    expect(cibles.every((c) => c.position < 4)).toBe(true);
  });

  it("si la ligne avant tombe, l'arrière devient ciblable", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2");
    ennemis.filter((e) => e.position < 4).forEach((e) => (e.pvActuels = 0)); // ligne avant K.O.
    const cibles = ciblesValides(iop, SORTS.pression, [iop, ...ennemis]);
    expect(cibles.length).toBeGreaterThan(0);
    expect(cibles.every((c) => c.pvActuels > 0)).toBe(true); // survivants (arrière) exposés
  });

  it("ennemi_tous outrepasse la ligne", () => {
    const [, cra] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2");
    expect(ciblesValides(cra, SORTS.fleche_intrusive, [cra, ...ennemis]).length).toBe(ennemis.length);
  });

  it("un ennemi ne peut viser que les alliés de la ligne avant", () => {
    const equipe = fabriquerEquipe(); // formation par défaut : iop(0) & cra(1) devant
    const [bouftou] = fabriquerEnnemis("combat_1");
    const cibles = ciblesValides(bouftou, SORTS.morsure, [...equipe, bouftou]);
    expect(cibles.length).toBe(equipe.filter((c) => c.position < 4).length);
    expect(cibles.every((c) => c.position < 4)).toBe(true);
  });
});

describe("bonusDegatsDofus", () => {
  it("cumule les copies du Dofus Pourpre", () => {
    expect(bonusDegatsDofus({ dofus: [], archis: [] })).toBeCloseTo(1);
    expect(bonusDegatsDofus({ dofus: ["dofus_pourpre"], archis: [] })).toBeCloseTo(1.15);
    expect(bonusDegatsDofus({ dofus: ["dofus_pourpre", "dofus_pourpre"], archis: [] })).toBeCloseTo(1.3);
  });
});

describe("boucle de combat (IA vs IA)", () => {
  it("un combat se termine et désigne un vainqueur", async () => {
    const equipe = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_1");
    const cs = [...equipe, ...ennemis];
    const gagne = await runCombat(cs, {
      controllers: { joueur: controllerIA, ennemi: controllerIA },
      rng: rngMax,
    });
    expect(typeof gagne).toBe("boolean");
    // un camp au moins est entièrement K.O.
    const joueursVivants = cs.filter((c) => c.camp === "joueur" && c.pvActuels > 0).length;
    const ennemisVivants = cs.filter((c) => c.camp === "ennemi" && c.pvActuels > 0).length;
    expect(joueursVivants === 0 || ennemisVivants === 0).toBe(true);
  });
});
