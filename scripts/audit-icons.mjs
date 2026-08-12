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
  // ---- Toiles 13-24 (tranche 2) ----------------------------------------------
  // Le vrai nom Dofus diffère d'un détail (apostrophe, accent, une lettre) :
  casque_du_roks_or: 16254, // « Casque du Roks Or » (sans apostrophe)
  cape_du_roks_or: 17171, // « Cape du Roks Or »
  anneau_du_roks_or: 9182, // « Anneau du Roks Or »
  kryst_o_boul: 4063, // « Kryst O'Boul »
  cape_du_desir_o_boul: 17083, // « Cape du Désir O'Boul »
  anneau_bsene: 9095, // « Anneau Bsène » (accent)
  dagues_ruyeres: 5061, // « Dagues Ruyère » (singulier)
  blessdagues: 5055, // vrai nom : « Blessdags »
  sabre_sandawa: 6057, // vrai nom : « Sabre Sandanwa »
  dagues_lutination: 5035, // « Dague Lutination » (singulier)
  baguette_des_limbes: 3007, // « LA Baguette des Limbes » (article)
  griffe_du_muloubard: 6035, // « Fausse Griffe de Ceangal » (nom d'origine du tableur, orthographe DofusDB)
  gelano_rouille: 9371, // Gelano Ankarton (la variante recolorée du Gelano)
  oreilles_du_wabbit: 16052, // « Oreilles de Wabbits » (pluriel)
  sac_cawotte: 81057, // « Sac-Cawotte » (trait d'union)
  coiffe_du_scorbute: 16520, // vrai nom : « Casque du Scorbute »
  coiffe_dragon_cochon: 16150, // « Coiffe DU Dragon Cochon » (article)
  coiffe_du_capitaine_pirate: 16474, // vrai nom : « Chapeau du Capitaine Pirate »
  coiffe_du_craqueleur: 16085, // vrai nom : « Casque du Craqueleur »
  coiffe_du_craqueleur_legendaire: 16133, // vrai nom : « Casque du Craqueleur Légendaire »
  coiffe_de_l_abraknyde_ancestral: 16174, // vrai nom : « Abracaska Ancestral »
  cape_de_l_abraknyde_ancestral: 17126, // vrai nom : « Abracapa Ancestrale »
  // Renommages d'Adam : l'icône vient du nom D'ORIGINE du tableur :
  pelle_du_roks_or: 8027, // Pelle Doudesque
  annopirate: 9079, // Anneau Fioutioure
  pelle_ripate: 8047, // Pelle Ripe
  anneau_du_scorbute: 9414, // Bague des Scalptaras
  racine_du_scorbute: 4058, // Racine Horodon
  dagues_du_pirate: 5031, // La Thor-Boyaux
  cape_du_commandant_dragoeuf: 17060, // Cape du Chef Bwork
  lame_du_commandant_dragoeuf: 6048, // Lame du Chef Bwork
  anneau_du_muloubard: 9103, // Anneau du Mulou
  coiffe_tissee: 16464, // Coiffe de la Néfileuse
  capraignee: 17342, // Caparak
  racine_istre: 4056, // Racine Histre
  fourbaton: 4108, // Bâton de Daïgoro
  // Cousins visuels (aucun homonyme ni nom d'origine sur DofusDB) :
  cape_irate: 17011, // Cape du Pirate
  casque_du_commandant_dragoeuf: 16057, // Dragocoiffe Ardoise (la Coiffe du Chef Bwork n'existe pas)
  anneau_du_commandant_dragoeuf: 9058, // Bracelet du Chef Bwork
  dragocoiffe_blanche: 16028, // Dragocoiffe Calcaire (la blanche n'existe pas, le calcaire est pâle)
  sceptre_du_wa_wabbit: 4001, // Bâton du Grand Pa Wabbit
  bracelet_du_wa_wabbit: 9158, // Bracelet Ventré (aucun anneau wabbit — À REMPLACER si mieux)
  anneau_du_craqueleur: 9004, // Anneau des Rocheuses (un anneau de pierre)
  cape_du_craqueleur: 10074, // Ceinture du Craqueleur (large bande de cuir — À REMPLACER si mieux)
  cape_du_craqueleur_legendaire: 10094, // Ceinture du Craqueleur Légendaire (idem)
  cape_du_muloubard: 17003, // Cape du Mulou Fou
  coiffe_du_muloubard: 16144, // Coiffe du Meulou — PARTAGÉE avec le boss de la zone, faute de 2e tête de loup
  fourbacape: 17348, // Cape de Moon (zone de la Fourbasse)
};

const items = Object.values(JSON.parse(readFileSync("src/content/items.json", "utf-8")))
  .map((it) => [it.id, it.nom]);

const echap = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const manquants = [];
for (const [id, nom] of items) {
  // La surcharge court-circuite AVANT toute requête : ces objets sont inventés,
  // la recherche par nom ne pouvait rien trouver pour eux.
  if (id in SURCHARGES) {
    const iconId = SURCHARGES[id];
    if (iconId) {
      const img = await fetch(`https://api.dofusdb.fr/img/items/${iconId}.png`);
      writeFileSync(`public/assets/items/${id}.png`, Buffer.from(await img.arrayBuffer()));
    }
    console.log("SURCH ", id.padEnd(28), `iconId ${iconId ?? "(conservé)"}`);
    continue;
  }
  const url = `https://api.dofusdb.fr/items?name.fr[$regex]=^${encodeURIComponent(echap(nom))}$&name.fr[$options]=i&$limit=2`;
  const j = await (await fetch(url)).json();
  const hit = j.data?.[0];
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
