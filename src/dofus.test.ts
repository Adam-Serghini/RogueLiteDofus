// =============================================================================
//  dofus.test.ts — effets des reliques : modèle, données, déclenchements.
// =============================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { DOFUS } from "./data";
import {
  chargerMeta, ajouterDofus, bonusEquipe, reliquesActives, meilleurJet,
  equipeCombattante, nouvelleRun, fabriquerEnnemis,
} from "./run";
import type { Meta, Combatant, Action } from "./types";
import type { CombatCtx } from "./combat";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const metaVide = (): Meta => ({ version: 3, dofus: [], archis: [], runs: 0, victoires: 0 });

describe("modèle des reliques", () => {
  beforeEach(() => store.clear());

  it("une sauvegarde en chaînes est convertie en exemplaires", () => {
    store.set("rld_meta_v0", JSON.stringify({
      version: 2, dofus: ["dofus_pourpre", "dofus_pourpre", "dofawa"],
      archis: [], runs: 1, victoires: 0,
    }));
    const meta = chargerMeta();
    expect(meta.dofus).toEqual([
      { id: "dofus_pourpre" }, { id: "dofus_pourpre" }, { id: "dofawa" },
    ]);
    expect(meta.version).toBe(3);
  });

  it("la conversion ne passe QU'UNE FOIS", () => {
    store.set("rld_meta_v0", JSON.stringify({ version: 2, dofus: ["dofawa"], archis: [], runs: 0, victoires: 0 }));
    const meta = chargerMeta();
    ajouterDofus(meta, "dofus_pourpre"); // persiste en version 3
    expect(chargerMeta().dofus).toEqual([{ id: "dofawa" }, { id: "dofus_pourpre" }]);
  });

  it("les exemplaires supplémentaires n'ajoutent RIEN à l'effet", () => {
    // dofus_pourpre porte statsElementaires:6 : trois exemplaires doivent donner
    // exactement 6, pas 18 — une relique SANS effet ne prouverait rien (deux
    // résultats nuls sont égaux même sans dédoublonnage).
    const un = metaVide(); un.dofus = [{ id: "dofus_pourpre" }];
    const trois = metaVide(); trois.dofus = [{ id: "dofus_pourpre" }, { id: "dofus_pourpre" }, { id: "dofus_pourpre" }];
    expect(bonusEquipe(un).statsElementaires).toBe(6);
    expect(bonusEquipe(trois)).toEqual(bonusEquipe(un));
  });

  it("reliquesActives dédoublonne", () => {
    const meta = metaVide();
    meta.dofus = [{ id: "dofawa" }, { id: "dofawa" }, { id: "dofus_ivoire" }];
    expect([...reliquesActives(meta)].sort()).toEqual(["dofawa", "dofus_ivoire"]);
  });

  it("meilleurJet retient le plus haut, undefined si la relique est absente", () => {
    const meta = metaVide();
    meta.dofus = [{ id: "dofus_kaliptus", jet: 7 }, { id: "dofus_kaliptus", jet: 22 }, { id: "dofus_kaliptus", jet: 3 }];
    expect(meilleurJet(meta, "dofus_kaliptus")).toBe(22);
    expect(meilleurJet(meta, "dofawa")).toBeUndefined();
  });

  it("aucune relique ne déclare plus d'effet PAR COPIE", () => {
    // Le modèle par copie et son plafond `maxCopies` ont disparu : leur survivance
    // dans les données ferait croire à un cumul qui n'existe plus.
    for (const d of Object.values(DOFUS)) {
      expect(d, d.id).not.toHaveProperty("bonusDegatsParCopie");
      expect(d, d.id).not.toHaveProperty("maxCopies");
    }
  });

  it("une sauvegarde déjà en version 2 garde ses records d'Ascension INTACTS au passage en 3", () => {
    // Le garde qui remet les records d'Ascension à zéro est figé à `< 2` (la version
    // de la refonte de l'Ascension), DÉCOUPLÉ de META_VERSION (passé à 3 pour les
    // reliques). Si quelqu'un le rebranchait un jour sur META_VERSION, ce test tombe :
    // sans lui, un joueur déjà migré verrait ses records effacés pour rien.
    store.set("rld_meta_v0", JSON.stringify({
      version: 2, dofus: ["dofawa"], archis: [], runs: 3, victoires: 1,
      ascension: { t1: 5, t2: 2 },
    }));
    const meta = chargerMeta();
    expect(meta.version).toBe(3);
    expect(meta.ascension).toEqual({ t1: 5, t2: 2 });
  });
});

describe("effets chiffrés", () => {
  const avec = (...ids: string[]): Meta => ({ ...metaVide(), dofus: ids.map((id) => ({ id })) });

  it("chaque relique chiffrée produit son bonus, et rien d'autre", () => {
    expect(bonusEquipe(avec("dofus_ivoire")).resAllBonus).toBe(0.05);
    expect(bonusEquipe(avec("dofus_ebene")).damageMult).toBeCloseTo(1.01);
    expect(bonusEquipe(avec("dofus_turquoise")).critPlat).toBe(10);
    expect(bonusEquipe(avec("dofus_des_glaces")).perceResistances).toBe(0.05);
    expect(bonusEquipe(avec("dofus_pourpre")).statsElementaires).toBe(6);
    expect(bonusEquipe(avec("dolmanax")).statsElementaires).toBe(10);
    expect(bonusEquipe(avec("dofawa")).pvBonus).toBe(1);
  });

  it("les bonus de plusieurs reliques s'additionnent entre elles", () => {
    expect(bonusEquipe(avec("dofus_pourpre", "dolmanax")).statsElementaires).toBe(16);
  });

  it("statsElementaires monte les QUATRE stats élémentaires du combattant", async () => {
    const { equipeCombattante, nouvelleRun, appliquerBonusEquipeCombat } = await import("./run");
    const equipe = equipeCombattante(nouvelleRun(["iop"]));
    const avantF = equipe[0].stats.force;
    const avantI = equipe[0].stats.intelligence;
    appliquerBonusEquipeCombat(equipe, bonusEquipe(avec("dofus_pourpre")));
    expect(equipe[0].stats.force).toBe(avantF + 6);
    expect(equipe[0].stats.intelligence).toBe(avantI + 6);
  });

  it("le perce-résistances du Dofus s'ajoute à celui du sort", async () => {
    const { degatsCible } = await import("./combat");
    const { equipeCombattante, nouvelleRun, fabriquerEnnemis } = await import("./run");
    const { SORTS, CLASSES } = await import("./data");
    const [heros] = equipeCombattante(nouvelleRun(["iop"]));
    heros.stats = { ...heros.stats, agilite: 0 };
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.stats = { ...cible.stats, agilite: 0 };
    cible.resistances = { terre: 0.5, feu: 0.5, air: 0.5, eau: 0.5 };
    const sort = SORTS[CLASSES.iop.sorts[1] as keyof typeof SORTS];
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    const nu = degatsCible(heros, sort, cible, { useMax: true, mult: 1, ctx });
    heros.perceResistances = 0.5; // moitié de la résistance ignorée
    const perce = degatsCible(heros, sort, cible, { useMax: true, mult: 1, ctx });
    expect(perce.dmg).toBeGreaterThan(nu.dmg);
  });
});

/** Un héros de test aux PV et au compteur de tour imposés. Défini une fois en tête
 *  de fichier et réutilisé par tous les describe de crochets. */
let refSeq = 0;
function herosTest(o: { pvMax: number; pvActuels: number; toursJoues?: number; position?: number }): Combatant {
  const c = equipeCombattante(nouvelleRun(["iop"]))[0];
  c.ref = `h_${++refSeq}`; // refs uniques : plusieurs héros dans un même test
  c.pvMax = o.pvMax; c.pvBase = o.pvMax; c.pvActuels = o.pvActuels;
  c.toursJoues = o.toursJoues ?? 2;
  if (o.position !== undefined) c.position = o.position;
  return c;
}
/** Un ennemi de test, position imposée. Refs uniques (`refSeq` partagé avec
 *  `herosTest`) — plusieurs ennemis dans un même test. */
function ennemiTest(o: { position: number }): Combatant {
  const c = fabriquerEnnemis("combat_1")[0];
  c.ref = `e_${++refSeq}`;
  c.position = o.position;
  return c;
}

describe("crochet début de tour", () => {
  it("Dokoko soigne 10 % des PV max un tour sur DEUX", async () => {
    const { crochetDebutTour } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 500, toursJoues: 2 });
    expect(crochetDebutTour(c, [c], new Set(["dokoko"])).soins).toEqual([{ ref: c.ref, montant: 100 }]);
    c.toursJoues = 3;
    expect(crochetDebutTour(c, [c], new Set(["dokoko"])).soins).toEqual([]);
  });

  it("Nébuleux : +5 % aux tours pairs, −5 % aux tours impairs", async () => {
    const { crochetDebutTour } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 1000, toursJoues: 2 });
    expect(crochetDebutTour(c, [c], new Set(["dofus_nebuleux"])).degatsPct).toBeCloseTo(0.05);
    c.toursJoues = 3;
    expect(crochetDebutTour(c, [c], new Set(["dofus_nebuleux"])).degatsPct).toBeCloseTo(-0.05);
  });

  it("Argenté : soigne au tour SUIVANT le passage sous 20 %, JAMAIS le tour où le seuil est franchi", async () => {
    const { crochetDebutTour, marquerSeuilArgente } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 150, toursJoues: 2 });
    const actives = new Set(["dofus_argente"]);
    marquerSeuilArgente(c, actives); // appelé par le moteur quand les PV descendent, tour 2
    // toujours le tour 2 : pas de soin, même si le drapeau vient d'être posé (la
    // régression corrigée en Round 1 — un site d'armement DANS ce même tour ne doit
    // pas se voir consommé par le crochet de ce même tour)
    expect(crochetDebutTour(c, [c], actives).soins).toEqual([]);
    c.toursJoues = 3; // tour SUIVANT
    expect(crochetDebutTour(c, [c], actives).soins).toEqual([{ ref: c.ref, montant: 200 }]);
    // consommé : plus jamais de ce combat, même si le seuil est re-franchi
    c.toursJoues = 4;
    marquerSeuilArgente(c, actives);
    expect(crochetDebutTour(c, [c], actives).soins).toEqual([]);
  });

  it("Argenté Scintillant absorbe l'Argenté : un seul soin sur tout le combat avec les deux reliques", async () => {
    const { crochetDebutTour, marquerSeuilArgente } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 150, toursJoues: 2 });
    const actives = new Set(["dofus_argente", "dofus_argente_scintillant"]);
    marquerSeuilArgente(c, actives);
    c.toursJoues = 3;
    expect(crochetDebutTour(c, [c], actives).soins).toEqual([{ ref: c.ref, montant: 200 }]);
    // un second passage sous le seuil, même avec les DEUX reliques actives, ne
    // redonne rien : `argenteUtilise` couvre les deux identifiants à la fois.
    c.toursJoues = 4;
    marquerSeuilArgente(c, actives);
    expect(crochetDebutTour(c, [c], actives).soins).toEqual([]);
  });

  it("sans la relique, aucune intention", async () => {
    const { crochetDebutTour } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 500, toursJoues: 2 });
    const vide = crochetDebutTour(c, [c], new Set());
    expect(vide.soins).toEqual([]);
    expect(vide.degatsPct).toBe(0);
  });
});

describe("crochet fin de tour", () => {
  it("Émeraude : 3 % des PV max par ennemi VIVANT en ligne avant", async () => {
    const { crochetFinTour } = await import("./dofus-effets");
    const h = herosTest({ pvMax: 1000, pvActuels: 1000, position: 0 });
    const e1 = ennemiTest({ position: 0 }), e2 = ennemiTest({ position: 1 });
    const e3 = ennemiTest({ position: 4 }); // arrière : ne compte pas
    const mort = ennemiTest({ position: 2 }); mort.pvActuels = 0; // mort : ne compte pas
    const int = crochetFinTour(h, [h, e1, e2, e3, mort], new Set(["dofus_emeraude"]));
    expect(int.boucliers).toEqual([{ ref: h.ref, montant: 60, tours: 1 }]); // 2 ennemis × 3 %
  });

  it("Veilleurs : soigne les alliés de SA ligne, jamais lui-même", async () => {
    const { crochetFinTour } = await import("./dofus-effets");
    const h = herosTest({ pvMax: 1000, pvActuels: 1000, position: 0 });
    const allieAvant = herosTest({ pvMax: 400, pvActuels: 100, position: 1 });
    const allieArriere = herosTest({ pvMax: 400, pvActuels: 100, position: 4 });
    const int = crochetFinTour(h, [h, allieAvant, allieArriere], new Set(["dofus_des_veilleurs"]));
    expect(int.soins).toEqual([{ ref: allieAvant.ref, montant: 50 }]); // 5 % des PV max DU PORTEUR
  });

  it("Veilleurs : un allié ne reçoit qu'UN soin entre deux de ses propres tours", async () => {
    const { crochetFinTour } = await import("./dofus-effets");
    const p1 = herosTest({ pvMax: 1000, pvActuels: 1000, position: 0 });
    const p2 = herosTest({ pvMax: 1000, pvActuels: 1000, position: 1 });
    const cible = herosTest({ pvMax: 400, pvActuels: 100, position: 2 });
    const actives = new Set(["dofus_des_veilleurs"]);
    expect(crochetFinTour(p1, [p1, p2, cible], actives).soins).toHaveLength(2); // p2 et cible
    // p2 finit son tour à son tour : la cible a déjà reçu son soin cette ronde
    const second = crochetFinTour(p2, [p1, p2, cible], actives).soins.map((s) => s.ref);
    expect(second).not.toContain(cible.ref);
  });
});

describe("Dorigami", () => {
  it("bouclier de 20 % des PV max à l'auteur du coup fatal, 1 tour", async () => {
    const { crochetMortEnnemi } = await import("./dofus-effets");
    const tueur = herosTest({ pvMax: 1000, pvActuels: 800 });
    const int = crochetMortEnnemi(tueur, new Set(["dorigami"]));
    expect(int.boucliers).toEqual([{ ref: tueur.ref, montant: 200, tours: 1 }]);
  });

  it("sans la relique, rien", async () => {
    const { crochetMortEnnemi } = await import("./dofus-effets");
    const tueur = herosTest({ pvMax: 1000, pvActuels: 800 });
    expect(crochetMortEnnemi(tueur, new Set()).boucliers).toEqual([]);
  });
});

// Comme pour l'Émeraude/les Veilleurs plus bas : le test pur ci-dessus ne prouve
// pas que `runCombat` appelle réellement `crochetMortEnnemi` au bon moment (à la
// mort d'un ENNEMI, jamais d'un allié) ni avec la garde de camp. Un vrai combat où
// un héros porteur achève un ennemi vérifie l'état RÉEL du bouclier, pas seulement
// l'intention décrite.
describe("Dorigami — intégration moteur (runCombat)", () => {
  it("le héros qui achève un ennemi gagne RÉELLEMENT le bouclier", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvMax = 1000; heros.pvBase = 1000; heros.pvActuels = 1000;
    heros.initiative = 100; heros.paMax = 1; heros.paActuels = 1;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {};
    ennemi.pvMax = 500; ennemi.pvActuels = 500;
    ennemi.initiative = 1;
    const spellTue = {
      ...SORTS.morsure, id: "test_dofus_dorigami", baseMin: 999, baseMax: 999, scaling: 0, coutPA: 1,
    };
    const controllerJoueur = (acteur: Combatant): Action | null =>
      acteur.ref === heros.ref ? { sort: spellTue, cibleRef: ennemi.ref } : null;
    await runCombat([heros, ennemi], {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: () => 0.99,
      reliquesActives: new Set(["dorigami"]),
    });
    expect(ennemi.pvActuels).toBe(0);
    expect(heros.bouclier).toBe(200); // 20 % de 1000 PV max
  });

  it("un ennemi qui achève un héros ne gagne rien, même si le joueur porte le Dorigami", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvMax = 500; heros.pvBase = 500; heros.pvActuels = 1;
    heros.initiative = 1; heros.paMax = 1; heros.paActuels = 1;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {};
    ennemi.pvMax = 1000; ennemi.pvActuels = 1000;
    ennemi.initiative = 100; // agit avant le héros
    const spellTue = {
      ...SORTS.morsure, id: "test_dofus_dorigami_ennemi", baseMin: 999, baseMax: 999, scaling: 0, coutPA: 1,
    };
    const controllerEnnemi = (acteur: Combatant): Action | null =>
      acteur.ref === ennemi.ref ? { sort: spellTue, cibleRef: heros.ref } : null;
    await runCombat([heros, ennemi], {
      controllers: { joueur: () => null, ennemi: controllerEnnemi },
      rng: () => 0.99,
      reliquesActives: new Set(["dorigami"]),
    });
    expect(heros.pvActuels).toBe(0);
    expect(ennemi.bouclier).toBe(0);
  });
});

// Round de correction 1 : le test « un ennemi qui achève un héros » ci-dessus passe,
// mais pas grâce à la garde de camp écrite dans `infligerDegats` — il passe déjà
// grâce à `reliquesPour`, qui refuse les reliques à quiconque n'est pas du camp
// joueur. La garde de camp (`attaquant.camp !== cible.camp`) protège autre chose :
// le DÉCLENCHEUR, pas le bénéficiaire — un héros qui achèverait un allié (aucun sort
// du jeu ne le permet aujourd'hui, mais rien dans le moteur ne l'interdit) ne doit
// pas gagner de bouclier pour ça. Sans un test qui appelle `infligerDegats`
// DIRECTEMENT avec un attaquant et une cible du MÊME camp joueur, cette garde
// pourrait disparaître sans qu'aucun test ne tombe.
describe("Dorigami — garde de camp du déclencheur (Round de correction 1)", () => {
  const ctxDorigami = (cs: Combatant[], actives: Set<string>): CombatCtx => ({
    rng: () => 0.99,
    log: () => {},
    playerDamageBonus: 1,
    combatants: cs,
    reliquesActives: actives,
  });

  it("un héros qui achève un ALLIÉ ne gagne aucun bouclier, même porteur du Dorigami", async () => {
    const { infligerDegats } = await import("./combat");
    const tueur = herosTest({ pvMax: 1000, pvActuels: 1000 });
    const victime = herosTest({ pvMax: 500, pvActuels: 10 }); // même camp "joueur" que tueur
    const ctx = ctxDorigami([tueur, victime], new Set(["dorigami"]));
    infligerDegats(victime, 999, tueur, ctx);
    expect(victime.pvActuels).toBe(0); // la victime est bien morte de ce coup
    expect(tueur.bouclier).toBe(0); // mais son auteur, du même camp, ne gagne rien
  });

  it("tuer une Égide déclenche bien le Dorigami sur son auteur", async () => {
    const { infligerDegats } = await import("./combat");
    const tueur = herosTest({ pvMax: 1000, pvActuels: 1000 });
    const egide = ennemiTest({ position: 0 });
    egide.estEgide = true;
    egide.estInvocation = true;
    egide.pvMax = 100; egide.pvActuels = 10;
    const ctx = ctxDorigami([tueur, egide], new Set(["dorigami"]));
    infligerDegats(egide, 999, tueur, ctx);
    expect(egide.pvActuels).toBe(0);
    expect(tueur.bouclier).toBe(200); // 20 % des PV max du tueur, comme sur toute autre cible
  });
});

// Comme pour l'Argenté (voir plus bas) : les trois tests ci-dessus n'exercent que
// le module PUR, à la main — ils ne prouvent pas que `runCombat` appelle
// réellement `crochetFinTour`. Un test d'intégration monte donc un vrai combat et
// vérifie l'état RÉEL du bouclier du porteur, pas seulement l'intention décrite.
// Note de séquencement : le bouclier temporaire ne décompte qu'au DÉBUT du tour
// SUIVANT de son porteur (`effetsDebutTour`, Château de cartes) — le relever à la
// fin du combat serait donc aveugle dès que le porteur rejoue. On le capture via
// `onUpdate`, au tour de l'ENNEMI qui suit immédiatement, avant toute décroissance.
describe("crochet fin de tour — intégration moteur (runCombat)", () => {
  it("Émeraude : le porteur gagne RÉELLEMENT du bouclier en fin de son tour", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvMax = 1000; heros.pvBase = 1000; heros.pvActuels = 1000;
    heros.initiative = 100; heros.paMax = 1; heros.paActuels = 1;
    heros.position = 0; // ligne avant
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {};
    ennemi.pvMax = 500; ennemi.pvActuels = 500;
    ennemi.initiative = 1;
    ennemi.position = 0; // ligne avant : compte pour l'Émeraude
    const spellTue = {
      ...SORTS.morsure, id: "test_dofus_emeraude", baseMin: 999, baseMax: 999, scaling: 0, coutPA: 1,
    };
    let bouclierVu = 0;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref !== heros.ref) return null;
      if (acteur.toursJoues === 1) return null; // round 1 : passe, laisse l'Émeraude se déclencher
      return { sort: spellTue, cibleRef: ennemi.ref }; // round 2 : achève l'ennemi, borne le combat
    };
    await runCombat([heros, ennemi], {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: () => 0.99,
      reliquesActives: new Set(["dofus_emeraude"]),
      onUpdate: () => { bouclierVu = Math.max(bouclierVu, heros.bouclier); },
    });
    expect(bouclierVu).toBe(30); // 3 % de 1000 PV max, un ennemi vivant en ligne avant
    expect(ennemi.pvActuels).toBe(0);
  });
});

// Round de correction 1 : `ctx.reliquesActives` vient de `Meta`, la progression DU
// JOUEUR — sans garde de camp, un monstre dont c'est le tour se soignait au Dokoko
// et gagnait le bouclier de l'Émeraude en comptant les héros comme des « ennemis ».
// Le même combat porte le cas négatif (l'ennemi) ET le positif (le héros) : sans le
// second, une garde trop large qui désactiverait tout passerait inaperçue.
describe("reliques Dofus : garde de camp (Round de correction 1)", () => {
  it("un ennemi ne reçoit ni le soin du Dokoko ni le bouclier de l'Émeraude ; le héros, lui, les reçoit", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvMax = 1000; heros.pvBase = 1000; heros.pvActuels = 400;
    heros.initiative = 1; heros.paMax = 1; heros.paActuels = 1;
    heros.position = 0; // ligne avant
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {};
    ennemi.pvMax = 1000; ennemi.pvActuels = 400;
    ennemi.initiative = 100; // agit avant le héros à chaque ronde
    ennemi.position = 0; // ligne avant : compterait pour l'Émeraude si la garde sautait
    const spellTue = {
      ...SORTS.morsure, id: "test_dofus_garde", baseMin: 999, baseMax: 999, scaling: 0, coutPA: 1,
    };
    let ennemiSoigne = false, ennemiBouclierVu = false, herosSoigne = false, herosBouclierVu = false;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref !== heros.ref) return null;
      if (acteur.toursJoues !== 2) return null; // ronde 1, puis DÉBUT de la ronde 2 : passe
      return { sort: spellTue, cibleRef: ennemi.ref }; // achève l'ennemi après son propre tour 2
    };
    await runCombat([heros, ennemi], {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: () => 0.99,
      reliquesActives: new Set(["dokoko", "dofus_emeraude"]),
      onUpdate: () => {
        if (ennemi.pvActuels > 400) ennemiSoigne = true; // Dokoko sur l'ennemi : ne doit JAMAIS arriver
        if (ennemi.bouclier > 0) ennemiBouclierVu = true; // Émeraude sur l'ennemi : idem
        if (heros.pvActuels > 400) herosSoigne = true; // le héros, lui, doit être soigné
        if (heros.bouclier > 0) herosBouclierVu = true; // ... et boucliérisé
      },
    });
    expect(ennemiSoigne).toBe(false);
    expect(ennemiBouclierVu).toBe(false);
    expect(herosSoigne).toBe(true);
    expect(herosBouclierVu).toBe(true);
    expect(ennemi.pvActuels).toBe(0); // combat bouclé : l'ennemi est mort, le héros a bien joué son tour 2
  });
});

// Round de correction 1, point 3 : les quatre tests ci-dessus n'exercent que le
// module PUR, à la main — exactement pourquoi le défaut de séquencement (armer et
// consommer l'Argenté dans la MÊME itération de `runCombat`) leur était invisible.
// Ces deux tests montent un VRAI combat via `runCombat` et vérifient l'effet sur
// des PV/dégâts réellement calculés par le moteur, pas seulement sur les champs
// posés par `crochetDebutTour`.
describe("crochet début de tour — intégration moteur (runCombat)", () => {
  const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit

  it("Dokoko : le porteur reçoit RÉELLEMENT son soin, au tour pair, sur ses PV", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvMax = 1000; heros.pvBase = 1000; heros.pvActuels = 500;
    heros.initiative = 100; heros.paMax = 1; heros.paActuels = 1;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {};
    ennemi.pvMax = 500; ennemi.pvActuels = 500;
    ennemi.initiative = 1;
    const spellTue = {
      ...SORTS.morsure, id: "test_dofus_tue", baseMin: 999, baseMax: 999, scaling: 0, coutPA: 1,
    };
    const cs = [heros, ennemi];
    // Plan : round 1 (tour 1, IMPAIR) le héros passe — pas de Dokoko à ce tour-là.
    // Round 2 (tour 2, PAIR) le héros achève l'ennemi APRÈS le soin de début de tour,
    // ce qui bornent le combat sans dépendre de la sécurité anti-boucle de `runCombat`.
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref !== heros.ref) return null;
      if (acteur.toursJoues === 1) return null;
      return { sort: spellTue, cibleRef: ennemi.ref };
    };
    await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: rngMax,
      reliquesActives: new Set(["dokoko"]),
    });
    expect(heros.pvActuels).toBe(600); // 500 + 10 % de 1000 PV max, posé avant le coup qui achève l'ennemi
    expect(ennemi.pvActuels).toBe(0);
  });

  it("Nébuleux : le malus du tour impair réduit RÉELLEMENT les dégâts calculés par le pipeline", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const spellFrappe = {
      ...SORTS.morsure, id: "test_dofus_frappe", baseMin: 1000, baseMax: 1000, scaling: 0, coutPA: 1,
    };
    // Isole le multiplicateur du Nébuleux : stats à zéro (multOffensif = ×1, pas de
    // crit ni de scaling élémentaire) et résistances/armure nulles, pour que le SEUL
    // écart entre les deux combats soit `degatsPctDofus`.
    const construireCombat = () => {
      const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
      heros.stats = { ...heros.stats, force: 0, intelligence: 0, agilite: 0, chance: 0 };
      heros.pvActuels = heros.pvMax; heros.initiative = 100; heros.paMax = 1; heros.paActuels = 1;
      const ennemi = fabriquerEnnemis("combat_1")[0];
      ennemi.stats = { ...ennemi.stats, agilite: 0 };
      ennemi.resistances = {}; ennemi.armure = 0;
      ennemi.pvMax = 5000; ennemi.pvActuels = 5000; ennemi.initiative = 1;
      return { heros, ennemi };
    };
    const premierCoup = async (actives: Set<string>): Promise<number> => {
      const { heros, ennemi } = construireCombat();
      let premier: number | undefined;
      const controllerJoueur = (acteur: Combatant): Action | null =>
        acteur.ref === heros.ref ? { sort: spellFrappe, cibleRef: ennemi.ref } : null;
      await runCombat([heros, ennemi], {
        controllers: { joueur: controllerJoueur, ennemi: () => null },
        rng: rngMax,
        reliquesActives: actives,
        onDegats: (_ref, dmg) => { if (premier === undefined) premier = dmg; },
      });
      return premier!;
    };
    const sansRelique = await premierCoup(new Set());
    const avecNebuleux = await premierCoup(new Set(["dofus_nebuleux"]));
    // premier coup = tour 1 du héros = tour IMPAIR → malus −5 % du Nébuleux
    expect(sansRelique).toBe(1000);
    expect(avecNebuleux).toBe(950);
    expect(avecNebuleux).toBeLessThan(sansRelique);
  });
});

describe("crochet dégâts infligés", () => {
  it("Tacheté : +5 aux quatre stats élémentaires des ALLIÉS, 1 tour, non cumulable", async () => {
    const { crochetDegatsInfliges } = await import("./dofus-effets");
    const h = herosTest({ pvMax: 1000, pvActuels: 1000 });
    const allie = herosTest({ pvMax: 1000, pvActuels: 1000 });
    const actives = new Set(["dofus_tachete"]);
    crochetDegatsInfliges(h, [h, allie], actives);
    const buffs = allie.effets.filter((e) => e.stat === "force");
    expect(buffs).toHaveLength(1);
    expect(buffs[0].valeur).toBe(5);
    crochetDegatsInfliges(h, [h, allie], actives); // second coup dans le même tour
    expect(allie.effets.filter((e) => e.stat === "force")).toHaveLength(1); // non cumulable
  });

  it("Tacheté : ne buffe jamais le porteur lui-même, ni un ennemi", async () => {
    const { crochetDegatsInfliges } = await import("./dofus-effets");
    const h = herosTest({ pvMax: 1000, pvActuels: 1000 });
    const ennemi = ennemiTest({ position: 0 });
    crochetDegatsInfliges(h, [h, ennemi], new Set(["dofus_tachete"]));
    expect(h.effets.filter((e) => e.stat === "force")).toHaveLength(0);
    expect(ennemi.effets.filter((e) => e.stat === "force")).toHaveLength(0);
  });

  it("sans la relique, aucun buff n'est posé", async () => {
    const { crochetDegatsInfliges } = await import("./dofus-effets");
    const h = herosTest({ pvMax: 1000, pvActuels: 1000 });
    const allie = herosTest({ pvMax: 1000, pvActuels: 1000 });
    crochetDegatsInfliges(h, [h, allie], new Set());
    expect(allie.effets).toHaveLength(0);
  });

  it("Domakuro : +1 % de dégâts finaux si AUCUN dégât au premier tour", async () => {
    // Round de correction 1 : `aFrappeCeTour` n'est plus posé par
    // `crochetDegatsInfliges` (qui ne gère plus que le Tacheté) mais par
    // `infligerDegats`, dans src/combat.ts — inatteignable depuis ce module pur.
    // On simule ici directement ce que le moteur y poserait, comme le fait déjà
    // `marquerSeuilArgente` plus haut pour ses propres drapeaux d'état.
    const { crochetFinTour } = await import("./dofus-effets");
    const actives = new Set(["domakuro"]);
    const muet = herosTest({ pvMax: 1000, pvActuels: 1000, toursJoues: 1 });
    crochetFinTour(muet, [muet], actives); // fin du tour 1 sans avoir frappé
    expect(muet.degatsPctPermanent).toBeCloseTo(0.01);

    const frappeur = herosTest({ pvMax: 1000, pvActuels: 1000, toursJoues: 1 });
    frappeur.aFrappeCeTour = true; // simule le coup posé par infligerDegats
    crochetFinTour(frappeur, [frappeur], actives);
    expect(frappeur.degatsPctPermanent ?? 0).toBe(0);
  });

  it("Domakuro : ne se réarme plus après le premier tour, même si un tour ultérieur est calme", async () => {
    const { crochetFinTour } = await import("./dofus-effets");
    const actives = new Set(["domakuro"]);
    const c = herosTest({ pvMax: 1000, pvActuels: 1000, toursJoues: 1 });
    c.aFrappeCeTour = true; // frappe au tour 1 (posé par infligerDegats) : pas de bonus
    crochetFinTour(c, [c], actives);
    expect(c.degatsPctPermanent ?? 0).toBe(0);
    c.toursJoues = 5; // tour ultérieur, calme (aucun coup porté)
    crochetFinTour(c, [c], actives);
    expect(c.degatsPctPermanent ?? 0).toBe(0); // toujours rien : la fenêtre est fermée
  });

  it("aFrappeCeTour est remis à zéro d'un tour sur l'autre par crochetFinTour", async () => {
    const { crochetFinTour } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 1000, toursJoues: 2 });
    c.aFrappeCeTour = true; // posé par infligerDegats dans le moteur réel
    crochetFinTour(c, [c], new Set());
    expect(c.aFrappeCeTour).toBe(false);
  });
});

// Comme pour le Dorigami/l'Émeraude plus haut : les tests ci-dessus n'exercent que le
// module PUR. Un vrai combat vérifie que le bonus du Domakuro modifie RÉELLEMENT les
// dégâts calculés par le pipeline (`degatsCible`), pas seulement le champ posé.
describe("Domakuro — intégration moteur (runCombat)", () => {
  it("le bonus de +1 % s'applique RÉELLEMENT aux dégâts des coups suivants", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const spellFrappe = {
      ...SORTS.morsure, id: "test_domakuro_frappe", baseMin: 1000, baseMax: 1000, scaling: 0, coutPA: 1,
    };
    // Isole le bonus : stats à zéro (multOffensif = ×1, pas de crit ni de scaling
    // élémentaire) et résistances/armure nulles, même patron que le test Nébuleux
    // ci-dessus, pour que le SEUL écart entre les deux combats soit `degatsPctPermanent`.
    const construireCombat = () => {
      const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
      heros.stats = { ...heros.stats, force: 0, intelligence: 0, agilite: 0, chance: 0 };
      heros.pvActuels = heros.pvMax; heros.initiative = 100; heros.paMax = 1; heros.paActuels = 1;
      const ennemi = fabriquerEnnemis("combat_1")[0];
      ennemi.stats = { ...ennemi.stats, agilite: 0 };
      ennemi.resistances = {}; ennemi.armure = 0;
      ennemi.pvMax = 6000; ennemi.pvActuels = 6000; ennemi.initiative = 1;
      return { heros, ennemi };
    };
    // Plan : le héros PASSE son premier tour (aucun dégât infligé), ce qui arme le
    // Domakuro en fin de ce tour ; il frappe ensuite à chaque tour suivant jusqu'à
    // abattre l'ennemi. On capture le PREMIER coup réellement porté (tour 2).
    const premierCoupApresPasse = async (actives: Set<string>): Promise<number> => {
      const { heros, ennemi } = construireCombat();
      let premier: number | undefined;
      const controllerJoueur = (acteur: Combatant): Action | null => {
        if (acteur.ref !== heros.ref) return null;
        if (acteur.toursJoues === 1) return null; // passe le tour 1 : rien infligé
        return { sort: spellFrappe, cibleRef: ennemi.ref };
      };
      await runCombat([heros, ennemi], {
        controllers: { joueur: controllerJoueur, ennemi: () => null },
        rng: () => 0.99,
        reliquesActives: actives,
        onDegats: (_ref, dmg) => { if (premier === undefined) premier = dmg; },
      });
      return premier!;
    };
    const sansRelique = await premierCoupApresPasse(new Set());
    const avecDomakuro = await premierCoupApresPasse(new Set(["domakuro"]));
    expect(sansRelique).toBe(1000);
    expect(avecDomakuro).toBe(1010); // +1 % acquis en fin de tour 1, sans avoir frappé
    expect(avecDomakuro).toBeGreaterThan(sansRelique);
  });

  it("un porteur qui frappe dès son premier tour ne gagne AUCUN bonus permanent", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const spellFrappe = {
      ...SORTS.morsure, id: "test_domakuro_frappe_direct", baseMin: 1000, baseMax: 1000, scaling: 0, coutPA: 1,
    };
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, force: 0, intelligence: 0, agilite: 0, chance: 0 };
    heros.pvActuels = heros.pvMax; heros.initiative = 100; heros.paMax = 1; heros.paActuels = 1;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {}; ennemi.armure = 0;
    ennemi.pvMax = 6000; ennemi.pvActuels = 6000; ennemi.initiative = 1;
    const controllerJoueur = (acteur: Combatant): Action | null =>
      acteur.ref === heros.ref ? { sort: spellFrappe, cibleRef: ennemi.ref } : null;
    const dmgs: number[] = [];
    await runCombat([heros, ennemi], {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: () => 0.99,
      reliquesActives: new Set(["domakuro"]),
      onDegats: (_ref, dmg) => dmgs.push(dmg),
    });
    expect(heros.degatsPctPermanent ?? 0).toBe(0);
    expect(new Set(dmgs)).toEqual(new Set([1000])); // aucun coup n'a jamais été majoré
  });

  it("un ennemi passif à son premier tour ne gagne jamais le bonus, même si le JOUEUR porte le Domakuro (garde de camp)", async () => {
    // `ctx.reliquesActives` vient de `Meta` — les reliques DU JOUEUR. Sans la garde
    // de camp (`reliquesPour`, `src/combat.ts`), un ennemi qui passe son premier tour
    // sans infliger de dégâts se verrait accorder le même bonus permanent que le héros.
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const spellFrappe = {
      ...SORTS.morsure, id: "test_domakuro_garde", baseMin: 1, baseMax: 1, scaling: 0, coutPA: 1,
    };
    const heros = equipeCombattante(nouvelleRun(["iop"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvMax = 1000; heros.pvBase = 1000; heros.pvActuels = 1000;
    heros.initiative = 1; heros.paMax = 1; heros.paActuels = 1;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {};
    ennemi.pvMax = 1000; ennemi.pvActuels = 1000;
    ennemi.initiative = 100; // agit avant le héros à chaque ronde, mais reste passif
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref !== heros.ref) return null;
      if (acteur.toursJoues !== 2) return null; // passe la ronde 1, laisse l'ennemi finir son tour 1 SANS dégâts
      return { sort: spellFrappe, cibleRef: ennemi.ref }; // abat l'ennemi pour borner le combat
    };
    heros.stats = { ...heros.stats, force: 0, intelligence: 0, agilite: 0, chance: 0 };
    ennemi.pvActuels = 1; // un seul coup suffit à l'abattre au tour 2 du héros
    await runCombat([heros, ennemi], {
      controllers: { joueur: controllerJoueur, ennemi: () => null }, // l'ennemi ne fait RIEN, à aucun tour
      rng: () => 0.99,
      reliquesActives: new Set(["domakuro"]),
    });
    expect(ennemi.degatsPctPermanent ?? 0).toBe(0); // aucun bonus, malgré un premier tour sans dégâts
  });

  // Round de correction 1 : la revue a signalé que les branches à retour anticipé de
  // `lancerSort` (Dagues Boomerang, Flèche Enflammée/de Recul du Cra, Rayon de Wakfu
  // via `soinLigneAvantRatio`) infligent de VRAIS dégâts sans jamais passer par
  // `crochetDegatsInfliges` — un porteur qui ouvrait son premier tour par un de ces
  // sorts gardait donc `aFrappeCeTour` à `false` et gagnait le bonus permanent du
  // Domakuro malgré avoir frappé. Sort RÉEL du contenu (pas un sort synthétique) :
  // c'est le cas de jeu qu'on veut figer, pas une approximation.
  it("un porteur qui ouvre son premier tour par la Flèche Enflammée (retour anticipé) ne gagne AUCUN bonus", async () => {
    const { runCombat } = await import("./combat");
    const { SORTS } = await import("./data");
    const heros = equipeCombattante(nouvelleRun(["cra"]))[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    heros.pvActuels = heros.pvMax; heros.initiative = 100;
    heros.paMax = 3; heros.paActuels = 3; // coût de fleche_enflammee
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    ennemi.resistances = {}; ennemi.armure = 0;
    ennemi.pvMax = 50; ennemi.pvActuels = 50; ennemi.initiative = 1;
    const controllerJoueur = (acteur: Combatant): Action | null =>
      acteur.ref === heros.ref ? { sort: SORTS.fleche_enflammee, cibleRef: ennemi.ref } : null;
    await runCombat([heros, ennemi], {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: () => 0.99,
      reliquesActives: new Set(["domakuro"]),
    });
    expect(ennemi.pvActuels).toBe(0); // le combat s'est bien terminé sur la Flèche Enflammée
    expect(heros.degatsPctPermanent ?? 0).toBe(0); // aucun bonus : le porteur a bel et bien frappé
  });
});

describe("Dofus Ocre", () => {
  it("n'accorde son PA qu'une fois TOUTES les espèces capturables capturées", async () => {
    const { MONSTRES } = await import("./data");
    const capturables = Object.values(MONSTRES).filter((m) => m.archiNom).map((m) => m.id);
    const meta = { ...metaVide(), dofus: [{ id: "dofus_ocre" }] };
    meta.archis = capturables.slice(0, -1); // une espèce manquante
    expect(bonusEquipe(meta).paBonus).toBe(0);
    meta.archis = capturables;
    expect(bonusEquipe(meta).paBonus).toBe(1);
  });
});

describe("Dofus du Cauchemar", () => {
  it("le camp joueur ouvre même avec une initiative inférieure", async () => {
    const { ordreDuCombat } = await import("./combat");
    const equipe = equipeCombattante(nouvelleRun(["iop", "cra"]));
    const ennemis = fabriquerEnnemis("combat_1");
    for (const c of equipe) c.initiative = 1;
    for (const e of ennemis) e.initiative = 999;
    const cs = [...equipe, ...ennemis];
    expect(ordreDuCombat(cs)[0]).toBe(ennemis[0].ref); // sans la relique, l'ennemi ouvre

    for (const c of equipe) c.ouvreToujours = true;
    expect(ordreDuCombat(cs)[0]).toBe(equipe[0].ref); // avec, le premier héros ouvre
  });
});
