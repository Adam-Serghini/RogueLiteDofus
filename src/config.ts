// =============================================================================
//  config.ts — Paramètres joueur (persistés en localStorage).
// =============================================================================
import type { Element } from "./types";

/** Rangée préférée d'un héros (le placement exact s'empile dans la rangée). */
export type Rangee = "avant" | "arriere";

export interface Settings {
  toucheFinTour: string; // valeur de KeyboardEvent.key (ex. " ", "Enter", "a")
  autoFinTour: boolean; // passer le tour automatiquement si aucune action possible
  formation: Record<string, Rangee>; // classe -> rangée préférée (les héros s'y empilent : marche à tous les coups)
  elements: Record<string, Element>; // classe -> élément préféré (appliqué au début de run ; absent = Libre)
}

const STORAGE_KEY = "rld_settings_v0";
const ELEMENTS_VALIDES = new Set<Element>(["terre", "feu", "eau", "air"]);

// Préréglages par défaut : mêlée devant, distance/soutien derrière ; un élément par classe.
const DEFAUT: Settings = {
  toucheFinTour: " ",
  autoFinTour: true,
  formation: { iop: "avant", feca: "avant", sram: "avant", cra: "arriere", eniripsa: "arriere", sadida: "arriere", ecaflip: "arriere" },
  elements: { iop: "terre", feca: "terre", sram: "air", cra: "air", eniripsa: "feu", sadida: "eau", ecaflip: "eau" },
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

const elementsValides = (e: unknown): e is Record<string, Element> =>
  typeof e === "object" && e !== null && !Array.isArray(e) &&
  Object.values(e).every((v) => ELEMENTS_VALIDES.has(v as Element));

export function chargerConfig(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const merged = { ...DEFAUT, ...(JSON.parse(raw) as Partial<Settings>) };
      merged.formation = formationValide(merged.formation) ? migrerFormation(merged.formation) : { ...DEFAUT.formation };
      if (!elementsValides(merged.elements)) merged.elements = { ...DEFAUT.elements };
      return merged;
    }
  } catch {
    /* localStorage indisponible */
  }
  return { ...DEFAUT, formation: { ...DEFAUT.formation }, elements: { ...DEFAUT.elements } };
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
