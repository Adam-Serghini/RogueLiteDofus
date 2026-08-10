// =============================================================================
//  ui/equipe.ts — Écrans de gestion d'équipe : Taverne, Formation,
//  panneau de caractéristiques (montée en niveau) et Fontaine d'Otomai.
// =============================================================================
import { CLASSES, ITEMS } from "../data";
import {
  statsFinales,
  xpRequis,
} from "../progression";
import { sauverConfig } from "../config";
import { BTN_RETOUR, BTN_CONTINUER } from "./assets";
import { root, ecran, escapeHtml, config } from "./dom";
import {
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
  type PersoState,
} from "../run";
import type { Archetype, Meta, Stats } from "../types";

/** Libellé lisible d'un archétype (mêlée = plus robuste, distance = frappe plus fort). */
const ARCHETYPE_LBL: Record<Archetype, string> = {
  melee: "Mêlée",
  distance: "Distance",
};

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
  mortDefinitive = false,
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
          <h1>Recruter ${escapeHtml(CLASSES[recrueEnCours].nom)}</h1>
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
      const morts = persos.filter((p) => p.pvActuels <= 0).length;
      const avertissement = mortDefinitive && morts > 0
        ? `<p class="asc-avertissement">☠ ${morts === 1 ? "Un héros tombé ne se relèvera pas" : `${morts} héros tombés ne se relèveront pas`}. Il faut le${morts > 1 ? "s" : ""} remplacer.</p>`
        : "";
      ecran(`
        <h1>Taverne</h1>
        <p class="sous-titre">Soigne ton équipe, ou recrute un nouveau membre.</p>
        ${avertissement}
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
    let selOrdre = -1; // index sélectionné dans la bande d'ordre (repli clic-puis-clic)
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

    // — Ordre de jeu : réorganise run.persos en place. N'écrit PAS la préférence
    //   durable (Settings.ordre), qui se règle dans les Paramètres : un ordre
    //   dépend de l'équipe réunie ce jour-là, une rangée est un rôle de classe.
    const deplacerOrdre = (src: number, dst: number) => {
      if (src === dst || src < 0 || dst < 0 || src >= persos.length || dst >= persos.length) return;
      const [p] = persos.splice(src, 1);
      persos.splice(dst, 0, p);
      selOrdre = -1;
      draw();
    };

    const draw = () => {
      ecran(`
        <h1>Formation</h1>
        <p class="sous-titre">Glisse-dépose un perso sur une case pour le déplacer (ou l'échanger), ou clique-le puis clique la case. La <b>ligne avant</b> encaisse les sorts de ligne ennemis ; la <b>ligne arrière</b> est protégée. Effet dès le prochain combat.</p>
        <p id="form-msg" class="muet settings-sous" style="display:none"></p>
        <div class="formation-grille">
          <div class="form-rangee"><span class="form-ligne-lbl">Ligne avant</span><div class="form-cells">${rangee([0, 1, 2, 3])}</div></div>
          <div class="form-rangee arriere"><span class="form-ligne-lbl">Ligne arrière</span><div class="form-cells">${rangee([4, 5, 6, 7])}</div></div>
        </div>
        <h2 class="settings-titre">Ordre de jeu</h2>
        <p class="muet settings-sous">Glisse-dépose pour choisir qui joue en premier. Le camp qui ouvre le combat reste décidé par la moyenne d'initiative des deux équipes : ton ordre ne la change pas.</p>
        <div class="ordre-bande">
          ${persos.map((p, i) => `
            <button class="ordre-jeton ${selOrdre === i ? "sel" : ""}" data-ordre="${i}" draggable="true" title="${escapeHtml(CLASSES[p.classeId].nom)}, position ${i + 1}">
              <span class="ordre-rang">${i + 1}</span>
              <img src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
              <span class="ordre-nom">${escapeHtml(CLASSES[p.classeId].nom)}</span>
            </button>`).join("")}
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
        // — glisser-déposer : payload préfixée "cell:<n>" — la grille de placement
        //   et la bande d'ordre partagent l'écran et acceptent toutes deux un
        //   dépôt ; sans préfixe, un jeton d'ordre (charge = un INDEX dans
        //   `persos`) déposé ici serait lu comme un numéro de case, et vice-versa.
        btn.addEventListener("dragstart", (e) => {
          if (!occupant(cell)) {
            e.preventDefault();
            return;
          }
          // deux types MIME : "text/plain" porte la charge lue au drop, le type
          // "roguefus/cell" marqueur sert UNIQUEMENT à distinguer l'origine dès
          // le dragover (getData n'est pas fiable avant le drop, seul .types l'est)
          e.dataTransfer!.setData("text/plain", `cell:${cell}`);
          e.dataTransfer!.setData("roguefus/cell", String(cell));
          e.dataTransfer!.effectAllowed = "move";
          btn.classList.add("drag-src");
        });
        btn.addEventListener("dragend", () => btn.classList.remove("drag-src"));
        btn.addEventListener("dragover", (e) => {
          // ne promet un dépôt valide (et n'autorise le drop) que pour une
          // charge issue de CETTE grille — un jeton d'ordre glissé ici n'a pas
          // le type "roguefus/cell" et doit rester refusé, visuellement et en fait
          if (!e.dataTransfer?.types.includes("roguefus/cell")) return;
          e.preventDefault();
          btn.classList.add("drop-cible");
        });
        btn.addEventListener("dragleave", () =>
          btn.classList.remove("drop-cible"),
        );
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          btn.classList.remove("drop-cible");
          const data = e.dataTransfer!.getData("text/plain");
          if (!data.startsWith("cell:")) return; // charge étrangère (jeton d'ordre) : ignorée
          const src = Number(data.slice(5));
          if (!Number.isNaN(src)) deplacer(src, cell);
        });
      });
      root.querySelectorAll<HTMLButtonElement>(".ordre-jeton").forEach((btn) => {
        const idx = Number(btn.dataset.ordre);
        btn.addEventListener("click", () => {
          if (selOrdre < 0) { selOrdre = idx; draw(); }
          else if (selOrdre === idx) { selOrdre = -1; draw(); }
          else deplacerOrdre(selOrdre, idx);
        });
        // payload préfixée "ordre:<idx>" + type marqueur "roguefus/ordre" —
        // voir le commentaire sur .form-cell ci-dessus
        btn.addEventListener("dragstart", (e) => {
          e.dataTransfer!.setData("text/plain", `ordre:${idx}`);
          e.dataTransfer!.setData("roguefus/ordre", String(idx));
          e.dataTransfer!.effectAllowed = "move";
          btn.classList.add("drag-src");
        });
        btn.addEventListener("dragend", () => btn.classList.remove("drag-src"));
        btn.addEventListener("dragover", (e) => {
          if (!e.dataTransfer?.types.includes("roguefus/ordre")) return;
          e.preventDefault();
          btn.classList.add("drop-cible");
        });
        btn.addEventListener("dragleave", () => btn.classList.remove("drop-cible"));
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          btn.classList.remove("drop-cible");
          const data = e.dataTransfer!.getData("text/plain");
          if (!data.startsWith("ordre:")) return; // charge étrangère (case de grille) : ignorée
          const src = Number(data.slice(6));
          if (!Number.isNaN(src)) deplacerOrdre(src, idx);
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

// Les stats sont entièrement dérivées de (classe, niveau) — voir `statsFinales` — il
// n'y a plus de pool de points à allouer : ce panneau est une LECTURE, pas un écran
// d'allocation. L'archétype + la paire d'éléments (affichés ci-dessous) sont ce qui
// explique les chiffres : mêlée gagne plus de Vitalité, distance frappe plus fort,
// et seuls les 2 éléments déclarés de la classe montent avec le niveau.
const STATS_AFFICHEES: (keyof Stats)[] = ["force", "intelligence", "agilite", "chance", "vitalite"];

function carteProgression(p: PersoState): string {
  const classe = CLASSES[p.classeId];
  const prog = p.progression;
  const finals = statsFinales(classe, prog);
  const bonus = bonusEquipement(p); // stats d'équipement
  const pvMax = pvMaxPerso(p); // PV max équipement inclus
  const xpReq = xpRequis(prog.niveau);
  const xpPct = Math.min(100, Math.round((prog.xp / xpReq) * 100));

  const lignes = STATS_AFFICHEES.map((stat) => {
    const equip = bonus.stats[stat] ?? 0; // apport de l'équipement pour cette stat
    const total = (finals[stat] ?? 0) + equip;
    return `
      <div class="stat-ligne">
        <span class="stat-nom" tabindex="0">${STAT_NOM[stat]}<span class="stat-info">ⓘ</span><span class="stat-aide">${STAT_AIDE[stat]}${STAT_ELEMENTAIRE.has(stat) ? AIDE_ELEMENT : ""}</span></span>
        <span class="stat-val"><b class="stat-total stat-c-${stat}">${total}</b>${equip ? ` + <span class="stat-part-equip" title="Équipement">(${equip})</span>` : ""}</span>
      </div>`;
  }).join("");

  return `
    <div class="carte-prog">
      <div class="prog-tete">
        <span class="prog-nom">${escapeHtml(classe.nom)}</span>
        <span class="prog-niv">Niv. ${prog.niveau}</span>
      </div>
      <div class="prog-archetype muet">${ARCHETYPE_LBL[classe.archetype]} · ${pastillesElements(p)}</div>
      <div class="barre-xp"><div class="barre-xp-rempli" style="width:${xpPct}%"></div>
        <span class="xp-txt">XP ${prog.xp} / ${xpReq}</span>
      </div>
      <div class="prog-pv">PV max : <b>${pvMax}</b> · PV actuels : ${Math.max(0, Math.round(p.pvActuels))}</div>
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
    <span class="bonus-dofus-titre">🐉 Bonus de Dofus : toute l'équipe</span>
    <div class="bonus-dofus-liste">${parts.map((p) => `<span class="bonus-dofus-chip">${p}</span>`).join("")}</div>
  </div>`;
}

/**
 * Panneau de caractéristiques : LECTURE seule (les stats montent seules, selon
 * l'archétype de chaque classe — plus rien à dépenser). `titre`/`sousTitre`
 * permettent de réutiliser l'écran pour d'autres contextes.
 */
export function showStatPanel(
  persos: PersoState[],
  titre = "Caractéristiques",
  sousTitre = "Les caractéristiques montent seules, selon l'archétype de chaque classe.",
  retour = false,
  meta: Meta | null = null,
): Promise<void> {
  return new Promise((res) => {
    ecran(`
      <h1>${escapeHtml(titre)}</h1>
      <p class="sous-titre">${escapeHtml(sousTitre)}</p>
      ${sectionBonusDofus(meta)}
      <div class="prog-grille">${persos.map(carteProgression).join("")}</div>
      <div class="boutons-ecran">${retour
        ? `<button id="prog-fermer" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button>`
        : `<button id="prog-fermer" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button>`}</div>
    `);
    document
      .getElementById("prog-fermer")
      ?.addEventListener("click", () => res());
  });
}

