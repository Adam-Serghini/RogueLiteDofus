// =============================================================================
//  equipement.test.ts — Objets à rareté (toiles), drops, équiper/déséquiper.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, combattantDepuisPerso, bonusEquipement,
  equiper, desequiper, tenterButin, rollItem, tirerRarete,
} from "./run";
import { butinToile, ITEMS } from "./data";
import type { Meta } from "./types";

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

  it("chaque panoplie de la t1 compte exactement 4 pièces, une par slot", () => {
    const parPano: Record<string, string[]> = {};
    for (const it of Object.values(ITEMS)) {
      if (it.panoplie) (parPano[it.panoplie] ??= []).push(it.id);
    }
    expect(Object.keys(parPano).length).toBe(12);
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
    ennemi.stats = { ...ennemi.stats, force: 999 }; // gros coup → la récup arrondit à ≥ 1
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
