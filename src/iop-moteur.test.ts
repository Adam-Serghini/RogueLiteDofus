// =============================================================================
//  iop-moteur.test.ts — Les primitives introduites par le rework du Iop, sur des
//  sorts SYNTHÉTIQUES : ces tests doivent survivre à un rééquilibrage du kit réel.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, reinitialiserLancersTour, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import type { Combatant, Spell } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet tiré au max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});
const heros = (): Combatant => {
  const c = fabriquerEquipe()[0];
  c.stats = { ...c.stats, agilite: 0 }; // esquive/crit déterministes
  return c;
};
/** Dégâts subis par une cible sur UN lancer, cible remise à neuf. */
const degatsDe = (l: Combatant, s: Spell, c: Combatant, cs: Combatant[]): number => {
  const avant = c.pvActuels;
  lancerSort(l, s, c.ref, cs, ctx());
  return avant - c.pvActuels;
};

describe("bonusParRelanceCeTour — escalade dans le tour (Pugilat)", () => {
  const sortEscalade: Spell = {
    ...SORTS.morsure, id: "test_escalade_tour",
    maxParCibleParTour: 1, bonusParRelanceCeTour: 0.2,
  };

  it("le PREMIER lancer n'est PAS majoré", () => {
    const l = heros();
    const [a, b] = fabriquerEnnemis("combat_2");
    a.resistances = {}; b.resistances = {};
    a.stats = { ...a.stats, agilite: 0 }; b.stats = { ...b.stats, agilite: 0 };
    const cs = [l, a, b];
    const sansEscalade: Spell = { ...sortEscalade, id: "test_sans", bonusParRelanceCeTour: undefined };

    const reference = degatsDe(l, sansEscalade, a, cs);
    a.pvActuels = a.pvMax;
    l.lancersCeTour = {};
    const premier = degatsDe(l, sortEscalade, a, cs);

    expect(premier).toBe(reference); // ×1,0 — le compteur vaut déjà 1 à ce stade
  });

  it("la deuxième cible du tour prend +20 %, la troisième +40 %", () => {
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs = [l, ...ennemis];
    // les trois ennemis restent à leurs positions de fabrication : `lancerSort`
    // n'applique lui-même AUCUN filtre de ligne (toute la règle de ligne vit dans
    // `ciblesValides`, jamais consultée ici) — la position n'a donc aucune
    // incidence sur ce test, seul le compteur `lancersCeTour` en a une.
    ennemis.forEach((e, i) => (e.position = i));

    const d1 = degatsDe(l, sortEscalade, ennemis[0], cs);
    const d2 = degatsDe(l, sortEscalade, ennemis[1], cs);
    const d3 = degatsDe(l, sortEscalade, ennemis[2], cs);

    expect(d2).toBe(Math.round(d1 * 1.2));
    expect(d3).toBe(Math.round(d1 * 1.4));
  });

  it("le compteur repart de zéro au tour suivant", () => {
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_2");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs = [l, ...ennemis];

    const d1 = degatsDe(l, sortEscalade, ennemis[0], cs);
    const d2 = degatsDe(l, sortEscalade, ennemis[1], cs); // capturé et assérté : sans ça,
    // un moteur qui neutraliserait totalement l'escalade (multRelance figé à 1)
    // laisserait ce test passer quand même, puisque `apres` resterait égal à `d1`.
    expect(d2).toBe(Math.round(d1 * 1.2));

    reinitialiserLancersTour(l); // le VRAI chemin de remise à zéro de début de tour,
    // plutôt qu'une imitation manuelle de `lancersCeTour = {}`.
    const apres = degatsDe(l, sortEscalade, ennemis[0], cs);

    expect(apres).toBe(d1);
  });

  it("sans AUCUNE limite de lancers, l'escalade fonctionne quand même", () => {
    // L'inertie découverte en écrivant les tests ci-dessus : `lancersCeTour` n'était
    // alimenté que par `maxParTour`/`maxParCibleParTour`. Un sort synthétique qui NE
    // porte NI l'un NI l'autre doit désormais escalader tout autant.
    const sortSansLimite: Spell = {
      ...SORTS.morsure, id: "test_escalade_sans_limite", bonusParRelanceCeTour: 0.2,
    };
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_2");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs = [l, ...ennemis];

    const d1 = degatsDe(l, sortSansLimite, ennemis[0], cs);
    const d2 = degatsDe(l, sortSansLimite, ennemis[1], cs);

    expect(d2).toBe(Math.round(d1 * 1.2));
  });

  it("aucune double incrémentation quand le sort porte AUSSI une limite de lancers", () => {
    // Le futur Pugilat porte `maxParCibleParTour: 1` ET `bonusParRelanceCeTour`.
    // Si les deux gardes incrémentaient chacune `lancersCeTour[sort.id]`, le premier
    // lancer démarrerait déjà à +20 % au lieu de ×1,0.
    const l = heros();
    const [a, b] = fabriquerEnnemis("combat_2");
    a.resistances = {}; b.resistances = {};
    a.stats = { ...a.stats, agilite: 0 }; b.stats = { ...b.stats, agilite: 0 };
    a.pvMax = 9999; a.pvActuels = 9999; b.pvMax = 9999; b.pvActuels = 9999;
    const cs = [l, a, b];
    const sansEscalade: Spell = { ...sortEscalade, id: "test_sans_double", bonusParRelanceCeTour: undefined };

    const reference = degatsDe(l, sansEscalade, a, cs);
    a.pvActuels = a.pvMax;
    l.lancersCeTour = {};
    const premier = degatsDe(l, sortEscalade, a, cs); // sortEscalade porte les deux champs

    expect(premier).toBe(reference); // ×1,0, pas ×1,2
  });
});

describe("bonusParLancerCombat — escalade sur tout le combat (Colère de Iop)", () => {
  const sortColere: Spell = { ...SORTS.morsure, id: "test_escalade_combat", bonusParLancerCombat: 0.5 };

  it("100 % puis 150 % puis 200 %", () => {
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs = [l, ...ennemis];

    const d1 = degatsDe(l, sortColere, ennemis[0], cs);
    const d2 = degatsDe(l, sortColere, ennemis[1], cs);
    const d3 = degatsDe(l, sortColere, ennemis[2], cs);

    expect(d2).toBe(Math.round(d1 * 1.5));
    expect(d3).toBe(Math.round(d1 * 2.0));
  });

  it("le compteur SURVIT au changement de tour", () => {
    // remettre `lancersCeTour = {}` entre deux lancers ne doit RIEN changer :
    // c'est ce qui distingue cette primitive de la précédente.
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_2");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs = [l, ...ennemis];

    const d1 = degatsDe(l, sortColere, ennemis[0], cs);
    l.lancersCeTour = {}; // simule le début du tour suivant
    const d2 = degatsDe(l, sortColere, ennemis[1], cs);

    expect(d2).toBe(Math.round(d1 * 1.5));
  });

  it("le compteur ne fuit pas d'un combat à l'autre", () => {
    // deux combattants fabriqués séparément par fabriquerEquipe() : le second
    // doit frapper à 100 % même après que le premier a empilé ses lancers.
    const l1 = heros();
    const ennemis1 = fabriquerEnnemis("combat_2");
    for (const e of ennemis1) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs1 = [l1, ...ennemis1];
    degatsDe(l1, sortColere, ennemis1[0], cs1);
    degatsDe(l1, sortColere, ennemis1[1], cs1);

    const l2 = heros(); // combattant neuf, `lancersCombat` jamais initialisé
    const ennemis2 = fabriquerEnnemis("combat_2");
    for (const e of ennemis2) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs2 = [l2, ...ennemis2];
    const sansEscalade: Spell = { ...sortColere, id: "test_sans_combat", bonusParLancerCombat: undefined };
    const reference = degatsDe(l2, sansEscalade, ennemis2[0], cs2);
    ennemis2[0].pvActuels = ennemis2[0].pvMax;
    const premier = degatsDe(l2, sortColere, ennemis2[0], cs2);

    expect(premier).toBe(reference);
  });
});

describe("ratioLigne — éclaboussure sur le reste de la rangée (Pugilat)", () => {
  const sortEclabousse: Spell = { ...SORTS.morsure, id: "test_ratio_ligne", ratioLigne: 0.5 };

  it("la cible principale encaisse plein, ses voisins de rangée la moitié", () => {
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    ennemis.forEach((e, i) => (e.position = i)); // tous en rangée avant
    const cs = [l, ...ennemis];

    const sansEclabousse: Spell = { ...sortEclabousse, id: "test_sans_ratio", ratioLigne: undefined };
    const reference = degatsDe(l, sansEclabousse, ennemis[0], cs);
    for (const e of ennemis) e.pvActuels = e.pvMax;

    lancerSort(l, sortEclabousse, ennemis[0].ref, cs, ctx());
    const dPrincipal = ennemis[0].pvMax - ennemis[0].pvActuels;
    const dVoisin1 = ennemis[1].pvMax - ennemis[1].pvActuels;
    const dVoisin2 = ennemis[2].pvMax - ennemis[2].pvActuels;

    expect(dPrincipal).toBe(reference);
    expect(dVoisin1).toBe(Math.round(reference * 0.5));
    expect(dVoisin2).toBe(Math.round(reference * 0.5));
  });

  it("l'autre rangée n'est pas touchée", () => {
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    // ennemis[0] en avant (cible), ennemis[1] en avant (voisin), ennemis[2] en arrière
    ennemis[0].position = 0;
    ennemis[1].position = 1;
    ennemis[2].position = 4;
    const cs = [l, ...ennemis];

    lancerSort(l, sortEclabousse, ennemis[0].ref, cs, ctx());

    expect(ennemis[2].pvActuels).toBe(ennemis[2].pvMax); // rangée arrière intacte
    expect(ennemis[1].pvActuels).toBeLessThan(ennemis[1].pvMax); // voisine avant touchée
  });

  it("l'escalade de relance majore AUSSI l'éclaboussure", () => {
    // décision d'Adam : le bonus porte sur tout le sort, pas seulement la cible.
    // Combiner ratioLigne ET bonusParRelanceCeTour sur un même sort synthétique.
    // maxParCibleParTour: 1, comme le Pugilat réel — la relance porte sur une AUTRE
    // cible du même tour (lancersCeTour n'est alimenté que si le sort porte l'une des
    // deux limites `maxParTour`/`maxParCibleParTour`).
    const sortCombine: Spell = {
      ...SORTS.morsure, id: "test_ratio_et_relance",
      maxParCibleParTour: 1, ratioLigne: 0.5, bonusParRelanceCeTour: 0.2,
    };
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    ennemis.forEach((e, i) => (e.position = i)); // tous en rangée avant
    const cs = [l, ...ennemis];

    // Premier lancer sur ennemis[0], non majoré : capture le ratio de base sur la
    // cible principale et sur son voisin éclaboussé (ennemis[2], laissé de côté du
    // second lancer pour rester un témoin propre).
    lancerSort(l, sortCombine, ennemis[0].ref, cs, ctx());
    const dPrincipal1 = ennemis[0].pvMax - ennemis[0].pvActuels;
    const dVoisin1 = ennemis[2].pvMax - ennemis[2].pvActuels;

    // Deuxième lancer du tour, sur une AUTRE cible (ennemis[1] — ennemis[0] est déjà
    // à sa limite `maxParCibleParTour`) : c'est la RELANCE (+20 %), et elle majore
    // aussi bien la cible principale que son éclaboussure.
    ennemis.forEach((e) => (e.pvActuels = e.pvMax));
    lancerSort(l, sortCombine, ennemis[1].ref, cs, ctx());
    const dPrincipal2 = ennemis[1].pvMax - ennemis[1].pvActuels;
    const dVoisin2 = ennemis[2].pvMax - ennemis[2].pvActuels; // éclaboussé par CE lancer-ci

    expect(dPrincipal2).toBe(Math.round(dPrincipal1 * 1.2));
    expect(dVoisin2).toBe(Math.round(dVoisin1 * 1.2));
  });
});
