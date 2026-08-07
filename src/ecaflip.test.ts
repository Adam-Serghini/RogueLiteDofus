// =============================================================================
//  ecaflip.test.ts — Task 3 du rework Ecaflip : le kit RÉEL (6 sorts, paire
//  air+eau). Les primitives moteur qu'il emploie (rembPASiCrit, elementPire,
//  secondCoupSiCrit, degatsCritSubis/effetLigneCible, soinAvantBlesseRatio,
//  bouclierPctSiCrit/bouclierTours, facesAleatoires/tiragesSiCrit) sont déjà
//  couvertes contre des sorts synthétiques dans ecaflip-moteur.test.ts : ici on
//  vérifie le CONTENU réel — les valeurs exactes du tableau du plan, la
//  disparition des 6 anciens sorts, la nouvelle paire, et chaque sort produisant
//  son effet de bout en bout via lancerSort dans un vrai combat.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, estAvant, type CombatCtx } from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Ecaflip prêt à combattre, agilité nulle par défaut (esquive/crit déterministes
 *  côté défense — les tests qui ont besoin de contrôler l'attaque redéfinissent
 *  agilite/chance explicitement). */
function ecaflip(): Combatant {
  const c = equipeCombattante(nouvelleRun(["ecaflip"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

/** Un mannequin ennemi sans résistances, PV confortables. */
function mannequin(id = "combat_1"): Combatant {
  const e = fabriquerEnnemis(id)[0];
  e.stats = { ...e.stats, agilite: 0 };
  e.resistances = {};
  e.pvMax = 500; e.pvActuels = 500;
  return e;
}

const KIT = ["pile_ou_face", "bluff", "langue_rapeuse", "griffe_joueuse", "roulette", "chateau_de_cartes"];
const RETIRES = ["des_double", "tarot", "all_in", "odorat", "perception", "esprit_felin"];

describe("la classe", () => {
  it("frappe désormais en air et en eau (plus terre+eau)", () => {
    expect(CLASSES.ecaflip.elements).toEqual(["air", "eau"]);
  });

  it("son kit est EXACTEMENT les 6 nouveaux sorts, dans cet ordre", () => {
    expect(CLASSES.ecaflip.sorts).toEqual(KIT);
  });

  it("les 6 anciens sorts ont disparu du contenu", () => {
    for (const id of RETIRES) expect(SORTS[id as keyof typeof SORTS], id).toBeUndefined();
  });
});

describe("Pile ou Face", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.pile_ou_face;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(6);
    expect(s.baseMax).toBe(10);
    expect(s.scaling).toBeCloseTo(0.27);
    expect(s.maxParTour).toBe(4);
    expect(s.rembPASiCrit).toBe(1);
    expect(s.type).toBe("degats");
  });

  it("bout en bout : inflige des dégâts, et rembourse 1 PA SEULEMENT sur critique", () => {
    const eca = ecaflip();
    const cible = mannequin();
    const avant = eca.paActuels;
    lancerSort(eca, SORTS.pile_ou_face, cible.ref, [eca, cible], ctx({ rng: () => 0 })); // crit forcé
    expect(cible.pvActuels).toBeLessThan(500);
    expect(eca.paActuels).toBe(avant + 1);

    const eca2 = ecaflip();
    const cible2 = mannequin();
    const avant2 = eca2.paActuels;
    lancerSort(eca2, SORTS.pile_ou_face, cible2.ref, [eca2, cible2], ctx({ rng: () => 0.5 })); // pas de crit
    expect(cible2.pvActuels).toBeLessThan(500);
    expect(eca2.paActuels).toBe(avant2);
  });
});

describe("Bluff", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.bluff;
    expect(s.coutPA).toBe(4);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(7);
    expect(s.baseMax).toBe(11);
    expect(s.scaling).toBeCloseTo(0.28);
    expect(s.maxParTour).toBe(2);
    expect(s.elementPire).toBe(true);
    expect(s.secondCoupSiCrit).toBe(true);
    expect(s.type).toBe("degats");
  });

  it("bout en bout, sans critique : un seul coup, dans le PIRE élément (eau, chance faible)", () => {
    const eca = ecaflip();
    eca.stats = { ...eca.stats, agilite: 100, chance: 10 }; // air fort, eau faible → pire = eau
    const cible = mannequin();
    const elements: string[] = [];
    const logCtx = ctx({
      rng: () => 0.5, // jamais d'esquive (seuil 0), jamais de critique (seuil 0.05)
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
    });
    lancerSort(eca, SORTS.bluff, cible.ref, [eca, cible], logCtx);
    expect(elements).toEqual(["eau"]);
  });

  it("bout en bout, sur critique : DEUX coups, le second dans le MEILLEUR élément (air)", () => {
    const eca = ecaflip();
    eca.stats = { ...eca.stats, agilite: 100, chance: 10 };
    const cible = mannequin();
    const elements: string[] = [];
    const crits: string[] = [];
    const logCtx = ctx({
      rng: () => 0, // crit forcé, pas d'esquive
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
      fx: (ev) => { if (ev.type === "crit") crits.push(ev.ref); },
    });
    lancerSort(eca, SORTS.bluff, cible.ref, [eca, cible], logCtx);
    expect(elements).toEqual(["eau", "air"]); // pire, puis meilleur (le retour)
    expect(crits).toEqual([cible.ref]); // le retour ne recritique pas
  });
});

describe("Langue râpeuse", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.langue_rapeuse;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(5);
    expect(s.baseMax).toBe(9);
    expect(s.scaling).toBeCloseTo(0.24);
    expect(s.maxParTour).toBe(2);
    expect(s.soinAvantBlesseRatio).toBeCloseTo(0.65);
    expect(s.type).toBe("degats");
  });

  it("bout en bout : inflige des dégâts et soigne le plus blessé de la RANGÉE AVANT alliée", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, front, back] = team;
    eca.position = 0;
    front.position = 1; front.pvMax = 100; front.pvActuels = 80; // avant, peu blessé
    back.position = 4; back.pvMax = 100; back.pvActuels = 50; // arrière, PLUS blessé
    expect(estAvant(front)).toBe(true);
    expect(estAvant(back)).toBe(false);

    const ennemi = mannequin();
    lancerSort(eca, SORTS.langue_rapeuse, ennemi.ref, [eca, front, back, ennemi], ctx());

    expect(ennemi.pvActuels).toBeLessThan(500);
    expect(front.pvActuels).toBeGreaterThan(80); // soigné : plus blessé EN RANGÉE AVANT
    expect(back.pvActuels).toBe(50); // inchangé : plus blessé dans l'absolu, mais hors rangée avant
  });
});

describe("Griffe joueuse", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.griffe_joueuse;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(8);
    expect(s.baseMax).toBe(11);
    expect(s.scaling).toBeCloseTo(0.29);
    expect(s.effetLigneCible).toEqual({ stat: "degatsCritSubis", valeur: 0.05, duree: 2 });
    expect(s.type).toBe("degats");
    // le vol de vie de l'ancien kit a bien disparu
    expect(s.vampirismeRatio).toBeUndefined();
  });

  it("bout en bout : inflige des dégâts et majore de 5 % les critiques subis par TOUTE la rangée de la cible", () => {
    const eca = ecaflip();
    const ennemis = fabriquerEnnemis("combat_elite"); // 4 ennemis
    ennemis.forEach((e, i) => {
      e.stats = { ...e.stats, agilite: 0 };
      e.position = i < 3 ? i : 4; // 3 en rangée avant, 1 en arrière (témoin)
      e.pvMax = 500; e.pvActuels = 500; e.resistances = {};
    });
    const [e0, e1, e2, arriere] = ennemis;
    const cs = [eca, ...ennemis];

    lancerSort(eca, SORTS.griffe_joueuse, e0.ref, cs, ctx());

    expect(e0.pvActuels).toBeLessThan(500);
    for (const e of [e0, e1, e2]) {
      const marques = e.effets.filter((x) => x.stat === "degatsCritSubis");
      expect(marques.length, e.ref).toBe(1);
      expect(marques[0].valeur).toBeCloseTo(0.05);
      expect(marques[0].toursRestants).toBe(2);
    }
    expect(estAvant(arriere)).toBe(false);
    expect(arriere.effets.some((x) => x.stat === "degatsCritSubis")).toBe(false);
  });
});

describe("Roulette", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.roulette;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("soi");
    expect(s.cooldownTours).toBe(3);
    expect(s.tiragesSiCrit).toBe(2);
    expect(s.type).toBe("buff");
    expect(s.facesAleatoires).toEqual([
      { portee: "soi", effet: { stat: "degatsInfliges", valeur: 0.10, duree: 3 } },
      { portee: "rangee_lanceur", effet: { stat: "crit", valeur: 10, duree: 3 } },
      { portee: "rangee_avant", bouclierPct: 0.15 },
    ]);
  });

  it("face « soi » : +10 % de dégâts finaux sur le lanceur pendant 3 tours", () => {
    const eca = ecaflip();
    // rng : pas de critique (0.99), puis tirage de la face d'index 0 (soi/degatsInfliges)
    const queue = [0.99, 0];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++] }));
    const marque = eca.effets.find((e) => e.stat === "degatsInfliges");
    expect(marque?.valeur).toBeCloseTo(0.10);
    expect(marque?.toursRestants).toBe(3);
  });

  it("face « rangée du lanceur » : +10 crit à toute sa rangée, PAS aux autres rangées", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, memeRangee, autreRangee] = team;
    eca.position = 0; memeRangee.position = 1; autreRangee.position = 4;
    // rng : pas de critique, puis tirage de la face d'index 1 (rangee_lanceur/crit)
    const queue = [0.99, 0.5];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, team, ctx({ rng: () => queue[i++] }));
    expect(eca.effets.some((e) => e.stat === "crit" && e.valeur === 10)).toBe(true);
    expect(memeRangee.effets.some((e) => e.stat === "crit")).toBe(true);
    expect(autreRangee.effets.some((e) => e.stat === "crit")).toBe(false);
  });

  it("face « rangée avant » : bouclier de 15 % des PV max à la rangée avant alliée", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, avant, arriere] = team;
    eca.position = 0; avant.position = 1; arriere.position = 4;
    avant.pvMax = 200; avant.pvActuels = 200;
    arriere.pvMax = 200; arriere.pvActuels = 200;
    // rng : pas de critique, puis tirage de la face d'index 2 (rangee_avant/bouclier)
    const queue = [0.99, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, team, ctx({ rng: () => queue[i++] }));
    expect(avant.bouclier).toBe(30); // round(200 * 0.15)
    expect(arriere.bouclier).toBe(0);
  });

  it("sur critique : DEUX faces sont tirées (cumulables)", () => {
    const eca = ecaflip();
    eca.position = 0; // rangée avant : nécessaire pour que la face « rangee_avant » l'inclue
    // crit (0), face 0 (0 → index 0, soi), face 1 (0.99 → index 2, dernier)
    const queue = [0, 0, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++] }));
    expect(eca.effets.some((e) => e.stat === "degatsInfliges")).toBe(true);
    expect(eca.bouclier).toBeGreaterThan(0); // face rangee_avant : eca est en rangée avant
  });
});

describe("Château de cartes", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.chateau_de_cartes;
    expect(s.coutPA).toBe(2);
    expect(s.cible).toBe("allie");
    expect(s.cooldownTours).toBe(4);
    expect(s.bouclierPct).toBeCloseTo(0.20);
    expect(s.bouclierPctSiCrit).toBeCloseTo(0.40);
    expect(s.bouclierTours).toBe(2);
    expect(s.type).toBe("buff");
  });

  it("bout en bout, sans critique : bouclier de 20 % des PV max, à durée", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop"]));
    const [eca, allie] = team;
    allie.pvMax = 300; allie.pvActuels = 300;
    lancerSort(eca, SORTS.chateau_de_cartes, allie.ref, team, ctx({ rng: () => 0.5 })); // pas de crit
    expect(allie.bouclier).toBe(60); // round(300 * 0.2)
    expect(allie.boucliersTemporaires).toEqual([{ montant: 60, tours: 2 }]);
  });

  it("bout en bout, sur critique : bouclier DOUBLÉ (40 %)", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop"]));
    const [eca, allie] = team;
    allie.pvMax = 300; allie.pvActuels = 300;
    lancerSort(eca, SORTS.chateau_de_cartes, allie.ref, team, ctx({ rng: () => 0 })); // crit forcé
    expect(allie.bouclier).toBe(120); // round(300 * 0.4)
  });
});
