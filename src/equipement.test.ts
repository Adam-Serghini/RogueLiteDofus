// =============================================================================
//  equipement.test.ts — Objets, panoplies, drops, équiper/déséquiper.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, combattantDepuisPerso, bonusEquipement,
  equiper, desequiper, piecesEligibles, tenterButin,
} from "./run";
import { PANOPLIES } from "./data";

describe("bonus d'équipement & panoplie", () => {
  it("somme les stats des objets équipés", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push("aventurier_coiffe", "aventurier_amulette");
    equiper(run.inventaire, p, "aventurier_coiffe");   // +12 vita
    equiper(run.inventaire, p, "aventurier_amulette"); // +10 vita +5 soin
    const b = bonusEquipement(p);
    expect(b.stats.vitalite).toBe(22);
    expect(b.stats.soin).toBe(5);
  });

  it("déclenche les bonus de panoplie aux seuils (3 et 6 pièces)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    // équipe 3 pièces → bonus seuil 3 (+10 vita)
    for (const id of PANOPLIES.aventurier.pieces.slice(0, 3)) { run.inventaire.push(id); equiper(run.inventaire, p, id); }
    expect(bonusEquipement(p).resistances.terre ?? 0).toBe(0); // pas encore le bonus 6
    // complète la panoplie → bonus seuil 6 (+15 vita, +5 % rés tous éléments)
    for (const id of PANOPLIES.aventurier.pieces.slice(3)) { run.inventaire.push(id); equiper(run.inventaire, p, id); }
    expect(bonusEquipement(p).resistances.terre).toBe(0.05);
  });

  it("combattantDepuisPerso applique stats, PV et résistances de l'équipement", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    const base = combattantDepuisPerso(p);
    run.inventaire.push("bouftou_coiffe"); // +25 vita
    equiper(run.inventaire, p, "bouftou_coiffe");
    const equipe = combattantDepuisPerso(p);
    expect(equipe.pvMax).toBe(base.pvMax + 25);
    expect(equipe.stats.vitalite).toBe((base.stats.vitalite ?? 0) + 25);

    // panoplie Bouftou complète → résistance Terre du bonus 6 pièces
    for (const id of PANOPLIES.bouftou.pieces) {
      if (id === "bouftou_coiffe") continue; // déjà équipée plus haut
      run.inventaire.push(id);
      equiper(run.inventaire, p, id);
    }
    expect(combattantDepuisPerso(p).resistances.terre).toBe(0.15);
  });
});

describe("drops", () => {
  it("piecesEligibles exclut les pièces équipées et celles déjà en inventaire", () => {
    const run = nouvelleRun(["iop"]);
    run.inventaire.push("aventurier_coiffe");
    equiper(run.inventaire, run.persos[0], "aventurier_coiffe");
    run.inventaire.push("aventurier_cape");
    const elig = piecesEligibles(run, "aventurier");
    expect(elig).not.toContain("aventurier_coiffe"); // équipée
    expect(elig).not.toContain("aventurier_cape");   // déjà en inventaire
    expect(elig.length).toBe(4);
  });

  it("tenterButin ne crée pas de doublon", () => {
    const run = nouvelleRun(["iop"]);
    const drops = tenterButin(run, "aventurier", "combat", () => 0); // rng 0 → drop garanti
    expect(drops.length).toBe(6);
    expect(new Set(run.inventaire).size).toBe(run.inventaire.length);
    expect(tenterButin(run, "aventurier", "combat", () => 0).length).toBe(0); // plus rien
  });

  it("aucun drop si le tirage dépasse la probabilité", () => {
    const run = nouvelleRun(["iop"]);
    expect(tenterButin(run, "aventurier", "combat", () => 0.99).length).toBe(0);
  });

  it("la prospection de l'équipe augmente le taux de drop", () => {
    const faible = nouvelleRun(["iop"]);        // prospection 100 → p ≈ 0,275
    const forte = nouvelleRun(["cra", "sram"]); // prospection 140+130 → p ≈ 0,317
    const rng = () => 0.3;
    expect(tenterButin(faible, "aventurier", "combat", rng).length).toBe(0);
    expect(tenterButin(forte, "aventurier", "combat", rng).length).toBeGreaterThan(0);
  });
});

describe("équiper / déséquiper", () => {
  it("échange l'objet entre l'inventaire et le slot", () => {
    const run = nouvelleRun(["iop"]);
    run.inventaire.push("aventurier_coiffe");
    equiper(run.inventaire, run.persos[0], "aventurier_coiffe");
    expect(run.persos[0].equipement.coiffe).toBe("aventurier_coiffe");
    expect(run.inventaire).not.toContain("aventurier_coiffe");
    desequiper(run.inventaire, run.persos[0], "coiffe");
    expect(run.persos[0].equipement.coiffe).toBeUndefined();
    expect(run.inventaire).toContain("aventurier_coiffe");
  });

  it("équiper un 2e objet du même slot renvoie l'ancien à l'inventaire", () => {
    const run = nouvelleRun(["iop"]);
    run.inventaire.push("aventurier_coiffe", "bouftou_coiffe");
    equiper(run.inventaire, run.persos[0], "aventurier_coiffe");
    equiper(run.inventaire, run.persos[0], "bouftou_coiffe");
    expect(run.persos[0].equipement.coiffe).toBe("bouftou_coiffe");
    expect(run.inventaire).toContain("aventurier_coiffe");
  });
});
