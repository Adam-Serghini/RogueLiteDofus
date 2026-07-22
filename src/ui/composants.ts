// =============================================================================
//  composants.ts — helpers de rendu partagés entre plusieurs écrans (libellés,
//  formatage %, pastilles d'élément, cartes de classe, chips de stats d'objet…).
//  Aucune logique de combat ni d'écran complet ici.
// =============================================================================
import { DOFUS, DOFUS_DROP, CLASSES, ITEMS, RARETE_INFO } from "../data";
import { ELEMENTS, chanceCrit, bonusDegatsCrit } from "../combat";
import { statsFinales, multSoin, multOffensif, pctRembPA as rembPA } from "../progression";
import { bonusEquipement, STAT_PAR_ELEMENT, type PersoState } from "../run";
import type { Element, EquipSlot, ItemInstance, Meta, Stats } from "../types";
import { A, elementAsset, classe_img, ICON_KAMAS } from "./assets";
import { escapeHtml, tipsFlottants } from "./dom";

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
    const boss = slot.dataset.boss ?? "";
    const bossImg = slot.dataset.bossImg ?? "";
    let bas: string;
    if (boss) {
      bas = `<div class="tip-boss">${bossImg ? `<img src="${bossImg}" alt="" onerror="this.remove()" />` : ""}Lâché par ${escapeHtml(boss)}</div>`;
    } else if (slot.dataset.ocre) {
      bas = `<div class="tip-boss"><img src="${A("/assets/divers/Archmonster.webp")}" alt="" onerror="this.remove()" />Débloqué via les Archimonstres</div>`;
    } else {
      bas = `<div class="tip-muet">Pas encore obtenable</div>`;
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

export const CIBLE_LBL: Record<string, string> = {
  ennemi_ligne: "Ennemi (ligne avant)",
  ennemi_tous: "N'importe quel ennemi",
  allie: "Un allié",
  allie_tous: "Toute l'équipe",
  soi: "Soi-même",
  invocation: "Invocation",
  mixte: "Allié ou ennemi",
};

/** Explication de la mécanique d'élément de frappe (icône info du sélecteur). */
export const ELEMENT_AIDE =
  "Élément de frappe\n\n" +
  "Tous tes dégâts utilisent ta caractéristique élémentaire la plus élevée :\n" +
  "Force → Terre · Intelligence → Feu · Agilité → Air · Chance → Eau\n\n" +
  "Les résistances de la cible s'appliquent selon cet élément.\n" +
  "Clique sur un rond pour basculer entre tes 2 éléments les plus forts.";

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

/** Les 2 éléments les plus forts d'un perso (stats finales + équipement), comme en combat. */
export function elementsFortsPerso(p: PersoState): [Element, Element] {
  const finals = statsFinales(CLASSES[p.classeId], p.progression);
  const equip = bonusEquipement(p).stats;
  const valeur = (el: Element): number => {
    const stat = STAT_PAR_ELEMENT[el];
    return (finals[stat] ?? 0) + (equip[stat] ?? 0);
  };
  const tri = ELEMENTS.map((el): [Element, number] => [el, valeur(el)]).sort((a, b) => b[1] - a[1]);
  return [tri[0][0], tri[1][0]];
}

/** Paire de pastilles d'élément (les 2 plus forts ; frappe en évidence, second estompé). */
export function pastillesElements(p: PersoState): string {
  const [e1, e2] = elementsFortsPerso(p);
  const frappe = p.elementChoisi ?? e1;
  const img = (el: Element) =>
    `<img class="el-pastille ${el === frappe ? "" : "dim"}" src="${elementAsset(el)}" alt="" title="${el === frappe ? "Élément de frappe" : "Élément secondaire"} : ${elNom[el]}" onerror="this.remove()" />`;
  return `<span class="el-pastilles">${img(e1)}${img(e2)}</span>`;
}
export const classSymbol = (classeId: string): string =>
  A(`/assets/class_symbol/${classeId}.png`);

// Stats secondaires affichées sur la carte — DÉLÉGUÉES au moteur (source unique
// des formules : combat.ts / progression.ts), ici on ne fait que formater en %.
export const pctCrit = (s: Stats): number => Math.round(chanceCrit(s) * 100);
export const pctDmgCrit = (s: Stats): number => Math.round(bonusDegatsCrit(s) * 100);
export const pctSoin = (s: Stats): number => Math.round((multSoin(s) - 1) * 100);
export const pctDgtsFinaux = (s: Stats): number => Math.round((multOffensif(s) - 1) * 100);
export const pctRembPA = (s: Stats): number => Math.round(rembPA(s) * 100);

/**
 * Collection de reliques (Dofus). Affiche TOUT le catalogue ; les Dofus non
 * possédés sont grisés/transparents. `×n` si plusieurs copies.
 */
export function renderDofusRack(meta: Meta, compact = false): string {
  const slots = Object.values(DOFUS)
    .map((d) => {
      const n = meta.dofus.filter((id) => id === d.id).length;
      const possede = n > 0;
      const boss = DOFUS_DROP[d.id];
      const bossAttr = boss
        ? `data-boss="${escapeHtml(boss.nom)}" data-boss-img="${boss.img ? A(boss.img) : ""}"`
        : d.id === "dofus_ocre" ? `data-ocre="1"` : "";
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
export const ROLE_CLASSE: Record<string, string> = {
  iop: "Bourrin — gros dégâts Terre au corps à corps",
  cra: "Archère — artillerie à conditions, ligne de vue",
  eniripsa: "Soigneuse — soins, boucliers, poisons",
  sadida: "Invocateur — poupée, contrôle, dégâts sur la durée",
  sram: "Assassin — DPT monocible & poisons",
  feca: "Protecteur — boucliers, glyphes, réduction de dégâts",
  ecaflip: "Joueur — mixte, hasard (dés & cartes)",
  ouginak: "Chasseur — marque sa Proie, Rage croissante, contrôle de ligne",
  roublard: "Artificier — bombes collantes à détoner, contrôle de position",
  xelor: "Horloger — Téléfrags, vol et don de PA, burst conditionné",
  eliotrope: "Portailleur — buffs de rangée, soins par les dégâts, burst à portails",
  forgelance: "Lancier — zones autour de sa lance, boucliers, redirection",
};

/** Carte de classe (portrait + rôle) pour le choix d'équipe / recrutement. */
export function carteClasse(classeId: string, sel: boolean, dataAttr: string): string {
  const c = CLASSES[classeId];
  return `<button class="classe-carte ${sel ? "sel" : ""}" ${dataAttr}="${classeId}">
    <img class="classe-portrait" src="${classe_img(classeId)}" alt="" onerror="this.remove()" />
    <span class="classe-nom">${escapeHtml(c.nom)}</span>
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
  if (it?.elementLibre) chips.push(`<span class="ichip ichip-adapt" title="Le porteur peut frapper dans N'IMPORTE quel élément (plus limité à ses 2 plus forts)">🌈 élément libre</span>`);
  if (it?.renaissance) chips.push(`<span class="ichip ichip-adapt" title="À la mort du porteur : renaît UNE fois par combat à ${Math.round(it.renaissance * 100)} % de ses PV">🥚 renaissance (${Math.round(it.renaissance * 100)} % PV)</span>`);
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
// Description complète affichée au survol d'une caractéristique (peut contenir du HTML).
export const STAT_AIDE: Record<keyof Stats, string> = {
  force:
    "Dégâts dans l'élément <b>Terre</b>.<br>Coup critique : <b>+0,5 %</b> par point (max 50 %).",
  intelligence:
    "Dégâts dans l'élément <b>Feu</b>.<br>Dégâts finaux : <b>+0,5 %</b> par point (max 50 %).",
  agilite:
    "Dégâts dans l'élément <b>Air</b>.<br>Esquive : <b>+0,2 %</b> par point (max 50 %).<br>Dégâts critiques : <b>+0,4 %</b> par point (max +60 %).",
  chance: "Dégâts dans l'élément <b>Eau</b>.",
  vitalite: "Points de vie maximum : <b>+1 PV</b> par point.",
  soin: "Puissance des soins prodigués : <b>+0,5 %</b> par point (max 50 %).",
  prospection:
    "Augmente les chances de butin d'équipement (cumulé sur toute l'équipe).",
  crit: "% plat de coup critique (équipement).",
};
// Ta plus haute stat élémentaire (Force/Int/Agi/Chance) définit ton élément de frappe.
export const AIDE_ELEMENT =
  '<br><i class="aide-note">L\'élément de frappe est ta plus haute stat élémentaire.</i>';
