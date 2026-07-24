// =============================================================================
//  ui/combat.ts — Rendu de l'écran de combat (cartes, timeline, barre de sorts),
//  contrôleur joueur (clic sort → clic cible), effets visuels (FX) et journal.
// =============================================================================
import { SORTS } from "../data";
import {
  ciblesValides,
  estAvant,
  ELEMENTS,
  elementsForts,
  elementDeFrappe,
  prochainActeur,
  type FxEvent,
} from "../combat";
import { libelleTouche } from "../config";
import {
  A,
  sortIcon,
  elementAsset,
  resAsset,
  PA_ICON,
  COEUR_PLEIN,
  MENU_TERMINER,
  ICON_CRIT,
  ICON_DMGCRIT,
  ICON_SOIN,
  ICON_PUISS,
  ICON_PP,
  ICON_REMB_PA,
} from "./assets";
import { root, escapeHtml, tipsFlottants, masquerTooltips, config } from "./dom";
import {
  ELEMENT_AIDE,
  elNom,
  pctCrit,
  pctDmgCrit,
  pctSoin,
  pctDgtsFinaux,
  pctRembPA,
  sortTooltipHtml,
} from "./composants";
import type { Action, Camp, Combatant, Element, Meta, Spell } from "../types";

let combatants: Combatant[] = [];
let logLines: string[] = [];
let titre = "";
let metaCombat: Meta | null = null; // pour l'indicateur de capture d'Archimonstre sur les cartes
let combatMonte = false; // squelette de l'écran de combat déjà construit ? (évite de tout reconstruire à chaque render)

// état du tour joueur en cours
let activeActeur: Combatant | null = null;
let selectedSpell: Spell | null = null;
let resolver: ((a: Action | null) => void) | null = null;

/** Raccourcis clavier globaux du combat : actifs uniquement pendant le tour du joueur. */
export function initControlesClavier(): void {
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

/** Tooltip stylé des sorts (survol des boutons d'action). */
export function initSortTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "sort-tip";
  tip.style.display = "none";
  document.body.appendChild(tip);
  tipsFlottants.push(tip);

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

/** Vrai si le combattant peut encore lancer au moins un sort (PA + cible). */
function aUneActionPossible(acteur: Combatant, cs: Combatant[]): boolean {
  return acteur.sorts
    .map((id) => SORTS[id])
    .some(
      (s) =>
        acteur.paActuels >= s.coutPA && ciblesValides(acteur, s, cs).length > 0,
    );
}

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
    // auto-résolu (pas de clic de cible) : encore faut-il que le sort ait une cible
    // valable (ex. Kaboom sans bombe posée) — sinon on ne consomme rien.
    if (ciblesValides(acteur, s, combatants).length === 0) {
      log("Ce sort n'a aucune cible valable.");
      return;
    }
    finir({ sort: s, cibleRef: acteur.ref }); // pas de cible à choisir
  } else {
    selectedSpell = s;
    render();
  }
}

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
  return `<span class="${cls}" ${switchable ? `data-switch="${el}" role="button" tabindex="0" aria-pressed="${actif}"` : ""} data-tip="${escapeHtml(titre)}" aria-label="${escapeHtml(titre)}">
    <img src="${elementAsset(el)}" alt="" onerror="this.remove()" /><i>${rang}</i>${actif ? `<b class="frappe-pic">⚔</b>` : ""}</span>`;
}

/**
 * Indicateur d'Archimonstre (coin haut-droit du mob) : affiché UNIQUEMENT quand
 * l'ennemi EST un Archimonstre (le montrer sur toute espèce capturable prêtait
 * à confusion). Pleine opacité ; le tooltip précise si l'âme est déjà capturée.
 */
function archiIndicateur(c: Combatant): string {
  if (c.camp !== "ennemi" || !c.archi || !c.archiNom) return "";
  const capture = !!(c.monstreId && metaCombat?.archis.includes(c.monstreId));
  const titre = capture
    ? `Archimonstre (âme déjà capturée) : ${c.archiNom}`
    : `Archimonstre — vaincs-le pour capturer son âme : ${c.archiNom}`;
  return `<img class="archi-badge capture" src="${A("/assets/divers/Archmonster.webp")}" alt="" title="${escapeHtml(titre)}" onerror="this.remove()" />`;
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
    else if (e.stat === "proie") badges.push(`🎯 Proie (vol ${Math.round(e.valeur * 100)} %)`);
    else if (e.stat === "tetanise") badges.push(`🦴 Tétanisé (${e.toursRestants})`);
  }
  if ((c.bombes ?? 0) > 0) badges.push(`💣 ×${c.bombes}`);
  if ((c.telefrags ?? 0) > 0) badges.push(`⌛ ×${c.telefrags}`); // ⌛ distinct de ⏳ (badge d'init ci-dessus)
  if ((c.portails ?? 0) > 0) badges.push(`🌀 ×${c.portails}`);
  if ((c.rage ?? 0) > 0) badges.push(`🐺 Rage ×${c.rage}`);
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
  masquerTooltips(); // le re-render détache l'élément survolé sans mouseout

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
          <div id="journal" class="journal" role="log" aria-live="polite" aria-label="Journal de combat"></div>
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
      const basculer = () => {
        const el = rond.dataset.switch as Element | undefined;
        if (activeActeur && el) {
          activeActeur.elementChoisi = el;
          render();
        }
      };
      rond.addEventListener("click", basculer);
      rond.addEventListener("keydown", (e) => {
        // rond = rôle bouton : Entrée/Espace au clavier
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); basculer(); }
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

/** Timeline d'ordre des tours : projection d'un round complet via la MÊME règle
 *  que le moteur (alternance allié/ennemi, invoqués collés à leur invocateur). */
function renderTimeline(): string {
  const ordre: Combatant[] = [];
  const simJoue = new Set<string>();
  let dernier: Camp | null = null;
  for (;;) {
    const a = prochainActeur(combatants, simJoue, dernier);
    if (!a) break;
    simJoue.add(a.ref);
    dernier = a.camp;
    ordre.push(a);
  }
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
        // pas de cible valable (Kaboom sans bombe, Apaisement sans Rage, maxParTour atteint…) : griser
        const sansCible = ciblesValides(acteur, s, combatants).length === 0;
        const abordable = acteur.paActuels >= s.coutPA && cd <= 0 && !sansCible;
        const choisi = selectedSpell?.id === s.id;
        return `<button class="sort ${choisi ? "choisi" : ""} ${cd > 0 ? "cooldown" : ""}" data-sort="${s.id}" ${
          abordable ? "" : "disabled"
        } ${sansCible ? `title="Aucune cible valable"` : ""}>
        <span class="sort-touche">${i + 2}</span>
        <span class="sort-pa-badge"><img src="${PA_ICON}" alt="" onerror="this.remove()" /><b>${s.coutPA}</b></span>
        <span class="sort-icon-wrap"><span class="sort-nom-fallback">${escapeHtml(s.nom)}</span><img class="sort-icon" src="${sortIcon(s.id)}" alt="" onerror="this.closest('.sort-icon-wrap')?.classList.add('noicon'); this.remove()" /></span>
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
         <span class="elem-info" data-tip="${escapeHtml(acteur.elementLibre ? "Kwakwaffe : frappe dans N'IMPORTE quel élément — clique un rond pour choisir." : ELEMENT_AIDE)}">i</span>
         ${acteur.elementLibre
    ? ELEMENTS.map((el, i) => elemRond(el, i + 1, el === actif, true)).join("") // Kwakwaffe : les 4 éléments
    : elemRond(principal, 1, principal === actif, true) + elemRond(secondaire, 2, secondaire === actif, true)}
       </div>`
      : "";

  return `
    <div class="sorts-rangee">
      <div class="sorts-zone">${selecteur}<div class="sorts-liste">${boutons}</div></div>
      <div class="barre-actions-fin"><button id="fin-tour" class="fin-tour primaire" title="Terminer le tour"><img src="${MENU_TERMINER}" alt="Terminer le tour" onerror="this.replaceWith('Terminer le tour')" /> <kbd>${escapeHtml(libelleTouche(config.toucheFinTour))}</kbd></button></div>
    </div>
    ${aide}`;
}
