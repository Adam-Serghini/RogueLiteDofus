// =============================================================================
//  composants.ts — helpers de rendu partagés entre plusieurs écrans (libellés,
//  formatage %, pastilles d'élément, cartes de classe, chips de stats d'objet…).
//  Aucune logique de combat ni d'écran complet ici.
// =============================================================================
import { DOFUS, CLASSES, ITEMS, RARETE_INFO, ASCENSION, ASCENSION_MAX } from "../data";
import { chanceCrit, chanceCritEffective, bonusDegatsCrit, CRIT_CAP, statsEffectives, elementDeFrappe, multiplicateurEscaladeSort, coutEffectif } from "../combat";
import { statElement, multSoin, multOffensif, multStatFrappe, VITA_PAR_FORCE, PROSP_PAR_CHANCE, GAINS_ARCHETYPE } from "../progression";
import type { PersoState } from "../run";
import type { Archetype, Combatant, Element, EquipSlot, ItemInstance, Meta, Spell, Stats } from "../types";
import { A, elementAsset, archetypeAsset, classe_img, ICON_KAMAS, BTN_RETOUR, BTN_CONTINUER, FOND_TRANCHE, FOND_ACCUEIL } from "./assets";
import { escapeHtml, tipsFlottants, setFond } from "./dom";

// --- Barre d'actions des écrans (`.boutons-ecran`, collante en bas) -----------
/**
 * Bouton Retour d'un écran hors combat. Source UNIQUE du balisage : c'est le
 * `.btn-retour` que `initEchapRetour` (dom.ts) va chercher pour doubler le clic
 * par la touche Échap — le faire diverger d'un écran à l'autre casserait Échap
 * sur cet écran seul, sans rien casser ailleurs.
 */
export function boutonRetour(id: string, titre = "Retour"): string {
  return `<button id="${id}" class="btn-retour" title="${escapeHtml(titre)}"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button>`;
}

/** Barre d'actions ne contenant que le bouton Retour (le cas de la majorité des écrans). */
export function barreRetour(id: string, titre = "Retour"): string {
  return `<div class="boutons-ecran">${boutonRetour(id, titre)}</div>`;
}

/** Bouton Continuer : écrans d'ÉVÉNEMENT (butin, capture, transition, recap de zone). */
export function boutonContinuer(id: string): string {
  return `<button id="${id}" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button>`;
}

/** Barre d'actions ne contenant que le bouton Continuer. */
export function barreContinuer(id: string): string {
  return `<div class="boutons-ecran">${boutonContinuer(id)}</div>`;
}

/** Rendu d'un cran d'Ascension en étoiles (★1 = jeu de base). Source UNIQUE :
 *  accueil, carte et récap de fin lisent la même formule. */
export function etoiles(palier: number): string {
  const n = Math.max(0, Math.min(Math.trunc(palier) || 0, ASCENSION_MAX)) + 1;
  return "★".repeat(n) + "☆".repeat(ASCENSION.length - n);
}

/** Fond d'écran de la tranche en cours (null = retour au fond de l'accueil). */
export function setFondTranche(trancheId: string | null): void {
  setFond((trancheId ? FOND_TRANCHE[trancheId] : null) ?? FOND_ACCUEIL);
}

/**
 * Contenu du tooltip d'un sort : fourchette de dégâts/soin **calculée pour le
 * lanceur courant** (fourchette × caractéristique de frappe × puissance, hors
 * crit/résistance), ou jets de BASE si `acteur` est null (encyclopédie, hors
 * combat) ; puis effet et cible.
 */
export function sortTooltipHtml(s: Spell, acteur: Combatant | null): string {
  let principal = "";
  if (acteur) {
    const se = statsEffectives(acteur);
    if (s.type === "soin") {
      if (s.soinComplet)
        principal = `<span class="tip-val soin">♥ Soin complet</span>`;
      else if (s.baseMax > 0) {
        const m = multSoin(se, statElement(se, elementDeFrappe(acteur)));
        principal = `<span class="tip-val soin">♥ ${Math.round(s.baseMin * m)} – ${Math.round(s.baseMax * m)}</span><span class="tip-unite">PV rendus</span>`;
      }
    } else if (s.type === "degats" && s.baseMax > 0) {
      // Le nombre est exact (la stat est identique dans les 2 éléments déclarés, cf.
      // meilleurElement/combat.ts) ; l'ÉLÉMENT réel, lui, dépend de la cible frappée —
      // absente ici — donc on ne l'affiche plus : nommer un élément qu'un autre coup
      // choisira serait le même mensonge que l'ancien indicateur au niveau 1.
      const stat = statElement(se, elementDeFrappe(acteur));
      // `multStatFrappe` est la formule DU MOTEUR (progression.ts) : l'infobulle ne
      // recopie pas le taux, sinon les deux finiraient par raconter deux histoires.
      const mult = multStatFrappe(stat) * multOffensif(se) * multiplicateurEscaladeSort(s, acteur);
      const min = Math.round(s.baseMin * mult);
      const max = Math.round(s.baseMax * mult);
      principal = `<span class="tip-val dgt">⚔ ${min} – ${max}</span><span class="tip-el">selon la cible</span>`;
    }
  } else if (s.baseMax > 0) {
    // hors combat (encyclopédie) : jets de base, sans cible non plus — même choix
    principal = s.type === "soin"
      ? `<span class="tip-val soin">♥ ${s.baseMin} – ${s.baseMax}</span><span class="tip-unite">PV rendus (base)</span>`
      : `<span class="tip-val dgt">⚔ ${s.baseMin} – ${s.baseMax}</span><span class="tip-unite">base · élément selon la cible</span>`;
  }
  // cooldowns : global au sort (cooldownTours) ou par cible (cooldown) + état en cours
  const cd: string[] = [];
  if (s.cooldownTours) cd.push(`⏳ recharge ${s.cooldownTours} tour${s.cooldownTours > 1 ? "s" : ""}`);
  if (s.cooldown) cd.push(`⏳ recharge ${s.cooldown} tour${s.cooldown > 1 ? "s" : ""} par cible`);
  if (s.maxParTour) cd.push(`${s.maxParTour}×/tour`);
  if (s.maxParCibleParTour) cd.push(`${s.maxParCibleParTour}×/cible/tour`);
  const restant = acteur?.cooldowns[s.id] ?? 0;
  if (restant > 0) cd.push(`<b class="tip-cd-actif">en recharge (${restant}t)</b>`);
  return [
    `<div class="tip-nom">${escapeHtml(s.nom)}<span class="tip-pa">${acteur ? coutEffectif(s, acteur) : s.coutPA} PA</span></div>`,
    principal ? `<div class="tip-stat">${principal}</div>` : "",
    s.desc ? `<div class="tip-effet">${escapeHtml(s.desc)}</div>` : "",
    `<div class="tip-cible">🎯 ${CIBLE_LBL[s.cible] ?? s.cible}${cd.length ? ` · ${cd.join(" · ")}` : ""}</div>`,
  ]
    .filter(Boolean)
    .join("");
}

/** Tooltip partagé pour la collection de Dofus (survol). */
export function initDofusTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "dofus-tip";
  tip.style.display = "none";
  document.body.appendChild(tip);
  tipsFlottants.push(tip);

  const placer = (slot: HTMLElement) => {
    const nom = slot.dataset.nom ?? "";
    const effet = slot.dataset.effet ?? "";
    let bas: string;
    if (slot.dataset.ocre) {
      bas = `<div class="tip-boss"><img src="${A("/assets/divers/Archmonster.webp")}" alt="" onerror="this.remove()" />Débloqué via les Archimonstres</div>`;
    } else {
      bas = `<div class="tip-muet">À débloquer par quête</div>`;
    }
    tip.innerHTML =
      `<div class="tip-nom">${escapeHtml(nom)}</div>` +
      `<div class="tip-effet">${escapeHtml(effet)}</div>` +
      bas;
    tip.style.display = "block";
    const r = slot.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    let top = r.top - t.height - 10;
    if (top < 8) top = r.bottom + 10; // bascule sous le slot si trop haut
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  document.addEventListener("mouseover", (e) => {
    const slot = (e.target as HTMLElement).closest?.(
      ".dofus-slot",
    ) as HTMLElement | null;
    if (slot) placer(slot);
  });
  document.addEventListener("mouseout", (e) => {
    const slot = (e.target as HTMLElement).closest?.(".dofus-slot");
    // ne cacher que si l'on quitte réellement le slot (pas un déplacement interne)
    if (slot && !slot.contains(e.relatedTarget as Node | null)) tip.style.display = "none";
  });
}

// libellés de `Spell.cible` — lus uniquement par `sortTooltipHtml` ci-dessus
const CIBLE_LBL: Record<string, string> = {
  ennemi_ligne: "Ennemi (ligne avant)",
  ennemi_tous: "N'importe quel ennemi",
  allie: "Un allié",
  allie_tous: "Toute l'équipe",
  soi: "Soi-même",
  invocation: "Invocation",
  mixte: "Allié ou ennemi",
};

/**
 * Tooltip d'aide générique piloté par `data-tip` (texte multiligne, `\n` rendus
 * via white-space: pre-line). Remplace le `title` natif peu fiable du sélecteur
 * d'élément (cible minuscule + texte long). Réutilisable sur tout `[data-tip]`.
 */
export function initAideTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "aide-tip";
  tip.style.display = "none";
  document.body.appendChild(tip);
  tipsFlottants.push(tip);

  const placer = (host: HTMLElement) => {
    const txt = host.dataset.tip;
    if (!txt) return;
    tip.textContent = txt;
    tip.style.display = "block";
    const r = host.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    let top = r.top - t.height - 10;
    if (top < 8) top = r.bottom + 10; // bascule sous la cible si trop haut
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  document.addEventListener("mouseover", (e) => {
    const host = (e.target as HTMLElement).closest?.(
      "[data-tip]",
    ) as HTMLElement | null;
    if (host) placer(host);
  });
  document.addEventListener("mouseout", (e) => {
    const host = (e.target as HTMLElement).closest?.("[data-tip]");
    if (host && !host.contains(e.relatedTarget as Node | null)) tip.style.display = "none";
  });
}

export const elNom: Record<Element, string> = {
  terre: "Terre",
  feu: "Feu",
  eau: "Eau",
  air: "Air",
};

/** Montant de kamas avec l'icône. */
export const kamasHtml = (n: number): string =>
  `<span class="kamas"><img src="${ICON_KAMAS}" alt="k" onerror="this.remove()" />${n.toLocaleString("fr-FR")}</span>`;

/** Les 2 éléments d'un perso : ceux de sa classe (l'équipement ne les change plus). */
function elementsFortsPerso(p: PersoState): [Element, Element] {
  return CLASSES[p.classeId].elements;
}

/** Pastilles d'élément (les 2 éléments déclarés de la classe — 4 si le Kwakwaffe est
 *  porté). L'élément de frappe se calcule désormais coup par coup (le plus fort des
 *  deux, ou des quatre, au moment du sort) : hors combat il n'y a rien à mettre en
 *  évidence, tous s'affichent à égalité. */
export function pastillesElements(p: PersoState): string {
  const libre = Object.values(p.equipement).some((inst) => inst && ITEMS[inst.id]?.elementLibre);
  const els: Element[] = libre ? ["terre", "feu", "eau", "air"] : elementsFortsPerso(p);
  const img = (el: Element) =>
    `<img class="el-pastille" src="${elementAsset(el)}" alt="" title="Élément : ${elNom[el]}" onerror="this.remove()" />`;
  return `<span class="el-pastilles">${els.map(img).join("")}</span>`;
}
export const ARCHETYPE_NOM: Record<Archetype, string> = {
  melee: "Mêlée",
  distance: "Distance",
};

/** Archétype + les 2 éléments d'une CLASSE (et non d'un héros existant) : sert au choix
 *  d'équipe, au recrutement en taverne et à l'encyclopédie. Les éléments se lisent à
 *  leurs pastilles seules : le doublon en toutes lettres a été retiré de l'encyclopédie
 *  (2026-08-07), et avec lui l'option `noms`, restée sans aucun appelant.
 *  Les deux éléments sont fixes (ceux de la classe) ; celui qui part au moment du coup
 *  se choisit CIBLE PAR CIBLE (cf. `meilleurElement`, combat.ts) — il n'y a plus de
 *  « défaut » ni de second élément au sens hiérarchique. */
interface OptionsArchetype {
  /** l'archétype en icône plutôt qu'en toutes lettres (encyclopédie) */
  icone?: boolean;
}

export function ligneArchetype(classeId: string, opts: OptionsArchetype = {}): string {
  const c = CLASSES[classeId];
  const gains = GAINS_ARCHETYPE[c.archetype];
  const titreArch = `${ARCHETYPE_NOM[c.archetype]} : +${gains.parElement} dans chacun de ses 2 éléments et +${gains.vitalite} en Vitalité par niveau`;
  const img = (el: Element) =>
    `<img class="el-pastille" src="${elementAsset(el)}" alt="" title="Élément de la classe : ${elNom[el]}" onerror="this.remove()" />`;
  // en icône, le mot reste dans `alt`/`title` — et sert de repli si l'image manque
  const arch = opts.icone
    ? `<img class="archetype-icone" src="${archetypeAsset(c.archetype)}" alt="${ARCHETYPE_NOM[c.archetype]}" title="${escapeHtml(titreArch)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'classe-archetype',textContent:this.alt,title:this.title}))" />`
    : `<span class="classe-archetype" title="${escapeHtml(titreArch)}">${ARCHETYPE_NOM[c.archetype]}</span>`;
  return `<span class="classe-elems">
    ${arch}
    <span class="el-pastilles">${c.elements.map(img).join("")}</span>
  </span>`;
}

export const classSymbol = (classeId: string): string =>
  A(`/assets/class_symbol/${classeId}.png`);

// Stats secondaires affichées sur la carte — DÉLÉGUÉES au moteur (source unique
// des formules : combat.ts / progression.ts), ici on ne fait que formater en %.
// probabilité EFFECTIVEMENT tirée (bornée à 0,35) — pas la valeur brute de chanceCrit,
// qui peut dépasser ce plafond grâce au crit plat (l'excédent part en dégâts finaux,
// voir critExcedent) : afficher la valeur brute mentirait sur ce que le moteur applique.
export const pctCrit = (s: Stats): number => Math.round(chanceCritEffective(s) * 100);
export const pctDmgCrit = (s: Stats): number => Math.round(bonusDegatsCrit(s) * 100);
export const pctSoin = (s: Stats, statFrappe: number): number => Math.round((multSoin(s, statFrappe) - 1) * 100);
export const pctDgtsFinaux = (s: Stats): number => Math.round((multOffensif(s) - 1) * 100);

/**
 * Collection de reliques (Dofus). Affiche TOUT le catalogue ; les Dofus non
 * possédés sont grisés/transparents. `×n` si plusieurs copies.
 */
export function renderDofusRack(meta: Meta, compact = false): string {
  const slots = Object.values(DOFUS)
    .map((d) => {
      const n = meta.dofus.filter((x) => x.id === d.id).length;
      const possede = n > 0;
      // Les reliques ne se lâchent plus au combat : plus de « lâché par tel boss ».
      // Seul l'Ocre garde une provenance affichable, la sienne étant une condition
      // de bestiaire et non une quête.
      const bossAttr = d.id === "dofus_ocre" ? `data-ocre="1"` : "";
      return `
        <div class="dofus-slot ${possede ? "" : "locked"}" data-nom="${escapeHtml(d.nom)}" data-effet="${escapeHtml(d.desc)}" ${bossAttr}>
          ${d.img ? `<img src="${A(d.img)}" alt="${escapeHtml(d.nom)}" loading="lazy" onerror="this.remove()" />` : ""}
          ${n > 1 ? `<span class="dofus-count">×${n}</span>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="dofus-rack ${compact ? "compact" : ""}">${slots}</div>`;
}

// Rôle court par classe (écran de choix d'équipe / recrutement).
// Ces lignes décrivent le kit RÉEL : à chaque refonte de classe, les relire.
export const ROLE_CLASSE: Record<string, string> = {
  iop: "Bourrin, frappe de plus en plus fort à mesure qu'il enchaîne",
  cra: "Archère, ouvre sa ligne de vue et ferme celle d'en face",
  eniripsa: "Soigneuse, remet debout, protège et redonne des PA",
  sadida: "Invocateur, une poupée qui encaisse et du poison qui use",
  sram: "Assassin, sème des pièges et frappe quand ils ont mordu",
  feca: "Protecteur, durcit sa rangée et prend les coups à la place des autres",
  ecaflip: "Flambeur, tout son kit s'emballe au coup critique",
  ouginak: "Chasseur, s'acharne sur sa Proie et monte en Rage",
  roublard: "Artificier, colle des bombes et les fait toutes sauter d'un coup",
  xelor: "Horloger, vole des PA et empile les Téléfrags pour un gros coup",
  eliotrope: "Portailleur, ses portails dopent toute sa rangée",
  forgelance: "Lancier, plante sa lance et balaye tout autour d'elle",
};

/** Carte de classe (portrait + rôle) pour le choix d'équipe / recrutement. */
export function carteClasse(classeId: string, sel: boolean, dataAttr: string): string {
  const c = CLASSES[classeId];
  return `<button class="classe-carte ${sel ? "sel" : ""}" ${dataAttr}="${classeId}">
    <img class="classe-portrait" src="${classe_img(classeId)}" alt="" onerror="this.remove()" />
    <span class="classe-nom">${escapeHtml(c.nom)}</span>
    ${ligneArchetype(classeId)}
    <span class="classe-role">${escapeHtml(ROLE_CLASSE[classeId] ?? "")}</span>
  </button>`;
}

// --- Équipement --------------------------------------------------------------
export const SLOTS: EquipSlot[] = [
  "arme",
  "coiffe",
  "cape",
  "anneau",
];
export const SLOT_NOM: Record<EquipSlot, string> = {
  arme: "Arme",
  coiffe: "Coiffe",
  cape: "Cape",
  anneau: "Anneau",
};
export const STAT_ABBR: Partial<Record<keyof Stats, string>> = {
  vitalite: "Vita",
  force: "For",
  intelligence: "Int",
  agilite: "Agi",
  chance: "Cha",
  soin: "Soin",
  prospection: "PP",
  crit: "% Crit",
};
/** Résumé textuel d'un set de stats rollées (+ PV plats / résistances optionnels). */
export function itemLignes(
  stats: Partial<Stats>,
  pvBonus = 0,
  resistances: Partial<Record<Element, number>> = {},
): string {
  const parts: string[] = [];
  if (pvBonus) parts.push(`+${pvBonus} PV`);
  for (const k of Object.keys(stats) as (keyof Stats)[]) {
    const v = stats[k];
    if (v) parts.push(`+${v} ${STAT_ABBR[k] ?? k}`);
  }
  for (const e of Object.keys(resistances) as Element[]) {
    const v = resistances[e];
    if (v) parts.push(`+${Math.round(v * 100)} % rés ${elNom[e]}`);
  }
  return parts.join(" · ");
}

/** Classe CSS de rareté d'un exemplaire ("" si aucune rareté). */
export const rareteCls = (inst?: ItemInstance | null): string => (inst?.rarete ? ` rarete-${inst.rarete}` : "");

/** Nom d'objet coloré selon la rareté, avec libellé du palier en tooltip. */
export function itemNomHtml(inst: ItemInstance): string {
  const it = ITEMS[inst.id];
  const nom = escapeHtml(it?.nom ?? inst.id);
  if (!inst.rarete) return nom;
  return `<span class="inom-${inst.rarete}" title="${RARETE_INFO[inst.rarete].nom}">${nom}</span>`;
}

/** Stats d'un exemplaire en chips colorées (par stat), lisibles d'un coup d'œil. */
export function itemStatsHtml(inst: ItemInstance): string {
  const it = ITEMS[inst.id];
  const chips: string[] = [];
  const chip = (cls: string, txt: string) => chips.push(`<span class="ichip ${cls}">${txt}</span>`);
  const signe = (v: number) => (v > 0 ? `+${v}` : `${v}`); // les malus s'affichent en négatif
  if (inst.adaptatif) chips.push(`<span class="ichip ichip-adapt" title="Stat adaptative : s'ajoute à la carac de ta voie (élément choisi)">+${inst.adaptatif} ★ Adapt.</span>`);
  if (it?.pvBonus) chip("ichip-vitalite", `+${it.pvBonus} PV`);
  for (const k of Object.keys(inst.stats) as (keyof Stats)[]) {
    const v = inst.stats[k];
    if (v) chip(`ichip-${k}${v < 0 ? " malus" : ""}`, `${signe(v)} ${STAT_ABBR[k] ?? k}`);
  }
  if (inst.pa) chip("ichip-pa", `+${inst.pa} PA`);
  const res = { ...(it?.resistances ?? {}), ...(inst.resistances ?? {}) };
  for (const e of Object.keys(res) as Element[]) {
    const v = res[e];
    if (v) chip(`ichip-res elem-${e}${v < 0 ? " malus" : ""}`, `${signe(Math.round(v * 100))}% ${elNom[e]}`);
  }
  // attaque d'arme (palier prioritaire)
  const att = inst.rarete ? it?.tiers?.[inst.rarete]?.attaque : undefined;
  if (att) chip("ichip-arme", `⚔ ${att.baseMin}–${att.baseMax} (${att.coutPA} PA)${att.cible === "ennemi_tous" ? " · ligne arrière" : ""}${att.vampirisme ? ` · vol ${Math.round(att.vampirisme * 100)} %` : ""}`);
  if (it?.paGamble) chips.push(`<span class="ichip ichip-pa" title="À chaque tour : ${Math.round(it.paGamble.pPlus * 100)} % de gagner +${it.paGamble.plus} PA, sinon −${it.paGamble.moins} PA">🎲 ${Math.round(it.paGamble.pPlus * 100)} % +${it.paGamble.plus} PA / −${it.paGamble.moins}</span>`);
  if (it?.ligneAvant) chips.push(`<span class="ichip malus" title="Équipable uniquement sur un personnage de la ligne avant">Ligne avant uniqt</span>`);
  if (it?.riposteAvant) chips.push(`<span class="ichip ichip-force" title="Quand le porteur est frappé en ligne avant : ${Math.round(it.riposteAvant * 100)} % de chance de contre-attaquer">↩ ${Math.round(it.riposteAvant * 100)} % riposte (avant)</span>`);
  if (it?.esquiveArriere) chips.push(`<span class="ichip ichip-agilite" title="Quand le porteur est en ligne arrière : +${Math.round(it.esquiveArriere * 100)} % d'esquive">💨 +${Math.round(it.esquiveArriere * 100)} % esquive (arrière)</span>`);
  if (it?.soinDegatsRecus) chips.push(`<span class="ichip ichip-soin" title="À chaque coup encaissé, le porteur récupère ${Math.round(it.soinDegatsRecus * 100)} % des dégâts subis">♥ récup. ${Math.round(it.soinDegatsRecus * 100)} % des dégâts subis</span>`);
  if (it?.changeLigne) chips.push(`<span class="ichip ichip-pa" title="Confère le sort « Changer de ligne » : bascule avant ↔ arrière en combat pour ${it.changeLigne} PA">↕ change de ligne (${it.changeLigne} PA)</span>`);
  if (it?.perceResistances) chips.push(`<span class="ichip ichip-force" title="L'attaque de cette arme ignore ${Math.round(it.perceResistances * 100)} % des résistances de la cible">⚡ perce ${Math.round(it.perceResistances * 100)} % des rés.</span>`);
  if (it?.frappeDerriere) chips.push(`<span class="ichip ichip-force" title="L'attaque touche aussi l'ennemi juste derrière la cible">⤈ frappe aussi derrière</span>`);
  if (it?.prospParPvManquant) chips.push(`<span class="ichip ichip-prospection" title="Au moment du butin : +${it.prospParPvManquant} prospection par PV manquant du porteur">📦 +${it.prospParPvManquant} PP / PV manquant</span>`);
  if (it?.multKamas) chips.push(`<span class="ichip ichip-adapt" title="Les kamas gagnés en combat sont multipliés par ${it.multKamas}">🪙 kamas ×${it.multKamas}</span>`);
  if (it?.bouclierDebut) chips.push(`<span class="ichip ichip-vitalite" title="Commence chaque combat avec un bouclier de ${Math.round(it.bouclierDebut * 100)} % des PV max">🛡 bouclier de départ ${Math.round(it.bouclierDebut * 100)} %</span>`);
  if (it?.poisonArme) chips.push(`<span class="ichip malus" title="L'attaque de cette arme empoisonne la cible (${it.poisonArme.degats} dégâts pendant ${it.poisonArme.duree} tours)">☠ empoisonne (${it.poisonArme.degats}/t · ${it.poisonArme.duree} t)</span>`);
  if (it?.soinAllieBlesse) chips.push(`<span class="ichip ichip-soin" title="L'attaque soigne l'allié le plus blessé de ${Math.round(it.soinAllieBlesse * 100)} % des dégâts infligés">♥ soigne l'allié blessé (${Math.round(it.soinAllieBlesse * 100)} %)</span>`);
  if (it?.retraitPA) chips.push(`<span class="ichip ichip-pa" title="L'attaque a 30 % de chance de retirer ${it.retraitPA} PA à la cible">⛓ retrait ${it.retraitPA} PA (30 %)</span>`);
  if (it?.assome) chips.push(`<span class="ichip malus" title="L'attaque de cette arme a ${Math.round(it.assome * 100)} % de chance d'assommer la cible : elle passe son prochain tour">💫 assomme (${Math.round(it.assome * 100)} %)</span>`);
  if (it?.recupPASort) chips.push(`<span class="ichip ichip-pa" title="Après chaque sort lancé par le porteur : ${Math.round(it.recupPASort.chance * 100)} % de chance de récupérer ${it.recupPASort.pa} PA immédiatement">↺ ${Math.round(it.recupPASort.chance * 100)} % récup. ${it.recupPASort.pa} PA</span>`);
  if (it?.esquiveBonus) chips.push(`<span class="ichip ichip-agilite" title="+${Math.round(it.esquiveBonus * 100)} % d'esquive pour le porteur, quelle que soit sa ligne">💨 +${Math.round(it.esquiveBonus * 100)} % esquive</span>`);
  if (it?.esquiveParPiece) chips.push(`<span class="ichip ichip-agilite" title="Bonus de panoplie : +${Math.round(it.esquiveParPiece * 1000) / 10} % d'esquive par pièce de sa panoplie équipée (s'ajoute au +1 PA des 4 pièces)">💨 +${Math.round(it.esquiveParPiece * 1000) / 10} % esquive / pièce</span>`);
  if (it?.elementLibre) chips.push(`<span class="ichip ichip-adapt" title="Le porteur peut frapper dans N'IMPORTE quel élément (plus limité à sa paire déclarée)">🌈 élément libre</span>`);
  if (it?.renaissance) chips.push(`<span class="ichip ichip-adapt" title="À la mort du porteur : renaît UNE fois par combat à ${Math.round(it.renaissance * 100)} % de ses PV">🥚 renaissance (${Math.round(it.renaissance * 100)} % PV)</span>`);
  if (it?.panoplie) chips.push(`<span class="ichip ichip-pano" title="Panoplie ${escapeHtml(it.panoplie)} : +1 PA quand les 4 pièces sont portées par le même héros">⬡ ${escapeHtml(it.panoplie)}</span>`);
  return `<span class="ichips">${chips.join("")}</span>`;
}

// --- Panneau de personnages (niveaux & points) -------------------------------
export const STAT_NOM: Record<keyof Stats, string> = {
  force: "Force",
  intelligence: "Intelligence",
  agilite: "Agilité",
  chance: "Chance",
  vitalite: "Vitalité",
  soin: "Soin",
  prospection: "Prospection",
  crit: "Critique",
};
// Les pourcentages ci-dessous sont DÉRIVÉS des fonctions qui font foi (progression.ts /
// combat.ts) plutôt que recopiés à la main : un delta de 1 point pour le taux/point (les
// formules sont linéaires avant leur plafond), une stat énorme pour lire le plafond lui-
// même. Si une formule change, ce bloc suit tout seul — aucun nombre à corriger ici.
const statsBase: Stats = { force: 0, intelligence: 0, agilite: 0, vitalite: 0 };
const pct1 = (x: number): number => Math.round(x * 1000) / 10; // 1 décimale, en %
const TAUX_DGTS_FINAUX = pct1(multOffensif({ ...statsBase, intelligence: 1 }) - 1); // feu, multOffensif — progression.ts
const CAP_DGTS_FINAUX = pct1(multOffensif({ ...statsBase, intelligence: 1e6 }) - 1);
const PLANCHER_CRIT = pct1(chanceCritEffective(statsBase)); // air, chanceCrit — combat.ts
const TAUX_CRIT = pct1(chanceCrit({ ...statsBase, agilite: 1 }) - chanceCrit(statsBase));
const CAP_CRIT = pct1(CRIT_CAP);
const BASE_DGTS_CRIT = pct1(bonusDegatsCrit(statsBase));
const TAUX_DGTS_CRIT = pct1(bonusDegatsCrit({ ...statsBase, agilite: 1 }) - bonusDegatsCrit(statsBase));
const CAP_DGTS_CRIT = pct1(bonusDegatsCrit({ ...statsBase, agilite: 1e6 }));

// Description complète affichée au survol d'une caractéristique (peut contenir du HTML).
export const STAT_AIDE: Record<keyof Stats, string> = {
  force:
    `Dégâts dans l'élément <b>Terre</b>.<br>+1 Vitalité par ${VITA_PAR_FORCE} de Force (voir VITA_PAR_FORCE, progression.ts).`,
  intelligence:
    `Dégâts dans l'élément <b>Feu</b>.<br>Dégâts finaux : <b>+${TAUX_DGTS_FINAUX} %</b> par point (max +${CAP_DGTS_FINAUX} %).`,
  agilite:
    `Dégâts dans l'élément <b>Air</b>.<br>Taux de coup critique : <b>+${TAUX_CRIT} %</b> par point (plancher ${PLANCHER_CRIT} % pour tous, max ${CAP_CRIT} %).<br>Dégâts critiques : <b>+${TAUX_DGTS_CRIT} %</b> par point (base ${BASE_DGTS_CRIT} %, max ${CAP_DGTS_CRIT} %).`,
  chance: `Dégâts dans l'élément <b>Eau</b>.<br>+1 Prospection par ${PROSP_PAR_CHANCE} de Chance (voir PROSP_PAR_CHANCE, progression.ts).`,
  vitalite: "Points de vie maximum : <b>+1 PV</b> par point.",
  soin: "Puissance des soins prodigués : <b>+0,5 %</b> par point (max 50 %).",
  prospection:
    "Augmente les chances de butin d'équipement (cumulé sur toute l'équipe).",
  crit: "% plat de coup critique (équipement), s'ajoute au taux dérivé de l'Agilité.",
};
// L'élément de frappe est l'un des 2 éléments DÉCLARÉS par la classe (le Kwakwaffe
// ouvre les 4) — voir `elementsForts`/`elementDeFrappe`, combat.ts.
export const AIDE_ELEMENT =
  '<br><i class="aide-note">L\'élément de frappe est l\'un des 2 éléments déclarés par ta classe.</i>';
