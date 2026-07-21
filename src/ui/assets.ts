// =============================================================================
//  assets.ts — chemins et constantes d'assets (icônes, images de menu, sorts…).
//  Aucune logique ici : uniquement des chemins et de petites fonctions pures.
// =============================================================================
import { CLASSES, SORT_DOSSIER } from "../data";
import type { Element } from "../types";

/** Préfixe un chemin d'asset par la base de déploiement (GitHub Pages = /RogueLiteDofus/). */
export const A = (p: string): string =>
  import.meta.env.BASE_URL + p.replace(/^\/+/, "");

/**
 * Icône d'un sort, rangée par classe propriétaire : `/assets/spells/<classe>/<id>.png`
 * (sorts de monstres → `/monstres/`). Absente → l'`onerror` de la balise image la retire.
 */
export const sortIcon = (id: string): string =>
  A(`/assets/spells/${SORT_DOSSIER[id] ?? "monstres"}/${id}.png`);

export const PA_ICON = A("/assets/divers/etoile.png"); // gemme de PA des cartes
export const COEUR_PLEIN = A("/assets/divers/coeur_base.png"); // texture du cœur de PV (combat)
export const LOGO = A("/assets/divers/Roguefus_lite.png");
export const BTN_JOUER = A("/assets/menu/Jouer.png");
export const BTN_RETOUR = A("/assets/menu/retour.png");
export const BTN_CONTINUER = A("/assets/menu/continuer.png");
export const MENU_PERSOS = A("/assets/menu/Caracteristiques.png");
export const MENU_FORMATION = A("/assets/menu/Formation.png");
export const MENU_INVENTAIRE = A("/assets/menu/Inventaire.png");
export const MENU_BESTIAIRE = A("/assets/menu/bestiaires.png");
export const MENU_ARMURERIE = A("/assets/menu/armurerie.png"); // absent : fallback 🛡️ dans le bouton
export const MENU_PARAM = A("/assets/menu/parametres.png");
export const MENU_SUCCES = A("/assets/menu/succes.png");
export const MENU_ACCUEIL = A("/assets/menu/Menu.png");
export const MENU_RESTART = A("/assets/menu/Recommencer.png");
export const MENU_TERMINER = A("/assets/menu/Terminer.png");
export const CASE_DEPART = A("/assets/menu/Depart.png");
export const MENU_RESTART_PERSO = A("/assets/menu/Recommencer_avec_perso.png");
export const MENU_DOFUS = A("/assets/menu/dofus.png");
export const ICON_KAMAS = A("/assets/divers/kamas.png");
export const ICON_VITA = A("/assets/divers/coeur.png");

export const elementAsset = (el: string): string => A(`/assets/elements/${el}.png`);

// Icônes de stats secondaires (cf. maquette de carte)
export const ICON_CRIT = A("/assets/elements/critique.png");
export const ICON_DMGCRIT = A("/assets/elements/dmgCritique.png");
export const ICON_SOIN = A("/assets/elements/soin.png");
export const ICON_PUISS = A("/assets/elements/puissance.png");
export const ICON_PP = A("/assets/elements/pp.png");
export const ICON_REMB_PA = A("/assets/elements/rembPA.png");
export const resAsset: Record<Element, string> = {
  terre: A("/assets/elements/resTerre.png"),
  feu: A("/assets/elements/resFeu.png"),
  eau: A("/assets/elements/resEau.png"),
  air: A("/assets/elements/resAir.png"),
};

export const classe_img = (classeId: string): string =>
  A(CLASSES[classeId]?.img ?? `/assets/classes/${classeId}.png`);

export const itemImg = (id: string): string => A(`/assets/items/${id}.png`);
