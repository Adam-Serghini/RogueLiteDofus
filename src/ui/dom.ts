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

// --- Écrans ------------------------------------------------------------------
export function ecran(html: string): void {
  masquerTooltips(); // l'élément survolé disparaît sans mouseout : pas d'infobulle orpheline
  root.innerHTML = `<div class="ecran">${html}</div>`;
}
