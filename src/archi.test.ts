// =============================================================================
//  archi.test.ts — Archimonstres : génération, capture, paliers du Dofus Ocre.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  fabriquerEnnemis, appliquerArchimonstres, capturerArchi, paliersOcre, bonusEquipe,
} from "./run";
import { ARCHI, ZONES, monstresDeZone } from "./data";
import type { Meta } from "./types";

const metaAvec = (nbArchis: number, dofus: string[] = []): Meta => ({
  dofus,
  archis: Array.from({ length: nbArchis }, (_, i) => `m${i}`),
});

describe("appliquerArchimonstres", () => {
  it("transforme et booste les ennemis quand le tirage passe", () => {
    const e = fabriquerEnnemis("combat_1");
    const pvAvant = e[0].pvMax;
    const forceAvant = e[0].stats.force;
    appliquerArchimonstres(e, () => 0, 1); // chance 1, rng 0 → tous archi
    expect(e[0].archi).toBe(true);
    expect(e[0].nom).toBe("Tour le Vice"); // vrai nom d'Archimonstre (Tournesol Sauvage)
    expect(e[0].pvMax).toBe(Math.round(pvAvant * ARCHI.pvMult));
    expect(e[0].stats.force).toBe(Math.round(forceAvant * ARCHI.statMult));
  });

  it("ne transforme personne si le tirage échoue", () => {
    const e = fabriquerEnnemis("combat_1");
    appliquerArchimonstres(e, () => 0.99, 0.08);
    expect(e.every((x) => !x.archi)).toBe(true);
  });
});

describe("capture d'Archimonstre", () => {
  it("ajoute une espèce une seule fois", () => {
    const meta = metaAvec(0);
    expect(capturerArchi(meta, "bouftou")).toBe(true);
    expect(meta.archis).toContain("bouftou");
    expect(capturerArchi(meta, "bouftou")).toBe(false); // doublon ignoré
    expect(meta.archis.filter((x) => x === "bouftou").length).toBe(1);
  });
});

describe("paliers du Dofus Ocre", () => {
  it("franchit un palier tous les 50 archis", () => {
    expect(paliersOcre(metaAvec(0)).tier).toBe(0);
    expect(paliersOcre(metaAvec(49)).tier).toBe(0);
    expect(paliersOcre(metaAvec(50)).tier).toBe(1);
    expect(paliersOcre(metaAvec(50)).paBonus).toBe(1);
    const t2 = paliersOcre(metaAvec(100));
    expect(t2.paBonus).toBe(2);
    expect(t2.degats).toBeCloseTo(0.1);
    const t5 = paliersOcre(metaAvec(250));
    expect(t5.paBonus).toBe(3);
    expect(t5.degats).toBeCloseTo(0.3);
  });

  it("bonusEquipe combine Dofus Pourpre et palier Ocre", () => {
    const b = bonusEquipe(metaAvec(100, ["dofus_pourpre"]));
    expect(b.paBonus).toBe(2); // palier II
    expect(b.damageMult).toBeCloseTo(1 + 0.15 + 0.1); // Pourpre + Ocre II
  });
});

describe("monstresDeZone", () => {
  it("renvoie les espèces d'une zone, sans doublon", () => {
    const inc = ZONES.find((z) => z.id === "incarnam")!;
    const mons = monstresDeZone(inc);
    expect(mons.length).toBeGreaterThan(0);
    expect(new Set(mons).size).toBe(mons.length);
    expect(mons).toContain("chafer_debutant");
  });
});
