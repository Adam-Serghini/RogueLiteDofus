// =============================================================================
//  run.test.ts — Roster dynamique : démarrage à 2, recrutement, remplacement.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  nouvelleRun, recruter, propositionsRecrutement, classesHorsEquipe, equipePleine, enregistrerRun,
  appliquerElement, gagnerXPPerso, classesDisponibles,
  sauverRunEnCours, chargerRunEnCours, effacerRunEnCours,
} from "./run";
import type { Meta } from "./types";

describe("allocation par élément", () => {
  it("gagnerXPPerso investit auto les points de niveau dans la stat de l'élément choisi", () => {
    const p = nouvelleRun(["iop"]).persos[0];
    appliquerElement(p, "feu"); // feu → intelligence
    gagnerXPPerso(p, 50); // assez pour passer niveau 2 (+5 pts)
    expect(p.progression.niveau).toBe(2);
    expect(p.progression.pointsInvestis.intelligence).toBe(5); // auto-investis
    expect(p.progression.pointsDispo).toBe(0); // rien à dépenser à la main
  });

  it("mode Libre (élément null) laisse les points à dépenser manuellement", () => {
    const p = nouvelleRun(["iop"]).persos[0];
    appliquerElement(p, null);
    gagnerXPPerso(p, 50);
    expect(p.elementChoisi).toBeUndefined();
    expect(p.progression.pointsDispo).toBe(5); // manuel : à dépenser soi-même
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
    run.inventaire.push({ id: "bouftou_coiffe", stats: { force: 10 } });
    sauverRunEnCours(3, run);
    const s = chargerRunEnCours();
    expect(s).not.toBeNull();
    expect(s!.zoneIdx).toBe(3);
    expect(s!.run.persos.map((p) => p.classeId)).toEqual(["iop", "cra"]);
    expect(s!.run.persos[0].pvActuels).toBe(12);
    expect(s!.run.inventaire[0]).toEqual({ id: "bouftou_coiffe", stats: { force: 10 } });
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
    expect(dispo.length).toBe(6);
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
    expect(recrue.progression.pointsDispo).toBe((5 - 1) * 5); // points cumulés
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
    const m = appliquerModificateurElite(apres, () => 0); // index 0 → Enragés (+35 % stats off.)
    expect(m.id).toBe("enrage");
    apres.forEach((e, i) => {
      expect(e.stats.force).toBe(Math.round(avant[i].stats.force * 1.35));
      expect(e.stats.vitalite).toBe(avant[i].stats.vitalite); // la vitalité ne bouge pas
      expect(e.pvMax).toBe(avant[i].pvMax);
    });
    const cuirasses = fabriquerEnnemis("tai_elite");
    const m2 = appliquerModificateurElite(cuirasses, () => 0.4); // index 1 → Cuirassés
    expect(m2.id).toBe("cuirasse");
    cuirasses.forEach((e, i) => {
      expect(e.pvMax).toBe(Math.round(avant[i].pvMax * 1.3));
      expect(e.resistances.terre ?? 0).toBeCloseTo((avant[i].resistances.terre ?? 0) + 0.1);
    });
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
