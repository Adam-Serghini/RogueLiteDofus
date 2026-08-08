// =============================================================================
//  iop.test.ts — Le kit RÉEL du Iop (6 sorts, paire air+eau). Les primitives
//  moteur qu'il emploie (bonusParRelanceCeTour, bonusParLancerCombat, ratioLigne,
//  bouclierPortee, paImmediat) sont déjà couvertes contre des sorts synthétiques
//  dans iop-moteur.test.ts : ici on vérifie le CONTENU réel — les valeurs
//  exactes du tableau du plan, la disparition des 8 anciens sorts, la nouvelle
//  paire d'éléments, et le combo Précipitation → Zénith qui prouve l'intention
//  du kit (dépenser tout son PA bar d'un coup avant de le décharger).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, ciblesValides, type CombatCtx } from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Iop prêt à combattre : agilité et chance nulles par défaut (esquive/crit/
 *  scaling élémentaire déterministes) — les tests qui ont besoin de contrôler
 *  l'attaque redéfinissent ces stats explicitement. */
function iop(): Combatant {
  const c = equipeCombattante(nouvelleRun(["iop"]))[0];
  c.stats = { ...c.stats, agilite: 0, chance: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

/** Un mannequin ennemi sans résistances, PV confortables. */
let mannequinSeq = 0;
function mannequin(): Combatant {
  const e = fabriquerEnnemis("combat_1")[0];
  e.ref = `${e.ref}_${mannequinSeq++}`;
  e.stats = { ...e.stats, agilite: 0 };
  e.resistances = {};
  e.pvMax = 500; e.pvActuels = 500;
  return e;
}

const KIT = ["zenith", "pugilat", "endurance", "colere_de_iop", "precipitation", "vertu"];
const RETIRES = [
  "epee_celeste", "epee_divine", "tempete_lames", "fracas",
  "colere", "epee_jugement", "duel", "vitalite",
];

describe("la classe", () => {
  it("frappe désormais en air et en eau (plus terre+feu)", () => {
    expect(CLASSES.iop.elements).toEqual(["air", "eau"]);
  });

  it("son kit est EXACTEMENT les 6 nouveaux sorts, dans cet ordre", () => {
    expect(CLASSES.iop.sorts).toEqual(KIT);
  });

  it("les 8 anciens sorts ont disparu du contenu", () => {
    for (const id of RETIRES) expect(SORTS[id as keyof typeof SORTS], id).toBeUndefined();
  });

  it("les 8 anciens sorts ne figurent dans le kit d'AUCUNE classe", () => {
    for (const classe of Object.values(CLASSES)) {
      for (const id of RETIRES) expect(classe.sorts, `${classe.id} ↔ ${id}`).not.toContain(id);
    }
  });

  // La répartition élémentaire des 11 jouables est un invariant GLOBAL vérifié dans
  // `archetypes.test.ts` (seul propriétaire de la synchro avec `CLASSES-ELEMENTS.md`),
  // pas ici — la dupliquer par classe forcerait N fichiers à changer pour un seul
  // invariant, et un oubli ferait échouer les tests d'une AUTRE classe (retiré au
  // rework du Sram, qui l'avait trouvée dupliquée ici).

  it("les 6 identifiants de sort correspondent aux 6 fichiers d'icônes, dans les DEUX sens", () => {
    // `import.meta.glob` (natif Vite/Vitest, aucun type Node requis) plutôt que
    // `node:fs` : une déclaration ambiante pour `node:fs` rendrait `readdirSync`
    // légal depuis N'IMPORTE QUEL module de src/, `combat.ts` compris — une érosion
    // du moteur pur que le projet défend ailleurs, pour un besoin qui n'existe que
    // dans CE test.
    const modules = import.meta.glob("/public/assets/spells/iop/*.png", { eager: true });
    const fichiers = Object.keys(modules)
      .map((chemin) => chemin.replace(/^.*\//, "").replace(/\.png$/, ""))
      .sort();
    expect(fichiers).toEqual([...KIT].sort());
  });
});

// Les 5 descriptions ci-dessous sont des chaînes LITTÉRALES, pas `SORTS.x.desc` (qui se
// compare à lui-même et laisse passer une description vidée ou modifiée en silence).
// Ça compte double pour ce kit : `sortTooltipHtml` (ui/composants.ts) ne connaît AUCUN
// des 5 champs neufs du moteur (bonusParPADispo, ratioLigne, bonusParRelanceCeTour,
// bonusParLancerCombat, bouclierPortee, paImmediat) — l'escalade, l'éclaboussure, le
// bouclier de rangée et le gain de PA n'atteignent le joueur QUE par ce texte libre.
describe("valeurs des 6 sorts (coûts, jets, scalings, cibles, recharges, objets imbriqués)", () => {
  it("Zénith", () => {
    expect(SORTS.zenith).toEqual({
      id: "zenith", nom: "Zénith", type: "degats", cible: "ennemi_ligne",
      coutPA: 4, baseMin: 7, baseMax: 11, scaling: 0.32,
      zoneLigne: true, bonusParPADispo: 0.07,
      desc: "Dégâts de zone sur toute la rangée ciblée ; +7 % de dégâts par PA disponible AVANT de lancer le sort — le compteur n'est PAS plafonné par les PA de base du Iop, et les PA gagnés en cours de tour (Précipitation) comptent aussi : ouvrir par Précipitation avant Zénith vide toute la barre de PA au meilleur taux.",
    });
  });

  it("Pugilat", () => {
    expect(SORTS.pugilat).toEqual({
      id: "pugilat", nom: "Pugilat", type: "degats", cible: "ennemi_ligne",
      coutPA: 2, baseMin: 5, baseMax: 8, scaling: 0.22,
      maxParCibleParTour: 1, ratioLigne: 0.5, bonusParRelanceCeTour: 0.2,
      desc: "Dégâts modérés à la cible, moitié dégâts au reste de sa rangée ; +20 % (l'ensemble du coup, éclaboussure comprise) à chaque relance du sort dans le même tour, sur une AUTRE cible (une seule fois par cible et par tour).",
    });
  });

  it("Endurance", () => {
    expect(SORTS.endurance).toEqual({
      id: "endurance", nom: "Endurance", type: "degats", cible: "ennemi_ligne",
      coutPA: 2, baseMin: 6, baseMax: 9, scaling: 0.25,
      maxParTour: 2, bouclierPortee: { portee: "soi", pct: 0.08, tours: 1 },
      desc: "Dégâts modérés ; le Iop se boucliere de 8 % de ses PV max pour 1 tour (cumulable si relancé dans le même tour).",
    });
  });

  it("Colère de Iop", () => {
    expect(SORTS.colere_de_iop).toEqual({
      id: "colere_de_iop", nom: "Colère de Iop", type: "degats", cible: "ennemi_ligne",
      coutPA: 5, baseMin: 16, baseMax: 22, scaling: 0.55, cooldownTours: 2,
      bonusParLancerCombat: 0.5,
      desc: "Très gros dégâts ; +50 % à chaque lancer PRÉCÉDENT de ce sort depuis le début du combat (100 %, puis 150 %, puis 200 %…).",
    });
  });

  it("Précipitation", () => {
    expect(SORTS.precipitation).toEqual({
      id: "precipitation", nom: "Précipitation", type: "buff", cible: "soi",
      coutPA: 0, baseMin: 0, baseMax: 0, scaling: 0, cooldownTours: 3,
      maxParTour: 1, paImmediat: 3,
      desc: "Ne coûte AUCUN PA ; crédite immédiatement 3 PA à dépenser ce tour-ci (perdus à la fin du tour si non utilisés).",
    });
  });

  it("Vertu", () => {
    expect(SORTS.vertu).toEqual({
      id: "vertu", nom: "Vertu", type: "buff", cible: "soi",
      coutPA: 3, baseMin: 0, baseMax: 0, scaling: 0, cooldownTours: 3,
      bouclierPortee: { portee: "rangee_lanceur", pct: 0.15, tours: 2 },
      desc: "Boucliere toute la rangée du Iop (lui compris) de 15 % des PV max de chacun, pour 2 tours.",
    });
  });
});

describe("Zénith", () => {
  it("frappe TOUTE la rangée ciblée (zoneLigne)", () => {
    const c = iop();
    const ennemis = fabriquerEnnemis("combat_2"); // 0,1 (avant) + 4 (arrière)
    ennemis.forEach((e) => { e.stats = { ...e.stats, agilite: 0 }; e.pvActuels = 500; e.pvMax = 500; e.resistances = {}; });
    const avant = ennemis.filter((e) => e.position < 4);
    const arriere = ennemis.filter((e) => e.position >= 4);
    lancerSort(c, SORTS.zenith, avant[0].ref, [c, ...ennemis], ctx());
    expect(avant.every((e) => e.pvActuels < 500)).toBe(true); // toute la ligne avant touchée
    expect(arriere.every((e) => e.pvActuels === 500)).toBe(true); // l'arrière épargné
  });

  it("compte les PA disponibles AVANT paiement : à 6 PA dispo il applique +42 % (6×7 %)", () => {
    const c = iop();
    const e = mannequin();
    // « 6 PA dispo avant paiement » : la boucle de combat aurait déjà débité paActuels
    // de coutPA (4) avant d'appeler lancerSort → paActuels vaut 6 - 4 = 2 ici, comme
    // dans le test équivalent de Flèche Punitive (cra.test.ts).
    c.paActuels = 6;
    c.paActuels -= SORTS.zenith.coutPA;
    lancerSort(c, SORTS.zenith, e.ref, [c, e], ctx());
    // jet max = 11 (7-11), stats à 0 → aucun bonus élémentaire → 11 * (1 + 0,07*6)
    expect(500 - e.pvActuels).toBe(Math.round(11 * (1 + 0.07 * 6)));
  });

  it("le COMBO Précipitation → Zénith : Zénith compte 9 PA (6 de départ + 3 crédités − 0 payés par Précipitation)", () => {
    // C'est le test qui prouve l'intention du kit : Précipitation gonfle la barre de
    // PA d'un tour pour que Zénith la vide entièrement au meilleur taux.
    const c = iop();
    expect(c.paMax).toBe(6); // le Iop a 6 PA de base (CLASSES.iop.pa)
    c.paActuels = c.paMax;
    const e = mannequin();

    // Précipitation coûte 0 PA : la boucle de combat ne débite rien avant l'appel.
    lancerSort(c, SORTS.precipitation, c.ref, [c, e], ctx());
    expect(c.paActuels).toBe(9); // 6 + 3 crédités immédiatement

    // Zénith coûte 4 PA : la boucle de combat les aurait débités avant l'appel (9 → 5).
    c.paActuels -= SORTS.zenith.coutPA;
    lancerSort(c, SORTS.zenith, e.ref, [c, e], ctx());
    // jet max = 11, +7 % par PA dispo AVANT paiement = 9 → 11 * (1 + 0,07*9)
    expect(500 - e.pvActuels).toBe(Math.round(11 * (1 + 0.07 * 9)));
  });
});

describe("Pugilat", () => {
  it("touche la cible à plein, le reste de sa rangée à moitié, et escalade de +20 % à la relance", () => {
    const c = iop();
    // `iop()` met agilité ET chance à 0 par défaut : à stats nulles, le jet de base
    // (8) est le SEUL contributeur et l'arrondi écrase l'écart entre +20 % et +30 %
    // (round(8*1.2)=10, round(8*1.3)=10 aussi) — un sabotage du taux ne serait pas vu.
    // La chance (eau, un des 2 éléments du Iop) est montée à 50 pour que les paliers
    // se séparent réellement : jet max 8 + 50*0.22 = 19 → round(19*1.2)=23 ≠ round(19*1.3)=25.
    c.stats = { ...c.stats, chance: 50 };
    const ennemis = fabriquerEnnemis("combat_3"); // 3 en rangée avant
    ennemis.forEach((e, i) => {
      e.stats = { ...e.stats, agilite: 0 }; e.position = i; e.pvActuels = 9999; e.pvMax = 9999; e.resistances = {};
    });
    const [c0, c1] = ennemis;
    const cs = [c, ...ennemis];

    const avant0 = c0.pvActuels;
    const avant1 = c1.pvActuels;
    lancerSort(c, SORTS.pugilat, c0.ref, cs, ctx());
    const dmgPrincipal = avant0 - c0.pvActuels;
    const dmgEclabousse = avant1 - c1.pvActuels;
    expect(dmgEclabousse).toBe(Math.round(dmgPrincipal * 0.5)); // moitié dégâts, ratioLigne

    // relance sur une AUTRE cible (maxParCibleParTour: 1) dans le même tour : +20 %
    const c2 = ennemis[2];
    const avant2 = c2.pvActuels;
    lancerSort(c, SORTS.pugilat, c2.ref, cs, ctx());
    const dmgRelance = avant2 - c2.pvActuels;
    expect(dmgRelance).toBe(Math.round(dmgPrincipal * 1.2));
  });
});

describe("Endurance", () => {
  it("inflige des dégâts et boucliere le Iop lui-même de 8 % de ses PV max (portee: soi)", () => {
    const c = iop();
    c.pvMax = 300; c.pvActuels = 300;
    const e = mannequin();
    lancerSort(c, SORTS.endurance, e.ref, [c, e], ctx());
    expect(e.pvActuels).toBeLessThan(500);
    expect(c.bouclier).toBe(24); // round(300 * 0.08)
    expect(c.boucliersTemporaires).toEqual([{ montant: 24, tours: 1 }]);
  });
});

describe("Colère de Iop", () => {
  it("escalade de +50 % à chaque lancer précédent depuis le début du combat", () => {
    const c = iop();
    c.cooldowns = {}; // permet 2 lancers malgré cooldownTours: 2, sur des cibles distinctes
    const e1 = mannequin(); e1.pvActuels = 9999; e1.pvMax = 9999;
    const e2 = mannequin(); e2.pvActuels = 9999; e2.pvMax = 9999;
    const cs = [c, e1, e2];

    const avant1 = e1.pvActuels;
    lancerSort(c, SORTS.colere_de_iop, e1.ref, cs, ctx());
    const dmg1 = avant1 - e1.pvActuels;

    c.cooldowns = {}; // la recharge n'est pas l'objet de ce test
    const avant2 = e2.pvActuels;
    lancerSort(c, SORTS.colere_de_iop, e2.ref, cs, ctx());
    const dmg2 = avant2 - e2.pvActuels;

    expect(dmg2).toBe(Math.round(dmg1 * 1.5));
  });
});

describe("Précipitation", () => {
  it("crédite 3 PA immédiatement, sur paActuels, et coûte 0 PA", () => {
    const c = iop();
    c.paActuels = 6;
    lancerSort(c, SORTS.precipitation, c.ref, [c], ctx());
    expect(c.paActuels).toBe(9);
  });

  it("ne bloque pas la fin de tour automatique : plus aucune cible valide après un lancer", () => {
    // `aUneActionPossible` (ui/combat.ts) ne fait que ceci pour chaque sort :
    // `paActuels >= s.coutPA && ciblesValides(...).length > 0`. Précipitation coûte
    // 0 PA, donc la condition de PA est TOUJOURS vraie — c'est `ciblesValides` seule
    // qui doit devenir vide pour que la fin de tour automatique redevienne possible.
    // Précipitation porte DEUX limites indépendantes (`maxParTour: 1` ET
    // `cooldownTours: 3`), chacune suffisant À ELLE SEULE à vider `ciblesValides` :
    // retirer l'une des deux laisse ce test vert grâce à l'autre — la propriété prouvée
    // ici est « ciblesValides devient vide après un lancer », pas « c'est maxParTour ».
    const c = iop();
    expect(ciblesValides(c, SORTS.precipitation, [c]).length).toBeGreaterThan(0);
    lancerSort(c, SORTS.precipitation, c.ref, [c], ctx());
    expect(ciblesValides(c, SORTS.precipitation, [c]).length).toBe(0);
  });
});

describe("Vertu", () => {
  it("boucliere TOUTE la rangée du Iop, lui COMPRIS (portee: rangee_lanceur)", () => {
    const team = equipeCombattante(nouvelleRun(["iop", "cra", "eniripsa"]));
    const [c, memeRangee, autreRangee] = team;
    c.position = 0; memeRangee.position = 1; autreRangee.position = 4;
    [c, memeRangee, autreRangee].forEach((x) => { x.pvMax = 200; x.pvActuels = 200; });

    lancerSort(c, SORTS.vertu, c.ref, team, ctx());

    expect(c.bouclier).toBe(30); // round(200 * 0.15) — le lanceur lui-même
    expect(memeRangee.bouclier).toBe(30); // même rangée
    expect(autreRangee.bouclier).toBe(0); // rangée arrière : hors portée
    expect(c.boucliersTemporaires).toEqual([{ montant: 30, tours: 2 }]);
  });
});
