// =============================================================================
//  editor-build.mjs — Génère editeur.html (fichier unique auto-suffisant) :
//  template + styles + données courantes + JS concaténé (ordre des noms).
//  Usage : npm run editor:build
// =============================================================================
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { stringifyCanonique, hashContenu } from "./canonical.mjs";
import { NOMS_FICHIERS, SCHEMA_VERSION } from "./content-validate.mjs";

const RACINE = path.resolve(import.meta.dirname, "..");
const lire = (p) => readFileSync(path.join(RACINE, p), "utf-8");

const contenu = Object.fromEntries(NOMS_FICHIERS.map((n) =>
  [n, JSON.parse(lire(`src/content/${n}.json`))]));
const donnees = { schemaVersion: SCHEMA_VERSION, baseHash: hashContenu(contenu), contenu };

// Assets embarqués en data URI : l'éditeur est un fichier isolé chez le game
// designer, il n'a pas public/assets/. On n'embarque que les images des ids
// réellement présents dans le contenu (+ portraits de classes).
const assets = {};
let poidsAssets = 0;
const embarquer = (categorie, id) => {
  const rel = `${categorie}/${id}.png`;
  const abs = path.join(RACINE, "public/assets", rel);
  if (assets[rel] || !existsSync(abs)) return;
  const buf = readFileSync(abs);
  poidsAssets += buf.length;
  assets[rel] = `data:image/png;base64,${buf.toString("base64")}`;
};
for (const id of Object.keys(contenu.monstres)) embarquer("monstres", id);
for (const id of Object.keys(contenu.items)) embarquer("items", id);
for (const id of Object.keys(contenu.classes)) embarquer("classes", id);

const styles = lire("editor/styles.css");
// </script> dans les données casserait le parseur HTML :
const donneesJson = stringifyCanonique(donnees).replaceAll("</", "<\\/");
const assetsJson = JSON.stringify(assets).replaceAll("</", "<\\/");
const jsBrut = readdirSync(path.join(RACINE, "editor/js")).sort()
  .map((f) => `// ---- ${f} ----\n` + lire(`editor/js/${f}`)).join("\n");
// Le JS de editor/js/ ne contient pas de "</" littéral hors chaînes (donc pas de risque
// de casser des comparaisons comme a</b) — seule la séquence "</script" briserait le
// parseur HTML si elle apparaissait dans une chaîne JS ; on l'échappe spécifiquement.
const js = jsBrut.replace(/<\/script/gi, "<\\/script");

// .replace() interprète $&/$'/$1… dans une chaîne de remplacement — or ces données
// contiennent déjà des $ ; on passe systématiquement des fonctions pour l'éviter.
const html = lire("editor/template.html")
  .replace("/*STYLES*/", () => styles)
  .replace("/*DONNEES*/", () => donneesJson)
  .replace("/*ASSETS*/", () => assetsJson)
  .replace("/*APP*/", () => js);

writeFileSync(path.join(RACINE, "editeur.html"), html, "utf-8");
console.log(`✓ editeur.html (${(html.length / 1024 / 1024).toFixed(1)} Mo dont ${(poidsAssets / 1024 / 1024).toFixed(1)} Mo d'images ×${Object.keys(assets).length}, hash ${donnees.baseHash.slice(0, 12)}…)`);
