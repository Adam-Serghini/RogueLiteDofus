// =============================================================================
//  dofus.test.ts — effets des reliques : modèle, données, déclenchements.
// =============================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { DOFUS } from "./data";
import {
  chargerMeta, ajouterDofus, bonusEquipe, reliquesActives, meilleurJet,
  equipeCombattante, nouvelleRun,
} from "./run";
import type { Meta, Combatant } from "./types";

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

  it("Argenté : soigne au tour SUIVANT le passage sous 20 %, une seule fois par combat", async () => {
    const { crochetDebutTour, marquerSeuilArgente } = await import("./dofus-effets");
    const c = herosTest({ pvMax: 1000, pvActuels: 150, toursJoues: 2 });
    const actives = new Set(["dofus_argente"]);
    marquerSeuilArgente(c, actives); // appelé par le moteur quand les PV descendent
    expect(crochetDebutTour(c, [c], actives).soins).toEqual([{ ref: c.ref, montant: 200 }]);
    // consommé : plus jamais de ce combat
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
