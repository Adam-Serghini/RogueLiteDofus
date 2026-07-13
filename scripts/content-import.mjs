// =============================================================================
//  content-import.mjs — Importe un export de l'éditeur dans src/content/.
//  Usage : npm run content:import -- contenu.json [--force] [--sans-assets] [--sans-tests]
//  Tout ou rien : la moindre erreur de validation annule l'écriture.
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { stringifyCanonique, hashContenu } from "./canonical.mjs";
import { validerContenu, NOMS_FICHIERS, SCHEMA_VERSION } from "./content-validate.mjs";

const args = process.argv.slice(2);
const fichier = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force");
const sansAssets = args.includes("--sans-assets");
const sansTests = args.includes("--sans-tests");
if (!fichier) { console.error("Usage : npm run content:import -- <contenu.json> [--force] [--sans-assets] [--sans-tests]"); process.exit(1); }

const RACINE = path.resolve(import.meta.dirname, "..");
const CONTENT = path.join(RACINE, "src/content");
const lireBase = () => Object.fromEntries(NOMS_FICHIERS.map((n) =>
  [n, JSON.parse(readFileSync(path.join(CONTENT, `${n}.json`), "utf-8"))]));

// 1. Lecture + version de schéma
let exporte;
try { exporte = JSON.parse(readFileSync(fichier, "utf-8")); }
catch (e) { console.error(`✗ Fichier illisible : ${e.message}`); process.exit(1); }
if (exporte.schemaVersion !== SCHEMA_VERSION) {
  console.error(`✗ Version de schéma ${exporte.schemaVersion} ≠ ${SCHEMA_VERSION} attendue (éditeur périmé : relancer npm run editor:build et renvoyer editeur.html)`);
  process.exit(1);
}

// 1.5. Validation structurelle : assets
if (exporte.assets !== undefined && !Array.isArray(exporte.assets)) {
  console.error("✗ Le champ « assets » de l'export est invalide (liste attendue).");
  process.exit(1);
}

// 2. Fraîcheur : l'export doit être basé sur le contenu ACTUEL du repo
const base = lireBase();
const hashActuel = hashContenu(base);
if (exporte.baseHash !== hashActuel) {
  console.error("✗ Cet export est basé sur une version PÉRIMÉE des données (le repo a changé depuis).");
  console.error(`  hash de l'export : ${exporte.baseHash}\n  hash du repo     : ${hashActuel}`);
  console.error("  → régénérer editeur.html, le renvoyer, refaire les modifs — ou importer avec --force en connaissance de cause.");
  if (!force) process.exit(1);
  console.error("  --force : on continue malgré tout.");
}

// 3. Validation (3 passes)
const erreurs = validerContenu(exporte.contenu, base);
if (erreurs.length) {
  console.error(`✗ ${erreurs.length} erreur(s) de validation — RIEN n'a été écrit :\n`);
  for (const e of erreurs) console.error("  " + e);
  process.exit(1);
}

// 4. Écriture canonique (tout ou rien : la validation est déjà passée)
for (const n of NOMS_FICHIERS)
  writeFileSync(path.join(CONTENT, `${n}.json`), stringifyCanonique(exporte.contenu[n]), "utf-8");
console.log(`✓ ${NOMS_FICHIERS.length} fichiers écrits dans src/content/`);

// 5. Assets DofusDB référencés (skip les existants, comme fetch-assets.mjs)
if (!sansAssets) {
  for (const { fichier: rel, url } of exporte.assets ?? []) {
    if (!/^[\w/-]+\.png$/.test(rel)) { console.warn(`⚠ chemin d'asset suspect ignoré : ${rel}`); continue; }
    const dest = path.join(RACINE, "public/assets", rel);
    if (existsSync(dest)) continue;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      console.log(`✓ asset ${rel}`);
    } catch (e) { console.warn(`⚠ asset ${rel} : ${e.message} (fallback UI ok)`); }
  }
}

// 6. Non-régression
if (!sansTests) {
  console.log("\n→ typecheck + tests…");
  try {
    execSync("npm run typecheck", { cwd: RACINE, stdio: "inherit" });
    execSync("npm test", { cwd: RACINE, stdio: "inherit" });
    console.log("\n✓ Import terminé. Relire le git diff avant de committer.");
  } catch {
    console.error("\n✗ Les tests échouent avec ce contenu. Le diff est en place : inspecter, corriger ou `git checkout -- src/content/`.");
    process.exit(1);
  }
}
