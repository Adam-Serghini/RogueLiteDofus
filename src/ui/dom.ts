// =============================================================================
//  dom.ts — base DOM partagée : racine de rendu, tooltips flottants, config joueur.
//  Aucune logique de combat ni d'écran ici.
// =============================================================================
import { chargerConfig, type Settings } from "../config";

export let root: HTMLElement;
export function setRoot(el: HTMLElement): void {
  root = el;
}

export const config: Settings = chargerConfig();

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string,
  );
}

// Tous les tooltips flottants vivent HORS de #app : un re-render (clic sur un
// nœud, action de combat…) détache l'élément survolé sans émettre de mouseout,
// laissant l'infobulle orpheline à l'écran. On les cache donc centralement.
export const tipsFlottants: HTMLElement[] = [];
export function masquerTooltips(): void {
  for (const t of tipsFlottants) t.style.display = "none";
}

// --- Fond d'écran ------------------------------------------------------------
/** Pose (ou retire avec null) une image de fond plein écran sur le <body>. */
export function setFond(url: string | null): void {
  if (url) {
    document.body.classList.add("avec-fond");
    document.body.style.setProperty("--fond-run", `url("${url}")`);
  } else {
    document.body.classList.remove("avec-fond");
    document.body.style.removeProperty("--fond-run");
  }
}

// --- Écrans ------------------------------------------------------------------
/** Rend un écran plein cadre. `cls` ajoute une classe au conteneur `.ecran` pour
 *  les écrans qui ont besoin d'une mise en page propre (l'accueil, qui doit tenir
 *  dans la fenêtre sans ascenseur). */
export function ecran(html: string, cls = ""): void {
  masquerTooltips(); // l'élément survolé disparaît sans mouseout : pas d'infobulle orpheline
  root.innerHTML = `<div class="ecran${cls ? ` ${cls}` : ""}">${html}</div>`;
}

/** Échap ferme l'écran courant, en doublure de la barre collante.
 *
 *  Volontairement AVEUGLE au jeu : elle clique le bouton Retour de la barre d'actions,
 *  quel qu'il soit, et ne fait rien s'il n'y en a pas. C'est ce qui la rend sûre en
 *  combat — l'écran de combat n'a pas de `.boutons-ecran`, donc Échap y reste inerte
 *  et ne peut pas entrer en conflit avec ses propres raccourcis.
 *
 *  Un seul bouton est cliqué (`querySelector`) : un écran qui en alignerait plusieurs
 *  verrait le premier l'emporter, ce qui est l'ordre de lecture attendu. */
export function initEchapRetour(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const actif = document.activeElement;
    // ne pas voler la touche à une saisie en cours (Échap y annule l'édition)
    if (actif instanceof HTMLInputElement || actif instanceof HTMLTextAreaElement || actif instanceof HTMLSelectElement) return;
    const btn = root?.querySelector<HTMLButtonElement>(".ecran .boutons-ecran .btn-retour");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    btn.click();
  });
}
