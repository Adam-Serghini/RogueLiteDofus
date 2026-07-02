// =============================================================================
//  zones.test.ts — Intégrité référentielle des zones et de leur butin.
//  Garde-fou : à chaque nouvelle zone, ces invariants doivent tenir.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ZONES, COMBATS, MONSTRES, PANOPLIES, ITEMS, BUTIN_ZONE } from "./data";

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

      it("a une panoplie de butin valide dont les pièces existent", () => {
        const panoId = BUTIN_ZONE[zone.id];
        expect(panoId, `butin de ${zone.id}`).toBeDefined();
        const pano = PANOPLIES[panoId];
        expect(pano, `panoplie ${panoId}`).toBeDefined();
        for (const piece of pano.pieces) expect(ITEMS[piece], `pièce ${piece}`).toBeDefined();
      });
    });
  }

  it("aucune position d'ennemi ne dépasse la grille 0..7", () => {
    for (const c of Object.values(COMBATS)) {
      for (const e of c.ennemis) expect(e.position).toBeGreaterThanOrEqual(0), expect(e.position).toBeLessThan(8);
    }
  });
});
