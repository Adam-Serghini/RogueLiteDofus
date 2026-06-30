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
} from "./combat";
import {
  STAT_KEYS,
  statsFinales,
  pvMaxFor,
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
  pvMaxPerso,
  equiper,
  desequiper,
  paliersOcre,
  type PersoState,
} from "./run";
import type {
  Action,
  Camp,
  Combatant,
  Element,
  EquipSlot,
  Item,
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
    // touches 1-9 : slot 1 = corps à corps (réservé/vide), 2+ = sorts dans l'ordre
    if (/^[1-9]$/.test(e.key)) {
      const slot = Number(e.key);
      if (slot === 1) return; // corps à corps : à venir
      const sortId = activeActeur.sorts[slot - 2];
      const s = sortId ? SORTS[sortId] : undefined;
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
    tip.innerHTML =
      `<div class="tip-nom">${escapeHtml(nom)}</div>` +
      `<div class="tip-effet">${escapeHtml(effet)}</div>` +
      (boss
        ? `<div class="tip-boss">🐲 Lâché par ${escapeHtml(boss)}</div>`
        : `<div class="tip-muet">Pas encore obtenable</div>`);
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
    if ((e.target as HTMLElement).closest?.(".dofus-slot"))
      tip.style.display = "none";
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
  "Force → Terre · Intelligence → Feu · Agilité → Air\n" +
  "Chance → Eau · Wakfu → Wakfu · Stasis → Stasis\n\n" +
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
  return [
    `<div class="tip-nom">${escapeHtml(s.nom)}<span class="tip-pa">${s.coutPA} PA</span></div>`,
    principal ? `<div class="tip-stat">${principal}</div>` : "",
    s.desc ? `<div class="tip-effet">${escapeHtml(s.desc)}</div>` : "",
    `<div class="tip-cible">🎯 ${CIBLE_LBL[s.cible] ?? s.cible}${s.cooldown ? ` · ⏳ recharge ${s.cooldown} tours` : ""}</div>`,
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
    const s = btn.dataset.sort ? SORTS[btn.dataset.sort] : null;
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
      "button.sort[data-sort]",
    ) as HTMLElement | null;
    if (btn) placer(btn);
  });
  document.addEventListener("mouseout", (e) => {
    if ((e.target as HTMLElement).closest?.("button.sort[data-sort]"))
      tip.style.display = "none";
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
  wakfu: "Wakfu",
  stasis: "Stasis",
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
const ICON_COEUR = A("/assets/divers/coeur.png"); // PV
const LOGO = A("/assets/divers/Roguefus_lite.png");
const BTN_JOUER = A("/assets/menu/Jouer.png");
const BTN_RETOUR = A("/assets/menu/retour.png");
const BTN_CONTINUER = A("/assets/menu/continuer.png");
const MENU_PERSOS = A("/assets/menu/Caracteristiques.png");
const MENU_FORMATION = A("/assets/menu/Formation.png");
const MENU_INVENTAIRE = A("/assets/menu/Inventaire.png");
const MENU_BESTIAIRE = A("/assets/menu/bestiaires.png");
const MENU_PARAM = A("/assets/menu/parametres.png");
const elementAsset = (el: string): string => A(`/assets/elements/${el}.png`);
const classSymbol = (classeId: string): string =>
  A(`/assets/class_symbol/${classeId}.png`);
// Icônes de stats secondaires (cf. maquette de carte)
const ICON_CRIT = A("/assets/elements/critique.png");
const ICON_DMGCRIT = A("/assets/elements/dmgCritique.png");
const ICON_SOIN = A("/assets/elements/soin.png");
const ICON_PUISS = A("/assets/elements/puissance.png");
const ICON_PP = A("/assets/elements/pp.png");
const ICON_BOUCLIER = A("/assets/elements/bouclier.png");
const resAsset: Record<Element, string> = {
  terre: A("/assets/elements/resTerre.png"),
  feu: A("/assets/elements/resFeu.png"),
  eau: A("/assets/elements/resEau.png"),
  air: A("/assets/elements/resAir.png"),
  wakfu: A("/assets/elements/resWakfu.png"),
  stasis: A("/assets/elements/resStasis.png"),
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
}

/** Re-render entre deux actions (appelé par le moteur). */
export function onUpdate(): void {
  render();
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
  Math.round(Math.min(0.5, (s.soin ?? 0) * 0.005) * 100);
const pctDgtsFinaux = (s: Stats): number =>
  Math.round(Math.min(0.5, s.intelligence * 0.005) * 100);

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
  return `<span class="${cls}" ${switchable ? `data-switch="${el}"` : ""} title="${titre}">
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
  // chips de résistance : les 6 éléments, toujours affichés (0 % inclus)
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
  }
  if (c.provoque) badges.push(`🛡 Provoque`);
  if (c.bonusOffensifProchain > 0)
    badges.push(`+${Math.round(c.bonusOffensifProchain * 100)} % prochain`);
  if (c.maxRollCharges > 0) badges.push(`Œil affûté ×${c.maxRollCharges}`);
  if (c.retraitPANextTurn > 0) badges.push(`−${c.retraitPANextTurn} PA`);
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
        <span class="pv-gem ${ko ? "ko" : ""}" title="${Math.max(0, c.pvActuels)} / ${c.pvMax} PV"><img src="${ICON_COEUR}" alt="" onerror="this.remove()" /><b>${Math.max(0, c.pvActuels)}</b></span>
      </div>
      <div class="mini-stats">
        <span class="ms" title="Coup critique (Force)"><img src="${ICON_CRIT}" alt="" onerror="this.remove()" />${pctCrit(c.stats)}%</span>
        <span class="ms" title="Dégâts critiques (Agilité)"><img src="${ICON_DMGCRIT}" alt="" onerror="this.remove()" />${pctDmgCrit(c.stats)}%</span>
        <span class="ms" title="Soin (puissance de soin)"><img src="${ICON_SOIN}" alt="" onerror="this.remove()" />${pctSoin(c.stats)}%</span>
        <span class="ms" title="Dégâts finaux (Intelligence)"><img src="${ICON_PUISS}" alt="" onerror="this.remove()" />${pctDgtsFinaux(c.stats)}%</span>
      </div>
      ${c.camp === "joueur" ? `<div class="pp-row" title="Prospection"><img src="${ICON_PP}" alt="" onerror="this.remove()" /><b>${c.stats.prospection ?? 0}</b></div>` : ""}
      ${c.bouclier > 0 ? `<div class="bouclier-row" title="Bouclier"><img src="${ICON_BOUCLIER}" alt="" onerror="this.remove()" /><b>${c.bouclier}</b></div>` : ""}
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
    // les deux lignes côte à côte ; l'arrière est « derrière » = côté extérieur
    // (gauche pour le joueur, droite pour l'ennemi) → les lignes avant se font face au centre
    return `<div class="camp-lignes ${camp}">${camp === "joueur" ? arriere + avant : avant + arriere}</div>`;
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

  // clics sur les cibles
  if (activeActeur && selectedSpell) {
    root.querySelectorAll<HTMLElement>(".carte.ciblable").forEach((card) => {
      card.addEventListener("click", () => {
        const ref = card.dataset.ref!;
        finir({ sort: selectedSpell!, cibleRef: ref });
      });
    });
  }

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
  const items = ordre
    .map((c) => {
      const camp = c.camp === "joueur" ? "joueur" : "ennemi";
      const actif = c === activeActeur ? "actif" : "";
      const inner = c.img
        ? `<img src="${A(c.img)}" alt="" onerror="this.remove()" />`
        : `<span class="tl-ini">${initEffective(c)}</span>`;
      return `<div class="tl-pastille ${camp} ${actif}" title="${escapeHtml(c.nom)} · init ${initEffective(c)}">${inner}</div>`;
    })
    .join("");
  return `<div class="timeline"><div class="tl-liste">${items}</div></div>`;
}

function renderBarreSorts(): string {
  if (!activeActeur) {
    return `<div class="attente">En attente…</div>`;
  }
  const acteur = activeActeur;
  // slot 1 réservé au corps à corps (vide pour l'instant)
  const cac = `<div class="sort sort-cac" title="Corps à corps — à venir">
      <span class="sort-touche">1</span>
      <span class="sort-icon-vide">🗡️</span>
    </div>`;
  const boutons =
    cac +
    acteur.sorts
      .map((id) => SORTS[id])
      .map((s, i) => {
        const abordable = acteur.paActuels >= s.coutPA;
        const choisi = selectedSpell?.id === s.id;
        return `<button class="sort ${choisi ? "choisi" : ""}" data-sort="${s.id}" ${
          abordable ? "" : "disabled"
        }>
        <span class="sort-touche">${i + 2}</span>
        <span class="sort-pa-badge">${s.coutPA}</span>
        <img class="sort-icon" src="${sortIcon(s.id)}" alt="" onerror="this.remove()" />
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
         <span class="elem-info" title="${escapeHtml(ELEMENT_AIDE)}">i</span>
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
      const boss = DOFUS_DROP[d.id] ?? "";
      return `
        <div class="dofus-slot ${possede ? "" : "locked"}" data-nom="${escapeHtml(d.nom)}" data-effet="${escapeHtml(d.desc)}" data-boss="${escapeHtml(boss)}">
          <img src="${d.img ? A(d.img) : ""}" alt="${escapeHtml(d.nom)}" onerror="this.remove()" />
          ${n > 1 ? `<span class="dofus-count">×${n}</span>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="dofus-rack ${compact ? "compact" : ""}">${slots}</div>`;
}

export function showStart(meta: Meta, onReset: () => void): Promise<void> {
  return new Promise((res) => {
    const nbUniques = new Set(meta.dofus).size;
    const total = Object.keys(DOFUS).length;

    ecran(`
      <button id="btn-settings" class="coin-param" title="Paramètres"><img src="${MENU_PARAM}" alt="Paramètres" onerror="this.remove()" /></button>
      <img class="logo-accueil" src="${LOGO}" alt="Roguefus Lite" onerror="this.remove()" />
      <p class="sous-titre">Choisis 2 héros, recrute aux tavernes (4 max), traverse le plateau jusqu'au boss. Les PV se conservent ; seuls les Dofus survivent à la mort.</p>
      <p class="accueil-dofus-compte">Dofus collectés : <b>${nbUniques}/${total}</b></p>
      <div class="boutons-ecran">
        <button id="btn-start" class="btn-jouer" title="Lancer une run"><img src="${BTN_JOUER}" alt="Jouer" onerror="this.remove()" /></button>
        ${meta.dofus.length ? `<button id="btn-reset" class="secondaire">Réinitialiser les Dofus</button>` : ""}
      </div>
    `);
    document
      .getElementById("btn-settings")
      ?.addEventListener("click", async () => {
        await showSettings();
        showStart(meta, onReset).then(res);
      });
    document
      .getElementById("btn-start")
      ?.addEventListener("click", () => res());
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      onReset();
      showStart(meta, onReset).then(res);
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

/** Écran de départ : choisir 2 classes parmi les 7 pour commencer la run. */
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
      config.formation = Object.fromEntries(
        persos.map((p) => [p.classeId, p.position]),
      );
      sauverConfig(config);
    };

    const cellule = (cell: number): string => {
      const p = occupant(cell);
      const sel = selCell === cell ? "sel" : "";
      const inner = p
        ? `<img src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" /><span>${escapeHtml(CLASSES[p.classeId].nom)}</span>`
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
        <div class="boutons-ecran"><button id="form-retour" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
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
  "amulette",
  "coiffe",
  "cape",
  "ceinture",
  "bottes",
  "anneau",
];
const SLOT_NOM: Record<EquipSlot, string> = {
  amulette: "Amulette",
  coiffe: "Coiffe",
  cape: "Cape",
  ceinture: "Ceinture",
  bottes: "Bottes",
  anneau: "Anneau",
};
const STAT_ABBR: Partial<Record<keyof Stats, string>> = {
  vitalite: "Vita",
  force: "For",
  intelligence: "Int",
  agilite: "Agi",
  chance: "Cha",
  wakfu: "Wak",
  stasis: "Sta",
  soin: "Soin",
  prospection: "PP",
};
const itemImg = (id: string): string => A(`/assets/items/${id}.png`);

/** Résumé textuel des stats d'un objet (ou d'un set de stats). */
function itemLignes(item: Item): string {
  const parts: string[] = [];
  if (item.pvBonus) parts.push(`+${item.pvBonus} PV`);
  for (const k of Object.keys(item.stats ?? {}) as (keyof Stats)[]) {
    const v = item.stats![k];
    if (v) parts.push(`+${v} ${STAT_ABBR[k] ?? k}`);
  }
  for (const e of Object.keys(item.resistances ?? {}) as Element[]) {
    const v = item.resistances![e];
    if (v) parts.push(`+${Math.round(v * 100)} % rés ${elNom[e]}`);
  }
  return parts.join(" · ");
}

/** Écran Équipement : équiper/déséquiper les pièces trouvées, par personnage. */
export function showInventaire(
  persos: PersoState[],
  inventaire: string[],
): Promise<void> {
  return new Promise((res) => {
    let sel = 0; // index du perso sélectionné
    const draw = () => {
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
        const id = perso.equipement[slot];
        const item = id ? ITEMS[id] : undefined;
        return `<div class="equip-slot ${item ? "rempli" : "vide"}" data-slot="${slot}" ${item ? `data-desequip="${slot}" draggable="true"` : ""}>
          <span class="slot-nom">${SLOT_NOM[slot]}</span>
          ${
            item
              ? `<img class="slot-img" src="${itemImg(item.id)}" alt="" onerror="this.remove()" /><span class="slot-item">${escapeHtml(item.nom)}<small>${itemLignes(item)}</small></span>`
              : `<span class="slot-vide-txt">— vide —</span>`
          }
        </div>`;
      }).join("");

      // bonus de panoplie en cours pour ce perso
      const compte: Record<string, number> = {};
      for (const s of SLOTS) {
        const it = perso.equipement[s]
          ? ITEMS[perso.equipement[s]!]
          : undefined;
        if (it) compte[it.panoplie] = (compte[it.panoplie] ?? 0) + 1;
      }
      const panoTxt = Object.entries(compte)
        .map(([pid, n]) => `${PANOPLIES[pid]?.nom ?? pid} ${n}/6`)
        .join(" · ");

      const inv = inventaire.length
        ? inventaire
            .map((id) => {
              const it = ITEMS[id];
              return `<button class="item-carte" data-equip="${id}" draggable="true">
              <img src="${itemImg(id)}" alt="" onerror="this.remove()" />
              <span class="item-nom">${escapeHtml(it?.nom ?? id)}<small>${SLOT_NOM[it.slot]} · ${itemLignes(it)}</small></span>
            </button>`;
            })
            .join("")
        : `<p class="muet">Inventaire vide — gagne des combats pour trouver de l'équipement.</p>`;

      const b = bonusEquipement(perso);
      const totalTxt =
        itemLignes({
          id: "",
          nom: "",
          slot: "amulette",
          panoplie: "",
          stats: b.stats,
          pvBonus: b.pvBonus,
          resistances: b.resistances,
        }) || "aucun bonus";

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
      // glisser-déposer : payload "inv:<id>" (objet de l'inventaire) ou "slot:<slot>" (pièce équipée)
      const equiperId = (id: string) => {
        if (inventaire.includes(id)) {
          equiper(inventaire, perso, id);
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
        const id = btn.dataset.equip!;
        btn.addEventListener("click", () => equiperId(id)); // clic = équiper (fallback)
        btn.addEventListener("dragstart", (e) => {
          e.dataTransfer!.setData("text/plain", `inv:${id}`);
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
          if (data.startsWith("inv:")) equiperId(data.slice(4));
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
    };
    draw();
  });
}

/** Écran Butin : annonce les pièces d'équipement obtenues après un combat. */
export function showDrop(ids: string[]): Promise<void> {
  return new Promise((res) => {
    const cartes = ids
      .map((id) => {
        const it = ITEMS[id];
        return `<div class="drop-item">
        <img src="${itemImg(id)}" alt="" onerror="this.remove()" />
        <span class="drop-nom">${escapeHtml(it?.nom ?? id)}<small>${SLOT_NOM[it.slot]} · ${itemLignes(it)}</small></span>
      </div>`;
      })
      .join("");
    ecran(`
      <h1>🎁 Butin !</h1>
      <p class="sous-titre">L'équipe ramasse ${ids.length} pièce${ids.length > 1 ? "s" : ""} d'équipement.</p>
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
        <div class="boutons-ecran"><button id="set-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
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
  wakfu: "Wakfu",
  stasis: "Stasis",
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
  wakfu: "Dégâts dans l'élément <b>Wakfu</b>.",
  stasis: "Dégâts dans l'élément <b>Stasis</b>.",
  vitalite: "Points de vie maximum : <b>+1 PV</b> par point.",
  soin: "Puissance des soins prodigués : <b>+0,5 %</b> par point (max 50 %).",
  prospection:
    "Augmente les chances de butin d'équipement (cumulé sur toute l'équipe).",
};
// Ta plus haute stat élémentaire (Force/Int/Agi/Chance/Wakfu/Stasis) définit ton élément de frappe.
const AIDE_ELEMENT =
  '<br><i class="aide-note">L\'élément de frappe est ta plus haute stat élémentaire.</i>';
const STAT_ELEMENTAIRE = new Set<keyof Stats>([
  "force",
  "intelligence",
  "agilite",
  "chance",
  "wakfu",
  "stasis",
]);

function carteProgression(p: PersoState): string {
  const classe = CLASSES[p.classeId];
  const prog = p.progression;
  const finals = statsFinales(classe, prog);
  const pvMax = pvMaxFor(classe, prog);
  const xpReq = xpRequis(prog.niveau);
  const xpPct = Math.min(100, Math.round((prog.xp / xpReq) * 100));

  const lignes = STAT_KEYS.map((stat) => {
    const cout = coutPoint(prog.pointsInvestis[stat] ?? 0);
    const peut = prog.pointsDispo >= cout;
    const inv = prog.pointsInvestis[stat] ?? 0;
    return `
      <div class="stat-ligne">
        <span class="stat-nom" tabindex="0">${STAT_NOM[stat]}<span class="stat-info">ⓘ</span><span class="stat-aide">${STAT_AIDE[stat]}${STAT_ELEMENTAIRE.has(stat) ? AIDE_ELEMENT : ""}</span></span>
        <span class="stat-val">${finals[stat]}${inv ? ` <span class="muet">(+${inv})</span>` : ""}${cout > 1 ? ` <span class="muet stat-cout">×${cout}</span>` : ""}</span>
        <span class="stat-actions">
          <button class="stat-alloc" data-perso="${p.classeId}" data-stat="${stat}" data-n="1" ${peut ? "" : "disabled"}>+1</button>
          <button class="stat-alloc" data-perso="${p.classeId}" data-stat="${stat}" data-n="5" ${peut ? "" : "disabled"}>+5</button>
          <button class="stat-alloc" data-perso="${p.classeId}" data-stat="${stat}" data-n="max" ${peut ? "" : "disabled"}>Max</button>
          <button class="stat-champ" data-perso="${p.classeId}" data-stat="${stat}" ${peut ? "" : "disabled"} title="Montant libre">+…</button>
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
export function showStatPanel(
  persos: PersoState[],
  titre = "Caractéristiques",
  sousTitre = "Dépense tes points de caractéristique.",
  retour = false,
): Promise<void> {
  return new Promise((res) => {
    const draw = () => {
      ecran(`
        <h1>${escapeHtml(titre)}</h1>
        <p class="sous-titre">${escapeHtml(sousTitre)}</p>
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

/** Bestiaire par zone : suit les Archimonstres capturés et la progression du Dofus Ocre. */
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
      const ids = capturables(z);
      const cards = ids
        .map((id) => {
          const m = MONSTRES[id]!;
          const capt = meta.archis.includes(id);
          return `<div class="archi-mon ${capt ? "capt" : "manquant"}" title="${escapeHtml(m.archiNom!)} — Archimonstre de ${escapeHtml(m.nom)}${capt ? " (capturé)" : " (non capturé)"}">
          <img src="${A(m.img ?? "")}" alt="" onerror="this.remove()" />
          ${capt ? `<img class="archi-mark" src="${A("/assets/divers/Archmonster.webp")}" alt="" onerror="this.remove()" />` : ""}
          <span>${escapeHtml(m.archiNom!)}</span>
          <small>${escapeHtml(m.nom)}</small>
        </div>`;
        })
        .join("");
      const corps =
        cards || `<p class="muet">Aucun Archimonstre dans cette zone.</p>`;
      return `<div class="archi-zone"><h3>${escapeHtml(z.nom)} <span class="archi-zone-compte">${ids.filter((id) => meta.archis.includes(id)).length}/${ids.length}</span></h3><div class="archi-grid">${corps}</div></div>`;
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
  inventaire: string[] = [],
): Promise<MapNode> {
  return new Promise((res) => {
    const draw = () => {
      const maxL = Math.max(...carte.noeuds.map((n) => n.ligne));
      const H = MARGE_HAUT * 2 + (maxL + 1) * ESPACE_LIGNE; // +1 rangée pour le Départ
      const departPos = { x: LARGEUR_CARTE / 2, y: MARGE_HAUT };
      const pos = new Map<string, { x: number; y: number }>();
      for (let l = 0; l <= maxL; l++) {
        const ln = carte.noeuds
          .filter((n) => n.ligne === l)
          .sort((a, b) => a.colonne - b.colonne);
        ln.forEach((n, idx) => {
          pos.set(n.id, {
            x: ((idx + 1) / (ln.length + 1)) * LARGEUR_CARTE,
            y: MARGE_HAUT + (l + 1) * ESPACE_LIGNE,
          });
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
          const pvMax = pvMaxFor(classe, p.progression);
          const pct = Math.max(0, Math.round((p.pvActuels / pvMax) * 100));
          return `
            <div class="aside-perso">
              <img class="aside-sym" src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
              <div class="aside-info">
                <div class="aside-nom">${escapeHtml(classe.nom)}<span class="aside-niv">Niv.${p.progression.niveau}</span></div>
                <div class="barre-pv mini">
                  <div class="barre-pv-rempli" style="width:${pct}%"></div>
                  <span class="pv-txt">${Math.max(0, Math.round(p.pvActuels))} / ${pvMax}</span>
                </div>
              </div>
            </div>`;
        })
        .join("");

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
          await showStatPanel(persos, undefined, undefined, true);
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
