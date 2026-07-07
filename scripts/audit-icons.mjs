// Icônes des objets à rareté : pour chaque objet d'items_gen.ts, cherche le
// match EXACT sur DofusDB et télécharge son icône. Les objets INVENTÉS (sans
// homonyme) ont une surcharge iconId explicite ci-dessous. Rejouable.
import { readFileSync, writeFileSync } from "node:fs";

// id local → iconId DofusDB (cousins visuels choisis pour les noms inventés)
const SURCHARGES = {
  coiffe_boune: 18123, // Boune Charmant (une boune sur la tête, façon Toady)
  cape_sloque: 17144, // Cape de la Ouassingue (vibe marécageuse)
  coiffe_champ_champ: 15001, // Champignon (le Champ Champ est un champi)
  cape_pandawashu: null, // Cape Pandawa déjà en place (pas d'écrasement)
};

const gen = readFileSync("src/items_gen.ts", "utf-8");
const items = [...gen.matchAll(/"id": "(\w+)",\s+"nom": "([^"]+)"/g)].map((m) => [m[1], m[2]]);

const echap = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const manquants = [];
for (const [id, nom] of items) {
  const url = `https://api.dofusdb.fr/items?name.fr[$regex]=^${encodeURIComponent(echap(nom))}$&name.fr[$options]=i&$limit=2`;
  const j = await (await fetch(url)).json();
  const hit = j.data?.[0];
  if (id in SURCHARGES) {
    const iconId = SURCHARGES[id];
    if (iconId) {
      const img = await fetch(`https://api.dofusdb.fr/img/items/${iconId}.png`);
      writeFileSync(`public/assets/items/${id}.png`, Buffer.from(await img.arrayBuffer()));
    }
    console.log("SURCH ", id.padEnd(28), `iconId ${iconId ?? "(conservé)"}`);
    continue;
  }
  if (!hit) {
    manquants.push([id, nom]);
    console.log("MISS  ", id.padEnd(28), `« ${nom} »`);
    continue;
  }
  const img = await fetch(`https://api.dofusdb.fr/img/items/${hit.iconId}.png`);
  if (img.ok) {
    writeFileSync(`public/assets/items/${id}.png`, Buffer.from(await img.arrayBuffer()));
    console.log("EXACT ", id.padEnd(28), `« ${hit.name.fr} » iconId ${hit.iconId}`);
  } else {
    console.log("NOIMG ", id.padEnd(28), `« ${hit.name.fr} »`);
  }
}
console.log("\nSans homonyme exact :", manquants.map(([i]) => i).join(", ") || "aucun");
