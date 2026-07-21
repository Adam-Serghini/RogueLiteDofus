// =============================================================================
//  ui/index.ts — Rendu DOM minimal + contrôleur joueur (clic sort → clic cible).
//  Aucune logique de combat ici : on lit l'état et on renvoie des Actions.
// =============================================================================
import { setRoot } from "./dom";
export { A } from "./assets";
import { initDofusTooltip, initAideTooltip } from "./composants";
export { renderDofusRack } from "./composants";
import { initSortTooltip, initControlesClavier } from "./combat";
export { beginCombat, onUpdate, fxEvent, playerController, log } from "./combat";

export function init(el: HTMLElement): void {
  setRoot(el);
  initDofusTooltip();
  initSortTooltip();
  initAideTooltip();
  initControlesClavier();
}

// --- Écrans ------------------------------------------------------------------
export { showStart, showChoixEquipe, showSucces, showCollectionDofus } from "./accueil";
export type { RepriseInfo, StartAction } from "./accueil";
export { showCarte, showZaap, showTransition } from "./carte";
export { showRecap, showWipe } from "./fin";
export { showTaverne, showFormation, showStatPanel, showOtomai } from "./equipe";
export type { ActionTaverne } from "./equipe";
export { showInventaire, showDrop, showSettings } from "./inventaire";
export { showDofus, showBestiaire, showArmurerie, showCapture } from "./collections";
export { showHDV, showForgemagie } from "./boutique";
