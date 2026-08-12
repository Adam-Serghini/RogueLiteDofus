// =============================================================================
//  progression.ts — Niveaux & caractéristiques (pur, testable).
//  Aucune dépendance au DOM ni au localStorage. Les stats d'un héros sont
//  entièrement déterminées par sa classe (archétype + éléments) et son niveau —
//  il n'y a plus d'allocation manuelle.
// =============================================================================
import type { Archetype, Classe, Element, Progression, Stats } from "./types";

// --- Constantes tunables -----------------------------------------------------
export const PV_PAR_VITA = 1; // PV max gagnés par point de Vitalité
const SEUIL_COUT_2 = 200; // au-delà, un point coûte 2
const SEUIL_COUT_3 = 300; // au-delà, un point coûte 3

/** Points gagnés à chaque niveau : `parElement` dans CHACUN des deux éléments de la
 *  classe, plus `vitalite`. Le mêlée est plus robuste, le distance frappe plus fort. */
export const GAINS_ARCHETYPE: Record<Archetype, { parElement: number; vitalite: number }> = {
  melee: { parElement: 3, vitalite: 2 },
  distance: { parElement: 4, vitalite: 1 },
};

/** Caractéristique portant chaque élément. Ce mapping vit ICI (et non dans run.ts ou
 *  combat.ts) parce que c'est lui qui décide où tombent les gains de niveau. */
export const STAT_PAR_ELEMENT: Record<Element, keyof Stats> = {
  terre: "force", feu: "intelligence", air: "agilite", eau: "chance",
};

/** Valeur de la caractéristique portant un élément. */
export const statElement = (stats: Stats, el: Element): number =>
  stats[STAT_PAR_ELEMENT[el]] ?? 0;

/** Dégâts : chaque point de la caractéristique de frappe majore la FOURCHETTE de base
 *  de ce ratio (à 3 %, 100 points de stat font ×4, 200 points ×7).
 *
 *  Taux UNIQUE de tout le jeu, joueurs et monstres. Il a remplacé le `scaling` réglé
 *  sort par sort et la formule ADDITIVE `jet + stat × scaling` : un sort se règle
 *  désormais par sa seule fourchette, ce qui rend la lecture directe (« telle
 *  fourchette one-shot telle tranche de PV »). Conséquence à connaître : le bonus de
 *  stat est maintenant PROPORTIONNEL à la fourchette, donc élargir une fourchette
 *  majore aussi tout le scaling du sort — ce n'était pas le cas avant. */
export const DEGATS_PAR_POINT = 0.03;

/** Multiplicateur de fourchette apporté par la caractéristique de frappe.
 *  Source UNIQUE : le pipeline de dégâts, le classement des éléments et les
 *  infobulles la partagent (une copie approchée finirait par diverger). */
export const multStatFrappe = (stat: number): number => 1 + DEGATS_PAR_POINT * stat;

/** terre : +1 vitalité par N de force (passif, PAR-DESSUS le tarif). */
export const VITA_PAR_FORCE = 5;
/** eau : +1 prospection par N de chance (passif, PAR-DESSUS le tarif). */
export const PROSP_PAR_CHANCE = 3;

export function progressionInitiale(): Progression {
  return { niveau: 1, xp: 0 };
}

/** XP requise pour passer du niveau donné au suivant. */
export function xpRequis(niveau: number): number {
  return 50 + (niveau - 1) * 25;
}

/** Coût d'un point supplémentaire dans une caractéristique déjà à `dejaInvesti`. */
export function coutPoint(dejaInvesti: number): number {
  if (dejaInvesti < SEUIL_COUT_2) return 1;
  if (dejaInvesti < SEUIL_COUT_3) return 2;
  return 3;
}

/** Caractéristique obtenue en dépensant `points` dans UNE caractéristique, au tarif
 *  croissant de `coutPoint`. Volontairement écrit comme une boucle : `coutPoint` reste
 *  l'unique source du tarif, et la fonction est évidemment correcte à la lecture.
 *  Borné à ~800 itérations (niveau 200, archétype distance). */
export function statPourPoints(points: number): number {
  let stat = 0;
  let restant = points;
  while (restant >= coutPoint(stat)) {
    restant -= coutPoint(stat);
    stat += 1;
  }
  return stat;
}

/** Stats finales = base de classe + gains d'archétype au niveau atteint + les deux
 *  passifs élémentaires. Fonction PURE du couple (classe, niveau) : aucun état
 *  d'allocation n'existe plus, et l'équipement est ajouté ailleurs (run.ts). */
export function statsFinales(classe: Classe, p: Progression): Stats {
  const g = GAINS_ARCHETYPE[classe.archetype];
  const niveaux = Math.max(0, p.niveau - 1);
  const base = classe.stats;
  const gagne = (k: keyof Stats): number =>
    classe.elements.some((el) => STAT_PAR_ELEMENT[el] === k)
      ? statPourPoints(g.parElement * niveaux)
      : 0;
  const force = (base.force ?? 0) + gagne("force");
  const chance = (base.chance ?? 0) + gagne("chance");
  return {
    force,
    intelligence: (base.intelligence ?? 0) + gagne("intelligence"),
    agilite: (base.agilite ?? 0) + gagne("agilite"),
    chance,
    // vitalité : le gain d'archétype passe par le tarif, le passif de terre s'ajoute
    // PAR-DESSUS (il n'est pas acheté, il est dérivé)
    vitalite: (base.vitalite ?? 0) + statPourPoints(g.vitalite * niveaux) + Math.floor(force / VITA_PAR_FORCE),
    prospection: (base.prospection ?? 0) + Math.floor(chance / PROSP_PAR_CHANCE),
    soin: base.soin ?? 0, // valeur de classe, jamais gagnée au niveau
  };
}

/** Ajoute de l'XP et fait monter de niveau (plafonné à `niveauMax` : l'XP
 *  excédentaire est perdue — le cap de la tranche). Renvoie les niveaux gagnés. */
export function gagnerXP(p: Progression, gain: number, niveauMax = Infinity): number {
  if (p.niveau >= niveauMax) return 0;
  p.xp += gain;
  let niveauxGagnes = 0;
  while (p.niveau < niveauMax && p.xp >= xpRequis(p.niveau)) {
    p.xp -= xpRequis(p.niveau);
    p.niveau += 1;
    niveauxGagnes += 1;
  }
  if (p.niveau >= niveauMax) p.xp = 0; // cap atteint : surplus perdu
  return niveauxGagnes;
}

/** PV max = pvBase + vitalité finale × PV_PAR_VITA. */
export function pvMaxFor(classe: Classe, p: Progression): number {
  return classe.pvBase + statsFinales(classe, p).vitalite * PV_PAR_VITA;
}

/** Multiplicateur de dégâts finaux (Intelligence — l'identité du feu, plafonné à +20 %).
 *  Le plafond est fixé à 200 d'intelligence et non à 100 : la marge doit encore servir
 *  en T2-T5, où la caractéristique de frappe monte jusqu'à 432. */
export function multOffensif(stats: Stats): number {
  return 1 + Math.min(0.2, stats.intelligence * 0.001);
}

/** Multiplicateur de puissance de soin : stat Soin + la caractéristique de FRAPPE du
 *  lanceur (et non l'intelligence précisément — sinon un soigneur sans feu soignerait
 *  à plat). Coefficient et plafond inchangés : on ne change que ce qu'elle lit. */
export function multSoin(stats: Stats, statFrappe: number): number {
  return 1 + Math.min(0.5, ((stats.soin ?? 0) + statFrappe) * 0.005);
}
