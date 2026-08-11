// =============================================================================
//  ui/index.ts — Rendu DOM minimal + contrôleur joueur (clic sort → clic cible).
//  Aucune logique de combat ici : on lit l'état et on renvoie des Actions.
// =============================================================================
import { setRoot, initEchapRetour } from "./dom";
export { A } from "./assets";
import { initDofusTooltip, initAideTooltip, setFondTranche } from "./composants";
export { renderDofusRack, setFondTranche } from "./composants";
import { initSortTooltip, initControlesClavier } from "./combat";
export { beginCombat, onUpdate, fxEvent, playerController, log } from "./combat";

export function init(el: HTMLElement): void {
  setRoot(el);
  setFondTranche(null); // fond de l'accueil dès le lancement
  initDofusTooltip();
  initSortTooltip();
  initAideTooltip();
  initControlesClavier();
  initEchapRetour();
}

// --- Écrans ------------------------------------------------------------------
export { showStart, showChoixEquipe, showSucces, showCollectionDofus } from "./accueil";
export type { RepriseInfo, StartAction } from "./accueil";
export { showCarte, showZaap, showTransition } from "./carte";
export { showRecap } from "./fin";
export { showTaverne, showFormation, showStatPanel } from "./equipe";
export type { ActionTaverne } from "./equipe";
export { showInventaire, showDrop, showSettings } from "./inventaire";
export { showBestiaire, showArmurerie, showCapture, showEncyclopedie } from "./collections";
export { showHDV, showForgemagie } from "./boutique";
