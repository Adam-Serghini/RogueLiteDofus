// Banc d'essai : mesure les sorts d'une classe avec le VRAI moteur (inliné au
// build) et le contenu EN COURS D'ÉDITION. Ce module ne calcule rien lui-même —
// toute la logique vit dans src/banc.ts, testée par Vitest.
const BANC = {
  classeId: null, niveau: 50, toile: 1, equipement: "set", rarete: "commun",
  mannequins: [{ position: 0 }, { position: 1 }, { position: 4 }],
  resistances: {},
  cond: { chausseTrappe: 0, telefrags: 0, portails: 0, bombes: 0, rage: 0 },
  // Surcharge d'équipement : { slot -> id d'objet }, PAS un ItemInstance figé —
  // sinon un objet choisi une fois garderait des stats périmées si le designer
  // les modifie ensuite dans l'onglet « Items ». L'ItemInstance réel est
  // reconstruit à CHAQUE mesure (voir `construireSurcharges`) en relisant `C.items`.
  surcharges: {},
};

/** Reconstruit les ItemInstance de surcharge à partir de `BANC.surcharges`
 *  (de simples ids) et de `C.items` TEL QU'IL EST MAINTENANT — jamais mis en
 *  cache, pour que le banc suive une modification faite dans l'onglet « Items ».
 *  Repli sur le palier « commun » si l'objet n'a pas de palier pour la rareté
 *  couramment choisie (`BANC.rarete`) : mieux qu'un ItemInstance aux stats
 *  `undefined`, qui fausserait silencieusement la mesure — même repli que
 *  `construireHeros` (src/banc.ts) pour l'équipement pré-réglé. */
function construireSurcharges() {
  const surcharges = {};
  for (const [slot, id] of Object.entries(BANC.surcharges)) {
    const item = C.items[id];
    if (!item) continue;
    const rarete = item.tiers?.[BANC.rarete] ? BANC.rarete : "commun";
    const tier = item.tiers?.[rarete];
    if (!tier) continue;
    surcharges[slot] = { id, rarete, stats: { ...tier.stats },
      adaptatif: tier.adaptatif, resistances: tier.resistances, pa: tier.pa };
  }
  return surcharges;
}

/** Pousse le contenu édité dans le moteur, puis mesure les sorts de dégâts. */
function mesurerKit() {
  const M = window.MoteurBanc;
  M.appliquerContenuEdite({
    sorts: C.sorts, classes: C.classes, monstres: C.monstres, items: C.items,
  });
  const classeId = BANC.classeId ?? Object.keys(C.classes)[0];
  const heros = M.construireHeros({
    classeId, niveau: BANC.niveau, toile: BANC.toile,
    equipement: BANC.equipement, rarete: BANC.rarete,
    surcharges: construireSurcharges(),
  });
  const specs = BANC.mannequins.map((m) => ({ ...m, resistances: BANC.resistances }));
  return C.classes[classeId].sorts
    .map((id) => C.sorts[id])
    .filter((s) => s && s.type === "degats")
    .map((s) => {
      const cibles = M.construireMannequins(specs);
      const lancer = M.mesurerLancer(heros, s.id, cibles, BANC.cond);
      const tour = M.mesurerTour(heros, s.id, M.construireMannequins(specs), BANC.cond);
      return { sort: s, lancer, tour, parPA: lancer.lancable ? lancer.moyenne / s.coutPA : 0 };
    });
}

/** Menu déroulant d'un réglage du BANC.
 *  N'UTILISE PAS `champSelect` : celui-ci appelle `sauverBrouillon()`, qui lève
 *  le drapeau « modifications non exportées » et arme l'avertissement de
 *  fermeture. Or régler le banc ne modifie AUCUN contenu — le designer croirait
 *  avoir du travail à exporter alors qu'il n'a fait que regarder des chiffres. */
function menuBanc(cle, libelle, options) {
  return el("div", { class: "champ" }, el("label", {}, libelle),
    el("select", { onchange: (ev) => { BANC[cle] = ev.target.value; rendre(); } },
      ...options.map(([v, lib]) => el("option", { value: v, selected: BANC[cle] === v }, lib))));
}

enregistrerCategorie("banc", "Banc d'essai", {
  sansSelection: true,
  liste() {
    return Object.values(C.classes).map((cl) =>
      ligneListe(cl.id, `${cl.nom} · niv. ${BANC.niveau}`, vignetteAsset(`classes/${cl.id}.png`, "vignette vignette-classe")));
  },
  fiche() {
    BANC.classeId = E.selection ?? Object.keys(C.classes)[0];

    if (!BANC.mannequins.length)
      return [el("h2", {}, "Banc d'essai"), el("p", { class: "note" }, "Place au moins un mannequin pour mesurer.")];

    const lignes = mesurerKit().map(({ sort, lancer, tour, parPA }) =>
      el("tr", {},
        el("td", {}, vignetteAsset(`spells/${BANC.classeId}/${sort.id}.png`) ?? el("span", {}, "")),
        el("td", {}, `${sort.nom} (${sort.coutPA} PA)`),
        el("td", {}, lancer.lancable ? `${lancer.moyenne}` : "non lançable"),
        el("td", {}, lancer.lancable ? `${lancer.min}–${lancer.max}` : "—"),
        el("td", {}, lancer.lancable ? parPA.toFixed(1) : "—"),
        el("td", {}, `${tour.total} (×${tour.lancers})`),
        el("td", { class: "note" }, lancer.horsPoison ? "poison non compté" : "")));

    const curseur = (cle, libelle, min, max) => el("div", { class: "champ" },
      el("label", {}, libelle),
      el("input", { type: "range", min, max, value: BANC[cle],
        oninput: (ev) => { BANC[cle] = Number(ev.target.value); rendre(); } }),
      el("span", { class: "badge" }, String(BANC[cle])));

    const compteur = (cle, libelle) => el("div", { class: "champ" },
      el("label", {}, libelle),
      el("input", { type: "number", min: 0, value: BANC.cond[cle],
        oninput: (ev) => { BANC.cond[cle] = Number(ev.target.value || 0); rendre(); } }));

    return [
      el("h2", {}, `Banc d'essai — ${C.classes[BANC.classeId].nom}`),
      el("p", { class: "note" }, `Mesuré en lançant réellement le moteur ${window.MoteurBanc.REPETITIONS} fois par sort, sur les valeurs en cours d'édition.`),
      el("div", { class: "section" }, "Héros"),
      curseur("niveau", "Niveau", 1, 200),
      curseur("toile", "Toile d'équipement", 1, 24),
      menuBanc("equipement", "Équipement", [["nu", "Nu"], ["mi", "Mi (2 pièces)"], ["set", "Set complet"]]),
      menuBanc("rarete", "Rareté", [["commun", "Commun"], ["rare", "Rare"], ["epique", "Épique"], ["legendaire", "Légendaire"]]),
      el("div", { class: "section" }, "Cible"),
      el("div", { class: "champ" }, el("label", {}, "Mannequins"),
        el("div", { class: "grille-place" },
          ...[0, 1, 2, 3, 4, 5, 6, 7].map((pos) => {
            const present = BANC.mannequins.some((m) => m.position === pos);
            return el("button", { class: present ? "badge" : "note",
              title: pos < 4 ? "Rangée avant" : "Rangée arrière",
              onclick: () => {
                BANC.mannequins = present
                  ? BANC.mannequins.filter((m) => m.position !== pos)
                  : [...BANC.mannequins, { position: pos }];
                rendre();
              } }, `${pos < 4 ? "AV" : "AR"} ${pos}`);
          }))),
      ...["terre", "feu", "air", "eau"].map((elem) =>
        el("div", { class: "champ" }, el("label", {}, `Résistance ${elem}`),
          el("input", { type: "number", step: "0.05", min: -1, max: 1,
            value: BANC.resistances[elem] ?? 0,
            oninput: (ev) => { BANC.resistances[elem] = Number(ev.target.value || 0); rendre(); } }))),
      el("div", { class: "section" }, "Surcharge d'équipement (facultatif)"),
      ...["arme", "coiffe", "cape", "anneau"].map((slot) => {
        const options = [["", "— état pré-réglé —"]].concat(
          Object.values(C.items).filter((it) => it.slot === slot).map((it) => [it.id, it.nom]));
        return el("div", { class: "champ" }, el("label", {}, slot),
          el("select", { onchange: (ev) => {
            const id = ev.target.value;
            if (!id) delete BANC.surcharges[slot];
            else BANC.surcharges[slot] = id;
            rendre();
          } }, ...options.map(([v, lib]) =>
            el("option", { value: v, selected: (BANC.surcharges[slot] ?? "") === v }, lib))));
      }),
      el("div", { class: "section" }, "Compteurs conditionnels"),
      compteur("chausseTrappe", "Chausse-Trappes"),
      compteur("telefrags", "Téléfrags sur la cible"),
      compteur("portails", "Portails"),
      compteur("bombes", "Bombes sur la cible"),
      compteur("rage", "Rage"),
      el("div", { class: "section" }, "Mesure"),
      el("table", { class: "raretes" },
        el("tr", {}, ...["", "Sort", "Un lancer", "Min–max", "Par PA", "Sur un tour", ""].map((t) => el("th", {}, t))),
        ...lignes),
    ];
  },
});
