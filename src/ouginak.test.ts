// =============================================================================
//  ouginak.test.ts — Kit de l'Ouginak : Proie, Rage, Dépouille, Tétanisation,
//  Tibias, Apaisement.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, degatsCible, RAGE_MAX, RAGE_BONUS,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Ouginak prêt à combattre (position avant, agilité 0 pour le déterminisme). */
function ouginak(): Combatant {
  const c = equipeCombattante(nouvelleRun(["ouginak"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
function ennemis(combatId = "gob_boss"): Combatant[] {
  return fabriquerEnnemis(combatId).map((e) => {
    e.stats = { ...e.stats, agilite: 0 };
    e.pvActuels = 500; e.pvMax = 500;
    return e;
  });
}

describe("classe Ouginak", () => {
  it("existe avec son kit de 6 sorts", () => {
    expect(CLASSES.ouginak).toBeDefined();
    expect(CLASSES.ouginak.sorts).toEqual(["proie", "molosse", "depouille", "tetanisation", "tibias", "apaisement"]);
    for (const id of CLASSES.ouginak.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Rage", () => {
  it("se gagne APRÈS le lancer, plafonne à RAGE_MAX et booste les dégâts", () => {
    const oug = ouginak();
    const [e] = ennemis();
    const cs = [oug, e];
    for (let i = 0; i < 5; i++) lancerSort(oug, SORTS.molosse, e.ref, cs, ctx());
    expect(oug.rage).toBe(RAGE_MAX); // 5 lancers → cap à 3
    // à rage max, un même coup inflige ×(1 + RAGE_BONUS×3)
    const sansRage = degatsCible({ ...oug, rage: 0 }, SORTS.molosse, e, { useMax: true, mult: 1, ctx: ctx() }).dmg;
    const avecRage = degatsCible(oug, SORTS.molosse, e, { useMax: true, mult: 1, ctx: ctx() }).dmg;
    // ±1 : le pipeline n'arrondit qu'en bout de chaîne
    expect(Math.abs(avecRage - sansRage * (1 + RAGE_BONUS * RAGE_MAX))).toBeLessThanOrEqual(1);
  });
});

describe("Apaisement", () => {
  it("exige au moins 1 Rage, consomme TOUT et soigne par charge", () => {
    const oug = ouginak();
    const cs = [oug, ...ennemis()];
    expect(ciblesValides(oug, SORTS.apaisement, cs)).toEqual([]); // 0 rage → injouable
    oug.rage = 3;
    expect(ciblesValides(oug, SORTS.apaisement, cs)).toEqual([oug]);
    oug.pvActuels = 100;
    lancerSort(oug, SORTS.apaisement, oug.ref, cs, ctx());
    expect(oug.rage).toBe(0); // tout consommé
    expect(oug.pvActuels).toBe(100 + SORTS.apaisement.baseMax * 3); // jet max × 3 charges (multSoin = 1)
  });
});

describe("Proie", () => {
  it("marque UNIQUE : le recast déplace la marque ; l'équipe vole 10 % des dégâts", () => {
    const oug = ouginak();
    const [e1, e2] = ennemis();
    const cs = [oug, e1, e2];
    lancerSort(oug, SORTS.proie, e1.ref, cs, ctx());
    expect(e1.effets.some((x) => x.stat === "proie")).toBe(true);
    lancerSort(oug, SORTS.proie, e2.ref, cs, ctx()); // recast → la marque bouge
    expect(e1.effets.some((x) => x.stat === "proie")).toBe(false);
    expect(e2.effets.some((x) => x.stat === "proie")).toBe(true);
    // n'importe quel allié frappant la proie vole 10 % des dégâts infligés
    oug.pvActuels = 100;
    const avant = e2.pvActuels;
    lancerSort(oug, SORTS.molosse, e2.ref, cs, ctx());
    const dmg = avant - e2.pvActuels;
    expect(dmg).toBeGreaterThan(0);
    expect(oug.pvActuels).toBe(100 + Math.round(dmg * 0.1));
  });
});

describe("Tétanisation", () => {
  it("la cible ne peut plus viser la ligne arrière (même exposée)", () => {
    const oug = ouginak();
    const [e] = ennemis();
    const cs = [oug, e];
    const cible = equipeCombattante(nouvelleRun(["cra"]))[0];
    cible.position = 5; // ligne arrière, EXPOSÉE (pas de ligne avant)
    const tousCs = [oug, cible, e];
    // sans tétanie : l'arrière exposé est ciblable (règle de ligne) et Tir courbe le vise
    expect(ciblesValides(e, SORTS.tir_courbe, tousCs).some((c) => c.ref === cible.ref)).toBe(true);
    lancerSort(oug, SORTS.tetanisation, e.ref, cs, ctx());
    expect(e.effets.some((x) => x.stat === "tetanise")).toBe(true);
    // tétanisé : plus AUCUNE cible arrière — la ligne avant (l'Ouginak) reste ciblable
    expect(ciblesValides(e, SORTS.tir_courbe, tousCs).some((c) => c.ref === cible.ref)).toBe(false);
    expect(ciblesValides(e, SORTS.tir_courbe, tousCs).some((c) => c.ref === oug.ref)).toBe(true);
    // et si SEULE la ligne arrière existe (exposée), il ne peut plus frapper personne
    expect(ciblesValides(e, SORTS.morsure, [cible, e]).length).toBe(0);
  });
});

describe("Dépouille", () => {
  it("+50 % de dégâts par AUTRE ennemi sur la ligne de la cible", () => {
    // gob_boss : Grunob (0), Gobaladée (1), Gobichon (2) → 3 ennemis en ligne avant
    const pack = ennemis();
    const grunob = pack[0];
    const dmgSeul = (() => {
      const o = ouginak();
      const avant = grunob.pvActuels;
      lancerSort(o, SORTS.depouille, grunob.ref, [o, grunob], ctx());
      return avant - grunob.pvActuels;
    })();
    grunob.pvActuels = 500;
    const avecLigne = (() => {
      const o = ouginak();
      const avant = grunob.pvActuels;
      lancerSort(o, SORTS.depouille, grunob.ref, [o, ...pack], ctx());
      return avant - grunob.pvActuels;
    })();
    // 2 autres ennemis en ligne avant avec lui → ×2 (±1 d'arrondi interne)
    expect(Math.abs(avecLigne - dmgSeul * 2)).toBeLessThanOrEqual(1);
  });

  it("la Lance (Forgelance) sur la ligne de la cible ne compte pas dans le bonus", () => {
    const pack = ennemis(); // gob_boss : 3 ennemis en ligne avant (0,1,2)
    const grunob = pack[0];
    const sansLance = (() => {
      const o = ouginak();
      const avant = grunob.pvActuels;
      lancerSort(o, SORTS.depouille, grunob.ref, [o, ...pack], ctx());
      return avant - grunob.pvActuels;
    })();
    grunob.pvActuels = 500;
    // une Lance vivante, plantée dans la MÊME rangée avant (case 3, encore libre)
    const lance: Combatant = { ...pack[1], ref: "lance_x", estLance: true, position: 3, pvActuels: 2, pvMax: 2 };
    const avecLance = (() => {
      const o = ouginak();
      const avant = grunob.pvActuels;
      lancerSort(o, SORTS.depouille, grunob.ref, [o, ...pack, lance], ctx());
      return avant - grunob.pvActuels;
    })();
    // la Lance en plus ne doit RIEN changer au bonus (elle n'est pas un ennemi réel)
    expect(Math.abs(avecLance - sansLance)).toBeLessThanOrEqual(1);
  });
});

describe("Tibias", () => {
  it("frappe TOUTE la ligne et repousse la cible PRINCIPALE en rangée arrière (sans débuff)", () => {
    const oug = ouginak();
    const pack = ennemis(); // 3 en ligne avant + éventuel arrière
    const devant = pack.filter((e) => e.position < 4);
    const cs = [oug, ...pack];
    const principale = devant[0];
    const autres = devant.slice(1).map((e) => [e, e.position] as const);
    lancerSort(oug, SORTS.tibias, principale.ref, cs, ctx());
    for (const e of devant) {
      expect(e.pvActuels).toBeLessThan(500); // toute la ligne a été touchée
      expect(e.effets.some((x) => x.stat === "degatsInfliges")).toBe(false); // plus de débuff
    }
    expect(principale.position).toBeGreaterThanOrEqual(4); // poussée en rangée arrière
    for (const [e, pos] of autres) expect(e.position).toBe(pos); // les secondaires ne bougent pas
    expect(oug.rage).toBe(1);
  });

  it("ne pousse pas si la rangée arrière ennemie est pleine (échec silencieux)", () => {
    const oug = ouginak();
    const pack = ennemis();
    const devant = pack.filter((e) => e.position < 4);
    // remplit la rangée arrière ennemie (cases 4-7)
    const arriere = [4, 5, 6, 7].map((p) => {
      const e = fabriquerEnnemis("combat_1")[0];
      e.ref = `bloc_${p}`; e.position = p; e.pvActuels = 500; e.pvMax = 500;
      return e;
    });
    const cs = [oug, ...devant, ...arriere];
    const principale = devant[0];
    const posAvant = principale.position;
    lancerSort(oug, SORTS.tibias, principale.ref, cs, ctx());
    expect(principale.position).toBe(posAvant); // aucune case libre : reste en avant
  });
});
