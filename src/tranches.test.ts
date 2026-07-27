import { describe, it, expect } from "vitest";
import { trancheDe, localiserZone, offsetToile, type TrancheDef } from "./data";

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
