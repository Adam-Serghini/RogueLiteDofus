// =============================================================================
//  iop-moteur.test.ts — Les primitives introduites par le rework du Iop, sur des
//  sorts SYNTHÉTIQUES : ces tests doivent survivre à un rééquilibrage du kit réel.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, reinitialiserLancersTour, effetsDebutTour, runCombat, multiplicateurEscaladeSort, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import type { Action, Combatant, Spell } from "./types";

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

  it("le journal distingue la cible principale de l'éclaboussure", () => {
    // Avant ce correctif, les trois lignes de journal étaient strictement
    // identiques (même libellé de sort) — le joueur devait déduire la
    // mécanique en comparant les nombres. On suit le patron déjà en place
    // pour la Flèche enflammée (Cra) : le libellé de l'éclaboussure porte
    // le suffixe « (éclaboussure) ».
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    ennemis.forEach((e, i) => (e.position = i)); // tous en rangée avant
    const cs = [l, ...ennemis];
    const lignes: string[] = [];

    lancerSort(l, sortEclabousse, ennemis[0].ref, cs, ctx({ log: (msg: string) => lignes.push(msg) }));

    const lignesDegats = lignes.filter((m) => m.includes(sortEclabousse.nom));
    expect(lignesDegats).toHaveLength(3); // 1 cible principale + 2 voisins éclaboussés
    const principales = lignesDegats.filter((m) => !m.includes("(éclaboussure)"));
    const eclaboussees = lignesDegats.filter((m) => m.includes("(éclaboussure)"));
    expect(principales).toHaveLength(1);
    expect(eclaboussees).toHaveLength(2);
  });
});

// =============================================================================
//  Tâche 2 : bouclier à portée (Endurance / Vertu) et PA immédiats (Précipitation)
// =============================================================================

/** Équipe de 4 héros distincts (refs distinctes de fabrique), agilité nulle et PV
 *  ronds pour des pourcentages lisibles. Permet de placer plusieurs alliés sur des
 *  rangées différentes — chose que `heros()` seul (un unique combattant) ne permet pas. */
const equipeDe4 = (): Combatant[] => {
  const eq = fabriquerEquipe();
  for (const c of eq) {
    c.stats = { ...c.stats, agilite: 0 };
    c.pvMax = 500;
    c.pvActuels = 500;
  }
  return eq;
};

describe("bouclierPortee — bouclier en % sur une portée, avec durée", () => {
  it('portee "soi" depuis un sort de DÉGÂTS : le lanceur se boucliere (Endurance)', () => {
    const l = heros();
    l.pvMax = 500; l.pvActuels = 500;
    const [a] = fabriquerEnnemis("combat_1");
    a.resistances = {}; a.stats = { ...a.stats, agilite: 0 };
    const cs = [l, a];
    const sortEndurance: Spell = {
      ...SORTS.morsure, id: "test_bouclier_soi",
      bouclierPortee: { portee: "soi", pct: 0.08, tours: 1 },
    };

    lancerSort(l, sortEndurance, a.ref, cs, ctx());

    expect(l.bouclier).toBe(Math.round(500 * 0.08)); // 40
    expect(l.boucliersTemporaires).toEqual([{ montant: 40, tours: 1 }]);
  });

  it("deux lancers dans le tour CUMULENT leurs boucliers", () => {
    // décision d'Adam : 2 × pct, pas un rafraîchissement.
    const l = heros();
    l.pvMax = 500; l.pvActuels = 500;
    const [a] = fabriquerEnnemis("combat_1");
    a.resistances = {}; a.stats = { ...a.stats, agilite: 0 }; a.pvMax = 9999; a.pvActuels = 9999;
    const cs = [l, a];
    const sortEndurance: Spell = {
      ...SORTS.morsure, id: "test_bouclier_cumul",
      bouclierPortee: { portee: "soi", pct: 0.08, tours: 1 },
    };

    lancerSort(l, sortEndurance, a.ref, cs, ctx());
    lancerSort(l, sortEndurance, a.ref, cs, ctx());

    expect(l.bouclier).toBe(2 * Math.round(500 * 0.08)); // 80, pas 40
    expect(l.boucliersTemporaires).toEqual([
      { montant: 40, tours: 1 },
      { montant: 40, tours: 1 },
    ]);
  });

  it("côté DÉGÂTS : ne s'applique qu'UNE FOIS par lancement, même si le sort touche plusieurs cibles (zoneLigne)", () => {
    // Revue : un relecteur a déplacé la résolution de bouclierPortee À L'INTÉRIEUR de
    // la boucle sur les cibles touchées, et les 912 tests d'alors restaient verts —
    // rien ne tendait la propriété « une fois par lancer, pas une fois par cible ».
    // Ce test la tend réellement avec 3 cibles dans la même zoneLigne.
    const l = heros();
    l.pvMax = 500; l.pvActuels = 500;
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; }
    ennemis.forEach((e, i) => (e.position = i)); // les 3 en rangée avant : zoneLigne les touche TOUTES
    const cs = [l, ...ennemis];
    const sortEnduranceZone: Spell = {
      ...SORTS.morsure, id: "test_bouclier_zone", zoneLigne: true,
      bouclierPortee: { portee: "soi", pct: 0.08, tours: 1 },
    };

    lancerSort(l, sortEnduranceZone, ennemis[0].ref, cs, ctx());

    // 3 cibles touchées par CE lancer : un moteur qui résoudrait le bouclier par
    // cible plutôt que par lancement le donnerait 3× (120), pas 1× (40).
    expect(l.bouclier).toBe(Math.round(500 * 0.08)); // 40, pas 120
    expect(l.boucliersTemporaires).toEqual([{ montant: 40, tours: 1 }]); // UNE seule entrée
  });

  it("côté SOUTIEN : ne s'applique qu'UNE FOIS par lancement, même si le sort vise allie_tous (3 alliés)", () => {
    // Même propriété que le test précédent, sur le chemin de soutien (Vertu peut être
    // repris en allie_tous demain — la garantie doit tenir indépendamment du kit réel).
    const [l, allie2, allie3] = equipeDe4();
    l.position = 0; allie2.position = 1; allie3.position = 2; // 3 alliés, même rangée
    const cs = [l, allie2, allie3];
    const sortVertuTous: Spell = {
      ...SORTS.morsure, id: "test_vertu_allie_tous", type: "buff", cible: "allie_tous",
      baseMin: 0, baseMax: 0, coutPA: 3,
      // portée "soi" volontaire : seul le LANCEUR doit en profiter, ce qui rend une
      // triplication (une par cible du allie_tous) immédiatement visible sur lui.
      bouclierPortee: { portee: "soi", pct: 0.15, tours: 2 },
    };

    lancerSort(l, sortVertuTous, l.ref, cs, ctx());

    expect(l.bouclier).toBe(Math.round(500 * 0.15)); // 75, pas 225 (3×)
    expect(l.boucliersTemporaires).toEqual([{ montant: 75, tours: 2 }]); // UNE seule entrée
    expect(allie2.bouclier).toBe(0); // portée "soi" : jamais les alliés visés par le sort
    expect(allie3.bouclier).toBe(0);
  });

  it("sans `tours`, le bouclier est PERMANENT : aucune inscription à expirer", () => {
    const l = heros();
    l.pvMax = 500; l.pvActuels = 500;
    const [a] = fabriquerEnnemis("combat_1");
    a.resistances = {}; a.stats = { ...a.stats, agilite: 0 };
    const cs = [l, a];
    const sortEnduranceSansDuree: Spell = {
      ...SORTS.morsure, id: "test_bouclier_permanent",
      bouclierPortee: { portee: "soi", pct: 0.08 }, // pas de `tours`
    };

    lancerSort(l, sortEnduranceSansDuree, a.ref, cs, ctx());
    expect(l.bouclier).toBe(40);
    expect(l.boucliersTemporaires ?? []).toEqual([]); // rien n'est inscrit : rien à expirer

    // Plusieurs tours du porteur passent : sans inscription dans boucliersTemporaires,
    // effetsDebutTour n'a rien à décompter ni à retirer.
    effetsDebutTour(l, cs, ctx());
    effetsDebutTour(l, cs, ctx());
    effetsDebutTour(l, cs, ctx());
    expect(l.bouclier).toBe(40);
  });

  it('portee "rangee_lanceur" depuis un sort de SOUTIEN : toute la rangée, LANCEUR COMPRIS (Vertu)', () => {
    const [l, allieMemeRangee, allieAutreRangee] = equipeDe4();
    l.position = 0; // rangée avant
    allieMemeRangee.position = 1; // rangée avant, même rangée que le lanceur
    allieAutreRangee.position = 4; // rangée arrière
    const cs = [l, allieMemeRangee, allieAutreRangee];
    const sortVertu: Spell = {
      ...SORTS.morsure, id: "test_vertu", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, coutPA: 3,
      bouclierPortee: { portee: "rangee_lanceur", pct: 0.15, tours: 2 },
    };

    lancerSort(l, sortVertu, l.ref, cs, ctx());

    expect(l.bouclier).toBe(Math.round(500 * 0.15)); // le lanceur EST inclus
    expect(allieMemeRangee.bouclier).toBe(Math.round(500 * 0.15));
    expect(allieAutreRangee.bouclier).toBe(0); // autre rangée : rien
  });

  it("n'atteint ni l'autre rangée, ni les invocations", () => {
    // une invocation alliée posée dans la rangée du lanceur ne doit rien recevoir :
    // allies() les exclut depuis le rework du Féca.
    const [l, invocation, autreRangee] = equipeDe4();
    l.position = 0;
    invocation.position = 1; // même rangée que le lanceur
    invocation.estInvocation = true;
    autreRangee.position = 4;
    const cs = [l, invocation, autreRangee];
    const sortVertu: Spell = {
      ...SORTS.morsure, id: "test_vertu_invocation", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, coutPA: 3,
      bouclierPortee: { portee: "rangee_lanceur", pct: 0.15, tours: 2 },
    };

    lancerSort(l, sortVertu, l.ref, cs, ctx());

    expect(l.bouclier).toBe(Math.round(500 * 0.15));
    expect(invocation.bouclier).toBe(0); // exclue malgré sa position dans la rangée
    expect(autreRangee.bouclier).toBe(0);
  });

  it("expire après `tours` sans jamais reprendre plus qu'il n'a donné", () => {
    const l = heros();
    l.pvMax = 500; l.pvActuels = 500;
    const [a] = fabriquerEnnemis("combat_1");
    a.resistances = {}; a.stats = { ...a.stats, agilite: 0 };
    const cs = [l, a];
    const sortEndurance: Spell = {
      ...SORTS.morsure, id: "test_bouclier_expire",
      bouclierPortee: { portee: "soi", pct: 0.08, tours: 1 },
    };

    lancerSort(l, sortEndurance, a.ref, cs, ctx());
    expect(l.bouclier).toBe(40);
    expect(l.boucliersTemporaires).toEqual([{ montant: 40, tours: 1 }]);

    // Le bouclier a ABSORBÉ des dégâts entre-temps : il n'en reste que 5.
    l.bouclier = 5;

    // Un tour du porteur : expiration (tours: 1 → 0). min(montant=40, restant=5) = 5.
    effetsDebutTour(l, [l], ctx());
    expect(l.bouclier).toBe(0);
    expect(l.boucliersTemporaires).toEqual([]);
  });

  it("la friction bloque le bouclier", () => {
    const l = heros();
    l.pvMax = 500; l.pvActuels = 500;
    l.effets.push({ stat: "friction", valeur: 1, toursRestants: 3 });
    const [a] = fabriquerEnnemis("combat_1");
    a.resistances = {}; a.stats = { ...a.stats, agilite: 0 };
    const cs = [l, a];
    const sortEndurance: Spell = {
      ...SORTS.morsure, id: "test_bouclier_friction",
      bouclierPortee: { portee: "soi", pct: 0.08, tours: 1 },
    };

    lancerSort(l, sortEndurance, a.ref, cs, ctx());

    expect(l.bouclier).toBe(0);
    expect(l.boucliersTemporaires ?? []).toEqual([]);
  });
});

describe("paImmediat — des PA pour le tour EN COURS (Précipitation)", () => {
  it("crédite paActuels tout de suite, et non paBonusNextTurn", () => {
    const l = heros();
    l.paActuels = 6;
    const sortPrecipitation: Spell = {
      ...SORTS.morsure, id: "test_precipitation", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, coutPA: 0, paImmediat: 3,
    };

    lancerSort(l, sortPrecipitation, l.ref, [l], ctx());

    expect(l.paActuels).toBe(9); // 6 + 3, disponible MAINTENANT
    expect(l.paBonusNextTurn).toBe(0); // pas au tour suivant
  });

  it("les PA gagnés sont RÉELLEMENT dépensables dans le tour", async () => {
    // Test central : il ne suffit PAS de lire paActuels. On fait jouer un vrai tour
    // via runCombat avec un controller scripté qui lance Précipitation puis un sort
    // que les 6 PA de départ ne permettaient PAS (8 PA) — la seule preuve que la
    // boucle de tour relit paActuels après le retour de lancerSort au lieu d'en
    // garder une copie périmée.
    const l = heros();
    l.initiative = 100;
    const [ennemi] = fabriquerEnnemis("combat_1");
    ennemi.initiative = 1;
    ennemi.resistances = {};
    ennemi.pvMax = 1; ennemi.pvActuels = 1; // one-shot garanti par le sort coûteux
    const cs = [l, ennemi];

    const sortPrecipitation: Spell = {
      ...SORTS.morsure, id: "test_precipitation_integration", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, coutPA: 0, paImmediat: 5,
    };
    // 8 PA > paMax (6) : injouable sans le crédit de Précipitation.
    const sortCher: Spell = {
      ...SORTS.morsure, id: "test_sort_cher", coutPA: 8, baseMin: 999, baseMax: 999, scaling: 0,
    };
    expect(l.paMax).toBeLessThan(sortCher.coutPA); // témoin : le sort est bien hors de portée au départ

    let appel = 0;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref !== l.ref) return null;
      appel += 1;
      if (appel === 1) return { sort: sortPrecipitation, cibleRef: l.ref };
      if (appel === 2) return { sort: sortCher, cibleRef: ennemi.ref };
      return null;
    };
    const controllerEnnemi = (): Action | null => null;

    await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: controllerEnnemi },
      rng: rngMax,
    });

    // Le sort cher a bien porté : SEULE preuve possible que la boucle de tour a relu
    // paActuels après Précipitation — un moteur qui garderait une copie périmée (6 PA,
    // insuffisants pour les 8 du sort cher) aurait refusé l'action, l'ennemi survivrait
    // et `appel` s'arrêterait à 1. `l.paActuels` n'est PAS vérifié ici : la fin de tour
    // remet toujours paActuels à paMax (recharge normale), ce qui écraserait la preuve
    // intermédiaire sans rien dire sur la dépensabilité réelle des PA immédiats.
    expect(appel).toBe(2); // les deux actions ont bien été proposées et jouées
    expect(ennemi.pvActuels).toBe(0);
  });

  it("sont PERDUS à la fin du tour : la recharge normale de runCombat les efface", async () => {
    // Garanti par du code préexistant (la recharge `acteur.paActuels = acteur.paMax`
    // en fin de tour, inconditionnelle), mais rien ne le figeait pour ce champ précis.
    const l = heros();
    l.initiative = 100;
    const [ennemi] = fabriquerEnnemis("combat_1");
    ennemi.initiative = 1;
    ennemi.resistances = {};
    ennemi.paMax = 0; ennemi.paActuels = 0; // ne joue jamais, ne meurt jamais : le round 2 arrive
    const cs = [l, ennemi];

    const sortPrecipitation: Spell = {
      ...SORTS.morsure, id: "test_precipitation_fin_tour", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, coutPA: 0, paImmediat: 3,
    };
    const sortTue: Spell = {
      ...SORTS.morsure, id: "test_tue_fin_tour", coutPA: 0, baseMin: 999, baseMax: 999, scaling: 0,
    };

    let appel = 0;
    let paAuDebutRound2: number | null = null;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      appel += 1;
      if (appel === 1) return { sort: sortPrecipitation, cibleRef: l.ref }; // round 1, action 1
      if (appel === 2) return null; // round 1 : fin de tour volontaire, PA immédiat non dépensé
      if (appel === 3) {
        paAuDebutRound2 = acteur.paActuels; // round 2 : capturé AVANT toute nouvelle action
        return { sort: sortTue, cibleRef: ennemi.ref }; // achève l'ennemi, borne le test
      }
      return null;
    };
    const controllerEnnemi = (): Action | null => null;

    await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: controllerEnnemi },
      rng: rngMax,
    });

    expect(paAuDebutRound2).toBe(l.paMax); // 6, pas 9 : le crédit ne survit pas à la fin du tour
    expect(ennemi.pvActuels).toBe(0); // témoin : le combat s'est bien terminé au round 2
  });

  it("le gain peut dépasser le maximum de PA du combattant", () => {
    const l = heros();
    l.paActuels = l.paMax;
    const sortPrecipitation: Spell = {
      ...SORTS.morsure, id: "test_precipitation_depasse", type: "buff", cible: "soi",
      baseMin: 0, baseMax: 0, coutPA: 0, paImmediat: 10,
    };

    lancerSort(l, sortPrecipitation, l.ref, [l], ctx());

    expect(l.paActuels).toBe(l.paMax + 10); // voulu : aucun plafonnement
  });
});

describe("multiplicateurEscaladeSort — fonction partagée moteur/infobulle", () => {
  const sortRelance: Spell = { ...SORTS.morsure, id: "test_mult_relance", bonusParRelanceCeTour: 0.2 };
  const sortCombat: Spell = { ...SORTS.morsure, id: "test_mult_combat", bonusParLancerCombat: 0.5 };
  const sortSansEscalade: Spell = { ...SORTS.morsure, id: "test_mult_neutre" };

  it("vaut 1 pour un lanceur null (infobulle hors combat)", () => {
    expect(multiplicateurEscaladeSort(sortCombat, null)).toBe(1);
  });

  it("vaut 1 pour un sort sans champ d'escalade, quel que soit le lanceur", () => {
    const l = heros();
    l.lancersCeTour = { [sortSansEscalade.id]: 5 };
    l.lancersCombat = { [sortSansEscalade.id]: 5 };
    expect(multiplicateurEscaladeSort(sortSansEscalade, l)).toBe(1);
  });

  it("lit le compteur AVANT incrémentation : 0 lancer connu → ×1,0", () => {
    const l = heros();
    expect(multiplicateurEscaladeSort(sortRelance, l)).toBe(1);
    expect(multiplicateurEscaladeSort(sortCombat, l)).toBe(1);
  });

  it("bonusParRelanceCeTour : reflète le compteur `lancersCeTour` déjà posé", () => {
    const l = heros();
    l.lancersCeTour = { [sortRelance.id]: 2 }; // 2 lancers déjà comptés ce tour
    expect(multiplicateurEscaladeSort(sortRelance, l)).toBeCloseTo(1 + 0.2 * 2, 10);
  });

  it("bonusParLancerCombat : reflète le compteur `lancersCombat`, SANS plafond", () => {
    const l = heros();
    l.lancersCombat = { [sortCombat.id]: 4 }; // 4 lancers déjà comptés dans le combat
    expect(multiplicateurEscaladeSort(sortCombat, l)).toBeCloseTo(1 + 0.5 * 4, 10);
  });

  it("combine les deux escalades quand un même sort porte les deux champs", () => {
    const sortDouble: Spell = { ...SORTS.morsure, id: "test_mult_double", bonusParRelanceCeTour: 0.2, bonusParLancerCombat: 0.5 };
    const l = heros();
    l.lancersCeTour = { [sortDouble.id]: 1 };
    l.lancersCombat = { [sortDouble.id]: 2 };
    const attendu = (1 + 0.2 * 1) * (1 + 0.5 * 2);
    expect(multiplicateurEscaladeSort(sortDouble, l)).toBeCloseTo(attendu, 10);
  });

  it("preuve par exécution : la valeur rendue AVANT un lancer prédit exactement les dégâts de ce lancer", () => {
    // sabotage réel du bug rapporté : sans cette fonction, l'infobulle affichait
    // toujours le jet de base (×1,0) alors que le moteur, lui, escalade sans fin.
    const l = heros();
    const ennemis = fabriquerEnnemis("combat_3");
    for (const e of ennemis) { e.resistances = {}; e.stats = { ...e.stats, agilite: 0 }; e.pvMax = 9999; e.pvActuels = 9999; }
    const cs = [l, ...ennemis];

    const previsionAvant2eLancer = multiplicateurEscaladeSort(sortCombat, l); // avant tout lancer
    const d1 = degatsDe(l, sortCombat, ennemis[0], cs);
    const previsionAvant3eLancer = multiplicateurEscaladeSort(sortCombat, l); // après 1 lancer
    const d2 = degatsDe(l, sortCombat, ennemis[1], cs);

    expect(previsionAvant2eLancer).toBeCloseTo(1, 10); // 1er lancer : pas de majoration
    expect(previsionAvant3eLancer).toBeCloseTo(1.5, 10); // annonce le ×1,5 du 2e lancer
    expect(d2).toBe(Math.round(d1 * 1.5)); // et le moteur livre exactement ce ×1,5
  });
});
