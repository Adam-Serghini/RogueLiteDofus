"use strict";
const DONNEES = JSON.parse(document.getElementById("donnees").textContent);
// Images du repo embarquées au build (data URIs) — chemin relatif → URI.
const ASSETS_LOCAUX = JSON.parse(document.getElementById("assets")?.textContent ?? "{}");
const C = DONNEES.contenu; // raccourci : { sorts, classes, monstres, combats, zones_pools, items, butin_toiles }
const CLE_BROUILLON = "rld_editeur_brouillon";

const E = { categorie: "items", selection: null, recherche: "", modifie: false, assets: [] };
const CATEGORIES = []; // remplies par enregistrerCategorie() dans les fichiers suivants

function sauverBrouillon() {
  E.modifie = true;
  try {
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({
      baseHash: DONNEES.baseHash, date: new Date().toISOString(), contenu: C, assets: E.assets,
    }));
  } catch { /* stockage plein/indispo : l'export manuel reste possible */ }
}

function restaurerBrouillon() {
  let b; try { b = JSON.parse(localStorage.getItem(CLE_BROUILLON)); } catch { return; }
  if (!b || b.baseHash !== DONNEES.baseHash) return; // brouillon d'une autre version : ignoré
  if (!confirm(`Reprendre le travail non exporté du ${new Date(b.date).toLocaleString("fr-FR")} ?`)) {
    localStorage.removeItem(CLE_BROUILLON); return;
  }
  Object.assign(C, b.contenu); E.assets = b.assets ?? []; E.modifie = true;
}

function idDepuisNom(nom, existants) {
  let id = nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "sans_nom";
  let n = 2; const base = id;
  while (existants[id]) id = `${base}_${n++}`;
  return id;
}
window.addEventListener("beforeunload", (ev) => { if (E.modifie) ev.preventDefault(); });
