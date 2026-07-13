function zoneDeCombat(id) {
  for (const [zone, p] of Object.entries(C.zones_pools)) {
    if (p.normales.includes(id)) return { zone, pool: "normales" };
    if ((p.elite ?? []).includes(id)) return { zone, pool: "elite" };
    if (p.boss === id) return { zone, pool: "boss" };
  }
  return null;
}

enregistrerCategorie("rencontres", "Rencontres", {
  liste() {
    const lignes = [];
    for (const zone of Object.keys(C.zones_pools)) {
      const ids = Object.keys(C.combats).filter((id) => zoneDeCombat(id)?.zone === zone && filtre(C.combats[id].nom + id));
      if (!ids.length) continue;
      lignes.push(el("div", { class: "groupe" }, zone));
      for (const id of ids) {
        const p = zoneDeCombat(id).pool;
        lignes.push(ligneListe(id, `${C.combats[id].nom}${p === "boss" ? " 👑" : p === "elite" ? " ★" : ""}`));
      }
    }
    const orphelins = Object.keys(C.combats).filter((id) => !zoneDeCombat(id) && filtre(C.combats[id].nom + id));
    if (orphelins.length) {
      lignes.push(el("div", { class: "groupe" }, "Hors zone (injoignables !)"));
      for (const id of orphelins) lignes.push(ligneListe(id, C.combats[id].nom));
    }
    lignes.push(el("button", { class: "ligne", onclick: () => {
      const nom = prompt("Nom de la rencontre :"); if (!nom) return;
      const id = idDepuisNom(nom, C.combats);
      C.combats[id] = { nom, ennemis: [{ monstre: Object.keys(C.monstres)[0], position: 0 }] };
      C.zones_pools[Object.keys(C.zones_pools)[0]].normales.push(id);
      E.selection = id; sauverBrouillon(); rendre();
    } }, "＋ Nouvelle rencontre"));
    return lignes;
  },
  fiche(id) {
    const c = C.combats[id]; if (!c) return [];
    const z = zoneDeCombat(id);
    const cellule = (pos) => {
      const occupant = c.ennemis.find((e) => e.position === pos);
      return el("select", { onchange: (ev) => {
        c.ennemis = c.ennemis.filter((e) => e.position !== pos);
        if (ev.target.value) c.ennemis.push({ monstre: ev.target.value, position: pos });
        sauverBrouillon();
      } },
        el("option", { value: "" }, `${pos} — vide`),
        ...Object.values(C.monstres).map((m) => el("option", { value: m.id, selected: occupant?.monstre === m.id }, m.nom)));
    };
    return [
      el("h2", {}, c.nom, " ", el("span", { class: "note" }, id)),
      champTexte(c, "nom", "Nom"),
      el("div", { class: "champ" }, el("label", {}, "Zone / pool"),
        el("span", {},
          el("select", { onchange: (ev) => deplacerCombat(id, ev.target.value, z?.pool ?? "normales") },
            ...Object.keys(C.zones_pools).map((zid) => el("option", { value: zid, selected: z?.zone === zid }, zid))),
          " ",
          el("select", { onchange: (ev) => deplacerCombat(id, z?.zone ?? Object.keys(C.zones_pools)[0], ev.target.value) },
            ...[["normales", "Normal"], ["elite", "Élite"], ["boss", "Boss (donjon)"]].map(([v, l]) => el("option", { value: v, selected: z?.pool === v }, l))))),
      el("div", { class: "section" }, "Ligne AVANT (positions 0-3)"),
      el("div", { class: "grille-place" }, ...[0, 1, 2, 3].map(cellule)),
      el("div", { class: "section" }, "Ligne ARRIÈRE (positions 4-7)"),
      el("div", { class: "grille-place" }, ...[4, 5, 6, 7].map(cellule)),
      el("p", { class: "note" }, "Rappel : les sorts « ligne » ne touchent que la ligne avant tant qu'elle est vivante ; un tireur en 4-7 est protégé."),
      el("div", { class: "boutons" },
        el("button", { class: "danger", onclick: () => { if (!confirm(`Supprimer ${c.nom} ?`)) return; delete C.combats[id]; for (const p of Object.values(C.zones_pools)) { p.normales = p.normales.filter((x) => x !== id); p.elite = (p.elite ?? []).filter((x) => x !== id); if (p.boss === id) p.boss = ""; } E.selection = null; sauverBrouillon(); rendre(); } }, "Supprimer")),
    ];
  },
});

function deplacerCombat(id, zone, pool) {
  for (const p of Object.values(C.zones_pools)) {
    p.normales = p.normales.filter((x) => x !== id);
    p.elite = (p.elite ?? []).filter((x) => x !== id);
    if (p.boss === id) p.boss = "";
  }
  const p = C.zones_pools[zone];
  if (pool === "boss") p.boss = id; else p[pool].push(id);
  sauverBrouillon(); rendre();
}
