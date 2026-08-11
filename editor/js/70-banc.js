// Banc d'essai : mesure les sorts d'une classe avec le VRAI moteur (inliné au
// build) et le contenu EN COURS D'ÉDITION. Ce module ne calcule rien lui-même —
// toute la logique vit dans src/banc.ts, testée par Vitest.
const BANC = {
  classeId: null, niveau: 50, toile: 1, equipement: "set", rarete: "commun",
  mannequins: [{ position: 0 }, { position: 1 }, { position: 4 }],
  resistances: {},
  // `paDispo: 0` = barre pleine (le maximum des sorts qui lisent les PA
  // disponibles) ; `lance: ""` = aucune Lance plantée.
  cond: { chausseTrappe: 0, telefrags: 0, portails: 0, bombes: 0, rage: 0, paDispo: 0, lance: "" },
  // Surcharge d'équipement : { slot -> id d'objet }, PAS un ItemInstance figé —
  // sinon un objet choisi une fois garderait des stats périmées si le designer
  // les modifie ensuite dans l'onglet « Items ». L'ItemInstance réel est
  // reconstruit à CHAQUE mesure (voir `construireSurcharges`) en relisant `C.items`.
  surcharges: {},
};

/** Reconstruit les ItemInstance de surcharge à partir de `BANC.surcharges` (de
 *  simples ids d'objets).
 *
 *  L'exemplaire est fabriqué par `instanceDuTier` — la fabrique du JEU, exposée
 *  par la façade — et jamais assemblé champ par champ ici : une seconde façon de
 *  bâtir un objet équipé divergerait de la vraie. `instanceDuTier` lit la table
 *  `ITEMS` du moteur, que `mesurerKit` vient de remplacer par `C.items` ; comme
 *  rien n'est mis en cache, une modification faite dans l'onglet « Items » est
 *  prise en compte dès la mesure suivante.
 *
 *  Repli sur le palier « commun » si l'objet n'a pas de palier pour la rareté
 *  couramment choisie (`BANC.rarete`) : `instanceDuTier` rend `null` dans ce cas,
 *  et mesurer sans l'objet serait plus trompeur que le mesurer un cran plus bas —
 *  même repli que `construireHerosDetaille` (src/banc.ts) pour l'équipement
 *  pré-réglé. */
function construireSurcharges() {
  const M = window.MoteurBanc;
  const surcharges = {};
  for (const [slot, id] of Object.entries(BANC.surcharges)) {
    if (!C.items[id]) continue;
    const inst = M.instanceDuTier(id, BANC.rarete) ?? M.instanceDuTier(id, "commun");
    if (inst) surcharges[slot] = inst;
  }
  return surcharges;
}

/** Réglages conditionnels passés au moteur : les compteurs, plus les deux
 *  réglages qui ne sont pas des compteurs (`paDispo`, `lance`). Un `0` ou une
 *  chaîne vide signifie « pas de réglage » et n'est pas transmis, pour que le
 *  moteur applique son défaut documenté (barre pleine, aucune Lance). */
function conditionnels() {
  const c = { ...BANC.cond };
  if (!c.paDispo) delete c.paDispo;
  if (!c.lance) delete c.lance;
  return c;
}

/** Pousse le contenu édité dans le moteur, puis mesure les sorts de dégâts. */
function mesurerKit() {
  const M = window.MoteurBanc;
  M.appliquerContenuEdite({
    sorts: C.sorts, classes: C.classes, monstres: C.monstres, items: C.items,
    // `butin_toiles` fait partie du contenu ÉDITABLE : l'onglet « Items »
    // permet de déplacer un objet d'une toile à l'autre, et c'est cette table
    // que `construireHerosDetaille` consulte pour équiper le héros. Sans elle,
    // le banc équiperait le butin LIVRÉ et mesurerait donc l'objet que le
    // designer vient précisément de ranger ailleurs.
    butin_toiles: C.butin_toiles,
  });
  const classeId = BANC.classeId ?? Object.keys(C.classes)[0];
  const { heros, slotsEquipes } = M.construireHerosDetaille({
    classeId, niveau: BANC.niveau, toile: BANC.toile,
    equipement: BANC.equipement, rarete: BANC.rarete,
    surcharges: construireSurcharges(),
  });
  const specs = BANC.mannequins.map((m) => ({ ...m, resistances: BANC.resistances }));
  const cond = conditionnels();
  const lignes = C.classes[classeId].sorts
    .map((id) => C.sorts[id])
    .filter((s) => s && s.type === "degats")
    .map((s) => {
      const cibles = M.construireMannequins(specs);
      const lancer = M.mesurerLancer(heros, s.id, cibles, cond);
      const tour = M.mesurerTour(heros, s.id, M.construireMannequins(specs), cond);
      // le diviseur du « par PA » est le coût EFFECTIF remonté par le moteur,
      // jamais `s.coutPA` : une seconde source de vérité finirait par diverger
      // (et diviserait par zéro pour un sort de dégâts à 0 PA).
      return { sort: s, lancer, tour, parPA: lancer.lancable && lancer.cout > 0 ? lancer.moyenne / lancer.cout : null };
    });
  // `paMax` remonte avec la mesure : c'est la borne du champ « PA disponibles »,
  // et contrairement aux cinq compteurs elle n'est PAS une constante du moteur —
  // elle dépend du héros courant (classe, niveau, équipement).
  return { lignes, slotsEquipes, paMax: heros.paMax };
}

// Pièces attendues par état d'équipement, pour confronter le réglage à la réalité.
const PIECES_ATTENDUES = { nu: 0, mi: 2, set: 4 };

/** Ce que le héros PORTE vraiment, comparé au réglage. Une toile sans objets (les
 *  douze de la Tranche 2) rend un héros nu alors que le réglage annonce « Set
 *  complet », et les colonnes NU/MI/SET y sont identiques sans que rien ne le
 *  dise : le désaccord doit donc être ÉCRIT, pas déduit. */
function noteEquipement(slotsEquipes, toile, attendu) {
  if (slotsEquipes.length === attendu)
    return `${slotsEquipes.length} pièce(s) équipée(s)${slotsEquipes.length ? " : " + slotsEquipes.join(", ") : ""}`;
  if (slotsEquipes.length === 0)
    return `⚠ aucun objet à la toile ${toile} : le héros est NU malgré le réglage`;
  return `⚠ ${slotsEquipes.length} pièce(s) sur ${attendu} à la toile ${toile} (${slotsEquipes.join(", ")})`;
}

/** Libellé de ce qui manque au chiffre affiché — il dit POURQUOI, jamais juste
 *  « incomplet » : un designer qui lit « les pièges du Sram font 0 » les gonfle. */
const RAISONS = {
  poison: "poison non compté (dégâts différés)",
  piege: "0 à la pose : le piège ne frappe qu'au déclenchement",
  bombe: "0 à la pose : la bombe ne frappe qu'au Kaboom",
  lance_absente: "sans Lance plantée : la zone de Lance n'est pas mesurée",
};

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

    const { lignes: mesures, slotsEquipes, paMax } = mesurerKit();
    const lignes = mesures.map(({ sort, lancer, tour, parPA }) =>
      el("tr", {},
        el("td", {}, vignetteAsset(`spells/${BANC.classeId}/${sort.id}.png`) ?? el("span", {}, "")),
        el("td", {}, `${sort.nom} (${sort.coutPA} PA)`),
        el("td", {}, lancer.lancable ? `${lancer.moyenne}` : "non lançable"),
        el("td", {}, lancer.lancable ? `${lancer.min}–${lancer.max}` : "—"),
        el("td", {}, parPA === null ? "—" : parPA.toFixed(1)),
        el("td", {}, `${tour.total} (×${tour.lancers})`),
        el("td", { class: "note" }, lancer.raisons.map((r) => RAISONS[r] ?? r).join(" · "))));

    const equipementNote = noteEquipement(slotsEquipes, BANC.toile, PIECES_ATTENDUES[BANC.equipement]);

    const curseur = (cle, libelle, min, max) => el("div", { class: "champ" },
      el("label", {}, libelle),
      el("input", { type: "range", min, max, value: BANC[cle],
        oninput: (ev) => { BANC[cle] = Number(ev.target.value); rendre(); } }),
      el("span", { class: "badge" }, String(BANC[cle])));

    // Les compteurs sont BORNÉS aux plafonds du moteur (`MAX_COMPTEURS`, servis
    // par la façade — jamais des nombres recopiés ici) : `multPortails` et
    // `bonusParTelefrag` ne plafonnent qu'à la POSE, pas à la lecture, donc une
    // saisie libre à 50 afficherait un chiffre inatteignable en partie. La
    // valeur STOCKÉE est écrêtée, pas seulement l'attribut `max` : sinon le
    // champ montrerait 50 pendant que la mesure, elle, s'arrête au plafond.
    const compteur = (cle, libelle) => {
      const max = window.MoteurBanc.MAX_COMPTEURS[cle];
      return el("div", { class: "champ" },
        el("label", {}, `${libelle} (max ${max})`),
        el("input", { type: "number", min: 0, max, value: BANC.cond[cle],
          oninput: (ev) => {
            BANC.cond[cle] = Math.max(0, Math.min(max, Number(ev.target.value || 0)));
            rendre();
          } }));
    };

    const menuCond = (cle, libelle, options) =>
      el("div", { class: "champ" }, el("label", {}, libelle),
        el("select", { onchange: (ev) => { BANC.cond[cle] = ev.target.value; rendre(); } },
          ...options.map(([v, lib]) => el("option", { value: v, selected: BANC.cond[cle] === v }, lib))));

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
      // La barre de PA du tour. 0 = pleine, c'est-à-dire le MAXIMUM de Zénith et
      // de la Flèche Punitive — sans ce réglage, ces deux sorts étaient toujours
      // lus à leur plus haut. Écrêtée à `paMax` comme les cinq compteurs le sont
      // à leur plafond, et pour la même raison : `bonusParPADispo` n'a aucun
      // plafond de LECTURE, une saisie libre rendrait un chiffre inatteignable.
      // La borne n'est pas une constante du moteur, elle dépend du héros courant.
      el("div", { class: "champ" },
        el("label", {}, `PA disponibles (0 = barre pleine, max ${paMax})`),
        el("input", { type: "number", min: 0, max: paMax, value: BANC.cond.paDispo,
          oninput: (ev) => {
            BANC.cond.paDispo = Math.max(0, Math.min(paMax, Number(ev.target.value || 0)));
            rendre();
          } })),
      menuCond("lance", "Lance plantée (Forgelance)",
        [["", "aucune"], ["avant", "rangée avant"], ["arriere", "rangée arrière"]]),
      el("div", { class: "section" }, "Mesure"),
      el("p", { class: "note" }, equipementNote),
      el("table", { class: "raretes" },
        el("tr", {}, ...["", "Sort", "Un lancer", "Min–max", "Par PA", "Sur un tour", "Ce que le chiffre ne dit pas"].map((t) => el("th", {}, t))),
        ...lignes),
    ];
  },
});
