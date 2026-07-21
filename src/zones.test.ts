// =============================================================================
//  zones.test.ts — Intégrité référentielle des zones et de leur butin.
//  Garde-fou : à chaque nouvelle zone, ces invariants doivent tenir.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ZONES, COMBATS, MONSTRES, ITEMS, TRANCHES, zonesDeTranche, butinToile, itemsDeToile } from "./data";

describe("intégrité des zones", () => {
  for (const zone of ZONES) {
    describe(zone.nom, () => {
      const combatIds = [...zone.pools.normales, ...zone.pools.elite, zone.pools.boss];

      it("référence des combats existants", () => {
        for (const id of combatIds) expect(COMBATS[id], `combat ${id}`).toBeDefined();
      });

      it("tous les monstres des rencontres existent", () => {
        for (const id of combatIds) {
          for (const e of COMBATS[id].ennemis) {
            expect(MONSTRES[e.monstre], `monstre ${e.monstre} (${id})`).toBeDefined();
          }
        }
      });

      it("le combat de donjon contient exactement un boss", () => {
        const boss = COMBATS[zone.pools.boss].ennemis.filter((e) => MONSTRES[e.monstre]?.boss);
        expect(boss.length, `${zone.pools.boss} doit avoir 1 boss`).toBe(1);
      });

      it("a un pool de butin à toile dont les objets existent", () => {
        const pools = butinToile(zone.id);
        expect(pools, `butin de ${zone.id}`).not.toBeNull();
        for (const id of itemsDeToile(pools)) expect(ITEMS[id], `objet ${id}`).toBeDefined();
      });
    });
  }

  it("aucune position d'ennemi ne dépasse la grille 0..7", () => {
    for (const c of Object.values(COMBATS)) {
      for (const e of c.ennemis) expect(e.position).toBeGreaterThanOrEqual(0), expect(e.position).toBeLessThan(8);
    }
  });
});

describe("intégrité des tranches", () => {
  it("chaque zone de tranche existe dans ZONES (sans doublon)", () => {
    for (const t of TRANCHES) {
      expect(new Set(t.zones).size, `${t.id} sans doublon`).toBe(t.zones.length);
      for (const z of zonesDeTranche(t)) expect(z, `zone de ${t.id}`).toBeDefined();
    }
  });

  it("exactement une tranche active, et elle couvre toutes les ZONES", () => {
    const actives = TRANCHES.filter((t) => t.active);
    expect(actives.length).toBe(1);
    expect(new Set(actives[0].zones)).toEqual(new Set(ZONES.map((z) => z.id)));
  });
});

describe("distribution des Dofus (un par groupe de zones)", () => {
  it("chaque boss de la t1 lâche un Dofus : Dofawa zones 1-6, Argenté zones 7-12", () => {
    const zones = TRANCHES[0].zones;
    zones.forEach((zoneId, i) => {
      const zone = ZONES.find((z) => z.id === zoneId)!;
      const boss = COMBATS[zone.pools.boss].ennemis
        .map((e) => MONSTRES[e.monstre])
        .find((m) => m.boss)!;
      expect(boss.dofus, `${zone.nom} : son boss doit lâcher un Dofus`).toBe(i < 6 ? "dofawa" : "dofus_argente");
    });
  });
});
