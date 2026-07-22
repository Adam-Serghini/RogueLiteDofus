// =============================================================================
//  cra.test.ts — Rework du Cra : Flèche Punitive, Flèche enflammée, Flèche de
//  recul, Œil de Taupe, Tir Puissant, Acuité absolue.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, statsEffectives, chanceCrit, critExcedent, estAvant,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante } from "./run";
import type { Combatant, Spell } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Cra prêt à combattre (agilité 0 pour le déterminisme : pas d'esquive/crit parasite). */
function cra(): Combatant {
  const c = equipeCombattante(nouvelleRun(["cra"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
/** Ennemi « bouche-trou » placé à une position précise (résistances neutres). */
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

describe("classe Cra", () => {
  it("est recrutable, avec son kit de 6 sorts", () => {
    expect(CLASSES.cra.sorts).toEqual([
      "fleche_punitive", "fleche_enflammee", "fleche_de_recul", "oeil_de_taupe", "tir_puissant", "acuite_absolue",
    ]);
    expect(CLASSES.cra.sorts.length).toBe(6);
    for (const id of CLASSES.cra.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Flèche Punitive", () => {
  it("+8 % de dégâts par PA disponible AVANT le paiement du coût", () => {
    const c = cra();
    const e = ennemiA(0);
    // « 6 PA dispo avant paiement » : la boucle de combat aurait déjà débité paActuels
    // de coutPA (4) avant d'appeler lancerSort → paActuels vaut 6 - 4 = 2 ici.
    c.paActuels = 6;
    c.paActuels -= SORTS.fleche_punitive.coutPA;
    lancerSort(c, SORTS.fleche_punitive, e.ref, [c, e], ctx());
    // jet max = 14 (10-14), pas de bonus élémentaire (stats à 0) → 14 * (1 + 0,08*6)
    expect(500 - e.pvActuels).toBe(Math.round(14 * (1 + 0.08 * 6)));
  });
});

describe("Flèche enflammée", () => {
  it("régime AVANT : 100 % à la cible, 50 % aux 2 ennemis arrière les plus proches en colonne", () => {
    const c = cra();
    const cible = ennemiA(0); // ligne avant
    const arr1 = ennemiA(4); // arrière, plus proche en colonne
    const arr2 = ennemiA(6); // arrière
    const cs = [c, cible, arr1, arr2];
    lancerSort(c, SORTS.fleche_enflammee, cible.ref, cs, ctx());
    // jet max = 11 (8-11), pas de bonus élémentaire
    expect(500 - cible.pvActuels).toBe(11);
    expect(500 - arr1.pvActuels).toBe(Math.round(11 * 0.5));
    expect(500 - arr2.pvActuels).toBe(Math.round(11 * 0.5));
  });

  it("régime ARRIÈRE (cible déjà en rangée arrière) : 100 % partout (cible + 2 voisines de rangée)", () => {
    const c = cra();
    const cible = ennemiA(5); // ligne arrière
    const voisin1 = ennemiA(4); // même rangée
    const voisin2 = ennemiA(6); // même rangée
    const cs = [c, cible, voisin1, voisin2];
    lancerSort(c, SORTS.fleche_enflammee, cible.ref, cs, ctx());
    expect(500 - cible.pvActuels).toBe(11);
    expect(500 - voisin1.pvActuels).toBe(11);
    expect(500 - voisin2.pvActuels).toBe(11);
  });
});

describe("Flèche de recul", () => {
  it("cas 1 : un autre ennemi partage la rangée de DÉPART (avant) → pas de déplacement, bousculade ignoreResistances aux deux", () => {
    const c = cra();
    const cible = ennemiA(0); // ligne avant
    cible.resistances = { terre: 1, feu: 1, eau: 1, air: 1 }; // résistance totale : ignoreResistances doit passer outre
    const voisin = ennemiA(1); // partage la rangée de départ (avant)
    const cs = [c, cible, voisin]; // rangée arrière VIDE : la cible pourrait s'y déplacer, mais le voisin de départ bloque
    lancerSort(c, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(estAvant(cible)).toBe(true); // aucun déplacement malgré une arrière libre
    expect(cible.position).toBe(0);
    // jet max = 9 (6-9), dégâts pleins malgré la résistance totale (ignoreResistances)
    expect(500 - cible.pvActuels).toBe(9);
    expect(500 - voisin.pvActuels).toBe(9);
  });

  it("cas 2 : déplacée, rangée d'arrivée déjà occupée (mais pas pleine) → bousculade aux deux", () => {
    const c = cra();
    const cible = ennemiA(0); // ligne avant, seule sur sa rangée
    const occupant = ennemiA(4); // occupe déjà la case en face
    const cs = [c, cible, occupant];
    lancerSort(c, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(estAvant(cible)).toBe(false); // déplacement réussi
    expect(500 - cible.pvActuels).toBe(9);
    expect(500 - occupant.pvActuels).toBe(9);
  });

  it("cas 3 : déplacée, rangée d'arrivée vide → aucun dégât", () => {
    const c = cra();
    const cible = ennemiA(0); // seule en jeu côté ennemi, ligne avant
    const cs = [c, cible];
    lancerSort(c, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(estAvant(cible)).toBe(false); // déplacement réussi
    expect(cible.pvActuels).toBe(500); // aucun dégât : rien à bousculer
  });

  it("rangée de départ libre mais rangée d'arrivée PLEINE → le déplacement échoue silencieusement, aucun dégât", () => {
    // Lecture retenue du texte de conception : la bousculade ne s'applique qu'en cas de
    // collision RÉELLE (départ partagé, ou arrivée déjà occupée après un déplacement réussi).
    // Si l'arrivée est pleine, deplacerCible() échoue en silence (comme pour tout autre
    // déplacement du moteur) : aucun déplacement n'a lieu, donc aucune collision, donc
    // aucun dégât de poussée — même si la cible était seule sur sa rangée de départ.
    const c = cra();
    const cible = ennemiA(0); // seule en ligne avant
    const e4 = ennemiA(4);
    const e5 = ennemiA(5);
    const e6 = ennemiA(6);
    const e7 = ennemiA(7); // ligne arrière pleine (4 cases occupées)
    const cs = [c, cible, e4, e5, e6, e7];
    lancerSort(c, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(estAvant(cible)).toBe(true); // le déplacement a échoué
    expect(cible.position).toBe(0);
    expect(cible.pvActuels).toBe(500);
    for (const e of [e4, e5, e6, e7]) expect(e.pvActuels).toBe(500);
  });

  it("1 seul lancer par tour (maxParTour)", () => {
    const c = cra();
    const cible = ennemiA(0);
    const cs = [c, cible];
    expect(ciblesValides(c, SORTS.fleche_de_recul, cs).length).toBeGreaterThan(0);
    lancerSort(c, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(ciblesValides(c, SORTS.fleche_de_recul, cs)).toEqual([]);
  });
});

describe("Œil de Taupe", () => {
  it("blesse toute la rangée ciblée et pose Tétanisation (1 tour) ; cooldown 2", () => {
    const c = cra();
    const e1 = ennemiA(0);
    const e2 = ennemiA(1);
    const cs = [c, e1, e2];
    lancerSort(c, SORTS.oeil_de_taupe, e1.ref, cs, ctx());
    expect(e1.pvActuels).toBeLessThan(500);
    expect(e2.pvActuels).toBeLessThan(500); // zoneLigne : toute la rangée touchée
    for (const e of [e1, e2]) {
      expect(e.effets.some((x) => x.stat === "tetanise" && x.toursRestants === 1)).toBe(true);
    }
    expect(c.cooldowns["oeil_de_taupe"]).toBe(2);
    expect(ciblesValides(c, SORTS.oeil_de_taupe, cs)).toEqual([]); // en recharge
    c.cooldowns = {};
    expect(ciblesValides(c, SORTS.oeil_de_taupe, cs).length).toBeGreaterThan(0);
  });

  it("Tétanisation : l'ennemi touché ne peut plus viser la ligne arrière à son prochain tour", () => {
    const c = cra();
    c.position = 0; // ligne avant (formation par défaut du Cra = arrière)
    const cArriere = equipeCombattante(nouvelleRun(["iop"]))[0]; // classe différente : ref distincte de c
    cArriere.pvMax = 500; cArriere.pvActuels = 500;
    cArriere.position = 4; // rangée arrière du joueur, exposée
    const e = ennemiA(0);
    const cs = [c, cArriere, e];
    // avant tétanie : la rangée arrière du joueur est exposée (pas de ligne avant adverse... ici
    // on force via ignoreLigne pour vérifier la restriction, pas la règle de ligne standard)
    expect(ciblesValides(e, SORTS.tir_courbe, cs).some((x) => x.ref === cArriere.ref)).toBe(true);
    lancerSort(c, SORTS.oeil_de_taupe, e.ref, cs, ctx());
    expect(ciblesValides(e, SORTS.tir_courbe, cs).some((x) => x.ref === cArriere.ref)).toBe(false);
    expect(ciblesValides(e, SORTS.tir_courbe, cs).some((x) => x.ref === c.ref)).toBe(true);
  });
});

describe("Tir Puissant", () => {
  it("+15 % de crit (buff, 3 tours) ; l'excédent au-delà du cap devient des dégâts finaux", () => {
    const c = cra();
    c.stats = { ...c.stats, crit: 40 }; // 40 % de crit plat (équipement)
    c.effets = [];
    const e = ennemiA(0);
    lancerSort(c, SORTS.tir_puissant, c.ref, [c, e], ctx());
    expect(c.effets.some((x) => x.stat === "crit" && x.valeur === 15 && x.toursRestants === 3)).toBe(true);

    const se = statsEffectives(c);
    expect(chanceCrit(se)).toBeCloseTo(0.5); // 40+15=55 % → plafonné à 50 %
    expect(critExcedent(se)).toBeCloseTo(0.05); // l'excédent (5 points) devient des dégâts finaux

    const syn: Spell = { id: "syn_neutre", nom: "Syn", type: "degats", cible: "ennemi_ligne", coutPA: 1, baseMin: 10, baseMax: 10, scaling: 0 };
    lancerSort(c, syn, e.ref, [c, e], ctx()); // rng max → pas de crit déclenché, seul l'excédent joue
    expect(500 - e.pvActuels).toBe(Math.round(10 * 1.05));
  });
});

describe("Acuité absolue", () => {
  it("ouvre la ligne de vue (ligne arrière ciblable) pendant 2 tours, cooldown 3, puis se referme", () => {
    const c = cra();
    const avant = ennemiA(0);
    const arriere = ennemiA(4);
    const cs = [c, avant, arriere];
    expect(ciblesValides(c, SORTS.morsure, cs).some((x) => x.position >= 4)).toBe(false);
    lancerSort(c, SORTS.acuite_absolue, c.ref, cs, ctx());
    expect(c.effets.some((x) => x.stat === "ignoreLigne" && x.toursRestants === 2)).toBe(true);
    expect(c.cooldowns["acuite_absolue"]).toBe(3);
    expect(ciblesValides(c, SORTS.morsure, cs).some((x) => x.position >= 4)).toBe(true);
    // simule 2 fins de tour (decrementerEffets n'est pas exporté : décrément manuel)
    for (let i = 0; i < 2; i++) {
      c.effets = c.effets
        .map((x) => ({ ...x, toursRestants: x.toursRestants - 1 }))
        .filter((x) => x.toursRestants > 0);
    }
    expect(c.effets.some((x) => x.stat === "ignoreLigne")).toBe(false);
    expect(ciblesValides(c, SORTS.morsure, cs).some((x) => x.position >= 4)).toBe(false);
  });
});
