// =============================================================================
//  import-items.mjs — Génère src/items_gen.ts depuis scripts/items.csv.
//  Usage : node scripts/import-items.mjs
//
//  Le CSV est la SOURCE DE VÉRITÉ des objets à rareté (conçu dans un tableur,
//  ré-exporté à chaque rééquilibrage). Format : voir l'en-tête de items.csv.
//  4 lignes par objet (commun / rare / epique / legendaire), stats FIXES par palier.
//  `toile` = index de zone dans l'ordre de jeu de la tranche 1 (1 = Incarnam…).
// =============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "items.csv");
const DEST = path.resolve(import.meta.dirname, "../src/items_gen.ts");

const RARETES = ["commun", "rare", "epique", "legendaire"];
const SLOTS = ["coiffe", "cape", "anneau", "arme"];

const slug = (nom) =>
  nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const lignes = readFileSync(SRC, "utf-8").trim().split(/\r?\n/);
const entetes = lignes[0].split(";").map((h) => h.trim());
const col = (row, nom) => (row[entetes.indexOf(nom)] ?? "").trim();
const num = (row, nom) => { const v = col(row, nom); return v === "" ? undefined : Number(v.replace(",", ".")); };

/** items[id] = { nom, slot, toile, attaque?, tiers: { rarete: {stats, resistances, pa} } } */
const items = new Map();
for (const ligne of lignes.slice(1)) {
  if (!ligne.trim()) continue;
  const row = ligne.split(";");
  const nom = col(row, "objet");
  const slot = col(row, "slot").toLowerCase().replace("cac", "arme");
  const rarete = col(row, "rarete").toLowerCase();
  if (!nom || !RARETES.includes(rarete)) throw new Error(`Ligne invalide : ${ligne}`);
  if (!SLOTS.includes(slot)) throw new Error(`Slot inconnu « ${slot} » : ${ligne}`);
  const id = slug(nom);
  if (!items.has(id)) items.set(id, { nom, slot, toile: Number(col(row, "toile")), tiers: {} });
  const it = items.get(id);

  const stats = {};
  for (const [csvCol, statKey] of [["for", "force"], ["int", "intelligence"], ["cha", "chance"],
    ["agi", "agilite"], ["vita", "vitalite"], ["crit", "crit"], ["prospection", "prospection"], ["soin", "soin"]]) {
    const v = num(row, csvCol);
    if (v !== undefined) stats[statKey] = v;
  }
  const resistances = {};
  for (const [csvCol, el] of [["res_terre", "terre"], ["res_feu", "feu"], ["res_eau", "eau"], ["res_air", "air"]]) {
    const v = num(row, csvCol);
    if (v !== undefined) resistances[el] = v / 100; // le CSV est en % entiers
  }
  const tier = { stats };
  const adapt = num(row, "adapt");
  if (adapt) tier.adaptatif = adapt; // stat ADAPTATIVE (carac de la voie du porteur)
  if (Object.keys(resistances).length) tier.resistances = resistances;
  const pa = num(row, "pa");
  if (pa) tier.pa = pa;
  it.tiers[rarete] = tier;
  const source = col(row, "source").toLowerCase();
  if (source === "boss" || source === "elite") it.source = source;
  const special = col(row, "special").toLowerCase();
  if (special === "pa_gamble") it.paGamble = { pPlus: 1 / 3, plus: 1, moins: 1 };
  if (special === "ligne_avant") it.ligneAvant = true;

  // attaque d'arme : lue sur la ligne (identique ou progressive par palier)
  const attPA = num(row, "att_pa");
  if (attPA) {
    it.tiers[rarete].attaque = {
      coutPA: attPA, baseMin: num(row, "att_min") ?? 0, baseMax: num(row, "att_max") ?? 0,
      scaling: num(row, "att_scaling") ?? 0.3,
      ...(col(row, "att_cible") === "tous" ? { cible: "ennemi_tous" } : {}),
      ...(num(row, "att_vamp") ? { vampirisme: num(row, "att_vamp") } : {}),
    };
  }
}

// validations : au moins un palier par objet (un objet peut n'exister qu'en
// épique/légendaire, ex. l'Arc en Racine d'Abraknyde — le tirage se renormalise)
for (const [id, it] of items) {
  if (!RARETES.some((r) => it.tiers[r])) throw new Error(`${id} : aucun palier défini`);
}

// pools par toile et par SOURCE de drop (normales / élites / boss)
const parToile = {};
for (const [id, it] of items) {
  const t = (parToile[it.toile] ??= { normales: [], elites: [], boss: [] });
  (it.source === "boss" ? t.boss : it.source === "elite" ? t.elites : t.normales).push(id);
}

const out = `// =============================================================================
//  items_gen.ts — AUTO-GÉNÉRÉ par scripts/import-items.mjs depuis items.csv.
//  NE PAS ÉDITER À LA MAIN : modifier le CSV puis relancer l'import.
// =============================================================================
import type { Item } from "./types";

/** Objets à rareté (stats fixes par palier), par id. */
export const ITEMS_TOILES: Record<string, Item> = ${JSON.stringify(
  Object.fromEntries([...items].map(([id, it]) => [id, {
    id, nom: it.nom, slot: it.slot, tiers: it.tiers, ...(it.source ? { source: it.source } : {}),
    ...(it.paGamble ? { paGamble: it.paGamble } : {}), ...(it.ligneAvant ? { ligneAvant: true } : {}),
  }])), null, 2)};

/** Pools par toile et par source de drop (normales / élites / boss). */
export interface PoolsToile { normales: string[]; elites: string[]; boss: string[] }
export const BUTIN_TOILES: Record<number, PoolsToile> = ${JSON.stringify(parToile, null, 2)};
`;
writeFileSync(DEST, out);
console.log(`✓ ${items.size} objets (${lignes.length - 1} lignes) → src/items_gen.ts · toiles : ${Object.keys(parToile).join(", ")}`);
