// =============================================================================
//  content-validate.mjs — Les 3 passes de validation du contenu édité.
//  validerContenu(contenu, base) → string[] d'erreurs en français (vide = OK).
//  base = contenu ACTUEL du repo (référence des passes lecture-seule).
// =============================================================================
export const NOMS_FICHIERS = ["sorts", "classes", "monstres", "combats", "zones_pools", "items", "butin_toiles"];
export const SCHEMA_VERSION = 1;

const RARETES = ["commun", "rare", "epique", "legendaire"];
const SLOTS = ["arme", "coiffe", "cape", "anneau"];
const ELEMENTS = ["terre", "feu", "eau", "air"];
const IAS = ["agressif", "soutien"];

const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
const estEntier = (v) => Number.isInteger(v);

export function validerContenu(contenu, base) {
  const err = [];
  const E = (coll, id, msg) => err.push(`[${coll}: ${id}] ${msg}`);

  for (const nom of NOMS_FICHIERS)
    if (!contenu[nom] || typeof contenu[nom] !== "object")
      err.push(`[${nom}] collection absente ou invalide`);
  if (err.length) return err; // structure de base cassée : inutile d'aller plus loin

  // ---- Passe 1 : schéma --------------------------------------------------
  for (const [id, m] of Object.entries(contenu.monstres)) {
    if (!estEntier(m.pv) || m.pv <= 0) E("monstres", id, `pv doit être un entier > 0 (reçu : ${m.pv})`);
    if (!estEntier(m.pa) || m.pa < 1 || m.pa > 12) E("monstres", id, `pa doit être un entier entre 1 et 12 (reçu : ${m.pa})`);
    if (!estNombre(m.initiative)) E("monstres", id, "initiative doit être un nombre");
    for (const k of ["force", "intelligence", "agilite", "vitalite"])
      if (!estNombre(m.stats?.[k]) || m.stats[k] < 0) E("monstres", id, `stats.${k} doit être un nombre ≥ 0`);
    for (const [el, v] of Object.entries(m.resistances ?? {})) {
      if (!ELEMENTS.includes(el)) E("monstres", id, `élément de résistance inconnu : ${el}`);
      else if (!estNombre(v) || v < -1 || v > 1) E("monstres", id, `resistances.${el} doit être entre -1 et 1`);
    }
    if (!IAS.includes(m.ia)) E("monstres", id, `ia doit être « agressif » ou « soutien » (reçu : ${m.ia})`);
    if (!Array.isArray(m.sorts) || m.sorts.length === 0 || m.sorts.some((s) => typeof s !== "string"))
      E("monstres", id, "sorts doit être une liste non vide d'identifiants de sorts");
  }

  const validerAttaque = (coll, id, a, ou) => {
    if (!estEntier(a.coutPA) || a.coutPA < 1 || a.coutPA > 12) E(coll, id, `${ou} : coutPA doit être un entier entre 1 et 12`);
    if (!estNombre(a.baseMin) || !estNombre(a.baseMax) || a.baseMin > a.baseMax)
      E(coll, id, `${ou} : baseMin doit être ≤ baseMax (reçu : ${a.baseMin}-${a.baseMax})`);
    if (!estNombre(a.scaling) || a.scaling < 0) E(coll, id, `${ou} : scaling doit être un nombre ≥ 0`);
  };

  for (const [id, it] of Object.entries(contenu.items)) {
    if (!SLOTS.includes(it.slot)) E("items", id, `slot invalide : ${it.slot} (attendu : ${SLOTS.join("/")})`);
    if (typeof it.nom !== "string" || !it.nom.trim()) E("items", id, "nom manquant");
    const tiers = it.tiers ?? {};
    for (const r of Object.keys(tiers))
      if (!RARETES.includes(r)) E("items", id, `rareté inconnue : ${r}`);
    // chaque stat présente dans plusieurs tiers doit être croissante avec la rareté
    const presentes = [...new Set(Object.values(tiers).flatMap((t) => Object.keys(t.stats ?? {})))];
    for (const stat of presentes) {
      let prec = -Infinity;
      for (const r of RARETES) {
        const v = tiers[r]?.stats?.[stat];
        if (v === undefined) continue;
        if (!estNombre(v)) { E("items", id, `tiers.${r}.stats.${stat} doit être un nombre`); continue; }
        if (v < prec) E("items", id, `stats.${stat} doit être croissante avec la rareté (${r} : ${v} < ${prec})`);
        prec = v;
      }
    }
    for (const [r, t] of Object.entries(tiers))
      if (t.attaque) validerAttaque("items", id, t.attaque, `tiers.${r}.attaque`);
    if (it.attaque) validerAttaque("items", id, it.attaque, "attaque");
  }

  for (const [id, s] of Object.entries(contenu.sorts)) {
    if (!estEntier(s.coutPA) || s.coutPA < 0) E("sorts", id, "coutPA doit être un entier ≥ 0");
    if (!estNombre(s.baseMin) || !estNombre(s.baseMax) || s.baseMin > s.baseMax)
      E("sorts", id, `baseMin doit être ≤ baseMax (reçu : ${s.baseMin}-${s.baseMax})`);
    if (!estNombre(s.scaling) || s.scaling < 0) E("sorts", id, "scaling doit être un nombre ≥ 0");
  }

  for (const [id, c] of Object.entries(contenu.combats)) {
    if (!Array.isArray(c.ennemis) || c.ennemis.length < 1 || c.ennemis.length > 8)
      E("combats", id, `il faut entre 1 et 8 ennemis (reçu : ${c.ennemis?.length ?? 0})`);
    const positions = (c.ennemis ?? []).map((e) => e.position);
    for (const p of positions)
      if (!estEntier(p) || p < 0 || p > 7) E("combats", id, `position invalide : ${p} (attendu : 0 à 7)`);
    if (new Set(positions).size !== positions.length) E("combats", id, "deux ennemis occupent la même position");
  }

  for (const [id, z] of Object.entries(contenu.zones_pools)) {
    if (!Array.isArray(z.normales) || z.normales.length === 0) E("zones_pools", id, "normales doit être une liste non vide");
    if (z.elite !== undefined && (!Array.isArray(z.elite) || !z.elite.every((e) => typeof e === "string")))
      E("zones_pools", id, "elite doit être une liste d'identifiants de combats");
    if (typeof z.boss !== "string" || !z.boss) E("zones_pools", id, "boss manquant");
  }

  // ---- Passe 2 : références croisées --------------------------------------
  for (const [id, m] of Object.entries(contenu.monstres))
    for (const s of m.sorts ?? [])
      if (!contenu.sorts[s]) E("monstres", id, `le sort « ${s} » n'existe pas`);
  for (const [id, cl] of Object.entries(contenu.classes))
    for (const s of cl.sorts ?? [])
      if (!contenu.sorts[s]) E("classes", id, `le sort « ${s} » n'existe pas`);
  for (const [id, s] of Object.entries(contenu.sorts))
    for (const mId of s.invoqueMonstre?.pool ?? [])
      if (!contenu.monstres[mId]) E("sorts", id, `invoqueMonstre : le monstre « ${mId} » n'existe pas`);
  for (const [id, c] of Object.entries(contenu.combats))
    for (const e of c.ennemis ?? [])
      if (!contenu.monstres[e.monstre]) E("combats", id, `le monstre « ${e.monstre} » n'existe pas`);
  for (const [id, z] of Object.entries(contenu.zones_pools)) {
    for (const cId of [...(z.normales ?? []), ...(z.elite ?? []), z.boss].filter(Boolean))
      if (!contenu.combats[cId]) E("zones_pools", id, `le combat « ${cId} » n'existe pas`);
  }
  for (const [id, p] of Object.entries(contenu.butin_toiles))
    for (const iId of [...(p.normales ?? []), ...(p.elites ?? []), ...(p.boss ?? [])])
      if (!contenu.items[iId]) E("butin_toiles", id, `l'objet « ${iId} » n'existe pas`);

  // ---- Passe 3 : lecture seule / numérique ---------------------------------
  const memeJson = (a, b) => JSON.stringify(a) === JSON.stringify(b); // ordre de clés identique : même source canonique
  for (const id of new Set([...Object.keys(base.classes), ...Object.keys(contenu.classes)])) {
    if (!memeJson(triCles(base.classes[id]), triCles(contenu.classes[id])))
      E("classes", id, "les classes sont en lecture seule — modification refusée");
  }

  const anciens = Object.keys(base.sorts), nouveaux = Object.keys(contenu.sorts);
  for (const id of nouveaux) if (!base.sorts[id]) E("sorts", id, "création de sort interdite (nouveau sort détecté)");
  for (const id of anciens) if (!contenu.sorts[id]) E("sorts", id, "suppression de sort interdite");
  for (const id of anciens) {
    if (!contenu.sorts[id]) continue;
    diffNumerique(base.sorts[id], contenu.sorts[id], "", (chemin, av, ap) =>
      E("sorts", id, `seuls les nombres sont modifiables — ${chemin} : ${JSON.stringify(av)} → ${JSON.stringify(ap)}`));
  }

  return err;
}

function triCles(v) {
  if (Array.isArray(v)) return v.map(triCles);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, triCles(v[k])]));
  return v;
}

/** Signale tout diff qui n'est pas nombre→nombre (ajout/retrait de clé compris). */
function diffNumerique(av, ap, chemin, signale) {
  if (estNombreBrut(av) && estNombreBrut(ap)) return; // changement numérique : autorisé
  if (av === ap) return;
  const objAv = av && typeof av === "object", objAp = ap && typeof ap === "object";
  if (objAv && objAp && Array.isArray(av) === Array.isArray(ap)) {
    for (const k of new Set([...Object.keys(av), ...Object.keys(ap)])) {
      if (!(k in av)) signale(`${chemin}.${k}`, undefined, ap[k]);
      else if (!(k in ap)) signale(`${chemin}.${k}`, av[k], undefined);
      else diffNumerique(av[k], ap[k], chemin ? `${chemin}.${k}` : k, signale);
    }
    return;
  }
  if (JSON.stringify(av) !== JSON.stringify(ap)) signale(chemin || "(racine)", av, ap);
}
const estNombreBrut = (v) => typeof v === "number" && Number.isFinite(v);
