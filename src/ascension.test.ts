// =============================================================================
//  ascension.test.ts — Mode Ascension : catalogue, fusion des effets, application.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ASCENSION, ASCENSION_MAX, ZONES, MONSTRES, TAVERNE_PCT, DOFUS_DROP_RATE } from "./data";
import {
  effetsAscension, fabriquerEnnemis, appliquerAscensionEnnemis, especesNormalesDeZone, nouvelleRun,
  pvMaxPerso, tavernePctAscension, tauxDofusAscension, recordAscension, enregistrerAscension,
  appliquerModificateursElite, chargerRunEnCours, sauverRunEnCours, verifierSucces,
} from "./run";
import { genererCarte } from "./carte";
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
  it("pvMult et statMultOffensif s'appliquent à toute la meute (vitalité intacte)", () => {
    const avant = monte(); const pack = monte();
    appliquerAscensionEnnemis(pack, { pvMult: 1.2, statMultOffensif: 1.15 }, { type: "combat", rng: () => 0 });
    expect(pack[0].pvMax).toBe(Math.round(avant[0].pvMax * 1.2));
    expect(pack[0].pvActuels).toBe(pack[0].pvMax);
    expect(pack[0].stats.force).toBe(Math.round(avant[0].stats.force * 1.15));
    expect(pack[0].stats.vitalite).toBe(avant[0].stats.vitalite);
  });
  it("packPlus1 ajoute 1 monstre de la zone en combat NORMAL, jamais en donjon", () => {
    const especes = especesNormalesDeZone(ZONES[0]);
    expect(especes.length).toBeGreaterThan(0);
    const pack = monte();
    appliquerAscensionEnnemis(pack, { packPlus1: true }, { type: "combat", especesZone: especes, rng: () => 0 });
    expect(pack.length).toBe(monte().length + 1);
    const renfort = pack[pack.length - 1];
    expect(especes).toContain(renfort.monstreId);
    expect(pack.filter((e) => e.position === renfort.position).length).toBe(1); // case libre
    const donjon = monte();
    appliquerAscensionEnnemis(donjon, { packPlus1: true }, { type: "donjon", especesZone: especes, rng: () => 0 });
    expect(donjon.length).toBe(monte().length);
  });
  it("bossEnrage marque le boss (donjon), bossFinalPaBonus seulement en dernière zone", () => {
    const donjon = fabriquerEnnemis(ZONES[0].pools.boss[0]);
    appliquerAscensionEnnemis(donjon, { bossEnrage: 0.1, bossFinalPaBonus: 2 }, { type: "donjon", derniereZone: false, rng: () => 0 });
    const boss = donjon.find((e) => MONSTRES[e.monstreId!]?.boss)!;
    const paAvant = boss.paMax;
    expect(boss.enrage).toBeCloseTo(0.1);
    const donjon2 = fabriquerEnnemis(ZONES[0].pools.boss[0]);
    appliquerAscensionEnnemis(donjon2, { bossFinalPaBonus: 2 }, { type: "donjon", derniereZone: true, rng: () => 0 });
    const boss2 = donjon2.find((e) => MONSTRES[e.monstreId!]?.boss)!;
    expect(boss2.paMax).toBe(paAvant + 2);
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

describe("succès d'Ascension", () => {
  it("victoire en A3 débloque Ascension I et III, pas V", () => {
    const meta: Meta = { dofus: [], archis: [], runs: 1, victoires: 1, succes: [] };
    const run = nouvelleRun(["iop"], 3);
    const noms = verifierSucces(meta, run, true).map((s) => s.id);
    expect(noms).toContain("ascension_1");
    expect(noms).toContain("ascension_3");
    expect(noms).not.toContain("ascension_5");
    const defaite = verifierSucces({ ...meta, succes: [] }, nouvelleRun(["iop"], 8), false).map((s) => s.id);
    expect(defaite).not.toContain("ascension_1");
  });
});
