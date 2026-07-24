// =============================================================================
//  combat.test.ts — Validation headless du moteur (avant toute UI).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  degatsCible, elementDeFrappe, ciblesValides, runCombat, controllerIA, lancerSort,
  reinitialiserLancersTour, effetsDebutTour, poserBombe, poserTelefrag, critExcedent,
  poserPortail, multPortails, PORTAILS_MAX,
  invoquerLance, LANCE_DURABILITE,
  prochainActeur, purgerInvocationsOrphelines,
  type CombatCtx,
} from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis, bonusDegatsDofus, bonusEquipe, equipeCombattante, nouvelleRun } from "./run";
import type { Spell, Combatant } from "./types";

// rng=0.99 → jamais d'esquive, jet au max, jamais de crit (déterministe).
const rngMax: () => number = () => 0.99;
// rng=0 → force l'esquive si la cible a de l'agilité.
const rngZero: () => number = () => 0;

const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

// Sorts synthétiques : remplacent les anciens sorts du Cra (retirés lors du rework du kit)
// pour tester les mécaniques GÉNÉRIQUES du moteur, indépendamment de tout contenu réel.
// Mêmes valeurs de jet que les sorts d'origine → les nombres attendus ne changent pas.
const SYN_DEGATS: Spell = { // ex-Flèche magique (baseMin9/baseMax13/scaling0.35, ennemi_ligne)
  id: "syn_degats", nom: "Syn Dégâts", type: "degats", cible: "ennemi_ligne", coutPA: 3, baseMin: 9, baseMax: 13, scaling: 0.35,
};
const SYN_IGNORE_RES: Spell = { // ex-Flèche intrusive (baseMin5/baseMax7/scaling0.2, ennemi_tous, ignoreResistances+ignoreBouclier)
  id: "syn_ignore_res", nom: "Syn Ignore Résistances", type: "degats", cible: "ennemi_tous", coutPA: 3, baseMin: 5, baseMax: 7, scaling: 0.2,
  ignoreResistances: true, ignoreBouclier: true,
};

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
    iop.elementChoisi = undefined; // teste le fallback (pas de choix explicite)
    iop.stats = { ...iop.stats, chance: 999 };
    expect(elementDeFrappe(iop)).toBe("eau"); // Chance domine
  });

  it("le choix explicite d'élément prime ; sinon la plus haute carac", () => {
    const [iop] = fabriquerEquipe();
    iop.elementChoisi = undefined;
    iop.stats = { ...iop.stats, force: 60, agilite: 20 }; // Terre (plus haute)
    expect(elementDeFrappe(iop)).toBe("terre"); // pas de choix → plus haute carac
    iop.elementChoisi = "air";
    expect(elementDeFrappe(iop)).toBe("air"); // choix explicite prioritaire
    iop.elementChoisi = "feu"; // choix explicite, même si Feu n'est pas dominant
    expect(elementDeFrappe(iop)).toBe("feu");
  });

  it("applique la résistance de l'élément de frappe basculé", () => {
    const [iop] = fabriquerEquipe();
    iop.elementChoisi = undefined;
    iop.stats = { ...iop.stats, chance: 999 }; // frappe désormais en Eau
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.resistances = { eau: 0.5 }; // -50 % subis en Eau
    const sansRes = degatsCible(iop, SYN_DEGATS, { ...cible, resistances: {} }, { useMax: true, mult: 1, ctx: ctx() });
    const avecRes = degatsCible(iop, SYN_DEGATS, cible, { useMax: true, mult: 1, ctx: ctx() });
    expect(avecRes.dmg).toBeLessThan(sansRes.dmg);
  });
});

describe("degatsCible", () => {
  it("applique jet max + scaling + résistance + puissance offensive", () => {
    const [iop] = fabriquerEquipe();
    iop.stats = { ...iop.stats, force: 60, intelligence: 10 };
    const [cible] = fabriquerEnnemis("combat_1");
    cible.resistances = { terre: 0.15 }; // résiste +15 % à la Terre
    const r = degatsCible(iop, SYN_DEGATS, cible, { useMax: true, mult: 1, ctx: ctx() });
    // (13 + 60*0.35) * (1 - 0.15) * multOffensif(Int 10 = 1.05) = 34 * 0.85 * 1.05 = 30.3 → 30
    expect(r.dmg).toBe(30);
    expect(r.esquive).toBe(false);
    expect(r.crit).toBe(false);
  });

  it("le bonus Dofus augmente les dégâts du joueur", () => {
    const [iop] = fabriquerEquipe();
    const [bouftou] = fabriquerEnnemis("combat_1");
    const base = degatsCible(iop, SYN_DEGATS, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    const boost = degatsCible(iop, SYN_DEGATS, bouftou, {
      useMax: true, mult: 1, ctx: ctx({ playerDamageBonus: 1.3 }),
    });
    expect(boost.dmg).toBeGreaterThan(base.dmg);
  });

  it("ignoreResistances ignore la ligne de résistance", () => {
    const [, cra] = fabriquerEquipe();
    cra.stats = { ...cra.stats, agilite: 55, intelligence: 20 };
    const [bouftou] = fabriquerEnnemis("combat_1");
    const r = degatsCible(cra, SYN_IGNORE_RES, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    // (7 + 55*0.2) * multOffensif(Int 20 = 1.10) = 18 * 1.10 = 19.8 → 20, aucune résistance
    expect(r.dmg).toBe(20);
  });

  it("esquive (Agilité) annule les dégâts", () => {
    const [iop, cra] = fabriquerEquipe();
    cra.stats = { ...cra.stats, agilite: 55 }; // esquive via Agilité
    const r = degatsCible(iop, SYN_DEGATS, cra, { useMax: true, mult: 1, ctx: ctx({ rng: rngZero }) });
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
    const base = degatsCible(iop, SYN_DEGATS, bouftou, { useMax: true, mult: 1, ctx: ctx() });
    const crit = degatsCible(iop, SYN_DEGATS, bouftou, { useMax: true, mult: 1, ctx: ctx({ rng: rngCrit }) });
    expect(crit.crit).toBe(true);
    expect(crit.dmg).toBeGreaterThan(base.dmg); // crit = bonus multiplicatif
  });
});

describe("règle de ligne (grille avant/arrière)", () => {
  it("un sort de ligne ne vise que la ligne avant (cases 0-3)", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2"); // cases 0, 1 (avant) + 4 (arrière)
    const cibles = ciblesValides(iop, SYN_DEGATS, [iop, ...ennemis]);
    expect(cibles.length).toBeGreaterThan(0);
    expect(cibles.every((c) => c.position < 4)).toBe(true);
  });

  it("si la ligne avant tombe, l'arrière devient ciblable", () => {
    const [iop] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2");
    ennemis.filter((e) => e.position < 4).forEach((e) => (e.pvActuels = 0)); // ligne avant K.O.
    const cibles = ciblesValides(iop, SYN_DEGATS, [iop, ...ennemis]);
    expect(cibles.length).toBeGreaterThan(0);
    expect(cibles.every((c) => c.pvActuels > 0)).toBe(true); // survivants (arrière) exposés
  });

  it("ennemi_tous outrepasse la ligne", () => {
    const [, cra] = fabriquerEquipe();
    const ennemis = fabriquerEnnemis("combat_2");
    expect(ciblesValides(cra, SYN_IGNORE_RES, [cra, ...ennemis]).length).toBe(ennemis.length);
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
    expect(bonusDegatsDofus({ dofus: [], archis: [], runs: 0, victoires: 0 })).toBeCloseTo(1);
    expect(bonusDegatsDofus({ dofus: ["dofus_pourpre"], archis: [], runs: 0, victoires: 0 })).toBeCloseTo(1.15);
    expect(bonusDegatsDofus({ dofus: ["dofus_pourpre", "dofus_pourpre"], archis: [], runs: 0, victoires: 0 })).toBeCloseTo(1.3);
  });
});

describe("effets de Dofus (Dofawa / Argenté)", () => {
  const dofus = (id: string, n: number) => ({ dofus: Array(n).fill(id), archis: [], runs: 0, victoires: 0 });
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

  it("Fracas : le retrait de PA (30 % de chance) est IMMÉDIAT et visible", () => {
    const [iop] = fabriquerEquipe();
    const mkEnnemi = (ref: string) => {
      const [e] = fabriquerEnnemis("combat_1");
      e.ref = ref; e.position = 0; e.pvActuels = 500; e.pvMax = 500;
      e.stats = { ...e.stats, agilite: 0 };
      return e;
    };
    const rate = mkEnnemi("rate");
    const paAvant = rate.paActuels;
    lancerSort(iop, SORTS.fracas, "rate", [iop, rate], ctx({ rng: rngK(0.99) })); // 0.99 ≥ 0.3
    expect(rate.paActuels).toBe(paAvant); // pas de proc
    const proc = mkEnnemi("proc");
    lancerSort(iop, SORTS.fracas, "proc", [iop, proc], ctx({ rng: rngK(0.1) })); // 0.1 < 0.3
    expect(proc.paActuels).toBe(Math.max(0, paAvant - 3)); // PA retirés sur-le-champ
  });
});

// Le rework du Cra a retiré les 7 sorts qui portaient historiquement ces mécaniques
// génériques du moteur (rembPA, ignoreBouclier, poison, vulnérabilité, rebond). Elles
// restent utilisées par d'autres classes/contenus (poison, reductionDegats, rebond) ou
// sont conservées comme socle réutilisable (rembPA) : on les teste ici via des sorts
// synthétiques plutôt que via un sort réel.
describe("socle — mécaniques génériques (ex-fixtures Cra)", () => {
  const rngK = (k: number): (() => number) => () => k;
  const mkEnnemi = (ref: string, over: Record<string, unknown> = {}) => {
    const [e] = fabriquerEnnemis("combat_1");
    e.ref = ref; e.position = 0; e.pvActuels = 500; e.pvMax = 500;
    e.stats = { ...e.stats, agilite: 0 };
    return Object.assign(e, over);
  };

  it("rembPA : chance (Chance) de rembourser le coût en PA — mécanique sans sort réel, candidate à purge", () => {
    const synRembPA: Spell = { id: "syn_remb_pa", nom: "Syn RembPA", type: "degats", cible: "ennemi_ligne", coutPA: 3, baseMin: 9, baseMax: 13, scaling: 0.35, rembPA: true };
    const [, cra] = fabriquerEquipe(); // chance 0 → base 5 %
    cra.paActuels = 0;
    const rate = mkEnnemi("rate");
    lancerSort(cra, synRembPA, "rate", [cra, rate], ctx({ rng: rngK(0.9) })); // 0.9 ≥ 0.05
    expect(cra.paActuels).toBe(0);
    cra.paActuels = 0;
    const proc = mkEnnemi("proc");
    lancerSort(cra, synRembPA, "proc", [cra, proc], ctx({ rng: rngK(0.01) })); // 0.01 < 0.05
    expect(cra.paActuels).toBe(3); // coût remboursé
  });

  it("maitriseArc : buff des 2 stats élémentaires les plus fortes du lanceur — mécanique sans sort réel, candidate à purge", () => {
    const synMaitrise: Spell = {
      id: "syn_maitrise_arc", nom: "Syn Maîtrise", type: "buff", cible: "soi", coutPA: 2,
      baseMin: 0, baseMax: 0, scaling: 0,
      maitriseArc: { principal: 20, secondaire: 10, duree: 3 },
    };
    const [, cra] = fabriquerEquipe();
    cra.stats = { ...cra.stats, force: 50, intelligence: 30, agilite: 10, chance: 0 }; // terre > feu > air > eau
    lancerSort(cra, synMaitrise, cra.ref, [cra], ctx());
    expect(cra.effets.some((e) => e.stat === "force" && e.valeur === 20 && e.toursRestants === 3)).toBe(true);
    expect(cra.effets.some((e) => e.stat === "intelligence" && e.valeur === 10 && e.toursRestants === 3)).toBe(true);
  });

  it("doubleEffetProchain : double la durée de l'effet posé par la PROCHAINE flèche — mécanique sans sort réel, candidate à purge", () => {
    const synPrepare: Spell = {
      id: "syn_double_effet", nom: "Syn Tir Puissant", type: "buff", cible: "soi", coutPA: 1,
      baseMin: 0, baseMax: 0, scaling: 0, doubleEffetProchain: true,
    };
    const synTir: Spell = {
      id: "syn_tir_marque", nom: "Syn Tir", type: "degats", cible: "ennemi_ligne", coutPA: 3,
      baseMin: 5, baseMax: 5, scaling: 0, effet: { stat: "tetanise", valeur: 1, duree: 1 },
    };
    const [, cra] = fabriquerEquipe();
    const e = mkEnnemi("cible_double");
    lancerSort(cra, synPrepare, cra.ref, [cra, e], ctx());
    expect(cra.doubleEffetProchain).toBe(true);
    lancerSort(cra, synTir, "cible_double", [cra, e], ctx());
    expect(e.effets.some((x) => x.stat === "tetanise" && x.toursRestants === 2)).toBe(true); // durée doublée (1 → 2)
    expect(cra.doubleEffetProchain).toBe(false); // consommé (one-shot)
  });

  it("ignoreBouclier : dégâts directs aux PV, bouclier contourné", () => {
    const [, cra] = fabriquerEquipe();
    const e = mkEnnemi("e", { bouclier: 100 });
    lancerSort(cra, SYN_IGNORE_RES, "e", [cra, e], ctx());
    expect(e.pvActuels).toBeLessThan(500); // les PV baissent malgré le bouclier
    expect(e.bouclier).toBe(100); // bouclier intact (contourné)
  });

  it("poison (DoT) : le sort applique une brûlure sur la cible", () => {
    const synPoison: Spell = { id: "syn_poison", nom: "Syn Poison", type: "degats", cible: "ennemi_ligne", coutPA: 5, baseMin: 12, baseMax: 16, scaling: 0.4, poison: { degats: 6, duree: 2 } };
    const [, cra] = fabriquerEquipe();
    const e = mkEnnemi("e");
    lancerSort(cra, synPoison, "e", [cra, e], ctx());
    const brulure = e.effets.find((x) => x.stat === "poison");
    expect(brulure).toMatchObject({ valeur: 6, toursRestants: 2 });
  });

  it("effet reductionDegats négatif : applique une vulnérabilité (+10 % dégâts subis)", () => {
    const synVulnerabilite: Spell = { id: "syn_vulnerabilite", nom: "Syn Vulnérabilité", type: "degats", cible: "ennemi_ligne", coutPA: 4, baseMin: 6, baseMax: 9, scaling: 0.25, effet: { duree: 2, stat: "reductionDegats", valeur: -0.1 } };
    const [, cra] = fabriquerEquipe();
    const e = mkEnnemi("e");
    lancerSort(cra, synVulnerabilite, "e", [cra, e], ctx());
    expect(e.effets.some((x) => x.stat === "reductionDegats" && x.valeur === -0.1)).toBe(true);
  });

  it("rebond : touche la cible primaire puis rebondit, +X % de dégâts par saut", () => {
    const synRebond: Spell = { id: "syn_rebond", nom: "Syn Rebond", type: "degats", cible: "ennemi_ligne", coutPA: 5, baseMin: 9, baseMax: 13, scaling: 0.4, rebond: { sauts: 2, bonusParSaut: 0.2 } };
    const [, cra] = fabriquerEquipe();
    const e0 = mkEnnemi("e0"); e0.position = 0;
    const e1 = mkEnnemi("e1"); e1.position = 1;
    const e2 = mkEnnemi("e2"); e2.position = 2;
    lancerSort(cra, synRebond, "e0", [cra, e0, e1, e2], ctx());
    const d0 = 500 - e0.pvActuels;
    const d1 = 500 - e1.pvActuels;
    const d2 = 500 - e2.pvActuels;
    expect(d0).toBeGreaterThan(0);
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(0);
    // +20 % de dégâts par saut : le 2e ennemi touché prend plus que le 1er, le 3e plus que le 2e
    expect(d1).toBeGreaterThan(d0);
    expect(d2).toBeGreaterThan(d1);
  });
});

describe("Tir courbe (monstres tireurs)", () => {
  it("touche la ligne arrière même si la ligne avant est vivante", () => {
    const [iop, cra] = fabriquerEquipe();
    iop.position = 0; // ligne avant
    cra.position = 4; // ligne arrière
    const tireur = fabriquerEnnemis("kan_2").find((e) => e.sorts.includes("tir_courbe"))!;
    const cibles = ciblesValides(tireur, SORTS.tir_courbe, [iop, cra, tireur]);
    expect(cibles.map((c) => c.ref)).toContain(cra.ref); // l'arrière est exposé
    // …mais la provocation reste un contre : le taunt force la cible
    iop.provoque = true;
    const provoquees = ciblesValides(tireur, SORTS.tir_courbe, [iop, cra, tireur]);
    expect(provoquees.map((c) => c.ref)).toEqual([iop.ref]);
  });
});

describe("ordre des tours alterné (allié/ennemi)", () => {
  /** Clone minimal d'un combattant réel, camp/init/ref contrôlés. */
  const combattant = (ref: string, camp: "joueur" | "ennemi", initiative: number, extra: Partial<Combatant> = {}): Combatant => ({
    ...fabriquerEnnemis("combat_1")[0], ref, camp, initiative, effets: [], pvActuels: 100, pvMax: 100, ...extra,
  });
  /** Déroule un round complet via prochainActeur et renvoie la séquence des refs. */
  const round = (cs: Combatant[]): string[] => {
    const aJoue = new Set<string>();
    const ordre: string[] = [];
    for (;;) {
      const a = prochainActeur(cs, aJoue);
      if (!a) break;
      aJoue.add(a.ref);
      ordre.push(a.ref);
    }
    return ordre;
  };

  it("4v2 : A E A E A A (surplus allié en fin de round)", () => {
    const cs = [
      combattant("a1", "joueur", 40), combattant("a2", "joueur", 38),
      combattant("a3", "joueur", 36), combattant("a4", "joueur", 34),
      combattant("e1", "ennemi", 35), combattant("e2", "ennemi", 25),
    ];
    expect(round(cs)).toEqual(["a1", "e1", "a2", "e2", "a3", "a4"]);
  });

  it("2v5 : A E A E E E E — et l'ennemi ouvre s'il a la meilleure init", () => {
    const cs = [
      combattant("a1", "joueur", 40), combattant("a2", "joueur", 38),
      combattant("e1", "ennemi", 35), combattant("e2", "ennemi", 25),
      combattant("e3", "ennemi", 20), combattant("e4", "ennemi", 15), combattant("e5", "ennemi", 10),
    ];
    expect(round(cs)).toEqual(["a1", "e1", "a2", "e2", "e3", "e4", "e5"]);
    // meilleure init ennemie → l'ennemi ouvre
    const cs2 = [combattant("a1", "joueur", 20), combattant("e1", "ennemi", 50), combattant("e2", "ennemi", 10)];
    expect(round(cs2)).toEqual(["e1", "a1", "e2"]);
  });

  it("la séquence est FIGÉE : un mort libère son créneau sans ré-entrelacement", () => {
    const a1 = combattant("a1", "joueur", 40);
    const a2 = combattant("a2", "joueur", 38);
    const e1 = combattant("e1", "ennemi", 35);
    const e2 = combattant("e2", "ennemi", 25);
    const cs = [a1, a2, e1, e2];
    expect(round(cs)).toEqual(["a1", "e1", "a2", "e2"]);
    e1.pvActuels = 0; // le premier ennemi meurt
    expect(round(cs)).toEqual(["a1", "a2", "e2"]); // A A E — PAS de ré-alternance
    e1.pvActuels = 50; // ressuscité : il retrouve SON créneau d'origine
    expect(round(cs)).toEqual(["a1", "e1", "a2", "e2"]);
  });

  it("un debuff d'initiative en cours de combat ne change PLUS l'ordre (séquence figée au départ)", () => {
    const a1 = combattant("a1", "joueur", 40);
    const e1 = combattant("e1", "ennemi", 35);
    const cs = [a1, e1];
    expect(round(cs)).toEqual(["a1", "e1"]);
    e1.effets.push({ stat: "initiative", valeur: 99, toursRestants: 9 }); // même un ÉNORME buff
    expect(round(cs)).toEqual(["a1", "e1"]); // l'ordre reste celui du début de combat
  });

  it("un invoqué joue TOUJOURS juste après son invocateur (hors alternance), à chaque round", () => {
    const cs = [
      combattant("a1", "joueur", 50), combattant("a2", "joueur", 10),
      combattant("boss", "ennemi", 40),
      combattant("invoc", "ennemi", 99, { invoquePar: "boss" }), // init 99 mais ATTACHÉ au boss
    ];
    expect(round(cs)).toEqual(["a1", "boss", "invoc", "a2"]);
    expect(round(cs)).toEqual(["a1", "boss", "invoc", "a2"]); // round suivant : pareil (attachement permanent)
  });

  it("les invocations-obstacles (Poupée, Lance) n'occupent aucun créneau", () => {
    const cs = [
      combattant("a1", "joueur", 30),
      combattant("poupee", "joueur", 99, { estInvocation: true }),
      combattant("e1", "ennemi", 20),
    ];
    expect(round(cs)).toEqual(["a1", "e1"]);
  });

  it("la mort de l'invocateur tue ses invocations (cascade), la lance sans bouclier de bris", () => {
    const boss = combattant("boss", "ennemi", 40);
    const invoc = combattant("invoc", "ennemi", 20, { invoquePar: "boss" });
    const forgelance = combattant("fl", "joueur", 30);
    const lance = combattant("lance_fl", "ennemi", 0, { estLance: true, lanceurRef: "fl", pvActuels: 2, pvMax: 2, estInvocation: true });
    const cs = [forgelance, boss, invoc, lance];
    boss.pvActuels = 0;
    forgelance.pvActuels = 0;
    const bouclierAvant = forgelance.bouclier;
    purgerInvocationsOrphelines(cs, ctx());
    expect(invoc.pvActuels).toBe(0); // meurt avec son invocateur
    expect(lance.pvActuels).toBe(0); // la lance se brise avec son porteur
    expect(forgelance.bouclier).toBe(bouclierAvant); // pas de bouclier de bris (porteur mort)
  });
});

describe("limites de lancer par tour", () => {
  const sortLimite: Spell = { id: "syn_limite", nom: "Syn", type: "degats", cible: "ennemi_ligne",
    coutPA: 1, baseMin: 1, baseMax: 1, scaling: 0, maxParTour: 2, maxParCibleParTour: 1 };
  it("maxParTour bloque le 3e lancer, maxParCibleParTour exclut la cible déjà visée", () => {
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    const ennemis = fabriquerEnnemis("combat_1").map((e) => { e.pvActuels = 999; e.pvMax = 999; e.stats = { ...e.stats, agilite: 0 }; return e; });
    const cs = [iop, ...ennemis];
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    iop.paActuels = 9;
    expect(ciblesValides(iop, sortLimite, cs).length).toBeGreaterThan(0);
    lancerSort(iop, sortLimite, ennemis[0].ref, cs, ctx);
    // la cible déjà visée est exclue (1/cible), les autres restent
    expect(ciblesValides(iop, sortLimite, cs).map((c) => c.ref)).not.toContain(ennemis[0].ref);
    lancerSort(iop, sortLimite, ennemis[1].ref, cs, ctx);
    expect(ciblesValides(iop, sortLimite, cs)).toEqual([]); // 2/tour atteint
  });
  it("le compteur se remet à zéro au début du tour du lanceur", () => {
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    iop.lancersCeTour = { syn_limite: 2 };
    // simuler le passage par le début de tour (même mécanisme que la boucle runCombat)
    reinitialiserLancersTour(iop);
    expect(ciblesValides(iop, sortLimite, [iop, ...fabriquerEnnemis("combat_1")]).length).toBeGreaterThan(0);
  });
});

describe("socle nouvelles classes — déplacement / nullification / PA / ligne de vue", () => {
  const ctx = () => ({ rng: () => 0.99, log: () => {}, playerDamageBonus: 1 });
  it("deplaceCible 'toggle' envoie l'ennemi sur la rangée opposée (même colonne si libre)", () => {
    const syn: Spell = { id: "syn_dep", nom: "S", type: "degats", cible: "ennemi_tous", coutPA: 1, baseMin: 0, baseMax: 0, scaling: 0, deplaceCible: "toggle" };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    const pack = fabriquerEnnemis("combat_1");
    const devant = pack.find((e) => e.position < 4)!;
    const colonne = devant.position;
    lancerSort(iop, syn, devant.ref, [iop, ...pack], ctx());
    expect(devant.position).toBe(colonne + 4);
  });
  it("nullifieProchain annule UN coup direct mais pas un poison", () => {
    const buff: Spell = { id: "syn_null", nom: "N", type: "buff", cible: "soi", coutPA: 1, baseMin: 0, baseMax: 0, scaling: 0, nullifieProchain: true };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    iop.pvActuels = 500; iop.pvMax = 500; iop.stats = { ...iop.stats, agilite: 0 };
    const ennemi = fabriquerEnnemis("combat_1")[0];
    lancerSort(iop, buff, iop.ref, [iop, ennemi], ctx());
    lancerSort(ennemi, SORTS.morsure, iop.ref, [iop, ennemi], ctx());
    expect(iop.pvActuels).toBe(500); // coup annulé
    lancerSort(ennemi, SORTS.morsure, iop.ref, [iop, ennemi], ctx());
    expect(iop.pvActuels).toBeLessThan(500); // flag consommé
  });
  it("paParTourLigne crédite +2 PA au début des tours de la rangée, pendant la durée", () => {
    const cadranSyn: Spell = { id: "syn_cadran", nom: "C", type: "buff", cible: "allie", coutPA: 1, baseMin: 0, baseMax: 0, scaling: 0, paParTourLigne: { valeur: 2, duree: 2 } };
    const equipe = equipeCombattante(nouvelleRun(["iop", "cra"]));
    const [iop] = equipe; // les persos de départ partagent-ils une rangée ? forcer : iop.position = 0 ; cra.position = 1
    equipe[1].position = 1;
    lancerSort(iop, cadranSyn, equipe[1].ref, equipe, ctx());
    const paAvant = iop.paActuels;
    effetsDebutTour(iop, equipe, ctx() as never);
    expect(iop.paActuels).toBe(paAvant + 2);
  });
  it("l'effet ignoreLigne ouvre la rangée arrière aux sorts ennemi_ligne", () => {
    const acuiteSyn: Spell = { id: "syn_acuite", nom: "A", type: "buff", cible: "soi", coutPA: 1, baseMin: 0, baseMax: 0, scaling: 0, effet: { duree: 2, stat: "ignoreLigne", valeur: 1 } };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    const pack = fabriquerEnnemis("gob_elite"); // pack avec rangée arrière
    const arriere = pack.filter((e) => e.position >= 4);
    expect(arriere.length).toBeGreaterThan(0);
    expect(ciblesValides(iop, SORTS.morsure, [iop, ...pack]).some((c) => c.position >= 4)).toBe(false);
    lancerSort(iop, acuiteSyn, iop.ref, [iop, ...pack], ctx());
    expect(ciblesValides(iop, SORTS.morsure, [iop, ...pack]).some((c) => c.position >= 4)).toBe(true);
  });
  it("retraitPAChance: 1 retire les PA à coup sûr", () => {
    const sablierSyn: Spell = { id: "syn_sablier", nom: "S", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 1, baseMax: 1, scaling: 0, retraitPA: 2, retraitPAChance: 1 };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    const pa = ennemi.paActuels;
    lancerSort(iop, sablierSyn, ennemi.ref, [iop, ennemi], { rng: () => 0.9, log: () => {}, playerDamageBonus: 1 }); // 0.9 raterait un 30 %
    expect(ennemi.paActuels).toBe(pa - 2);
  });
});

describe("socle — compteurs et modificateurs de dégâts", () => {
  it("poserBombe cape à 5, poserTelefrag cape à 4", () => {
    const e = fabriquerEnnemis("combat_1")[0];
    for (let i = 0; i < 7; i++) poserBombe(e);
    expect(e.bombes).toBe(5);
    for (let i = 0; i < 7; i++) poserTelefrag(e, [e], ctx());
    expect(e.telefrags).toBe(4);
  });
  it("poserBombe et poserTelefrag journalisent via ctx (sans préfixe ▶)", () => {
    const e = fabriquerEnnemis("combat_1")[0];
    const lignes: string[] = [];
    const c = ctx({ log: (m: string) => lignes.push(m) });
    poserBombe(e, c);
    poserTelefrag(e, [e], c);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toBe(`💣 Une bombe colle à ${e.nom} (1/5).`);
    expect(lignes[1]).toBe(`⏳ Téléfrag sur ${e.nom} (1/4).`);
    for (const l of lignes) expect(l.startsWith("▶")).toBe(false);
  });
  it("poserBombe sans ctx ne journalise rien et ne casse pas", () => {
    const e = fabriquerEnnemis("combat_1")[0];
    expect(() => poserBombe(e)).not.toThrow();
    expect(e.bombes).toBe(1);
  });
  it("bonusParPADispo utilise les PA d'AVANT le paiement", () => {
    const syn: Spell = { id: "syn_pa", nom: "P", type: "degats", cible: "ennemi_ligne", coutPA: 4, baseMin: 10, baseMax: 10, scaling: 0, bonusParPADispo: 0.08 };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    iop.stats = { ...iop.stats, force: 0, agilite: 0 };
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.pvActuels = 500; cible.pvMax = 500; cible.resistances = {}; cible.stats = { ...cible.stats, agilite: 0 };
    // simule le débit de PA fait par la boucle de runCombat AVANT d'appeler lancerSort :
    // « 6 PA dispo avant paiement » ⇒ paActuels vaut déjà 6 - 4 = 2 au moment de l'appel.
    iop.paActuels = 6;
    iop.paActuels -= syn.coutPA;
    lancerSort(iop, syn, cible.ref, [iop, cible], ctx());
    expect(500 - cible.pvActuels).toBe(Math.round(10 * (1 + 0.08 * 6))); // 6 PA dispo, pas 2
  });
  it("bonusParTelefrag multiplie par les téléfrags de la cible", () => {
    const syn: Spell = { id: "syn_ray", nom: "R", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 10, baseMax: 10, scaling: 0, bonusParTelefrag: 0.5 };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    iop.stats = { ...iop.stats, force: 0, agilite: 0 };
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.pvActuels = 500; cible.pvMax = 500; cible.resistances = {}; cible.stats = { ...cible.stats, agilite: 0 };
    cible.telefrags = 4;
    lancerSort(iop, syn, cible.ref, [iop, cible], ctx());
    expect(500 - cible.pvActuels).toBe(Math.round(10 * 3)); // ×(1 + 0.5×4)
  });
  it("le crit au-delà du cap 50 % se convertit en dégâts finaux", () => {
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    // force 0 + crit 65 → chanceCrit = 0.5 (cap), excédent 0.15
    iop.stats = { ...iop.stats, force: 0, agilite: 0, crit: 65 };
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.pvActuels = 500; cible.pvMax = 500; cible.resistances = {}; cible.stats = { ...cible.stats, agilite: 0 };
    const syn: Spell = { id: "syn_crit", nom: "C", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 10, baseMax: 10, scaling: 0 };
    lancerSort(iop, syn, cible.ref, [iop, cible], { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 }); // 0.99 > 0.5 : pas de crit
    expect(500 - cible.pvActuels).toBe(Math.round(10 * 1.15));
  });
  it("la Force seule ne déborde jamais du cap de crit (pas d'excédent)", () => {
    // force 999 + crit 0 → contribution Force plafonnée à 0.5 DANS l'excédent → excédent 0
    expect(critExcedent({ force: 999, intelligence: 0, agilite: 0, vitalite: 0 })).toBe(0);
    // seul le crit PLAT déborde : force 999 + crit 20 → excédent 0.20
    expect(critExcedent({ force: 999, intelligence: 0, agilite: 0, vitalite: 0, crit: 20 })).toBeCloseTo(0.2);
  });
  it("bonusParAllieLigne (signature Grunob) ignore la Lance dans le compte d'alliés de rangée", () => {
    const syn: Spell = { id: "syn_grunob", nom: "G", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 10, baseMax: 10, scaling: 0 };
    const grunob = fabriquerEnnemis("combat_1")[0];
    grunob.bonusParAllieLigne = 0.15;
    grunob.position = 0;
    grunob.resistances = {};
    grunob.stats = { ...grunob.stats, agilite: 0, force: 0 };
    const cible = equipeCombattante(nouvelleRun(["iop"]))[0];
    cible.resistances = {}; cible.stats = { ...cible.stats, agilite: 0 };
    const allieReel = { ...grunob, ref: "ally2", position: 1 }; // même rangée : compte normalement

    const sansLance = (() => {
      const c = { ...cible, pvActuels: 500, pvMax: 500 };
      lancerSort(grunob, syn, c.ref, [grunob, allieReel, c], ctx());
      return 500 - c.pvActuels;
    })();
    const lance: Combatant = { ...grunob, ref: "lance_x", estLance: true, position: 2 }; // même rangée
    const avecLance = (() => {
      const c = { ...cible, pvActuels: 500, pvMax: 500 };
      lancerSort(grunob, syn, c.ref, [grunob, allieReel, lance, c], ctx());
      return 500 - c.pvActuels;
    })();
    expect(avecLance).toBe(sansLance); // la Lance en plus ne doit rien changer
  });
});

describe("portails (Éliotrope) et Conjuration — moteur", () => {
  const ctx = () => ({ rng: () => 0.99, log: () => {}, playerDamageBonus: 1 });
  it("poserPortail cape à 4 ; multPortails : 2 %/portail au porteur, 1 %/portail à sa rangée", () => {
    const [iop, cra] = equipeCombattante(nouvelleRun(["iop", "cra"]));
    iop.position = 0; cra.position = 1; // même rangée
    for (let i = 0; i < 6; i++) poserPortail(iop, ctx() as CombatCtx);
    expect(iop.portails).toBe(PORTAILS_MAX);
    expect(multPortails(iop, [iop, cra])).toBeCloseTo(1.08); // porteur : 2 % × 4
    expect(multPortails(cra, [iop, cra])).toBeCloseTo(1.04); // allié même rangée : 1 % × 4
    cra.position = 4; // rangée différente → pas d'aura
    expect(multPortails(cra, [iop, cra])).toBeCloseTo(1);
    iop.pvActuels = 0; cra.position = 1; // porteur mort → plus d'aura pour l'allié
    expect(multPortails(cra, [iop, cra])).toBeCloseTo(1);
  });
  it("l'aura de portails multiplie les dégâts du porteur", () => {
    const syn: Spell = { id: "syn_p", nom: "P", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 100, baseMax: 100, scaling: 0 };
    const [iop] = equipeCombattante(nouvelleRun(["iop"]));
    iop.stats = { ...iop.stats, force: 0, agilite: 0 };
    const monte = () => { const c = fabriquerEnnemis("combat_1")[0]; c.pvActuels = 500; c.pvMax = 500; c.resistances = {}; c.stats = { ...c.stats, agilite: 0 }; return c; };
    const sans = monte();
    lancerSort(iop, syn, sans.ref, [iop, sans], ctx() as CombatCtx);
    const base = 500 - sans.pvActuels;
    for (let i = 0; i < 4; i++) poserPortail(iop, ctx() as CombatCtx);
    const avec = monte();
    lancerSort(iop, syn, avec.ref, [iop, avec], ctx() as CombatCtx);
    expect(500 - avec.pvActuels).toBe(Math.round(base * 1.08));
  });
  it("Conjuration : +pct seulement pour le marqueur et sa rangée, s'éteint au bout de N tours du marqueur", () => {
    const syn: Spell = { id: "syn_c", nom: "C", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 100, baseMax: 100, scaling: 0 };
    const [iop, cra] = equipeCombattante(nouvelleRun(["iop", "cra"]));
    iop.position = 0; cra.position = 4; // rangées différentes
    for (const c of [iop, cra]) c.stats = { ...c.stats, force: 0, agilite: 0 };
    const monte = () => { const c = fabriquerEnnemis("combat_1")[0]; c.pvActuels = 500; c.pvMax = 500; c.resistances = {}; c.stats = { ...c.stats, agilite: 0 }; return c; };
    const nue = monte();
    lancerSort(iop, syn, nue.ref, [iop, cra, nue], ctx() as CombatCtx);
    const base = 500 - nue.pvActuels;
    const marquee = monte();
    marquee.conjuration = { pct: 0.1, lanceurRef: iop.ref, tours: 2 };
    lancerSort(iop, syn, marquee.ref, [iop, cra, marquee], ctx() as CombatCtx); // marqueur → +10 %
    expect(500 - marquee.pvActuels).toBe(Math.round(base * 1.1));
    const marquee2 = monte();
    marquee2.conjuration = { pct: 0.1, lanceurRef: iop.ref, tours: 2 };
    lancerSort(cra, syn, marquee2.ref, [iop, cra, marquee2], ctx() as CombatCtx); // AUTRE rangée → pas de bonus
    expect(500 - marquee2.pvActuels).toBe(base);
  });
});

describe("la Lance (Forgelance) et la redirection — moteur", () => {
  const ctx = () => ({ rng: () => 0.99, log: () => {}, playerDamageBonus: 1 });
  const monte = () => {
    const [iop, cra] = equipeCombattante(nouvelleRun(["iop", "cra"]));
    iop.position = 0; cra.position = 4;
    const pack = fabriquerEnnemis("gob_elite").map((e) => {
      e.pvActuels = 500; e.pvMax = 500; e.stats = { ...e.stats, agilite: 0 };
      return e;
    });
    return { iop, cra, pack, cs: [iop, cra, ...pack] };
  };

  it("invoquerLance : rangée de la cible, une seule à la fois, durabilité 2 puis bouclier au propriétaire", () => {
    const { iop, pack, cs } = monte();
    const devant = pack.find((e) => e.position < 4)!;
    const lance = invoquerLance(iop, devant, cs, ctx() as CombatCtx)!;
    expect(lance).not.toBeNull();
    expect(lance.position).toBeLessThan(4);
    expect(invoquerLance(iop, devant, cs, ctx() as CombatCtx)).toBeNull(); // une seule lance vivante à la fois

    const syn: Spell = { id: "syn_l", nom: "L", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 50, baseMax: 50, scaling: 0 };
    lancerSort(iop, syn, lance.ref, cs, ctx() as CombatCtx);
    expect(lance.pvActuels).toBe(LANCE_DURABILITE - 1); // −1 quel que soit le montant du coup
    expect(iop.bouclier).toBe(0); // pas encore détruite
    lancerSort(iop, syn, lance.ref, cs, ctx() as CombatCtx);
    expect(lance.pvActuels).toBe(0);
    expect(iop.bouclier).toBeGreaterThan(0); // destruction → bouclier au propriétaire
  });

  it("la lance protège la ligne arrière ennemie : exposée quand l'avant est vide, re-protégée par une lance avant vivante", () => {
    const { iop, pack, cs } = monte();
    const referenceAvant = pack.find((e) => e.position < 4)!;
    for (const e of pack.filter((x) => x.position < 4)) e.pvActuels = 0; // vide la rangée avant ennemie
    expect(ciblesValides(iop, SORTS.morsure, cs).some((c) => c.position >= 4)).toBe(true); // avant vide → arrière exposé

    const lance = invoquerLance(iop, referenceAvant, cs, ctx() as CombatCtx)!;
    expect(lance).not.toBeNull();
    expect(lance.position).toBeLessThan(4); // plantée en ligne AVANT (rangée de la référence)
    expect(ciblesValides(iop, SORTS.morsure, cs).every((c) => c.estLance || c.position < 4)).toBe(true); // arrière re-protégé
  });

  it("redirection : ~50 % des dégâts subis par un allié arrière vont au porteur, jamais re-redirigés", () => {
    const { iop, cra, pack, cs } = monte();
    iop.redirection = { ratio: 0.5, tours: 1 };
    iop.pvActuels = 200; iop.pvMax = 200; iop.bouclier = 0;
    cra.pvActuels = 200; cra.pvMax = 200; cra.stats = { ...cra.stats, agilite: 0 };
    const ennemi = pack[0];
    const avantCra = cra.pvActuels;
    const avantIop = iop.pvActuels;
    lancerSort(ennemi, SORTS.morsure, cra.ref, cs, ctx() as CombatCtx);
    const dmgCra = avantCra - cra.pvActuels;
    const dmgIop = avantIop - iop.pvActuels;
    expect(dmgIop).toBeGreaterThan(0); // le porteur encaisse sa part
    expect(dmgCra).toBeGreaterThan(0); // la victime encaisse le reste
    expect(Math.abs(dmgIop - dmgCra)).toBeLessThanOrEqual(1); // ≈ moitié/moitié (arrondis ceil/floor)
    expect(dmgCra + dmgIop).toBeGreaterThan(0);
  });

  it("la redirection ne s'applique pas à la ligne AVANT, ni au porteur lui-même", () => {
    const { iop, cra, pack, cs } = monte();
    iop.position = 0; cra.position = 1; // les deux en AVANT
    iop.redirection = { ratio: 0.5, tours: 1 };
    iop.pvActuels = 200; iop.pvMax = 200;
    cra.pvActuels = 200; cra.pvMax = 200; cra.stats = { ...cra.stats, agilite: 0 };
    const ennemi = pack[0];
    lancerSort(ennemi, SORTS.morsure, cra.ref, cs, ctx() as CombatCtx);
    expect(iop.pvActuels).toBe(200); // ligne avant : pas de redirection
    expect(cra.pvActuels).toBeLessThan(200);
  });
});
