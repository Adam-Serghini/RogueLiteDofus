// =============================================================================
//  eliotrope.test.ts — Kit de l'Éliotrope : Portail, Rayon de Wakfu, Sarcasme,
//  Parasite, Coalition, Conjuration.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, PORTAILS_MAX, runCombat,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { multSoin } from "./progression";
import { nouvelleRun, equipeCombattante } from "./run";
import type { Combatant, Action } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Éliotrope prêt à combattre (agilité 0 pour le déterminisme). */
function eliotrope(): Combatant {
  const c = equipeCombattante(nouvelleRun(["eliotrope"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
/** Un ennemi « bouche-trou » placé à une position précise (résistances neutres,
 *  ref unique — indispensable dès qu'on en pose plusieurs dans le même combat). */
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

describe("classe Éliotrope", () => {
  it("est recrutable, avec son kit de 6 sorts", () => {
    expect(CLASSES.eliotrope).toBeDefined();
    expect(CLASSES.eliotrope.sorts).toEqual([
      "rayon_de_wakfu", "sarcasme", "parasite", "portail", "coalition", "conjuration",
    ]);
    expect(CLASSES.eliotrope.sorts.length).toBe(6);
    for (const id of CLASSES.eliotrope.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Portail", () => {
  it("ouvre un portail (compteur), limité à 2 lancers par tour", () => {
    const e = eliotrope();
    const cs = [e];
    expect(e.portails ?? 0).toBe(0);
    lancerSort(e, SORTS.portail, e.ref, cs, ctx());
    expect(e.portails).toBe(1);
    lancerSort(e, SORTS.portail, e.ref, cs, ctx());
    expect(e.portails).toBe(2);
    // 2 lancers déjà faits ce tour (maxParTour) : plus de cible valide
    expect(ciblesValides(e, SORTS.portail, cs)).toEqual([]);
  });

  it("plafonne à 4 portails", () => {
    const e = eliotrope();
    e.portails = PORTAILS_MAX;
    lancerSort(e, SORTS.portail, e.ref, [e], ctx());
    expect(e.portails).toBe(PORTAILS_MAX);
  });
});

describe("Rayon de Wakfu", () => {
  it("frappe toute la rangée avant ennemie et répartit le soin à parts égales sur la rangée avant alliée", () => {
    const e = eliotrope();
    e.position = 4; // arrière, ne compte pas dans « sa rangée avant »
    e.stats = { ...e.stats, intelligence: 0, soin: 0 }; // multSoin = 1 : soin = part brute
    const en1 = ennemiA(0);
    const en2 = ennemiA(1);
    const al1 = allieA(0);
    const al2 = allieA(1);
    al1.pvActuels = 100;
    al2.pvActuels = 50;
    const cs = [e, en1, en2, al1, al2];

    const pv1Avant = en1.pvActuels;
    const pv2Avant = en2.pvActuels;
    lancerSort(e, SORTS.rayon_de_wakfu, en1.ref, cs, ctx());
    const dmg1 = pv1Avant - en1.pvActuels;
    const dmg2 = pv2Avant - en2.pvActuels;
    expect(dmg1).toBeGreaterThan(0);
    expect(dmg2).toBeGreaterThan(0); // zoneLigne : toute la rangée avant touchée

    const total = dmg1 + dmg2;
    const part = Math.round(total / 2);
    expect(al1.pvActuels).toBe(Math.min(al1.pvMax, 100 + part));
    expect(al2.pvActuels).toBe(Math.min(al2.pvMax, 50 + part));
  });

  it("le soin réparti scale avec multSoin (convention des soins dérivés de dégâts)", () => {
    const e = eliotrope();
    e.position = 4;
    e.stats = { ...e.stats, intelligence: 0, soin: 100 }; // multSoin = 1.5 (cap 50 %)
    const en1 = ennemiA(0);
    const al1 = allieA(0);
    al1.pvActuels = 100;
    const cs = [e, en1, al1];

    const pvAvant = en1.pvActuels;
    lancerSort(e, SORTS.rayon_de_wakfu, en1.ref, cs, ctx());
    const dmg = pvAvant - en1.pvActuels;
    expect(dmg).toBeGreaterThan(0);
    const part = Math.round((dmg / 1) * multSoin(e.stats)); // = round(dmg × 1.5)
    expect(multSoin(e.stats)).toBeCloseTo(1.5);
    expect(al1.pvActuels).toBe(Math.min(al1.pvMax, 100 + part));
  });

  it("la Lance (Forgelance) touchée par la zone ne compte pas dans le soin (dégâts fantômes)", () => {
    const e = eliotrope();
    e.position = 4; // arrière : ne compte pas dans « sa rangée avant »
    e.stats = { ...e.stats, intelligence: 0, soin: 0 }; // multSoin = 1
    const en1 = ennemiA(0); // avant : ennemi réel
    const lance: Combatant = { ...ennemiA(1), ref: "lance_test", estLance: true, position: 1, pvActuels: 2, pvMax: 2 };
    const al1 = allieA(0);
    al1.pvActuels = 100;
    const cs = [e, en1, lance, al1];

    const pv1Avant = en1.pvActuels;
    lancerSort(e, SORTS.rayon_de_wakfu, en1.ref, cs, ctx());
    const dmgReel = pv1Avant - en1.pvActuels; // seul dégât réel : la lance ne compte pas
    expect(dmgReel).toBeGreaterThan(0);
    expect(lance.pvActuels).toBe(1); // la lance a bien été touchée (−1 durabilité)
    // le soin (ratio 1, 1 seul allié en ligne avant) ne doit PAS inclure le jet virtuel de la lance
    expect(al1.pvActuels).toBe(Math.min(al1.pvMax, 100 + dmgReel));
  });

  it("ne soigne personne s'il n'y a aucun allié en ligne avant", () => {
    const e = eliotrope();
    e.position = 4; // arrière : e lui-même n'est pas « devant »
    const en1 = ennemiA(0);
    const cs = [e, en1];
    const pvAvant = en1.pvActuels;
    lancerSort(e, SORTS.rayon_de_wakfu, en1.ref, cs, ctx());
    expect(en1.pvActuels).toBeLessThan(pvAvant); // les dégâts ont bien lieu
    // (rien à vérifier côté soin : aucun allié en ligne avant dans ce test)
  });
});

describe("Sarcasme", () => {
  it("inflige −5 % de dégâts infligés à la cible, −10 % avec 3 portails ou plus", () => {
    const e = eliotrope();
    const cible = ennemiA(0);
    const cs = [e, cible];

    lancerSort(e, SORTS.sarcasme, cible.ref, cs, ctx());
    expect(cible.effets.some((ef) => ef.stat === "degatsInfliges" && ef.valeur === -0.05)).toBe(true);

    // à 3 portails ou plus : -10 % au lieu de -5 %
    const e2 = eliotrope();
    e2.portails = 3;
    const cible2 = ennemiA(1);
    const cs2 = [e2, cible2];
    lancerSort(e2, SORTS.sarcasme, cible2.ref, cs2, ctx());
    expect(cible2.effets.some((ef) => ef.stat === "degatsInfliges" && ef.valeur === -0.1)).toBe(true);
    expect(cible2.effets.some((ef) => ef.stat === "degatsInfliges" && ef.valeur === -0.05)).toBe(false);
  });
});

describe("Parasite", () => {
  it("ne pose aucun poison à moins de 3 portails", () => {
    const e = eliotrope();
    e.portails = 2;
    const cible = ennemiA(0);
    const cs = [e, cible];
    lancerSort(e, SORTS.parasite, cible.ref, cs, ctx());
    expect(cible.effets.some((ef) => ef.stat === "poison")).toBe(false);
  });

  it("pose un poison = 50 % du jet, sur 2 tours, à 3 portails ou plus", () => {
    const e = eliotrope();
    e.portails = 3;
    const cible = ennemiA(0);
    const cs = [e, cible];
    const pvAvant = cible.pvActuels;
    lancerSort(e, SORTS.parasite, cible.ref, cs, ctx());
    const dmg = pvAvant - cible.pvActuels;
    const poison = cible.effets.find((ef) => ef.stat === "poison");
    expect(poison).toBeDefined();
    expect(poison!.toursRestants).toBe(2);
    expect(poison!.valeur).toBe(Math.round(dmg * 0.5));
  });
});

describe("Coalition", () => {
  it("+2 PA au prochain tour du lanceur ET de l'allié de même rangée, pas l'autre rangée", () => {
    const e = eliotrope();
    e.position = 0; // avant
    const alliéAvant = allieA(1); // même rangée
    const alliéArriere = allieA(4); // rangée opposée : ne doit pas être buffé
    const cs = [e, alliéAvant, alliéArriere];

    lancerSort(e, SORTS.coalition, e.ref, cs, ctx());
    expect(e.paBonusNextTurn).toBe(2);
    expect(alliéAvant.paBonusNextTurn).toBe(2);
    expect(alliéArriere.paBonusNextTurn).toBe(0);
    expect(e.cooldowns["coalition"]).toBe(3);
  });

  it("+3 PA à 3 portails ou plus, et se CUMULE avec un paBonusNextTurn déjà accordé", () => {
    const e = eliotrope();
    e.portails = 3;
    e.paBonusNextTurn = 5; // déjà accordé par ailleurs
    lancerSort(e, SORTS.coalition, e.ref, [e], ctx());
    expect(e.paBonusNextTurn).toBe(8); // 5 + 3, cumul (pas un max)
  });
});

describe("Conjuration", () => {
  it("marque la cible : +5 % de dégâts pour le lanceur et sa rangée uniquement, sans jet de dégâts", () => {
    const e = eliotrope();
    e.position = 0; // avant
    const cible = ennemiA(0);
    const alliéMemeRangee = allieA(1);
    const alliéAutreRangee = allieA(4);
    const cs = [e, cible, alliéMemeRangee, alliéAutreRangee];

    let appelsRng = 0;
    const logs: string[] = [];
    lancerSort(e, SORTS.conjuration, cible.ref, cs, ctx({
      rng: () => { appelsRng++; return 0.99; },
      log: (m) => logs.push(m),
    }));
    expect(appelsRng).toBe(0); // sort à 0 dégâts (baseMax 0) : aucun jet consommé
    expect(logs.some((m) => /dégâts|esquive/i.test(m))).toBe(false);
    expect(cible.conjuration).toBeDefined();
    expect(cible.conjuration!.pct).toBeCloseTo(0.05);
    expect(cible.conjuration!.lanceurRef).toBe(e.ref);
    expect(cible.conjuration!.tours).toBe(2);
    expect(e.cooldowns["conjuration"]).toBe(1);
  });

  it("bonus porté à +10 % avec 3 portails ou plus", () => {
    const e = eliotrope();
    e.portails = 3;
    const cible = ennemiA(0);
    const cs = [e, cible];
    lancerSort(e, SORTS.conjuration, cible.ref, cs, ctx());
    expect(cible.conjuration!.pct).toBeCloseTo(0.1);
  });

  it("MINOR — ne peut pas marquer la Lance (Forgelance)", () => {
    const e = eliotrope();
    const lance: Combatant = { ...ennemiA(0), ref: "lance_x", estLance: true };
    const cs = [e, lance];
    lancerSort(e, SORTS.conjuration, lance.ref, cs, ctx());
    expect(lance.conjuration).toBeUndefined();
  });

  it("MINOR — une marque ne reste pas orpheline : elle expire dès la fin d'un autre tour après la mort du marqueur", async () => {
    const e = eliotrope();
    e.position = 0; e.initiative = 100; e.pvMax = 10; e.pvActuels = 10; // meurt en un coup
    const cible = ennemiA(0);
    const attaquant = ennemiA(1);
    attaquant.initiative = 50;
    attaquant.paMax = SORTS.morsure.coutPA; attaquant.paActuels = attaquant.paMax;
    const cs = [e, cible, attaquant];

    let eAJoue = false;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref === e.ref && !eAJoue) {
        eAJoue = true;
        return { sort: SORTS.conjuration, cibleRef: cible.ref };
      }
      return null;
    };
    let attaqueFaite = false;
    const controllerEnnemi = (acteur: Combatant): Action | null => {
      if (acteur.ref === attaquant.ref && !attaqueFaite) {
        attaqueFaite = true;
        return { sort: SORTS.morsure, cibleRef: e.ref }; // tue le marqueur
      }
      return null;
    };

    await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: controllerEnnemi },
      rng: () => 0.99,
    });

    expect(e.pvActuels).toBe(0); // le marqueur est bien mort
    expect(cible.conjuration).toBeUndefined(); // la marque n'est pas restée orpheline
  });
});
