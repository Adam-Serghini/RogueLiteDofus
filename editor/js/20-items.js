const RARETES_ED = ["commun", "rare", "epique", "legendaire"];
const SLOTS_ED = [["arme", "Arme"], ["coiffe", "Coiffe"], ["cape", "Cape"], ["anneau", "Anneau"]];
// Pas de force/intelligence/agilité/chance ici : les items ne portent que la
// stat ADAPTATIVE (ligne « adaptatif »), qui alimente la voie du porteur.
const STATS_ED = ["vitalite", "soin", "prospection", "crit"];
const ELEMENTS_ED = ["terre", "feu", "eau", "air"];
// Catalogue des mécaniques spéciales existantes (champ → valeur par défaut).
const SPECIAUX = [
  ["paGamble", "Pari de PA (Chance d'Ecaflip)", { pPlus: 0.33, plus: 1, moins: 1 }],
  ["ligneAvant", "Équipable ligne avant uniquement (Cape Edepee)", true],
  ["riposteAvant", "Riposte si ligne avant (Sabre Shodanwa)", 0.33],
  ["esquiveArriere", "Esquive bonus ligne arrière (Baguette Rikiki)", 0.10],
  ["soinDegatsRecus", "Soin sur dégâts subis (Goyave)", 0.02],
  ["changeLigne", "Sort « Changer de ligne » (Dagues Eurfolles)", 1],
  ["perceResistances", "L'arme perce les résistances (Dagues Aj'Deh'La)", 0.5],
  ["frappeDerriere", "L'arme touche aussi derrière (Masse Aj Taye)", true],
  ["prospParPvManquant", "Prospection par PV manquant (Caskoffre)", 0.2],
  ["multKamas", "Multiplicateur de kamas (Ann'or)", 1.2],
  ["bouclierDebut", "Bouclier de départ (Bonnet Spairance)", 0.15],
  ["poisonArme", "L'arme empoisonne (Scalpel de Bworknroll)", { degats: 3, duree: 2 }],
  ["soinAllieBlesse", "L'arme soigne l'allié le plus blessé (Corailleur)", 0.2],
  ["retraitPA", "L'arme retire des PA (Arc des Rivages)", 1],
  ["elementLibre", "Élément de frappe libre (Kwakwaffe)", true],
  ["renaissance", "Renaissance 1×/combat (Kwakwanneau)", 0.3],
];

function grilleRaretes(item) {
  item.tiers ??= { commun: { stats: {} } };
  const lignes = [];
  const cellule = (rarete, lire, ecrire) => {
    const t = item.tiers[rarete];
    if (!t) return el("td", {}, "—");
    return el("td", {}, el("input", { type: "number", step: "any", value: lire(t) ?? "",
      oninput: (ev) => { ecrire(t, ev.target.value === "" ? undefined : Number(ev.target.value)); sauverBrouillon(); } }));
  };
  const ligne = (libelle, lire, ecrire) =>
    el("tr", {}, el("td", {}, libelle), ...RARETES_ED.map((r) => cellule(r, lire, ecrire)));
  for (const s of STATS_ED)
    lignes.push(ligne(s, (t) => t.stats?.[s], (t, v) => { t.stats ??= {}; if (v === undefined) delete t.stats[s]; else t.stats[s] = v; }));
  lignes.push(ligne("adaptatif", (t) => t.adaptatif, (t, v) => { if (v === undefined) delete t.adaptatif; else t.adaptatif = v; }));
  for (const e of ELEMENTS_ED)
    lignes.push(ligne(`résist. ${e}`, (t) => t.resistances?.[e], (t, v) => { t.resistances ??= {}; if (v === undefined) delete t.resistances[e]; else t.resistances[e] = v; }));
  lignes.push(ligne("PA bonus", (t) => t.pa, (t, v) => { if (v === undefined) delete t.pa; else t.pa = v; }));
  if (item.slot === "arme")
    for (const [cle, lib] of [["coutPA", "arme : coût PA"], ["baseMin", "arme : min"], ["baseMax", "arme : max"], ["scaling", "arme : scaling"]])
      lignes.push(ligne(lib, (t) => t.attaque?.[cle], (t, v) => { t.attaque ??= { coutPA: 3, baseMin: 1, baseMax: 2, scaling: 0.3 }; t.attaque[cle] = v; }));
  return el("table", { class: "raretes" },
    el("tr", {}, el("th", {}, "Stat"), ...RARETES_ED.map((r) =>
      el("th", { class: `r-${r}` }, r, " ", el("input", { type: "checkbox", checked: !!item.tiers[r],
        disabled: item.tiers[r] && Object.keys(item.tiers).length === 1,
        title: item.tiers[r] && Object.keys(item.tiers).length === 1 ? "Au moins un palier requis" : "Ce palier existe",
        onchange: (ev) => { if (ev.target.checked) item.tiers[r] = structuredClone(item.tiers.commun ?? { stats: {} }); else delete item.tiers[r]; sauverBrouillon(); rendre(); } })))),
    ...lignes);
}

function blocSpeciaux(item) {
  const actifs = SPECIAUX.filter(([cle]) => item[cle] !== undefined);
  const dispo = SPECIAUX.filter(([cle]) => item[cle] === undefined);
  return el("div", {},
    ...actifs.map(([cle, lib, defaut]) => el("div", { class: "champ" },
      el("label", {}, lib),
      el("div", {},
        typeof defaut === "number"
          ? el("input", { type: "number", step: "any", value: item[cle], oninput: (ev) => { item[cle] = Number(ev.target.value); sauverBrouillon(); } })
          : typeof defaut === "object"
            ? el("span", {}, ...Object.keys(defaut).map((k) => el("input", { type: "number", step: "any", value: item[cle][k], title: k, style: "width:70px;margin-right:4px", oninput: (ev) => { item[cle][k] = Number(ev.target.value); sauverBrouillon(); } })))
            : el("span", { class: "badge" }, "actif"),
        el("button", { onclick: () => { delete item[cle]; sauverBrouillon(); rendre(); } }, "✕")))),
    dispo.length ? el("div", { class: "champ" }, el("label", {}, "Ajouter un spécial"),
      el("select", { onchange: (ev) => { const [cle, , defaut] = SPECIAUX.find(([c]) => c === ev.target.value); item[cle] = structuredClone(defaut); sauverBrouillon(); rendre(); } },
        el("option", { value: "" }, "— choisir —"),
        ...dispo.map(([cle, lib]) => el("option", { value: cle }, lib)))) : null);
}

function pouleDeItem(id) { // toile ↔ pools de butin
  for (const [toile, p] of Object.entries(C.butin_toiles))
    for (const src of ["normales", "elites", "boss"])
      if (p[src].includes(id)) return { toile, src };
  return null;
}

enregistrerCategorie("items", "Items", {
  liste() {
    const parToile = {};
    for (const it of Object.values(C.items)) {
      if (!filtre(it.nom + it.id)) continue;
      const p = pouleDeItem(it.id);
      (parToile[p?.toile ?? "hors pool"] ??= []).push(it);
    }
    const lignes = [];
    for (const toile of Object.keys(parToile).sort((a, b) => (+a || 99) - (+b || 99))) {
      lignes.push(el("div", { class: "groupe" }, toile === "hors pool" ? "Hors pool (injoignable !)" : `Toile ${toile}`));
      for (const it of parToile[toile]) lignes.push(ligneListe(it.id, `${it.nom} · ${it.slot}`, vignetteAsset(`items/${it.id}.png`)));
    }
    lignes.push(el("button", { class: "ligne", onclick: () => {
      const id = creerEntite("items", "nouvel objet", (nid) => ({ id: nid, nom: "Nouvel objet", slot: "anneau", tiers: { commun: { stats: {} } } }));
      C.butin_toiles["1"].normales.push(id); // pool par défaut, modifiable dans la fiche
      sauverBrouillon();
    } }, "＋ Nouvel objet"));
    return lignes;
  },
  fiche(id) {
    const it = C.items[id]; if (!it) return [];
    const p = pouleDeItem(id);
    return [
      el("h2", {}, vignetteAsset(`items/${id}.png`, "apercu"), " ", it.nom, " ", el("span", { class: "note" }, id)),
      el("div", { class: "section" }, "Identité"),
      champNom("items", id, (ancien, nouveau) => {
        for (const bp of Object.values(C.butin_toiles))
          for (const s of ["normales", "elites", "boss"])
            bp[s] = bp[s].map((x) => (x === ancien ? nouveau : x));
      }),
      champSelect(it, "slot", "Slot", SLOTS_ED),
      el("div", { class: "champ" }, el("label", {}, "Toile / source de drop"),
        el("span", {},
          el("select", { onchange: (ev) => { deplacerItem(id, ev.target.value, p?.src ?? "normales"); } },
            ...Object.keys(C.butin_toiles).map((t) => el("option", { value: t, selected: p?.toile === t }, `Toile ${t}`))),
          " ",
          el("select", { onchange: (ev) => { deplacerItem(id, p?.toile ?? "1", ev.target.value); } },
            ...[["normales", "Normal"], ["elites", "Élite"], ["boss", "Boss (donjon)"]].map(([v, l]) => el("option", { value: v, selected: p?.src === v }, l))))),
      el("div", { class: "section" }, "Stats par rareté"),
      grilleRaretes(it),
      el("div", { class: "section" }, "Mécaniques spéciales"),
      blocSpeciaux(it),
      el("div", { class: "boutons" },
        el("button", { onclick: () => { const nid = idDepuisNom(it.nom + " copie", C.items); C.items[nid] = structuredClone(it); C.items[nid].id = nid; C.items[nid].nom += " (copie)"; if (p) C.butin_toiles[p.toile][p.src].push(nid); E.nouveaux.push(`items:${nid}`); E.selection = nid; E.focusNom = true; sauverBrouillon(); rendre(); } }, "Dupliquer"),
        el("button", { class: "danger", onclick: () => { if (!confirm(`Supprimer ${it.nom} ?`)) return; delete C.items[id]; for (const bp of Object.values(C.butin_toiles)) for (const s of ["normales", "elites", "boss"]) bp[s] = bp[s].filter((x) => x !== id); E.selection = null; sauverBrouillon(); rendre(); } }, "Supprimer")),
    ];
  },
});

function deplacerItem(id, toile, src) {
  for (const bp of Object.values(C.butin_toiles))
    for (const s of ["normales", "elites", "boss"]) bp[s] = bp[s].filter((x) => x !== id);
  (C.butin_toiles[toile] ??= { normales: [], elites: [], boss: [] })[src].push(id);
  sauverBrouillon(); rendre();
}
