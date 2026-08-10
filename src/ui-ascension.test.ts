// =============================================================================
//  ui-ascension.test.ts — Le rendu en étoiles d'un cran d'Ascension doit rester
//  une fonction PURE et UNIQUE (accueil, carte, récap de fin la partagent) :
//  une formule copiée deux fois finit par raconter deux histoires.
// =============================================================================
import { describe, it, expect } from "vitest";
import { etoiles } from "./ui/composants";
import { ASCENSION_MAX } from "./data";

describe("affichage des crans d'Ascension", () => {
  it("★ pleines = palier + 1, sur cinq", () => {
    expect(etoiles(0)).toBe("★☆☆☆☆");
    expect(etoiles(3)).toBe("★★★★☆");
    expect(etoiles(ASCENSION_MAX)).toBe("★★★★★");
  });

  it("un palier hors bornes ne produit jamais plus de cinq étoiles", () => {
    expect(etoiles(99)).toBe("★★★★★");
    expect(etoiles(-1)).toBe("★☆☆☆☆");
  });
});
