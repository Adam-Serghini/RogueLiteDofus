// =============================================================================
//  banc.test.ts — cœur du banc d'essai (module PUR, sans DOM) : construction du
//  héros et des mannequins, compteurs conditionnels, boucles de mesure.
// =============================================================================
import { describe, it, expect } from "vitest";
import { construireHeros, construireMannequins, PV_MANNEQUIN } from "./banc";
import { CLASSES } from "./data";
import { statsFinales } from "./progression";
import { instanceDuTier } from "./run";

describe("construireHeros", () => {
  it("rend un combattant du bon niveau, aux caractéristiques de sa classe", () => {
    const h = construireHeros({ classeId: "iop", niveau: 50, toile: 1, equipement: "nu", rarete: "commun" });
    expect(h.niveau).toBe(50);
    expect(h.camp).toBe("joueur");
    const attendu = statsFinales(CLASSES.iop, { niveau: 50, xp: 0 });
    expect(h.stats.agilite).toBe(attendu.agilite);
  });

  it("l'équipement AUGMENTE les caractéristiques : set complet > nu", () => {
    const base = { classeId: "iop", niveau: 50, toile: 1, rarete: "commun" } as const;
    const nu = construireHeros({ ...base, equipement: "nu" });
    const set = construireHeros({ ...base, equipement: "set" });
    expect(set.pvMax).toBeGreaterThan(nu.pvMax);
  });

  it("le set complet porte plus de pièces que le mi-équipement", () => {
    const base = { classeId: "cra", niveau: 30, toile: 5, rarete: "commun" } as const;
    const mi = construireHeros({ ...base, equipement: "mi" });
    const set = construireHeros({ ...base, equipement: "set" });
    expect(set.pvMax).toBeGreaterThanOrEqual(mi.pvMax);
  });

  it("a des PA et un état de combat initialisés (sinon aucun sort n'est lançable)", () => {
    const h = construireHeros({ classeId: "iop", niveau: 1, toile: 1, equipement: "nu", rarete: "commun" });
    expect(h.paActuels).toBe(h.paMax);
    expect(h.paMax).toBeGreaterThanOrEqual(6);
    expect(h.effets).toEqual([]);
    expect(h.cooldowns).toEqual({});
  });

  it("porte le bouclier de départ du Bonnet Spairance (non-régression : combattantDepuisPerso l'écrase, il ne doit jamais être remis à 0 après)", () => {
    const bonnet = instanceDuTier("bonnet_spairance", "legendaire");
    expect(bonnet).not.toBeNull(); // sinon le test ne prouve rien
    const h = construireHeros({
      classeId: "iop", niveau: 50, toile: 10, equipement: "nu", rarete: "commun",
      surcharges: { coiffe: bonnet! },
    });
    expect(h.bouclier).toBeGreaterThan(0);
  });
});

describe("construireMannequins", () => {
  it("place les mannequins aux positions demandées, dans le camp ennemi", () => {
    const m = construireMannequins([{ position: 0 }, { position: 4 }]);
    expect(m.map((x) => x.position)).toEqual([0, 4]);
    expect(m.every((x) => x.camp === "ennemi")).toBe(true);
    expect(new Set(m.map((x) => x.ref)).size).toBe(2); // refs uniques
  });

  it("leur donne des PV assez grands pour ne jamais mourir pendant une mesure", () => {
    const [m] = construireMannequins([{ position: 0 }]);
    expect(m.pvActuels).toBe(PV_MANNEQUIN);
    expect(m.pvMax).toBe(PV_MANNEQUIN);
  });

  it("applique les résistances demandées, 0 par défaut", () => {
    const [avecRes, sansRes] = construireMannequins([
      { position: 0, resistances: { feu: 0.5 } },
      { position: 1 },
    ]);
    expect(avecRes.resistances.feu).toBe(0.5);
    expect(sansRes.resistances).toEqual({});
  });

  it("ne peut pas esquiver : l'esquive brouillerait la mesure", () => {
    const [m] = construireMannequins([{ position: 0 }]);
    expect(m.stats.agilite).toBe(0);
  });
});
