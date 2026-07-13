enregistrerCategorie("export", "Export / Import", { sansSelection: true, liste: () => [], fiche: () => panneauExport() });

function panneauExport() {
  return [
    el("h2", {}, "Exporter mes modifications"),
    el("p", {}, "Le fichier téléchargé (contenu.json) est à envoyer au dev (Discord/mail). Il contient TOUT le contenu, tes images DofusDB référencées, et la version des données d'origine."),
    el("div", { class: "boutons" }, el("button", { class: "primaire", onclick: exporter }, "⬇ Exporter contenu.json")),
    el("h2", { style: "margin-top:40px" }, "Reprendre un export précédent"),
    el("p", { class: "note" }, "Charge un contenu.json déjà exporté pour continuer le travail (il doit venir de CETTE version de l'éditeur)."),
    el("input", { type: "file", accept: ".json,application/json", onchange: reprendreExport }),
    el("h2", { style: "margin-top:40px" }, "État"),
    el("p", {}, `Version des données d'origine : ${DONNEES.baseHash.slice(0, 12)}…`),
    el("p", {}, `${E.assets.length} image(s) DofusDB à importer côté dev.`),
    el("div", { class: "boutons" },
      el("button", { class: "danger", onclick: () => { if (confirm("Abandonner TOUTES les modifications non exportées ?")) { localStorage.removeItem(CLE_BROUILLON); location.reload(); } } }, "Tout abandonner")),
  ];
}

function exporter() {
  const donnees = { schemaVersion: DONNEES.schemaVersion, baseHash: DONNEES.baseHash, contenu: C, assets: E.assets };
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "contenu.json" });
  document.body.append(a); a.click(); a.remove();
  E.modifie = false; rendre();
}

function reprendreExport(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    let x; try { x = JSON.parse(lecteur.result); } catch { alert("Fichier illisible."); return; }
    if (x.schemaVersion !== DONNEES.schemaVersion) { alert("Cet export vient d'une autre version de l'éditeur."); return; }
    if (x.baseHash !== DONNEES.baseHash && !confirm("Cet export est basé sur une AUTRE version des données. Continuer quand même ? (risque de conflits à l'import)")) return;
    Object.assign(C, x.contenu); E.assets = x.assets ?? []; E.selection = null;
    sauverBrouillon(); rendre();
  };
  lecteur.readAsText(f);
}

// ---- Boot ----
restaurerBrouillon();
rendre();
