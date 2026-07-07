// =============================================================================
//  progression.ts — Niveaux & points de caractéristique (pur, testable).
//  Aucune dépendance au DOM ni au localStorage.
// =============================================================================
import type { Classe, Progression, Stats } from "./types";

// --- Constantes tunables -----------------------------------------------------
export const PV_PAR_VITA = 1; // PV max gagnés par point de Vitalité
export const POINTS_PAR_NIVEAU = 3; // points de caractéristique par niveau
const SEUIL_COUT_2 = 200; // au-delà, un point coûte 2
const SEUIL_COUT_3 = 300; // au-delà, un point coûte 3

// Stats investables au level-up (soin & prospection exclues : valeurs de classe).
export const STAT_KEYS: (keyof Stats)[] = [
  "force", "intelligence", "agilite", "chance", "vitalite",
];

export function progressionInitiale(): Progression {
  return {
    niveau: 1,
    xp: 0,
    pointsDispo: 0,
    pointsInvestis: {
      force: 0, intelligence: 0, agilite: 0, vitalite: 0,
      chance: 0,
    },
  };
}

/** XP requise pour passer du niveau donné au suivant. */
export function xpRequis(niveau: number): number {
  return 50 + (niveau - 1) * 25;
}

/** Coût (en points dispo) d'un point supplémentaire dans une stat déjà investie. */
export function coutPoint(dejaInvesti: number): number {
  if (dejaInvesti < SEUIL_COUT_2) return 1;
  if (dejaInvesti < SEUIL_COUT_3) return 2;
  return 3;
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
    p.pointsDispo += POINTS_PAR_NIVEAU;
    niveauxGagnes += 1;
  }
  if (p.niveau >= niveauMax) p.xp = 0; // cap atteint : surplus perdu
  return niveauxGagnes;
}

/** Dépense un point dans une stat si abordable. Renvoie le succès. */
export function investir(p: Progression, stat: keyof Stats): boolean {
  const cout = coutPoint(p.pointsInvestis[stat] ?? 0);
  if (p.pointsDispo < cout) return false;
  p.pointsDispo -= cout;
  p.pointsInvestis[stat] = (p.pointsInvestis[stat] ?? 0) + 1;
  return true;
}

/** Dépense jusqu'à `n` points dans une stat (n = Infinity pour « Max »). Renvoie le nombre réellement dépensé. */
export function investirN(p: Progression, stat: keyof Stats, n: number): number {
  let count = 0;
  while (count < n && investir(p, stat)) count++;
  return count;
}

/** Rembourse tous les points investis dans le pool disponible (Otomai / mort). */
export function restat(p: Progression): void {
  for (const k of STAT_KEYS) {
    p.pointsDispo += p.pointsInvestis[k] ?? 0;
    p.pointsInvestis[k] = 0;
  }
}

/** Stats finales = base de classe + points investis. */
export function statsFinales(classe: Classe, p: Progression): Stats {
  const base = classe.stats;
  const inv = p.pointsInvestis;
  const f = (k: keyof Stats): number => (base[k] ?? 0) + (inv[k] ?? 0);
  return {
    force: f("force"),
    intelligence: f("intelligence"),
    agilite: f("agilite"),
    vitalite: f("vitalite"),
    chance: f("chance"),
    soin: base.soin ?? 0, // non investable : valeur de classe
    prospection: base.prospection ?? 0, // non investable : valeur de classe
  };
}

/** PV max = pvBase + vitalité finale × PV_PAR_VITA. */
export function pvMaxFor(classe: Classe, p: Progression): number {
  return classe.pvBase + statsFinales(classe, p).vitalite * PV_PAR_VITA;
}

/** Multiplicateur de puissance offensive (Intelligence, plafonné à +50 %). */
export function multOffensif(stats: Stats): number {
  return 1 + Math.min(0.5, stats.intelligence * 0.005);
}

/** Multiplicateur de puissance de soin (stat Soin + Intelligence, plafonné à +50 %). */
export function multSoin(stats: Stats): number {
  return 1 + Math.min(0.5, ((stats.soin ?? 0) + stats.intelligence) * 0.005);
}

/** Chance de remboursement des PA (Flèche magique) : 5 % de base + Chance, plafonnée à 50 %. */
export function pctRembPA(stats: Stats): number {
  return Math.min(0.5, 0.05 + (stats.chance ?? 0) * 0.005);
}
