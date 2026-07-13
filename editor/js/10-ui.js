function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (v !== undefined && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...enfants.filter((e) => e != null));
  return n;
}

/** Champ nombre lié : écrit obj[cle] à la saisie (efface la clé si vide et opts.optionnel). */
function champNombre(obj, cle, libelle, opts = {}) {
  const input = el("input", {
    type: "number", step: opts.step ?? "any", value: obj[cle] ?? "",
    oninput: (ev) => {
      const v = ev.target.value;
      if (v === "" && opts.optionnel) delete obj[cle];
      else obj[cle] = Number(v);
      sauverBrouillon();
    },
  });
  return el("div", { class: "champ" }, el("label", {}, libelle), input);
}

function champTexte(obj, cle, libelle) {
  return el("div", { class: "champ" }, el("label", {}, libelle),
    el("input", { type: "text", value: obj[cle] ?? "", oninput: (ev) => { obj[cle] = ev.target.value; sauverBrouillon(); } }));
}

function champSelect(obj, cle, libelle, options, apres) {
  return el("div", { class: "champ" }, el("label", {}, libelle),
    el("select", { onchange: (ev) => { obj[cle] = ev.target.value; sauverBrouillon(); if (apres) apres(); rendre(); } },
      ...options.map(([v, lib]) => el("option", { value: v, selected: obj[cle] === v }, lib))));
}

function enregistrerCategorie(id, libelle, api) { CATEGORIES.push({ id, libelle, ...api }); }

function rendre() {
  const app = document.getElementById("app");
  app.replaceChildren();
  const cat = CATEGORIES.find((c) => c.id === E.categorie);
  // --- nav ---
  const nav = el("nav", {}, el("h1", {}, "Contenu du jeu"),
    ...CATEGORIES.map((c) => el("button", { class: c.id === E.categorie ? "actif" : "", onclick: () => { E.categorie = c.id; E.selection = null; E.recherche = ""; rendre(); } }, c.libelle)),
    el("div", { class: "etat" }, E.modifie ? "● Modifications non exportées" : "Aucune modification"));
  // --- liste (recherche + lignes fournies par la catégorie) ---
  const liste = el("div", { id: "liste" },
    el("input", { type: "search", placeholder: "Filtrer…", value: E.recherche,
      oninput: (ev) => { E.recherche = ev.target.value; rendre(); } }),
    ...cat.liste());
  // --- fiche ---
  const fiche = el("div", { id: "fiche" }, ...(E.selection != null || cat.sansSelection ? cat.fiche(E.selection) : [el("p", { class: "note" }, "Sélectionner une entrée à gauche, ou en créer une nouvelle.")]));
  app.append(nav, liste, fiche);
}

function ligneListe(id, contenuLigne) {
  return el("button", { class: "ligne" + (E.selection === id ? " actif" : ""), onclick: () => { E.selection = id; rendre(); } }, contenuLigne);
}
const filtre = (texte) => texte.toLowerCase().includes(E.recherche.toLowerCase());
