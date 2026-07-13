// Icônes des objets à rareté : pour chaque objet de src/content/items.json, cherche le
// match EXACT sur DofusDB et télécharge son icône. Les objets INVENTÉS (sans
// homonyme) ont une surcharge iconId explicite ci-dessous. Rejouable.
import { readFileSync, writeFileSync } from "node:fs";

// id local → iconId DofusDB (cousins visuels choisis pour les noms inventés)
const SURCHARGES = {
  cape_champ_champ: 17076, // « Cape DU Champ Champ » (article)
  anneau_champ_champ: 9074, // « Anneau DU Champ Champ »
  coiffe_champ_champ: 15001, // Champignon (le Champ Champ est un champi)
  coiffe_bouftou: 16041, // « Coiffe DU Bouftou »
  marteau_bouftou: 7023, // « Marteau DU Bouftou »
  cape_du_bouftou: 17044, // Cape Bouffante (laine de bouftou)
  boufcape_royale: 17046, // Cape Bouffante Royale
  ergot_mina: 5014, // « L'Ergot Mina » (article)
  epee_de_l_aventurier: 6007, // Épée de Boisaille (pas d'épée Aventurier officielle)
  le_houde: 16014, // « Houde » (sans article)
  coiffe_du_tofu: 61685, // Peluche du Tofu (un tofu sur la tête)
  cape_edepee: 17646, // Cape du Chevalier du Ciel (panache de cape et d'épée)
  anneau_bouftou: null, // copie du legacy bouftou_anneau (déjà en place)
  pelle_du_bois_dormant: 8020, // « Pelle DE Bois Dormant »
  anneau_forrain: 9050, // « Anneau Forain » (un seul r)
  masque_traumatisant: 16011, // « Masque TROmatisant » (vrai nom Dofus)
  baguette_scafeuille: 3059, // vrai nom : Baguette du Scarabosse Doré
  anneau_poupayahn: 9101, // Anneau du Scarabosse Doré (cousin de zone)
  vegacoiffe: 16753, // Heaume Erik (cousin métal, niv 40)
  veganneau: 9085, // vrai nom : Anneau Ha
  vegaton: 4041, // Racine Sauvageonne (la Racine Hécouane n'est pas sur DofusDB)
  dagues_aj_deh_la: 5019, // « Dagues Aj'Deh'Là » (accent)
  ann_or: 9043, // vrai nom : Kwakanneau (variante de Flammes, la dorée)
};

const items = Object.values(JSON.parse(readFileSync("src/content/items.json", "utf-8")))
  .map((it) => [it.id, it.nom]);

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
