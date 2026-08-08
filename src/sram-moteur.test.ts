// =============================================================================
//  sram-moteur.test.ts — Les primitives introduites par le rework du Sram, sur des
//  sorts SYNTHÉTIQUES : ces tests doivent survivre à un rééquilibrage du kit réel.
//  Tâche 1 : le piège — entité, pose, déclenchement, Chausse-Trappe.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, PIEGES_MAX, CHAUSSE_TRAPPE_MAX, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import type { Combatant, Piege, Spell } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet tiré au max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});
const heros = (): Combatant => {
  const c = fabriquerEquipe()[0];
  c.stats = { ...c.stats, agilite: 0 }; // esquive/crit déterministes
  return c;
};
/** Un second héros distinct (ref différente), pour les scénarios à deux poseurs
 *  ou à un poseur + un allié qui déclenche. */
const heros2 = (): Combatant => {
  const c = fabriquerEquipe()[1];
  c.stats = { ...c.stats, agilite: 0 };
  return c;
};

/** Ennemis prêts pour des tests déterministes : résistances nulles, agilité nulle
 *  (pas d'esquive), PV confortables pour encaisser plusieurs coups sans mourir. */
const ennemisProbes = (n: 1 | 2 | 3 | 4 | 5): Combatant[] => {
  const key = n === 1 ? "combat_1" : n === 2 ? "combat_2" : n === 3 ? "combat_3" : n === 4 ? "combat_elite" : "abr_elite";
  const es = fabriquerEnnemis(key).slice(0, n);
  for (const e of es) {
    e.resistances = {};
    e.stats = { ...e.stats, agilite: 0 };
    e.pvMax = 9999;
    e.pvActuels = 9999;
  }
  return es;
};

/** Sort synthétique qui pose un piège (aucun dégât au lancer). */
const sortPosePiege = (id: string, extra: Partial<Spell> = {}): Spell => ({
  ...SORTS.morsure, id, posePiege: true, ...extra,
});
/** Sort synthétique qui déplace la cible (aucun dégât propre : baseMax à 0 pour
 *  isoler le déplacement — comme le fait déjà `sauteJetDegats` pour Pendule/Roublabot). */
const sortDeplace = (id: string, mode: "toggle" | "arriere"): Spell => ({
  ...SORTS.morsure, id, baseMin: 0, baseMax: 0, scaling: 0, deplaceCible: mode,
});

describe("le piège n'occupe aucune case", () => {
  it("quatre pièges sur une rangée n'empêchent pas un déplacement vers elle", () => {
    // LE test fondateur : si un piège prenait une case, `caseLibreRangeeOpposee`
    // renverrait null pour la rangée arrière (3 occupants réels + 4 « pièges » s'ils
    // comptaient comme des occupants, largement plus que les 4 cases disponibles),
    // deplacerCible échouerait EN SILENCE et la mécanique entière serait sa propre
    // négation.
    const poseur = heros();
    const [avancee, ar1, ar2, ar3] = ennemisProbes(4);
    avancee.position = 0; // sera déplacé
    ar1.position = 4; ar2.position = 5; ar3.position = 6; // rangée arrière : 3/4 cases prises
    const cs = [poseur, avancee, ar1, ar2, ar3];

    // 4 pièges FICTIFS (posés à la main, sans passer par lancerSort) qui surveillent
    // la rangée arrière ennemie — le plafond PIEGES_MAX lui-même n'est pas le sujet
    // de ce test, seulement le fait qu'ils ne bloquent aucune case.
    poseur.pieges = Array.from({ length: 4 }, (_, i): Piege => (
      { sortId: `test_piege_case_${i}`, camp: "ennemi", avant: false }
    ));

    const sort = sortDeplace("test_deplace_case_libre", "toggle");
    lancerSort(poseur, sort, avancee.ref, cs, ctx());

    expect(avancee.position).toBe(7); // la seule case réellement libre de la rangée
  });
});

describe("déclenchement", () => {
  it("un ennemi déplacé sur la rangée surveillée subit le piège", () => {
    const poseur = heros();
    const [victime, ar1, ar2] = ennemisProbes(3);
    victime.position = 0; // avant, sera déplacé vers l'arrière
    ar1.position = 4; ar2.position = 5; // 2/4 cases prises : une case libre à 6 ou 7
    const cs = [poseur, victime, ar1, ar2];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    const avantPV = victime.pvActuels;
    lancerSort(poseur, sortDeplace("test_declenche_1", "arriere"), victime.ref, cs, ctx());

    expect(victime.position).toBeGreaterThanOrEqual(4); // effectivement déplacée
    expect(victime.pvActuels).toBeLessThan(avantPV); // le piège a bien frappé
    expect(poseur.pieges).toHaveLength(0); // le piège est consommé
    expect(poseur.chausseTrappe).toBe(1); // et a crédité un cumul au poseur
  });

  it("un ennemi déplacé AILLEURS ne subit rien, et le piège reste posé", () => {
    const poseur = heros();
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0; // avant, sera déplacée vers l'arrière (ligne surveillée : AVANT)
    ar1.position = 4;
    const cs = [poseur, victime, ar1];
    // Le piège surveille la rangée AVANT ennemie — la victime, elle, part vers
    // l'ARRIÈRE : aucun match de rangée, donc aucun déclenchement.
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: true }];

    const avantPV = victime.pvActuels;
    lancerSort(poseur, sortDeplace("test_declenche_ailleurs", "arriere"), victime.ref, cs, ctx());

    expect(victime.position).toBeGreaterThanOrEqual(4); // le déplacement, lui, a bien eu lieu
    expect(victime.pvActuels).toBe(avantPV); // mais aucun dégât
    expect(poseur.pieges).toHaveLength(1); // le piège attend toujours
    expect(poseur.chausseTrappe ?? 0).toBe(0);
  });

  it("UN SEUL piège part par déplacement, même avec trois en attente", () => {
    const poseur = heros();
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0;
    ar1.position = 4;
    const cs = [poseur, victime, ar1];
    poseur.pieges = [
      { sortId: "morsure", camp: "ennemi", avant: false },
      { sortId: "morsure", camp: "ennemi", avant: false },
      { sortId: "morsure", camp: "ennemi", avant: false },
    ];

    lancerSort(poseur, sortDeplace("test_un_seul", "arriere"), victime.ref, cs, ctx());

    expect(poseur.pieges).toHaveLength(2); // un SEUL retiré, pas les trois
    expect(poseur.chausseTrappe).toBe(1); // un SEUL cumul crédité
  });

  it("le plus ancien part le premier", () => {
    // Un piège dont le sort est FAIBLE (« morsure », 12-18@0.4), posé EN PREMIER,
    // doit se déclencher avant un piège dont le sort est FORT (« charge »,
    // 26-36@0.72), posé ensuite — la seule façon d'observer l'ordre FIFO depuis
    // l'extérieur est de comparer les dégâts de deux déclenchements successifs sur
    // la même rangée. `piege.sortId` est résolu via `SORTS[...]` en jeu réel : on
    // s'appuie donc ici sur deux sorts RÉELS du contenu (pas de synthétique), le
    // seul moyen de faire fonctionner cette résolution sans muter le registre
    // global `SORTS` depuis un test. Un seul poseur ici : « tous poseurs
    // confondus » suppose un SEUL Sram par équipe (recrutement une classe par
    // personnage) — voir le commentaire de `declencherPiege` dans combat.ts.
    const poseur = heros();
    const [v1, v2, ar1] = ennemisProbes(3);
    v1.position = 0; v2.position = 1; // deux cibles avant, déplacées l'une après l'autre
    ar1.position = 4; // une seule case arrière prise : 3 libres, largement assez pour les deux
    const cs = [poseur, v1, v2, ar1];
    poseur.pieges = [
      { sortId: "morsure", camp: "ennemi", avant: false }, // faible, posé en premier
      { sortId: "charge", camp: "ennemi", avant: false }, // fort, posé en second
    ];

    const pv1Avant = v1.pvActuels;
    lancerSort(poseur, sortDeplace("test_ordre_1", "arriere"), v1.ref, cs, ctx());
    const degats1 = pv1Avant - v1.pvActuels;

    const pv2Avant = v2.pvActuels;
    lancerSort(poseur, sortDeplace("test_ordre_2", "arriere"), v2.ref, cs, ctx());
    const degats2 = pv2Avant - v2.pvActuels;

    expect(degats1).toBeGreaterThan(0);
    expect(degats2).toBeGreaterThan(degats1); // le sort FORT (posé en second) a bien frappé en second
    expect(degats1).toBeLessThan(20); // borne haute cohérente avec le jet de « morsure »
    expect(degats2).toBeGreaterThan(25); // borne basse cohérente avec le jet de « charge »
  });

  it("mode `arriere` sur une cible déjà arrière : aucun déplacement, aucun déclenchement", () => {
    const poseur = heros();
    const [victime] = ennemisProbes(1);
    victime.position = 4; // déjà en rangée arrière
    const cs = [poseur, victime];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    const avantPV = victime.pvActuels;
    const avantPos = victime.position;
    lancerSort(poseur, sortDeplace("test_deja_arriere", "arriere"), victime.ref, cs, ctx());

    expect(victime.position).toBe(avantPos); // aucun déplacement
    expect(victime.pvActuels).toBe(avantPV); // aucun dégât
    expect(poseur.pieges).toHaveLength(1); // le piège n'est PAS consommé
    expect(poseur.chausseTrappe ?? 0).toBe(0);
  });

  it("rangée de destination pleine : échec silencieux, aucun déclenchement", () => {
    const poseur = heros();
    const [victime, ar1, ar2, ar3, ar4] = ennemisProbes(5);
    victime.position = 0;
    // la rangée arrière ennemie est complète (4/4) : aucune case libre.
    ar1.position = 4; ar2.position = 5; ar3.position = 6; ar4.position = 7;
    const cs = [poseur, victime, ar1, ar2, ar3, ar4];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    const avantPV = victime.pvActuels;
    const avantPos = victime.position;
    lancerSort(poseur, sortDeplace("test_rangee_pleine", "toggle"), victime.ref, cs, ctx());

    expect(victime.position).toBe(avantPos); // deplacerCible a échoué en silence
    expect(victime.pvActuels).toBe(avantPV);
    expect(poseur.pieges).toHaveLength(1); // le piège n'est PAS consommé
    expect(poseur.chausseTrappe ?? 0).toBe(0);
  });
});

describe("pose d'un piège : aucun dégât au lancer", () => {
  it("poser un piège ne blesse pas la cible, même avec un jet non nul", () => {
    // Le sort de pose porte un jet non nul (comme les vrais Piège Funeste/Fragmentation,
    // 10-14 et 8-11) : c'est au DÉCLENCHEMENT que ce jet compte, jamais à la pose.
    const poseur = heros();
    const [cible] = ennemisProbes(1);
    const cs = [poseur, cible];
    const sort = sortPosePiege("test_pose_sans_degats", { baseMin: 50, baseMax: 50, scaling: 1 });

    const avant = cible.pvActuels;
    lancerSort(poseur, sort, cible.ref, cs, ctx());

    expect(cible.pvActuels).toBe(avant); // AUCUN dégât à la pose
    expect(poseur.pieges).toEqual([{ sortId: sort.id, camp: cible.camp, avant: true }]);
  });

  it("enregistre le camp et la rangée de la cible au moment de la pose", () => {
    const poseur = heros();
    const [cible] = ennemisProbes(1);
    cible.position = 4; // rangée arrière
    const cs = [poseur, cible];
    const sort = sortPosePiege("test_pose_rangee");

    lancerSort(poseur, sort, cible.ref, cs, ctx());

    expect(poseur.pieges).toEqual([{ sortId: sort.id, camp: "ennemi", avant: false }]);
  });
});

describe("plafond et Chausse-Trappe", () => {
  it("poser un 5e piège efface le plus ancien", () => {
    const poseur = heros();
    const [cible] = ennemisProbes(1);
    const cs = [poseur, cible];

    for (const suffixe of ["A", "B", "C", "D", "E"]) {
      lancerSort(poseur, sortPosePiege(`test_plafond_${suffixe}`), cible.ref, cs, ctx());
    }

    expect(poseur.pieges).toHaveLength(PIEGES_MAX);
    expect(poseur.pieges!.map((p) => p.sortId)).toEqual([
      "test_plafond_B", "test_plafond_C", "test_plafond_D", "test_plafond_E",
    ]); // A (le plus ancien) a été effacé, pas E (le nouveau)
  });

  it("chaque déclenchement crédite UN cumul au poseur", () => {
    const poseur = heros();
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0;
    ar1.position = 4;
    const cs = [poseur, victime, ar1];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    expect(poseur.chausseTrappe ?? 0).toBe(0);
    lancerSort(poseur, sortDeplace("test_cumul_1", "arriere"), victime.ref, cs, ctx());
    expect(poseur.chausseTrappe).toBe(1);
  });

  it("le cumul va au poseur même quand c'est un ALLIÉ qui déplace", () => {
    const poseur = heros(); // le Sram (posera le piège, encaissera le cumul)
    const allie = heros2(); // un autre héros : c'est LUI qui lance le sort de déplacement
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0;
    ar1.position = 4;
    const cs = [poseur, allie, victime, ar1];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    lancerSort(allie, sortDeplace("test_allie_declenche", "arriere"), victime.ref, cs, ctx());

    expect(poseur.pieges).toHaveLength(0); // le piège DU poseur a bien été consommé
    expect(poseur.chausseTrappe).toBe(1); // et LUI a reçu le cumul...
    expect(allie.chausseTrappe ?? 0).toBe(0); // ...pas l'allié qui a provoqué le déplacement
  });

  it("le compteur plafonne à 5", () => {
    const poseur = heros();
    poseur.chausseTrappe = CHAUSSE_TRAPPE_MAX;
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0;
    ar1.position = 4;
    const cs = [poseur, victime, ar1];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    lancerSort(poseur, sortDeplace("test_plafond_chausse", "arriere"), victime.ref, cs, ctx());

    expect(poseur.chausseTrappe).toBe(CHAUSSE_TRAPPE_MAX); // pas 6
  });

  it("un sort `consommeChausseTrappe` remet à zéro, même à 0 cumul", () => {
    const poseur = heros();
    poseur.chausseTrappe = 0;
    const [cible] = ennemisProbes(1);
    const cs = [poseur, cible];
    const sort: Spell = { ...SORTS.morsure, id: "test_consomme_zero", consommeChausseTrappe: true };

    lancerSort(poseur, sort, cible.ref, cs, ctx());

    expect(poseur.chausseTrappe).toBe(0);
  });

  it("un sort `consommeChausseTrappe` remet à zéro même si la cible esquive", () => {
    const poseur = heros();
    poseur.chausseTrappe = 3;
    const [cible] = ennemisProbes(1);
    cible.stats = { ...cible.stats, agilite: 999 }; // esquive quasi garantie
    const cs = [poseur, cible];
    const sort: Spell = { ...SORTS.morsure, id: "test_consomme_esquive", consommeChausseTrappe: true };
    // rng très bas : garantit le tirage d'esquive (le seuil d'esquive est strictement
    // positif dès que l'agilité de la cible est non nulle).
    const rngEsquive = () => 0.0001;

    lancerSort(poseur, sort, cible.ref, cs, ctx({ rng: rngEsquive }));

    expect(poseur.chausseTrappe).toBe(0); // remis à zéro : c'est un coût payé au lancer, pas au succès
  });

  it("le multiplicateur vaut 1 + 0,15 × cumuls", () => {
    const sort: Spell = { ...SORTS.morsure, id: "test_mult_chausse", bonusParChausseTrappe: 0.15 };
    const poseur = heros();
    const [cible] = ennemisProbes(1);
    const cs = [poseur, cible];

    poseur.chausseTrappe = 0;
    const avant0 = cible.pvActuels;
    lancerSort(poseur, sort, cible.ref, cs, ctx());
    const reference = avant0 - cible.pvActuels;

    cible.pvActuels = cible.pvMax;
    poseur.chausseTrappe = 3;
    const avant3 = cible.pvActuels;
    lancerSort(poseur, sort, cible.ref, cs, ctx());
    const majore = avant3 - cible.pvActuels;

    expect(majore).toBe(Math.round(reference * (1 + 0.15 * 3)));
  });

  it("les cumuls ne fuient pas d'un combat à l'autre", () => {
    const poseur1 = heros();
    const [victime1, ar1] = ennemisProbes(2);
    victime1.position = 0; ar1.position = 4;
    const cs1 = [poseur1, victime1, ar1];
    poseur1.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    lancerSort(poseur1, sortDeplace("test_fuite_1", "arriere"), victime1.ref, cs1, ctx());
    expect(poseur1.chausseTrappe).toBe(1);

    // Un combattant neuf, fabriqué séparément — `chausseTrappe` n'a jamais été initialisé.
    const poseur2 = heros();
    expect(poseur2.chausseTrappe ?? 0).toBe(0);
  });
});
