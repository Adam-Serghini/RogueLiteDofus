// =============================================================================
//  fetch-assets.mjs — Récupère les sprites de monstres depuis DofusDB.
//  Usage : node scripts/fetch-assets.mjs
//  API : GET https://api.dofusdb.fr/monsters?name.fr=<Nom> → gfxId
//        puis https://api.dofusdb.fr/img/monsters/{gfxId}.png (clé = gfxId, PAS id).
//  Ne télécharge que les fichiers absents de public/assets/monstres/.
// =============================================================================
import { writeFile, access } from "node:fs/promises";
import path from "node:path";

const DEST = path.resolve(import.meta.dirname, "../public/assets/monstres");

// id local → nom FR exact sur DofusDB, ou directement un gfxId (number)
// pour les espèces sans homonyme exact (sprite d'un cousin visuel).
const MONSTRES = {
  // Akadémie des Gobs
  gobet: "Gobet",
  gobelin: 1473, // sprite du Gobelin Bagarreur
  gob_trotteur: "Gob-trotteur",
  gobelin_gladiateur: 1612, // sprite du Gobelin courageux
  directeur_grunob: "Directeur Grunob",
  // Cache de Kankreblath
  pyrasite: "Pyrasite",
  ceglumen: "Céglumen",
  cafarcher: "Cafarcher",
  mirgrillon: "Mirgrillon",
  sakarien: "Sakarien",
  kankreblath: "Kankreblath",
  // Maison Fantôme
  fantome_farceur: 514, // sprite du Fantôme Apero
  fantome_hanteur: 203, // sprite du Fantôme Hicide
  ashi_magari: "Ashi-magari",
  esprit_frappeur: 202, // sprite du Fantôme Égérie
  boostache: "Boostache",
  // Donjon des Larves
  larve_bleue: "Larve Bleue",
  larve_verte: "Larve Verte",
  larve_orange: "Larve Orange",
  larve_doree: "Larve Dorée",
  shin_larve: "Shin Larve",
  // Grotte Hesque
  corailleur: "Corailleur",
  craboral: 24, // sprite du Crabe
  kaskargo: "Kaskargo",
  corailleur_ancien: "Corailleur Magistral", // pas d'« ancien » officiel : réutilise le sprite du Magistral
  corailleur_magistral: "Corailleur Magistral",
  // Nid du Kwakwa
  kwak_de_terre: "Kwak de Terre",
  kwak_de_feu: "Kwak de Flamme",
  kwak_d_eau: "Kwak de Glace",
  kwak_de_vent: "Kwak de Vent",
  kwak_veteran: "Kwakwa", // vétéran inventé : réutilise le sprite du Kwakwa
  kwakwa: "Kwakwa",
};

const existe = (f) => access(f).then(() => true, () => false);

async function gfxIdDe(nom) {
  const url = `https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(nom)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const m = j.data?.[0];
  if (!m) throw new Error("introuvable");
  return m.gfxId ?? m.id;
}

let ok = 0, skip = 0, ko = 0;
for (const [id, nom] of Object.entries(MONSTRES)) {
  const dest = path.join(DEST, `${id}.png`);
  if (await existe(dest)) { skip++; continue; }
  try {
    const gfxId = typeof nom === "number" ? nom : await gfxIdDe(nom);
    const img = await fetch(`https://api.dofusdb.fr/img/monsters/${gfxId}.png`);
    if (!img.ok) throw new Error(`img HTTP ${img.status}`);
    await writeFile(dest, Buffer.from(await img.arrayBuffer()));
    console.log(`✓ ${id} ← « ${nom} » (gfxId ${gfxId})`);
    ok++;
  } catch (e) {
    console.warn(`✗ ${id} (« ${nom} ») : ${e.message}`);
    ko++;
  }
}
console.log(`\n${ok} téléchargés · ${skip} déjà présents · ${ko} échecs (fallback UI ok)`);
