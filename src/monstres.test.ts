// =============================================================================
//  monstres.test.ts — Invariant : un monstre n'a qu'UN élément.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES } from "./data";

/** Espèces dont une 2e caractéristique élémentaire dépasse ce seuil de la dominante. */
const SEUIL = 0.6;

// Écarts PRÉEXISTANTS, tolérés NOMMÉMENT en attente d'arbitrage. Les quatre Kwakere
// partagent un bloc de caractéristiques rigoureusement identique (résistances plates
// comprises) : leur identité élémentaire est décorative, un « Kwakere de Vent » ayant
// l'agilité pour caractéristique la plus BASSE. Les corriger est de l'équilibrage.
const TOLERES = [
  "boufton_blanc", "directeur_grunob", "gardienne_champetre", "kardorim",
  "kwakere_de_flamme", "kwakere_de_glace", "kwakere_de_terre", "kwakere_de_vent",
  "kwakwa", "sergent_chafer",
];

describe("un monstre n'a qu'un élément", () => {
  it("aucune espèce hors exceptions n'a de second élément exploitable", () => {
    const fautifs: string[] = [];
    for (const [id, m] of Object.entries(MONSTRES)) {
      if (TOLERES.includes(id)) continue;
      const s = m.stats as unknown as Record<string, number>;
      const tri = [s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0].sort((a, b) => b - a);
      if (tri[0] > 0 && tri[1] / tri[0] > SEUIL) fautifs.push(`${id} (${tri[1]}/${tri[0]})`);
    }
    expect(fautifs, `espèces à deux éléments : ${fautifs.join(", ")}`).toEqual([]);
  });

  it("la liste d'exceptions ne contient que des espèces RÉELLEMENT en écart", () => {
    // Sinon la liste enfle et cesse de dire la vérité sur ce qui reste à arbitrer.
    for (const id of TOLERES) {
      expect(MONSTRES[id], `${id} toléré mais inexistant`).toBeTruthy();
      const s = MONSTRES[id].stats as unknown as Record<string, number>;
      const tri = [s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0].sort((a, b) => b - a);
      expect(tri[1] / tri[0], `${id} n'est plus en écart : le retirer de TOLERES`).toBeGreaterThan(SEUIL);
    }
  });
});
