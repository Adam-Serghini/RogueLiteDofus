import { describe, it, expect } from "vitest";
import { genererCarte } from "./carte";
import { CLASSES, ZONES, trancheDe, localiserZone, offsetToile, xpEffective, XP_PAR_TYPE, XP_PAR_TOILE, type TrancheDef } from "./data";
import { toileDeZone, toileDeItem, niveauMaxTranche, nouvelleRun, gagnerXPPerso, sauverRunEnCours, chargerRunEnCours, trancheDeverrouillee, trancheJouable, pvMaxPerso } from "./run";
import { progressionInitiale, pvMaxFor } from "./progression";
import type { Meta } from "./types";

/** Table de tranches factice : t2 n'a pas encore de zones dans le jeu réel. */
const FAUSSES: TrancheDef[] = [
  { id: "t1", nom: "Tranche 1", niveaux: [1, 50], zones: ["a", "b", "c"] },
  { id: "t2", nom: "Tranche 2", niveaux: [50, 100], zones: ["d", "e"] },
  { id: "t3", nom: "Tranche 3", niveaux: [100, 150], zones: [] },
];

describe("résolution de tranche", () => {
  it("trancheDe renvoie la tranche demandée, et t1 par défaut si l'id est inconnu", () => {
    expect(trancheDe("t2", FAUSSES).nom).toBe("Tranche 2");
    expect(trancheDe("nawak", FAUSSES).id).toBe("t1"); // rétro-compat des saves
    expect(trancheDe("t1").zones.length).toBe(12); // table réelle : T1 a 12 zones
  });

  it("localiserZone donne la tranche et l'index dans l'ordre de jeu", () => {
    expect(localiserZone("c", FAUSSES)).toEqual({ tranche: FAUSSES[0], index: 2 });
    expect(localiserZone("d", FAUSSES)).toEqual({ tranche: FAUSSES[1], index: 0 });
    expect(localiserZone("inconnue", FAUSSES)).toBeNull();
    // table réelle : Incarnam ouvre T1, le Nid du Kwakwa la ferme
    expect(localiserZone("incarnam")!.index).toBe(0);
    expect(localiserZone("kwakwa")!.index).toBe(11);
  });

  it("offsetToile cumule les zones des tranches précédentes", () => {
    expect(offsetToile("t1", FAUSSES)).toBe(0);
    expect(offsetToile("t2", FAUSSES)).toBe(3);
    expect(offsetToile("t3", FAUSSES)).toBe(5);
    expect(offsetToile("t1")).toBe(0);
    expect(offsetToile("t2")).toBe(12); // T1 = 12 zones → T2 démarre à la toile 13
  });
});

describe("xpEffective (multiplicateur d'XP par tranche)", () => {
  it("une tranche sans xpMult (t1) ne modifie pas le calcul toile seul", () => {
    const base = XP_PAR_TYPE.combat;
    const attendu = Math.round(base * (1 + XP_PAR_TOILE * (5 - 1)));
    expect(xpEffective(base, 5, "t1")).toBe(attendu);
  });

  it("t2 applique son multiplicateur xpMult au-dessus du calcul toile", () => {
    const base = XP_PAR_TYPE.combat_dur;
    const toile = 13;
    const sansMult = base * (1 + XP_PAR_TOILE * (toile - 1));
    const attendu = Math.round(sansMult * trancheDe("t2").xpMult!);
    expect(trancheDe("t2").xpMult).toBeDefined();
    expect(trancheDe("t2").xpMult).not.toBe(1);
    expect(xpEffective(base, toile, "t2")).toBe(attendu);
  });

  it("toile 1 : le multiplicateur de toile est neutre, seul xpMult (s'il existe) joue", () => {
    const base = 200;
    expect(xpEffective(base, 1, "t1")).toBe(base); // t1 : ni toile ni xpMult ne bougent rien
  });
});

describe("toile d'une zone", () => {
  it("numérote en continu à travers les tranches", () => {
    expect(toileDeZone("a", FAUSSES)).toBe(1);
    expect(toileDeZone("c", FAUSSES)).toBe(3);
    expect(toileDeZone("d", FAUSSES)).toBe(4); // 1re zone de t2 = juste après les 3 de t1
    expect(toileDeZone("e", FAUSSES)).toBe(5);
    expect(toileDeZone("inconnue", FAUSSES)).toBe(1); // défaut prudent
  });

  it("table réelle : T1 va de la toile 1 à la toile 12", () => {
    expect(toileDeZone("incarnam")).toBe(1);
    expect(toileDeZone("kwakwa")).toBe(12);
  });
});

describe("toile d'origine d'un objet", () => {
  it("table réelle : un objet de la première toile renvoie 1, un objet de la douzième renvoie 12", () => {
    expect(toileDeItem("chapeau_de_l_aventurier")).toBe(1); // toile 1 (Incarnam)
    expect(toileDeItem("kwakwaffe")).toBe(12); // toile 12 (Nid du Kwakwa), pool boss
    expect(toileDeItem("objet_inexistant")).toBe(1); // repli prudent
  });

  it("la borne de parcours dérive du total des zones de TOUTES les tranches passées, pas de TRANCHES[0] en dur", () => {
    // FAUSSES ne totalise que 5 zones (3 + 2 + 0) : un objet de la toile réelle
    // 8 (Scarafeuilles) est hors de cette plage fictive et doit retomber sur le
    // repli 1 — l'ancienne implémentation ignorait le paramètre `tranches` et
    // parcourait toujours TRANCHES[0].zones.length (12), donc le trouvait à
    // tort en toile 8.
    expect(toileDeItem("scaracoiffe_noire", FAUSSES)).toBe(1);
  });
});

describe("cap de niveau par tranche", () => {
  // mock localStorage (l'environnement de test n'en a pas)
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  it("le cap vient de la tranche demandée", () => {
    expect(niveauMaxTranche("t1")).toBe(50);
    expect(niveauMaxTranche("t2")).toBe(100);
    expect(niveauMaxTranche("nawak")).toBe(50); // défaut t1
  });

  it("une run neuve porte sa tranche et démarre au niveau de départ de celle-ci", () => {
    const t1 = nouvelleRun(["iop"]);
    expect(t1.trancheId).toBe("t1");
    expect(t1.persos[0].progression.niveau).toBe(1);

    const t2 = nouvelleRun(["iop"], 0, "t2");
    expect(t2.trancheId).toBe("t2");
    expect(t2.persos[0].progression.niveau).toBe(50);
  });

  it("gagnerXPPerso plafonne au cap de la tranche passée", () => {
    const run = nouvelleRun(["iop"], 0, "t1");
    gagnerXPPerso(run.persos[0], 10_000_000, "t1");
    expect(run.persos[0].progression.niveau).toBe(50);
    gagnerXPPerso(run.persos[0], 10_000_000, "t2"); // même perso, cap plus haut
    expect(run.persos[0].progression.niveau).toBe(100);
  });

  it("une run sauvegardée sans trancheId se recharge en t1", () => {
    const run = nouvelleRun(["iop"]);
    sauverRunEnCours(0, run);
    const brut = JSON.parse(localStorage.getItem("rld_run_v0")!);
    delete brut.run.trancheId; // save d'avant le multi-tranches
    localStorage.setItem("rld_run_v0", JSON.stringify(brut));
    expect(chargerRunEnCours()!.run.trancheId).toBe("t1");
  });
});

describe("PV de départ d'une équipe neuve", () => {
  it("t2 : les héros naissent au niveau de la tranche avec leurs PV au maximum réel", () => {
    const run = nouvelleRun(["iop", "cra"], 0, "t2");
    for (const perso of run.persos) {
      expect(perso.progression.niveau).toBe(50);
      expect(perso.pvActuels).toBe(pvMaxPerso(perso));
    }
    // au niveau 50, les stats (donc les PV max) sont déjà bien au-dessus de la base :
    // sans resynchronisation, les PV courants resteraient à la valeur de base du niveau 1
    const iop = run.persos[0];
    expect(pvMaxPerso(iop)).toBeGreaterThan(pvMaxFor(CLASSES.iop, progressionInitiale()));
  });

  it("t1 : au niveau 1, les PV courants sont déjà égaux au max (rien à resynchroniser)", () => {
    const run = nouvelleRun(["iop"], 0, "t1");
    expect(run.persos[0].pvActuels).toBe(pvMaxPerso(run.persos[0]));
  });
});

const metaVide = (): Meta => ({ dofus: [], archis: [], runs: 0, victoires: 0, succes: [], collection: {} });

describe("déverrouillage des tranches", () => {
  it("t1 est toujours ouverte, t2 exige une victoire en t1", () => {
    const meta = metaVide();
    expect(trancheDeverrouillee(meta, "t1")).toBe(true);
    expect(trancheDeverrouillee(meta, "t2")).toBe(false);
    meta.ascension = { t1: 0 }; // une victoire en A0 suffit
    expect(trancheDeverrouillee(meta, "t2")).toBe(true);
    expect(trancheDeverrouillee(meta, "t3")).toBe(false);
  });

  it("une vieille save qui a gagné AVANT le mode Ascension déverrouille quand même t2", async () => {
    // `Meta.ascension` n'existe que depuis le mode Ascension : une save qui a
    // remporté la T1 avant ne porte que le compteur `victoires`. Sans ce
    // rattrapage, un joueur ayant fini la T1 resterait bloqué devant la T2.
    const { chargerMeta, sauverMeta, trancheDeverrouillee } = await import("./run");
    sauverMeta({ ...metaVide(), runs: 4, victoires: 1 });
    const brut = JSON.parse(localStorage.getItem("rld_meta_v0")!);
    delete brut.ascension; // save d'avant l'Ascension
    localStorage.setItem("rld_meta_v0", JSON.stringify(brut));
    const meta = chargerMeta();
    expect(meta.ascension).toEqual({ t1: 0 });
    expect(trancheDeverrouillee(meta, "t2")).toBe(true);
    expect(trancheDeverrouillee(meta, "t3")).toBe(false); // rien ne s'invente au-delà
  });

  it("une vieille save SANS victoire ne déverrouille rien", async () => {
    const { chargerMeta, sauverMeta, trancheDeverrouillee } = await import("./run");
    sauverMeta({ ...metaVide(), runs: 7, victoires: 0 });
    const brut = JSON.parse(localStorage.getItem("rld_meta_v0")!);
    delete brut.ascension;
    localStorage.setItem("rld_meta_v0", JSON.stringify(brut));
    const meta = chargerMeta();
    expect(meta.ascension).toBeUndefined();
    expect(trancheDeverrouillee(meta, "t2")).toBe(false);
  });

  it("une tranche EN CHANTIER reste déverrouillable mais n'est pas lançable", async () => {
    // t2 a du contenu mais son équilibrage n'est pas fini : on la laisse visible
    // et mesurable au banc, sans permettre de la lancer. Le drapeau se retire
    // quand la tranche est prête, sans autre changement.
    const { TRANCHES, trancheDe } = await import("./data");
    const meta = metaVide();
    meta.ascension = { t1: 0 };
    expect(trancheDe("t2").enChantier, "t2 doit être marquée en chantier").toBe(true);
    expect(trancheDeverrouillee(meta, "t2")).toBe(true); // le clear de t1 la déverrouille toujours
    expect(trancheJouable(meta, "t2")).toBe(false); // mais elle ne se lance pas
    // le drapeau ne doit pas fuiter sur les autres tranches
    expect(trancheDe("t1").enChantier).toBeUndefined();
    expect(TRANCHES.filter((t) => t.enChantier).map((t) => t.id)).toEqual(["t2"]);
  });

  it("une tranche sans zone est déverrouillable mais pas jouable", () => {
    const meta = metaVide();
    meta.ascension = { t1: 0, t2: 0 };
    expect(trancheJouable(meta, "t1")).toBe(true);
    expect(trancheJouable(meta, "t3")).toBe(false); // t3 n'a pas encore de contenu
  });
});

describe("départ d'une tranche", () => {
  it("une tranche ≠ t1 se compose comme la t1, au niveau de DÉPART de la tranche", () => {
    // Il n'y a plus d'héritage d'équipe : t2 se joue avec une équipe neuve, née
    // au niveau 50 (`TrancheDef.niveaux[0]`) et sans équipement, exactement comme
    // t1 se joue avec une équipe neuve née au niveau 1.
    const run = nouvelleRun(["xelor", "feca"], 0, "t2");
    expect(run.trancheId).toBe("t2");
    expect(run.persos.every((p) => p.progression.niveau === 50)).toBe(true);
    expect(run.persos.every((p) => Object.keys(p.equipement).length === 0)).toBe(true);
    expect(run.inventaire).toEqual([]);
    expect(run.kamas).toBe(0);
  });
});

describe("pool de boss en liste", () => {
  it("le nœud donjon tire sa rencontre dans le pool de boss de la zone", () => {
    const zone = ZONES.find((z) => z.id === "incarnam")!;
    expect(Array.isArray(zone.pools.boss)).toBe(true);
    let rng = 0.99; // rng constant : tirage déterministe
    const carte = genererCarte(() => rng, zone.pools);
    const donjon = carte.noeuds.find((n) => n.type === "donjon")!;
    expect(zone.pools.boss).toContain(donjon.combatId);
  });

  it("un pool à plusieurs rencontres les tire toutes selon le rng", () => {
    const pools = { normales: ["inc_1"], elite: ["inc_elite"], boss: ["inc_boss", "kwa_boss"] };
    const tires = new Set<string>();
    for (const r of [0.1, 0.9]) {
      const carte = genererCarte(() => r, pools);
      tires.add(carte.noeuds.find((n) => n.type === "donjon")!.combatId!);
    }
    expect(tires.size).toBe(2); // les deux rencontres sont atteignables
  });
});
