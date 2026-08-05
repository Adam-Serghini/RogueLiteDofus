// =============================================================================
//  run.test.ts — Roster dynamique : démarrage à 2, recrutement, remplacement.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, recruter, propositionsRecrutement, classesHorsEquipe, equipePleine, enregistrerRun,
  gagnerXPPerso, classesDisponibles,
  sauverRunEnCours, chargerRunEnCours, effacerRunEnCours,
} from "./run";
import { chargerConfig } from "./config";
import type { Meta } from "./types";

describe("compteur de runs", () => {
  it("enregistrerRun compte les runs et n'ajoute une victoire que si réussie", () => {
    const meta: Meta = { dofus: [], archis: [], runs: 0, victoires: 0 };
    enregistrerRun(meta, false); // mort
    enregistrerRun(meta, true); // réussie
    enregistrerRun(meta, false); // mort
    expect(meta.runs).toBe(3);
    expect(meta.victoires).toBe(1);
  });
});

describe("philtres d'Otomai (taux d'archimonstre)", () => {
  it("taux effectif = ARCHI.chance + ARCHI.philtre par philtre bu", async () => {
    const { chanceArchi, nouvelleRun } = await import("./run");
    const { ARCHI } = await import("./data");
    const run = nouvelleRun(["iop"]);
    expect(run.philtres).toBe(0);
    expect(chanceArchi(run)).toBeCloseTo(ARCHI.chance); // base 0,8 %
    run.philtres = 1;
    expect(chanceArchi(run)).toBeCloseTo(ARCHI.chance + ARCHI.philtre); // 1,2 %
    run.philtres = 2;
    expect(chanceArchi(run)).toBeCloseTo(ARCHI.chance + 2 * ARCHI.philtre); // 1,6 %
    expect(ARCHI.philtre).toBeCloseTo(ARCHI.chance / 2); // nerf : demi-taux par philtre
  });

  it("le cumul sature à ARCHI.philtresMax : au-delà, boire n'apporte plus rien", async () => {
    // Sans plafond, un joueur qui détourne son chemin vers chaque Otomai finissait
    // à ~5,2 % par ennemi (6,5× le taux de base) et remplissait le bestiaire en
    // quelques runs. Le plafond rend les Otomai suivants inutiles, donc le détour
    // redevient un arbitrage au lieu d'être toujours rentable.
    const { chanceArchi, nouvelleRun } = await import("./run");
    const { ARCHI } = await import("./data");
    const run = nouvelleRun(["iop"]);
    const plafond = ARCHI.chance + ARCHI.philtre * ARCHI.philtresMax;
    run.philtres = ARCHI.philtresMax;
    expect(chanceArchi(run)).toBeCloseTo(plafond);
    run.philtres = ARCHI.philtresMax + 1;
    expect(chanceArchi(run)).toBeCloseTo(plafond); // un philtre de trop n'ajoute rien
    run.philtres = 50; // et le cumul ne repart jamais
    expect(chanceArchi(run)).toBeCloseTo(plafond);
    expect(plafond).toBeLessThan(0.03); // garde-fou : le plafond reste sous 3 %
  });

  it("le compteur survit à la sauvegarde ; une vieille save sans le champ charge à 0", async () => {
    const { nouvelleRun, sauverRunEnCours, chargerRunEnCours } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.philtres = 2;
    sauverRunEnCours(0, run);
    expect(chargerRunEnCours()!.run.philtres).toBe(2);
    const brut = JSON.parse(localStorage.getItem("rld_run_v0")!);
    delete brut.run.philtres; // save d'avant la mécanique
    localStorage.setItem("rld_run_v0", JSON.stringify(brut));
    expect(chargerRunEnCours()!.run.philtres).toBe(0);
  });
});

describe("bonus d'équipe (Dofus) appliqués aux combattants", () => {
  it("le bonus de vitalité du Dofawa ne RESSUSCITE pas un héros mort (bug du 1 PV)", async () => {
    const { appliquerBonusEquipeCombat, equipeCombattante, nouvelleRun } = await import("./run");
    const run = nouvelleRun(["iop", "eniripsa"]);
    const [iop, eni] = equipeCombattante(run);
    eni.pvActuels = 0; // l'Eniripsa est morte au combat précédent
    const pvIopAvant = iop.pvActuels;
    appliquerBonusEquipeCombat([iop, eni], { damageMult: 1.15, paBonus: 1, vitaBonus: 2, resAllBonus: 0.01 });
    // vivant : PV max ET courants montent, PA aussi
    expect(iop.pvMax).toBeGreaterThan(pvIopAvant);
    expect(iop.pvActuels).toBe(pvIopAvant + 2);
    expect(iop.paMax).toBeGreaterThan(6);
    // morte : ses maxima montent mais elle RESTE morte
    expect(eni.pvMax).toBeGreaterThan(0);
    expect(eni.pvActuels).toBe(0);
    expect(eni.resistances.terre).toBeCloseTo(0.01);
  });
});

describe("sauvegarde de run", () => {
  // mock localStorage (l'environnement de test n'en a pas)
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  it("round-trip : sauver puis charger restitue la run (zone, persos, PV, inventaire)", () => {
    const run = nouvelleRun(["iop", "cra"]);
    run.persos[0].pvActuels = 12;
    run.inventaire.push({ id: "chapeau_de_l_aventurier", rarete: "commun", stats: { vitalite: 4 } });
    run.ascension = 3;
    sauverRunEnCours(3, run);
    const s = chargerRunEnCours();
    expect(s).not.toBeNull();
    expect(s!.zoneIdx).toBe(3);
    expect(s!.run.persos.map((p) => p.classeId)).toEqual(["iop", "cra"]);
    expect(s!.run.persos[0].pvActuels).toBe(12);
    expect(s!.run.inventaire[0]).toEqual({ id: "chapeau_de_l_aventurier", rarete: "commun", stats: { vitalite: 4 } });
    expect(s!.run.ascension).toBe(3);
  });

  it("un elementChoisi hors paire dans une save rechargée retombe sur le 1er élément de la classe", () => {
    // Avant cette refonte, l'écran Formation proposait les 4 éléments à TOUTE classe :
    // un Iop niveau 50 sauvegardé avec elementChoisi: "eau" (hors de sa paire terre/feu)
    // était donc un état parfaitement légitime. Sans cette garde, il continue de frapper
    // avec une caractéristique à 0 pour le reste de sa run et rien ne le signale (les
    // deux ronds affichés, terre/feu, ne sont d'ailleurs jamais sélectionnés).
    const run = nouvelleRun(["iop"]);
    run.persos[0].elementChoisi = "eau";
    sauverRunEnCours(0, run);
    const s = chargerRunEnCours();
    expect(s!.run.persos[0].elementChoisi).toBe("terre");
  });

  it("vieille save sans ascension → 0", () => {
    const run = nouvelleRun(["iop", "cra"]);
    sauverRunEnCours(1, run);
    const raw = JSON.parse(store.get("rld_run_v0")!);
    delete raw.run.ascension;
    store.set("rld_run_v0", JSON.stringify(raw));
    const s = chargerRunEnCours();
    expect(s!.run.ascension).toBe(0);
  });

  it("effacer supprime la sauvegarde ; une save corrompue est ignorée", () => {
    sauverRunEnCours(0, nouvelleRun(["iop", "cra"]));
    effacerRunEnCours();
    expect(chargerRunEnCours()).toBeNull();
    store.set("rld_run_v0", "{pas du json");
    expect(chargerRunEnCours()).toBeNull();
    store.set("rld_run_v0", JSON.stringify({ version: 1, zoneIdx: 0, run: { persos: [{ classeId: "inconnue" }] } }));
    expect(chargerRunEnCours()).toBeNull(); // classe inconnue → save invalide
    store.clear();
  });
});

describe("classes désactivées", () => {
  it("le sadida n'est ni sélectionnable ni recrutable (mais sa data existe encore)", () => {
    const dispo = classesDisponibles();
    expect(dispo).not.toContain("sadida");
    expect(dispo).toContain("ouginak");
    expect(dispo.length).toBe(11);
    // le recrutement passe par classesDisponibles → jamais proposé
    const run = nouvelleRun(["iop", "cra"]);
    expect(classesHorsEquipe(run)).not.toContain("sadida");
  });
});

describe("démarrage à 2", () => {
  it("nouvelleRun(choix) crée exactement les classes choisies", () => {
    const run = nouvelleRun(["iop", "cra"]);
    expect(run.persos.map((p) => p.classeId)).toEqual(["iop", "cra"]);
    expect(run.persos.length).toBe(2);
  });

  it("attribue des cases de grille uniques", () => {
    const run = nouvelleRun(["iop", "cra"]);
    const cells = run.persos.map((p) => p.position);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe("recrutement", () => {
  it("ajoute un membre tant que l'équipe n'est pas pleine", () => {
    const run = nouvelleRun(["iop", "cra"]);
    recruter(run, "eniripsa");
    expect(run.persos.map((p) => p.classeId)).toContain("eniripsa");
    expect(run.persos.length).toBe(3);
    expect(equipePleine(run)).toBe(false);
  });

  it("la recrue arrive au niveau (moyen) de l'équipe", () => {
    const run = nouvelleRun(["iop", "cra"]);
    run.persos.forEach((p) => (p.progression.niveau = 5));
    recruter(run, "eniripsa");
    const recrue = run.persos.find((p) => p.classeId === "eniripsa")!;
    expect(recrue.progression.niveau).toBe(5); // stats à ce niveau : voir statsFinales
  });

  it("remplace un membre quand l'équipe est pleine (même case)", () => {
    const run = nouvelleRun(["iop", "cra", "eniripsa", "sadida"]);
    expect(equipePleine(run)).toBe(true);
    const posSadida = run.persos.find((p) => p.classeId === "sadida")!.position;
    recruter(run, "iop", "sadida"); // mécanique de remplacement (classe existante)
    expect(run.persos.length).toBe(4);
    expect(run.persos.map((p) => p.classeId)).not.toContain("sadida");
    // un perso occupe désormais la case du membre remplacé
    expect(run.persos.some((p) => p.position === posSadida)).toBe(true);
  });
});

describe("propositions de recrutement", () => {
  it("ne propose que des classes hors équipe", () => {
    const run = nouvelleRun(["iop", "cra"]);
    const hors = classesHorsEquipe(run);
    expect(hors).not.toContain("iop");
    expect(hors).not.toContain("cra");
    const propos = propositionsRecrutement(run, () => 0);
    expect(propos.length).toBe(2);
    propos.forEach((id) => expect(hors).toContain(id));
    expect(new Set(propos).size).toBe(propos.length); // sans doublon
  });
});

describe("modificateurs d'élite", () => {
  it("booste toute la meute selon le modificateur tiré", async () => {
    const { fabriquerEnnemis, appliquerModificateurElite } = await import("./run");
    const avant = fabriquerEnnemis("tai_elite");
    const apres = fabriquerEnnemis("tai_elite");
    const m = appliquerModificateurElite(apres, () => 0); // index 0 → Enragés (+20 % stats off.)
    expect(m.id).toBe("enrage");
    apres.forEach((e, i) => {
      expect(e.stats.force).toBe(Math.round(avant[i].stats.force * 1.2));
      expect(e.stats.vitalite).toBe(avant[i].stats.vitalite); // la vitalité ne bouge pas
      expect(e.pvMax).toBe(avant[i].pvMax);
    });
    const cuirasses = fabriquerEnnemis("tai_elite");
    const m2 = appliquerModificateurElite(cuirasses, () => 0.4); // index 1 → Cuirassés
    expect(m2.id).toBe("cuirasse");
    cuirasses.forEach((e, i) => {
      expect(e.pvMax).toBe(Math.round(avant[i].pvMax * 1.2));
      expect(e.resistances.terre ?? 0).toBeCloseTo((avant[i].resistances.terre ?? 0) + 0.05);
    });
    // le modificateur du nœud (id explicite) prime sur le tirage
    const veloces = fabriquerEnnemis("tai_elite");
    expect(appliquerModificateurElite(veloces, () => 0, "veloce").id).toBe("veloce");
    veloces.forEach((e, i) => expect(e.paMax).toBe(avant[i].paMax + 1));
  });
});

describe("succès", () => {
  it("verifierSucces débloque une seule fois et persiste dans meta.succes", async () => {
    const { verifierSucces } = await import("./run");
    const meta: Meta = { dofus: [], archis: [], runs: 1, victoires: 0, succes: [] };
    const nouveaux = verifierSucces(meta);
    expect(nouveaux.map((s) => s.id)).toContain("bapteme_du_feu"); // runs >= 1
    expect(meta.succes).toContain("bapteme_du_feu");
    expect(verifierSucces(meta).map((s) => s.id)).not.toContain("bapteme_du_feu"); // pas deux fois
  });

  it("Tour du Monde ne tombe qu'à la victoire ; Collectionneur à 10 archis", async () => {
    const { verifierSucces } = await import("./run");
    const meta: Meta = { dofus: [], archis: [], runs: 1, victoires: 0, succes: [] };
    expect(verifierSucces(meta, undefined, false).map((s) => s.id)).not.toContain("tour_du_monde");
    expect(verifierSucces(meta, undefined, true).map((s) => s.id)).toContain("tour_du_monde");
    meta.archis = Array.from({ length: 10 }, (_, i) => `espece_${i}`);
    expect(verifierSucces(meta).map((s) => s.id)).toContain("collectionneur");
  });
});

describe("export / import de sauvegarde", () => {
  it("round-trip : exporter puis importer restitue meta, réglages et run", async () => {
    const { exporterSauvegarde, importerSauvegarde } = await import("./run");
    localStorage.setItem("rld_meta_v0", JSON.stringify({ dofus: ["dofawa"], archis: ["tofu"], runs: 5, victoires: 2, succes: ["veteran"] }));
    localStorage.setItem("rld_settings_v0", JSON.stringify({ autoFinTour: false }));
    sauverRunEnCours(2, nouvelleRun(["iop", "cra"]));
    const fichier = exporterSauvegarde();

    // « nouveau PC » : stockage vide
    localStorage.removeItem("rld_meta_v0");
    localStorage.removeItem("rld_settings_v0");
    effacerRunEnCours();
    expect(importerSauvegarde(fichier)).toBe(true);
    expect(JSON.parse(localStorage.getItem("rld_meta_v0")!)).toMatchObject({ dofus: ["dofawa"], runs: 5 });
    expect(JSON.parse(localStorage.getItem("rld_settings_v0")!)).toMatchObject({ autoFinTour: false });
    expect(chargerRunEnCours()?.zoneIdx).toBe(2);
  });

  it("rejette les fichiers invalides sans toucher aux données", async () => {
    const { importerSauvegarde } = await import("./run");
    localStorage.setItem("rld_meta_v0", JSON.stringify({ dofus: [], archis: [], runs: 1, victoires: 0 }));
    expect(importerSauvegarde("{pas du json")).toBe(false);
    expect(importerSauvegarde(JSON.stringify({ jeu: "autre-jeu", donnees: {} }))).toBe(false);
    expect(importerSauvegarde(JSON.stringify({ jeu: "roguefus-lite", donnees: {} }))).toBe(false); // pas de Meta
    expect(JSON.parse(localStorage.getItem("rld_meta_v0")!).runs).toBe(1); // intact
  });
});

describe("kamas & Hôtel de vente", () => {
  it("gainKamas scale avec le type de nœud et la toile", async () => {
    const { gainKamas } = await import("./run");
    const mid = () => 0.5; // variance neutre
    expect(gainKamas("combat", 1, mid)).toBe(15);
    expect(gainKamas("combat_dur", 1, mid)).toBe(30);
    expect(gainKamas("donjon", 1, mid)).toBe(60);
    expect(gainKamas("combat", 2, mid)).toBe(20); // ×1.3 en toile 2
    expect(gainKamas("taverne", 1, mid)).toBe(0);
  });

  it("stock HDV : toile courante en épique+ uniquement, toile suivante dès le rare", async () => {
    const { genererStockHDV, toileDeItem } = await import("./run");
    // rng séquencé : on force des articles des deux origines
    for (const seedFn of [(() => { let i = 0; const seq = [0.9, 0.5, 0.1, 0.5, 0.1, 0.5, 0.9, 0.5, 0.1, 0.5]; return () => seq[i++ % seq.length]; })()]) {
      const stock = genererStockHDV("incarnam", seedFn); // toile 1 courante, toile 2 suivante
      expect(stock.length).toBeGreaterThan(0);
      for (const a of stock) {
        const t = toileDeItem(a.inst.id);
        expect([1, 2]).toContain(t);
        if (t === 1) expect(["epique", "legendaire"]).toContain(a.inst.rarete); // local : épique+
        else expect(["rare", "epique", "legendaire"]).toContain(a.inst.rarete); // avant-première : rare+
      }
    }
    // astrub = toile 2 : local épique+ OU avant-première toile 3 dès le rare
    const stock2 = genererStockHDV("astrub", () => 0.3);
    for (const a of stock2) {
      const t = toileDeItem(a.inst.id);
      expect([2, 3]).toContain(t);
      if (t === 2) expect(["epique", "legendaire"]).toContain(a.inst.rarete);
      else expect(["rare", "epique", "legendaire"]).toContain(a.inst.rarete);
    }
  });

  it("acheter débite et met l'objet en inventaire ; vendre crédite 50 % du prix", async () => {
    const { genererStockHDV, acheterArticle, vendreItem, prixVente, prixAchat } = await import("./run");
    const run = nouvelleRun(["iop"]);
    const stock = genererStockHDV("incarnam", () => 0.1);
    const art = stock[0];
    expect(acheterArticle(run, stock, 0)).toBe(false); // 0 kama → refusé
    run.kamas = art.prix + 10;
    expect(acheterArticle(run, stock, 0)).toBe(true);
    expect(run.kamas).toBe(10);
    expect(run.inventaire[0]).toBe(art.inst);
    expect(stock.length).toBe(4); // retiré du rayon
    const attendu = prixVente(run.inventaire[0]);
    expect(attendu).toBe(Math.max(1, Math.round(prixAchat(run.inventaire[0]) * 0.5)));
    expect(vendreItem(run, 0)).toBe(true);
    expect(run.kamas).toBe(10 + attendu);
    expect(run.inventaire.length).toBe(0);
  });
});

describe("rangée préférée", () => {
  it("le départ ET le recrutement respectent la rangée préférée de la classe", async () => {
    localStorage.setItem("rld_settings_v0", JSON.stringify({ formation: { iop: "avant", cra: "arriere", eniripsa: "arriere" } }));
    const run = nouvelleRun(["iop", "cra"]);
    expect(run.persos.find((p) => p.classeId === "iop")!.position).toBeLessThan(4);
    expect(run.persos.find((p) => p.classeId === "cra")!.position).toBeGreaterThanOrEqual(4);
    recruter(run, "eniripsa"); // la recrue va dans SA rangée, pas « devant par défaut »
    expect(run.persos.find((p) => p.classeId === "eniripsa")!.position).toBeGreaterThanOrEqual(4);
    localStorage.removeItem("rld_settings_v0");
  });

  it("une vieille sauvegarde sans les nouvelles classes retombe sur leur rangée par défaut", () => {
    // Settings d'avant l'ajout du Roublard/Xélor/Éliotrope/Forgelance : pas de clé pour eux.
    localStorage.setItem("rld_settings_v0", JSON.stringify({ formation: { iop: "arriere", cra: "avant" } }));
    const config = chargerConfig();
    expect(config.formation.roublard).toBe("arriere"); // défaut, pas « avant » implicite
    expect(config.formation.xelor).toBe("arriere");
    expect(config.formation.eliotrope).toBe("arriere");
    expect(config.formation.forgelance).toBe("avant");
    expect(config.formation.iop).toBe("arriere"); // les choix stockés gagnent
    expect(config.formation.cra).toBe("avant");
    localStorage.removeItem("rld_settings_v0");
  });
});

describe("préréglage d'élément hors paire (rétro-compat)", () => {
  // Le préréglage "vitalite" n'existe plus (les points d'allocation manuelle ont
  // disparu avec la refonte Éléments & Archétypes). `nouvelleRun`/`chargerConfig` s'en
  // gardent : un préréglage hors de la paire déclarée de la classe (dont un vieux
  // "vitalite") retombe sur le PREMIER élément de la classe, jamais sur « aucun élément ».
  it("le préréglage vitalite (obsolète) retombe sur le premier élément de la classe", () => {
    localStorage.setItem("rld_settings_v0", JSON.stringify({ elements: { iop: "vitalite" } }));
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    expect(p.elementChoisi).toBe("terre"); // 1er élément de la classe (iop : terre + feu)
    gagnerXPPerso(p, 50, "t1"); // niveau 2 : stats à ce niveau, voir statsFinales
    expect(p.progression.niveau).toBe(2);
    localStorage.removeItem("rld_settings_v0");
  });

  it("un préréglage VALIDE mais HORS PAIRE (vieille save rld_settings_v0) retombe aussi sur le 1er élément", () => {
    // Cas nommé dans le commentaire ci-dessus, jusqu'ici non testé : "eau" est un
    // élément valide (pas une valeur fantaisiste comme "vitalite"), mais l'iop ne le
    // déclare pas (terre + feu) — c'est là que le `.includes` fait tout le travail.
    localStorage.setItem("rld_settings_v0", JSON.stringify({ elements: { iop: "eau" } }));
    const run = nouvelleRun(["iop"]);
    expect(run.persos[0].elementChoisi).toBe("terre"); // 1er élément de la classe, pas "eau"
    localStorage.removeItem("rld_settings_v0");
  });
});

describe("vendre tout (HDV)", () => {
  it("vide l'inventaire et crédite la somme des prix de revente", async () => {
    const { vendreTout, prixVente, rollItem } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.inventaire.push(rollItem("chapeau_de_l_aventurier", () => 0), rollItem("anneau_de_l_aventurier", () => 0.99));
    const attendu = run.inventaire.reduce((t, i) => t + prixVente(i), 0);
    expect(vendreTout(run)).toBe(attendu);
    expect(run.kamas).toBe(attendu);
    expect(run.inventaire.length).toBe(0);
    expect(vendreTout(run)).toBe(0); // inventaire vide → rien
  });
});

describe("recrutement — équipement du partant", () => {
  it("le remplacé rend son stuff à l'inventaire de la run", async () => {
    const { nouvelleRun, recruter, equiper, rollItem } = await import("./run");
    const run = nouvelleRun(["iop", "cra"]);
    run.inventaire.push(rollItem("coiffe_bouftou", () => 0));
    equiper(run.inventaire, run.persos[0], 0); // le Iop porte la coiffe
    expect(run.inventaire.length).toBe(0);
    recruter(run, "sram", "iop"); // le Sram remplace le Iop
    expect(run.persos.some((p) => p.classeId === "iop")).toBe(false);
    expect(run.inventaire.length).toBe(1); // la coiffe est revenue
    expect(run.inventaire[0].id).toBe("coiffe_bouftou");
  });
});

describe("forgemagie", () => {
  it("coutForge = prix HDV du palier CIBLE × coef ; téméraire = moitié", async () => {
    const { rollItemRarete, coutForge, prixAchat, rareteSuivante } = await import("./run");
    const commun = rollItemRarete("chapeau_de_l_aventurier", () => 0)!; // toile 1, commun
    expect(rareteSuivante(commun)).toBe("rare");
    expect(coutForge(commun)).toBe(Math.round(prixAchat({ ...commun, rarete: "rare" }) * 0.6));
    expect(coutForge(commun, true)).toBe(Math.round(prixAchat({ ...commun, rarete: "rare" }) * 0.3));
  });

  it("forge garantie : débite, monte le palier et remplace les stats en place", async () => {
    const { nouvelleRun, rollItemRarete, forgerInstance, coutForge, equiper } = await import("./run");
    const run = nouvelleRun(["iop"]);
    run.inventaire.push(rollItemRarete("chapeau_de_l_aventurier", () => 0)!);
    equiper(run.inventaire, run.persos[0], 0); // forge d'un objet ÉQUIPÉ (référence partagée)
    const inst = run.persos[0].equipement.coiffe!;
    const cout = coutForge(inst)!;
    run.kamas = cout;
    expect(forgerInstance(run, inst, false, () => 0.99)).toBe("forge");
    expect(run.kamas).toBe(0);
    expect(inst.rarete).toBe("rare");
    expect(inst.stats).toEqual({ vitalite: 6 }); // stats du palier rare (fixes)
    // kamas insuffisants → refus sans débit
    expect(forgerInstance(run, inst, false, () => 0.99)).toBeNull();
    expect(run.kamas).toBe(0);
  });

  it("téméraire : l'échec brûle les kamas mais laisse l'objet intact ; le légendaire est infogeable", async () => {
    const { nouvelleRun, rollItemRarete, forgerInstance, coutForge, rareteSuivante } = await import("./run");
    const run = nouvelleRun(["iop"]);
    const inst = rollItemRarete("chapeau_de_l_aventurier", () => 0)!;
    run.inventaire.push(inst);
    const cout = coutForge(inst, true)!;
    run.kamas = cout * 2;
    expect(forgerInstance(run, inst, true, () => 0.1)).toBe("echec"); // 0.1 < 30 %
    expect(run.kamas).toBe(cout); // kamas perdus...
    expect(inst.rarete).toBe("commun"); // ...objet intact
    expect(forgerInstance(run, inst, true, () => 0.9)).toBe("forge"); // 0.9 > 30 %
    expect(inst.rarete).toBe("rare");
    // un légendaire n'a plus de palier suivant
    const leg = rollItemRarete("chapeau_de_l_aventurier", () => 0.99)!;
    expect(rareteSuivante(leg)).toBeNull();
    run.kamas = 99999;
    expect(forgerInstance(run, leg, false, () => 0.5)).toBeNull();
  });
});
