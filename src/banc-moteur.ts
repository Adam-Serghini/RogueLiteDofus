// =============================================================================
//  banc-moteur.ts — point d'entrée du bundle inliné dans editeur.html. Façade
//  EXPLICITE : l'éditeur ne consomme que ces symboles, et `banc-moteur.test.ts`
//  la fige pour qu'un renommage en amont casse au test plutôt qu'à l'ouverture
//  du fichier chez le game designer.
// =============================================================================
export { appliquerContenuEdite } from "./data";
export { instanceDuTier } from "./run";
export {
  construireHeros, construireHerosDetaille, construireMannequins,
  mesurerLancer, mesurerTour, MAX_COMPTEURS, REPETITIONS,
} from "./banc";
