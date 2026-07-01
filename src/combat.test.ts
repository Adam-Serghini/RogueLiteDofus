// =============================================================================
//  combat.test.ts — Validation headless du moteur (avant toute UI).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  degatsCible, elementDeFrappe, ciblesValides, runCombat, controllerIA, lancerSort,
  type CombatCtx,
} from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis, bonusDegatsDofus, bonusEquipe } from "./run";

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

  it("bascule sur l'Eau quand la Chance domine", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, chance: 999 };
    expect(elementDeFrappe(iop)).toBe("eau"); // Chance domine
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
    iop.stats = { ...iop.stats, chance: 999 }; // frappe désormais en Eau
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.resistances = { eau: 0.5 }; // -50 % subis en Eau
    const sansRes = degatsCible(iop, SORTS.fleche_magique, { ...cible, resistances: {} }, { useMax: true, mult: 1, ctx: ctx() });
    const avecRes = degatsCible(iop, SORTS.fleche_magique, cible, { useMax: true, mult: 1, ctx: ctx() });
    expect(avecRes.dmg).toBeLessThan(sansRes.dmg);
  });
});

describe("degatsCible", () => {
  it("applique jet max + scaling + résistance + puissance offensive", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, force: 60, intelligence: 10 };
    const [cible] = fabriquerEnnemis("combat_1");
    cible.resistances = { terre: 0.15 }; // résiste +15 % à la Terre
    const r = degatsCible(iop, SORTS.fleche_magique, cible, { useMax: true, mult: 1, ctx: ctx() });
    // (13 + 60*0.35) * (1 - 0.15) * multOffensif(Int 10 = 1.05) = 34 * 0.85 * 1.05 = 30.3 → 30
    expect(r.dmg).toBe(30);
    expect(r.esquive).toBe(false);
    expect(r.crit).toBe(false);
  });

  it("le bonus Dofus augmente les dégâts du joueur", () => {
    const [iop] = fabriquerEquipe();
    const [bouftou] = fabriquerEnnemis("combat_1");
    const base = degatsCible(iop, SORTS.fleche_magique, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    const boost = degatsCible(iop, SORTS.fleche_magique, bouftou, {
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
    const r = degatsCible(iop, SORTS.fleche_magique, cra, { useMax: true, mult: 1, ctx: ctx({ rng: rngZero }) });
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
    const base = degatsCible(iop, SORTS.fleche_magique, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    const crit = degatsCible(iop, SORTS.fleche_magique, bouftou, { useMax: true, mult: 1, ctx: ctx({ rng: rngCrit }) });
    expect(crit.crit).toBe(true);
    expect(crit.dmg).toBeGreaterThan(base.dmg); // crit = bonus multiplicatif
  });
});

describe("règle de ligne (grille avant/arrière)", () => {
  it("un sort de ligne ne vise que la ligne avant (cases 0-3)", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2"); // cases 0, 1 (avant) + 4 (arrière)
    const cibles = ciblesValides(iop, SORTS.fleche_magique, [iop, ...ennemis]);
    expect(cibles.length).toBeGreaterThan(0);
    expect(cibles.every((c) => c.position < 4)).toBe(true);
  });

  it("si la ligne avant tombe, l'arrière devient ciblable", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2");
    ennemis.filter((e) => e.position < 4).forEach((e) => (e.pvActuels = 0)); // ligne avant K.O.
    const cibles = ciblesValides(iop, SORTS.fleche_magique, [iop, ...ennemis]);
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

describe("effets de Dofus (Dofawa / Argenté)", () => {
  const dofus = (id: string, n: number) => ({ dofus: Array(n).fill(id), archis: [] });
  it("Dofawa : +1 vitalité par copie, plafonné à 10", () => {
    expect(bonusEquipe(dofus("dofawa", 3)).vitaBonus).toBe(3);
    expect(bonusEquipe(dofus("dofawa", 12)).vitaBonus).toBe(10); // cap maxCopies
  });
  it("Dofus Argenté : +1 % résistance par copie, plafonné à 10", () => {
    expect(bonusEquipe(dofus("dofus_argente", 5)).resAllBonus).toBeCloseTo(0.05);
    expect(bonusEquipe(dofus("dofus_argente", 20)).resAllBonus).toBeCloseTo(0.1); // cap
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

describe("Iop — nouvelles mécaniques", () => {
  const rngK = (k: number): (() => number) => () => k;

  it("Tempête de lames frappe toute la rangée ciblée (zoneLigne)", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2"); // 0,1 (avant) + 4 (arrière)
    ennemis.forEach((e) => { e.pvActuels = 500; e.pvMax = 500; e.resistances = {}; });
    const avant = ennemis.filter((e) => e.position < 4);
    const arriere = ennemis.filter((e) => e.position >= 4);
    lancerSort(iop, SORTS.tempete_lames, avant[0].ref, [iop, ...ennemis], ctx());
    expect(avant.every((e) => e.pvActuels < 500)).toBe(true); // toute la ligne avant touchée
    expect(arriere.every((e) => e.pvActuels === 500)).toBe(true); // l'arrière épargné
  });

  it("cooldownTours rend le sort indisponible puis disponible", () => {
    const [iop] = fabriquerEquipe();
    iop.cooldowns = {};
    const [e] = fabriquerEnnemis("combat_1");
    e.pvActuels = 500; e.pvMax = 500;
    expect(ciblesValides(iop, SORTS.colere, [iop, e]).length).toBeGreaterThan(0);
    lancerSort(iop, SORTS.colere, e.ref, [iop, e], ctx()); // pose le cooldown (2t)
    expect(iop.cooldowns["colere"]).toBe(2);
    expect(ciblesValides(iop, SORTS.colere, [iop, e]).length).toBe(0); // indispo pendant le CD
    iop.cooldowns = {}; // recharge écoulée
    expect(ciblesValides(iop, SORTS.colere, [iop, e]).length).toBeGreaterThan(0);
  });

  it("Épée du Jugement applique un buff de résistances au lanceur (effetLanceur)", () => {
    const [iop] = fabriquerEquipe();
    iop.effets = [];
    const [e] = fabriquerEnnemis("combat_1");
    e.pvActuels = 500; e.pvMax = 500;
    lancerSort(iop, SORTS.epee_jugement, e.ref, [iop, e], ctx());
    expect(iop.effets.some((x) => x.stat === "resAll" && x.valeur === 0.05)).toBe(true);
  });

  it("Duel : la posture de contre fait riposter contre l'attaquant", () => {
    const [iop] = fabriquerEquipe(); // agilité 0 → pas d'esquive
    iop.effets = [{ stat: "contre", valeur: 0.2, toursRestants: 2 }];
    const [bouftou] = fabriquerEnnemis("combat_1");
    bouftou.stats = { ...bouftou.stats, agilite: 0 }; // pas d'esquive sur la riposte non plus
    const pvBouftouAvant = bouftou.pvActuels;
    // rng bas : pas d'esquive côté Iop, et 0.1 < 0.2 → la riposte se déclenche
    lancerSort(bouftou, SORTS.morsure, iop.ref, [iop, bouftou], ctx({ rng: rngK(0.1) }));
    expect(bouftou.pvActuels).toBeLessThan(pvBouftouAvant); // l'attaquant a encaissé la riposte
  });

  it("Fracas : le retrait de PA a 30 % de chance", () => {
    const [iop] = fabriquerEquipe();
    const mkEnnemi = (ref: string) => {
      const [e] = fabriquerEnnemis("combat_1");
      e.ref = ref; e.position = 0; e.pvActuels = 500; e.pvMax = 500;
      e.stats = { ...e.stats, agilite: 0 }; e.retraitPANextTurn = 0;
      return e;
    };
    const rate = mkEnnemi("rate");
    lancerSort(iop, SORTS.fracas, "rate", [iop, rate], ctx({ rng: rngK(0.99) })); // 0.99 ≥ 0.3
    expect(rate.retraitPANextTurn).toBe(0);
    const proc = mkEnnemi("proc");
    lancerSort(iop, SORTS.fracas, "proc", [iop, proc], ctx({ rng: rngK(0.1) })); // 0.1 < 0.3
    expect(proc.retraitPANextTurn).toBe(3);
  });
});

describe("Cra — nouvelles mécaniques", () => {
  const rngK = (k: number): (() => number) => () => k;
  const mkEnnemi = (ref: string, over: Record<string, unknown> = {}) => {
    const [e] = fabriquerEnnemis("combat_1");
    e.ref = ref; e.position = 0; e.pvActuels = 500; e.pvMax = 500;
    e.stats = { ...e.stats, agilite: 0 };
    return Object.assign(e, over);
  };

  it("Flèche magique : chance (Chance) de rembourser le coût en PA", () => {
    const [, cra] = fabriquerEquipe(); // chance 0 → base 5 %
    cra.paActuels = 0;
    const rate = mkEnnemi("rate");
    lancerSort(cra, SORTS.fleche_magique, "rate", [cra, rate], ctx({ rng: rngK(0.9) })); // 0.9 ≥ 0.05
    expect(cra.paActuels).toBe(0);
    cra.paActuels = 0;
    const proc = mkEnnemi("proc");
    lancerSort(cra, SORTS.fleche_magique, "proc", [cra, proc], ctx({ rng: rngK(0.01) })); // 0.01 < 0.05
    expect(cra.paActuels).toBe(3); // coût remboursé
  });

  it("Flèche intrusive : ignore le bouclier (dégâts directs aux PV)", () => {
    const [, cra] = fabriquerEquipe();
    const e = mkEnnemi("e", { bouclier: 100 });
    lancerSort(cra, SORTS.fleche_intrusive, "e", [cra, e], ctx());
    expect(e.pvActuels).toBeLessThan(500); // les PV baissent malgré le bouclier
    expect(e.bouclier).toBe(100); // bouclier intact (contourné)
  });

  it("Maîtrise de l'arc : buffe l'élément de frappe (+10) et le 2ᵉ (+5)", () => {
    const [, cra] = fabriquerEquipe();
    cra.stats = { ...cra.stats, agilite: 40, force: 20 }; // Air (1er), Terre (2e)
    cra.effets = [];
    lancerSort(cra, SORTS.maitrise_arc, cra.ref, [cra], ctx());
    expect(cra.effets.some((x) => x.stat === "agilite" && x.valeur === 10)).toBe(true);
    expect(cra.effets.some((x) => x.stat === "force" && x.valeur === 5)).toBe(true);
  });

  it("Tir Puissant : double la durée de l'effet de la prochaine flèche", () => {
    const [, cra] = fabriquerEquipe();
    cra.doubleEffetProchain = false;
    const e = mkEnnemi("e");
    lancerSort(cra, SORTS.tir_puissant, cra.ref, [cra, e], ctx()); // arme le doublement
    expect(cra.doubleEffetProchain).toBe(true);
    lancerSort(cra, SORTS.fleche_explosive, "e", [cra, e], ctx()); // brûlure 2t → 4t
    const brulure = e.effets.find((x) => x.stat === "poison");
    expect(brulure?.toursRestants).toBe(4);
    expect(cra.doubleEffetProchain).toBe(false); // flag consommé
  });

  it("Flèche corrosive : applique une vulnérabilité (+10 % dégâts subis)", () => {
    const [, cra] = fabriquerEquipe();
    const e = mkEnnemi("e");
    lancerSort(cra, SORTS.fleche_corrosive, "e", [cra, e], ctx());
    expect(e.effets.some((x) => x.stat === "reductionDegats" && x.valeur === -0.1)).toBe(true);
  });
});
