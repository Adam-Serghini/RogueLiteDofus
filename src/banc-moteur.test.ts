// =============================================================================
//  banc-moteur.test.ts — la FAÇADE exposée à l'éditeur. Ce test existe pour
//  qu'un renommage dans combat.ts / banc.ts casse ici bruyamment, au lieu de
//  produire un editeur.html silencieusement inerte.
// =============================================================================
import { describe, it, expect } from "vitest";
import * as facade from "./banc-moteur";

describe("façade du banc d'essai", () => {
  it("expose exactement l'API que l'éditeur consomme", () => {
    expect(Object.keys(facade).sort()).toEqual([
      "REPETITIONS", "appliquerContenuEdite", "construireHeros",
      "construireMannequins", "mesurerLancer", "mesurerTour",
    ]);
  });

  it("chaque entrée est utilisable", () => {
    expect(typeof facade.construireHeros).toBe("function");
    expect(facade.REPETITIONS).toBeGreaterThan(0);
  });
});
