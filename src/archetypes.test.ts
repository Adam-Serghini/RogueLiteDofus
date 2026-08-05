// =============================================================================
//  archetypes.test.ts — Éléments & archétypes des héros.
//  La table vit dans classes.json ; CLASSES-ELEMENTS.md en est le reflet lisible.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CLASSES } from "./data";

/** La table de référence, telle que validée avec Adam le 2026-08-05. */
const TABLE: Record<string, { archetype: string; elements: string[] }> = {
  iop: { archetype: "melee", elements: ["terre", "feu"] },
  feca: { archetype: "melee", elements: ["terre", "feu"] },
  forgelance: { archetype: "melee", elements: ["terre", "feu"] },
  ouginak: { archetype: "melee", elements: ["terre", "air"] },
  sram: { archetype: "melee", elements: ["terre", "air"] },
  ecaflip: { archetype: "melee", elements: ["terre", "eau"] },
  sadida: { archetype: "melee", elements: ["terre", "eau"] },
  cra: { archetype: "distance", elements: ["feu", "air"] },
  roublard: { archetype: "distance", elements: ["feu", "eau"] },
  eniripsa: { archetype: "distance", elements: ["feu", "eau"] },
  eliotrope: { archetype: "distance", elements: ["feu", "terre"] },
  xelor: { archetype: "distance", elements: ["eau", "terre"] },
};

describe("table des classes", () => {
  it("chaque classe porte son archétype et ses deux éléments", () => {
    expect(Object.keys(CLASSES).sort()).toEqual(Object.keys(TABLE).sort());
    for (const [id, attendu] of Object.entries(TABLE)) {
      expect(CLASSES[id].archetype, id).toBe(attendu.archetype);
      expect(CLASSES[id].elements, id).toEqual(attendu.elements);
    }
  });

  it("toute classe a exactement deux éléments DISTINCTS", () => {
    for (const [id, c] of Object.entries(CLASSES)) {
      expect(c.elements.length, id).toBe(2);
      expect(new Set(c.elements).size, `${id} : paire en doublon`).toBe(2);
    }
  });

  it("la répartition des éléments est celle qu'on a décidée", () => {
    // Chiffrée pour qu'un changement de paire soit un ACTE VISIBLE et non un effet
    // de bord. L'air est volontairement rare (3 classes jouables) — c'est ce qui
    // justifie le plancher de 5 % de coup critique pour tout le monde.
    const jouables = Object.keys(CLASSES).filter((id) => id !== "sadida");
    const compte = (el: string) => jouables.filter((id) => CLASSES[id].elements.includes(el as never)).length;
    expect({ terre: compte("terre"), feu: compte("feu"), air: compte("air"), eau: compte("eau") })
      .toEqual({ terre: 8, feu: 7, air: 3, eau: 4 });
  });

  it("CLASSES-ELEMENTS.md ne diverge pas de classes.json", () => {
    // Un document de référence qui mentirait serait pire que pas de document.
    const md = readFileSync("CLASSES-ELEMENTS.md", "utf8");
    const NOM_EL: Record<string, string> = { terre: "terre", feu: "feu", air: "air", eau: "eau" };
    for (const [id, c] of Object.entries(CLASSES)) {
      const ligne = md.split("\n").find((l) => l.includes(`\`${id}\``));
      expect(ligne, `${id} absent de CLASSES-ELEMENTS.md`).toBeTruthy();
      expect(ligne, `${id} : archétype divergent`).toContain(c.archetype);
      for (const el of c.elements) expect(ligne, `${id} : ${el} manquant`).toContain(NOM_EL[el]);
    }
  });
});
