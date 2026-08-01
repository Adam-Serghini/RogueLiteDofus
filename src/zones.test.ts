// =============================================================================
//  zones.test.ts — Intégrité référentielle des zones et de leur butin.
//  Garde-fou : à chaque nouvelle zone, ces invariants doivent tenir.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ZONES, COMBATS, MONSTRES, ITEMS, TRANCHES, zonesDeTranche, butinToile, itemsDeToile } from "./data";

describe("intégrité des zones", () => {
  for (const zone of ZONES) {
    describe(zone.nom, () => {
      const combatIds = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];

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

      it("chaque combat de donjon du pool contient le nombre de boss attendu (1, ou 2 pour une salle à Royaux jumelés)", () => {
        // Le Clos des Blops est la seule zone à salles de boss JUMELÉS (2 Blops
        // Royaux distincts par salle, cf. blops.test.ts) ; toutes les autres
        // gardent l'invariant historique d'un unique boss par salle.
        const attendu = zone.id === "clos_des_blops" ? 2 : 1;
        for (const combatId of zone.pools.boss) {
          const boss = COMBATS[combatId].ennemis.filter((e) => MONSTRES[e.monstre]?.boss);
          expect(boss.length, `${combatId} doit avoir ${attendu} boss`).toBe(attendu);
        }
      });

      it("a un pool de butin à toile dont les objets existent", () => {
        // Zones dont les objets sont attendus (Adam fournira le contenu) : elles
        // ne lâchent rien pour l'instant. Liste NOMMÉE — toute autre zone sans
        // butin est un bug.
        const SANS_BUTIN_POUR_LINSTANT = ["clos_des_blops", "cale_de_l_arche"];
        const pools = butinToile(zone.id);
        if (!pools) {
          expect(SANS_BUTIN_POUR_LINSTANT).toContain(zone.id);
          return;
        }
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

  it("les tranches pourvues de contenu couvrent ensemble toutes les ZONES, sans chevauchement", () => {
    const peuplees = TRANCHES.filter((t) => t.zones.length > 0);
    expect(peuplees.length).toBeGreaterThan(0);
    const toutesZones = peuplees.flatMap((t) => t.zones);
    expect(new Set(toutesZones).size, "aucune zone ne doit appartenir à deux tranches").toBe(toutesZones.length);
    expect(new Set(toutesZones)).toEqual(new Set(ZONES.map((z) => z.id)));
  });
});

describe("distribution des Dofus (un par groupe de zones)", () => {
  it("chaque boss de la t1 lâche un Dofus : Dofawa zones 1-6, Argenté zones 7-12", () => {
    const zones = TRANCHES[0].zones;
    zones.forEach((zoneId, i) => {
      const zone = ZONES.find((z) => z.id === zoneId)!;
      for (const combatId of zone.pools.boss) {
        const boss = COMBATS[combatId].ennemis
          .map((e) => MONSTRES[e.monstre])
          .find((m) => m.boss)!;
        expect(boss.dofus, `${zone.nom} (${combatId}) : son boss doit lâcher un Dofus`).toBe(i < 6 ? "dofawa" : "dofus_argente");
      }
    });
  });
});
