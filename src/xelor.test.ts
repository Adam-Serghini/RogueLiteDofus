// =============================================================================
//  xelor.test.ts — Kit du Xélor : Aiguille, Sablier, Pendule/Téléfrags,
//  Rayon Obscur, Cadran de Xelor, Prémonition.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, TELEFRAGS_MAX, estAvant,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Xélor prêt à combattre (agilité 0 pour le déterminisme). */
function xelor(): Combatant {
  const c = equipeCombattante(nouvelleRun(["xelor"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
function ennemis(combatId = "gob_boss"): Combatant[] {
  return fabriquerEnnemis(combatId).map((e) => {
    e.stats = { ...e.stats, agilite: 0 };
    e.resistances = {}; // neutralise les résistances pour des jets comparables
    e.pvActuels = 500; e.pvMax = 500;
    return e;
  });
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

describe("classe Xélor", () => {
  it("est recrutable, avec son kit de 6 sorts", () => {
    expect(CLASSES.xelor).toBeDefined();
    expect(CLASSES.xelor.sorts).toEqual([
      "aiguille", "sablier_de_xelor", "pendule", "rayon_obscur", "cadran_de_xelor", "premonition",
    ]);
    expect(CLASSES.xelor.sorts.length).toBe(6);
    for (const id of CLASSES.xelor.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Aiguille", () => {
  it("inflige des dégâts et pose l'état aiguille (1 tour)", () => {
    const x = xelor();
    const [e] = ennemis();
    const cs = [x, e];
    const pvAvant = e.pvActuels;
    lancerSort(x, SORTS.aiguille, e.ref, cs, ctx());
    expect(e.pvActuels).toBeLessThan(pvAvant);
    expect(e.effets.some((ef) => ef.stat === "aiguille" && ef.toursRestants === 1)).toBe(true);
  });

  it("limite à 2 lancers par tour, 1 par cible par tour", () => {
    const x = xelor();
    const pack = ennemis(); // gob_boss : 3 ennemis en ligne avant
    const [e1, e2] = pack;
    const cs = [x, ...pack];
    expect(ciblesValides(x, SORTS.aiguille, cs)).toEqual(pack);
    lancerSort(x, SORTS.aiguille, e1.ref, cs, ctx());
    // e1 déjà visée ce tour : elle disparaît des cibles valides (maxParCibleParTour)
    expect(ciblesValides(x, SORTS.aiguille, cs)).not.toContain(e1);
    lancerSort(x, SORTS.aiguille, e2.ref, cs, ctx());
    // 2 lancers déjà faits ce tour : plus aucune cible valide (maxParTour)
    expect(ciblesValides(x, SORTS.aiguille, cs)).toEqual([]);
  });
});

describe("Sablier de Xelor", () => {
  it("retire 2 PA à coup sûr (retraitPAChance: 1)", () => {
    const x = xelor();
    const [e] = ennemis();
    const cs = [x, e];
    const paAvant = e.paActuels;
    lancerSort(x, SORTS.sablier_de_xelor, e.ref, cs, ctx({ rng: () => 0.999 })); // même un jet quasi-max ne rate pas
    expect(e.paActuels).toBe(paAvant - 2);
  });
});

describe("Pendule", () => {
  it("déplace la cible en rangée opposée ; sans occupant, aucun Téléfrag", () => {
    const x = xelor();
    const e1 = ennemiA(0); // seul ennemi, ligne avant
    const cs = [x, e1];
    expect(estAvant(e1)).toBe(true);
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx());
    expect(estAvant(e1)).toBe(false); // déplacée en arrière
    expect(e1.telefrags ?? 0).toBe(0);
  });

  it("double Téléfrag si la rangée de destination est déjà occupée", () => {
    const x = xelor();
    const e1 = ennemiA(0); // avant
    const e2 = ennemiA(4); // arrière : occupe la case en face de e1
    const cs = [x, e1, e2];
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx());
    expect(estAvant(e1)).toBe(false); // déplacement réussi (5, 6 ou 7 libres)
    expect(e1.telefrags).toBe(1); // la cible déplacée
    expect(e2.telefrags).toBe(1); // l'occupant le plus proche en colonne
  });

  it("aucun Téléfrag si le déplacement échoue (rangée de destination pleine)", () => {
    const x = xelor();
    const e1 = ennemiA(0); // avant, sera la cible
    const occ4 = ennemiA(4);
    const occ5 = ennemiA(5);
    const occ6 = ennemiA(6);
    const occ7 = ennemiA(7); // arrière totalement pleine : déplacement impossible
    const cs = [x, e1, occ4, occ5, occ6, occ7];
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx());
    expect(estAvant(e1)).toBe(true); // n'a pas bougé
    expect(e1.telefrags ?? 0).toBe(0);
    for (const o of [occ4, occ5, occ6, occ7]) expect(o.telefrags ?? 0).toBe(0);
  });

  it("plafonne à 4 Téléfrags (cap indépendant par cible)", () => {
    const x = xelor();
    const e1 = ennemiA(0);
    const e2 = ennemiA(4);
    e1.telefrags = TELEFRAGS_MAX;
    const cs = [x, e1, e2];
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx());
    expect(e1.telefrags).toBe(TELEFRAGS_MAX); // déjà au cap, ne déborde pas
    expect(e2.telefrags).toBe(1); // l'occupant, lui, n'était pas au cap
  });

  it("1 seul lancer par cible par tour (maxParCibleParTour)", () => {
    const x = xelor();
    const e1 = ennemiA(0);
    const cs = [x, e1];
    expect(ciblesValides(x, SORTS.pendule, cs)).toContain(e1);
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx());
    expect(ciblesValides(x, SORTS.pendule, cs)).not.toContain(e1);
  });

  it("ne fait aucun jet de dégâts/esquive (baseMax 0) et ne logue ni « dégâts » ni « esquive »", () => {
    const x = xelor();
    const e1 = ennemiA(0);
    const cs = [x, e1];
    let appelsRng = 0;
    const logs: string[] = [];
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx({ rng: () => { appelsRng++; return 0.99; }, log: (m) => logs.push(m) }));
    expect(appelsRng).toBe(0); // aucun jet de dégâts/esquive consommé
    expect(logs.some((m) => /dégâts|esquive/i.test(m))).toBe(false);
  });

  it("écho d'Aiguille : une cible aiguillée subit un jet d'Aiguille en plus quand elle est Téléfragée", () => {
    const x = xelor();
    const e1 = ennemiA(0); // aiguillée puis téléfragée
    const e2 = ennemiA(4); // occupant, PAS aiguillé
    const cs = [x, e1, e2];

    lancerSort(x, SORTS.aiguille, e1.ref, cs, ctx());
    expect(e1.effets.some((ef) => ef.stat === "aiguille")).toBe(true);

    const pvE1Avant = e1.pvActuels;
    const pvE2Avant = e2.pvActuels;
    lancerSort(x, SORTS.pendule, e1.ref, cs, ctx());

    // Pendule ne fait pas de dégâts propres (baseMin/baseMax = 0) : toute perte de PV
    // supplémentaire sur e1 vient de l'écho d'Aiguille déclenché par son Téléfrag.
    expect(e1.pvActuels).toBeLessThan(pvE1Avant);
    expect(e1.telefrags).toBe(1);
    // e2 est bien téléfragée aussi mais n'était pas aiguillée : pas d'écho, pas de dégâts.
    expect(e2.pvActuels).toBe(pvE2Avant);
    expect(e2.telefrags).toBe(1);
  });
});

describe("Rayon Obscur", () => {
  it("jouable à 0 Téléfrag, +50 % de dégâts par Téléfrag, ne consomme pas les Téléfrags, cooldown 1", () => {
    const x = xelor();
    const e0 = ennemiA(0); // 0 Téléfrag
    const e1 = ennemiA(1);
    e1.telefrags = 2; // 2 Téléfrags → +100 % de dégâts
    const cs = [x, e0, e1];

    expect(ciblesValides(x, SORTS.rayon_obscur, cs)).toEqual(expect.arrayContaining([e0, e1]));

    const pv0Avant = e0.pvActuels;
    lancerSort(x, SORTS.rayon_obscur, e0.ref, cs, ctx());
    const dmg0 = pv0Avant - e0.pvActuels;
    expect(dmg0).toBeGreaterThan(0); // jouable à 0 Téléfrag
    expect(x.cooldowns["rayon_obscur"]).toBe(1);

    x.cooldowns = {}; // on relance sur l'autre cible sans se soucier du cooldown ici
    const pv1Avant = e1.pvActuels;
    lancerSort(x, SORTS.rayon_obscur, e1.ref, cs, ctx());
    const dmg1 = pv1Avant - e1.pvActuels;
    // 2 Téléfrags → dégâts ≈ ×2 par rapport à la cible à 0 Téléfrag
    expect(Math.abs(dmg1 - dmg0 * 2)).toBeLessThanOrEqual(2);
    expect(e1.telefrags).toBe(2); // les Téléfrags ne sont pas consommés
  });
});

describe("Cadran de Xelor", () => {
  it("crédite +2 PA à chaque tour pendant 2 tours à TOUTE la rangée de l'allié ciblé, pas l'autre rangée", () => {
    const x = xelor();
    x.position = 0; // avant
    const alliéAvant = equipeCombattante(nouvelleRun(["iop"]))[0];
    alliéAvant.position = 1; // même rangée que x
    const alliéArriere = equipeCombattante(nouvelleRun(["cra"]))[0];
    alliéArriere.position = 4; // rangée opposée : ne doit PAS être buffée
    const cs = [x, alliéAvant, alliéArriere];

    lancerSort(x, SORTS.cadran_de_xelor, x.ref, cs, ctx());
    expect(x.cooldowns["cadran_de_xelor"]).toBe(4);
    for (const c of [x, alliéAvant]) {
      expect(c.effets.some((ef) => ef.stat === "paParTour" && ef.valeur === 2 && ef.toursRestants === 2)).toBe(true);
    }
    expect(alliéArriere.effets.some((ef) => ef.stat === "paParTour")).toBe(false);
  });

  it("le LANCEUR profite lui aussi des 2 ticks (l'effet posé pendant son tour ne doit pas expirer prématurément)", async () => {
    // Bug remonté en jeu : l'effet était décrémenté à la fin du tour où il était posé,
    // avant d'avoir tické — le Xélor ne gagnait ses PA qu'UNE fois au lieu de deux.
    const { runCombat } = await import("./combat");
    const run = nouvelleRun(["xelor", "iop"]);
    const [x, iop] = equipeCombattante(run);
    x.position = 0; iop.position = 1;
    x.initiative = 99; iop.initiative = 50; // le Xélor joue en premier
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.pvActuels = 9999; ennemi.pvMax = 9999; ennemi.initiative = 1;
    ennemi.stats = { ...ennemi.stats, force: 0, intelligence: 0, agilite: 0, chance: 0 };

    let caste = false;
    let rounds = 0;
    const ticks: Record<string, number> = {};
    const gagne = /^(.+) gagne 2 PA/;
    await runCombat([x, iop, ennemi], {
      controllers: {
        joueur: (acteur) => {
          if (acteur.ref === x.ref && !caste) { caste = true; return { sort: SORTS.cadran_de_xelor, cibleRef: x.ref }; }
          return null;
        },
        ennemi: () => {
          // on borne à 4 rounds puis on tue l'ennemi pour terminer le combat
          if (++rounds >= 4) ennemi.pvActuels = 0;
          return null;
        },
      },
      log: (m) => {
        const match = gagne.exec(m);
        if (match && m.includes("effet de ligne")) ticks[match[1]] = (ticks[match[1]] ?? 0) + 1;
      },
      rng: () => 0.5,
    });
    expect(ticks["Iop"]).toBe(2); // l'allié touchait déjà ses 2 ticks
    expect(ticks["Xélor"]).toBe(2); // le lanceur doit les toucher AUSSI
  });
});

describe("Prémonition", () => {
  it("+2 PA au prochain tour, non cumulable avec elle-même", () => {
    const x = xelor();
    const cs = [x];
    lancerSort(x, SORTS.premonition, x.ref, cs, ctx());
    expect(x.paBonusNextTurn).toBe(2);
    lancerSort(x, SORTS.premonition, x.ref, cs, ctx()); // relancée le même tour
    expect(x.paBonusNextTurn).toBe(2); // ne stacke pas (max, pas +=)
  });

  it("n'écrase pas un bonus supérieur déjà accordé (ex. Mot d'ivation)", () => {
    const x = xelor();
    x.paBonusNextTurn = 5;
    lancerSort(x, SORTS.premonition, x.ref, [x], ctx());
    expect(x.paBonusNextTurn).toBe(5); // 2 < 5 : le max l'emporte
  });
});
