// =============================================================================
//  dofus-effets.ts — effets de reliques à DÉCLENCHEMENT. Pur au sens du projet :
//  aucun DOM, aucun stockage, aucune lecture de la Meta — il reçoit l'ensemble des
//  reliques actives en argument.
//
//  Il DÉCRIT les soins et les boucliers (`IntentionsDofus`) au lieu de les appliquer :
//  soigner et poser un bouclier vivent dans `combat.ts`, et les importer ici créerait
//  un cycle (combat → effets → combat). Il POSE en revanche lui-même les marques
//  d'état du porteur (`argenteArme`, `argenteUtilise`) : ce sont des drapeaux, pas des
//  mutations de PV, et les faire transiter par une intention n'apporterait qu'une
//  indirection.
// =============================================================================
import type { Combatant } from "./types";

export interface IntentionsDofus {
  soins: { ref: string; montant: number }[];
  boucliers: { ref: string; montant: number; tours: number }[];
  degatsPct: number; // multiplicateur additif appliqué au lanceur ce tour-ci
}

const vide = (): IntentionsDofus => ({ soins: [], boucliers: [], degatsPct: 0 });
const pct = (c: Combatant, p: number): number => Math.round(c.pvMax * p);

/** Argenté : arme le soin quand le porteur passe sous 20 % de ses PV, une seule
 *  fois par combat. Le Scintillant absorbe le même déclenchement (la garde
 *  `argenteUtilise` empêche les deux de soigner deux fois si le joueur possède
 *  les deux reliques).
 *
 *  Appelé par le moteur aux DEUX endroits où des PV sont réellement retirés : dans
 *  `infligerDegats` (le coup arrive pendant le tour d'un AUTRE combattant — l'attaquant),
 *  et dans le tick de poison d'`effetsDebutTour` (qui retire des PV en dehors
 *  d'`infligerDegats` — voir sa note en tête de `combat.ts` — et le fait PENDANT le
 *  tout début du tour du porteur lui-même, juste avant que ce même tour n'appelle
 *  `crochetDebutTour`). Ce second site est la raison pour laquelle l'armement retient
 *  un NUMÉRO DE TOUR plutôt qu'un booléen : sans lui, l'ordre des deux appels dans la
 *  même itération de `runCombat` ferait consommer le soin dans l'instant qui l'arme,
 *  au lieu du tour suivant. */
export function marquerSeuilArgente(c: Combatant, actives: Set<string>): void {
  if (!actives.has("dofus_argente") && !actives.has("dofus_argente_scintillant")) return;
  if (c.argenteUtilise || c.argenteArme !== undefined) return;
  if (c.pvActuels > 0 && c.pvActuels < c.pvMax * 0.2) c.argenteArme = c.toursJoues ?? 0;
}

/** Crochet de début de tour : décrit les soins/boucliers/malus dus au porteur pour
 *  CE tour, sans rien muter côté PV — seules les marques d'état de l'Argenté sont
 *  posées ici (voir en-tête de fichier).
 *
 *  L'Argenté ne se consomme que si le tour COURANT est strictement postérieur au
 *  tour où il a été armé (`argenteArme`) : la règle « jamais pendant le tour où le
 *  seuil a été franchi » ne dépend donc plus de l'ordre des appels moteur qui
 *  peuvent l'armer, seulement du numéro de tour retenu par `marquerSeuilArgente`. */
export function crochetDebutTour(
  acteur: Combatant, _cs: Combatant[], actives: Set<string>,
): IntentionsDofus {
  const out = vide();
  const tour = acteur.toursJoues ?? 0;
  if (actives.has("dokoko") && tour % 2 === 0) {
    out.soins.push({ ref: acteur.ref, montant: pct(acteur, 0.1) });
  }
  if (actives.has("dofus_nebuleux")) {
    out.degatsPct += tour % 2 === 0 ? 0.05 : -0.05;
  }
  if (acteur.argenteArme !== undefined && tour > acteur.argenteArme) {
    acteur.argenteArme = undefined;
    acteur.argenteUtilise = true;
    out.soins.push({ ref: acteur.ref, montant: pct(acteur, 0.2) });
  }
  return out;
}
