// =============================================================================
//  zones.test.ts — Intégrité référentielle des zones et de leur butin.
//  Garde-fou : à chaque nouvelle zone, ces invariants doivent tenir.
// =============================================================================
import { describe, it, expect } from "vitest";
import { ZONES, COMBATS, MONSTRES, ITEMS, TRANCHES, ERRANTS, zonesDeTranche, butinToile, itemsDeToile } from "./data";

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
        // Six zones ont une salle de boss JUMELÉE : le Clos des Blops et la
        // Gelaxième Dimension (2 Royaux/Royales distincts par salle, cf.
        // blops.test.ts et gelees.test.ts), le Terrier du Wa Wabbit (Wa Wabbit
        // + Wa Wobot, cf. wabbit.test.ts), le Bateau du Chouque (Le Chouque +
        // Kanniboul Ebil, cf. kanniboul.test.ts) et le Repaire du Kharnozor
        // (Kharnozor + Draegnerys) et le Domaine Ancestral (Reine Nyée +
        // Abraknyde Ancestral, cf. ancestral.test.ts) ; toutes les autres
        // gardent l'invariant historique d'un unique boss par salle.
        const attendu = ["clos_des_blops", "gelaxieme_dimension", "terrier_wa_wabbit",
          "bateau_du_chouque", "repaire_kharnozor", "domaine_ancestral"].includes(zone.id) ? 2 : 1;
        for (const combatId of zone.pools.boss) {
          const boss = COMBATS[combatId].ennemis.filter((e) => MONSTRES[e.monstre]?.boss);
          expect(boss.length, `${combatId} doit avoir ${attendu} boss`).toBe(attendu);
        }
      });

      it("a un pool de butin à toile dont les objets existent", () => {
        // Zones dont les objets sont attendus (Adam fournira le contenu) : elles
        // ne lâchent rien pour l'instant. Depuis l'Arbre de Moon, la liste couvre
        // TOUTE la Tranche 2 — mais elle reste NOMMÉE : toute autre zone sans butin
        // est un bug, et c'est ce qui protège la Tranche 1.
        const SANS_BUTIN_POUR_LINSTANT = [
          "clos_des_blops", "cale_de_l_arche", "gelaxieme_dimension", "laboratoire_brumen",
          "terrier_wa_wabbit", "pitons_rocheux", "bateau_du_chouque", "antre_dragon_cochon",
          "repaire_kharnozor", "taniere_meulou", "domaine_ancestral", "arbre_de_moon",
        ];
        const pools = butinToile(zone.id);
        if (!pools) {
          expect(SANS_BUTIN_POUR_LINSTANT).toContain(zone.id);
          return;
        }
        for (const id of itemsDeToile(pools)) expect(ITEMS[id], `objet ${id}`).toBeDefined();
      });
    });
  }

  it("aucune espèce définie n'est ORPHELINE — toute espèce est placée en zone OU errante", () => {
    // Ce test est né d'une coquille réelle (2026-08-04) : le Tofu Maléfique existait dans
    // `monstres.json` avec son archimonstre, mais n'apparaissait dans AUCUNE rencontre —
    // donc invisible au Bestiaire et incapturable. Une espèce définie et jamais placée est
    // du contenu mort.
    //
    // Les Piou errants (2026-08-05) ne sont dans aucune zone PAR CONSTRUCTION : ils
    // surgissent via `ERRANTS`/`appliquerErrants`. Ils ne sont donc pas une exception
    // NOMMÉE — la règle réelle est « placée en zone ou déclarée errante », et sous cette
    // forme le test continue d'attraper un vrai oubli.
    const placees = new Set(ZONES.flatMap((z) =>
      [...z.pools.normales, ...z.pools.elite, ...z.pools.boss]
        .flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre))));
    for (const def of Object.values(ERRANTS)) for (const id of def.especes) placees.add(id);
    const orphelines = Object.keys(MONSTRES).filter((id) => !placees.has(id));
    expect(orphelines, `espèces définies mais placées nulle part : ${orphelines.join(", ")}`).toEqual([]);
  });

  it("une espèce errante est joignable : elle a un archimonstre et un sort", () => {
    // Le pendant du test « toute capturable joignable en pack normal » : celui-ci ne voit
    // que les pools de zone, donc les errants y échappent sans le savoir. Ici on vérifie
    // ce qui les rend réellement atteignables.
    for (const [tranche, def] of Object.entries(ERRANTS)) {
      expect(def.chance, `${tranche} : un taux nul rendrait les errants inatteignables`).toBeGreaterThan(0);
      for (const id of def.especes) {
        expect(MONSTRES[id], `${id} déclaré errant mais inexistant`).toBeTruthy();
        expect(MONSTRES[id].archiNom, `${id} errant sans archimonstre : rien à capturer`).toBeTruthy();
        expect(MONSTRES[id].sorts.length, `${id} errant sans sort`).toBeGreaterThan(0);
      }
    }
  });

  it("toute espèce capturable est joignable en pack NORMAL", () => {
    // Sinon son archimonstre est enfermé derrière les nœuds élite ou le donjon, qui sont
    // rares — c'est la règle appliquée à toutes les zones de la Tranche 2. Deux cas
    // PRÉEXISTANTS de Tranche 1 restent tolérés NOMMÉMENT, en attente d'arbitrage : les
    // déplacer changerait la difficulté d'un pack normal d'une tranche équilibrée.
    const ENFERMES_TOLERES = [
      "chef_de_guerre_bouftou", // Tainéla : en élite ET dans la salle du boss, jamais en normal
      "palmifleur_morito",      // Grotte Hesque : 219 PV contre 113-123 pour ses cousins
    ];
    for (const zone of ZONES) {
      const enNormal = new Set(zone.pools.normales
        .flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
      const toutes = new Set([...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]
        .flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
      for (const id of toutes) {
        if (!MONSTRES[id].archiNom || ENFERMES_TOLERES.includes(id)) continue;
        expect(enNormal.has(id), `${zone.nom} : ${id} est capturable mais absent des packs normaux`).toBe(true);
      }
    }
  });

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

