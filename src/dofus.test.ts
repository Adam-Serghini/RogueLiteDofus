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
// `ennemiTest` (même forme, via `fabriquerEnnemis`) sera ajouté quand un crochet
// suivant (Émeraude, Veilleurs…) en aura réellement besoin — un helper non lu par
// aucun test échoue au typecheck (`noUnusedLocals`), donc on ne l'anticipe pas.

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
