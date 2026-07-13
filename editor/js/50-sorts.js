const CLES_TOUJOURS_LISIBLES = ["id", "nom", "type", "cible", "desc", "img"];

function champsNumeriquesRecursifs(obj, chemin = "") {
  const noeuds = [];
  for (const [k, v] of Object.entries(obj)) {
    if (CLES_TOUJOURS_LISIBLES.includes(k) && !chemin) continue;
    const ch = chemin ? `${chemin}.${k}` : k;
    if (typeof v === "number") {
      noeuds.push(el("div", { class: "champ" }, el("label", {}, ch),
        el("input", { type: "number", step: "any", value: v, oninput: (ev) => { obj[k] = Number(ev.target.value); sauverBrouillon(); } })));
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      noeuds.push(...champsNumeriquesRecursifs(v, ch));
    } else {
      noeuds.push(el("span", { class: "badge", title: ch }, `${ch}: ${JSON.stringify(v)}`));
    }
  }
  return noeuds;
}

enregistrerCategorie("sorts", "Classes & sorts", {
  liste() {
    const lignes = [];
    const dansClasse = new Set(Object.values(C.classes).flatMap((cl) => cl.sorts));
    for (const cl of Object.values(C.classes)) {
      lignes.push(el("div", { class: "groupe" }, `${cl.nom} · ${cl.pvBase} PV · ${cl.pa} PA (lecture seule)`));
      for (const sId of cl.sorts)
        if (C.sorts[sId] && filtre(C.sorts[sId].nom + sId)) lignes.push(ligneListe(sId, `${C.sorts[sId].nom} · ${C.sorts[sId].coutPA} PA`));
    }
    lignes.push(el("div", { class: "groupe" }, "Sorts de monstres / armes"));
    for (const s of Object.values(C.sorts))
      if (!dansClasse.has(s.id) && filtre(s.nom + s.id)) lignes.push(ligneListe(s.id, `${s.nom} · ${s.coutPA} PA`));
    return lignes;
  },
  fiche(id) {
    const s = C.sorts[id]; if (!s) return [];
    return [
      el("h2", {}, s.nom, " ", el("span", { class: "note" }, id)),
      el("p", { class: "note" }, s.desc ?? ""),
      el("p", {}, el("span", { class: "badge" }, s.type), " ", el("span", { class: "badge" }, s.cible)),
      el("div", { class: "section" }, "Valeurs numériques (seuls champs modifiables)"),
      ...champsNumeriquesRecursifs(s),
      el("p", { class: "note" }, "Les mécaniques (badges gris) sont codées dans le moteur : pour en changer, demander au dev."),
    ];
  },
});
