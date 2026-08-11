// =============================================================================
//  dofus-effets.ts — effets de reliques à DÉCLENCHEMENT. Pur au sens du projet :
//  aucun DOM, aucun stockage, aucune lecture de la Meta — il reçoit l'ensemble des
//  reliques actives en argument.
//
//  Il DÉCRIT les soins et les boucliers (`IntentionsDofus`) au lieu de les appliquer :
//  soigner et poser un bouclier vivent dans `combat.ts`, et les importer ici créerait
//  un cycle (combat → effets → combat). Il POSE lui-même la marque d'ARMEMENT du
//  porteur (`argenteArme`, via `marquerSeuilArgente`) — un simple drapeau, pas une
//  mutation de PV — mais PAS les marques de CONSOMMATION (`argenteUtilise`,
//  `veilleursRecuCeTour`) : celles-ci ne se posent qu'une fois le soin CONFIRMÉ
//  appliqué (la friction peut le bloquer, et ce module ne sait pas la lire), donc
//  `combat.ts` les pose lui-même dans `appliquerIntentions`, sur la foi des jetons
//  `argenteConsume`/`veilleursConsume` que ce module se contente de DÉCRIRE.
// =============================================================================
import type { Combatant } from "./types";

/** Reliques que ce module sait déclencher. Confrontée au catalogue par un test :
 *  un identifiant mal orthographié donnerait un effet qui ne part jamais, en silence. */
export const RELIQUES_A_CROCHET = [
  "dokoko", "dofus_nebuleux", "dofus_argente", "dofus_argente_scintillant",
  "dofus_emeraude", "dofus_des_veilleurs", "dorigami", "dofus_tachete", "domakuro",
] as const;

export interface IntentionsDofus {
  soins: {
    ref: string;
    montant: number;
    // Jetons de consommation, posés par `appliquerIntentions` (src/combat.ts)
    // SEULEMENT si le soin a réellement eu lieu (la friction peut le bloquer) —
    // ce module ne les pose pas lui-même : il ne sait pas si la cible a la
    // friction, `combat.ts` seul le sait.
    argenteConsume?: boolean; // Argenté/Scintillant : une seule fois par combat
    veilleursConsume?: boolean; // Veilleurs : non cumulable sur un même bénéficiaire
  }[];
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
  // `argenteArme` n'est PAS désarmé ici : si `combat.ts` constate que la friction
  // bloque le soin, il ne pose pas `argenteConsume`, et l'armement doit rester
  // intact pour retenter au prochain tour du porteur — sans quoi son unique
  // déclenchement par combat serait brûlé pour un soin qui n'a jamais eu lieu.
  if (acteur.argenteArme !== undefined && tour > acteur.argenteArme) {
    out.soins.push({ ref: acteur.ref, montant: pct(acteur, 0.2), argenteConsume: true });
  }
  return out;
}

/** Crochet de mort d'un ennemi : décrit le bouclier dû à l'auteur du coup fatal.
 *
 *  Dorigami : quand le porteur abat un ennemi, il gagne 20 % de SES PROPRES PV max
 *  en bouclier pour 1 tour. `tueur` est déjà garanti être du camp joueur par le
 *  site d'appel (`infligerDegats`, via `reliquesPour` côté combat.ts) — ce crochet
 *  ne refait pas cette vérification, comme les deux autres crochets de ce module. */
export function crochetMortEnnemi(tueur: Combatant, actives: Set<string>): IntentionsDofus {
  const out = vide();
  if (actives.has("dorigami")) {
    out.boucliers.push({ ref: tueur.ref, montant: pct(tueur, 0.2), tours: 1 });
  }
  return out;
}

const estAvant = (c: Combatant): boolean => c.position < 4;

// Dupliqué depuis `allies()` (src/combat.ts) plutôt qu'importé : ce module est PUR
// et `combat.ts` l'importe déjà (crochets de reliques) — l'importer en retour créerait
// le cycle décrit en tête de fichier. Même compromis que `estAvant`/`vivants`
// ci-dessus. Exclut la Lance (camp "ennemi" mais équipement du joueur, jamais un
// ALLIÉ réel) et les invocations-obstacles (Poupée, Égide) — règle née sur l'Égide,
// qui se faisait sinon buffer/soigner par un effet « allié » automatique.
const alliesVivants = (acteur: Combatant, cs: Combatant[]): Combatant[] =>
  cs.filter((c) => c.pvActuels > 0 && c.camp === acteur.camp && !c.estLance && !c.estInvocation);

const STATS_ELEM = ["force", "intelligence", "agilite", "chance"] as const;

/** Crochet de dégâts infligés (Tacheté) : appelé UNE FOIS PAR LANCER qui inflige
 *  réellement des dégâts (jamais une fois par cible touchée — même règle que les
 *  effets de rangée/portée, voir CLAUDE.md), quel que soit le nombre de cibles
 *  atteintes par ce lancer.
 *
 *  Buff les ALLIÉS (jamais le porteur lui-même) de +5 dans les quatre stats
 *  élémentaires pour 1 tour, non cumulable — un allié ne porte qu'un exemplaire à la
 *  fois, reconnu par le marqueur `source` posé sur l'effet. Muté DIRECTEMENT (ce sont
 *  des effets datés, comme `appliquerEffet`, pas des soins/boucliers décrits) : les
 *  décrire via `IntentionsDofus` n'apporterait qu'une indirection, ce module pose déjà
 *  ses propres marques d'état ailleurs (voir en-tête de fichier).
 *
 *  Round de correction 1 : Domakuro ne s'appuie PLUS sur ce crochet. `aFrappeCeTour`
 *  est posé directement dans `infligerDegats` (src/combat.ts), le seul point que
 *  traversent VRAIMENT tous les sorts de dégâts — y compris les branches à retour
 *  anticipé de `lancerSort` (Dagues Boomerang, Flèche Enflammée/de Recul, Rayon de
 *  Wakfu) qui ne passent jamais par ce crochet-ci, appelé uniquement depuis le chemin
 *  de dégâts « normal ». Un porteur qui ouvrirait son premier tour par un de ces sorts
 *  aurait sinon gardé `aFrappeCeTour` à `false` et gagné le bonus permanent du
 *  Domakuro malgré avoir frappé — l'inverse de ce que sa description promet. */
export function crochetDegatsInfliges(
  lanceur: Combatant, cs: Combatant[], actives: Set<string>,
): void {
  if (!actives.has("dofus_tachete")) return;
  for (const a of alliesVivants(lanceur, cs)) {
    if (a.ref === lanceur.ref) continue;
    if (a.effets.some((e) => e.source === "dofus_tachete")) continue; // non cumulable
    for (const stat of STATS_ELEM) {
      a.effets.push({ stat, valeur: 5, toursRestants: 1, source: "dofus_tachete" });
    }
  }
}

/** Crochet de fin de tour : décrit les soins/boucliers dus au porteur pour le tour
 *  qui vient de se terminer.
 *
 *  Émeraude : compte les ennemis VIVANTS de la ligne AVANT du camp adverse (les
 *  morts et la ligne arrière ne comptent pas), et rend un bouclier de 3 % des PV
 *  max du porteur par ennemi ainsi compté.
 *
 *  Veilleurs : soigne les alliés de la MÊME ligne que le porteur (jamais lui-même)
 *  de 5 % des PV max DU PORTEUR — délibéré : un tank qui porte la relique soigne
 *  beaucoup. Non cumulable : la marque `veilleursRecuCeTour` est posée sur le
 *  BÉNÉFICIAIRE (pas le porteur) et effacée au début de son propre tour, dans
 *  `reinitialiserLancersTour` (src/combat.ts) — sans elle, plusieurs porteurs sur
 *  une même ligne se soigneraient mutuellement à chaque fin de tour.
 *
 *  Domakuro : lit `aFrappeCeTour`, posé par `infligerDegats` (src/combat.ts) sur
 *  TOUT attaquant dont un coup inflige des dégâts — Round de correction 1, voir la
 *  docstring de `crochetDegatsInfliges` ci-dessus pour le pourquoi de ce point
 *  d'appel plutôt que celui-ci. */
export function crochetFinTour(
  acteur: Combatant, cs: Combatant[], actives: Set<string>,
): IntentionsDofus {
  const out = vide();
  const vivants = cs.filter((c) => c.pvActuels > 0);
  if (actives.has("dofus_emeraude")) {
    // `!c.estLance` : la Lance (Forgelance) partage le camp "ennemi" pour la
    // grille/le ciblage mais appartient à l'équipe du joueur — sans cette garde,
    // un Iop qui plante sa propre Lance gonfle le bouclier de l'Émeraude en la
    // comptant comme une menace en ligne avant adverse.
    const devant = vivants.filter((c) => c.camp !== acteur.camp && !c.estLance && estAvant(c)).length;
    if (devant > 0) out.boucliers.push({ ref: acteur.ref, montant: pct(acteur, 0.03 * devant), tours: 1 });
  }
  if (actives.has("dofus_des_veilleurs")) {
    // Ne pose PAS `veilleursRecuCeTour` ici : `combat.ts` (`appliquerIntentions`) ne
    // le fait qu'après confirmation que le soin a réellement eu lieu (`veilleursConsume`)
    // — sinon la friction (toile 19) marquerait un bénéficiaire comme déjà servi pour
    // un soin qui n'a jamais atterri, lui fermant la porte pour le reste du round.
    for (const a of alliesVivants(acteur, cs)) {
      if (a.ref === acteur.ref) continue;
      if (estAvant(a) !== estAvant(acteur) || a.veilleursRecuCeTour) continue;
      out.soins.push({ ref: a.ref, montant: pct(acteur, 0.05), veilleursConsume: true });
    }
  }
  // Domakuro : le bonus se décide à la fin du PREMIER tour du porteur, et vaut pour
  // le reste du combat. Après ce tour-là, `toursJoues` n'est plus jamais égal à 1 et
  // plus rien ne peut le déclencher — ni le réarmer si un tour ultérieur est calme.
  if (actives.has("domakuro") && (acteur.toursJoues ?? 0) === 1 && !acteur.aFrappeCeTour) {
    acteur.degatsPctPermanent = (acteur.degatsPctPermanent ?? 0) + 0.01;
  }
  // Remis à zéro à CHAQUE fin de tour, quelles que soient les reliques actives :
  // sans ça, un porteur qui frappe une seule fois resterait marqué `aFrappeCeTour`
  // pour tout le reste du combat.
  acteur.aFrappeCeTour = false;
  return out;
}
