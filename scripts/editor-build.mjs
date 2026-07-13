// =============================================================================
//  editor-build.mjs — Génère editeur.html (fichier unique auto-suffisant) :
//  template + styles + données courantes + JS concaténé (ordre des noms).
//  Usage : npm run editor:build
// =============================================================================
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { stringifyCanonique, hashContenu } from "./canonical.mjs";
import { NOMS_FICHIERS, SCHEMA_VERSION } from "./content-validate.mjs";

const RACINE = path.resolve(import.meta.dirname, "..");
const lire = (p) => readFileSync(path.join(RACINE, p), "utf-8");

const contenu = Object.fromEntries(NOMS_FICHIERS.map((n) =>
  [n, JSON.parse(lire(`src/content/${n}.json`))]));
const donnees = { schemaVersion: SCHEMA_VERSION, baseHash: hashContenu(contenu), contenu };

const js = readdirSync(path.join(RACINE, "editor/js")).sort()
  .map((f) => `// ---- ${f} ----\n` + lire(`editor/js/${f}`)).join("\n");

const html = lire("editor/template.html")
  .replace("/*STYLES*/", lire("editor/styles.css"))
  // </script> dans les données casserait le parseur HTML :
  .replace("/*DONNEES*/", stringifyCanonique(donnees).replaceAll("</", "<\\/"))
  .replace("/*APP*/", js);

writeFileSync(path.join(RACINE, "editeur.html"), html, "utf-8");
console.log(`✓ editeur.html (${(html.length / 1024).toFixed(0)} Ko, hash ${donnees.baseHash.slice(0, 12)}…)`);
