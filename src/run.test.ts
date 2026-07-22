// =============================================================================
//  run.test.ts — Roster dynamique : démarrage à 2, recrutement, remplacement.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, recruter, propositionsRecrutement, classesHorsEquipe, equipePleine, enregistrerRun,
  appliquerElement, gagnerXPPerso, classesDisponibles,
  sauverRunEnCours, chargerRunEnCours, effacerRunEnCours,
} from "./run";
import { chargerConfig } from "./config";
import type { Meta } from "./types";

describe("allocation par élément", () => {
  it("gagnerXPPerso investit auto les points de niveau dans la stat de l'élément choisi", () => {
    const p = nouvelleRun(["iop"]).persos[0];
    appliquerElement(p, "feu"); // feu → intelligence
    gagnerXPPerso(p, 50); // assez pour passer niveau 2 (+5 pts)
    expect(p.progression.niveau).toBe(2);
    expect(p.progression.pointsInvestis.intelligence).toBe(3); // auto-investis
    expect(p.progression.pointsDispo).toBe(0); // rien à dépenser à la main
  });

  it("mode Libre (élément null) laisse les points à dépenser manuellement", () => {
    const p = nouvelleRun(["iop"]).persos[0];
    appliquerElement(p, null);
    gagnerXPPerso(p, 50);
    expect(p.elementChoisi).toBeUndefined();
    expect(p.progression.pointsDispo).toBe(3); // manuel : à dépenser soi-même
  });
});

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
    expect(dispo.length).toBe(10);
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
    expect(recrue.progression.niveau).toBe(5);
    expect(recrue.progression.pointsDispo).toBe((5 - 1) * 3); // points cumulés
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
    // Settings d'avant l'ajout du Roublard/Xélor : pas de clé pour eux.
    localStorage.setItem("rld_settings_v0", JSON.stringify({ formation: { iop: "arriere", cra: "avant" } }));
    const config = chargerConfig();
    expect(config.formation.roublard).toBe("arriere"); // défaut, pas « avant » implicite
    expect(config.formation.xelor).toBe("arriere");
    expect(config.formation.iop).toBe("arriere"); // les choix stockés gagnent
    expect(config.formation.cra).toBe("avant");
    localStorage.removeItem("rld_settings_v0");
  });
});

describe("allocation Vitalité", () => {
  it("le préréglage vitalite investit en PV et laisse la frappe libre", () => {
    localStorage.setItem("rld_settings_v0", JSON.stringify({ elements: { iop: "vitalite" } }));
    const run = nouvelleRun(["iop"]);
    const p = run.persos[0];
    expect(p.statAuto).toBe("vitalite");
    expect(p.elementChoisi).toBeUndefined(); // frappe = plus haute carac
    gagnerXPPerso(p, 50); // niveau 2 → 3 points auto en vitalité
    expect(p.progression.pointsInvestis.vitalite).toBe(3);
    expect(p.progression.pointsDispo).toBe(0);
    localStorage.removeItem("rld_settings_v0");
  });

  it("appliquerElement bascule proprement élément ↔ vitalité ↔ libre", () => {
    const p = nouvelleRun(["iop"]).persos[0];
    appliquerElement(p, "feu");
    expect(p.elementChoisi).toBe("feu");
    expect(p.statAuto).toBe("intelligence");
    appliquerElement(p, "vitalite");
    expect(p.elementChoisi).toBeUndefined();
    expect(p.statAuto).toBe("vitalite");
    appliquerElement(p, null);
    expect(p.statAuto).toBeUndefined();
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
