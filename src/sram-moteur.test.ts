// =============================================================================
//  sram-moteur.test.ts — Les primitives introduites par le rework du Sram, sur des
//  sorts SYNTHÉTIQUES : ces tests doivent survivre à un rééquilibrage du kit réel.
//  Tâche 1 : le piège — entité, pose, déclenchement, Chausse-Trappe.
//  Tâche 2 : la fenêtre de Chakra (bonusPieges) et l'esquive partagée (Brume).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, runCombat, chanceEsquive, PIEGES_MAX, CHAUSSE_TRAPPE_MAX, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis, nouvelleRun, equipeCombattante, synchroniserPV } from "./run";
import type { Combatant, Piege, Spell, Action } from "./types";

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
/** Un troisième et un quatrième héros distincts (rangée peuplée pour Brume). */
const heros3 = (): Combatant => {
  const c = fabriquerEquipe()[2];
  c.stats = { ...c.stats, agilite: 0 };
  return c;
};
const heros4 = (): Combatant => {
  const c = fabriquerEquipe()[3];
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
  ...SORTS.morsure, id, baseMin: 0, baseMax: 0, deplaceCible: mode,
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

  it("un piège sur le camp ennemi ne part pas quand un ALLIÉ est déplacé sur la rangée de même indice", () => {
    // Scénario atteignable en jeu réel, pas théorique : `bourrasque_de_pollen` (Blop
    // Coco, toile 13) est le seul sort de monstre qui déplace un HÉROS, et il le
    // pousse en rangée arrière. Un piège du Sram posé sur la rangée arrière ENNEMIE
    // partagerait le même `avant: false` qu'une rangée arrière ALLIÉE — seul le
    // contrôle de `camp` les distingue. Sans lui, ce piège frapperait son propre
    // allié et lui créditerait un cumul de Chausse-Trappe au poseur.
    const poseur = heros();
    const allie = heros2();
    poseur.position = 1; // avant, colonne différente : ne dispute pas la case d'arrivée
    allie.position = 0; // avant, sera repoussé en arrière (camp "joueur")
    const cs = [poseur, allie];
    // Le piège surveille la rangée arrière ENNEMIE, pas la rangée arrière alliée.
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    const avantPV = allie.pvActuels;
    lancerSort(poseur, sortDeplace("test_camp_allie", "arriere"), allie.ref, cs, ctx());

    expect(allie.position).toBeGreaterThanOrEqual(4); // l'allié a bien été déplacé
    expect(allie.pvActuels).toBe(avantPV); // mais n'a subi AUCUN dégât
    expect(poseur.pieges).toHaveLength(1); // le piège (camp ennemi) reste posé
    expect(poseur.chausseTrappe ?? 0).toBe(0);
  });

  it("un sort inconnu (`sortId` introuvable dans SORTS) laisse le piège intact", () => {
    // Ne devrait jamais arriver en jeu réel (un piège référence toujours un vrai
    // sort du contenu), mais un test peut délibérément en poser un fictif — et le
    // moteur doit alors se comporter comme si le piège n'existait pas, plutôt que
    // de le consommer sans effet ni cumul (la garde défensive doit s'exécuter AVANT
    // le retrait de la liste, pas après).
    const poseur = heros();
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0;
    ar1.position = 4;
    const cs = [poseur, victime, ar1];
    poseur.pieges = [{ sortId: "sort_qui_n_existe_pas", camp: "ennemi", avant: false }];

    lancerSort(poseur, sortDeplace("test_sort_inconnu", "arriere"), victime.ref, cs, ctx());

    expect(poseur.pieges).toHaveLength(1); // toujours là : rien n'a pu le résoudre
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

  it("un poseur MORT garde ses pièges actifs (contrairement à toute invocation du jeu)", () => {
    // Documenté dans la docstring de `declencherPiege` (combat.ts) comme un choix
    // délibéré, à rebours de la jurisprudence du projet — Poupée/Lance/Égide sont
    // toutes purgées avec leur invocateur par `purgerInvocationsOrphelines`. Le piège
    // n'est PAS une invocation (voir Piege dans types.ts), donc rien ne le purge ici ;
    // ce test est le seul à l'exercer avant ce commit — la règle tenait par lecture
    // du code, jamais par une assertion. Le poseur étant mort, c'est un ALLIÉ qui
    // provoque le déplacement (un mort ne joue plus de tour dans `runCombat`).
    const poseur = heros();
    const allie = heros2();
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0; // avant, sera déplacée vers l'arrière
    ar1.position = 4;
    const cs = [poseur, allie, victime, ar1];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    poseur.pvActuels = 0; // le poseur est mort AVANT le déclenchement

    const avantPV = victime.pvActuels;
    lancerSort(allie, sortDeplace("test_poseur_mort", "arriere"), victime.ref, cs, ctx());

    expect(victime.pvActuels).toBeLessThan(avantPV); // le piège a bien frappé malgré le poseur mort
    expect(poseur.pieges).toHaveLength(0); // consommé comme n'importe quel autre déclenchement
    expect(poseur.chausseTrappe).toBe(1); // le cumul est crédité au poseur mort tout de même
    expect(allie.chausseTrappe ?? 0).toBe(0); // jamais à l'allié qui a provoqué le déplacement
  });
});

describe("le déclencheur plie les mêmes auras qu'un lancer direct (Éliotrope)", () => {
  // `multConjuration` documente explicitement que « les handlers dédiés doivent
  // plier ce calcul dans leur propre multiplicateur pour ne pas ignorer la marque
  // quand ils frappent une cible marquée » — `declencherPiege` EST un tel handler
  // dédié. Ces deux tests comparent un déclenchement AVEC l'aura à un déclenchement
  // IDENTIQUE (même poseur frais, même victime fraîche, même RNG déterministe) SANS
  // elle : toute divergence vient exclusivement du multiplicateur sous test.

  it("l'aura de portails majore les dégâts d'un piège déclenché", () => {
    const sans = heros();
    const [victimeSans, ar1Sans] = ennemisProbes(2);
    victimeSans.position = 0; ar1Sans.position = 4;
    const csSans = [sans, victimeSans, ar1Sans];
    sans.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    const pvAvantSans = victimeSans.pvActuels;
    lancerSort(sans, sortDeplace("test_portails_sans", "arriere"), victimeSans.ref, csSans, ctx());
    const degatsSans = pvAvantSans - victimeSans.pvActuels;

    const avec = heros();
    avec.portails = 3; // l'aura de portails ne dépend pas de la classe réelle du porteur
    const [victimeAvec, ar1Avec] = ennemisProbes(2);
    victimeAvec.position = 0; ar1Avec.position = 4;
    const csAvec = [avec, victimeAvec, ar1Avec];
    avec.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    const pvAvantAvec = victimeAvec.pvActuels;
    lancerSort(avec, sortDeplace("test_portails_avec", "arriere"), victimeAvec.ref, csAvec, ctx());
    const degatsAvec = pvAvantAvec - victimeAvec.pvActuels;

    expect(degatsSans).toBeGreaterThan(0);
    expect(degatsAvec).toBe(Math.round(degatsSans * (1 + 0.02 * 3))); // multPortails : 1 + 0,02 × 3
  });

  it("la marque de Conjuration majore les dégâts d'un piège déclenché par son poseur", () => {
    const sans = heros();
    const [victimeSans, ar1Sans] = ennemisProbes(2);
    victimeSans.position = 0; ar1Sans.position = 4;
    const csSans = [sans, victimeSans, ar1Sans];
    sans.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    const pvAvantSans = victimeSans.pvActuels;
    lancerSort(sans, sortDeplace("test_conjuration_sans", "arriere"), victimeSans.ref, csSans, ctx());
    const degatsSans = pvAvantSans - victimeSans.pvActuels;

    const avec = heros();
    const [victimeAvec, ar1Avec] = ennemisProbes(2);
    victimeAvec.position = 0; ar1Avec.position = 4;
    const csAvec = [avec, victimeAvec, ar1Avec];
    avec.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    // La victime est marquée par le POSEUR lui-même : `multConjuration` majore un
    // coup du marqueur (ou de sa rangée) contre sa propre marque.
    victimeAvec.conjuration = { pct: 0.5, lanceurRef: avec.ref, tours: 2 };
    const pvAvantAvec = victimeAvec.pvActuels;
    lancerSort(avec, sortDeplace("test_conjuration_avec", "arriere"), victimeAvec.ref, csAvec, ctx());
    const degatsAvec = pvAvantAvec - victimeAvec.pvActuels;

    expect(degatsSans).toBeGreaterThan(0);
    expect(degatsAvec).toBe(Math.round(degatsSans * 1.5));
  });
});

describe("un piège peut tuer la cible AVANT que l'appelant ait fini son travail", () => {
  it("la bousculade de Flèche de recul ne frappe pas un cadavre (pas de double K.O.)", () => {
    const poseur = heros(); // le Sram, poseur du piège mortel
    const lanceurRecul = heros2(); // un autre héros lance le sort qui repousse
    const [victime, occupant] = ennemisProbes(2);
    victime.position = 0; // avant, seule sur sa rangée (aucun autre ennemi avant)
    occupant.position = 4; // occupe déjà la case d'arrivée en rangée arrière
    const cs = [poseur, lanceurRecul, victime, occupant];
    victime.pvActuels = 1; // un rien la tue
    poseur.pieges = [{ sortId: "charge", camp: "ennemi", avant: false }]; // très largement letal

    const sortRecul: Spell = {
      ...SORTS.morsure, id: "test_recul_mortel",
      degatsPoussee: true, baseMin: 5, baseMax: 5, ignoreResistances: true,
    };
    const lignes: string[] = [];
    lancerSort(lanceurRecul, sortRecul, victime.ref, cs, ctx({ log: (m) => lignes.push(m) }));

    expect(victime.pvActuels).toBe(0); // morte au piège, plafonnée à 0 (pas de négatif)
    expect(poseur.pieges).toHaveLength(0); // le piège a bien été consommé au passage
    expect(occupant.pvActuels).toBe(9999); // la bousculade n'a JAMAIS eu lieu : occupant intact
    const koVictime = lignes.filter((l) => l.includes(`${victime.nom} est K.O.`));
    expect(koVictime).toHaveLength(1); // UNE SEULE annonce de K.O., pas deux
  });

  it("le Téléfrag de Pendule ne s'applique pas à une cible tuée par le piège pendant le déplacement", () => {
    const poseur = heros(); // le Sram, poseur du piège mortel
    const lanceurPendule = heros2(); // un autre héros lance le sort qui déplace
    const [victime, occupant] = ennemisProbes(2);
    victime.position = 0; // avant
    occupant.position = 4; // déjà en rangée arrière : rend la destination « occupée »
    const cs = [poseur, lanceurPendule, victime, occupant];
    victime.pvActuels = 1;
    poseur.pieges = [{ sortId: "charge", camp: "ennemi", avant: false }];

    const sortPendule: Spell = {
      ...SORTS.morsure, id: "test_pendule_mortel",
      baseMin: 0, baseMax: 0, deplaceCible: "toggle", telefragSiOccupee: true,
    };
    lancerSort(lanceurPendule, sortPendule, victime.ref, cs, ctx());

    expect(victime.pvActuels).toBe(0); // tuée par le piège
    expect(poseur.pieges).toHaveLength(0); // le piège a bien été consommé au passage
    expect(victime.telefrags ?? 0).toBe(0); // aucun Téléfrag posé sur un cadavre
    expect(occupant.telefrags ?? 0).toBe(0); // ni sur l'occupant bousculé
  });
});

describe("pose d'un piège : aucun dégât au lancer", () => {
  it("poser un piège ne blesse pas la cible, même avec un jet non nul", () => {
    // Le sort de pose porte un jet non nul (comme les vrais Piège Funeste/Fragmentation,
    // 10-14 et 8-11) : c'est au DÉCLENCHEMENT que ce jet compte, jamais à la pose.
    const poseur = heros();
    const [cible] = ennemisProbes(1);
    const cs = [poseur, cible];
    const sort = sortPosePiege("test_pose_sans_degats", { baseMin: 50, baseMax: 50 });

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

  it("un sort `consommeChausseTrappe` écrit explicitement 0, même sans cumul préalable", () => {
    // `poseur.chausseTrappe` n'est PAS pré-initialisé à 0 ici (délibérément) : il
    // vaut `undefined` avant le lancer. Un sabotage qui retirerait la ligne de
    // consommation laisserait la valeur `undefined` — distincte de `0` pour
    // `toBe` — ce qu'une version qui pré-initialisait à 0 ne pouvait pas détecter
    // (0 → 0 est vrai avec ou sans la ligne testée).
    const poseur = heros();
    expect(poseur.chausseTrappe).toBeUndefined(); // témoin : rien ne l'a initialisé
    const [cible] = ennemisProbes(1);
    const cs = [poseur, cible];
    const sort: Spell = { ...SORTS.morsure, id: "test_consomme_zero", consommeChausseTrappe: true };

    lancerSort(poseur, sort, cible.ref, cs, ctx());

    expect(poseur.chausseTrappe).toBe(0); // explicitement écrit à 0, pas resté `undefined`
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

  it("les cumuls ne fuient pas d'un combat à l'autre : un combattant reconstruit depuis PersoState repart à zéro", () => {
    // Comparer deux objets JS totalement indépendants (deux `heros()`) ne prouve
    // rien : rien dans le langage ne les relie, aucun sabotage plausible du moteur
    // ne peut faire fuir un champ entre deux objets qui ne se référencent jamais.
    // La vraie garantie du jeu est ailleurs : « les combattants sont reconstruits à
    // CHAQUE COMBAT depuis RunState » (CLAUDE.md) — donc ce test exerce le VRAI
    // mécanisme de persistance inter-combats, `equipeCombattante`/`synchroniserPV`
    // (run.ts), plutôt que deux fabrications indépendantes. Il serait discriminant
    // contre le défaut plausible symétrique de tous les autres champs d'état de
    // combat (bombes, telefrags, portails…) : faire transiter `chausseTrappe` par
    // `PersoState` par erreur.
    const run = nouvelleRun();
    const equipe1 = equipeCombattante(run);
    const poseur1 = equipe1[0];
    poseur1.chausseTrappe = 5;
    synchroniserPV(run, equipe1); // le VRAI mécanisme de persistance entre deux combats

    const equipe2 = equipeCombattante(run); // reconstruction pour le combat SUIVANT
    const poseur2 = equipe2.find((c) => c.ref === poseur1.ref)!;

    expect(poseur2.chausseTrappe ?? 0).toBe(0);
  });
});

// =============================================================================
//  Tâche 2 : Concentration de Chakra (bonusPieges) et Brume (esquive partagée).
// =============================================================================

/** Sort de soutien synthétique qui pose Chakra sur le LANCEUR (cible: "soi"). */
const sortChakra = (id: string, valeur: number, duree: number): Spell => ({
  ...SORTS.morsure, id, type: "buff", cible: "soi", coutPA: 1,
  baseMin: 0, baseMax: 0, bonusPieges: valeur, bonusPiegesDuree: duree,
});

/** Sort de soutien synthétique qui pose Brume (cible: "allie"). */
const sortBrume = (id: string, duree: number): Spell => ({
  ...SORTS.morsure, id, type: "buff", cible: "allie", coutPA: 1,
  baseMin: 0, baseMax: 0, esquivePartageeRangee: { duree },
});

describe("Concentration de Chakra : majoration temporaire des pièges", () => {
  it("le sort de soutien pose bien l'effet bonusPieges sur le LANCEUR, avec sa durée", () => {
    const lanceur = heros();
    const cs = [lanceur];
    const sort = sortChakra("test_chakra_pose", 0.5, 1);

    lancerSort(lanceur, sort, lanceur.ref, cs, ctx());

    expect(lanceur.effets).toContainEqual({ stat: "bonusPieges", valeur: 0.5, toursRestants: 1 });
  });

  it("un sort du même champ visant un ALLIÉ (pas soi) majore quand même les pièges du LANCEUR, jamais ceux de l'allié visé", () => {
    // Contre-épreuve du test précédent, qui ne pouvait pas discriminer : `cible: "soi"`
    // fait toujours coïncider lanceur et bénéficiaire, donc poser l'effet sur l'un ou
    // l'autre donnait le même résultat. Ici la cible du sort de soutien est un AUTRE
    // combattant — seul un sort posant vraiment l'effet sur le LANCEUR (et non sur le
    // paramètre `cible` d'`appliquerSoutien`, qui vaut ici l'allié) passe ce test.
    const lanceur = heros();
    const allieCible = heros2();
    const cs = [lanceur, allieCible];
    const sort: Spell = {
      ...SORTS.morsure, id: "test_chakra_pas_soi", type: "buff", cible: "allie", coutPA: 1,
      baseMin: 0, baseMax: 0, bonusPieges: 0.5, bonusPiegesDuree: 1,
    };

    lancerSort(lanceur, sort, allieCible.ref, cs, ctx());

    expect(lanceur.effets).toContainEqual({ stat: "bonusPieges", valeur: 0.5, toursRestants: 1 });
    expect(allieCible.effets.filter((e) => e.stat === "bonusPieges")).toHaveLength(0);
  });

  it("majore les dégâts d'un piège déclenché : multiplicateur 1 + valeur de l'effet", () => {
    const sansChakra = heros();
    const [victimeSans, ar1Sans] = ennemisProbes(2);
    victimeSans.position = 0; ar1Sans.position = 4;
    const csSans = [sansChakra, victimeSans, ar1Sans];
    sansChakra.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    const avantSans = victimeSans.pvActuels;
    lancerSort(sansChakra, sortDeplace("test_chakra_mult_sans", "arriere"), victimeSans.ref, csSans, ctx());
    const reference = avantSans - victimeSans.pvActuels;

    const avecChakra = heros();
    avecChakra.effets.push({ stat: "bonusPieges", valeur: 0.5, toursRestants: 1 }); // effet posé directement : isole le MULTIPLICATEUR de son mode d'application (déjà couvert ci-dessus)
    const [victimeAvec, ar1Avec] = ennemisProbes(2);
    victimeAvec.position = 0; ar1Avec.position = 4;
    const csAvec = [avecChakra, victimeAvec, ar1Avec];
    avecChakra.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    const avantAvec = victimeAvec.pvActuels;
    lancerSort(avecChakra, sortDeplace("test_chakra_mult_avec", "arriere"), victimeAvec.ref, csAvec, ctx());
    const majore = avantAvec - victimeAvec.pvActuels;

    expect(reference).toBeGreaterThan(0);
    expect(majore).toBe(Math.round(reference * 1.5));
  });

  it("bénéficie même quand c'est un ALLIÉ qui déclenche le piège (le bonus est celui du POSEUR)", () => {
    const poseur = heros();
    poseur.effets.push({ stat: "bonusPieges", valeur: 0.5, toursRestants: 1 });
    const allie = heros2();
    const [victime, ar1] = ennemisProbes(2);
    victime.position = 0; ar1.position = 4;
    const cs = [poseur, allie, victime, ar1];
    poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

    // Référence : même scénario, mais l'allié déclenche un poseur SANS Chakra.
    const poseurSans = heros();
    const allieSans = heros2();
    const [victimeSans, ar1Sans] = ennemisProbes(2);
    victimeSans.position = 0; ar1Sans.position = 4;
    const csSans = [poseurSans, allieSans, victimeSans, ar1Sans];
    poseurSans.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
    const avantSans = victimeSans.pvActuels;
    lancerSort(allieSans, sortDeplace("test_chakra_allie_sans", "arriere"), victimeSans.ref, csSans, ctx());
    const reference = avantSans - victimeSans.pvActuels;

    const avantAvec = victime.pvActuels;
    lancerSort(allie, sortDeplace("test_chakra_allie_avec", "arriere"), victime.ref, cs, ctx());
    const majore = avantAvec - victime.pvActuels;

    expect(reference).toBeGreaterThan(0);
    expect(majore).toBe(Math.round(reference * 1.5));
    expect(allie.chausseTrappe ?? 0).toBe(0); // le cumul de Chausse-Trappe va au POSEUR, jamais à l'allié déclencheur
    expect(poseur.chausseTrappe).toBe(1);
  });

  // Test central du plan : à faire tourner via runCombat, pas en lisant le champ. Les
  // effets « bonusPieges » sont décomptés au DÉBUT du tour de leur porteur (comme
  // paParTour/hot, voir EFFETS_TICK_DEBUT dans combat.ts) et non à la fin — sans cette
  // particularité, un Chakra posé par le Sram serait décrémenté et retiré à la fin de
  // SON PROPRE tour de pose, avant même le tour de l'allié suivant, et ne couvrirait
  // jamais que le tour de pose lui-même.
  describe("fenêtre réelle du buff, jouée via runCombat", () => {
    it("couvre le tour de pose ET le tour allié qui suit", async () => {
      const poseur = heros();
      const allie = heros2();
      poseur.position = 0; allie.position = 1;
      poseur.paMax = 5; poseur.paActuels = 5; // 1 (Chakra) + 4 (Morsure, coût hérité) dans le même tour
      allie.paMax = 4; allie.paActuels = 4;

      const [victimeA, victimeB, ar1] = ennemisProbes(3);
      victimeA.position = 0; victimeB.position = 1; ar1.position = 4; // rangée arrière : 1/4 prise, 3 libres

      const chakraSort = sortChakra("test_fenetre_chakra", 0.5, 1);
      const deplaceSort = sortDeplace("test_fenetre_deplace", "arriere");
      poseur.pieges = [
        { sortId: "morsure", camp: "ennemi", avant: false },
        { sortId: "morsure", camp: "ennemi", avant: false },
      ];

      const cs: Combatant[] = [poseur, allie, victimeA, victimeB, ar1];
      let toursPoseur = 0;
      let poseurADeplace = false;
      let allieADeplace = false;
      const log = (m: string) => { if (m.includes(`Tour de ${poseur.nom}`)) toursPoseur++; };
      const controllers = {
        joueur: async (acteur: Combatant): Promise<Action | null> => {
          if (acteur.ref === poseur.ref) {
            if (toursPoseur === 1) {
              if (!poseurADeplace && poseur.paActuels === 5) return { sort: chakraSort, cibleRef: poseur.ref };
              if (!poseurADeplace) {
                poseurADeplace = true;
                return { sort: deplaceSort, cibleRef: victimeA.ref }; // déclenche DANS le tour du Sram
              }
            }
            return null;
          }
          if (acteur.ref === allie.ref && !allieADeplace) {
            allieADeplace = true;
            return { sort: deplaceSort, cibleRef: victimeB.ref }; // déclenche au tour ALLIÉ qui suit
          }
          return null;
        },
        ennemi: async (): Promise<Action | null> => null,
      };

      const avantA = victimeA.pvActuels;
      const avantB = victimeB.pvActuels;
      await runCombat(cs, { rng: rngMax, log, controllers } as any);
      const degatsMemeTour = avantA - victimeA.pvActuels;
      const degatsTourAllie = avantB - victimeB.pvActuels;

      // Référence non majorée : même déclenchement, sans Chakra du tout.
      const refPoseur = heros();
      const [refVictime, refAr1] = ennemisProbes(2);
      refVictime.position = 0; refAr1.position = 4;
      refPoseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
      const refAvant = refVictime.pvActuels;
      lancerSort(refPoseur, deplaceSort, refVictime.ref, [refPoseur, refVictime, refAr1], ctx());
      const reference = refAvant - refVictime.pvActuels;

      expect(reference).toBeGreaterThan(0);
      expect(degatsMemeTour).toBe(Math.round(reference * 1.5)); // couvre le tour de pose
      expect(degatsTourAllie).toBe(Math.round(reference * 1.5)); // couvre le tour allié qui suit
    });

    it("retombe quand le Sram rejoue : un déclenchement à SON tour suivant n'est plus majoré", async () => {
      const poseur = heros();
      poseur.position = 0;
      poseur.paMax = 1; poseur.paActuels = 1; // une seule action possible par tour : force deux tours distincts

      const [victime] = ennemisProbes(1);
      victime.position = 0; // avant ; sera togglée en arrière au 2e tour du Sram

      const chakraSort = sortChakra("test_retombe_chakra", 0.5, 1);
      const deplaceSort: Spell = { ...SORTS.morsure, id: "test_retombe_deplace", coutPA: 1, baseMin: 0, baseMax: 0, deplaceCible: "toggle" };
      poseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];

      const cs: Combatant[] = [poseur, victime];
      let toursPoseur = 0;
      // Témoin RESSERRÉ : capturé au moment exact où l'action de déclenchement est
      // ENVOYÉE, pas relu après coup sur un compteur qui continue de grimper tant que
      // `runCombat` tourne (personne ne peut plus rien faire après le 2e tour — victime
      // survit à 9999 PV, plus aucun attaquant — donc la boucle continue jusqu'à SON
      // propre garde-fou anti-boucle, qui n'a rien à voir avec la fenêtre de Chakra
      // testée ici). Un snapshot pris au bon instant ne dépend plus de ce garde-fou.
      let toursPoseurAuDeclenchement = -1;
      let declenche = false;
      const log = (m: string) => { if (m.includes(`Tour de ${poseur.nom}`)) toursPoseur++; };
      const controllers = {
        joueur: async (): Promise<Action | null> => {
          if (toursPoseur === 1) return { sort: chakraSort, cibleRef: poseur.ref }; // 1er tour : cast Chakra puis fin de tour (1 PA)
          if (toursPoseur === 2 && !declenche) {
            declenche = true;
            toursPoseurAuDeclenchement = toursPoseur;
            return { sort: deplaceSort, cibleRef: victime.ref }; // 2e tour du Sram : il « rejoue »
          }
          return null;
        },
        ennemi: async (): Promise<Action | null> => null,
      };

      const avant = victime.pvActuels;
      await runCombat(cs, { rng: rngMax, log, controllers } as any);
      const degats = avant - victime.pvActuels;

      // Référence non majorée, même déclenchement.
      const refPoseur = heros();
      const [refVictime] = ennemisProbes(1);
      refVictime.position = 0;
      refPoseur.pieges = [{ sortId: "morsure", camp: "ennemi", avant: false }];
      const refAvant = refVictime.pvActuels;
      lancerSort(refPoseur, { ...deplaceSort, id: "test_retombe_ref" }, refVictime.ref, [refPoseur, refVictime], ctx());
      const reference = refAvant - refVictime.pvActuels;

      expect(reference).toBeGreaterThan(0);
      expect(degats).toBe(reference); // PLUS de majoration : le Chakra est retombé
      expect(declenche).toBe(true); // témoin que le déclenchement a bien eu lieu
      expect(toursPoseurAuDeclenchement).toBe(2); // et précisément au 2e tour du Sram, pas avant
    });
  });
});

describe("Brume : esquive partagée", () => {
  it("s'applique à la rangée de la CIBLE (lanceur compris s'il y est), pas à l'autre rangée", () => {
    const lanceur = heros();
    lanceur.stats = { ...lanceur.stats, agilite: 100 }; // brut attendu : 100 × 0,002 = 0,2
    lanceur.position = 0; // avant
    const allieAvant = heros2();
    allieAvant.position = 1; // avant : même rangée que la cible
    const allieArriere = heros3();
    allieArriere.position = 4; // arrière : PAS la rangée de la cible
    const cs = [lanceur, allieAvant, allieArriere];

    lancerSort(lanceur, sortBrume("test_brume_rangee", 2), allieAvant.ref, cs, ctx());

    const brumeSur = (c: Combatant) => c.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(brumeSur(lanceur)).toHaveLength(1);
    expect(brumeSur(lanceur)[0]).toMatchObject({ valeur: 0.2, toursRestants: 2 });
    expect(brumeSur(allieAvant)).toHaveLength(1);
    expect(brumeSur(allieAvant)[0]).toMatchObject({ valeur: 0.2, toursRestants: 2 });
    expect(brumeSur(allieArriere)).toHaveLength(0);
  });

  it("le lanceur n'est PAS inclus s'il est dans l'AUTRE rangée que la cible", () => {
    const lanceur = heros();
    lanceur.position = 4; // arrière
    const cible = heros2();
    cible.position = 0; // avant
    const cs = [lanceur, cible];

    lancerSort(lanceur, sortBrume("test_brume_lanceur_absent", 2), cible.ref, cs, ctx());

    expect(lanceur.effets.filter((e) => e.stat === "esquive" && e.viaBrume)).toHaveLength(0);
    expect(cible.effets.filter((e) => e.stat === "esquive" && e.viaBrume)).toHaveLength(1);
  });

  it("exclut les invocations de la rangée, même vivantes et de même camp/rangée", () => {
    const lanceur = heros();
    lanceur.position = 0;
    const cible = heros2();
    cible.position = 1;
    const invocation: Combatant = { ...heros3(), ref: "test_invocation", position: 2, estInvocation: true };
    const cs = [lanceur, cible, invocation];

    lancerSort(lanceur, sortBrume("test_brume_invocation", 2), cible.ref, cs, ctx());

    expect(invocation.effets.filter((e) => e.stat === "esquive" && e.viaBrume)).toHaveLength(0);
    expect(cible.effets.filter((e) => e.stat === "esquive" && e.viaBrume)).toHaveLength(1);
  });

  it("valeur figée : agilité effective + effets `esquive` du lanceur, SANS esquiveArriere ni Brume déjà active", () => {
    const lanceur = heros();
    lanceur.stats = { ...lanceur.stats, agilite: 50 }; // 50 × 0,002 = 0,1
    lanceur.position = 4; // arrière : esquiveArriere serait actif sur LUI s'il en portait
    lanceur.esquiveArriere = 0.4; // équipement (Baguette Rikiki) : ne doit PAS entrer dans le calcul partagé
    lanceur.effets.push({ stat: "esquive", valeur: 0.05, toursRestants: 3 }); // effet étranger (pas Brume) : DOIT compter
    lanceur.effets.push({ stat: "esquive", valeur: 0.9, toursRestants: 1, viaBrume: true }); // Brume ANTÉRIEURE : ne doit PAS compter
    const cible = heros2();
    cible.position = 4; // même rangée que le lanceur (arrière), pour qu'il soit inclus
    const cs = [lanceur, cible];

    lancerSort(lanceur, sortBrume("test_brume_valeur", 2), cible.ref, cs, ctx());

    const nouvelleEntree = cible.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(nouvelleEntree).toHaveLength(1);
    // 0,1 (agilité) + 0,05 (effet étranger) = 0,15 — ni les 0,4 d'esquiveArriere, ni les
    // 0,9 de la Brume antérieure du lanceur ne doivent apparaître dans ce total.
    expect(nouvelleEntree[0].valeur).toBeCloseTo(0.15);
  });

  it("additive : deux lancers successifs cumulent (deux entrées), sans écraser la précédente", () => {
    const lanceur = heros();
    lanceur.stats = { ...lanceur.stats, agilite: 50 }; // brut = 0,1 à chaque lancer (cible hors rangée du lanceur)
    lanceur.position = 4; // hors de la rangée ciblée : n'influence pas sa propre relance (cf. test suivant pour le cas contraire)
    const cible = heros2();
    cible.position = 0;
    const cs = [lanceur, cible];

    lancerSort(lanceur, sortBrume("test_brume_additive_1", 2), cible.ref, cs, ctx());
    lancerSort(lanceur, sortBrume("test_brume_additive_2", 2), cible.ref, cs, ctx());

    const entrees = cible.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(entrees).toHaveLength(2);
    expect(entrees[0].valeur).toBeCloseTo(0.1);
    expect(entrees[1].valeur).toBeCloseTo(0.1); // additive : la 2e ne remplace ni ne double la 1re
  });

  it("n'enfle PAS si le Sram est lui-même sous sa propre Brume (anti auto-alimentation)", () => {
    const lanceur = heros();
    lanceur.stats = { ...lanceur.stats, agilite: 100 }; // brut = 0,2, SI la Brume déjà active ne compte pas
    lanceur.position = 0;
    const cible = heros2();
    cible.position = 1; // même rangée que le lanceur : il est inclus dans les DEUX lancers
    const cs = [lanceur, cible];

    lancerSort(lanceur, sortBrume("test_brume_autoalim_1", 2), cible.ref, cs, ctx());
    const brumeSurLanceurApres1 = lanceur.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(brumeSurLanceurApres1).toHaveLength(1);
    expect(brumeSurLanceurApres1[0].valeur).toBeCloseTo(0.2);

    // Relance : le lanceur porte maintenant SA PROPRE Brume (posée par le lancer
    // précédent). Un calcul naïf qui sommerait TOUS les effets `esquive` du lanceur
    // (sans exclure `viaBrume`) obtiendrait 0,2 + 0,2 = 0,4 pour cette 2e relance.
    lancerSort(lanceur, sortBrume("test_brume_autoalim_2", 2), cible.ref, cs, ctx());
    const brumeSurLanceurApres2 = lanceur.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(brumeSurLanceurApres2).toHaveLength(2); // additif (cf. test précédent) : 2 entrées désormais
    expect(brumeSurLanceurApres2[1].valeur).toBeCloseTo(0.2); // toujours 0,2, PAS 0,4

    const brumeSurCible = cible.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(brumeSurCible).toHaveLength(2);
    expect(brumeSurCible[1].valeur).toBeCloseTo(0.2); // la cible reçoit la même valeur non gonflée
  });

  it("le plafond de 50 % s'applique en AVAL, via chanceEsquive, pas au moment du partage", () => {
    const lanceur = heros();
    lanceur.stats = { ...lanceur.stats, agilite: 10000 }; // brut = 20, très largement au-delà de 0,5
    lanceur.position = 0;
    const cible = heros2();
    cible.position = 1;
    cible.stats = { ...cible.stats, agilite: 0 };
    const cs = [lanceur, cible];

    lancerSort(lanceur, sortBrume("test_brume_plafond", 2), cible.ref, cs, ctx());

    const entree = cible.effets.filter((e) => e.stat === "esquive" && e.viaBrume);
    expect(entree).toHaveLength(1);
    expect(entree[0].valeur).toBeCloseTo(20); // stockée BRUTE, non plafonnée
    expect(chanceEsquive(cible)).toBe(0.5); // mais le plafond s'applique bien en aval, à la lecture
  });

  it("une seule application par lancer, même sur une rangée peuplée (4 bénéficiaires)", () => {
    const lanceur = heros();
    lanceur.position = 0;
    const a2 = heros2(); a2.position = 1;
    const a3 = heros3(); a3.position = 2;
    const a4 = heros4(); a4.position = 3;
    const cs = [lanceur, a2, a3, a4];

    lancerSort(lanceur, sortBrume("test_brume_une_fois", 2), a2.ref, cs, ctx());

    for (const c of [lanceur, a2, a3, a4]) {
      expect(c.effets.filter((e) => e.stat === "esquive" && e.viaBrume)).toHaveLength(1);
    }
  });

  it("une seule application par lancer, VRAIMENT prouvé : sort allie_tous sans cible unique résolvable", () => {
    // Le test précédent ne prouve PAS « une fois par lancer » : Brume cible "allie"
    // (une cible unique), donc `cibles.length` vaut toujours 1 dans `lancerSort` —
    // « une fois par lancer » et « une fois par cible » y sont indiscernables. Un
    // relecteur peut déplacer l'appel de `partagerEsquive` À L'INTÉRIEUR de la boucle
    // sur `cibles` sans qu'aucun test ne tombe. Ce test utilise un sort synthétique
    // `cible: "allie_tous"` sur QUATRE bénéficiaires (`cibles.length === 4`) : si
    // l'appel était fait une fois par cible, chacun des 4 recevrait 4 entrées au lieu
    // d'une seule.
    //
    // Il exerce EN MÊME TEMPS la garde `&& cible` : `cibleRef` est délibérément
    // introuvable dans `cs`, donc `cible` (la cible SINGULIÈRE résolue par `lancerSort`)
    // vaut `undefined` — exactement le cas « sort sans cible unique » qui, avant
    // correction, faisait sauter la résolution en silence (aucun journal, aucune
    // erreur, aucun bénéficiaire). Le champ doit se résoudre quand même, en repli sur
    // la rangée du LANCEUR.
    const lanceur = heros();
    lanceur.position = 0;
    const a2 = heros2(); a2.position = 1;
    const a3 = heros3(); a3.position = 2;
    const a4 = heros4(); a4.position = 3;
    const cs = [lanceur, a2, a3, a4];
    const sortTous: Spell = {
      ...SORTS.morsure, id: "test_brume_tous", type: "buff", cible: "allie_tous", coutPA: 1,
      baseMin: 0, baseMax: 0, esquivePartageeRangee: { duree: 2 },
    };

    lancerSort(lanceur, sortTous, "ref_introuvable_dans_cs", cs, ctx());

    for (const c of [lanceur, a2, a3, a4]) {
      expect(c.effets.filter((e) => e.stat === "esquive" && e.viaBrume)).toHaveLength(1);
    }
  });
});
