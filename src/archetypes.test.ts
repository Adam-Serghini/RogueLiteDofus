// =============================================================================
//  archetypes.test.ts — Éléments & archétypes des héros.
//  La table vit dans classes.json ; CLASSES-ELEMENTS.md en est le reflet lisible.
// =============================================================================
import { describe, it, expect } from "vitest";
import mdClassesElements from "../CLASSES-ELEMENTS.md?raw";
import { CLASSES } from "./data";
import { multOffensif, multSoin, statPourPoints, statsFinales, VITA_PAR_FORCE, PROSP_PAR_CHANCE } from "./progression";
import { chanceCrit, bonusDegatsCrit, critExcedent, elementsForts, elementDeFrappe } from "./combat";
import { combattantDepuisPerso, persoAuNiveau, fabriquerEnnemis } from "./run";

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

const stats = (o: Partial<Record<string, number>>) =>
  ({ force: 0, intelligence: 0, agilite: 0, vitalite: 0, chance: 0, ...o }) as never;

describe("effets secondaires des éléments", () => {
  it("feu : dégâts finaux, ~+15 % au niveau 50 et plafond +20 %", () => {
    expect(multOffensif(stats({ intelligence: 147 }))).toBeCloseTo(1.147, 3);
    expect(multOffensif(stats({ intelligence: 200 }))).toBeCloseTo(1.2, 3);
    expect(multOffensif(stats({ intelligence: 400 }))).toBeCloseTo(1.2, 3); // plafonné
  });

  it("air : l'agilité porte les DEUX moitiés du critique", () => {
    expect(chanceCrit(stats({ agilite: 147 }))).toBeCloseTo(0.35, 3); // plafond
    expect(chanceCrit(stats({ agilite: 40 }))).toBeCloseTo(0.15, 3);
    expect(bonusDegatsCrit(stats({ agilite: 147 }))).toBeCloseTo(0.45, 3); // plafond
    expect(bonusDegatsCrit(stats({ agilite: 50 }))).toBeCloseTo(0.35, 3);
  });

  it("air : plancher de 5 % de critique pour TOUT LE MONDE", () => {
    // L'air n'est que sur 3 classes jouables sur 11 ; sans plancher, huit classes ne
    // verraient jamais un seul coup critique, et un Iop frapperait 200 fois à plat.
    expect(chanceCrit(stats({}))).toBeCloseTo(0.05, 3);
    // la force ne donne PLUS de critique : elle donne de la vitalité passive
    expect(chanceCrit(stats({ force: 300 }))).toBeCloseTo(0.05, 3);
  });

  it("air : le crit plat des objets s'ajoute et peut déborder du plafond", () => {
    expect(chanceCrit(stats({ crit: 10 }))).toBeCloseTo(0.15, 3);
    expect(critExcedent(stats({ agilite: 147, crit: 20 }))).toBeCloseTo(0.2, 3);
    expect(critExcedent(stats({ agilite: 147 }))).toBe(0); // sans crit plat, jamais d'excédent
  });

  it("terre : vitalité passive, 1 pour 5 de force", () => {
    expect(VITA_PAR_FORCE).toBe(5);
    const s = statsFinales(CLASSES.iop, { niveau: 50, xp: 0 }); // terre + feu, mêlée
    // 98 de vitalité d'archétype + floor(147 / 5) = 29
    expect(s.vitalite).toBe(98 + 29);
  });

  it("eau : prospection passive, 1 pour 3 de chance", () => {
    expect(PROSP_PAR_CHANCE).toBe(3);
    const s = statsFinales(CLASSES.xelor, { niveau: 50, xp: 0 }); // eau + terre, distance
    expect(s.prospection).toBe((CLASSES.xelor.stats.prospection ?? 0) + Math.floor(196 / 3));
  });

  it("multSoin lit la caractéristique de FRAPPE, pas l'intelligence", () => {
    // Sans ça, l'Apaisement de l'Ouginak (terre+air) et le vampirisme de l'Ecaflip
    // (terre+eau) soigneraient à plat : ni l'un ni l'autre n'a feu.
    const oug = statsFinales(CLASSES.ouginak, { niveau: 50, xp: 0 });
    expect(oug.intelligence).toBe(CLASSES.ouginak.stats.intelligence); // aucun gain en feu
    expect(multSoin(oug, oug.force)).toBeGreaterThan(1.2); // et pourtant il soigne
  });
});

describe("les éléments en combat", () => {
  it("les deux ronds d'un héros SONT les deux éléments de sa classe", () => {
    const c = combattantDepuisPerso(persoAuNiveau("xelor", 50, 0)); // eau + terre
    expect(elementsForts(c)).toEqual(["eau", "terre"]);
  });

  it("un monstre garde le calcul par stats — il n'a pas d'éléments déclarés", () => {
    const [m] = fabriquerEnnemis("inc_1");
    expect(m.elements).toBeUndefined();
    expect(elementsForts(m)).toHaveLength(2);
  });

  it("l'élément de frappe par défaut est le PREMIER élément déclaré", () => {
    const c = combattantDepuisPerso(persoAuNiveau("eliotrope", 50, 0)); // feu + terre
    expect(elementDeFrappe(c)).toBe("feu");
  });

  it("persoAuNiveau produit les stats de l'archétype — c'est la porte de la Tranche 2", () => {
    const p = persoAuNiveau("iop", 50, 0);
    const c = combattantDepuisPerso(p);
    expect(c.stats.force).toBe(147);
    expect(c.pvMax).toBe(CLASSES.iop.pvBase + 98 + 29); // vitalité d'archétype + passif terre
    expect(c.pvActuels).toBe(c.pvMax);
  });

  it("une vieille save portant des points investis se charge sans broncher", () => {
    const vieille = {
      classeId: "iop", position: 0, equipement: {}, pvActuels: 50,
      progression: { niveau: 20, xp: 0, pointsDispo: 57, pointsInvestis: { force: 40, intelligence: 0, agilite: 0, vitalite: 17, chance: 0 } },
    } as never;
    const c = combattantDepuisPerso(vieille);
    // les points stockés sont IGNORÉS : les stats viennent du niveau et de la classe
    expect(c.stats.force).toBe(19 * 3);
  });
});
