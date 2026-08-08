// =============================================================================
//  sram.test.ts — Le kit RÉEL du Sram (6 sorts, paire air+feu). Les primitives
//  moteur qu'il emploie (Piege, posePiege, bonusParChausseTrappe,
//  consommeChausseTrappe, bonusPieges, esquivePartageeRangee/chanceEsquive)
//  sont déjà couvertes contre des sorts synthétiques dans sram-moteur.test.ts :
//  ici on vérifie le CONTENU réel — les valeurs exactes du tableau du plan, la
//  disparition des 8 anciens sorts, la nouvelle paire d'éléments, et les
//  comportements du kit tel qu'il sera vraiment joué (Sournoiserie en rangée
//  arrière, la majoration de Piège Funeste, l'éclaboussure de la Fragmentation,
//  et les quatre sorts d'AUTRES classes qui déclenchent réellement un piège).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, ciblesValides, type CombatCtx } from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant, Piege } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Sram prêt à combattre : agilité et chance nulles par défaut (esquive/crit/
 *  scaling élémentaire déterministes) — les tests qui ont besoin de contrôler
 *  l'attaque redéfinissent ces stats explicitement. */
function sram(): Combatant {
  const c = equipeCombattante(nouvelleRun(["sram"]))[0];
  c.stats = { ...c.stats, agilite: 0, chance: 0, intelligence: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

/** Un mannequin ennemi sans résistances, PV confortables, ref unique. */
let mannequinSeq = 0;
function mannequin(): Combatant {
  const e = fabriquerEnnemis("combat_1")[0];
  e.ref = `${e.ref}_${mannequinSeq++}`;
  e.stats = { ...e.stats, agilite: 0 };
  e.resistances = {};
  e.pvMax = 9999; e.pvActuels = 9999;
  return e;
}

const KIT = [
  "attaque_mortelle", "sournoiserie", "piege_funeste",
  "piege_a_fragmentation", "concentration_de_chakra", "brume",
];
const RETIRES = [
  "attaque_ombre", "coup_insidieux", "coup_sournois", "flasque_empoisonnee",
  "deluge_lames", "mise_a_mort", "expert_poisons", "invisibilite",
];

describe("la classe", () => {
  it("frappe désormais en air et en feu (plus terre+air)", () => {
    expect(CLASSES.sram.elements).toEqual(["air", "feu"]);
  });

  it("l'archétype reste melee", () => {
    expect(CLASSES.sram.archetype).toBe("melee");
  });

  it("son kit est EXACTEMENT les 6 nouveaux sorts, dans cet ordre", () => {
    expect(CLASSES.sram.sorts).toEqual(KIT);
  });

  it("les 8 anciens sorts ont disparu du contenu", () => {
    for (const id of RETIRES) expect(SORTS[id as keyof typeof SORTS], id).toBeUndefined();
  });

  it("les 8 anciens sorts ne figurent dans le kit d'AUCUNE classe", () => {
    for (const classe of Object.values(CLASSES)) {
      for (const id of RETIRES) expect(classe.sorts, `${classe.id} ↔ ${id}`).not.toContain(id);
    }
  });

  // La répartition élémentaire des 11 jouables est un invariant GLOBAL, pas un fait
  // du Sram : il vit dans `archetypes.test.ts`, seul propriétaire de la synchronisation
  // avec `CLASSES-ELEMENTS.md`. Le dupliquer ici (et dans chaque test de classe
  // rework précédent) forcerait à éditer N fichiers pour un seul invariant, et
  // l'oubli de l'un ferait échouer les tests d'une AUTRE classe pour un chantier
  // qui n'y touche pas.

  it("les 6 identifiants de sort correspondent aux 6 fichiers d'icônes, dans les DEUX sens", () => {
    // `import.meta.glob` (natif Vite/Vitest) plutôt que `node:fs` : une déclaration
    // ambiante pour `node:fs` rendrait `readdirSync` légal depuis N'IMPORTE QUEL
    // module de src/, `combat.ts` compris — une érosion du moteur pur que le
    // projet défend ailleurs, pour un besoin qui n'existe que dans CE test.
    const modules = import.meta.glob("/public/assets/spells/sram/*.png", { eager: true });
    const fichiers = Object.keys(modules)
      .map((chemin) => chemin.replace(/^.*\//, "").replace(/\.png$/, ""))
      .sort();
    expect(fichiers).toEqual([...KIT].sort());
  });
});

// Les 6 descriptions ci-dessous sont des chaînes LITTÉRALES, pas `SORTS.x.desc` (qui se
// compare à lui-même et laisse passer une description vidée ou modifiée en silence).
// `toEqual` complet : durées et objets imbriqués compris — un rework précédent a laissé
// passer quatre durées glissant à 9 tours sans qu'un seul test ne bronche.
describe("valeurs des 6 sorts (coûts, jets, scalings, cibles, recharges, objets imbriqués)", () => {
  it("Attaque Mortelle", () => {
    expect(SORTS.attaque_mortelle).toEqual({
      id: "attaque_mortelle", nom: "Attaque Mortelle", type: "degats", cible: "ennemi_ligne",
      coutPA: 4, baseMin: 9, baseMax: 13, scaling: 0.32,
      bonusParChausseTrappe: 0.15, consommeChausseTrappe: true,
      desc: "Dégâts qui montent avec le Chausse-Trappe (+15 %/cumul), puis remet le compteur à zéro.",
    });
  });

  it("Sournoiserie", () => {
    expect(SORTS.sournoiserie).toEqual({
      id: "sournoiserie", nom: "Sournoiserie", type: "degats", cible: "ennemi_tous",
      coutPA: 2, baseMin: 3, baseMax: 5, scaling: 0.12,
      maxParTour: 2, deplaceCible: "toggle",
      desc: "Petits dégâts sur n'importe quel ennemi (rangée arrière comprise), puis échange sa rangée.",
    });
  });

  it("Piège Funeste", () => {
    expect(SORTS.piege_funeste).toEqual({
      id: "piege_funeste", nom: "Piège Funeste", type: "degats", cible: "ennemi_ligne",
      coutPA: 3, baseMin: 10, baseMax: 14, scaling: 0.35,
      maxParTour: 2, posePiege: true, bonusParEnnemiLigneCible: 0.3,
      desc: "Pose un piège sur la rangée de la cible (aucun dégât immédiat) ; au déclenchement, +30 % par autre ennemi vivant sur cette rangée.",
    });
  });

  it("Piège à Fragmentation", () => {
    expect(SORTS.piege_a_fragmentation).toEqual({
      id: "piege_a_fragmentation", nom: "Piège à Fragmentation", type: "degats", cible: "ennemi_ligne",
      coutPA: 3, baseMin: 8, baseMax: 11, scaling: 0.28,
      maxParTour: 2, posePiege: true, ratioLigne: 0.5,
      desc: "Pose un piège sur la rangée de la cible (aucun dégât immédiat) ; au déclenchement, éclabousse le reste de la rangée à moitié dégâts.",
    });
  });

  it("Concentration de Chakra", () => {
    expect(SORTS.concentration_de_chakra).toEqual({
      id: "concentration_de_chakra", nom: "Concentration de Chakra", type: "buff", cible: "soi",
      coutPA: 2, baseMin: 0, baseMax: 0, scaling: 0, cooldownTours: 2,
      bonusPieges: 0.5, bonusPiegesDuree: 1,
      desc: "Majore de 50 % les dégâts du prochain piège déclenché, pendant 1 tour.",
    });
  });

  it("Brume", () => {
    expect(SORTS.brume).toEqual({
      id: "brume", nom: "Brume", type: "buff", cible: "allie",
      coutPA: 3, baseMin: 0, baseMax: 0, scaling: 0, cooldownTours: 5,
      esquivePartageeRangee: { duree: 2 },
      desc: "Partage l'esquive du Sram (hors bonus de position) avec toute la rangée de la cible, lanceur compris s'il s'y trouve, pour 2 tours.",
    });
  });
});

describe("Sournoiserie", () => {
  it("atteint la rangée arrière via `ciblesValides` (ennemi_tous, pas de règle de ligne)", () => {
    const c = sram();
    const ennemis = fabriquerEnnemis("combat_2"); // au moins 1 avant + 1 arrière
    ennemis.forEach((e) => { e.resistances = {}; e.pvActuels = 500; e.pvMax = 500; });
    const arriere = ennemis.filter((e) => e.position >= 4);
    expect(arriere.length).toBeGreaterThan(0); // le scénario doit réellement peupler l'arrière
    const cibles = ciblesValides(c, SORTS.sournoiserie, [c, ...ennemis]).map((x) => x.ref);
    for (const e of arriere) expect(cibles, e.ref).toContain(e.ref);
  });

  it("un Sram tétanisé ne l'atteint plus (règle de la Tétanisation/tetanise)", () => {
    const c = sram();
    c.effets = [{ stat: "tetanise", valeur: 1, toursRestants: 1 }];
    const ennemis = fabriquerEnnemis("combat_2");
    ennemis.forEach((e) => { e.resistances = {}; e.pvActuels = 500; e.pvMax = 500; });
    const arriere = ennemis.filter((e) => e.position >= 4);
    expect(arriere.length).toBeGreaterThan(0);
    const cibles = ciblesValides(c, SORTS.sournoiserie, [c, ...ennemis]).map((x) => x.ref);
    for (const e of arriere) expect(cibles, e.ref).not.toContain(e.ref);
  });

  it("inflige ses petits dégâts ET échange la rangée de la cible (toggle)", () => {
    const c = sram();
    const e = mannequin();
    e.position = 0; // avant
    const avantPV = e.pvActuels;
    lancerSort(c, SORTS.sournoiserie, e.ref, [c, e], ctx());
    expect(e.pvActuels).toBeLessThan(avantPV); // les dégâts sont bien infligés
    expect(e.position).toBeGreaterThanOrEqual(4); // et la cible a changé de rangée
  });
});

describe("pose d'un piège : aucun dégât au lancer, la résolution est réservée au déclenchement", () => {
  it("Piège Funeste ne touche pas la cible au lancer, mais enregistre le piège", () => {
    const c = sram();
    const e = mannequin();
    const avantPV = e.pvActuels;
    lancerSort(c, SORTS.piege_funeste, e.ref, [c, e], ctx());
    expect(e.pvActuels).toBe(avantPV); // AUCUN dégât à la pose — c'est le point délicat de la tâche
    expect(c.pieges).toEqual([{ sortId: "piege_funeste", camp: e.camp, avant: e.position < 4 } satisfies Piege]);
  });

  it("Piège à Fragmentation ne touche pas la cible au lancer, mais enregistre le piège", () => {
    const c = sram();
    const e = mannequin();
    const avantPV = e.pvActuels;
    lancerSort(c, SORTS.piege_a_fragmentation, e.ref, [c, e], ctx());
    expect(e.pvActuels).toBe(avantPV); // AUCUN dégât à la pose
    expect(c.pieges).toEqual([{ sortId: "piege_a_fragmentation", camp: e.camp, avant: e.position < 4 } satisfies Piege]);
  });
});

describe("Piège Funeste : majoration au déclenchement", () => {
  it("+30 % par autre ennemi vivant sur la ligne de la cible, lu au déclenchement (pas à la pose)", () => {
    // Le piège est posé à la main (sortId réel "piege_funeste") pour isoler la
    // mesure de la majoration du reste du pipeline de lancer — la pose elle-même
    // est prouvée sans dégât ci-dessus. Le mouvement qui déclenche est un sort
    // synthétique sans dégât propre (baseMax 0) pour n'attribuer AUCUN dégât au
    // mouvement lui-même, seulement au piège.
    const sortMouvement = { ...SORTS.roublabot, id: "test_mouvement_funeste", baseMin: 0, baseMax: 0, scaling: 0 };

    // Scénario A : la cible déplacée est SEULE sur la rangée surveillée à l'arrivée.
    const poseurA = sram();
    const cibleA = mannequin();
    cibleA.position = 4; // arrière, sera basculée vers l'avant (rangée surveillée)
    poseurA.pieges = [{ sortId: "piege_funeste", camp: cibleA.camp, avant: true }];
    const avantA = cibleA.pvActuels;
    lancerSort(poseurA, sortMouvement, cibleA.ref, [poseurA, cibleA], ctx());
    const dmgA = avantA - cibleA.pvActuels;
    expect(dmgA).toBeGreaterThan(0);

    // Scénario B : IDENTIQUE, plus UN autre ennemi déjà présent et vivant sur la
    // rangée avant surveillée au moment du déclenchement.
    const poseurB = sram();
    const cibleB = mannequin();
    cibleB.position = 4;
    const autreB = mannequin();
    autreB.position = 0; // déjà en rangée avant
    poseurB.pieges = [{ sortId: "piege_funeste", camp: cibleB.camp, avant: true }];
    const avantB = cibleB.pvActuels;
    lancerSort(poseurB, sortMouvement, cibleB.ref, [poseurB, cibleB, autreB], ctx());
    const dmgB = avantB - cibleB.pvActuels;

    expect(dmgB).toBe(Math.round(dmgA * 1.3));
    // l'« autre ennemi » lui-même n'est pas touché : Piège Funeste n'a pas de
    // rider d'éclaboussure, seule la cible du déclenchement encaisse.
    expect(autreB.pvActuels).toBe(9999);
  });
});

describe("Piège à Fragmentation : éclaboussure au déclenchement", () => {
  it("touche la cible à plein, et le reste de sa rangée à moitié dégâts", () => {
    const poseur = sram();
    const cible = mannequin();
    cible.position = 4; // arrière, sera basculée vers l'avant (rangée surveillée)
    const autre = mannequin();
    autre.position = 0; // déjà en rangée avant : reçoit l'éclaboussure
    poseur.pieges = [{ sortId: "piege_a_fragmentation", camp: cible.camp, avant: true }];

    const sortMouvement = { ...SORTS.roublabot, id: "test_mouvement_fragmentation", baseMin: 0, baseMax: 0, scaling: 0 };
    const avantCible = cible.pvActuels;
    const avantAutre = autre.pvActuels;
    lancerSort(poseur, sortMouvement, cible.ref, [poseur, cible, autre], ctx());

    const dmgCible = avantCible - cible.pvActuels;
    const dmgAutre = avantAutre - autre.pvActuels;
    expect(dmgCible).toBeGreaterThan(0);
    expect(dmgAutre).toBe(Math.round(dmgCible * 0.5));
  });
});

// Décision de conception explicitée dans le plan : TOUT déplacement de rangée
// déclenche un piège, y compris ceux imposés par d'AUTRES classes. Les quatre
// sorts ci-dessous existaient déjà avant ce rework (Flèche de recul du Cra,
// Pendule du Xélor, Roublabot du Roublard, Tibias de l'Ouginak) et aucun n'a été
// modifié pour ce chantier. Pendule, Roublabot et Tibias passent par la
// résolution GÉNÉRIQUE de `sort.deplaceCible` dans `lancerSort` ; Flèche de recul
// a son propre handler dédié (`lancerFlecheDeRecul`) qui appelle `deplacerCible`
// en dur pour sa bousculade — mais les QUATRE finissent par `deplacerCible`,
// point de passage unique où `declencherPiege` est branché (tâche 1) : aucun n'a
// eu besoin de code dédié AU PIÈGE lui-même, seule Flèche de recul en avait déjà
// un pour sa propre mécanique de bousculade.
describe("quatre sorts d'autres classes déclenchent réellement un piège du Sram", () => {
  function deuxEnnemisAvantArriere(): [Combatant, Combatant] {
    const [avant, arriere] = fabriquerEnnemis("combat_2");
    avant.resistances = {}; avant.pvMax = 9999; avant.pvActuels = 9999; avant.position = 0;
    arriere.resistances = {}; arriere.pvMax = 9999; arriere.pvActuels = 9999; arriere.position = 4;
    return [avant, arriere];
  }

  it("Flèche de recul (Cra) : pousse la cible en arrière et déclenche un piège qui y attend", () => {
    // Flèche de recul inflige elle-même des dégâts de bousculade (collision à
    // l'arrivée, cf. `lancerFlecheDeRecul`) : `pvActuels` en baisse est vrai QUE le
    // piège se déclenche ou non. La preuve du déclenchement est donc un ÉCART —
    // comparé à un lancer témoin SANS piège — pas la seule baisse de PV.
    const [avantTemoin, arriereTemoin] = deuxEnnemisAvantArriere();
    const craTemoin = equipeCombattante(nouvelleRun(["cra"]))[0];
    lancerSort(craTemoin, SORTS.fleche_de_recul, avantTemoin.ref, [craTemoin, avantTemoin, arriereTemoin], ctx());
    const dmgSeul = 9999 - avantTemoin.pvActuels;
    expect(dmgSeul).toBeGreaterThan(0); // le sort seul frappe déjà (bousculade)

    const cra = equipeCombattante(nouvelleRun(["cra"]))[0];
    const [avant, arriere] = deuxEnnemisAvantArriere();
    const cs = [cra, avant, arriere];
    // Un piège porté par un tiers (ici la Cra elle-même — le champ `pieges` est
    // générique sur `Combatant`, pas réservé au Sram) surveille la rangée arrière.
    cra.pieges = [{ sortId: "piege_funeste", camp: "ennemi", avant: false }];
    const avantPV = avant.pvActuels;
    lancerSort(cra, SORTS.fleche_de_recul, avant.ref, cs, ctx());
    expect(avant.position).toBeGreaterThanOrEqual(4); // effectivement repoussé en arrière
    const dmgAvecPiege = avantPV - avant.pvActuels;
    expect(dmgAvecPiege).toBeGreaterThan(dmgSeul); // le piège a ajouté SES dégâts, au-delà de la bousculade seule
    expect(cra.pieges).toHaveLength(0); // le piège s'est déclenché
    expect(cra.chausseTrappe).toBe(1);
  });

  it("Pendule (Xélor) : bascule la cible sur la rangée opposée et déclenche un piège qui y attend", () => {
    const xelor = equipeCombattante(nouvelleRun(["xelor"]))[0];
    const [avant, arriere] = deuxEnnemisAvantArriere();
    const cs = [xelor, avant, arriere];
    xelor.pieges = [{ sortId: "piege_funeste", camp: "ennemi", avant: false }];
    const avantPV = avant.pvActuels;
    lancerSort(xelor, SORTS.pendule, avant.ref, cs, ctx());
    expect(avant.position).toBeGreaterThanOrEqual(4);
    expect(avant.pvActuels).toBeLessThan(avantPV);
    expect(xelor.pieges).toHaveLength(0);
    expect(xelor.chausseTrappe).toBe(1);
  });

  it("Roublabot (Roublard) : bascule un ennemi sur la rangée opposée et déclenche un piège qui y attend", () => {
    const roublard = equipeCombattante(nouvelleRun(["roublard"]))[0];
    const [avant, arriere] = deuxEnnemisAvantArriere();
    const cs = [roublard, avant, arriere];
    roublard.pieges = [{ sortId: "piege_funeste", camp: "ennemi", avant: false }];
    const avantPV = avant.pvActuels;
    lancerSort(roublard, SORTS.roublabot, avant.ref, cs, ctx());
    expect(avant.position).toBeGreaterThanOrEqual(4);
    expect(avant.pvActuels).toBeLessThan(avantPV);
    expect(roublard.pieges).toHaveLength(0);
    expect(roublard.chausseTrappe).toBe(1);
  });

  it("Tibias (Ouginak) : repousse la cible principale en arrière et déclenche un piège qui y attend", () => {
    // Tibias inflige lui-même des dégâts de zone (zoneLigne) sur la rangée AVANT
    // avant de repousser sa cible principale : `pvActuels` en baisse est vrai QUE
    // le piège se déclenche ou non. Même méthode que Flèche de recul — un lancer
    // témoin sans piège isole la part du piège dans le total.
    const [avantTemoin, arriereTemoin] = deuxEnnemisAvantArriere();
    const ouginakTemoin = equipeCombattante(nouvelleRun(["ouginak"]))[0];
    lancerSort(ouginakTemoin, SORTS.tibias, avantTemoin.ref, [ouginakTemoin, avantTemoin, arriereTemoin], ctx());
    const dmgSeul = 9999 - avantTemoin.pvActuels;
    expect(dmgSeul).toBeGreaterThan(0); // le sort seul frappe déjà (zoneLigne)

    const ouginak = equipeCombattante(nouvelleRun(["ouginak"]))[0];
    const [avant, arriere] = deuxEnnemisAvantArriere();
    const cs = [ouginak, avant, arriere];
    ouginak.pieges = [{ sortId: "piege_funeste", camp: "ennemi", avant: false }];
    const avantPV = avant.pvActuels;
    lancerSort(ouginak, SORTS.tibias, avant.ref, cs, ctx());
    expect(avant.position).toBeGreaterThanOrEqual(4);
    const dmgAvecPiege = avantPV - avant.pvActuels;
    expect(dmgAvecPiege).toBeGreaterThan(dmgSeul); // le piège a ajouté SES dégâts, au-delà de Tibias seul
    expect(ouginak.pieges).toHaveLength(0);
    expect(ouginak.chausseTrappe).toBe(1);
  });
});

describe("Attaque Mortelle : majore avec le Chausse-Trappe, puis remet le compteur à zéro", () => {
  it("+15 % par cumul de Chausse-Trappe, et consomme le compteur après lecture", () => {
    const c = sram();
    const e = mannequin();
    const avantPV = e.pvActuels;
    lancerSort(c, SORTS.attaque_mortelle, e.ref, [c, e], ctx());
    const dmgSansCumul = avantPV - e.pvActuels;
    expect(dmgSansCumul).toBeGreaterThan(0);
    expect(c.chausseTrappe ?? 0).toBe(0); // rien à consommer, mais explicitement remis à zéro

    const c2 = sram();
    c2.chausseTrappe = 3; // simule 3 déclenchements de piège déjà crédités
    const e2 = mannequin();
    const avantPV2 = e2.pvActuels;
    lancerSort(c2, SORTS.attaque_mortelle, e2.ref, [c2, e2], ctx());
    const dmgAvecCumul = avantPV2 - e2.pvActuels;
    expect(dmgAvecCumul).toBe(Math.round(dmgSansCumul * (1 + 0.15 * 3)));
    expect(c2.chausseTrappe).toBe(0); // consommé après lecture
  });
});

describe("Concentration de Chakra : majore le prochain piège déclenché, pour 1 tour", () => {
  it("pose bien un effet `bonusPieges` de 50 % sur le lanceur, et il majore le déclenchement suivant", () => {
    const c = sram();
    lancerSort(c, SORTS.concentration_de_chakra, c.ref, [c], ctx());
    expect(c.effets).toEqual([{ stat: "bonusPieges", valeur: 0.5, toursRestants: 1 }]);

    // Sans Chakra : baseline.
    const cSansChakra = sram();
    const cibleSans = mannequin();
    cibleSans.position = 4;
    cSansChakra.pieges = [{ sortId: "piege_funeste", camp: cibleSans.camp, avant: true }];
    const sortMouvement = { ...SORTS.roublabot, id: "test_mouvement_chakra_sans", baseMin: 0, baseMax: 0, scaling: 0 };
    const avantSans = cibleSans.pvActuels;
    lancerSort(cSansChakra, sortMouvement, cibleSans.ref, [cSansChakra, cibleSans], ctx());
    const dmgSans = avantSans - cibleSans.pvActuels;
    expect(dmgSans).toBeGreaterThan(0);

    // Avec Chakra actif sur le POSEUR : le déclenchement suivant est majoré de 50 %.
    const cAvecChakra = sram();
    lancerSort(cAvecChakra, SORTS.concentration_de_chakra, cAvecChakra.ref, [cAvecChakra], ctx());
    const cibleAvec = mannequin();
    cibleAvec.position = 4;
    cAvecChakra.pieges = [{ sortId: "piege_funeste", camp: cibleAvec.camp, avant: true }];
    const sortMouvement2 = { ...SORTS.roublabot, id: "test_mouvement_chakra_avec", baseMin: 0, baseMax: 0, scaling: 0 };
    const avantAvec = cibleAvec.pvActuels;
    lancerSort(cAvecChakra, sortMouvement2, cibleAvec.ref, [cAvecChakra, cibleAvec], ctx());
    const dmgAvec = avantAvec - cibleAvec.pvActuels;
    expect(dmgAvec).toBe(Math.round(dmgSans * 1.5));
  });
});

describe("Brume : partage l'esquive du lanceur avec la rangée de la cible", () => {
  it("pose sur l'allié ciblé (et sa rangée) un effet `esquive` égal à l'agilité du lanceur × 0,002, pour 2 tours", () => {
    const team = equipeCombattante(nouvelleRun(["sram", "iop", "cra"]));
    const [c, memeRangee, autreRangee] = team;
    c.stats = { ...c.stats, agilite: 100, chance: 0, intelligence: 0 };
    c.position = 0; memeRangee.position = 1; autreRangee.position = 4;

    lancerSort(c, SORTS.brume, memeRangee.ref, team, ctx());

    const attendu = { stat: "esquive", valeur: 100 * 0.002, toursRestants: 2, viaBrume: true };
    expect(memeRangee.effets).toEqual([attendu]); // la cible visée
    expect(c.effets).toEqual([attendu]); // le lanceur, sur la MÊME rangée
    expect(autreRangee.effets).toEqual([]); // rangée arrière : hors portée
  });
});
