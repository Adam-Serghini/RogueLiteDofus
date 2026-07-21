// =============================================================================
//  ui/accueil.ts — écrans d'accueil : démarrage, choix d'équipe, succès, Dofus.
// =============================================================================
import { DOFUS, TRANCHES } from "../data";
import { escapeHtml, ecran, root } from "./dom";
import {
  LOGO,
  BTN_JOUER,
  MENU_BESTIAIRE,
  MENU_ARMURERIE,
  MENU_SUCCES,
  MENU_PARAM,
  MENU_ACCUEIL,
  MENU_DOFUS,
  BTN_RETOUR,
} from "./assets";
import { renderDofusRack, carteClasse } from "./composants";
import { classesDisponibles, SUCCES } from "../run";
import { showSettings } from "./inventaire";
import { showBestiaire, showArmurerie } from "./collections";
import type { Meta } from "../types";

// --- Écrans ------------------------------------------------------------------
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
        <button id="btn-armurerie" class="coin-param" title="Armurerie"><img src="${MENU_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /></button>
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
      .getElementById("btn-armurerie")
      ?.addEventListener("click", async () => {
        await showArmurerie(meta);
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

/** Écran de départ : choisir 2 classes parmi les classes jouables pour commencer la run. */
export function showChoixEquipe(): Promise<string[] | null> {
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
          <button id="choix-retour" class="aside-icone" title="Retour à l'accueil"><img src="${MENU_ACCUEIL}" alt="Accueil" onerror="this.remove()" /></button>
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
      document.getElementById("choix-retour")?.addEventListener("click", () => res(null));
    };
    draw();
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
