// =============================================================================
//  ascension.test.ts — Mode Ascension : catalogue, fusion des effets, application.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ASCENSION, ASCENSION_MAX, ZONES, MONSTRES, TAVERNE_PCT, DOFUS_DROP_RATE } from "./data";
import {
  effetsAscension, fabriquerEnnemis, fabriquerEquipe, appliquerAscensionEnnemis,
  especesNormalesDeZone, nouvelleRun, recruter, soignerEquipe,
  pvMaxPerso, tavernePctAscension, tauxDofusAscension, recordAscension, enregistrerAscension,
  appliquerModificateursElite, chargerRunEnCours, sauverRunEnCours, verifierSucces,
  sansNoeudsDeZone, chargerMeta, SUCCES,
} from "./run";
import { genererCarte, typesZaapPossibles } from "./carte";
import { mulberry32 } from "./rng";
import type { Combatant, Meta } from "./types";

// mock localStorage (l'environnement de test n'en a pas)
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe("Ascension — table des cinq crans", () => {
  it("cinq crans, le premier vide (jeu de base)", () => {
    expect(ASCENSION).toHaveLength(5);
    expect(effetsAscension(0)).toEqual({});
    expect(ASCENSION_MAX).toBe(4); // INDEX du dernier cran, pas le nombre de crans
  });

  it("chaque cran redéclare tout son tableau, en absolu", () => {
    expect(effetsAscension(1)).toEqual({ degatsMult: 1.1, pvMult: 1.2, renfortAvant: true });
    expect(effetsAscension(2)).toEqual({
      degatsMult: 1.15, pvMult: 1.3, renfortAvant: true, tavernePct: 0.3,
    });
    expect(effetsAscension(3)).toEqual({
      degatsMult: 1.3, pvMult: 1.5, renfortAvant: true, tavernePct: 0.3, mortDefinitive: true,
    });
    expect(effetsAscension(4)).toEqual({
      degatsMult: 1.3, pvMult: 1.5, renfortAvant: true, tavernePct: 0.3, mortDefinitive: true,
      tavernesCoupeesAPlein: true,
    });
  });

  it("un index hors bornes est écrêté, jamais undefined", () => {
    expect(effetsAscension(-3)).toEqual(effetsAscension(0));
    expect(effetsAscension(99)).toEqual(effetsAscension(4));
  });

  it("les crans ne redescendent jamais en dégâts ni en PV", () => {
    for (let n = 2; n <= ASCENSION_MAX; n++) {
      expect(effetsAscension(n).degatsMult!).toBeGreaterThanOrEqual(effetsAscension(n - 1).degatsMult ?? 1);
      expect(effetsAscension(n).pvMult!).toBeGreaterThanOrEqual(effetsAscension(n - 1).pvMult ?? 1);
    }
  });

  it("le % de taverne suit le cran", () => {
    expect(tavernePctAscension(0)).toBe(TAVERNE_PCT);
    expect(tavernePctAscension(1)).toBe(TAVERNE_PCT);
    expect(tavernePctAscension(2)).toBe(0.3);
    expect(tavernePctAscension(4)).toBe(0.3);
  });
});

describe("appliquerAscensionEnnemis", () => {
  const monte = (): Combatant[] => fabriquerEnnemis("combat_1"); // pack fixture générique
  it("A0 ({}) ne change rien", () => {
    const avant = monte(); const apres = monte();
    appliquerAscensionEnnemis(apres, {}, { type: "combat", rng: () => 0 });
    expect(apres.length).toBe(avant.length);
    expect(apres[0].pvMax).toBe(avant[0].pvMax);
    expect(apres[0].stats.force).toBe(avant[0].stats.force);
  });
  it("pvMult s'applique à toute la meute", () => {
    const avant = monte(); const pack = monte();
    appliquerAscensionEnnemis(pack, { pvMult: 1.2 }, { type: "combat", rng: () => 0 });
    expect(pack[0].pvMax).toBe(Math.round(avant[0].pvMax * 1.2));
    expect(pack[0].pvActuels).toBe(pack[0].pvMax);
  });
});

describe("Ascension — renfort en ligne avant", () => {
  const zone = ZONES[0];
  const especes = especesNormalesDeZone(zone);
  const renforts = (cs: Combatant[]) => cs.filter((e) => e.ref.startsWith("asc_"));

  it("tombe en LIGNE AVANT (position 0-3)", () => {
    const ennemis = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(ennemis, effetsAscension(1), {
      type: "combat", especesZone: especes, rng: () => 0,
    });
    expect(renforts(ennemis)).toHaveLength(1);
    expect(renforts(ennemis)[0].position).toBeLessThan(4);
  });

  it("tombe aussi dans les combats DURS", () => {
    const ennemis = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(ennemis, effetsAscension(1), {
      type: "combat_dur", especesZone: especes, rng: () => 0,
    });
    expect(renforts(ennemis)).toHaveLength(1);
  });

  it("ne tombe JAMAIS en donjon (le boss et son escorte sont un tableau)", () => {
    const ennemis = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(ennemis, effetsAscension(4), {
      type: "donjon", especesZone: especes, rng: () => 0,
    });
    expect(renforts(ennemis)).toHaveLength(0);
  });

  it("pas de renfort si la ligne avant est pleine — jamais de repli sur l'arrière", () => {
    const ennemis = fabriquerEnnemis("combat_1");
    ennemis.forEach((e, i) => { e.position = i; });
    while (ennemis.length < 4) {
      const clone = { ...ennemis[0], ref: `bouchon_${ennemis.length}`, position: ennemis.length };
      ennemis.push(clone);
    }
    const avant = ennemis.length;
    appliquerAscensionEnnemis(ennemis, effetsAscension(1), {
      type: "combat", especesZone: especes, rng: () => 0,
    });
    expect(ennemis).toHaveLength(avant);
  });

  it("le renfort subit lui aussi le multiplicateur de PV du cran", () => {
    // Comparaison à espèce égale : `fabriquerEnnemis("combat_1")` ne contient PAS
    // les espèces d'incarnam (tournesol_sauvage/pissenlit_diabolique vs les
    // chafers d'`especesNormalesDeZone`) — chercher le renfort dans ce pack par
    // `monstreId` échouerait TOUJOURS, silencieusement si mal écrit (voir la
    // jurisprudence « un test dont le sujet est introuvable doit échouer »). On
    // rejoue donc le même tirage de renfort SANS `pvMult` pour obtenir la version
    // nue de la même espèce, à comparer à la version soumise au cran 1.
    const avecMult = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(avecMult, effetsAscension(1), {
      type: "combat", especesZone: especes, rng: () => 0,
    });
    const renfort = renforts(avecMult)[0];

    const sansMult = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(sansMult, { renfortAvant: true }, {
      type: "combat", especesZone: especes, rng: () => 0,
    });
    const nu = renforts(sansMult)[0];

    expect(nu).toBeDefined();
    expect(renfort.pvMax).toBeGreaterThan(nu!.pvMax);
  });

  it("le renfort encaisse aussi enemyDamageBonus — le multiplicateur vit dans le contexte de combat, pas sur chaque combattant", async () => {
    const { degatsCible } = await import("./combat");
    const { SORTS } = await import("./data");
    const ennemis = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(ennemis, effetsAscension(1), {
      type: "combat", especesZone: especes, rng: () => 0,
    });
    const renfort = renforts(ennemis)[0];
    const monstre = MONSTRES[renfort.monstreId!];
    const sortId = monstre.sorts.find((s) => SORTS[s]?.type === "degats") ?? monstre.sorts[0];
    const sort = SORTS[sortId];
    const cible = fabriquerEquipe()[0];
    renfort.stats = { ...renfort.stats, agilite: 0 };
    cible.stats = { ...cible.stats, agilite: 0 };
    const sansHasard = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    const opts = (ctx: object) => ({ useMax: true, mult: 1, ctx });
    const nu = degatsCible(renfort, sort, cible, opts(sansHasard) as never);
    const boosté = degatsCible(renfort, sort, cible, opts({ ...sansHasard, enemyDamageBonus: 1.1 }) as never);
    expect(boosté.dmg).toBeGreaterThan(nu.dmg);
  });
});

describe("plomberie de run", () => {
  it("nouvelleRun porte le palier", () => {
    const a0 = nouvelleRun(["iop"]);
    expect(a0.ascension).toBe(0);
    expect(a0.persos[0].pvActuels).toBe(pvMaxPerso(a0.persos[0]));
  });
  it("taverne : 50 % en A0/A1, 30 % dès A2", () => {
    expect(tavernePctAscension(0)).toBe(TAVERNE_PCT);
    expect(tavernePctAscension(1)).toBe(TAVERNE_PCT);
    expect(tavernePctAscension(2)).toBeCloseTo(0.3);
  });
  it("taux de Dofus : +1 % par palier", () => {
    expect(tauxDofusAscension(0)).toBeCloseTo(DOFUS_DROP_RATE);
    expect(tauxDofusAscension(8)).toBeCloseTo(DOFUS_DROP_RATE + 0.08);
  });
  it("record : absent avant toute victoire, max(record, palier), ne baisse jamais", () => {
    const meta: Meta = { dofus: [], archis: [], runs: 0, victoires: 0 };
    expect(recordAscension(meta, "t1")).toBeUndefined();
    enregistrerAscension(meta, "t1", 0);
    expect(recordAscension(meta, "t1")).toBe(0);
    enregistrerAscension(meta, "t1", 3);
    expect(recordAscension(meta, "t1")).toBe(3);
    enregistrerAscension(meta, "t1", 1); // redescendre ne baisse pas le record
    expect(recordAscension(meta, "t1")).toBe(3);
  });
});

describe("enrage (moteur)", () => {
  it("le compteur monte à chaque appel et augmente les dégâts", async () => {
    const { appliquerEnrage, degatsCible } = await import("./combat");
    const { SORTS } = await import("./data");
    const pack = fabriquerEnnemis("combat_1");
    const boss = pack[0];
    boss.enrage = 0.1;
    boss.stats = { ...boss.stats, agilite: 0 };
    const cible = { ...fabriquerEnnemis("combat_1")[1], resistances: {}, stats: { ...pack[1].stats, agilite: 0 } };
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    const base = degatsCible(boss, SORTS.morsure, cible, { useMax: true, mult: 1, ctx: ctx as never }).dmg;
    appliquerEnrage(boss, ctx as never);
    appliquerEnrage(boss, ctx as never); // 2 tours → +20 %
    const enragee = degatsCible(boss, SORTS.morsure, cible, { useMax: true, mult: 1, ctx: ctx as never }).dmg;
    // valeurs figées plutôt que « base × 1,2 » en tolérance absolue : base et enragee
    // sont chacun arrondis indépendamment (Math.round appliqué une seule fois, en fin de
    // pipeline), donc `base × 1,2` (39,6) et `enragee` (39) peuvent différer de plus de
    // 0,5 sans que la règle « +20 % de dégâts cumulés » soit en cause — recalculé après
    // le rework des 4 éléments (multOffensif change les dégâts de base).
    expect(base).toBe(33);
    expect(enragee).toBe(39);
  });
});

describe("élites doubles (A5)", () => {
  it("applique N modificateurs DISTINCTS", () => {
    const pack = fabriquerEnnemis("combat_1");
    const mods = appliquerModificateursElite(pack, () => 0, undefined, 2);
    expect(mods.length).toBe(2);
    expect(new Set(mods.map((m) => m.id)).size).toBe(2);
  });
  it("genererCarte pose 2 ids distincts sur les combats durs quand nbModifsElite=2", () => {
    const rng = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const carte = genererCarte(rng, ZONES[0].pools, [], 2);
    const durs = carte.noeuds.filter((n) => n.type === "combat_dur");
    for (const n of durs) {
      expect(n.eliteModifs?.length).toBe(2);
      expect(new Set(n.eliteModifs).size).toBe(2);
    }
  });
  it("vieille save : eliteModif scalaire migré en tableau", () => {
    const run = nouvelleRun(["iop"]);
    run.carte = genererCarte(() => 0.5, ZONES[0].pools, []);
    sauverRunEnCours(0, run);
    const brut = JSON.parse(localStorage.getItem("rld_run_v0")!);
    for (const n of brut.run.carte.noeuds) {
      if (n.eliteModifs) { n.eliteModif = n.eliteModifs[0]; delete n.eliteModifs; } // format d'avant
    }
    localStorage.setItem("rld_run_v0", JSON.stringify(brut));
    const s = chargerRunEnCours();
    for (const n of s!.run.carte!.noeuds.filter((x) => x.type === "combat_dur")) {
      expect(Array.isArray(n.eliteModifs)).toBe(true);
      expect(n.eliteModifs!.length).toBe(1);
    }
  });
});

describe("Ascension — dégâts du camp ennemi", () => {
  const sansHasard = { rng: () => 0.99, log: () => {} }; // 0.99 > plafond de crit : pas de crit

  it("un coup ennemi encaisse le multiplicateur, un coup joueur non", async () => {
    const { degatsCible } = await import("./combat");
    const { SORTS } = await import("./data");
    const [heros] = fabriquerEquipe();
    const ennemi = fabriquerEnnemis("combat_1")[0];
    heros.stats = { ...heros.stats, agilite: 0 };
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    const sort = SORTS[heros.sorts[0]];

    const opts = (ctx: object) => ({ useMax: true, mult: 1, ctx });
    const nu = degatsCible(ennemi, sort, heros, opts({ ...sansHasard, playerDamageBonus: 1 }) as never);
    const boosté = degatsCible(ennemi, sort, heros,
      opts({ ...sansHasard, playerDamageBonus: 1, enemyDamageBonus: 1.3 }) as never);
    expect(boosté.dmg).toBeGreaterThan(nu.dmg);

    const cotéJoueur = degatsCible(heros, sort, ennemi,
      opts({ ...sansHasard, playerDamageBonus: 1, enemyDamageBonus: 1.3 }) as never);
    const cotéJoueurNu = degatsCible(heros, sort, ennemi,
      opts({ ...sansHasard, playerDamageBonus: 1 }) as never);
    expect(cotéJoueur.dmg).toBe(cotéJoueurNu.dmg);
  });
});

describe("Ascension — mort définitive", () => {
  const runAu = (palier: number) => {
    const run = nouvelleRun(["iop", "cra"], palier, "t1");
    run.persos[0].pvActuels = 0; // mort au combat précédent
    run.persos[1].pvActuels = 1;
    return run;
  };

  it("à Extrême, la taverne relève encore le mort", () => {
    const run = runAu(2);
    soignerEquipe(run, tavernePctAscension(2));
    expect(run.persos[0].pvActuels).toBeGreaterThan(0);
  });

  it("à Cauchemar, ni la taverne ni la fin de zone ne le relèvent", () => {
    const run = runAu(3);
    soignerEquipe(run, tavernePctAscension(3)); // taverne
    expect(run.persos[0].pvActuels).toBe(0);
    soignerEquipe(run, 1); // boss de zone vaincu : soin à 100 %
    expect(run.persos[0].pvActuels).toBe(0);
    expect(run.persos[1].pvActuels).toBe(pvMaxPerso(run.persos[1])); // le vivant, lui, est soigné
  });

  it("à Ultime aussi", () => {
    const run = runAu(4);
    soignerEquipe(run, 1);
    expect(run.persos[0].pvActuels).toBe(0);
  });

  it("le remplacement en taverne libère la case du mort", () => {
    const run = runAu(3);
    const casePrise = run.persos[0].position;
    recruter(run, "eniripsa", "iop");
    expect(run.persos.some((p) => p.classeId === "iop")).toBe(false);
    const recrue = run.persos.find((p) => p.classeId === "eniripsa")!;
    expect(recrue.position).toBe(casePrise);
    expect(recrue.pvActuels).toBeGreaterThan(0);
  });
});

describe("Ascension — tavernes coupées à l'équipe complète", () => {
  const runDe = (palier: number, classes: string[]) => nouvelleRun(classes, palier, "t1");
  const QUATRE = ["iop", "cra", "eniripsa", "ecaflip"];

  it("à Ultime avec 4 membres, la taverne quitte le plateau ET la roue du Zaap", () => {
    const run = runDe(4, QUATRE);
    const exclus = sansNoeudsDeZone(run, ZONES[0]);
    expect(exclus).toContain("taverne");
    const carte = genererCarte(mulberry32(7), ZONES[0].pools, exclus);
    expect(carte.noeuds.some((n) => n.type === "taverne")).toBe(false);
    expect(typesZaapPossibles(exclus)).not.toContain("taverne");
  });

  it("à Ultime avec 3 membres, les tavernes restent", () => {
    const run = runDe(4, ["iop", "cra", "eniripsa"]);
    expect(sansNoeudsDeZone(run, ZONES[0])).not.toContain("taverne");
  });

  it("un héros MORT compte dans les 4 : la taverne ne rouvre pas", () => {
    const run = runDe(4, QUATRE);
    run.persos[0].pvActuels = 0;
    expect(sansNoeudsDeZone(run, ZONES[0])).toContain("taverne");
  });

  it("à Cauchemar, les tavernes restent même à 4", () => {
    expect(sansNoeudsDeZone(runDe(3, QUATRE), ZONES[0])).not.toContain("taverne");
  });

  it("les exclusions propres à la zone sont conservées", () => {
    const incarnam = ZONES.find((z) => z.id === "incarnam")!;
    const exclus = sansNoeudsDeZone(runDe(0, QUATRE), incarnam);
    expect(exclus).toEqual(expect.arrayContaining(["otomai", "forgemagie"]));
  });
});

describe("succès d'Ascension", () => {
  it("victoire en Cauchemar (3) débloque Difficile/Extrême/Cauchemar, pas Ultime", () => {
    const meta: Meta = { dofus: [], archis: [], runs: 1, victoires: 1, succes: [] };
    const run = nouvelleRun(["iop"], 3);
    const noms = verifierSucces(meta, run, true).map((s) => s.id);
    expect(noms).toContain("asc_difficile");
    expect(noms).toContain("asc_cauchemar");
    expect(noms).not.toContain("asc_ultime");
    const defaite = verifierSucces({ ...meta, succes: [] }, nouvelleRun(["iop"], ASCENSION_MAX), false).map((s) => s.id);
    expect(defaite).not.toContain("asc_difficile");
  });
});

describe("Ascension — rétro-compatibilité", () => {
  it("un record de l'ancienne échelle (0-8) est écrêté au dernier cran", () => {
    localStorage.setItem("rld_meta_v0", JSON.stringify({
      dofus: [], archis: [], runs: 3, victoires: 1, ascension: { t1: 8, t2: 6 },
    }));
    const meta = chargerMeta();
    expect(meta.ascension!.t1).toBe(ASCENSION_MAX);
    expect(meta.ascension!.t2).toBe(ASCENSION_MAX);
  });

  it("un record à la borne haute reste intact, un record juste au-dessus est écrêté", () => {
    // valeurs limites plutôt qu'un 2 arbitraire : à ASCENSION_MAX, le test passerait même
    // sans écrêtage (rien à écrêter) — ASCENSION_MAX + 1 le distingue vraiment, et une
    // implémentation trop agressive (qui écrêterait sous ASCENSION_MAX) ferait échouer t1.
    localStorage.setItem("rld_meta_v0", JSON.stringify({
      dofus: [], archis: [], runs: 1, victoires: 1,
      ascension: { t1: ASCENSION_MAX, t2: ASCENSION_MAX + 1 },
    }));
    const meta = chargerMeta();
    expect(meta.ascension!.t1).toBe(ASCENSION_MAX);
    expect(meta.ascension!.t2).toBe(ASCENSION_MAX);
  });

  it("une run sauvée sur l'ancienne échelle reprend dans les bornes", () => {
    const run = nouvelleRun(["iop", "cra"], 0, "t1");
    run.ascension = 7; // sauvegarde d'avant la refonte
    sauverRunEnCours(0, run);
    expect(chargerRunEnCours()!.run.ascension).toBe(ASCENSION_MAX);
  });

  it("les succès portent sur les crans nommés", () => {
    const ids = SUCCES.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(
      ["asc_difficile", "asc_extreme", "asc_cauchemar", "asc_ultime"]));
    expect(ids).not.toContain("ascension_8");
  });

  it("le succès Cauchemar ne tombe qu'à une victoire au cran 3 ou plus", () => {
    const meta: Meta = { dofus: [], archis: [], runs: 0, victoires: 0 };
    const run = nouvelleRun(["iop", "cra"], 3, "t1");
    expect(verifierSucces(meta, run, false).map((s) => s.id)).not.toContain("asc_cauchemar");
    expect(verifierSucces(meta, run, true).map((s) => s.id)).toContain("asc_cauchemar");
  });
});
