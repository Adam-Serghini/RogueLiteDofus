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
  gobichon: "Gobichon",
  gob_trotteur: "Gob-trotteur",
  gobaliste: "Gobaliste",
  gobaladee: "Gobaladée",
  directeur_grunob: "Directeur Grunob",
  // Donjon des Tofus (complément : roster réel DofusDB, donjon varie)
  tofoune: "Tofoune",
  tofu_mutant: "Tofu Mutant",
  // Cache de Kankreblath
  pyrasite: "Pyrasite",
  ceglumen: "Céglumen",
  cafarcher: "Cafarcher",
  mirgrillon: "Mirgrillon",
  sakarien: "Sakarien",
  kankreblath: "Kankreblath",
  // Maison Fantôme (roster réel DofusDB, donjon 34)
  vampire: "Vampire",
  kwoan: "Kwoan",
  gargrouille: "Gargrouille",
  boostache_prepubere: 353, // Boostache Prépubère
  boostache: "Boostache",
  // Donjon des Larves
  larve_bleue: "Larve Bleue",
  larve_verte: "Larve Verte",
  larve_orange: "Larve Orange",
  larve_saphir: "Larve Saphir",
  larve_rubis: "Larve Rubis",
  larve_emeraude: "Larve Émeraude",
  larve_doree: "Larve Dorée",
  shin_larve: "Shin Larve",
  // Grotte Hesque (roster réel DofusDB, donjon 25)
  corailleur: "Corailleur",
  crustorail_kouracao: 584,
  crustorail_morito: 587,
  palmifleur_passaoh: 590,
  palmifleur_malibout: 589,
  palmifleur_morito: 591,
  corailleur_magistral: "Corailleur Magistral",
  // Nid du Kwakwa
  kwak_de_terre: "Kwak de Terre",
  kwak_de_feu: "Kwak de Flamme",
  kwak_d_eau: "Kwak de Glace",
  kwak_de_vent: "Kwak de Vent",
  kwakere_de_terre: "Kwakere de Terre",
  kwakwa: "Kwakwa",
  // Clos des Blops (Tranche 2, gfxId relevés directement sur DofusDB)
  blop_coco: 162,
  blop_indigo: 163,
  blop_griotte: 164,
  blop_reinette: 165,
  biblop_indigo: 166,
  biblop_coco: 167,
  biblop_griotte: 168,
  biblop_reinette: 169,
  gloutoblop: 642,
  blopignon: 643,
  tronkoblop: 644,
  blop_coco_royal: 645,
  blop_griotte_royal: 646,
  blop_indigo_royal: 647,
  blop_reinette_royal: 648,
  // Cale de l'Arche d'Otomaï (Tranche 2, gfxId relevés directement sur DofusDB)
  boomba: 124,
  nakunbra: 125,
  canondorf: 127,
  sparo: 572,
  barbroussa: 573,
  le_flib: 574,
  gourlo_le_terrible: 575,
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
