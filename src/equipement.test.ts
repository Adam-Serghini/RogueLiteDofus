// =============================================================================
//  equipement.test.ts — Objets (jets), panoplies, drops, équiper/déséquiper.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, combattantDepuisPerso, bonusEquipement,
  equiper, desequiper, tenterButin, rollItem, tirerRarete,
} from "./run";
import { PANOPLIES, butinToile } from "./data";

const MIN = () => 0;     // jet au minimum de la fourchette (déterministe)
const MAX = () => 0.999; // jet au maximum

describe("jets d'items (rollItem)", () => {
  it("tire chaque stat dans sa fourchette", () => {
    expect(rollItem("bouftou_coiffe", MIN).stats).toEqual({ force: 16, intelligence: 16 }); // [16,20] → min
    expect(rollItem("bouftou_coiffe", MAX).stats).toEqual({ force: 20, intelligence: 20 }); // → max
    expect(rollItem("paysan_anneau", MIN).stats).toEqual({ chance: 11 }); // [11,15] → min
  });
});

describe("bonus d'équipement & panoplie", () => {
  it("somme les stats rollées des objets équipés", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    // 2 pièces de panoplies DIFFÉRENTES → pas de bonus de set, on teste la somme brute
    run.inventaire.push(rollItem("bouftou_coiffe", MIN)); // force16 int16
    equiper(run.inventaire, p, 0);
    run.inventaire.push(rollItem("forgeron_anneau", MIN)); // vita21
    equiper(run.inventaire, p, 0);
    const b = bonusEquipement(p);
    expect(b.stats.force).toBe(16);
    expect(b.stats.intelligence).toBe(16);
    expect(b.stats.vitalite).toBe(21);
  });

  it("déclenche les bonus de panoplie aux seuils (2 et 4 pièces)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    for (const id of PANOPLIES.aventurier.pieces.slice(0, 2)) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).stats.vitalite).toBe(10);       // bonus seuil 2
    expect(bonusEquipement(p).resistances.terre ?? 0).toBe(0); // pas encore le bonus 4
    for (const id of PANOPLIES.aventurier.pieces.slice(2)) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).resistances.terre).toBe(0.05);   // bonus seuil 4
  });

  it("combattantDepuisPerso applique stats, PV et résistances de l'équipement", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    const base = combattantDepuisPerso(p);
    run.inventaire.push(rollItem("bouftou_cape", MIN)); // Cape Bouffante +26 vita (min)
    equiper(run.inventaire, p, 0);
    const equipe = combattantDepuisPerso(p);
    expect(equipe.pvMax).toBe(base.pvMax + 26);
    expect(equipe.stats.vitalite).toBe((base.stats.vitalite ?? 0) + 26);

    // panoplie Bouftou complète → résistance Terre du bonus 6 pièces
    for (const id of PANOPLIES.bouftou.pieces) {
      if (id === "bouftou_cape") continue; // déjà équipée plus haut
      run.inventaire.push(rollItem(id, MIN));
      equiper(run.inventaire, p, 0);
    }
    expect(combattantDepuisPerso(p).resistances.terre).toBe(0.12);
  });
});

describe("drops", () => {
  it("tenterButin renvoie des exemplaires et autorise les doublons", () => {
    const run = nouvelleRun(["iop"]);
    const drops = tenterButin(run, "tainela", "combat", MIN); // rng 0 → tout tombe (zone legacy)
    expect(drops.length).toBe(4);
    expect(drops[0]).toHaveProperty("stats"); // exemplaire rollé
    const drops2 = tenterButin(run, "tainela", "combat", MIN); // re-drop possible
    expect(drops2.length).toBe(4);
    expect(run.inventaire.length).toBe(8); // doublons cumulés
  });

  it("aucun drop si le tirage dépasse la probabilité", () => {
    const run = nouvelleRun(["iop"]);
    expect(tenterButin(run, "tainela", "combat", () => 0.99).length).toBe(0);
  });

  it("la prospection de l'équipe augmente le taux de drop", () => {
    const faible = nouvelleRun(["iop"]);        // prospection 100 → p = 0,20×1,10 = 0,22
    const forte = nouvelleRun(["cra", "sram"]); // prospection 200 → p = 0,20×1,20 = 0,24
    const rng = () => 0.23; // entre les deux seuils
    expect(tenterButin(faible, "tainela", "combat", rng).length).toBe(0);
    expect(tenterButin(forte, "tainela", "combat", rng).length).toBeGreaterThan(0);
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

describe("rareté (objets à toiles)", () => {
  it("tirerRarete suit les poids 60/25/12/3", () => {
    expect(tirerRarete(() => 0)).toBe("commun");
    expect(tirerRarete(() => 0.59)).toBe("commun");
    expect(tirerRarete(() => 0.61)).toBe("rare");
    expect(tirerRarete(() => 0.86)).toBe("epique");
    expect(tirerRarete(() => 0.98)).toBe("legendaire");
  });

  it("rollItem fige les stats du palier tiré (fixes, pas de roll)", () => {
    const commun = rollItem("chapeau_de_l_aventurier", () => 0);
    expect(commun.rarete).toBe("commun");
    expect(commun.stats).toEqual({ vitalite: 4 });
    expect(commun.adaptatif).toBe(2);
    expect(commun.resistances).toEqual({ terre: 0.01, feu: 0.01 });
    const leg = rollItem("chapeau_de_l_aventurier", () => 0.99);
    expect(leg.rarete).toBe("legendaire");
    expect(leg.stats).toEqual({ vitalite: 12, crit: 2 });
    expect(leg.adaptatif).toBe(6);
  });

  it("Incarnam droppe depuis son pool de toile (rareté), l'Akadémie reste legacy", () => {
    expect(butinToile("incarnam")!.normales).toContain("chapeau_de_l_aventurier");
    expect(butinToile("akademie")).toBeNull(); // toile 5 : pas encore saisie
    const run = nouvelleRun(["iop"]);
    const drops = tenterButin(run, "incarnam", "combat", () => 0); // tout tombe, pool[0], commun
    expect(drops.length).toBe(4);
    drops.forEach((d) => expect(d.rarete).toBe("commun"));
  });
});

describe("toile 3 — stat adaptative & sources de drop", () => {
  it("la stat adaptative rejoint la carac de la voie du perso", async () => {
    const { nouvelleRun, appliquerElement, bonusEquipement, rollItemRarete } = await import("./run");
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    appliquerElement(p, "feu"); // voie Feu → intelligence
    p.equipement.coiffe = rollItemRarete("coiffe_bouftou", () => 0)!; // commun : adapt 3
    expect(p.equipement.coiffe.adaptatif).toBe(3);
    expect(bonusEquipement(p).stats.intelligence).toBe(3);
    appliquerElement(p, "terre"); // même objet, voie Terre → force
    expect(bonusEquipement(p).stats.force).toBe(3);
  });

  it("le donjon droppe les objets « boss », les combats durs les « élite »", async () => {
    const { nouvelleRun, tenterButin } = await import("./run");
    const { ITEMS } = await import("./data");
    // rng 0 → tout tombe ; 1er tirage = pool exclusif du nœud
    const donjon = tenterButin(nouvelleRun(["iop"]), "tainela", "donjon", () => 0);
    expect(ITEMS[donjon[0].id].source).toBe("boss");
    const dur = tenterButin(nouvelleRun(["iop"]), "tainela", "combat_dur", () => 0);
    expect(ITEMS[dur[0].id].source).toBe("elite");
    const normal = tenterButin(nouvelleRun(["iop"]), "tainela", "combat", () => 0);
    normal.forEach((d) => expect(ITEMS[d.id].source).toBeUndefined());
  });

  it("l'Arc atteint la ligne arrière, l'Ergot Mina est vampirique", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.arme = rollItemRarete("arc_en_corne_de_bouftou", () => 0)!;
    expect(combattantDepuisPerso(run.persos[0]).armeSort?.cible).toBe("ennemi_tous");
    run.persos[0].equipement.arme = rollItemRarete("ergot_mina", () => 0)!;
    expect(combattantDepuisPerso(run.persos[0]).armeSort?.vampirismeRatio).toBe(0.5);
  });
});

describe("toile 4 — mécaniques spéciales", () => {
  it("Chance d'Ecaflip : le porteur parie ses PA à chaque tour (33 % +1 / 66 % −1)", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const { appliquerChanceEcaflip } = await import("./combat");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.anneau = rollItemRarete("chance_d_ecaflip", () => 0)!; // épique
    const c = combattantDepuisPerso(run.persos[0]);
    expect(c.paGamble).toEqual({ pPlus: 1 / 3, plus: 1, moins: 1 });
    const ctx = { rng: () => 0.1, log: () => {}, playerDamageBonus: 1 }; // 0.1 < 1/3 → gain
    c.paActuels = 6;
    appliquerChanceEcaflip(c, ctx as never);
    expect(c.paActuels).toBe(7);
    (ctx as { rng: () => number }).rng = () => 0.9; // perte
    appliquerChanceEcaflip(c, ctx as never);
    expect(c.paActuels).toBe(6);
  });

  it("Cape Edepee : équipable uniquement en ligne avant", async () => {
    const { nouvelleRun, equiper, peutEquiper, rollItemRarete } = await import("./run");
    const run = nouvelleRun(["iop", "cra"]); // iop devant (0), cra derrière (4)
    const cape = rollItemRarete("cape_edepee", () => 0)!;
    run.inventaire.push(cape);
    const cra = run.persos.find((p) => p.classeId === "cra")!;
    expect(peutEquiper(cra, "cape_edepee")).toBe(false);
    equiper(run.inventaire, cra, 0); // refusé
    expect(cra.equipement.cape).toBeUndefined();
    expect(run.inventaire.length).toBe(1);
    const iop = run.persos.find((p) => p.classeId === "iop")!;
    expect(peutEquiper(iop, "cape_edepee")).toBe(true);
    equiper(run.inventaire, iop, 0);
    expect(iop.equipement.cape?.id).toBe("cape_edepee");
  });

  it("les exclusifs boss de la toile 4 n'existent qu'en épique/légendaire", async () => {
    const { rollItemRarete } = await import("./run");
    const inst = rollItemRarete("chance_d_ecaflip", () => 0)!;
    expect(inst.rarete).toBe("epique"); // renormalisé sur les paliers existants
    expect(rollItemRarete("cape_edepee", () => 0.99)!.rarete).toBe("legendaire");
  });
});
