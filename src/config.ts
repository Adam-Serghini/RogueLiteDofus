// =============================================================================
//  config.ts — Paramètres joueur (persistés en localStorage).
// =============================================================================

/** Rangée préférée d'un héros (le placement exact s'empile dans la rangée). */
export type Rangee = "avant" | "arriere";

export interface Settings {
  toucheFinTour: string; // valeur de KeyboardEvent.key (ex. " ", "Enter", "a")
  autoFinTour: boolean; // passer le tour automatiquement si aucune action possible
  formation: Record<string, Rangee>; // classe -> rangée préférée (les héros s'y empilent : marche à tous les coups)
  ordre: Record<string, number>; // classe -> rang de jeu (1 = joue en premier)
}

const STORAGE_KEY = "rld_settings_v0";

/** Rang de jeu par défaut. Les quatre premiers rangs reproduisent EXACTEMENT
 *  l'ordre de `EQUIPE_DEPART` (`run.ts`) : la fonctionnalité est ainsi inerte
 *  tant que le joueur ne réorganise rien, et `fabriquerEquipe()` rend la même
 *  équipe qu'avant — ce dont dépendent 35 destructurations positionnelles
 *  (`const [iop] = fabriquerEquipe()`) réparties dans 15 fichiers de test.
 *  Ne PAS « améliorer » ce classement sans mesurer cette cascade.
 *  Rangs tous distincts. */
export const ORDRE_DEFAUT: Record<string, number> = {
  iop: 1, cra: 2, eniripsa: 3, ecaflip: 4, xelor: 5, sram: 6,
  roublard: 7, eliotrope: 8, forgelance: 9, ouginak: 10, sadida: 11, feca: 12,
};

/** Rang de jeu d'une classe ; classe inconnue (vieille sauvegarde) → en queue. */
export const rangClasse = (ordre: Record<string, number>, classeId: string): number =>
  ordre[classeId] ?? 99;

// Préréglages par défaut : mêlée devant, distance/soutien derrière.
const DEFAUT: Settings = {
  toucheFinTour: " ",
  autoFinTour: true,
  formation: { iop: "avant", feca: "avant", sram: "avant", ouginak: "avant", forgelance: "avant", cra: "arriere", eniripsa: "arriere", sadida: "arriere", ecaflip: "arriere", roublard: "arriere", xelor: "arriere", eliotrope: "arriere" },
  ordre: { ...ORDRE_DEFAUT },
};

/** Valide la formation en MIGRANT l'ancien format (case 0..7) vers avant/arrière. */
const formationValide = (f: unknown): f is Record<string, Rangee | number> =>
  typeof f === "object" && f !== null && !Array.isArray(f) &&
  Object.values(f).every((v) => v === "avant" || v === "arriere" || typeof v === "number");

const migrerFormation = (f: Record<string, Rangee | number>): Record<string, Rangee> => {
  const out: Record<string, Rangee> = {};
  for (const [cid, v] of Object.entries(f)) out[cid] = typeof v === "number" ? (v < 4 ? "avant" : "arriere") : v;
  return out;
};

export function chargerConfig(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const merged = { ...DEFAUT, ...(JSON.parse(raw) as Partial<Settings>) };
      // Défauts d'abord, puis les choix stockés par-dessus : les classes absentes
      // d'une vieille sauvegarde retombent sur leur rangée par défaut.
      merged.formation = { ...DEFAUT.formation, ...(formationValide(merged.formation) ? migrerFormation(merged.formation) : {}) };
      // même principe : les défauts d'abord, les rangs stockés par-dessus, et on
      // ignore toute valeur non numérique (sauvegarde corrompue ou format ancien)
      const ordreStocke = merged.ordre && typeof merged.ordre === "object" && !Array.isArray(merged.ordre) ? merged.ordre : {};
      merged.ordre = { ...ORDRE_DEFAUT };
      for (const [cid, v] of Object.entries(ordreStocke)) {
        if (typeof v === "number" && Number.isFinite(v)) merged.ordre[cid] = v;
      }
      return merged;
    }
  } catch {
    /* localStorage indisponible */
  }
  return { ...DEFAUT, formation: { ...DEFAUT.formation }, ordre: { ...ORDRE_DEFAUT } };
}

export function sauverConfig(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Libellé lisible d'une touche (KeyboardEvent.key). */
export function libelleTouche(k: string): string {
  if (k === " ") return "Espace";
  if (k === "Enter") return "Entrée";
  if (k === "Escape") return "Échap";
  if (k === "Tab") return "Tab";
  if (k.startsWith("Arrow")) return { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }[k] ?? k;
  return k.length === 1 ? k.toUpperCase() : k;
}
