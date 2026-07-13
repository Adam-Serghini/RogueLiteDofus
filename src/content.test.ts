// =============================================================================
//  content.test.ts — Garde permanente : le contenu JSON du repo doit passer
//  sa propre validation (impossible de committer du contenu invalide).
// =============================================================================
import { describe, it, expect } from "vitest";
// @ts-expect-error module JS sans types
import { validerContenu } from "../scripts/content-validate.mjs";
import sorts from "./content/sorts.json";
import classes from "./content/classes.json";
import monstres from "./content/monstres.json";
import combats from "./content/combats.json";
import zones_pools from "./content/zones_pools.json";
import items from "./content/items.json";
import butin_toiles from "./content/butin_toiles.json";

const contenu = { sorts, classes, monstres, combats, zones_pools, items, butin_toiles };

describe("contenu du repo", () => {
  it("passe les 3 passes de validation", () => {
    const erreurs: string[] = validerContenu(contenu, contenu);
    expect(erreurs).toEqual([]);
  });
});
