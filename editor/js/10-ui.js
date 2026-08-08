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
      if (v === "") {
        // champ non optionnel : on garde l'ancienne valeur (pas de 0 silencieux),
        // l'input reste vide à l'écran jusqu'au prochain rendu.
        if (opts.optionnel) { delete obj[cle]; sauverBrouillon(); }
        return;
      }
      obj[cle] = Number(v);
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

/** Champ Nom d'une entité. Tant que l'entité est NOUVELLE (créée dans cette
 *  session), son id est recalculé depuis le nom à la fin de la saisie (blur),
 *  et `majRefs(ancienId, nouvelId)` répercute le changement sur les références.
 *  Les entités déjà expédiées gardent leur id (le jeu les référence). */
function champNom(collection, id, majRefs) {
  const obj = C[collection][id];
  return el("div", { class: "champ" }, el("label", {}, "Nom"),
    el("input", { type: "text", value: obj.nom ?? "",
      oninput: (ev) => { obj.nom = ev.target.value; sauverBrouillon(); },
      onchange: (ev) => {
        const cle = `${collection}:${id}`;
        const i = E.nouveaux.indexOf(cle);
        if (i < 0) return;
        const nouvelId = idDepuisNom(ev.target.value || "sans nom", C[collection]);
        if (nouvelId === id) return;
        C[collection][nouvelId] = obj;
        delete C[collection][id];
        if ("id" in obj) obj.id = nouvelId;
        majRefs(id, nouvelId);
        E.nouveaux[i] = `${collection}:${nouvelId}`;
        E.selection = nouvelId;
        sauverBrouillon(); rendre();
      } }));
}

/** Crée une entité sans popup : nom par défaut, sélection, focus sur le champ Nom. */
function creerEntite(collection, nomDefaut, fabrique) {
  const id = idDepuisNom(nomDefaut, C[collection]);
  C[collection][id] = fabrique(id);
  E.nouveaux.push(`${collection}:${id}`);
  E.selection = id; E.focusNom = true;
  sauverBrouillon(); rendre();
  return id;
}

// Dernier état rendu : sert à décider si la position de défilement doit être
// conservée ou remise en haut (voir `rendre`).
let derniereCategorie = null;
let derniereSelection = null;

function rendre() {
  const app = document.getElementById("app");
  // La recherche perd le focus à chaque frappe car rendre() détruit tout le DOM :
  // on mémorise le focus/curseur avant, on les restaure sur le nouvel input après.
  const rechercheActive = document.activeElement?.id === "recherche-input";
  const curseur = rechercheActive ? document.activeElement.selectionStart : null;
  // Même cause, autre symptôme : `#liste` et `#fiche` défilent (overflow-y: auto),
  // et les reconstruire remet leur défilement à zéro. Cliquer une entrée en bas
  // d'une longue liste la renvoyait donc en haut à chaque fois.
  // On conserve la position de la LISTE tant qu'on reste dans la même catégorie
  // (changer d'onglet affiche un contenu sans rapport : repartir en haut est
  // alors ce qu'on attend), et celle de la FICHE seulement si l'on reste sur la
  // même entrée — ouvrir une autre fiche doit la montrer depuis son début.
  const memeCategorie = derniereCategorie === E.categorie;
  const scrollListe = memeCategorie ? (document.getElementById("liste")?.scrollTop ?? 0) : 0;
  const scrollFiche = memeCategorie && derniereSelection === E.selection
    ? (document.getElementById("fiche")?.scrollTop ?? 0)
    : 0;
  derniereCategorie = E.categorie;
  derniereSelection = E.selection;
  app.replaceChildren();
  const cat = CATEGORIES.find((c) => c.id === E.categorie);
  // --- nav ---
  const nav = el("nav", {}, el("h1", {}, "Contenu du jeu"),
    ...CATEGORIES.map((c) => el("button", { class: c.id === E.categorie ? "actif" : "", onclick: () => { E.categorie = c.id; E.selection = null; E.recherche = ""; rendre(); } }, c.libelle)),
    el("div", { class: "etat" }, E.modifie ? "● Modifications non exportées" : "Aucune modification"));
  // --- liste (recherche + lignes fournies par la catégorie) ---
  const liste = el("div", { id: "liste" },
    el("input", { type: "search", id: "recherche-input", placeholder: "Filtrer…", value: E.recherche,
      oninput: (ev) => { E.recherche = ev.target.value; rendre(); } }),
    ...cat.liste());
  // --- fiche ---
  const fiche = el("div", { id: "fiche" }, ...(E.selection != null || cat.sansSelection ? cat.fiche(E.selection) : [el("p", { class: "note" }, "Sélectionner une entrée à gauche, ou en créer une nouvelle.")]));
  app.append(nav, liste, fiche);
  // après l'insertion : les deux conteneurs ont enfin une hauteur, donc un
  // défilement possible (une valeur trop grande est bornée d'elle-même)
  liste.scrollTop = scrollListe;
  fiche.scrollTop = scrollFiche;
  if (rechercheActive) {
    const s = document.getElementById("recherche-input");
    s.focus();
    s.setSelectionRange(curseur, curseur);
  }
  if (E.focusNom) {
    E.focusNom = false;
    const nom = fiche.querySelector("input[type=text]");
    if (nom) { nom.focus(); nom.select(); }
  }
}

function ligneListe(id, contenuLigne, vignette) {
  return el("button", { class: "ligne" + (E.selection === id ? " actif" : "") + (vignette ? " avec-vignette" : ""), onclick: () => { E.selection = id; rendre(); } },
    vignette ?? null, el("span", {}, contenuLigne));
}

/** Vignette d'un asset embarqué (`monstres/x.png`…) ; null si absent du build. */
function vignetteAsset(chemin, classe = "vignette") {
  const uri = ASSETS_LOCAUX[chemin];
  return uri ? el("img", { class: classe, src: uri, alt: "" }) : null;
}
const filtre = (texte) => texte.toLowerCase().includes(E.recherche.toLowerCase());
