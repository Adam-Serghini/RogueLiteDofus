// =============================================================================
//  cale.test.ts — Cale de l'Arche d'Otomaï (zone 2 de la Tranche 2) : bestiaire,
//  archis, artillerie qui ignore la ligne, salle de Gourlo et zone.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, zonesDeTranche, localiserZone, butinToile } from "./data";
import { toileDeZone } from "./run";

/** Élément de chaque espèce → statistique dominante et résistance attendues. */
const ELEMENT_DE = {
  le_flib: "eau", sparo: "air", barbroussa: "terre",
  boomba: "terre", nakunbra: "air", canondorf: "feu",
  gourlo_le_terrible: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;

const ARCHIS = {
  sparo: "Sparoket le Lanceur",
  barbroussa: "Barebourd le Comte",
  boomba: "Boombata le Garde",
  nakunbra: "Nakuneuye le Borgne",
  canondorf: "Caboume l'Artilleur",
} as const;

describe("bestiaire de la Cale de l'Arche", () => {
  it("les 7 espèces existent et frappent/résistent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      const m = MONSTRES[id];
      expect(m, `${id} manquant`).toBeTruthy();
      expect(m.resistances?.[element], `${id} doit résister en ${element}`).toBeGreaterThan(0);
      const stats = m.stats as unknown as Record<string, number>;
      const dominante = Object.entries(stats)
        .filter(([k]) => k !== "vitalite")
        .sort((a, b) => b[1] - a[1])[0][0];
      expect(dominante, `${id} ne frappe pas dans son élément (${element})`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("5 espèces sur 7 portent un archimonstre ; Le Flib et Gourlo n'en ont pas", () => {
    for (const [id, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[id].archiNom, `${id} sans archi`).toBe(nom);
    }
    expect(MONSTRES.le_flib.archiNom).toBeUndefined();
    expect(MONSTRES.gourlo_le_terrible.archiNom).toBeUndefined();
  });

  it("les gardes de la cale sont plus robustes que l'équipage de pont", () => {
    const equipage = ["le_flib", "sparo"].map((id) => MONSTRES[id].pv);
    const gardes = ["boomba", "nakunbra", "canondorf"].map((id) => MONSTRES[id].pv);
    expect(Math.min(...gardes)).toBeGreaterThan(Math.max(...equipage));
  });
});

describe("la leçon de la zone : la rangée arrière n'est plus un abri", () => {
  /** Un sort en `ennemi_tous` peut viser n'importe qui, rangée arrière comprise. */
  const ignoreLaLigne = (sortId: string) => SORTS[sortId]?.cible === "ennemi_tous";

  it("les deux artilleurs portent un sort qui ignore la règle de ligne", () => {
    for (const id of ["sparo", "canondorf"]) {
      expect(MONSTRES[id].sorts.some(ignoreLaLigne), `${id} n'a aucun sort qui ignore la ligne`).toBe(true);
    }
  });

  it("la Bordée de Gourlo ignore la ligne ET frappe toute la rangée visée", () => {
    const s = SORTS.bordee;
    expect(s, "sort bordee manquant").toBeTruthy();
    expect(s.cible).toBe("ennemi_tous"); // pointable même sur la rangée arrière
    expect(s.zoneLigne).toBe(true); // et elle balaie toute la rangée
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBeGreaterThanOrEqual(2);
  });
});

describe("Gourlo le Terrible", () => {
  it("est un boss à 10 PA qui lâche le Dofus Pourpre, signature en tête", () => {
    const g = MONSTRES.gourlo_le_terrible;
    expect(g.boss).toBe(true);
    expect(g.pa).toBe(10); // salle à boss UNIQUE : le kit de T1 (6 + 4) est entièrement dépensé
    expect(g.dofus).toBe("dofus_pourpre");
    expect(g.sorts[0]).toBe("bordee"); // l'IA agressive joue le plus cher, à égalité l'ordre de la liste
    expect(g.sorts).toContain("morsure"); // les 4 PA restants trouvent preneur
  });
});

describe("zone Cale de l'Arche", () => {
  it("est la 2ᵉ zone de la Tranche 2 et porte la toile 14", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[1]).toBe("cale_de_l_arche");
    expect(zonesDeTranche(t2)[1].nom).toBe("Cale de l'Arche d'Otomaï");
    expect(localiserZone("cale_de_l_arche")!.tranche.id).toBe("t2");
    expect(toileDeZone("cale_de_l_arche")).toBe(14); // T1 = toiles 1-12, Clos = 13
  });

  it("a une seule salle de boss, tenue par Gourlo escorté", () => {
    const zone = ZONES.find((z) => z.id === "cale_de_l_arche")!;
    expect(zone.pools.boss.length).toBe(1);
    const ennemis = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(ennemis).toContain("gourlo_le_terrible");
    expect(ennemis.filter((m) => MONSTRES[m]?.boss).length).toBe(1); // salle à boss UNIQUE
    expect(ennemis.length).toBeGreaterThan(1); // il est escorté
  });

  it("les archis des gardes sont chassables hors élite", () => {
    const zone = ZONES.find((z) => z.id === "cale_de_l_arche")!;
    const dansNormales = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    const gardesAvecArchi = ["boomba", "nakunbra", "canondorf"].filter((id) => MONSTRES[id].archiNom);
    expect(gardesAvecArchi.some((id) => dansNormales.has(id)),
      "aucun garde n'apparaît en combat normal : leurs archis seraient enfermés dans les nœuds élite").toBe(true);
  });

  it("un artilleur est présent dès les packs normaux (la leçon de la zone)", () => {
    const zone = ZONES.find((z) => z.id === "cale_de_l_arche")!;
    const especes = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    const artilleurs = [...especes].filter((id) => MONSTRES[id]?.sorts.some((s) => SORTS[s]?.cible === "ennemi_tous"));
    expect(artilleurs.length).toBeGreaterThan(0);
  });

  it("la zone n'a pas encore de butin (les objets de la toile 14 viendront plus tard)", () => {
    expect(butinToile("cale_de_l_arche")).toBeNull();
  });
});
