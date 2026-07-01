// =============================================================================
//  equipement.test.ts — Objets (jets), panoplies, drops, équiper/déséquiper.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, combattantDepuisPerso, bonusEquipement,
  equiper, desequiper, tenterButin, rollItem,
} from "./run";
import { PANOPLIES } from "./data";

const MIN = () => 0;     // jet au minimum de la fourchette (déterministe)
const MAX = () => 0.999; // jet au maximum

describe("jets d'items (rollItem)", () => {
  it("tire chaque stat dans sa fourchette", () => {
    expect(rollItem("bouftou_coiffe", MIN).stats).toEqual({ force: 16, intelligence: 16 }); // [16,20] → min
    expect(rollItem("bouftou_coiffe", MAX).stats).toEqual({ force: 20, intelligence: 20 }); // → max
    expect(rollItem("paysan_anneau", MIN).stats).toEqual({}); // aucune stat gérée
  });
});

describe("bonus d'équipement & panoplie", () => {
  it("somme les stats rollées des objets équipés", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push(rollItem("bouftou_coiffe", MIN)); // force16 int16
    equiper(run.inventaire, p, 0);
    run.inventaire.push(rollItem("bouftou_amulette", MIN)); // vita11 force11 int11
    equiper(run.inventaire, p, 0);
    const b = bonusEquipement(p);
    expect(b.stats.force).toBe(27);
    expect(b.stats.intelligence).toBe(27);
    expect(b.stats.vitalite).toBe(11);
  });

  it("déclenche les bonus de panoplie aux seuils (3 et 6 pièces)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    for (const id of PANOPLIES.aventurier.pieces.slice(0, 3)) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).stats.vitalite).toBe(10);       // bonus seuil 3
    expect(bonusEquipement(p).resistances.terre ?? 0).toBe(0); // pas encore le bonus 6
    for (const id of PANOPLIES.aventurier.pieces.slice(3)) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).resistances.terre).toBe(0.05);   // bonus seuil 6
  });

  it("combattantDepuisPerso applique stats, PV et résistances de l'équipement", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    const base = combattantDepuisPerso(p);
    run.inventaire.push(rollItem("bouftou_cape", MIN)); // Cape Bouffante +36 vita (min)
    equiper(run.inventaire, p, 0);
    const equipe = combattantDepuisPerso(p);
    expect(equipe.pvMax).toBe(base.pvMax + 36);
    expect(equipe.stats.vitalite).toBe((base.stats.vitalite ?? 0) + 36);

    // panoplie Bouftou complète → résistance Terre du bonus 6 pièces
    for (const id of PANOPLIES.bouftou.pieces) {
      if (id === "bouftou_cape") continue; // déjà équipée plus haut
      run.inventaire.push(rollItem(id, MIN));
      equiper(run.inventaire, p, 0);
    }
    expect(combattantDepuisPerso(p).resistances.terre).toBe(0.15);
  });
});

describe("drops", () => {
  it("tenterButin renvoie des exemplaires et autorise les doublons", () => {
    const run = nouvelleRun(["iop"]);
    const drops = tenterButin(run, "aventurier", "combat", MIN); // rng 0 → tout tombe
    expect(drops.length).toBe(6);
    expect(drops[0]).toHaveProperty("stats"); // exemplaire rollé
    const drops2 = tenterButin(run, "aventurier", "combat", MIN); // re-drop possible
    expect(drops2.length).toBe(6);
    expect(run.inventaire.length).toBe(12); // doublons cumulés
  });

  it("aucun drop si le tirage dépasse la probabilité", () => {
    const run = nouvelleRun(["iop"]);
    expect(tenterButin(run, "aventurier", "combat", () => 0.99).length).toBe(0);
  });

  it("la prospection de l'équipe augmente le taux de drop", () => {
    const faible = nouvelleRun(["iop"]);        // prospection 100 → p = 0,25×1,10 = 0,275
    const forte = nouvelleRun(["cra", "sram"]); // prospection 200 → p = 0,25×1,20 = 0,300
    const rng = () => 0.29; // entre les deux seuils
    expect(tenterButin(faible, "aventurier", "combat", rng).length).toBe(0);
    expect(tenterButin(forte, "aventurier", "combat", rng).length).toBeGreaterThan(0);
  });
});

describe("équiper / déséquiper", () => {
  it("échange l'exemplaire entre l'inventaire et le slot", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push(rollItem("aventurier_coiffe", MIN));
    equiper(run.inventaire, p, 0);
    expect(p.equipement.coiffe?.id).toBe("aventurier_coiffe");
    expect(run.inventaire.length).toBe(0);
    desequiper(run.inventaire, p, "coiffe");
    expect(p.equipement.coiffe).toBeUndefined();
    expect(run.inventaire.some((i) => i.id === "aventurier_coiffe")).toBe(true);
  });

  it("équiper un 2e objet du même slot renvoie l'ancien à l'inventaire", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push(rollItem("aventurier_coiffe", MIN), rollItem("bouftou_coiffe", MIN));
    equiper(run.inventaire, p, 0); // aventurier_coiffe
    equiper(run.inventaire, p, 0); // bouftou_coiffe (désormais en tête)
    expect(p.equipement.coiffe?.id).toBe("bouftou_coiffe");
    expect(run.inventaire.some((i) => i.id === "aventurier_coiffe")).toBe(true);
  });
});

describe("attaque d'arme (case 1)", () => {
  it("l'arme équipée fournit une attaque au combattant ; aucune sinon", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    expect(combattantDepuisPerso(p).armeSort).toBeUndefined(); // sans arme : case 1 vide
    run.inventaire.push(rollItem("bouftou_arme", MIN));
    equiper(run.inventaire, p, 0);
    const c = combattantDepuisPerso(p);
    expect(c.armeSort?.coutPA).toBe(4); // coût propre à l'arme
    expect(c.armeSort?.baseMax).toBe(22); // dégâts propres à l'arme
    expect(c.armeSort?.cible).toBe("ennemi_ligne");
  });
});
