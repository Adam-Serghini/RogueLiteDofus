// =============================================================================
//  equipement.test.ts — Objets à rareté (toiles), drops, équiper/déséquiper.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, combattantDepuisPerso, bonusEquipement,
  equiper, desequiper, tenterButin, rollItem, tirerRarete, meilleurItemToile,
} from "./run";
import { butinToile, itemsDeToile, ITEMS } from "./data";
import type { Combatant, Item, Meta, Spell } from "./types";

const MIN = () => 0;     // jet au minimum de la fourchette (déterministe)

describe("bonus d'équipement", () => {
  it("somme les stats fixes des objets équipés (paliers commun)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push(rollItem("chapeau_de_l_aventurier", MIN)); // commun : vita 4
    equiper(run.inventaire, p, 0);
    run.inventaire.push(rollItem("cape_de_l_aventurier", MIN)); // commun : vita 6, prospection 2
    equiper(run.inventaire, p, 0);
    const b = bonusEquipement(p);
    expect(b.stats.vitalite).toBe(10);
    expect(b.stats.prospection).toBe(2);
    expect(b.resistances.terre).toBeCloseTo(0.02); // 0.01 + 0.01
    expect(b.resistances.feu).toBeCloseTo(0.02);
  });

  it("combattantDepuisPerso applique stats, PV et résistances de l'équipement", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    const base = combattantDepuisPerso(p);
    run.inventaire.push(rollItem("cape_de_l_aventurier", MIN)); // commun : +6 vita
    equiper(run.inventaire, p, 0);
    const equipe = combattantDepuisPerso(p);
    expect(equipe.pvMax).toBe(base.pvMax + 6);
    expect(equipe.stats.vitalite).toBe((base.stats.vitalite ?? 0) + 6);
    expect(equipe.resistances.terre ?? 0).toBeCloseTo(0.01);
  });
});

describe("bonus de panoplie (4 pièces de la même panoplie = +1 PA)", () => {
  const SET_AVENTURIER = ["chapeau_de_l_aventurier", "cape_de_l_aventurier", "anneau_de_l_aventurier", "epee_de_l_aventurier"];

  it("les 4 pièces d'une panoplie donnent +1 PA (visible sur le combatant)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    const paBase = combattantDepuisPerso(p).paMax;
    for (const id of SET_AVENTURIER) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).paBonus).toBe(1);
    expect(combattantDepuisPerso(p).paMax).toBe(paBase + 1);
  });

  it("3 pièces + une pièce hors panoplie → aucun bonus (une pièce boss casse le set)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    for (const id of SET_AVENTURIER.slice(0, 3)) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).paBonus).toBe(0); // 3/4 : rien
    run.inventaire.push(rollItem("epee_de_l_aventurier", MIN)); // 4/4 : bonus
    equiper(run.inventaire, p, 0);
    expect(bonusEquipement(p).paBonus).toBe(1);
    run.inventaire.push(rollItem("boufcoiffe_royale", MIN)); // coiffe BOSS (t3) remplace la coiffe du set
    equiper(run.inventaire, p, 0);
    expect(bonusEquipement(p).paBonus).toBe(0); // le set est cassé
  });

  it("la rareté est indifférente (mélange commun/légendaire)", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    const MAXR = () => 0.999; // palier légendaire
    run.inventaire.push(rollItem(SET_AVENTURIER[0], MAXR));
    equiper(run.inventaire, p, 0);
    for (const id of SET_AVENTURIER.slice(1)) { run.inventaire.push(rollItem(id, MIN)); equiper(run.inventaire, p, 0); }
    expect(bonusEquipement(p).paBonus).toBe(1);
  });

  it("chaque panoplie compte exactement 4 pièces, une par slot", () => {
    const parPano: Record<string, string[]> = {};
    for (const it of Object.values(ITEMS)) {
      if (it.panoplie) (parPano[it.panoplie] ??= []).push(it.id);
    }
    expect(Object.keys(parPano).length).toBe(24); // une par zone : 12 en t1 + 12 en t2 (toiles 13-24)
    for (const [nom, ids] of Object.entries(parPano)) {
      expect(ids.length, nom).toBe(4);
      const slots = new Set(ids.map((id) => ITEMS[id].slot));
      expect(slots.size, nom).toBe(4); // coiffe + cape + anneau + arme
    }
  });
});

describe("drops", () => {
  it("tenterButin renvoie des exemplaires et autorise les doublons", () => {
    const run = nouvelleRun(["iop"]);
    const drops = tenterButin(run, "tainela", "combat", MIN); // rng 0 → tout tombe (pool de la toile 3)
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

  it("le bonus de prospection HORS ÉQUIPE (relique Dofus Kaliptus) augmente aussi le taux de drop d'objets", () => {
    // même run, mêmes pools, même graine — seul le bonus de relique change : la
    // preuve doit porter sur le RÉSULTAT (plus d'objets), pas sur la simple
    // transmission du paramètre.
    const run = nouvelleRun(["iop"]); // prospection d'équipe 100 → p = 0,20×1,10 = 0,22 sans bonus
    const rng = () => 0.23; // entre 0,22 (bonus 0) et 0,24 (bonus 100)
    expect(tenterButin(run, "tainela", "combat", rng, "combat", 0).length).toBe(0);
    expect(tenterButin(run, "tainela", "combat", rng, "combat", 100).length).toBeGreaterThan(0);
  });

  it("zone inconnue (sans pool de toile) : aucun drop", () => {
    const run = nouvelleRun(["iop"]);
    expect(tenterButin(run, "zone_inconnue", "combat", MIN)).toEqual([]);
  });
});

describe("équiper / déséquiper", () => {
  it("échange l'exemplaire entre l'inventaire et le slot", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push(rollItem("chapeau_de_l_aventurier", MIN));
    equiper(run.inventaire, p, 0);
    expect(p.equipement.coiffe?.id).toBe("chapeau_de_l_aventurier");
    expect(run.inventaire.length).toBe(0);
    desequiper(run.inventaire, p, "coiffe");
    expect(p.equipement.coiffe).toBeUndefined();
    expect(run.inventaire.some((i) => i.id === "chapeau_de_l_aventurier")).toBe(true);
  });

  it("équiper un 2e objet du même slot renvoie l'ancien à l'inventaire", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    run.inventaire.push(rollItem("chapeau_de_l_aventurier", MIN), rollItem("coiffe_bouftou", MIN));
    equiper(run.inventaire, p, 0); // chapeau_de_l_aventurier
    equiper(run.inventaire, p, 0); // coiffe_bouftou (désormais en tête)
    expect(p.equipement.coiffe?.id).toBe("coiffe_bouftou");
    expect(run.inventaire.some((i) => i.id === "chapeau_de_l_aventurier")).toBe(true);
  });
});

describe("attaque d'arme (case 1)", () => {
  it("l'arme équipée fournit une attaque au combattant ; aucune sinon", () => {
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    expect(combattantDepuisPerso(p).armeSort).toBeUndefined(); // sans arme : case 1 vide
    run.inventaire.push(rollItem("epee_de_l_aventurier", MIN)); // commun
    equiper(run.inventaire, p, 0);
    const c = combattantDepuisPerso(p);
    expect(c.armeSort?.coutPA).toBe(3); // coût propre à l'arme
    expect(c.armeSort?.baseMax).toBe(11); // dégâts du palier commun
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

  it("Incarnam droppe depuis son pool de toile ; les 12 zones de la t1 sont toutes à toile", () => {
    expect(butinToile("incarnam")!.normales).toContain("chapeau_de_l_aventurier");
    for (const z of ["larves", "grotte_hesque", "kwakwa"]) expect(butinToile(z)).not.toBeNull();
    expect(butinToile("zone_inconnue")).toBeNull(); // zone inconnue : aucun pool, aucun drop
    const run = nouvelleRun(["iop"]);
    const drops = tenterButin(run, "incarnam", "combat", () => 0); // tout tombe, pool[0], commun
    expect(drops.length).toBe(4);
    drops.forEach((d) => expect(d.rarete).toBe("commun"));
  });
});

describe("toile 3 — stat adaptative & sources de drop", () => {
  it("la ligne adaptative nourrit LES DEUX éléments de la classe", async () => {
    const { bonusEquipement, persoAuNiveau, rollItemRarete } = await import("./run");
    const { CLASSES } = await import("./data");
    const p = persoAuNiveau("eniripsa", 50, 0); // feu + eau
    p.equipement.coiffe = rollItemRarete("coiffe_bouftou", () => 0)!; // commun : adapt 3
    const b = bonusEquipement(p);
    // avant, l'adaptatif ne visait qu'une seule caractéristique : le joueur pouvait
    // nourrir celle qu'il n'employait presque jamais
    expect(b.stats.intelligence).toBe(3); // feu
    expect(b.stats.chance).toBe(3); // eau
    expect(b.stats.force ?? 0).toBe(0); // terre : hors de la paire
    expect(b.stats.agilite ?? 0).toBe(0); // air : hors de la paire
    expect(CLASSES.eniripsa.elements).toEqual(["feu", "eau"]);
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

describe("Armurerie (collection persistante)", () => {
  it("retient par objet la meilleure rareté jamais obtenue", async () => {
    const { enregistrerCollection } = await import("./run");
    const meta: Meta = { dofus: [], archis: [], runs: 0, victoires: 0, succes: [], collection: {} };
    enregistrerCollection(meta, [{ id: "coiffe_du_tofu", rarete: "rare", stats: {} }]);
    expect(meta.collection?.coiffe_du_tofu).toBe("rare");
    enregistrerCollection(meta, [{ id: "coiffe_du_tofu", rarete: "legendaire", stats: {} }]);
    expect(meta.collection?.coiffe_du_tofu).toBe("legendaire");
    enregistrerCollection(meta, [{ id: "coiffe_du_tofu", rarete: "commun", stats: {} }]); // régression ignorée
    expect(meta.collection?.coiffe_du_tofu).toBe("legendaire");
  });
});

describe("découplage taux / pool (combat dur au taux donjon)", () => {
  it("un combat dur payé au taux donjon pioche ses exclusifs ÉLITE, pas boss", async () => {
    const { nouvelleRun, tenterButin } = await import("./run");
    const pools = butinToile("tainela")!;
    // type=combat_dur (pool), tauxType=donjon (taux) : le 1er tirage doit venir des élites
    const drops = tenterButin(nouvelleRun(["iop"]), "tainela", "combat_dur", () => 0, "donjon");
    expect(pools.elites).toContain(drops[0].id);
    expect(pools.boss).not.toContain(drops[0].id);
  });
});

describe("toiles 5-6 : mécaniques spéciales & source mixte", () => {
  it("Dora (elite_boss) figure dans les DEUX pools exclusifs de l'Akadémie", () => {
    const pools = butinToile("akademie")!;
    expect(pools.elites).toContain("dora");
    expect(pools.boss).toContain("dora");
    expect(pools.boss).toContain("abracape"); // boss pur
    expect(butinToile("kankreblath")!.elites).toContain("couteau_a_stek");
  });

  it("Sabre Shodanwa : riposte 33 % quand frappé, seulement en ligne avant", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const { lancerSort } = await import("./combat");
    const { SORTS } = await import("./data");
    const arme = () => rollItemRarete("sabre_shodanwa", () => 0)!;
    const monte = (position: number) => {
      const run = nouvelleRun(["iop"]);
      run.persos[0].position = position;
      run.persos[0].equipement.arme = arme();
      const c = combattantDepuisPerso(run.persos[0]);
      c.stats = { ...c.stats, agilite: 0 }; // pas d'esquive parasite
      c.pvActuels = 500; c.pvMax = 500;
      return c;
    };
    const ctx = { rng: () => 0.1, log: () => {}, playerDamageBonus: 1 };
    // ligne avant : 0.1 < 0.33 → riposte
    const avant = monte(0);
    let ennemi = (await import("./run")).fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    const pvAvantRiposte = ennemi.pvActuels;
    lancerSort(ennemi, SORTS.morsure, avant.ref, [avant, ennemi], ctx);
    expect(ennemi.pvActuels).toBeLessThan(pvAvantRiposte); // l'attaquant a pris la riposte
    // ligne arrière : la riposte du Sabre ne s'applique pas
    const arriere = monte(5);
    ennemi = (await import("./run")).fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, agilite: 0 };
    const pvSansRiposte = ennemi.pvActuels;
    lancerSort(ennemi, SORTS.morsure, arriere.ref, [arriere, ennemi], ctx);
    expect(ennemi.pvActuels).toBe(pvSansRiposte);
  });

  it("Baguette Rikiki : +10 % d'esquive, seulement en ligne arrière", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete, fabriquerEnnemis } = await import("./run");
    const { degatsCible } = await import("./combat");
    const { SORTS } = await import("./data");
    const monte = (position: number) => {
      const run = nouvelleRun(["iop"]);
      run.persos[0].position = position;
      run.persos[0].equipement.arme = rollItemRarete("baguette_rikiki", () => 0)!;
      const c = combattantDepuisPerso(run.persos[0]);
      c.stats = { ...c.stats, agilite: 0 }; // seule l'esquive d'équipement joue
      return c;
    };
    const ennemi = fabriquerEnnemis("combat_1")[0];
    const ctx = { rng: () => 0.05, log: () => {}, playerDamageBonus: 1 };
    // arrière : 0.05 < 0.10 → esquive ; avant : aucune esquive (0.05 > 0)
    expect(degatsCible(ennemi, SORTS.morsure, monte(5), { useMax: true, mult: 1, ctx }).esquive).toBe(true);
    expect(degatsCible(ennemi, SORTS.morsure, monte(0), { useMax: true, mult: 1, ctx }).esquive).toBe(false);
  });

  it("Goyave : le porteur récupère une fraction des dégâts subis", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete, fabriquerEnnemis } = await import("./run");
    const { lancerSort, degatsCible } = await import("./combat");
    const { SORTS } = await import("./data");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.coiffe = rollItemRarete("goyave", () => 0.999)!; // légendaire
    const iop = combattantDepuisPerso(run.persos[0]);
    expect(iop.soinDegatsRecus).toBeCloseTo(0.02);
    iop.stats = { ...iop.stats, agilite: 0 };
    iop.pvActuels = 500; iop.pvMax = 500;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    // Gros coup pour que la récup de 2 % arrondisse à ≥ 1, mais qui laisse le Iop VIVANT :
    // depuis que la caractéristique de frappe multiplie la fourchette, 999 de force ferait
    // ×30 sur la Morsure (18 max) et tuerait la cible, ce qui plafonnerait ses PV à 0 et
    // testerait la mort plutôt que la récupération.
    ennemi.stats = { ...ennemi.stats, force: 200 };
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    // même rng constant → mêmes jets : on pré-calcule les dégâts attendus sur un clone
    const dmg = degatsCible(ennemi, SORTS.morsure, { ...iop, effets: [] }, { useMax: true, mult: 1, ctx }).dmg;
    lancerSort(ennemi, SORTS.morsure, iop.ref, [iop, ennemi], ctx);
    expect(iop.pvActuels).toBe(500 - dmg + Math.round(dmg * 0.02));
  });
});

describe("toiles 7-9 : mécaniques spéciales", () => {
  it("Dagues Eurfolles : « Changer de ligne » bascule avant ↔ arrière pour 1 PA", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const { lancerSort, ciblesValides } = await import("./combat");
    const { SORTS } = await import("./data");
    const run = nouvelleRun(["iop"]);
    run.persos[0].position = 0;
    run.persos[0].equipement.arme = rollItemRarete("dagues_eurfolles", () => 0)!;
    const iop = combattantDepuisPerso(run.persos[0]);
    expect(iop.sorts).toContain("changer_ligne"); // conféré par l'objet
    const ctx = { rng: () => 0.5, log: () => {}, playerDamageBonus: 1 };
    expect(ciblesValides(iop, SORTS.changer_ligne, [iop])).toEqual([iop]);
    lancerSort(iop, SORTS.changer_ligne, iop.ref, [iop], ctx);
    expect(iop.position).toBe(4); // même colonne, rangée arrière
    lancerSort(iop, SORTS.changer_ligne, iop.ref, [iop], ctx);
    expect(iop.position).toBe(0); // retour devant
    // sans les dagues : le sort n'est pas dans la barre
    const sans = combattantDepuisPerso(nouvelleRun(["iop"]).persos[0]);
    expect(sans.sorts).not.toContain("changer_ligne");
  });

  it("Dagues Aj'Deh'La : l'attaque ne compte que 50 % des résistances", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete, fabriquerEnnemis } = await import("./run");
    const { degatsCible } = await import("./combat");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.arme = rollItemRarete("dagues_aj_deh_la", () => 0)!;
    const iop = combattantDepuisPerso(run.persos[0]);
    expect(iop.armeSort?.perceResistances).toBeCloseTo(0.5);
    const cible = fabriquerEnnemis("combat_1")[0];
    cible.stats = { ...cible.stats, agilite: 0 };
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    const sansRes = degatsCible(iop, iop.armeSort!, { ...cible, resistances: {} }, { useMax: true, mult: 1, ctx }).dmg;
    cible.resistances = { ...cible.resistances, [Object.keys(cible.resistances)[0] ?? "terre"]: 0 };
    const resistances = { terre: 0.4, feu: 0.4, eau: 0.4, air: 0.4 };
    const avecRes = degatsCible(iop, iop.armeSort!, { ...cible, resistances }, { useMax: true, mult: 1, ctx }).dmg;
    // 40 % de résistance percée à 50 % → seulement −20 % subis
    expect(Math.abs(avecRes - sansRes * 0.8)).toBeLessThanOrEqual(1);
  });

  it("Masse Aj Taye : frappe la cible ET l'ennemi derrière elle", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete, fabriquerEnnemis } = await import("./run");
    const { lancerSort } = await import("./combat");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.arme = rollItemRarete("masse_aj_taye", () => 0)!;
    const iop = combattantDepuisPerso(run.persos[0]);
    // salle avec ligne arrière : gob_elite a un Gobaliste derrière (position 4)
    const pack = fabriquerEnnemis("gob_elite").map((e) => { e.pvActuels = 500; e.pvMax = 500; e.stats = { ...e.stats, agilite: 0 }; return e; });
    const devant = pack.find((e) => e.position === 0)!;
    const derriere = pack.find((e) => e.position >= 4)!;
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    lancerSort(iop, iop.armeSort!, devant.ref, [iop, ...pack], ctx);
    expect(devant.pvActuels).toBeLessThan(500);
    expect(derriere.pvActuels).toBeLessThan(500); // touché par la traversée
  });

  it("Caskoffre : la prospection d'équipe monte avec les PV manquants du porteur", async () => {
    const { nouvelleRun, rollItemRarete, prospectionEquipe, pvMaxPerso } = await import("./run");
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    p.equipement.coiffe = rollItemRarete("caskoffre", () => 0)!;
    p.pvActuels = pvMaxPerso(p); // pleins PV (la coiffe ajoute de la vita)
    const pleinePV = prospectionEquipe(run);
    p.pvActuels = pvMaxPerso(p) - 50; // 50 PV manquants → +10 prospection (0,2/PV)
    expect(prospectionEquipe(run)).toBe(pleinePV + 10);
  });

  it("Ann'or : les kamas de combat sont multipliés par 1,2", async () => {
    const { nouvelleRun, rollItemRarete, multKamasEquipe } = await import("./run");
    const run = nouvelleRun(["iop", "cra"]);
    expect(multKamasEquipe(run)).toBe(1);
    run.persos[0].equipement.anneau = rollItemRarete("ann_or", () => 0)!;
    expect(multKamasEquipe(run)).toBeCloseTo(1.2);
  });
});

describe("toiles 10-12 : mécaniques spéciales", () => {
  it("Bonnet Spairance : bouclier de départ = 15 % des PV max", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.coiffe = rollItemRarete("bonnet_spairance", () => 0)!;
    const c = combattantDepuisPerso(run.persos[0]);
    expect(c.bouclier).toBe(Math.round(c.pvMax * 0.15));
    expect(combattantDepuisPerso(nouvelleRun(["iop"]).persos[0]).bouclier).toBe(0);
  });

  it("Scalpel de Bworknroll : l'attaque empoisonne ; Arc des Rivages : retrait de PA", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.arme = rollItemRarete("scalpel_de_bworknroll", () => 0)!;
    expect(combattantDepuisPerso(run.persos[0]).armeSort?.poison).toEqual({ degats: 5, duree: 2 });
    run.persos[0].equipement.arme = rollItemRarete("arc_des_rivages", () => 0)!;
    expect(combattantDepuisPerso(run.persos[0]).armeSort?.retraitPA).toBe(1);
  });

  it("Masse du Corailleur : l'attaque soigne l'allié le plus blessé", async () => {
    const { nouvelleRun, equipeCombattante, rollItemRarete, fabriquerEnnemis } = await import("./run");
    const { lancerSort } = await import("./combat");
    const run = nouvelleRun(["iop", "cra"]);
    run.persos[0].equipement.arme = rollItemRarete("masse_du_corailleur", () => 0)!;
    const [iop, cra] = equipeCombattante(run);
    cra.pvActuels = Math.round(cra.pvMax * 0.3); // le plus blessé
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.pvActuels = 500; ennemi.pvMax = 500; ennemi.stats = { ...ennemi.stats, agilite: 0 };
    const pvAvant = cra.pvActuels;
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    lancerSort(iop, iop.armeSort!, ennemi.ref, [iop, cra, ennemi], ctx);
    const dmg = 500 - ennemi.pvActuels;
    expect(dmg).toBeGreaterThan(0);
    expect(cra.pvActuels).toBe(pvAvant + Math.round(dmg * 0.2)); // multSoin(iop) = 1
  });

  it("Kwakwaffe : l'élément de frappe n'est plus limité au top 2 (élément libre)", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.coiffe = rollItemRarete("kwakwaffe", () => 0)!;
    const c = combattantDepuisPerso(run.persos[0]);
    expect(c.elementLibre).toBe(true);
  });

  it("Kwakwanneau : renaît UNE seule fois par combat à 30 % des PV (coups et poison)", async () => {
    const { nouvelleRun, combattantDepuisPerso, rollItemRarete, fabriquerEnnemis } = await import("./run");
    const { lancerSort } = await import("./combat");
    const { SORTS } = await import("./data");
    const run = nouvelleRun(["iop"]);
    run.persos[0].equipement.anneau = rollItemRarete("kwakwanneau", () => 0)!;
    const iop = combattantDepuisPerso(run.persos[0]);
    iop.stats = { ...iop.stats, agilite: 0 };
    iop.pvMax = 100; iop.pvActuels = 5; iop.bouclier = 0;
    const ennemi = fabriquerEnnemis("combat_1")[0];
    ennemi.stats = { ...ennemi.stats, force: 999, agilite: 0 }; // coup fatal garanti
    const ctx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };
    lancerSort(ennemi, SORTS.morsure, iop.ref, [iop, ennemi], ctx);
    expect(iop.pvActuels).toBe(30); // renaît à 30 % de 100
    iop.pvActuels = 5;
    lancerSort(ennemi, SORTS.morsure, iop.ref, [iop, ennemi], ctx);
    expect(iop.pvActuels).toBe(0); // une seule renaissance par combat
  });
});

describe("meilleurItemToile", () => {
  // Le pool est SYNTHÉTIQUE et les objets sont volontairement contrastés : le test
  // affirme un RÉSULTAT attendu (« la coiffe de force gagne »), il ne recalcule
  // jamais la formule de score. Un test qui recopie la formule qu'il vérifie
  // change à l'identique quand elle change, et n'échoue donc jamais.
  const POOL = ["chapeau_de_l_aventurier", "cape_de_l_aventurier"];

  it("choisit un objet du slot demandé", () => {
    const choisi = meilleurItemToile(POOL, "coiffe", "force");
    expect(choisi).not.toBeNull();
    expect(ITEMS[choisi!].slot).toBe("coiffe");
  });

  it("préfère l'objet qui porte le plus la stat visée", () => {
    // deux coiffes réelles de la même toile (Tainéla, toile 3) : la coiffe du
    // trophée de boss (boufcoiffe_royale) est nettement plus chargée en
    // adaptatif que la coiffe normale du pack (coiffe_bouftou) — c'est le choix
    // qu'un joueur ferait. `butinToile(...).normales` seul n'a qu'une coiffe par
    // toile (une seule panoplie par zone) : impossible d'y trouver un pool de
    // plusieurs coiffes réelles, d'où `itemsDeToile` qui inclut aussi le boss.
    const pool = itemsDeToile(butinToile("tainela")).filter((id) => ITEMS[id].slot === "coiffe" && ITEMS[id].tiers?.commun);
    expect(pool.length, "l'assertion suivante n'a de sens qu'avec plusieurs coiffes").toBeGreaterThan(1);
    const choisi = meilleurItemToile(pool, "coiffe", "force")!;
    const statDe = (id: string) => (ITEMS[id].tiers!.commun!.stats.force ?? 0) + (ITEMS[id].tiers!.commun!.adaptatif ?? 0);
    for (const id of pool)
      if (id !== choisi) expect(statDe(choisi), `${choisi} vs ${id}`).toBeGreaterThanOrEqual(statDe(id));
  });

  it("rend null quand le pool n'a aucun objet du slot demandé", () => {
    expect(meilleurItemToile([], "arme", "force")).toBeNull();
    expect(meilleurItemToile(["chapeau_de_l_aventurier"], "arme", "force")).toBeNull();
  });
});

describe("toiles 13-24 : nouvelles mécaniques d'objet (objets SYNTHÉTIQUES)", () => {
  // Aucun objet de contenu ne porte encore ces champs (les objets de la T2 arrivent) :
  // les tests enregistrent des objets synthétiques dans ITEMS le temps d'un `it`, puis
  // les retirent — sans quoi le test « chaque panoplie compte exactement 4 pièces »
  // (plus haut dans CE fichier, qui itère TOUT ITEMS) compterait la panoplie synthétique.
  const enregistrer = (items: Item[]): (() => void) => {
    for (const it of items) ITEMS[it.id] = it;
    return () => { for (const it of items) delete ITEMS[it.id]; };
  };

  const SYN_KAISER: Item = {
    id: "syn_marteau_kaiser", nom: "Marteau Kaiser (syn)", slot: "arme", assome: 0.05,
    tiers: { commun: { stats: {}, attaque: { coutPA: 3, baseMin: 10, baseMax: 10 } } },
  };
  const SYN_BAGUETTE: Item = {
    id: "syn_baguette_limbes", nom: "Baguette des Limbes (syn)", slot: "arme",
    recupPASort: { chance: 0.1, pa: 1 }, tiers: { commun: { stats: {} } },
  };
  const SYN_CAPE: Item = {
    id: "syn_cape_limbes", nom: "Cape des Limbes (syn)", slot: "cape",
    esquiveBonus: 0.05, tiers: { commun: { stats: {} } },
  };
  const PANO = "Limbes (syn)";
  const SYN_PANO: Item[] = [
    { id: "syn_pano_coiffe", nom: "Coiffe (syn)", slot: "coiffe", panoplie: PANO, esquiveParPiece: 0.025, tiers: { commun: { stats: {} } } },
    { id: "syn_pano_cape", nom: "Cape (syn)", slot: "cape", panoplie: PANO, tiers: { commun: { stats: {} } } },
    { id: "syn_pano_anneau", nom: "Anneau (syn)", slot: "anneau", panoplie: PANO, tiers: { commun: { stats: {} } } },
    { id: "syn_pano_arme", nom: "Arme (syn)", slot: "arme", panoplie: PANO, tiers: { commun: { stats: {} } } },
  ];
  const CTX = (rng: () => number) => ({ rng, log: () => {}, playerDamageBonus: 1 });

  // --- assome (Marteau Kaiser) -----------------------------------------------
  it("assome : le coup d'arme non esquivé peut assommer la cible — jamais un coup qui la tue", async () => {
    const retirer = enregistrer([SYN_KAISER]);
    try {
      const { nouvelleRun, combattantDepuisPerso, rollItemRarete, fabriquerEnnemis } = await import("./run");
      const { lancerSort } = await import("./combat");
      const run = nouvelleRun(["iop"]);
      run.persos[0].equipement.arme = rollItemRarete("syn_marteau_kaiser", () => 0)!;
      const iop = combattantDepuisPerso(run.persos[0]);
      expect(iop.armeSort?.assome).toBeCloseTo(0.05); // replié depuis l'objet
      const monteEnnemi = () => {
        const e = fabriquerEnnemis("combat_1")[0];
        e.pvActuels = 500; e.pvMax = 500;
        e.stats = { ...e.stats, agilite: 0 }; // pas d'esquive parasite
        return e;
      };
      const aAssome = (c: Combatant) => c.effets.some((e) => e.stat === "assome");
      // tirage raté (0.99 > 0.05) : pas d'assome
      let ennemi = monteEnnemi();
      lancerSort(iop, iop.armeSort!, ennemi.ref, [iop, ennemi], CTX(() => 0.99) as never);
      expect(aAssome(ennemi)).toBe(false);
      // tirage réussi (0.01 < 0.05) : la cible touchée et vivante est assommée
      ennemi = monteEnnemi();
      lancerSort(iop, iop.armeSort!, ennemi.ref, [iop, ennemi], CTX(() => 0.01) as never);
      expect(aAssome(ennemi)).toBe(true);
      // un coup qui TUE n'assomme pas (le rider exige une cible vivante)
      ennemi = monteEnnemi();
      ennemi.pvActuels = 1;
      lancerSort(iop, iop.armeSort!, ennemi.ref, [iop, ennemi], CTX(() => 0.01) as never);
      expect(ennemi.pvActuels).toBe(0);
      expect(aAssome(ennemi)).toBe(false);
    } finally { retirer(); }
  });

  it("assommé : passe son tour dans runCombat, TOUTES les entrées consommées pour UN seul tour sauté", async () => {
    const { nouvelleRun, combattantDepuisPerso, fabriquerEnnemis } = await import("./run");
    const { runCombat } = await import("./combat");
    const run = nouvelleRun(["iop"]);
    const iop = combattantDepuisPerso(run.persos[0]);
    iop.initiative = 999; // le joueur ouvre, déroulé déterministe
    const ennemi = fabriquerEnnemis("combat_1")[0];
    // DEUX entrées (deux coups d'arme encaissés entre ses tours) : un SEUL tour sauté
    ennemi.effets.push(
      { stat: "assome", valeur: 1, toursRestants: 1 },
      { stat: "assome", valeur: 1, toursRestants: 1 },
    );
    const toursEnnemi: number[] = [];
    const logs: string[] = [];
    let round = 0;
    const gagne = await runCombat([iop, ennemi], {
      rng: () => 0.99,
      log: (m: string) => logs.push(m),
      controllers: {
        joueur: () => {
          round += 1;
          if (round >= 3) ennemi.pvActuels = 0; // met fin au combat
          return null;
        },
        ennemi: () => { toursEnnemi.push(round); return null; },
      },
    });
    expect(gagne).toBe(true);
    // round 1 : assommé (contrôleur jamais consulté) ; round 2 : il rejoue normalement
    expect(toursEnnemi).toEqual([2]);
    expect(logs.some((m) => m.includes("est assommé et passe son tour"))).toBe(true);
    // consommation explicite : plus AUCUNE entrée assome après le tour sauté
    expect(ennemi.effets.some((e) => e.stat === "assome")).toBe(false);
  });

  // --- recupPASort (Baguette des Limbes) ---------------------------------------
  it("recupPASort : le champ de l'objet se replie dans le combattant (premier porteur)", async () => {
    const retirer = enregistrer([SYN_BAGUETTE]);
    try {
      const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
      const run = nouvelleRun(["iop"]);
      run.persos[0].equipement.arme = rollItemRarete("syn_baguette_limbes", () => 0)!;
      expect(combattantDepuisPerso(run.persos[0]).recupPASort).toEqual({ chance: 0.1, pa: 1 });
      expect(combattantDepuisPerso(nouvelleRun(["iop"]).persos[0]).recupPASort).toBeUndefined();
    } finally { retirer(); }
  });

  it("recupPASort : PA crédités IMMÉDIATEMENT après un sort payé (rng < chance), rien sinon, jamais sur un sort gratuit", async () => {
    const { nouvelleRun, combattantDepuisPerso, fabriquerEnnemis } = await import("./run");
    const { runCombat } = await import("./combat");
    const COUP: Spell = { id: "syn_coup", nom: "Coup (syn)", type: "degats", cible: "ennemi_ligne", coutPA: 3, baseMin: 1, baseMax: 1 };
    const GRATUIT: Spell = { ...COUP, id: "syn_coup_gratuit", coutPA: 0, maxParTour: 1 };
    const jouer = async (rngVal: number, sort: Spell) => {
      const run = nouvelleRun(["iop"]);
      const iop = combattantDepuisPerso(run.persos[0]);
      iop.recupPASort = { chance: 0.1, pa: 1 };
      iop.initiative = 999;
      iop.paMax = 6; iop.paActuels = 6;
      const ennemi = fabriquerEnnemis("combat_1")[0];
      ennemi.pvActuels = 100000; ennemi.pvMax = 100000; // survit au coup mesuré
      ennemi.stats = { ...ennemi.stats, agilite: 0 };
      const observes: number[] = [];
      let n = 0;
      await runCombat([iop, ennemi], {
        rng: () => rngVal,
        controllers: {
          joueur: (acteur) => {
            n += 1;
            if (n === 1) return { sort, cibleRef: ennemi.ref };
            observes.push(acteur.paActuels); // PA restants DANS le même tour, après le lancer
            ennemi.pvActuels = 0; // met fin au combat
            return null;
          },
          ennemi: () => null,
        },
      });
      return observes[0];
    };
    expect(await jouer(0.05, COUP)).toBe(6 - 3 + 1); // 0.05 < 0.1 → +1 PA, utilisable dans le tour
    expect(await jouer(0.5, COUP)).toBe(6 - 3); // tirage raté : rien
    expect(await jouer(0.05, GRATUIT)).toBe(6); // coût 0 : la récup ne rembourse qu'une dépense
  });

  // --- esquiveBonus / esquiveParPiece -----------------------------------------
  it("esquiveBonus : esquive PLATE quelle que soit la ligne, lue par chanceEsquive (source unique)", async () => {
    const retirer = enregistrer([SYN_CAPE]);
    try {
      const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
      const { chanceEsquive } = await import("./combat");
      const monte = (position: number) => {
        const run = nouvelleRun(["iop"]);
        run.persos[0].position = position;
        run.persos[0].equipement.cape = rollItemRarete("syn_cape_limbes", () => 0)!;
        const c = combattantDepuisPerso(run.persos[0]);
        c.stats = { ...c.stats, agilite: 0 }; // seule l'esquive d'équipement joue
        return c;
      };
      expect(chanceEsquive(monte(0))).toBeCloseTo(0.05); // ligne avant
      expect(chanceEsquive(monte(5))).toBeCloseTo(0.05); // ligne arrière : identique (inconditionnel)
      // équipement du porteur : jamais partagé par la Brume, comme esquiveArriere
      expect(chanceEsquive(monte(0), { sansBonusPosition: true })).toBe(0);
    } finally { retirer(); }
  });

  it("esquiveBonus : se cumule avec esquiveArriere et reste sous le plafond de 50 %", async () => {
    const retirer = enregistrer([SYN_CAPE]);
    try {
      const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
      const { chanceEsquive } = await import("./combat");
      const monte = (position: number) => {
        const run = nouvelleRun(["iop"]);
        run.persos[0].position = position;
        run.persos[0].equipement.cape = rollItemRarete("syn_cape_limbes", () => 0)!; // +0.05 plat
        run.persos[0].equipement.arme = rollItemRarete("baguette_rikiki", () => 0)!; // +0.10 arrière
        const c = combattantDepuisPerso(run.persos[0]);
        c.stats = { ...c.stats, agilite: 0 };
        return c;
      };
      expect(chanceEsquive(monte(5))).toBeCloseTo(0.15); // arrière : 0.05 + 0.10
      expect(chanceEsquive(monte(0))).toBeCloseTo(0.05); // avant : le plat seul
      const plafonne = monte(0);
      plafonne.esquiveBonus = 0.6; // au-delà du plafond partagé
      expect(chanceEsquive(plafonne)).toBe(0.5);
    } finally { retirer(); }
  });

  it("esquiveParPiece : +valeur × pièces de SA panoplie équipées, et le +1 PA des 4 pièces est CONSERVÉ", async () => {
    const retirer = enregistrer(SYN_PANO);
    try {
      const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
      const { chanceEsquive } = await import("./combat");
      const monte = (ids: string[]) => {
        const run = nouvelleRun(["iop"]);
        for (const id of ids) run.persos[0].equipement[ITEMS[id].slot] = rollItemRarete(id, () => 0)!;
        const c = combattantDepuisPerso(run.persos[0]);
        c.stats = { ...c.stats, agilite: 0 };
        return c;
      };
      const paNu = combattantDepuisPerso(nouvelleRun(["iop"]).persos[0]).paMax;
      // 2 pièces (dont la déclarante) → 0.025 × 2
      expect(monte(["syn_pano_coiffe", "syn_pano_cape"]).esquiveBonus).toBeCloseTo(0.05);
      // 4 pièces → 0.025 × 4, ET le +1 PA standard de panoplie complète s'ajoute
      const complet = monte(SYN_PANO.map((i) => i.id));
      expect(complet.esquiveBonus).toBeCloseTo(0.1);
      expect(chanceEsquive(complet)).toBeCloseTo(0.1); // même plomberie finale qu'esquiveBonus
      expect(complet.paMax).toBe(paNu + 1);
      // aucune pièce ÉQUIPÉE ne déclare le champ → aucun bonus (3 pièces comptent pour rien)
      expect(monte(["syn_pano_cape", "syn_pano_anneau", "syn_pano_arme"]).esquiveBonus).toBeUndefined();
    } finally { retirer(); }
  });

  it("esquiveParPiece et esquiveBonus se CUMULENT dans le même champ du combattant", async () => {
    const retirer = enregistrer([...SYN_PANO, SYN_CAPE]);
    try {
      const { nouvelleRun, combattantDepuisPerso, rollItemRarete } = await import("./run");
      const run = nouvelleRun(["iop"]);
      run.persos[0].equipement.coiffe = rollItemRarete("syn_pano_coiffe", () => 0)!; // déclarante
      run.persos[0].equipement.anneau = rollItemRarete("syn_pano_anneau", () => 0)!; // 2 pièces → 0.05
      run.persos[0].equipement.cape = rollItemRarete("syn_cape_limbes", () => 0)!; // hors panoplie : +0.05 plat
      expect(combattantDepuisPerso(run.persos[0]).esquiveBonus).toBeCloseTo(0.1);
    } finally { retirer(); }
  });
});
