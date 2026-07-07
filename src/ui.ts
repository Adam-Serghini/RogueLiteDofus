// =============================================================================
//  ui.ts — Rendu DOM minimal + contrôleur joueur (clic sort → clic cible).
//  Aucune logique de combat ici : on lit l'état et on renvoie des Actions.
// =============================================================================
import {
  SORTS,
  DOFUS,
  DOFUS_DROP,
  CLASSES,
  COMBATS,
  ITEMS,
  PANOPLIES,
  MONSTRES,
  ZONES,
  TRANCHES,
  monstresDeZone,
  OCRE_PALIERS,
  SORT_DOSSIER,
} from "./data";
import {
  ciblesValides,
  estAvant,
  ELEMENTS,
  elementsForts,
  elementDeFrappe,
  statElement,
  statsEffectives,
  type FxEvent,
} from "./combat";
import {
  STAT_KEYS,
  statsFinales,
  xpRequis,
  coutPoint,
  investirN,
  multOffensif,
  multSoin,
} from "./progression";
import { atteignables, noeud } from "./carte";
import {
  chargerConfig,
  sauverConfig,
  libelleTouche,
  type Settings,
} from "./config";
import {
  classesDisponibles,
  bonusEquipement,
  bonusEquipe,
  pvMaxPerso,
  equiper,
  desequiper,
  paliersOcre,
  appliquerElement,
  STAT_PAR_ELEMENT,
  type PersoState,
  type RunState,
  type Succes,
  SUCCES,
} from "./run";
import type {
  Action,
  Camp,
  Combatant,
  Element,
  EquipSlot,
  ItemInstance,
  GameMap,
  MapNode,
  Meta,
  NodeType,
  Spell,
  Stats,
} from "./types";

let root: HTMLElement;
let combatants: Combatant[] = [];
let logLines: string[] = [];
let titre = "";
let metaCombat: Meta | null = null; // pour l'indicateur de capture d'Archimonstre sur les cartes
let combatMonte = false; // squelette de l'écran de combat déjà construit ? (évite de tout reconstruire à chaque render)

// état du tour joueur en cours
let activeActeur: Combatant | null = null;
let selectedSpell: Spell | null = null;
let resolver: ((a: Action | null) => void) | null = null;

let config: Settings = chargerConfig();

export function init(el: HTMLElement): void {
  root = el;
  initDofusTooltip();
  initSortTooltip();
  initAideTooltip();
  // raccourcis clavier globaux : actifs uniquement pendant le tour du joueur
  document.addEventListener("keydown", (e) => {
    if (!resolver || !activeActeur) return;
    if (e.key === config.toucheFinTour) {
      e.preventDefault();
      finir(null); // terminer le tour
      return;
    }
    if (e.key === "Escape" && selectedSpell) {
      selectedSpell = null; // annuler la sélection de sort
      render();
      return;
    }
    // touches 1-9 : slot 1 = corps à corps (réservé/vide), 2+ = sorts dans l'ordre.
    // On lit e.code (touche physique) et non e.key : sur un clavier AZERTY les chiffres
    // exigeraient sinon Maj. Digit1-9 (rangée du haut) et Numpad1-9 (pavé) sont gérés.
    const touche = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (touche) {
      const slot = Number(touche[1]);
      // case 1 = attaque d'arme (si équipée) ; 2+ = sorts dans l'ordre
      const s = slot === 1 ? activeActeur.armeSort : SORTS[activeActeur.sorts[slot - 2]];
      if (s) {
        e.preventDefault();
        choisirSort(s);
      }
    }
  });
}

/** Tooltip partagé pour la collection de Dofus (survol). */
function initDofusTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "dofus-tip";
  tip.style.display = "none";
  document.body.appendChild(tip);

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

const CIBLE_LBL: Record<string, string> = {
  ennemi_ligne: "Ennemi (ligne avant)",
  ennemi_tous: "N'importe quel ennemi",
  allie: "Un allié",
  allie_tous: "Toute l'équipe",
  soi: "Soi-même",
  invocation: "Invocation",
  mixte: "Allié ou ennemi",
};

/** Explication de la mécanique d'élément de frappe (icône info du sélecteur). */
const ELEMENT_AIDE =
  "Élément de frappe\n\n" +
  "Tous tes dégâts utilisent ta caractéristique élémentaire la plus élevée :\n" +
  "Force → Terre · Intelligence → Feu · Agilité → Air · Chance → Eau\n\n" +
  "Les résistances de la cible s'appliquent selon cet élément.\n" +
  "Clique sur un rond pour basculer entre tes 2 éléments les plus forts.";

/**
 * Contenu du tooltip d'un sort : fourchette de dégâts/soin **calculée pour le
 * lanceur courant** (jet + élément × scaling × puissance, hors crit/résistance),
 * puis effet et cible. Pour les sorts spéciaux (multi-coups, dé, projectiles),
 * on s'appuie sur la description.
 */
function sortTooltipHtml(s: Spell, acteur: Combatant | null): string {
  let principal = "";
  if (acteur) {
    const se = statsEffectives(acteur);
    if (s.type === "soin") {
      if (s.soinComplet)
        principal = `<span class="tip-val soin">♥ Soin complet</span>`;
      else if (s.baseMax > 0) {
        const m = multSoin(se);
        principal = `<span class="tip-val soin">♥ ${Math.round(s.baseMin * m)} – ${Math.round(s.baseMax * m)}</span><span class="tip-unite">PV rendus</span>`;
      }
    } else if (
      s.type === "degats" &&
      s.baseMax > 0 &&
      !s.coups &&
      !s.projectiles &&
      !s.de
    ) {
      const el = elementDeFrappe(acteur);
      const stat = statElement(se, el);
      const mult = multOffensif(se);
      const min = Math.round((s.baseMin + stat * s.scaling) * mult);
      const max = Math.round((s.baseMax + stat * s.scaling) * mult);
      principal = `<span class="tip-val dgt">⚔ ${min} – ${max}</span><span class="tip-el el-${el}">${elNom[el]}</span>`;
    }
  }
  // cooldowns : global au sort (cooldownTours) ou par cible (cooldown) + état en cours
  const cd: string[] = [];
  if (s.cooldownTours) cd.push(`⏳ recharge ${s.cooldownTours} tour${s.cooldownTours > 1 ? "s" : ""}`);
  if (s.cooldown) cd.push(`⏳ recharge ${s.cooldown} tour${s.cooldown > 1 ? "s" : ""} par cible`);
  const restant = acteur?.cooldowns[s.id] ?? 0;
  if (restant > 0) cd.push(`<b class="tip-cd-actif">en recharge (${restant}t)</b>`);
  return [
    `<div class="tip-nom">${escapeHtml(s.nom)}<span class="tip-pa">${s.coutPA} PA</span></div>`,
    principal ? `<div class="tip-stat">${principal}</div>` : "",
    s.desc ? `<div class="tip-effet">${escapeHtml(s.desc)}</div>` : "",
    `<div class="tip-cible">🎯 ${CIBLE_LBL[s.cible] ?? s.cible}${cd.length ? ` · ${cd.join(" · ")}` : ""}</div>`,
  ]
    .filter(Boolean)
    .join("");
}

/** Tooltip stylé des sorts (survol des boutons d'action). */
function initSortTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "sort-tip";
  tip.style.display = "none";
  document.body.appendChild(tip);

  const placer = (btn: HTMLElement) => {
    const s = btn.dataset.arme ? activeActeur?.armeSort : btn.dataset.sort ? SORTS[btn.dataset.sort] : null;
    if (!s) return;
    tip.innerHTML = sortTooltipHtml(s, activeActeur);
    tip.style.display = "block";
    const r = btn.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    let top = r.top - t.height - 10;
    if (top < 8) top = r.bottom + 10; // bascule sous le bouton si trop haut
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  document.addEventListener("mouseover", (e) => {
    const btn = (e.target as HTMLElement).closest?.(
      "button.sort[data-sort], button.sort[data-arme]",
    ) as HTMLElement | null;
    if (btn) placer(btn);
  });
  document.addEventListener("mouseout", (e) => {
    const btn = (e.target as HTMLElement).closest?.("button.sort[data-sort], button.sort[data-arme]");
    if (btn && !btn.contains(e.relatedTarget as Node | null)) tip.style.display = "none";
  });
}

/**
 * Tooltip d'aide générique piloté par `data-tip` (texte multiligne, `\n` rendus
 * via white-space: pre-line). Remplace le `title` natif peu fiable du sélecteur
 * d'élément (cible minuscule + texte long). Réutilisable sur tout `[data-tip]`.
 */
function initAideTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "aide-tip";
  tip.style.display = "none";
  document.body.appendChild(tip);

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

/** Vrai si le combattant peut encore lancer au moins un sort (PA + cible). */
function aUneActionPossible(acteur: Combatant, cs: Combatant[]): boolean {
  return acteur.sorts
    .map((id) => SORTS[id])
    .some(
      (s) =>
        acteur.paActuels >= s.coutPA && ciblesValides(acteur, s, cs).length > 0,
    );
}

const elNom: Record<Element, string> = {
  terre: "Terre",
  feu: "Feu",
  eau: "Eau",
  air: "Air",
};

// --- Log ---------------------------------------------------------------------
/** Une ligne de journal, classée par type pour le style (tour / dégâts / soin / effet). */
function logLineHtml(l: string): string {
  let type = "info";
  if (l.startsWith("▶")) type = "tour";
  else if (/dégâts|inflige|subit|meurt|perd/i.test(l)) type = "degats";
  else if (/récupère|soigne|soin|PV rendus|bouclier/i.test(l)) type = "soin";
  else if (/poison|empoisonne|☠/i.test(l)) type = "poison";
  return `<div class="log-line log-${type}">${escapeHtml(l)}</div>`;
}

/** Réécrit le journal depuis `logLines` (ordre chronologique) et défile vers le plus récent. */
function rafraichirJournal(): void {
  const journal = document.getElementById("journal");
  if (!journal) return;
  journal.innerHTML = logLines.map(logLineHtml).join("");
  journal.scrollTop = journal.scrollHeight;
}

export function log(msg: string): void {
  logLines.push(msg);
  if (logLines.length > 200) logLines.shift();
  rafraichirJournal();
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string,
  );
}

/** Préfixe un chemin d'asset par la base de déploiement (GitHub Pages = /RogueLiteDofus/). */
export const A = (p: string): string =>
  import.meta.env.BASE_URL + p.replace(/^\/+/, "");

/**
 * Icône d'un sort, rangée par classe propriétaire : `/assets/spells/<classe>/<id>.png`
 * (sorts de monstres → `/monstres/`). Absente → l'`onerror` de l'<img> la retire.
 */
const sortIcon = (id: string): string =>
  A(`/assets/spells/${SORT_DOSSIER[id] ?? "monstres"}/${id}.png`);

const PA_ICON = A("/assets/divers/etoile.png"); // gemme de PA des cartes
const COEUR_PLEIN = A("/assets/divers/coeur_base.png"); // texture du cœur de PV (combat)
const LOGO = A("/assets/divers/Roguefus_lite.png");
const BTN_JOUER = A("/assets/menu/Jouer.png");
const BTN_RETOUR = A("/assets/menu/retour.png");
const BTN_CONTINUER = A("/assets/menu/continuer.png");
const MENU_PERSOS = A("/assets/menu/Caracteristiques.png");
const MENU_FORMATION = A("/assets/menu/Formation.png");
const MENU_INVENTAIRE = A("/assets/menu/Inventaire.png");
const MENU_BESTIAIRE = A("/assets/menu/bestiaires.png");
const MENU_PARAM = A("/assets/menu/parametres.png");
const MENU_SUCCES = A("/assets/menu/succes.png");
const MENU_DOFUS = A("/assets/menu/dofus.png");
const elementAsset = (el: string): string => A(`/assets/elements/${el}.png`);

/** Les 2 éléments les plus forts d'un perso (stats finales + équipement), comme en combat. */
function elementsFortsPerso(p: PersoState): [Element, Element] {
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
function pastillesElements(p: PersoState): string {
  const [e1, e2] = elementsFortsPerso(p);
  const frappe = p.elementChoisi ?? e1;
  const img = (el: Element) =>
    `<img class="el-pastille ${el === frappe ? "" : "dim"}" src="${elementAsset(el)}" alt="" title="${el === frappe ? "Élément de frappe" : "Élément secondaire"} : ${elNom[el]}" onerror="this.remove()" />`;
  return `<span class="el-pastilles">${img(e1)}${img(e2)}</span>`;
}
const classSymbol = (classeId: string): string =>
  A(`/assets/class_symbol/${classeId}.png`);
// Icônes de stats secondaires (cf. maquette de carte)
const ICON_CRIT = A("/assets/elements/critique.png");
const ICON_DMGCRIT = A("/assets/elements/dmgCritique.png");
const ICON_SOIN = A("/assets/elements/soin.png");
const ICON_PUISS = A("/assets/elements/puissance.png");
const ICON_PP = A("/assets/elements/pp.png");
const ICON_REMB_PA = A("/assets/elements/rembPA.png");
const resAsset: Record<Element, string> = {
  terre: A("/assets/elements/resTerre.png"),
  feu: A("/assets/elements/resFeu.png"),
  eau: A("/assets/elements/resEau.png"),
  air: A("/assets/elements/resAir.png"),
};

// --- Combat ------------------------------------------------------------------
export function beginCombat(
  cs: Combatant[],
  titreCombat: string,
  meta: Meta | null = null,
): void {
  combatants = cs;
  titre = titreCombat;
  metaCombat = meta;
  logLines = [];
  activeActeur = null;
  selectedSpell = null;
  combatMonte = false; // nouveau combat → (re)construire le squelette une fois
  render();
  snapshotFx(cs); // état de départ : aucun « delta » au premier affichage
}

/** Re-render entre deux actions (appelé par le moteur). */
export function onUpdate(): void {
  render();
  flushFx(); // nombres flottants / flash / mort, déduits du diff d'état
}

// --- Effets visuels de combat (« juice ») ------------------------------------
// Découplé du moteur (qui reste pur) : on déduit dégâts/soin/mort en comparant
// l'état courant des combattants à un instantané pris au render précédent. Les
// éléments vivent dans une couche overlay (fixed) qui survit au re-render des cartes.
interface FxSnap {
  pv: number;
  bouclier: number;
  mort: boolean;
}
const fxSnap = new Map<string, FxSnap>();
let fxLayer: HTMLElement | null = null;
let fxJitter = 0; // décale légèrement les nombres successifs pour éviter le chevauchement

// événements visuels signalés par le moteur (crit/esquive), consommés au prochain flushFx
const fxPending = new Map<string, { crit?: boolean; esquive?: boolean }>();

/** Hook `fx` passé à runCombat : mémorise crit/esquive pour le prochain flush. */
export function fxEvent(ev: FxEvent): void {
  const p = fxPending.get(ev.ref) ?? {};
  if (ev.type === "crit") p.crit = true;
  if (ev.type === "esquive") p.esquive = true;
  fxPending.set(ev.ref, p);
}

function ensureFxLayer(): HTMLElement {
  if (!fxLayer || !fxLayer.isConnected) {
    fxLayer = document.createElement("div");
    fxLayer.className = "fx-layer";
    document.body.appendChild(fxLayer);
  }
  return fxLayer;
}

/** Mémorise l'état PV/bouclier/mort de chaque combattant (référence du diff). */
function snapshotFx(cs: Combatant[]): void {
  fxSnap.clear();
  for (const c of cs)
    fxSnap.set(c.ref, {
      pv: c.pvActuels,
      bouclier: c.bouclier,
      mort: c.pvActuels <= 0,
    });
}

/** Spawn d'un nombre flottant au-dessus de la carte du combattant `ref`. */
function spawnFloat(ref: string, texte: string, kind: string): void {
  const card = root.querySelector<HTMLElement>(`.carte[data-ref="${ref}"]`);
  if (!card) return;
  const r = card.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = `fx-num ${kind}`;
  el.textContent = texte;
  const jitter = (fxJitter++ % 3) * 16 - 16; // -16, 0, +16 px
  el.style.left = `${r.left + r.width / 2 + jitter}px`;
  el.style.top = `${r.top + r.height * 0.32}px`;
  el.addEventListener("animationend", () => el.remove());
  ensureFxLayer().appendChild(el);
}

/** Flash bref sur la carte touchée (pulse rouge) — indépendant du re-render. */
function spawnFlash(ref: string): void {
  const card = root.querySelector<HTMLElement>(`.carte[data-ref="${ref}"]`);
  if (!card) return;
  const r = card.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "fx-flash";
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  el.addEventListener("animationend", () => el.remove());
  ensureFxLayer().appendChild(el);
}

/** Compare l'état courant à l'instantané et déclenche les effets, puis ré-instantane. */
function flushFx(): void {
  for (const c of combatants) {
    const prev = fxSnap.get(c.ref);
    if (!prev) continue; // combattant inconnu (ne devrait pas arriver)
    const pvLoss = Math.max(0, prev.pv - c.pvActuels);
    const shieldLoss = Math.max(0, prev.bouclier - c.bouclier);
    const degats = pvLoss + shieldLoss; // dégâts encaissés (PV + bouclier absorbé)
    const soin = Math.max(0, c.pvActuels - prev.pv);
    const bouclierGagne = Math.max(0, c.bouclier - prev.bouclier);

    const pend = fxPending.get(c.ref);
    if (degats > 0) {
      // coup critique : nombre doré avec « ! » ; sinon nombre de dégâts classique
      if (pend?.crit) spawnFloat(c.ref, `-${degats} !`, "crit");
      else spawnFloat(c.ref, `-${degats}`, "dmg");
      spawnFlash(c.ref);
    }
    if (pend?.esquive) spawnFloat(c.ref, "Esquive !", "esquive");
    if (soin > 0) spawnFloat(c.ref, `+${soin}`, "soin");
    if (bouclierGagne > 0) spawnFloat(c.ref, `+${bouclierGagne}`, "bouclier");
    if (!prev.mort && c.pvActuels <= 0) spawnFloat(c.ref, "K.O.", "mort");
  }
  fxPending.clear();
  snapshotFx(combatants);
}

/** Contrôleur joueur : résolu quand le joueur choisit une action ou termine. */
export function playerController(
  acteur: Combatant,
  cs: Combatant[],
): Promise<Action | null> {
  combatants = cs;
  activeActeur = acteur;
  selectedSpell = null;
  return new Promise((res) => {
    resolver = res;
    // auto-passe : si aucune action possible et l'option est active, on termine seul
    if (config.autoFinTour && !aUneActionPossible(acteur, cs)) {
      log(`${acteur.nom} n'a plus rien à jouer — tour passé.`);
      render();
      setTimeout(() => finir(null), 350);
      return;
    }
    render();
  });
}

function finir(action: Action | null): void {
  const r = resolver;
  activeActeur = null;
  selectedSpell = null;
  resolver = null;
  render();
  r?.(action);
}

/** Choisit un sort (clic ou raccourci) : lance direct si pas de cible à viser, sinon arme le ciblage. */
function choisirSort(s: Spell): void {
  const acteur = activeActeur;
  if (!acteur || !resolver) return;
  if (acteur.paActuels < s.coutPA) return; // pas assez de PA
  if (s.cible === "soi" || s.cible === "allie_tous") {
    finir({ sort: s, cibleRef: acteur.ref }); // pas de cible à choisir
  } else {
    selectedSpell = s;
    render();
  }
}

// Stats secondaires affichées sur la carte (mêmes formules que le moteur).
const pctCrit = (s: Stats): number =>
  Math.round(Math.min(0.5, s.force * 0.005) * 100);
const pctDmgCrit = (s: Stats): number =>
  Math.round(Math.min(0.6, 0.25 + s.agilite * 0.004) * 100);
const pctSoin = (s: Stats): number =>
  Math.round(Math.min(0.5, ((s.soin ?? 0) + s.intelligence) * 0.005) * 100);
const pctDgtsFinaux = (s: Stats): number =>
  Math.round(Math.min(0.5, s.intelligence * 0.005) * 100);
const pctRembPA = (s: Stats): number =>
  Math.round(Math.min(0.5, 0.05 + (s.chance ?? 0) * 0.005) * 100);

/**
 * Rond d'élément. `rang` = 1 (plus fort) / 2 (second). `actif` = élément de frappe courant.
 * `switchable` (alliés) rend le rond cliquable pour choisir l'élément de frappe.
 */
function elemRond(
  el: Element,
  rang: number,
  actif: boolean,
  switchable: boolean,
): string {
  const cls = [
    "elem-rond",
    `elem-${el}`,
    actif ? "frappe" : "",
    switchable ? "switch" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const titre = actif
    ? `Élément de frappe — ${elNom[el]}`
    : switchable
      ? `Frapper en ${elNom[el]} (cliquer)`
      : `Élément ${rang === 1 ? "principal" : "secondaire"} — ${elNom[el]}`;
  return `<span class="${cls}" ${switchable ? `data-switch="${el}"` : ""} data-tip="${escapeHtml(titre)}">
    <img src="${elementAsset(el)}" alt="" onerror="this.remove()" /><i>${rang}</i>${actif ? `<b class="frappe-pic">⚔</b>` : ""}</span>`;
}

/**
 * Indicateur de collection d'Archimonstre (coin haut-droit du mob) : présent
 * uniquement sur les espèces qui ont un Archimonstre réel. Opaque si l'espèce
 * est déjà capturée, translucide sinon.
 */
function archiIndicateur(c: Combatant): string {
  if (c.camp !== "ennemi" || !c.archiNom) return "";
  const capture = !!(c.monstreId && metaCombat?.archis.includes(c.monstreId));
  const titre = capture
    ? `Archimonstre capturé : ${c.archiNom}`
    : `Archimonstre à capturer : ${c.archiNom}`;
  return `<img class="archi-badge ${capture ? "capture" : ""}" src="${A("/assets/divers/Archmonster.webp")}" alt="" title="${escapeHtml(titre)}" onerror="this.remove()" />`;
}

function carteCombattant(c: Combatant, clickable: boolean): string {
  const ko = c.pvActuels <= 0;
  const pvCur = Math.max(0, Math.round(c.pvActuels));
  const pvPct = c.pvMax > 0
    ? Math.max(0, Math.min(100, Math.round((c.pvActuels / c.pvMax) * 100)))
    : 0;
  const bouclier = Math.round(c.bouclier);
  // chips de résistance : les 4 éléments, toujours affichés (0 % inclus), en grille 2×2
  const resChips = ELEMENTS.map((e) => {
    const v = Math.round((c.resistances[e] ?? 0) * 100);
    const etat = v < 0 ? "faible" : v === 0 ? "zero" : "";
    return `<span class="res-chip ${etat}" title="Résistance ${elNom[e]}"><img src="${resAsset[e]}" alt="" onerror="this.remove()" />${v > 0 ? "+" : ""}${v}%</span>`;
  }).join("");
  const badges: string[] = [];
  for (const e of c.effets) {
    if (e.stat === "vitalite") badges.push(`+PV (${e.toursRestants})`);
    else if (e.stat === "degatsInfliges")
      badges.push(`−dégâts (${e.toursRestants})`);
    else if (e.stat === "poison") badges.push(`☠ poison (${e.toursRestants})`);
    else if (e.stat === "hot") badges.push(`♥ soin/t (${e.toursRestants})`);
    else if (e.stat === "initiative")
      badges.push(`⏳ init ${e.valeur} (${e.toursRestants})`);
    else if (e.stat === "contre")
      badges.push(`⚔️ Contre ${Math.round(e.valeur * 100)} % (${e.toursRestants})`);
  }
  if (c.provoque) badges.push(`🛡 Provoque`);
  if (c.bonusOffensifProchain > 0)
    badges.push(`+${Math.round(c.bonusOffensifProchain * 100)} % prochain`);
  if (c.maxRollCharges > 0) badges.push(`Œil affûté ×${c.maxRollCharges}`);
  if (c.paBonusNextTurn > 0) badges.push(`+${c.paBonusNextTurn} PA`);

  const ligne = estAvant(c) ? "avant" : "arriere";

  const classes = [
    "carte",
    c.camp === "joueur" ? "carte-joueur" : "carte-ennemi",
    `ligne-${ligne}`,
    ko ? "ko" : "",
    c === activeActeur ? "actif" : "",
    clickable ? "ciblable" : "",
    c.archi ? "archi" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${classes}" data-ref="${c.ref}">
      <div class="carte-tete">
        <span class="carte-nom">${escapeHtml(c.nom)}</span>
        <span class="rang rang-${ligne}">${ligne === "avant" ? "AVANT" : "ARR."}</span>
      </div>
      <div class="portrait-wrap">
        ${c.img ? `<img class="portrait" src="${A(c.img)}" alt="" onerror="this.remove()" />` : `<div class="portrait"></div>`}
        ${archiIndicateur(c)}
        <span class="pa-gem" title="${c.paActuels} / ${c.paMax} PA"><img src="${PA_ICON}" alt="" onerror="this.remove()" /><b>${c.paActuels}</b></span>
        <span class="pv-gem ${ko ? "ko" : ""} ${bouclier > 0 ? "protege" : ""}" title="${pvCur} / ${c.pvMax} PV${bouclier > 0 ? ` · ${bouclier} bouclier` : ""}" style="--pv-pct:${pvPct}%">
          <img class="pv-vide" src="${COEUR_PLEIN}" alt="" onerror="this.remove()" />
          <img class="pv-plein" src="${COEUR_PLEIN}" alt="" onerror="this.remove()" />
          <b class="pv-num">${pvCur}<span>/${c.pvMax}</span></b>
          ${bouclier > 0 ? `<span class="pv-bouclier" title="Bouclier">${bouclier}</span>` : ""}
        </span>
      </div>
      <div class="mini-stats">
        <span class="ms" title="Coup critique (Force)"><img src="${ICON_CRIT}" alt="" onerror="this.remove()" />${pctCrit(c.stats)}%</span>
        <span class="ms" title="Dégâts critiques (Agilité)"><img src="${ICON_DMGCRIT}" alt="" onerror="this.remove()" />${pctDmgCrit(c.stats)}%</span>
        <span class="ms" title="Soins (Soin + Intelligence)"><img src="${ICON_SOIN}" alt="" onerror="this.remove()" />${pctSoin(c.stats)}%</span>
        <span class="ms" title="Dégâts finaux (Intelligence)"><img src="${ICON_PUISS}" alt="" onerror="this.remove()" />${pctDgtsFinaux(c.stats)}%</span>
        ${(c.stats.chance ?? 0) > 0 ? `<span class="ms" title="Chance de remboursement PA (Chance)"><img src="${ICON_REMB_PA}" alt="" onerror="this.remove()" />${pctRembPA(c.stats)}%</span>` : ""}
      </div>
      ${c.camp === "joueur" ? `<div class="pp-row" title="Prospection"><img src="${ICON_PP}" alt="" onerror="this.remove()" /><b>${c.stats.prospection ?? 0}</b></div>` : ""}
      ${resChips ? `<div class="res-row">${resChips}</div>` : ""}
      <div class="badges">${badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}</div>
      ${ko ? `<div class="ko-label">K.O.</div>` : ""}
    </div>`;
}

function render(): void {
  if (!root) return;

  // cibles cliquables pour le sort sélectionné
  const ciblesActuelles =
    activeActeur && selectedSpell
      ? ciblesValides(activeActeur, selectedSpell, combatants)
      : [];
  const estCiblable = (c: Combatant) =>
    ciblesActuelles.some((t) => t.ref === c.ref);

  // un camp = deux rangées de grille (avant = cases 0-3, arrière = 4-7), triées par colonne
  const renderCamp = (camp: Camp): string => {
    const membres = combatants
      .filter((c) => c.camp === camp)
      .sort((a, b) => a.position - b.position);
    const grp = (titreLigne: string, liste: Combatant[]) =>
      `<div class="ligne-col">
         <span class="ligne-label">${titreLigne}</span>
         <div class="ligne-cards">${liste.map((c) => carteCombattant(c, estCiblable(c))).join("") || `<span class="ligne-vide">—</span>`}</div>
       </div>`;
    const avant = grp("Ligne avant", membres.filter(estAvant));
    const arriere = grp(
      "Ligne arrière",
      membres.filter((c) => !estAvant(c)),
    );
    const sep = `<img class="ligne-sep" src="${A("/assets/divers/delimiter.png")}" alt="" onerror="this.remove()" />`;
    // les deux lignes côte à côte ; l'arrière est « derrière » = côté extérieur
    // (gauche pour le joueur, droite pour l'ennemi) → les lignes avant se font face au centre,
    // séparées par le délimiteur avant/arrière
    return `<div class="camp-lignes ${camp}">${camp === "joueur" ? arriere + sep + avant : avant + sep + arriere}</div>`;
  };

  // Squelette construit UNE fois par combat : le chrome statique (titre, panneaux,
  // structure) n'est plus détruit/recréé à chaque render → fini le blink/stutter.
  // Ensuite seules les sections dynamiques sont mises à jour.
  if (!combatMonte) {
    root.innerHTML = `
      <div class="combat">
        <h2 class="titre-combat">${escapeHtml(titre)}</h2>
        <div id="cb-timeline"></div>
        <div class="plateau">
          <div class="colonne">
            <h3>Équipe</h3>
            <div id="cb-joueur" class="camp-host"></div>
          </div>
          <div class="colonne">
            <h3>Ennemis <span class="hint">— seuls les 2 premiers (AVANT) sont à portée des sorts de ligne</span></h3>
            <div id="cb-ennemi" class="camp-host"></div>
          </div>
        </div>
        <div class="zone-bas">
          <div id="journal" class="journal"></div>
          <div id="cb-barre" class="barre-sorts"></div>
        </div>
      </div>`;
    combatMonte = true;
  }

  const setHTML = (id: string, html: string) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  setHTML("cb-timeline", renderTimeline());
  setHTML("cb-joueur", renderCamp("joueur"));
  setHTML("cb-ennemi", renderCamp("ennemi"));
  setHTML("cb-barre", renderBarreSorts());

  // ré-affiche le log
  rafraichirJournal();

  // clics sur les cibles — carte OU pastille de timeline du même combattant
  if (activeActeur && selectedSpell) {
    root
      .querySelectorAll<HTMLElement>(".carte.ciblable, .tl-pastille.ciblable")
      .forEach((el) => {
        el.addEventListener("click", () => {
          finir({ sort: selectedSpell!, cibleRef: el.dataset.ref! });
        });
      });
  }

  // survol croisé : passer la souris sur une carte OU sa pastille highlight les deux
  root.querySelectorAll<HTMLElement>("[data-ref]").forEach((el) => {
    const ref = el.dataset.ref!;
    const lies = () => root.querySelectorAll<HTMLElement>(`[data-ref="${ref}"]`);
    el.addEventListener("mouseenter", () => lies().forEach((x) => x.classList.add("lie-survol")));
    el.addEventListener("mouseleave", () => lies().forEach((x) => x.classList.remove("lie-survol")));
  });

  // choix de l'élément de frappe de l'acteur courant : clic sur un rond du sélecteur (barre de sorts)
  root
    .querySelectorAll<HTMLElement>(".elem-select .elem-rond.switch")
    .forEach((rond) => {
      rond.addEventListener("click", () => {
        const el = rond.dataset.switch as Element | undefined;
        if (activeActeur && el) {
          activeActeur.elementChoisi = el;
          render();
        }
      });
    });
}

/** Initiative effective (base + effets) — pour l'ordre des tours affiché. */
function initEffective(c: Combatant): number {
  return (
    c.initiative +
    c.effets
      .filter((e) => e.stat === "initiative")
      .reduce((s, e) => s + e.valeur, 0)
  );
}

/** Timeline d'ordre des tours (combattants vivants triés par initiative). */
function renderTimeline(): string {
  const ordre = combatants
    .filter((c) => c.pvActuels > 0 && !c.estInvocation)
    .sort((a, b) => initEffective(b) - initEffective(a));
  if (ordre.length < 2) return "";
  // pastille ciblable = combattant valide pour le sort en cours de ciblage
  const cibles =
    activeActeur && selectedSpell ? ciblesValides(activeActeur, selectedSpell, combatants) : [];
  const items = ordre
    .map((c) => {
      const camp = c.camp === "joueur" ? "joueur" : "ennemi";
      const actif = c === activeActeur ? "actif" : "";
      const ciblable = cibles.some((t) => t.ref === c.ref) ? "ciblable" : "";
      const inner = c.img
        ? `<img src="${A(c.img)}" alt="" onerror="this.remove()" />`
        : `<span class="tl-ini">${initEffective(c)}</span>`;
      return `<div class="tl-pastille ${camp} ${actif} ${ciblable}" data-ref="${c.ref}" title="${escapeHtml(c.nom)} · init ${initEffective(c)}">${inner}</div>`;
    })
    .join("");
  return `<div class="timeline"><div class="tl-liste">${items}</div></div>`;
}

function renderBarreSorts(): string {
  if (!activeActeur) {
    return `<div class="attente">En attente…</div>`;
  }
  const acteur = activeActeur;
  // case 1 : attaque d'arme si une arme est équipée, sinon placeholder « corps à corps »
  const arme = acteur.armeSort;
  const cac = arme
    ? `<button class="sort ${selectedSpell?.id === arme.id ? "choisi" : ""}" data-arme="1" ${
        acteur.paActuels >= arme.coutPA ? "" : "disabled"
      } title="${escapeHtml(arme.nom)} — attaque d'arme">
        <span class="sort-touche">1</span>
        <span class="sort-pa-badge"><img src="${PA_ICON}" alt="" onerror="this.remove()" /><b>${arme.coutPA}</b></span>
        <span class="sort-icon-wrap"><img class="sort-icon" src="${arme.img ? A(arme.img) : ""}" alt="" onerror="this.closest('.sort-icon-wrap')?.remove()" /></span>
      </button>`
    : `<div class="sort sort-cac" title="Corps à corps — aucune arme équipée">
        <span class="sort-touche">1</span>
        <span class="sort-icon-vide">🗡️</span>
      </div>`;
  const boutons =
    cac +
    acteur.sorts
      .map((id) => SORTS[id])
      .map((s, i) => {
        const cd = acteur.cooldowns[s.id] ?? 0; // cooldown par sort (côté lanceur)
        const abordable = acteur.paActuels >= s.coutPA && cd <= 0;
        const choisi = selectedSpell?.id === s.id;
        return `<button class="sort ${choisi ? "choisi" : ""} ${cd > 0 ? "cooldown" : ""}" data-sort="${s.id}" ${
          abordable ? "" : "disabled"
        }>
        <span class="sort-touche">${i + 2}</span>
        <span class="sort-pa-badge"><img src="${PA_ICON}" alt="" onerror="this.remove()" /><b>${s.coutPA}</b></span>
        <span class="sort-icon-wrap"><img class="sort-icon" src="${sortIcon(s.id)}" alt="" onerror="this.closest('.sort-icon-wrap')?.remove()" /></span>
        ${cd > 0 ? `<span class="sort-cd" title="Rechargement : ${cd} tour(s)">${cd}</span>` : ""}
      </button>`;
      })
      .join("");

  // listeners attachés après insertion via microtask
  queueMicrotask(() => {
    root
      .querySelectorAll<HTMLButtonElement>("button.sort[data-sort]")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          choisirSort(SORTS[btn.dataset.sort!]),
        );
      });
    // case 1 : attaque d'arme
    root
      .querySelector<HTMLButtonElement>("button.sort[data-arme]")
      ?.addEventListener("click", () => {
        if (activeActeur?.armeSort) choisirSort(activeActeur.armeSort);
      });
    const fin = document.getElementById("fin-tour");
    fin?.addEventListener("click", () => finir(null));
  });

  const aide = selectedSpell
    ? `<div class="aide">Choisis une cible pour <b>${escapeHtml(selectedSpell.nom)}</b>.</div>`
    : `<div class="aide">Tour de <b>${escapeHtml(acteur.nom)}</b> — choisis un sort.</div>`;

  // sélecteur d'élément de frappe (les 2 plus forts), vertical, à gauche des sorts
  const [principal, secondaire] = elementsForts(acteur);
  const actif = elementDeFrappe(acteur);
  const selecteur =
    acteur.camp === "joueur"
      ? `<div class="elem-select">
         <span class="elem-info" data-tip="${escapeHtml(ELEMENT_AIDE)}">i</span>
         ${elemRond(principal, 1, principal === actif, true)}
         ${elemRond(secondaire, 2, secondaire === actif, true)}
       </div>`
      : "";

  return `
    <div class="sorts-rangee">
      <div class="sorts-zone">${selecteur}<div class="sorts-liste">${boutons}</div></div>
      <div class="barre-actions-fin"><button id="fin-tour" class="fin-tour primaire">Terminer le tour <kbd>${escapeHtml(libelleTouche(config.toucheFinTour))}</kbd></button></div>
    </div>
    ${aide}`;
}

// --- Écrans ------------------------------------------------------------------
function ecran(html: string): void {
  root.innerHTML = `<div class="ecran">${html}</div>`;
}

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
          <img src="${d.img ? A(d.img) : ""}" alt="${escapeHtml(d.nom)}" onerror="this.remove()" />
          ${n > 1 ? `<span class="dofus-count">×${n}</span>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="dofus-rack ${compact ? "compact" : ""}">${slots}</div>`;
}

/** Infos affichées pour proposer la reprise d'une run sauvegardée. */
export interface RepriseInfo {
  zoneNom: string;
  zoneNum: number;
  nbZones: number;
}

export type StartAction = "nouvelle" | "reprendre" | "abandonner";

export function showStart(
  meta: Meta,
  onReset: () => void,
  reprise: RepriseInfo | null = null,
): Promise<StartAction> {
  return new Promise((res) => {
    const nbUniques = new Set(meta.dofus).size;
    const total = Object.keys(DOFUS).length;

    // run en cours : Reprendre (principal) + Abandonner ; sinon : Jouer
    const boutons = reprise
      ? `<button id="btn-reprendre" class="btn-jouer btn-reprendre" title="Reprendre la run — Zone ${reprise.zoneNum}/${reprise.nbZones} : ${escapeHtml(reprise.zoneNom)}"><img src="${BTN_JOUER}" alt="Reprendre" onerror="this.remove()" /></button>
         <button id="btn-abandon" class="secondaire">Abandonner la run</button>`
      : `<button id="btn-start" class="btn-jouer" title="Lancer une run"><img src="${BTN_JOUER}" alt="Jouer" onerror="this.remove()" /></button>`;

    ecran(`
      <div class="coin-menu">
        <button id="btn-dofus" class="coin-param" title="Dofus"><img src="${MENU_DOFUS}" alt="Dofus" onerror="this.remove()" /></button>
        <button id="btn-bestiaire" class="coin-param" title="Bestiaire"><img src="${MENU_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /></button>
        <button id="btn-succes" class="coin-param" title="Succès"><img src="${MENU_SUCCES}" alt="Succès" onerror="this.remove()" /></button>
        <button id="btn-settings" class="coin-param" title="Paramètres"><img src="${MENU_PARAM}" alt="Paramètres" onerror="this.remove()" /></button>
      </div>
      <img class="logo-accueil" src="${LOGO}" alt="Roguefus Lite" onerror="this.remove()" />
      <p class="sous-titre">Choisis 2 héros, recrute aux tavernes (4 max), traverse le plateau jusqu'au boss. Les PV se conservent ; seuls les Dofus survivent à la mort.</p>
      <p class="accueil-dofus-compte">Dofus collectés : <b>${nbUniques}/${total}</b></p>
      <p class="accueil-runs-compte">Runs : <b>${meta.runs}</b> · Réussies : <b>${meta.victoires}</b></p>
      ${reprise ? `<p class="accueil-reprise">⚔ Run en cours — <b>Zone ${reprise.zoneNum}/${reprise.nbZones} : ${escapeHtml(reprise.zoneNom)}</b></p>` : ""}
      <div class="tranches-rack">
        ${TRANCHES.map((t) => `
          <div class="tranche-carte ${t.active ? "active" : "locked"}" title="${t.active ? `${t.zones.length} zones` : "Bientôt disponible"}">
            <span class="tranche-nom">${escapeHtml(t.nom)}</span>
            <span class="tranche-niveaux">Niv. ${t.niveaux[0]}${t.niveaux[1] !== t.niveaux[0] ? `–${t.niveaux[1]}` : ""}</span>
            <span class="tranche-detail">${t.active ? `${t.zones.length} zones` : "🔒 Verrouillé"}</span>
          </div>`).join("")}
      </div>
      <div class="boutons-ecran">
        ${boutons}
        ${meta.dofus.length ? `<button id="btn-reset" class="secondaire">Réinitialiser les Dofus</button>` : ""}
      </div>
    `);
    document
      .getElementById("btn-settings")
      ?.addEventListener("click", async () => {
        await showSettings();
        showStart(meta, onReset, reprise).then(res);
      });
    document
      .getElementById("btn-succes")
      ?.addEventListener("click", async () => {
        await showSucces(meta);
        showStart(meta, onReset, reprise).then(res);
      });
    document
      .getElementById("btn-bestiaire")
      ?.addEventListener("click", async () => {
        await showBestiaire(meta);
        showStart(meta, onReset, reprise).then(res);
      });
    document
      .getElementById("btn-dofus")
      ?.addEventListener("click", async () => {
        await showCollectionDofus(meta);
        showStart(meta, onReset, reprise).then(res);
      });
    document
      .getElementById("btn-start")
      ?.addEventListener("click", () => res("nouvelle"));
    document
      .getElementById("btn-reprendre")
      ?.addEventListener("click", () => res("reprendre"));
    document
      .getElementById("btn-abandon")
      ?.addEventListener("click", () => res("abandonner"));
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      onReset();
      showStart(meta, onReset, reprise).then(res);
    });
  });
}

// Rôle court par classe (écran de choix d'équipe / recrutement).
const ROLE_CLASSE: Record<string, string> = {
  iop: "Bourrin — gros dégâts Terre au corps à corps",
  cra: "Archère — dégâts Air à distance, esquive",
  eniripsa: "Soigneuse — soins, boucliers, poisons",
  sadida: "Invocateur — poupée, contrôle, dégâts sur la durée",
  sram: "Assassin — DPT monocible & poisons",
  feca: "Protecteur — boucliers, glyphes, réduction de dégâts",
  ecaflip: "Joueur — mixte, hasard (dés & cartes)",
};

/** Carte de classe (portrait + rôle) pour le choix d'équipe / recrutement. */
function carteClasse(classeId: string, sel: boolean, dataAttr: string): string {
  const c = CLASSES[classeId];
  return `<button class="classe-carte ${sel ? "sel" : ""}" ${dataAttr}="${classeId}">
    <img class="classe-portrait" src="${classe_img(classeId)}" alt="" onerror="this.remove()" />
    <span class="classe-nom">${escapeHtml(c.nom)}</span>
    <span class="classe-role">${escapeHtml(ROLE_CLASSE[classeId] ?? "")}</span>
  </button>`;
}
const classe_img = (classeId: string): string =>
  A(CLASSES[classeId]?.img ?? `/assets/classes/${classeId}.png`);

/** Écran de départ : choisir 2 classes parmi les classes jouables pour commencer la run. */
export function showChoixEquipe(): Promise<string[]> {
  return new Promise((res) => {
    const choix: string[] = [];
    const draw = () => {
      const cartes = classesDisponibles()
        .map((id) => carteClasse(id, choix.includes(id), "data-classe"))
        .join("");
      ecran(`
        <h1>Compose ton équipe de départ</h1>
        <p class="sous-titre">Choisis <b>2 classes</b> pour commencer. Tu pourras en recruter d'autres dans les tavernes (équipe de 4 max).</p>
        <div class="choix-grille">${cartes}</div>
        <div class="boutons-ecran">
          <button id="choix-go" class="btn-jouer" title="Jouer" ${choix.length === 2 ? "" : "disabled"}><img src="${BTN_JOUER}" alt="Jouer" onerror="this.remove()" /></button>
          <span class="choix-compte">${choix.length}/2</span>
        </div>
      `);
      root
        .querySelectorAll<HTMLButtonElement>(".classe-carte")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.classe!;
            const i = choix.indexOf(id);
            if (i >= 0) choix.splice(i, 1);
            else if (choix.length < 2) choix.push(id);
            draw();
          });
        });
      document.getElementById("choix-go")?.addEventListener("click", () => {
        if (choix.length === 2) res([...choix]);
      });
    };
    draw();
  });
}

/** Décision prise à la taverne. */
export type ActionTaverne =
  | { type: "soin" }
  | { type: "recrue"; classeId: string; remplace?: string };

/**
 * Taverne : soigner l'équipe OU recruter l'une des 2 classes proposées.
 * Si l'équipe est pleine, recruter demande quel membre remplacer.
 */
export function showTaverne(
  persos: PersoState[],
  propositions: string[],
  soinPct: number,
): Promise<ActionTaverne> {
  return new Promise((res) => {
    let recrueEnCours: string | null = null; // classe choisie, en attente du remplacement
    const pleine = persos.length >= 4;

    const draw = () => {
      if (recrueEnCours) {
        // choisir le membre à remplacer
        const membres = persos
          .map((p) => carteClasse(p.classeId, false, "data-remplace"))
          .join("");
        ecran(`
          <h1>🍺 Recruter ${escapeHtml(CLASSES[recrueEnCours].nom)}</h1>
          <p class="sous-titre">L'équipe est pleine. Choisis le membre à remplacer.</p>
          <div class="choix-grille">${membres}</div>
          <div class="boutons-ecran"><button id="tav-annuler" class="secondaire">Annuler</button></div>
        `);
        root
          .querySelectorAll<HTMLButtonElement>(".classe-carte")
          .forEach((btn) => {
            btn.addEventListener("click", () =>
              res({
                type: "recrue",
                classeId: recrueEnCours!,
                remplace: btn.dataset.remplace!,
              }),
            );
          });
        document
          .getElementById("tav-annuler")
          ?.addEventListener("click", () => {
            recrueEnCours = null;
            draw();
          });
        return;
      }

      const recrues = propositions.length
        ? `<h3>Recruter (2 candidats)</h3>
           <div class="choix-grille">${propositions.map((id) => carteClasse(id, false, "data-recrue")).join("")}</div>`
        : `<p class="muet">Aucune classe à recruter (toutes déjà dans l'équipe).</p>`;
      ecran(`
        <h1>🍺 Taverne</h1>
        <p class="sous-titre">Soigne ton équipe, ou recrute un nouveau membre.</p>
        <div class="boutons-ecran">
          <button id="tav-soin" class="primaire">Soigner (+${Math.round(soinPct * 100)} % PV)</button>
        </div>
        ${recrues}
      `);
      document
        .getElementById("tav-soin")
        ?.addEventListener("click", () => res({ type: "soin" }));
      root
        .querySelectorAll<HTMLButtonElement>(".classe-carte")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.recrue!;
            if (pleine) {
              recrueEnCours = id;
              draw();
            } else {
              res({ type: "recrue", classeId: id });
            }
          });
        });
    };
    draw();
  });
}

/**
 * Écran Formation (depuis le plateau) : grille 4×2 (cases 0-3 = ligne avant,
 * 4-7 = arrière). Place librement l'équipe (tout devant, mono-tank…) en
 * sélectionnant un perso puis une case (vide = déplacer, occupée = échanger).
 * Effet dès le prochain combat, sauvegardé pour les runs suivantes.
 */
export function showFormation(persos: PersoState[]): Promise<void> {
  return new Promise((res) => {
    let selCell = -1; // case sélectionnée
    const occupant = (cell: number) => persos.find((p) => p.position === cell);
    const enregistrer = () => {
      // la config ne retient que la RANGÉE préférée (le placement exact vit dans PersoState.position)
      config.formation = Object.fromEntries(
        persos.map((p) => [p.classeId, p.position < 4 ? "avant" : "arriere"] as const),
      );
      sauverConfig(config);
    };

    const cellule = (cell: number): string => {
      const p = occupant(cell);
      const sel = selCell === cell ? "sel" : "";
      const inner = p
        ? `<img src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" /><span>${escapeHtml(CLASSES[p.classeId].nom)}</span>${pastillesElements(p)}`
        : `<span class="form-vide">+</span>`;
      return `<button class="form-cell ${p ? "" : "vide"} ${sel}" data-cell="${cell}" ${p ? `draggable="true"` : ""}>${inner}</button>`;
    };
    const rangee = (cells: number[]) => cells.map(cellule).join("");

    // déplace/échange l'occupant de `src` vers `dst`
    const deplacer = (src: number, dst: number) => {
      if (src === dst) return;
      const a = occupant(src);
      const b = occupant(dst);
      if (a) a.position = dst;
      if (b) b.position = src; // échange si la case d'arrivée est occupée
      selCell = -1;
      enregistrer();
      draw();
    };

    const draw = () => {
      ecran(`
        <h1>Formation</h1>
        <p class="sous-titre">Glisse-dépose un perso sur une case pour le déplacer (ou l'échanger) — ou clique-le puis clique la case. La <b>ligne avant</b> encaisse les sorts de ligne ennemis ; la <b>ligne arrière</b> est protégée. Effet dès le prochain combat.</p>
        <div class="formation-grille">
          <div class="form-rangee"><span class="form-ligne-lbl">Ligne avant</span><div class="form-cells">${rangee([0, 1, 2, 3])}</div></div>
          <div class="form-rangee arriere"><span class="form-ligne-lbl">Ligne arrière</span><div class="form-cells">${rangee([4, 5, 6, 7])}</div></div>
        </div>
        <div class="form-elements">
          <h2>Élément &amp; montée en niveau</h2>
          <p class="sous-titre">Choisis un élément : c'est ton élément de frappe et les points de niveau y vont automatiquement. <b>Libre</b> = tu répartis toi-même (l'élément de frappe est alors ta plus haute carac).</p>
          ${persos.map((p) => `
            <div class="form-el-perso">
              <img class="form-el-sym" src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
              <span class="form-el-nom">${escapeHtml(CLASSES[p.classeId].nom)}</span>
              <div class="form-el-choix">
                ${ELEMENTS.map((el) => `<button class="form-el-btn elem-${el} ${p.elementChoisi === el ? "sel" : ""}" data-perso="${p.classeId}" data-el="${el}" title="${elNom[el]} · points → ${STAT_NOM[STAT_PAR_ELEMENT[el]]}"><img src="${elementAsset(el)}" alt="" onerror="this.remove()" /><span>${elNom[el]}</span></button>`).join("")}
                <button class="form-el-btn libre ${p.elementChoisi ? "" : "sel"}" data-perso="${p.classeId}" data-el="libre" title="Allocation manuelle">Libre</button>
              </div>
            </div>`).join("")}
        </div>
        <div class="boutons-ecran"><button id="form-retour" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      root.querySelectorAll<HTMLButtonElement>(".form-el-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = persos.find((x) => x.classeId === btn.dataset.perso);
          if (!p) return;
          const el = btn.dataset.el;
          appliquerElement(p, el === "libre" ? null : (el as Element));
          draw();
        });
      });
      root.querySelectorAll<HTMLButtonElement>(".form-cell").forEach((btn) => {
        const cell = Number(btn.dataset.cell);
        // — clic : sélection puis déplacement (fallback)
        btn.addEventListener("click", () => {
          if (selCell < 0) {
            if (occupant(cell)) {
              selCell = cell;
              draw();
            } // on ne sélectionne qu'une case occupée
          } else if (selCell === cell) {
            selCell = -1;
            draw();
          } else {
            deplacer(selCell, cell);
          }
        });
        // — glisser-déposer
        btn.addEventListener("dragstart", (e) => {
          if (!occupant(cell)) {
            e.preventDefault();
            return;
          }
          e.dataTransfer!.setData("text/plain", String(cell));
          e.dataTransfer!.effectAllowed = "move";
          btn.classList.add("drag-src");
        });
        btn.addEventListener("dragend", () => btn.classList.remove("drag-src"));
        btn.addEventListener("dragover", (e) => {
          e.preventDefault();
          btn.classList.add("drop-cible");
        });
        btn.addEventListener("dragleave", () =>
          btn.classList.remove("drop-cible"),
        );
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          btn.classList.remove("drop-cible");
          const src = Number(e.dataTransfer!.getData("text/plain"));
          if (!Number.isNaN(src)) deplacer(src, cell);
        });
      });
      document.getElementById("form-retour")?.addEventListener("click", () => {
        enregistrer();
        res();
      });
    };
    draw();
  });
}

// --- Équipement --------------------------------------------------------------
const SLOTS: EquipSlot[] = [
  "arme",
  "coiffe",
  "cape",
  "anneau",
];
const SLOT_NOM: Record<EquipSlot, string> = {
  arme: "Arme",
  coiffe: "Coiffe",
  cape: "Cape",
  anneau: "Anneau",
};
const STAT_ABBR: Partial<Record<keyof Stats, string>> = {
  vitalite: "Vita",
  force: "For",
  intelligence: "Int",
  agilite: "Agi",
  chance: "Cha",
  soin: "Soin",
  prospection: "PP",
};
const itemImg = (id: string): string => A(`/assets/items/${id}.png`);

/** Résumé textuel d'un set de stats rollées (+ PV plats / résistances optionnels). */
function itemLignes(
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

/** Écran Équipement : équiper/déséquiper les pièces trouvées, par personnage. */
export function showInventaire(
  persos: PersoState[],
  inventaire: ItemInstance[],
): Promise<void> {
  return new Promise((res) => {
    let sel = 0; // index du perso sélectionné
    const draw = () => {
      // le re-render reconstruit tout l'écran : on préserve les positions de
      // scroll (page + liste d'inventaire) pour ne pas remonter en haut au clic
      const scrollInv = root.querySelector<HTMLElement>(".equip-inv")?.scrollTop ?? 0;
      const scrollPage = document.scrollingElement?.scrollTop ?? 0;
      const perso = persos[sel];
      const onglets = persos
        .map(
          (
            p,
            i,
          ) => `<button class="equip-onglet ${i === sel ? "sel" : ""}" data-perso="${i}">
          <img src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />${escapeHtml(CLASSES[p.classeId].nom)}</button>`,
        )
        .join("");

      const slots = SLOTS.map((slot) => {
        const inst = perso.equipement[slot];
        const item = inst ? ITEMS[inst.id] : undefined;
        return `<div class="equip-slot ${item ? "rempli" : "vide"}" data-slot="${slot}" ${item ? `data-desequip="${slot}" draggable="true"` : ""}>
          <span class="slot-nom">${SLOT_NOM[slot]}</span>
          ${
            item && inst
              ? `<img class="slot-img" src="${itemImg(item.id)}" alt="" onerror="this.remove()" /><span class="slot-item">${escapeHtml(item.nom)}<small>${itemLignes(inst.stats) || "—"}</small></span>`
              : `<span class="slot-vide-txt">— vide —</span>`
          }
        </div>`;
      }).join("");

      // bonus de panoplie en cours pour ce perso
      const compte: Record<string, number> = {};
      for (const s of SLOTS) {
        const inst = perso.equipement[s];
        const it = inst ? ITEMS[inst.id] : undefined;
        if (it) compte[it.panoplie] = (compte[it.panoplie] ?? 0) + 1;
      }
      const panoTxt = Object.entries(compte)
        .map(([pid, n]) => `${PANOPLIES[pid]?.nom ?? pid} ${n}/${PANOPLIES[pid]?.pieces.length ?? 6}`)
        .join(" · ");

      const inv = inventaire.length
        ? inventaire
            .map((inst, i) => {
              const it = ITEMS[inst.id];
              return `<button class="item-carte" data-index="${i}" draggable="true">
              <img src="${itemImg(inst.id)}" alt="" onerror="this.remove()" />
              <span class="item-nom">${escapeHtml(it?.nom ?? inst.id)}<small>${SLOT_NOM[it.slot]} · ${itemLignes(inst.stats) || "—"}</small></span>
            </button>`;
            })
            .join("")
        : `<p class="muet">Inventaire vide — gagne des combats pour trouver de l'équipement.</p>`;

      const b = bonusEquipement(perso);
      const totalTxt = itemLignes(b.stats, b.pvBonus, b.resistances) || "aucun bonus";

      ecran(`
        <h1>Équipement</h1>
        <div class="equip-onglets">${onglets}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3>${escapeHtml(CLASSES[perso.classeId].nom)} · PV max ${pvMaxPerso(perso)}</h3>
            <div class="equip-slots">${slots}</div>
            <p class="equip-pano">${panoTxt || "Aucune pièce équipée"}</p>
            <p class="equip-total muet">Bonus total : ${totalTxt}</p>
          </div>
          <div class="equip-col">
            <h3>Inventaire (${inventaire.length})</h3>
            <div class="equip-inv">${inv}</div>
          </div>
        </div>
        <div class="boutons-ecran"><button id="equip-retour" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      // glisser-déposer : payload "inv:<index>" (exemplaire d'inventaire) ou "slot:<slot>" (pièce équipée)
      const equiperIndex = (index: number) => {
        if (index >= 0 && index < inventaire.length) {
          equiper(inventaire, perso, index);
          draw();
        }
      };
      const desequiperSlot = (slot: EquipSlot) => {
        desequiper(inventaire, perso, slot);
        draw();
      };

      root.querySelectorAll<HTMLButtonElement>(".equip-onglet").forEach((btn) =>
        btn.addEventListener("click", () => {
          sel = Number(btn.dataset.perso);
          draw();
        }),
      );

      root.querySelectorAll<HTMLButtonElement>(".item-carte").forEach((btn) => {
        const index = Number(btn.dataset.index);
        btn.addEventListener("click", () => equiperIndex(index)); // clic = équiper (fallback)
        btn.addEventListener("dragstart", (e) => {
          e.dataTransfer!.setData("text/plain", `inv:${index}`);
          e.dataTransfer!.effectAllowed = "move";
          btn.classList.add("drag-src");
        });
        btn.addEventListener("dragend", () => btn.classList.remove("drag-src"));
      });

      root.querySelectorAll<HTMLElement>(".equip-slot").forEach((el) => {
        const slot = el.dataset.slot as EquipSlot;
        if (el.classList.contains("rempli")) {
          el.addEventListener("click", () => desequiperSlot(slot)); // clic = déséquiper (fallback)
          el.addEventListener("dragstart", (e) => {
            e.dataTransfer!.setData("text/plain", `slot:${slot}`);
            e.dataTransfer!.effectAllowed = "move";
            el.classList.add("drag-src");
          });
          el.addEventListener("dragend", () => el.classList.remove("drag-src"));
        }
        // chaque slot accepte un objet de l'inventaire (rangé automatiquement dans le bon slot)
        el.addEventListener("dragover", (e) => {
          if (!e.dataTransfer?.types.includes("text/plain")) return;
          e.preventDefault();
          el.classList.add("drop-cible");
        });
        el.addEventListener("dragleave", () =>
          el.classList.remove("drop-cible"),
        );
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          el.classList.remove("drop-cible");
          const data = e.dataTransfer!.getData("text/plain");
          if (data.startsWith("inv:")) equiperIndex(Number(data.slice(4)));
        });
      });

      // la zone d'inventaire accepte une pièce équipée → déséquipe
      const invZone = root.querySelector<HTMLElement>(".equip-inv");
      if (invZone) {
        invZone.addEventListener("dragover", (e) => {
          if (!e.dataTransfer?.types.includes("text/plain")) return;
          e.preventDefault();
          invZone.classList.add("drop-cible");
        });
        invZone.addEventListener("dragleave", () =>
          invZone.classList.remove("drop-cible"),
        );
        invZone.addEventListener("drop", (e) => {
          e.preventDefault();
          invZone.classList.remove("drop-cible");
          const data = e.dataTransfer!.getData("text/plain");
          if (data.startsWith("slot:"))
            desequiperSlot(data.slice(5) as EquipSlot);
        });
      }

      document
        .getElementById("equip-retour")
        ?.addEventListener("click", () => res());

      // restaure les positions de scroll capturées en tête de draw()
      const nouvelleInv = root.querySelector<HTMLElement>(".equip-inv");
      if (nouvelleInv) nouvelleInv.scrollTop = scrollInv;
      if (document.scrollingElement) document.scrollingElement.scrollTop = scrollPage;
    };
    draw();
  });
}

/** Écran Butin : annonce les pièces d'équipement obtenues après un combat. */
export function showDrop(drops: ItemInstance[]): Promise<void> {
  return new Promise((res) => {
    const cartes = drops
      .map((inst) => {
        const it = ITEMS[inst.id];
        return `<div class="drop-item">
        <img src="${itemImg(inst.id)}" alt="" onerror="this.remove()" />
        <span class="drop-nom">${escapeHtml(it?.nom ?? inst.id)}<small>${SLOT_NOM[it.slot]} · ${itemLignes(inst.stats) || "—"}</small></span>
      </div>`;
      })
      .join("");
    ecran(`
      <h1>🎁 Butin !</h1>
      <p class="sous-titre">L'équipe ramasse ${drops.length} pièce${drops.length > 1 ? "s" : ""} d'équipement.</p>
      <div class="drop-liste">${cartes}</div>
      <div class="boutons-ecran"><button id="drop-ok" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("drop-ok")?.addEventListener("click", () => res());
  });
}

/** Écran Paramètres : touche de fin de tour (rebindable) + auto-passe. */
export function showSettings(): Promise<void> {
  return new Promise((res) => {
    let capture = false;
    const draw = () => {
      ecran(`
        <h1>Paramètres</h1>
        <div class="settings">
          <div class="setting-ligne">
            <span class="setting-lbl">Touche « Terminer le tour »</span>
            <button id="set-touche" class="secondaire">${capture ? "Appuie sur une touche…" : `<kbd>${escapeHtml(libelleTouche(config.toucheFinTour))}</kbd>`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Passer le tour automatiquement<br><small class="muet">quand aucune action n'est possible</small></span>
            <button id="set-auto" class="secondaire ${config.autoFinTour ? "on" : ""}">${config.autoFinTour ? "Activé" : "Désactivé"}</button>
          </div>
        </div>
        <h2 class="settings-titre">Préréglages des héros</h2>
        <p class="muet settings-sous">Élément de frappe &amp; position par défaut, appliqués au début de chaque run. « Libre » = allocation manuelle.</p>
        <div class="presets">
          ${classesDisponibles().map((cid) => {
            const elSel = config.elements[cid];
            const rangee = config.formation[cid] === "arriere" ? "arriere" : "avant";
            return `<div class="preset-classe">
              <img class="preset-sym" src="${classSymbol(cid)}" alt="" onerror="this.remove()" />
              <span class="preset-nom">${escapeHtml(CLASSES[cid].nom)}</span>
              <div class="preset-el">
                ${ELEMENTS.map((el) => `<button class="form-el-btn elem-${el} ${elSel === el ? "sel" : ""}" data-classe="${cid}" data-el="${el}" title="${elNom[el]}"><img src="${elementAsset(el)}" alt="" onerror="this.remove()" /><span>${elNom[el]}</span></button>`).join("")}
                <button class="form-el-btn libre ${elSel ? "" : "sel"}" data-classe="${cid}" data-el="libre" title="Allocation manuelle">Libre</button>
                <span class="preset-sep"></span>
                <span class="preset-pos">
                  <button class="form-el-btn ${rangee === "avant" ? "sel" : ""}" data-classe="${cid}" data-rangee="avant" title="Ligne avant (les héros s'y empilent)">Avant</button>
                  <button class="form-el-btn ${rangee === "arriere" ? "sel" : ""}" data-classe="${cid}" data-rangee="arriere" title="Ligne arrière (les héros s'y empilent)">Arrière</button>
                </span>
              </div>
            </div>`;
          }).join("")}
        </div>
        <div class="boutons-ecran"><button id="set-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      root.querySelectorAll<HTMLButtonElement>(".preset-el .form-el-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cid = btn.dataset.classe!;
          const el = btn.dataset.el!;
          if (el === "libre") delete config.elements[cid];
          else config.elements[cid] = el as Element;
          sauverConfig(config);
          draw();
        });
      });
      root.querySelectorAll<HTMLButtonElement>(".preset-pos [data-rangee]").forEach((btn) => {
        btn.addEventListener("click", () => {
          config.formation[btn.dataset.classe!] = btn.dataset.rangee as "avant" | "arriere";
          sauverConfig(config);
          draw();
        });
      });
      document.getElementById("set-touche")?.addEventListener("click", () => {
        capture = true;
        draw();
        const onKey = (e: KeyboardEvent) => {
          e.preventDefault();
          document.removeEventListener("keydown", onKey, true);
          config.toucheFinTour = e.key;
          sauverConfig(config);
          capture = false;
          draw();
        };
        document.addEventListener("keydown", onKey, true);
      });
      document.getElementById("set-auto")?.addEventListener("click", () => {
        config.autoFinTour = !config.autoFinTour;
        sauverConfig(config);
        draw();
      });
      document
        .getElementById("set-retour")
        ?.addEventListener("click", () => res());
    };
    draw();
  });
}

export function showTransition(
  message: string,
  sousTitre: string,
): Promise<void> {
  return new Promise((res) => {
    ecran(`
      <h1>${escapeHtml(message)}</h1>
      <p class="sous-titre">${escapeHtml(sousTitre)}</p>
      <div class="boutons-ecran"><button id="btn-next" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("btn-next")?.addEventListener("click", () => res());
  });
}

/** Récap de fin de run (victoire ou wipe) : dégâts par héros, MVP, compteurs. */
export function showRecap(run: RunState, victoire: boolean, nouveauxSucces: Succes[] = []): Promise<void> {
  return new Promise((res) => {
    const st = run.stats;
    const maxDegats = Math.max(1, ...Object.values(st.degats));
    const mvp = Object.entries(st.degats).sort((a, b) => b[1] - a[1])[0]?.[0];
    const barres = run.persos
      .map((p) => {
        const d = st.degats[p.classeId] ?? 0;
        const pct = Math.round((d / maxDegats) * 100);
        return `<div class="recap-ligne">
          <img class="recap-sym" src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
          <span class="recap-nom">${escapeHtml(CLASSES[p.classeId].nom)}${p.classeId === mvp ? " 👑" : ""}<small>Niv. ${p.progression.niveau}</small></span>
          <div class="recap-barre"><div class="recap-barre-rempli" style="width:${pct}%"></div><span>${d.toLocaleString("fr-FR")} dégâts</span></div>
        </div>`;
      })
      .join("");
    ecran(`
      <h1 class="${victoire ? "" : "defaite"}">${victoire ? "🏆 Krosmoz traversé !" : "Équipe anéantie"}</h1>
      <p class="sous-titre">${victoire ? "Toutes les zones de la tranche sont vaincues." : "La run s'arrête ici. Tes Dofus et tes captures, eux, sont conservés."}</p>
      <div class="recap-compteurs">
        <span class="recap-chip">🗺️ ${st.zones} zone${st.zones > 1 ? "s" : ""}</span>
        <span class="recap-chip">⚔️ ${st.combats} combat${st.combats > 1 ? "s" : ""} gagné${st.combats > 1 ? "s" : ""}</span>
        <span class="recap-chip">🎒 ${st.objets} objet${st.objets > 1 ? "s" : ""}</span>
        <span class="recap-chip">✨ ${st.archis} âme${st.archis > 1 ? "s" : ""} capturée${st.archis > 1 ? "s" : ""}</span>
      </div>
      <div class="recap-degats">${barres}</div>
      ${nouveauxSucces.length ? `<div class="recap-succes">${nouveauxSucces.map((su) => `<span class="succes-chip nouveau" title="${escapeHtml(su.desc)}">🏆 ${escapeHtml(su.nom)}</span>`).join("")}</div>` : ""}
      <div class="boutons-ecran"><button id="recap-retour" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("recap-retour")?.addEventListener("click", () => res());
  });
}

export function showWipe(): Promise<void> {
  return new Promise((res) => {
    ecran(`
      <h1 class="defaite">Équipe anéantie</h1>
      <p class="sous-titre">La run s'arrête. Tes Dofus, eux, sont conservés.</p>
      <div class="boutons-ecran"><button id="btn-retry" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document
      .getElementById("btn-retry")
      ?.addEventListener("click", () => res());
  });
}

export function showDofus(dofusId: string, totalCopies: number): Promise<void> {
  return new Promise((res) => {
    const d = DOFUS[dofusId];
    ecran(`
      <h1 class="victoire">Dofus obtenu !</h1>
      ${d?.img ? `<img class="dofus-img" src="${A(d.img)}" alt="" onerror="this.remove()" />` : ""}
      <h2>${escapeHtml(d?.nom ?? dofusId)}</h2>
      <p class="sous-titre">${escapeHtml(d?.desc ?? "")}</p>
      <p>Copies possédées : <b>×${totalCopies}</b>. La prochaine run sera plus facile.</p>
      <div class="boutons-ecran"><button id="btn-continue" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document
      .getElementById("btn-continue")
      ?.addEventListener("click", () => res());
  });
}

// --- Panneau de personnages (niveaux & points) -------------------------------
const STAT_NOM: Record<keyof Stats, string> = {
  force: "Force",
  intelligence: "Intelligence",
  agilite: "Agilité",
  chance: "Chance",
  vitalite: "Vitalité",
  soin: "Soin",
  prospection: "Prospection",
};
// Description complète affichée au survol d'une caractéristique (peut contenir du HTML).
const STAT_AIDE: Record<keyof Stats, string> = {
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
};
// Ta plus haute stat élémentaire (Force/Int/Agi/Chance) définit ton élément de frappe.
const AIDE_ELEMENT =
  '<br><i class="aide-note">L\'élément de frappe est ta plus haute stat élémentaire.</i>';
const STAT_ELEMENTAIRE = new Set<keyof Stats>([
  "force",
  "intelligence",
  "agilite",
  "chance",
]);

function carteProgression(p: PersoState): string {
  const classe = CLASSES[p.classeId];
  const prog = p.progression;
  const finals = statsFinales(classe, prog);
  const bonus = bonusEquipement(p); // stats d'équipement + bonus de panoplie
  const pvMax = pvMaxPerso(p); // PV max équipement inclus
  const xpReq = xpRequis(prog.niveau);
  const xpPct = Math.min(100, Math.round((prog.xp / xpReq) * 100));

  const lignes = STAT_KEYS.map((stat) => {
    const cout = coutPoint(prog.pointsInvestis[stat] ?? 0);
    const peut = prog.pointsDispo >= cout;
    const inv = prog.pointsInvestis[stat] ?? 0;
    const equip = bonus.stats[stat] ?? 0; // apport de l'équipement pour cette stat
    const total = (finals[stat] ?? 0) + equip;
    // format : TOTAL (points investis) + (équipement) — total coloré par stat,
    // investis en bleu foncé, équipement en violet
    return `
      <div class="stat-ligne">
        <span class="stat-nom" tabindex="0">${STAT_NOM[stat]}<span class="stat-info">ⓘ</span><span class="stat-aide">${STAT_AIDE[stat]}${STAT_ELEMENTAIRE.has(stat) ? AIDE_ELEMENT : ""}</span></span>
        <span class="stat-val"><b class="stat-total stat-c-${stat}">${total}</b><span class="stat-part-inv" title="Points investis">(${inv})</span>${equip ? ` + <span class="stat-part-equip" title="Équipement">(${equip})</span>` : ""}${cout > 1 ? ` <span class="muet stat-cout">×${cout}</span>` : ""}</span>
        <span class="stat-actions">
          <button class="stat-champ" data-perso="${p.classeId}" data-stat="${stat}" ${peut ? "" : "disabled"} title="Montant libre">+…</button>
          <button class="stat-alloc" data-perso="${p.classeId}" data-stat="${stat}" data-n="max" ${peut ? "" : "disabled"}>Max</button>
        </span>
      </div>`;
  }).join("");

  return `
    <div class="carte-prog">
      <div class="prog-tete">
        <span class="prog-nom">${escapeHtml(classe.nom)}</span>
        <span class="prog-niv">Niv. ${prog.niveau}</span>
      </div>
      <div class="barre-xp"><div class="barre-xp-rempli" style="width:${xpPct}%"></div>
        <span class="xp-txt">XP ${prog.xp} / ${xpReq}</span>
      </div>
      <div class="prog-pv">PV max : <b>${pvMax}</b> · PV actuels : ${Math.max(0, Math.round(p.pvActuels))}</div>
      <div class="points-dispo ${prog.pointsDispo ? "actif" : ""}">Points à dépenser : <b>${prog.pointsDispo}</b></div>
      <div class="stats-grille">${lignes}</div>
    </div>`;
}

/**
 * Panneau de progression : dépenser les points dans les stats.
 * `titre`/`sousTitre` permettent de réutiliser l'écran pour l'Otomai.
 */
/** Section « bonus de Dofus » commune à toute l'équipe (affichée une fois). */
function sectionBonusDofus(meta: Meta | null): string {
  if (!meta) return "";
  const b = bonusEquipe(meta);
  const parts: string[] = [];
  const dmg = Math.round((b.damageMult - 1) * 100);
  if (dmg) parts.push(`+${dmg} % dégâts`);
  if (b.paBonus) parts.push(`+${b.paBonus} PA`);
  if (b.vitaBonus) parts.push(`+${b.vitaBonus} Vitalité`);
  if (b.resAllBonus) parts.push(`+${Math.round(b.resAllBonus * 100)} % résistances`);
  if (!parts.length) return "";
  return `<div class="bonus-dofus">
    <span class="bonus-dofus-titre">🐉 Bonus de Dofus — toute l'équipe</span>
    <div class="bonus-dofus-liste">${parts.map((p) => `<span class="bonus-dofus-chip">${p}</span>`).join("")}</div>
  </div>`;
}

export function showStatPanel(
  persos: PersoState[],
  titre = "Caractéristiques",
  sousTitre = "Dépense tes points de caractéristique.",
  retour = false,
  meta: Meta | null = null,
): Promise<void> {
  return new Promise((res) => {
    const draw = () => {
      ecran(`
        <h1>${escapeHtml(titre)}</h1>
        <p class="sous-titre">${escapeHtml(sousTitre)}</p>
        ${sectionBonusDofus(meta)}
        <div class="prog-grille">${persos.map(carteProgression).join("")}</div>
        <div class="boutons-ecran">${retour
          ? `<button id="prog-fermer" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button>`
          : `<button id="prog-fermer" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button>`}</div>
      `);
      const persoDe = (el: HTMLElement) =>
        persos.find((p) => p.classeId === el.dataset.perso);
      // +1 / +5 / Max
      root.querySelectorAll<HTMLButtonElement>(".stat-alloc").forEach((btn) => {
        btn.addEventListener("click", () => {
          const perso = persoDe(btn);
          if (!perso) return;
          const n = btn.dataset.n === "max" ? Infinity : Number(btn.dataset.n);
          if (
            investirN(perso.progression, btn.dataset.stat as keyof Stats, n) > 0
          )
            draw();
        });
      });
      // montant libre : un champ nombre s'ouvre à la place des boutons
      root.querySelectorAll<HTMLButtonElement>(".stat-champ").forEach((btn) => {
        btn.addEventListener("click", () => {
          const actions = btn.closest<HTMLElement>(".stat-actions");
          if (!actions) return;
          actions.innerHTML = `<input class="stat-champ-input" type="number" min="1" step="1" value="1" /><button class="stat-champ-ok">OK</button>`;
          const input =
            actions.querySelector<HTMLInputElement>(".stat-champ-input")!;
          input.focus();
          input.select();
          const valider = () => {
            const perso = persoDe(btn);
            const n = Math.max(0, Math.floor(Number(input.value) || 0));
            if (perso && n > 0)
              investirN(perso.progression, btn.dataset.stat as keyof Stats, n);
            draw();
          };
          actions
            .querySelector<HTMLButtonElement>(".stat-champ-ok")
            ?.addEventListener("click", valider);
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") valider();
            else if (e.key === "Escape") draw();
          });
        });
      });
      document
        .getElementById("prog-fermer")
        ?.addEventListener("click", () => res());
    };
    draw();
  });
}

/**
 * Otomai : explique l'effet et propose de réinitialiser UN seul personnage.
 * Renvoie le perso choisi (à restater), ou null si le joueur passe.
 */
export function showOtomai(persos: PersoState[]): Promise<PersoState | null> {
  return new Promise((res) => {
    ecran(`
      <h1>🔄 Fontaine d'Otomai</h1>
      <p class="sous-titre">La fontaine <b>réinitialise les caractéristiques d'un seul personnage</b> : tous ses points investis lui sont rendus, à toi de les réattribuer (changer d'élément, corriger un build…). Les autres ne sont pas touchés. Choisis qui plonger dans la fontaine.</p>
      <div class="choix-grille">${persos.map((p) => carteClasse(p.classeId, false, "data-otomai")).join("")}</div>
      <div class="boutons-ecran"><button id="otomai-skip" class="secondaire">Ne rien faire</button></div>
    `);
    root
      .querySelectorAll<HTMLButtonElement>(".classe-carte")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          res(persos.find((p) => p.classeId === btn.dataset.otomai) ?? null),
        ),
      );
    document
      .getElementById("otomai-skip")
      ?.addEventListener("click", () => res(null));
  });
}

/** Texte d'effet d'un palier Ocre. */
function ocreEffetTxt(paBonus: number, degats: number): string {
  if (!paBonus && !degats) return "aucun";
  const parts: string[] = [];
  if (paBonus) parts.push(`+${paBonus} PA`);
  if (degats) parts.push(`+${Math.round(degats * 100)} % dégâts`);
  return parts.join(" · ");
}

/** Bestiaire par zone : toutes les espèces (boss & miniboss inclus) ;
 *  les espèces à Archimonstre (archiNom) suivent la capture (Dofus Ocre). */
export function showBestiaire(meta: Meta): Promise<void> {
  return new Promise((res) => {
    // seules les espèces ayant un Archimonstre réel (archiNom) sont capturables
    const capturables = (z: (typeof ZONES)[number]) =>
      monstresDeZone(z).filter((id) => MONSTRES[id]?.archiNom);
    const total = new Set(ZONES.flatMap(capturables)).size;
    const captures = meta.archis.length;
    const ocre = paliersOcre(meta);
    const prochain = OCRE_PALIERS.find((p) => captures < p.seuil);
    const zonesHtml = ZONES.map((z) => {
      const ids = monstresDeZone(z); // toutes les espèces de la zone (boss/miniboss inclus)
      const capturablesIds = ids.filter((id) => MONSTRES[id]?.archiNom);
      // ordre d'affichage : le boss en dernier (les autres gardent l'ordre des rencontres)
      const tri = [...ids].sort((a, b) => Number(MONSTRES[a]?.boss ?? false) - Number(MONSTRES[b]?.boss ?? false));
      const cards = tri
        .map((id) => {
          const m = MONSTRES[id]!;
          const badge = m.boss ? `<span class="bestiaire-badge">Boss</span>` : "";
          if (!m.archiNom) {
            // espèce sans Archimonstre : simple entrée d'encyclopédie
            return `<div class="archi-mon simple" title="${escapeHtml(m.nom)}${m.boss ? " — Boss de donjon" : ""} (pas d'Archimonstre connu)">
            <img src="${A(m.img ?? "")}" alt="" onerror="this.remove()" />
            ${badge}
            <span>${escapeHtml(m.nom)}</span>
            <small>${m.boss ? "Boss" : "—"}</small>
          </div>`;
          }
          const capt = meta.archis.includes(id);
          return `<div class="archi-mon ${capt ? "capt" : "manquant"}" title="${escapeHtml(m.archiNom)} — Archimonstre de ${escapeHtml(m.nom)}${capt ? " (capturé)" : " (non capturé)"}">
          <img src="${A(m.img ?? "")}" alt="" onerror="this.remove()" />
          ${capt ? `<img class="archi-mark" src="${A("/assets/divers/Archmonster.webp")}" alt="" onerror="this.remove()" />` : ""}
          ${badge}
          <span>${escapeHtml(m.archiNom)}</span>
          <small>${escapeHtml(m.nom)}</small>
        </div>`;
        })
        .join("");
      const compte = capturablesIds.length
        ? `<span class="archi-zone-compte">${capturablesIds.filter((id) => meta.archis.includes(id)).length}/${capturablesIds.length} archis</span>`
        : `<span class="archi-zone-compte">aucun archi</span>`;
      return `<div class="archi-zone"><h3>${escapeHtml(z.nom)} ${compte}</h3><div class="archi-grid">${cards}</div></div>`;
    }).join("");
    ecran(`
      <h1>📖 Bestiaire — Archimonstres</h1>
      <p class="sous-titre">Capture l'âme des Archimonstres (variantes rares, plus puissantes) en les vainquant. Chaque palier de 50 captures fait monter le Dofus Ocre.</p>
      <p class="archi-resume"><b>${captures}</b> / ${total} espèces capturées · Dofus Ocre : <b>palier ${ocre.tier}</b> (${ocreEffetTxt(ocre.paBonus, ocre.degats)})${prochain ? ` · prochain palier à ${prochain.seuil}` : " · max atteint"}</p>
      ${zonesHtml}
      <div class="boutons-ecran"><button id="best-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document
      .getElementById("best-retour")
      ?.addEventListener("click", () => res());
  });
}

/** Petit écran de feedback quand on capture une ou plusieurs âmes d'Archimonstre. */
export function showCapture(especes: string[]): Promise<void> {
  return new Promise((res) => {
    const s = especes.length > 1;
    ecran(`
      <h1>✨ Âme${s ? "s" : ""} d'Archimonstre capturée${s ? "s" : ""} !</h1>
      <p class="sous-titre">${especes.map(escapeHtml).join(", ")} ${s ? "rejoignent" : "rejoint"} ton bestiaire (Dofus Ocre).</p>
      <div class="boutons-ecran"><button id="capt-ok" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("capt-ok")?.addEventListener("click", () => res());
  });
}

/** Collection de Dofus (accueil) : tout le catalogue, possédés en couleurs. */
export function showCollectionDofus(meta: Meta): Promise<void> {
  return new Promise((res) => {
    const nbUniques = new Set(meta.dofus).size;
    ecran(`
      <h1>🐉 Dofus</h1>
      <p class="sous-titre">${nbUniques} / ${Object.keys(DOFUS).length} reliques collectées. Elles survivent à la mort et se cumulent.</p>
      ${renderDofusRack(meta)}
      <div class="boutons-ecran"><button id="dofus-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("dofus-retour")?.addEventListener("click", () => res());
  });
}

/** Liste des succès (débloqués / verrouillés), depuis l'accueil. */
export function showSucces(meta: Meta): Promise<void> {
  return new Promise((res) => {
    const deja = new Set(meta.succes ?? []);
    const cartes = SUCCES.map((su) => `
      <div class="succes-carte ${deja.has(su.id) ? "ok" : "verrouille"}">
        <span class="succes-icone">${deja.has(su.id) ? "🏆" : "🔒"}</span>
        <span class="succes-nom">${escapeHtml(su.nom)}<small>${escapeHtml(su.desc)}</small></span>
      </div>`).join("");
    ecran(`
      <h1>🏆 Succès</h1>
      <p class="sous-titre">${deja.size} / ${SUCCES.length} débloqués. Les récompenses arriveront avec le système d'objets.</p>
      <div class="succes-grille">${cartes}</div>
      <div class="boutons-ecran"><button id="succes-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("succes-retour")?.addEventListener("click", () => res());
  });
}

export function showZaap(typeRevele: string): Promise<void> {
  return showTransition("🌀 Zaap", `La rencontre se révèle : ${typeRevele}.`);
}

// --- Plateau (carte de nœuds) ------------------------------------------------
const NODE_ICON: Record<NodeType, string> = {
  combat: "⚔️",
  combat_dur: "💀",
  taverne: "🍺",
  otomai: "🔄",
  zaap: "🌀",
  donjon: "🐉",
};
const NODE_LABEL: Record<NodeType, string> = {
  combat: "Combat",
  combat_dur: "Combat dur",
  taverne: "Taverne",
  otomai: "Otomai",
  zaap: "Zaap",
  donjon: "Donjon",
};
// fichier de tuile par type de nœud (le type "combat_dur" utilise l'asset "combat_elite")
const CASE_FILE: Record<NodeType, string> = {
  combat: "combat",
  combat_dur: "combat_elite",
  taverne: "taverne",
  otomai: "otomai",
  zaap: "zaap",
  donjon: "donjon",
};
/** Sprite du boss d'un nœud donjon (résolu depuis son combat → 1er ennemi « boss »). */
function bossImg(n: MapNode): string | null {
  const ennemis = n.combatId ? COMBATS[n.combatId]?.ennemis : undefined;
  const ent = ennemis?.find((e) => MONSTRES[e.monstre]?.boss) ?? ennemis?.[0];
  const img = ent ? MONSTRES[ent.monstre]?.img : undefined;
  return img ? A(img) : null;
}

// La case Donjon affiche le sprite du boss de la zone plutôt qu'une tuile de case.
const caseAsset = (n: MapNode): string =>
  (n.type === "donjon" ? bossImg(n) : null) ??
  A(`/assets/cases/${CASE_FILE[n.type]}.png`);

const LARGEUR_CARTE = 720; // laisse la place à la sidebar d'équipe à gauche
const ESPACE_LIGNE = 92;
const MARGE_HAUT = 44;

export function showCarte(
  carte: GameMap,
  persos: PersoState[],
  meta: Meta,
  zoneNom: string,
  inventaire: ItemInstance[] = [],
): Promise<MapNode> {
  return new Promise((res) => {
    const draw = () => {
      const maxL = Math.max(...carte.noeuds.map((n) => n.ligne));
      const H = MARGE_HAUT * 2 + (maxL + 1) * ESPACE_LIGNE; // +1 rangée pour le Départ
      const departPos = { x: LARGEUR_CARTE / 2, y: MARGE_HAUT };
      const pos = new Map<string, { x: number; y: number }>();
      // Grille en colonnes alignées : `colonne` est un offset centré autour de 0.
      // Le pas est calé sur la rangée la plus large pour tenir dans la largeur.
      const parLigne = new Map<number, number>();
      for (const n of carte.noeuds) parLigne.set(n.ligne, (parLigne.get(n.ligne) ?? 0) + 1);
      const maxNb = Math.max(1, ...parLigne.values());
      const pas = LARGEUR_CARTE / (maxNb + 1);
      for (const n of carte.noeuds) {
        pos.set(n.id, {
          x: LARGEUR_CARTE / 2 + n.colonne * pas,
          y: MARGE_HAUT + (n.ligne + 1) * ESPACE_LIGNE,
        });
      }

      const reach = new Set(atteignables(carte).map((n) => n.id));
      const depuisCourant = (nid: string) =>
        carte.courant === nid ||
        (carte.courant === null && noeud(carte, nid)?.ligne === 0);

      const lignesSvg = carte.noeuds
        .flatMap((n) =>
          n.suivants.map((s) => {
            const a = pos.get(n.id)!;
            const b = pos.get(s)!;
            const actif = reach.has(s) && depuisCourant(n.id);
            return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="arete ${actif ? "arete-actif" : ""}"/>`;
          }),
        )
        .join("");

      // chemins du Départ vers les nœuds de la 1ʳᵉ rangée
      const departSvg = carte.depart
        .map((id) => {
          const b = pos.get(id)!;
          return `<line x1="${departPos.x}" y1="${departPos.y}" x2="${b.x}" y2="${b.y}" class="arete ${carte.courant === null ? "arete-actif" : ""}"/>`;
        })
        .join("");

      const boutons = carte.noeuds
        .map((n) => {
          const p = pos.get(n.id)!;
          const r = reach.has(n.id);
          const cls = [
            "map-node",
            `t-${n.type}`,
            n.visite ? "visite" : "",
            n.id === carte.courant ? "courant" : "",
            r ? "atteignable" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<button class="${cls}" data-id="${n.id}" ${r ? "" : "disabled"} style="left:${p.x}px;top:${p.y}px">
            <span class="case-art">
              <img class="case-img" src="${caseAsset(n)}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />
              <span class="mn-icon" style="display:none">${NODE_ICON[n.type]}</span>
            </span>
            <span class="mn-lbl">${NODE_LABEL[n.type]}</span>
          </button>`;
        })
        .join("");

      const points = persos.reduce((s, p) => s + p.progression.pointsDispo, 0);
      const asideEquipe = persos
        .map((p) => {
          const classe = CLASSES[p.classeId];
          const pvMax = pvMaxPerso(p); // équipement (vita + PV plats) inclus
          const pct = Math.max(0, Math.round((p.pvActuels / pvMax) * 100));
          return `
            <div class="aside-perso ${p.flashNiveau ? "flash-niv" : ""}">
              ${p.flashNiveau ? `<span class="niv-flash">⬆ Niveau ${p.progression.niveau} !</span>` : ""}
              <img class="aside-sym" src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
              <div class="aside-info">
                <div class="aside-nom">${escapeHtml(classe.nom)}<span class="aside-niv">Niv.${p.progression.niveau}</span>${pastillesElements(p)}</div>
                <div class="barre-pv mini">
                  <div class="barre-pv-rempli" style="width:${pct}%"></div>
                  <span class="pv-txt">${Math.max(0, Math.round(p.pvActuels))} / ${pvMax}</span>
                </div>
              </div>
            </div>`;
        })
        .join("");
      persos.forEach((p) => { p.flashNiveau = false; }); // le flash ne joue qu'une fois

      root.innerHTML = `
        <div class="carte-ecran map-layout">
          <aside class="map-menus">
            <div class="aside-actions">
              <button id="carte-persos" class="aside-icone" title="Caractéristiques${points ? ` · ${points} pts à dépenser` : ""}"><img src="${MENU_PERSOS}" alt="Caractéristiques" onerror="this.remove()" />${points ? `<span class="aside-compte">${points}</span>` : ""}</button>
              <button id="carte-formation" class="aside-icone" title="Formation"><img src="${MENU_FORMATION}" alt="Formation" onerror="this.remove()" /></button>
              <button id="carte-equip" class="aside-icone" title="Équipement${inventaire.length ? ` · ${inventaire.length} objet(s)` : ""}"><img src="${MENU_INVENTAIRE}" alt="Équipement" onerror="this.remove()" />${inventaire.length ? `<span class="aside-compte">${inventaire.length}</span>` : ""}</button>
              <button id="carte-bestiaire" class="aside-icone" title="Bestiaire"><img src="${MENU_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /></button>
            </div>
          </aside>
          <div class="map-main">
            <h2 class="zone-titre">${escapeHtml(zoneNom)}</h2>
            <div class="map-zone" style="height:${H}px">
              <svg class="map-svg" width="${LARGEUR_CARTE}" height="${H}">${departSvg}${lignesSvg}</svg>
              ${boutons}
              <div class="map-depart" style="left:${departPos.x}px;top:${departPos.y}px">
                <span class="case-art depart-art">🚩</span>
                <span class="mn-lbl">Départ</span>
              </div>
            </div>
            <p class="aide">Choisis un nœud accessible (surligné). Choisir un nœud, c'est renoncer à ses voisins.</p>
          </div>
          <aside class="map-equipe">
            <h2>Équipe</h2>
            <div class="aside-equipe">${asideEquipe}</div>
            <div class="aside-dofus">
              <h3>Dofus</h3>
              ${renderDofusRack(meta, true)}
            </div>
          </aside>
        </div>`;

      root
        .querySelectorAll<HTMLButtonElement>(".map-node.atteignable")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const n = noeud(carte, btn.dataset.id!);
            if (n) res(n);
          });
        });
      document
        .getElementById("carte-persos")
        ?.addEventListener("click", async () => {
          await showStatPanel(persos, undefined, undefined, true, meta);
          draw();
        });
      document
        .getElementById("carte-formation")
        ?.addEventListener("click", async () => {
          await showFormation(persos);
          draw();
        });
      document
        .getElementById("carte-equip")
        ?.addEventListener("click", async () => {
          await showInventaire(persos, inventaire);
          draw();
        });
      document
        .getElementById("carte-bestiaire")
        ?.addEventListener("click", async () => {
          await showBestiaire(meta);
          draw();
        });
    };
    draw();
  });
}
