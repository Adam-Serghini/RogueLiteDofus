// =============================================================================
//  ascension.test.ts — Mode Ascension : catalogue, fusion des effets, application.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ASCENSION, ASCENSION_MAX, ZONES, MONSTRES, TAVERNE_PCT, DOFUS_DROP_RATE, DOFUS, TRANCHES } from "./data";
import {
  effetsAscension, fabriquerEnnemis, fabriquerEquipe, appliquerAscensionEnnemis,
  especesNormalesDeZone, nouvelleRun, recruter, soignerEquipe, appliquerModificateursElite,
  pvMaxPerso, tavernePctAscension, tauxDofusAscension, recordAscension, enregistrerAscension,
  chargerRunEnCours, sauverRunEnCours, verifierSucces,
  sansNoeudsDeZone, chargerMeta, SUCCES, bonusEquipe, tranchesEnCauchemar, verifierDofusCauchemar,
  trancheDeverrouillee,
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

  it("en salle élite, le renfort reçoit AUSSI le modificateur d'élite — l'ordre d'appel " +
    "(renfort d'abord, modificateur ensuite) doit rester celui de main.ts/sim.ts", () => {
    // sans renfort (A0) pour connaître les PV nus de la meute d'origine, hors modif
    const refPvMax = fabriquerEnnemis("combat_1")[0].pvMax;

    // ordre correct : renfort AVANT le modificateur d'élite (comme resoudreCombat)
    const ennemis = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(ennemis, effetsAscension(1), {
      type: "combat_dur", especesZone: especes, rng: () => 0,
    });
    const modifs = appliquerModificateursElite(ennemis, () => 0, ["cuirasse"]); // +20% PV
    expect(modifs[0].id).toBe("cuirasse");
    const renfort = renforts(ennemis)[0];
    expect(renfort).toBeDefined();

    // le renfort nu (même tirage, même espèce, sans le modificateur) sert de référence
    const sansModif = fabriquerEnnemis("combat_1");
    appliquerAscensionEnnemis(sansModif, effetsAscension(1), {
      type: "combat_dur", especesZone: especes, rng: () => 0,
    });
    const renfortNu = renforts(sansModif)[0];
    expect(renfortNu).toBeDefined();

    // le renfort a bien subi le +20% de PV du modificateur d'élite, pas seulement
    // le pvMult du cran d'Ascension
    expect(renfort.pvMax).toBe(Math.round(renfortNu.pvMax * 1.2));
    expect(refPvMax).toBeGreaterThan(0); // garde-fou : la fixture n'est pas vide
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
  it("taux de Dofus : +1 % par palier, écrêté au dernier cran réel", () => {
    expect(tauxDofusAscension(0)).toBeCloseTo(DOFUS_DROP_RATE);
    expect(tauxDofusAscension(ASCENSION_MAX)).toBeCloseTo(DOFUS_DROP_RATE + 0.01 * ASCENSION_MAX);
    // hors bornes (ancienne échelle 0-8, ou négatif) : écrêté, jamais extrapolé
    expect(tauxDofusAscension(8)).toBeCloseTo(DOFUS_DROP_RATE + 0.01 * ASCENSION_MAX);
    expect(tauxDofusAscension(-3)).toBeCloseTo(DOFUS_DROP_RATE);
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

describe("eliteModifs (format)", () => {
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
  it("une sauvegarde d'avant la refonte voit TOUS ses records remis à zéro", () => {
    localStorage.setItem("rld_meta_v0", JSON.stringify({
      dofus: [], archis: [], runs: 3, victoires: 1, ascension: { t1: 8, t2: 6 },
    })); // pas de `version` : sauvegarde d'avant la refonte
    const meta = chargerMeta();
    expect(meta.ascension!.t1).toBe(0);
    expect(meta.ascension!.t2).toBe(0);
  });

  it("la clé de tranche SURVIT à la remise à zéro : le clear reste prouvé", () => {
    // `trancheDeverrouillee` ne teste que la PRÉSENCE de la clé. La supprimer au lieu de
    // la remettre à 0 reverrouillerait t2 chez un joueur qui a réellement fini t1.
    localStorage.setItem("rld_meta_v0", JSON.stringify({
      dofus: [], archis: [], runs: 3, victoires: 1, ascension: { t1: 8 },
    }));
    const meta = chargerMeta();
    expect(Object.keys(meta.ascension!)).toEqual(["t1"]);
    expect(recordAscension(meta, "t1")).toBe(0); // défini, donc clear prouvé
    expect(trancheDeverrouillee(meta, "t2")).toBe(true);
  });

  it("la remise à zéro ne passe QU'UNE FOIS : un record gagné depuis survit au rechargement", () => {
    // Sans le garde de version, chaque chargement effacerait la session précédente.
    const meta = chargerMeta(); // migre et porte désormais la version courante
    enregistrerAscension(meta, "t1", 3); // le joueur gagne Cauchemar APRÈS la mise à jour
    expect(chargerMeta().ascension!.t1).toBe(3);
  });

  it("une run sauvée AVANT la refonte reprend en Normal, pas au cran écrêté", () => {
    // Écrêter un 7 à 4 ferait basculer le joueur en pleine partie sous les règles
    // d'Ultime (mort définitive, tavernes coupées) sans qu'il les ait choisies.
    localStorage.setItem("rld_run_v0", JSON.stringify({
      version: 1, zoneIdx: 0, run: { ...nouvelleRun(["iop", "cra"], 0, "t1"), ascension: 7 },
    }));
    expect(chargerRunEnCours()!.run.ascension).toBe(0);
  });

  it("une run sauvée APRÈS la refonte garde son cran", () => {
    const run = nouvelleRun(["iop", "cra"], 3, "t1");
    sauverRunEnCours(0, run);
    expect(chargerRunEnCours()!.run.ascension).toBe(3);
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

describe("Dofus du Cauchemar", () => {
  const metaVide = (): Meta => ({ dofus: [], archis: [], runs: 0, victoires: 0 });

  it("compte les tranches clean au moins en Cauchemar", () => {
    const meta = metaVide();
    meta.ascension = { t1: 4, t2: 3, t3: 2 };
    expect(tranchesEnCauchemar(meta)).toBe(2); // t3 est en Extrême : ne compte pas
  });

  // Round de correction 1 : sans record d'Ascension, `recordAscension` renvoie
  // `undefined`. Une implémentation qui replierait ce `undefined` sur -1 pour le
  // comparer à `PALIER_CAUCHEMAR` collisionnerait avec le -1 que `findIndex`
  // renverrait si l'id "cauchemar" disparaissait de la table : -1 >= -1 est vrai,
  // donc TOUTE tranche jamais jouée compterait. Ce test échoue si cette
  // comparaison par sentinelle numérique revient.
  it("une Meta neuve, sans aucun record, ne compte et n'accorde rien", () => {
    const meta = metaVide();
    expect(meta.ascension).toBeUndefined();
    expect(tranchesEnCauchemar(meta)).toBe(0);
    expect(verifierDofusCauchemar(meta)).toBe(false);
    expect(meta.dofus.some((d) => d.id === "dofus_du_cauchemar")).toBe(false);
  });

  it("exige LES CINQ tranches déclarées, pas seulement les jouables", () => {
    const meta = metaVide();
    meta.ascension = { t1: 4 };
    expect(verifierDofusCauchemar(meta)).toBe(false);
    expect(meta.dofus.some((d) => d.id === "dofus_du_cauchemar")).toBe(false);

    meta.ascension = Object.fromEntries(TRANCHES.map((t) => [t.id, 3]));
    expect(verifierDofusCauchemar(meta)).toBe(true);
    expect(meta.dofus.some((d) => d.id === "dofus_du_cauchemar")).toBe(true);
  });

  it("ne l'accorde pas deux fois", () => {
    const meta = metaVide();
    meta.ascension = Object.fromEntries(TRANCHES.map((t) => [t.id, 4]));
    expect(verifierDofusCauchemar(meta)).toBe(true);
    expect(verifierDofusCauchemar(meta)).toBe(false);
    expect(meta.dofus.filter((d) => d.id === "dofus_du_cauchemar")).toHaveLength(1);
  });

  // DORMANCE : ce test tombera le jour où on donne un effet à la relique. C'est
  // voulu — il force à rouvrir le spec plutôt qu'à découvrir la relique morte des
  // mois plus tard, comme le Dofus Turquoise. Même dispositif que `dissipe`.
  it("n'a AUCUN effet pour l'instant (dormance assumée)", () => {
    const meta = metaVide();
    const nu = bonusEquipe(meta);
    meta.dofus.push({ id: "dofus_du_cauchemar" });
    expect(bonusEquipe(meta)).toEqual(nu);
    expect(DOFUS.dofus_du_cauchemar.desc).toBe("Relique légendaire — effet à venir.");
  });
});
