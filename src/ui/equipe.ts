// =============================================================================
//  ui/equipe.ts — Écrans de gestion d'équipe : Taverne, Formation,
//  panneau de caractéristiques (montée en niveau) et Fontaine d'Otomai.
// =============================================================================
import { CLASSES, ITEMS } from "../data";
import { ELEMENTS } from "../combat";
import {
  STAT_KEYS,
  statsFinales,
  xpRequis,
  coutPoint,
  investirN,
} from "../progression";
import { sauverConfig } from "../config";
import { elementAsset, BTN_RETOUR, BTN_CONTINUER, ICON_VITA } from "./assets";
import { root, ecran, escapeHtml, config } from "./dom";
import {
  elNom,
  pastillesElements,
  classSymbol,
  carteClasse,
  STAT_NOM,
  STAT_AIDE,
  AIDE_ELEMENT,
} from "./composants";
import {
  bonusEquipement,
  bonusEquipe,
  pvMaxPerso,
  appliquerElement,
  STAT_PAR_ELEMENT,
  type PersoState,
} from "../run";
import type { Element, Meta, Stats } from "../types";

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

    // un perso portant un objet « ligne avant uniquement » ne peut pas passer derrière
    const bloqueArriere = (p: PersoState | undefined, dst: number): boolean =>
      !!p && dst >= 4 && Object.values(p.equipement).some((i) => i && ITEMS[i.id]?.ligneAvant);

    // déplace/échange l'occupant de `src` vers `dst`
    const deplacer = (src: number, dst: number) => {
      if (src === dst) return;
      const a = occupant(src);
      const b = occupant(dst);
      if (bloqueArriere(a, dst) || bloqueArriere(b, src)) {
        const msg = document.getElementById("form-msg");
        if (msg) { msg.textContent = "⛔ La Cape Edepee exige la ligne avant : dépose-la avant de reculer."; msg.style.display = ""; }
        return;
      }
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
        <p id="form-msg" class="muet settings-sous" style="display:none"></p>
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
                <button class="form-el-btn alloc-vita ${p.statAuto === "vitalite" ? "sel" : ""}" data-perso="${p.classeId}" data-el="vitalite" title="Points → Vitalité (PV) · frappe = plus haute carac"><img src="${ICON_VITA}" alt="" onerror="this.remove()" /><span>Vitalité</span></button>
                <button class="form-el-btn libre ${p.elementChoisi || p.statAuto ? "" : "sel"}" data-perso="${p.classeId}" data-el="libre" title="Allocation manuelle">Libre</button>
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
          appliquerElement(p, el === "libre" ? null : (el as Element | "vitalite"));
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

// --- Panneau de personnages (niveaux & points) -------------------------------
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
  const bonus = bonusEquipement(p); // stats d'équipement
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

/**
 * Panneau de progression : dépenser les points dans les stats.
 * `titre`/`sousTitre` permettent de réutiliser l'écran pour l'Otomai.
 */
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
