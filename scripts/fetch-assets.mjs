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
  // Gelaxième Dimension (Tranche 2, gfxId relevés directement sur DofusDB)
  gelee_bleuet: 17,
  gelee_menthe: 18,
  gelee_fraise: 19,
  gelee_citron: 231,
  gelee_royale_bleuet: 20,
  gelee_royale_menthe: 38,
  gelee_royale_fraise: 39,
  gelee_royale_citron: 232,
  // Laboratoire de Brumen Tinctorias (Tranche 2, gfxId relevés directement sur DofusDB)
  scorbute: 186,
  croc_gland: 187,
  kolerat: 188,
  macien: 189,
  crowneille: 673,
  nelween: 856,
  // Terrier du Wa Wabbit (Tranche 2, gfxId relevés directement sur DofusDB — la zone
  // mélange les donjons 17 « Terrier » et 52 « Château », cf. CLAUDE.md)
  wabbit: 25,
  black_wabbit: 26,
  tiwabbit_kiafin: 28,
  tiwabbit: 48,
  wo_wabbit: 49,
  grand_pa_wabbit: 50,
  wa_wabbit: 101,
  wobot: 102,
  wa_wobot: 1006,
  tiwobot: 1018,
  // Pitons Rocheux des Craqueleurs (Tranche 2, gfxId relevés sur DofusDB ; le
  // Craquelourd vient de la famille élargie, pas du donjon 18 — cf. CLAUDE.md)
  craqueleur: 4,
  craqueleur_des_plaines: 181,
  craqueleur_legendaire: 183,
  craqueboule: 268,
  craquelourd: 694,
  // Bateau du Chouque & Village Kanniboul (Tranche 2, gfxId relevés sur DofusDB —
  // donjons 91 et 27 ; Boomba/Nakunbra/Canondorf du 91 sont DÉJÀ à la toile 14)
  kanniboul_ark: 110,
  kanniboul_eth: 111,
  kanniboul_jav: 112,
  kanniboul_sarbak: 113,
  le_chouque: 126,
  kanniboul_ebil: 837,
  kanniboul_tam: 1322,
  ricanif: 1323,
  ivremor: 1324,
  // Antre du Dragon Cochon (Tranche 2, gfxId relevés sur DofusDB — donjon 6 ; les deux
  // Porkass viennent de la famille élargie ; le Cochon de Lait est écarté, il partage
  // le gfx 68 de Porsalu)
  dragon_cochon: 60,
  porsalu: 68,
  cavalier_porkass: 191,
  berger_porkass: 192,
  don_duss_ang: 332,
  don_dorgan: 333,
  cochon_de_farle: 334,
  gorgouille: 871,
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
