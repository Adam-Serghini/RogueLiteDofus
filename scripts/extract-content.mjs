// =============================================================================
//  extract-content.mjs — Extrait le contenu de data.ts/items_gen.ts vers
//  src/content/*.json (sérialisation canonique).
//  Usage : npx vite-node scripts/extract-content.mjs
// =============================================================================
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { stringifyCanonique } from "./canonical.mjs";
import { SORTS, CLASSES, MONSTRES, COMBATS, ZONES, ITEMS_TOILES, BUTIN_TOILES } from "../src/data.ts";

const DEST = path.resolve(import.meta.dirname, "../src/content");
mkdirSync(DEST, { recursive: true });

const zonesPools = Object.fromEntries(ZONES.map((z) => [z.id, z.pools]));

const FICHIERS = {
  "sorts.json": SORTS,
  "classes.json": CLASSES,
  "monstres.json": MONSTRES,
  "combats.json": COMBATS,
  "zones_pools.json": zonesPools,
  "items.json": ITEMS_TOILES,
  "butin_toiles.json": BUTIN_TOILES,
};

for (const [nom, data] of Object.entries(FICHIERS)) {
  writeFileSync(path.join(DEST, nom), stringifyCanonique(data), "utf-8");
  console.log(`✓ src/content/${nom} (${Object.keys(data).length} entrées)`);
}
