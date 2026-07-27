import { describe, it, expect } from "vitest";
import { trancheDe, localiserZone, offsetToile, type TrancheDef } from "./data";
import { toileDeZone, toileDeItem, niveauMaxTranche, nouvelleRun, gagnerXPPerso, sauverRunEnCours, chargerRunEnCours } from "./run";

/** Table de tranches factice : t2 n'a pas encore de zones dans le jeu réel. */
const FAUSSES: TrancheDef[] = [
  { id: "t1", nom: "Tranche 1", niveaux: [1, 50], zones: ["a", "b", "c"], active: true },
  { id: "t2", nom: "Tranche 2", niveaux: [50, 100], zones: ["d", "e"], active: true },
  { id: "t3", nom: "Tranche 3", niveaux: [100, 150], zones: [], active: true },
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
