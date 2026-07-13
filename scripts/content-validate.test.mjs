// scripts/content-validate.test.mjs
import { describe, it, expect } from "vitest";
import { validerContenu } from "./content-validate.mjs";

const base = () => ({
  sorts: { morsure: { id: "morsure", nom: "Morsure", type: "degats", coutPA: 3, cible: "ennemi_ligne", baseMin: 4, baseMax: 7, scaling: 0.5 } },
  classes: { iop: { id: "iop", nom: "Iop", pvBase: 60, stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0 }, pa: 6, initiative: 8, sorts: ["morsure"] } },
  monstres: { bouftou: { id: "bouftou", nom: "Bouftou", pv: 20, stats: { force: 10, intelligence: 0, agilite: 2, vitalite: 5 }, pa: 4, initiative: 7, resistances: {}, sorts: ["morsure"], ia: "agressif" } },
  combats: { c1: { nom: "Troupeau", ennemis: [{ monstre: "bouftou", position: 0 }] } },
  zones_pools: { tainela: { normales: ["c1"], elite: ["c1"], boss: "c1" } },
  items: { anneau_test: { id: "anneau_test", nom: "Anneau Test", slot: "anneau", tiers: { commun: { stats: { vitalite: 4 } }, rare: { stats: { vitalite: 6 } } } } },
  butin_toiles: { "1": { normales: ["anneau_test"], elites: [], boss: [] } },
});
const modif = (fn) => { const c = structuredClone(base()); fn(c); return c; };

describe("passe 1 — schéma", () => {
  it("accepte le contenu de référence", () => expect(validerContenu(base(), base())).toEqual([]));
  it("refuse un slot inconnu", () => {
    const err = validerContenu(modif((c) => { c.items.anneau_test.slot = "botte"; }), base());
    expect(err.some((e) => e.includes("[items: anneau_test]") && e.includes("slot"))).toBe(true);
  });
  it("refuse pv non entier positif", () => {
    expect(validerContenu(modif((c) => { c.monstres.bouftou.pv = -3; }), base())).not.toEqual([]);
  });
  it("refuse min > max sur une attaque d'arme", () => {
    const err = validerContenu(modif((c) => { c.items.anneau_test.tiers.commun.attaque = { coutPA: 3, baseMin: 9, baseMax: 5, scaling: 0.3 }; }), base());
    expect(err.some((e) => e.includes("baseMin"))).toBe(true);
  });
  it("refuse une stat qui DÉCROÎT avec la rareté", () => {
    const err = validerContenu(modif((c) => { c.items.anneau_test.tiers.rare.stats.vitalite = 2; }), base());
    expect(err.some((e) => e.includes("croissante") || e.includes("rareté"))).toBe(true);
  });
  it("refuse deux ennemis sur la même position", () => {
    const err = validerContenu(modif((c) => { c.combats.c1.ennemis = [{ monstre: "bouftou", position: 0 }, { monstre: "bouftou", position: 0 }]; }), base());
    expect(err.some((e) => e.includes("position"))).toBe(true);
  });
  it("refuse elite non-array dans zones_pools", () => {
    const err = validerContenu(modif((c) => { c.zones_pools.tainela.elite = "c1"; }), base());
    expect(err.some((e) => e.includes("[zones_pools: tainela]") && e.includes("elite") && e.includes("liste"))).toBe(true);
    // Ensure no garbage "n'existe pas" entries from spreading a string char-by-char
    expect(err.some((e) => e.includes("n'existe pas") && e.includes("« c »"))).toBe(false);
  });
  it("ne crashe pas sur elite malformé (nombre) — passe 2", () => {
    const err = validerContenu(modif((c) => { c.zones_pools.tainela.elite = 123; }), base());
    expect(Array.isArray(err)).toBe(true);
    expect(err.some((e) => e.includes("[zones_pools: tainela]") && e.includes("elite"))).toBe(true);
  });
  it("refuse un item sans palier « commun »", () => {
    const err = validerContenu(modif((c) => { c.items.anneau_test.tiers = {}; }), base());
    expect(err.some((e) => e.includes("[items: anneau_test]") && e.includes("commun"))).toBe(true);
  });
  it("refuse un sort à 0 PA", () => {
    const err = validerContenu(modif((c) => { c.sorts.morsure.coutPA = 0; }), base());
    expect(err.some((e) => e.includes("[sorts: morsure]") && e.includes("coutPA"))).toBe(true);
  });
});

describe("passe 2 — références croisées", () => {
  it("refuse un sort inexistant sur un monstre", () => {
    const err = validerContenu(modif((c) => { c.monstres.bouftou.sorts = ["morsure_geante"]; }), base());
    expect(err.some((e) => e.includes("[monstres: bouftou]") && e.includes("morsure_geante"))).toBe(true);
  });
  it("refuse un monstre inexistant dans une rencontre", () => {
    expect(validerContenu(modif((c) => { c.combats.c1.ennemis[0].monstre = "fantome"; }), base())).not.toEqual([]);
  });
  it("refuse un combat inexistant dans un pool de zone", () => {
    expect(validerContenu(modif((c) => { c.zones_pools.tainela.boss = "c99"; }), base())).not.toEqual([]);
  });
  it("refuse un item inexistant dans un butin de toile", () => {
    expect(validerContenu(modif((c) => { c.butin_toiles["1"].normales = ["item_fantome"]; }), base())).not.toEqual([]);
  });
});

describe("passe 3 — lecture seule / numérique", () => {
  it("refuse toute modification des classes", () => {
    const err = validerContenu(modif((c) => { c.classes.iop.pvBase = 99; }), base());
    expect(err.some((e) => e.includes("[classes: iop]") && e.includes("lecture seule"))).toBe(true);
  });
  it("accepte un changement NUMÉRIQUE sur un sort", () => {
    expect(validerContenu(modif((c) => { c.sorts.morsure.baseMax = 9; }), base())).toEqual([]);
  });
  it("refuse l'ajout d'un sort", () => {
    const err = validerContenu(modif((c) => { c.sorts.nouveau = { ...c.sorts.morsure, id: "nouveau" }; }), base());
    expect(err.some((e) => e.includes("sorts") && e.includes("nouveau"))).toBe(true);
  });
  it("refuse un changement non numérique sur un sort (flag de mécanique)", () => {
    const err = validerContenu(modif((c) => { c.sorts.morsure.ignoreResistances = true; }), base());
    expect(err.some((e) => e.includes("[sorts: morsure]"))).toBe(true);
  });
  it("refuse la suppression d'une zone de zones_pools", () => {
    const err = validerContenu(modif((c) => { delete c.zones_pools.tainela; }), base());
    expect(err.some((e) => e.includes("[zones_pools: tainela]") && e.includes("supprimée"))).toBe(true);
  });
  it("refuse l'ajout d'une zone à zones_pools", () => {
    const err = validerContenu(modif((c) => { c.zones_pools.nouvelle_zone = { normales: ["c1"], boss: "c1" }; }), base());
    expect(err.some((e) => e.includes("[zones_pools: nouvelle_zone]") && e.includes("ajoutée"))).toBe(true);
  });
});
