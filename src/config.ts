// =============================================================================
//  config.ts — Paramètres joueur (persistés en localStorage).
// =============================================================================
export interface Settings {
  toucheFinTour: string; // valeur de KeyboardEvent.key (ex. " ", "Enter", "a")
  autoFinTour: boolean; // passer le tour automatiquement si aucune action possible
  formation: Record<string, number>; // classe -> case de grille 0..7 (0-3 avant, 4-7 arrière)
}

const STORAGE_KEY = "rld_settings_v0";

// formation par défaut : Iop & Cra devant (cases 0-1), Eniripsa & Sadida derrière (4-5)
const DEFAUT: Settings = {
  toucheFinTour: " ",
  autoFinTour: true,
  formation: { iop: 0, cra: 1, eniripsa: 4, sadida: 5 },
};

const formationValide = (f: unknown): f is Record<string, number> =>
  typeof f === "object" && f !== null && !Array.isArray(f) &&
  Object.values(f).every((v) => typeof v === "number");

export function chargerConfig(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const merged = { ...DEFAUT, ...(JSON.parse(raw) as Partial<Settings>) };
      if (!formationValide(merged.formation)) merged.formation = { ...DEFAUT.formation };
      return merged;
    }
  } catch {
    /* localStorage indisponible */
  }
  return { ...DEFAUT, formation: { ...DEFAUT.formation } };
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
