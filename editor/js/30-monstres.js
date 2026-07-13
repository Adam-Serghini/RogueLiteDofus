function ajouterAssetDofusDB(fichier, url) {
  E.assets = E.assets.filter((a) => a.fichier !== fichier);
  E.assets.push({ fichier, url });
  sauverBrouillon();
}

async function chercherSpriteDofusDB(monstre) {
  const nom = prompt("Nom EXACT du monstre sur DofusDB (ou un gfxId numérique) :", monstre.nom);
  if (!nom) return;
  try {
    let gfxId = /^\d+$/.test(nom) ? Number(nom) : null;
    if (gfxId === null) {
      const r = await fetch(`https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(nom)}`);
      const j = await r.json();
      if (!j.data?.[0]) { alert(`« ${nom} » introuvable sur DofusDB.`); return; }
      gfxId = j.data[0].gfxId ?? j.data[0].id;
    }
    monstre.img = `/assets/monstres/${monstre.id}.png`;
    ajouterAssetDofusDB(`monstres/${monstre.id}.png`, `https://api.dofusdb.fr/img/monsters/${gfxId}.png`);
    rendre();
  } catch (e) {
    alert("Recherche impossible (hors ligne ?). Tu peux coller directement un gfxId numérique. " + e.message);
  }
}

enregistrerCategorie("monstres", "Monstres", {
  liste() {
    const lignes = Object.values(C.monstres).filter((m) => filtre(m.nom + m.id))
      .map((m) => ligneListe(m.id, `${m.nom}${m.boss ? " 👑" : ""} · ${m.pv} PV`, vignetteAsset(`monstres/${m.id}.png`)));
    lignes.push(el("button", { class: "ligne", onclick: () => {
      creerEntite("monstres", "nouveau monstre", (nid) => ({ id: nid, nom: "Nouveau monstre", pv: 20, stats: { force: 5, intelligence: 5, agilite: 5, vitalite: 5 }, pa: 4, initiative: 8, resistances: {}, sorts: ["morsure"], ia: "agressif" }));
    } }, "＋ Nouveau monstre"));
    return lignes;
  },
  fiche(id) {
    const m = C.monstres[id]; if (!m) return [];
    // priorité : sprite DofusDB en attente d'import (E.assets) > asset du repo embarqué au build
    const apercu = E.assets.find((a) => a.fichier === `monstres/${id}.png`)?.url
      ?? ASSETS_LOCAUX[`monstres/${id}.png`];
    return [
      el("h2", {}, vignetteAsset(`monstres/${id}.png`), " ", m.nom, " ", el("span", { class: "note" }, id)),
      el("div", { class: "section" }, "Identité"),
      champNom("monstres", id, (ancien, nouveau) => {
        for (const c of Object.values(C.combats))
          for (const e of c.ennemis) if (e.monstre === ancien) e.monstre = nouveau;
        for (const s of Object.values(C.sorts))
          if (s.invoqueMonstre) s.invoqueMonstre.pool = s.invoqueMonstre.pool.map((x) => (x === ancien ? nouveau : x));
        E.assets = E.assets.map((a) => (a.fichier === `monstres/${ancien}.png` ? { ...a, fichier: `monstres/${nouveau}.png` } : a));
        const m2 = C.monstres[nouveau];
        if (m2.img === `/assets/monstres/${ancien}.png`) m2.img = `/assets/monstres/${nouveau}.png`;
      }),
      el("div", { class: "champ" }, el("label", {}, "Image"),
        el("span", {}, apercu ? el("img", { class: "apercu", src: apercu }) : el("span", { class: "note" }, m.img ?? "aucune"), " ",
          el("button", { onclick: () => chercherSpriteDofusDB(m) }, "Chercher sur DofusDB…"))),
      champTexte(m, "archiNom", "Nom d'Archimonstre (vide = non capturable)"),
      el("div", { class: "champ" }, el("label", {}, "Boss"),
        el("input", { type: "checkbox", checked: !!m.boss, onchange: (ev) => { if (ev.target.checked) m.boss = true; else delete m.boss; sauverBrouillon(); } })),
      champSelect(m, "ia", "IA", [["agressif", "Agressif"], ["soutien", "Soutien"]]),
      el("div", { class: "section" }, "Stats"),
      champNombre(m, "pv", "PV"), champNombre(m, "pa", "PA"), champNombre(m, "initiative", "Initiative"),
      ...["force", "intelligence", "agilite", "vitalite", "chance"].map((s) => champNombre(m.stats, s, s, { optionnel: s === "chance" })),
      el("div", { class: "section" }, "Résistances (−1 à 1 ; négatif = faiblesse)"),
      ...["terre", "feu", "eau", "air"].map((e) => champNombre(m.resistances, e, e, { optionnel: true, step: 0.05 })),
      el("div", { class: "section" }, "Sorts"),
      ...m.sorts.map((sId, i) => el("div", { class: "champ" }, el("label", {}, `Sort ${i + 1}`),
        el("span", {},
          el("select", { onchange: (ev) => { m.sorts[i] = ev.target.value; sauverBrouillon(); rendre(); } },
            ...Object.values(C.sorts).map((s) => el("option", { value: s.id, selected: s.id === sId }, `${s.nom} (${s.coutPA} PA, ${s.baseMin}-${s.baseMax})`))),
          " ", el("button", { onclick: () => { m.sorts.splice(i, 1); sauverBrouillon(); rendre(); } }, "✕")))),
      el("div", { class: "boutons" },
        el("button", { onclick: () => { m.sorts.push(Object.keys(C.sorts)[0]); sauverBrouillon(); rendre(); } }, "＋ Ajouter un sort"),
        el("button", { onclick: () => { const nid = idDepuisNom(m.nom + " copie", C.monstres); C.monstres[nid] = structuredClone(m); C.monstres[nid].id = nid; C.monstres[nid].nom += " (copie)"; delete C.monstres[nid].img; E.nouveaux.push(`monstres:${nid}`); E.selection = nid; E.focusNom = true; sauverBrouillon(); rendre(); } }, "Dupliquer"),
        el("button", { class: "danger", onclick: () => { if (!confirm(`Supprimer ${m.nom} ? (refusé à l'import s'il est utilisé dans une rencontre)`)) return; delete C.monstres[id]; E.selection = null; sauverBrouillon(); rendre(); } }, "Supprimer")),
    ];
  },
});
