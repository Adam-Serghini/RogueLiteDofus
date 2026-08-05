// =============================================================================
//  archetypes.test.ts — Éléments & archétypes des héros.
//  La table vit dans classes.json ; CLASSES-ELEMENTS.md en est le reflet lisible.
// =============================================================================
import { describe, it, expect } from "vitest";
import mdClassesElements from "../CLASSES-ELEMENTS.md?raw";
import { CLASSES } from "./data";
import { statPourPoints, statsFinales } from "./progression";

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
    const md = mdClassesElements;
    const NOM_EL: Record<string, string> = { terre: "terre", feu: "feu", air: "air", eau: "eau" };
    for (const [id, c] of Object.entries(CLASSES)) {
      const ligne = md.split("\n").find((l) => l.includes(`\`${id}\``));
      expect(ligne, `${id} absent de CLASSES-ELEMENTS.md`).toBeTruthy();
      expect(ligne, `${id} : archétype divergent`).toContain(c.archetype);
      for (const el of c.elements) expect(ligne, `${id} : ${el} manquant`).toContain(NOM_EL[el]);
    }
  });
});

/** Caractéristique de frappe d'une classe à un niveau donné. */
const frappe = (id: string, niveau: number): number => {
  const c = CLASSES[id];
  const stats = statsFinales(c, { niveau, xp: 0 });
  const parEl: Record<string, keyof typeof stats> = {
    terre: "force", feu: "intelligence", air: "agilite", eau: "chance",
  };
  return (stats[parEl[c.elements[0]]] as number) ?? 0;
};

describe("courbes de progression", () => {
  it("le mêlée reproduit EXACTEMENT la courbe documentée", () => {
    // 147/248/315/365 : la courbe d'avant le rework, à 3 points par niveau et par
    // caractéristique. C'est le test qui prouve que le tarif croissant a survécu à
    // l'allocation automatique — sans lui, un distance atteindrait 796 au niveau 200.
    expect([50, 100, 150, 200].map((n) => frappe("iop", n))).toEqual([147, 248, 315, 365]);
  });

  it("le distance monte ~20 % plus haut", () => {
    expect([50, 100, 150, 200].map((n) => frappe("cra", n))).toEqual([196, 298, 365, 432]);
  });

  it("les DEUX éléments de la classe montent, les deux autres restent à la base", () => {
    const s = statsFinales(CLASSES.iop, { niveau: 50, xp: 0 }); // terre + feu
    expect(s.force).toBe(147);
    expect(s.intelligence).toBe(147);
    expect(s.agilite).toBe(CLASSES.iop.stats.agilite); // air : non concerné
    expect(s.chance ?? 0).toBe(CLASSES.iop.stats.chance ?? 0);
  });

  it("statPourPoints applique le tarif croissant aux seuils", () => {
    expect(statPourPoints(0)).toBe(0);
    expect(statPourPoints(1)).toBe(1);
    expect(statPourPoints(200)).toBe(200); // dernier point au tarif 1
    expect(statPourPoints(202)).toBe(201); // tarif 2 : 2 points pour 1 de stat
    expect(statPourPoints(400)).toBe(300); // fin du tarif 2
    expect(statPourPoints(403)).toBe(301); // tarif 3
  });

  it("la vitalité finale distingue le mêlée du distance, de bout en bout via statsFinales", () => {
    // iop (mêlée, terre+feu) niveau 50 : 98 de vitalité au tarif d'archétype
    // (2/niveau × 49 niveaux, sous le seuil de 200 → tarif 1, donc 98 tel quel)
    // + le passif de terre, PAR-DESSUS le tarif : force finale 147 (voir le test
    // de courbe ci-dessus) / VITA_PAR_FORCE (5) = floor(147/5) = 29.
    // Total : 98 + 29 = 127.
    const iop = statsFinales(CLASSES.iop, { niveau: 50, xp: 0 });
    expect(iop.vitalite).toBe(127);

    // cra (distance, feu+air) niveau 50 : 49 de vitalité au tarif d'archétype
    // (1/niveau × 49 niveaux, tarif 1). La terre n'est pas un de ses éléments,
    // donc sa force reste à 0 et le passif de terre n'ajoute rien : total 49.
    const cra = statsFinales(CLASSES.cra, { niveau: 50, xp: 0 });
    expect(cra.vitalite).toBe(49);

    // le compromis central des deux archétypes : le mêlée est plus robuste.
    expect(iop.vitalite).toBeGreaterThan(cra.vitalite);
  });

  it("au niveau 1, un héros n'a que sa base de classe", () => {
    const s = statsFinales(CLASSES.iop, { niveau: 1, xp: 0 });
    expect(s.force).toBe(CLASSES.iop.stats.force);
  });
});
