// =============================================================================
//  banc.ts — cœur du banc d'essai de l'éditeur. Module PUR (aucun DOM, aucun
//  localStorage) : il construit un héros et des mannequins, puis mesure les
//  sorts en lançant RÉELLEMENT le moteur. L'interface de l'éditeur ne fait
//  qu'appeler ces fonctions et afficher leurs résultats.
// =============================================================================
import { CLASSES, ITEMS, butinToile, localiserZone, offsetToile, ZONES } from "./data";
import { etatCombatInitial } from "./combat";
import { combattantDepuisPerso, instanceDuTier, meilleurItemToile, persoAuNiveau, type PersoState } from "./run";
import { STAT_PAR_ELEMENT } from "./progression";
import type { Combatant, Element, EquipSlot, ItemInstance, Rarete } from "./types";

/** PV des mannequins : assez grands pour qu'aucune mesure ne les tue. Un
 *  mannequin mort sortirait de `ciblesValides` et les répétitions suivantes
 *  tomberaient à zéro sans prévenir. */
export const PV_MANNEQUIN = 1_000_000;

export type EtatEquipement = "nu" | "mi" | "set";

/** Emplacements servis par un état d'équipement, dans l'ordre où on les remplit.
 *  « mi » = 2 pièces, comme la colonne MI du banc d'équilibrage (`npm run sim`). */
const SLOTS_PAR_ETAT: Record<EtatEquipement, EquipSlot[]> = {
  nu: [],
  mi: ["arme", "coiffe"],
  set: ["arme", "coiffe", "cape", "anneau"],
};

export interface OptionsHeros {
  classeId: string;
  niveau: number;
  toile: number;
  equipement: EtatEquipement;
  rarete: Rarete;
  /** Pièce imposée sur un emplacement, par-dessus l'état pré-réglé. */
  surcharges?: Partial<Record<EquipSlot, ItemInstance>>;
}

/** Zone (donc pool de butin) correspondant à un numéro de toile.
 *  On RETROUVE la zone par le même calcul que `butinToile` plutôt que d'indexer
 *  `ZONES[toile - 1]` : rien ne garantit que l'ordre du tableau plat coïncide
 *  avec la numérotation des toiles, qui passe par la tranche et son offset. */
function zoneDeToile(toile: number): string | null {
  for (const z of ZONES) {
    const loc = localiserZone(z.id);
    if (loc && offsetToile(loc.tranche.id) + loc.index + 1 === toile) return z.id;
  }
  return null;
}

export function construireHeros(o: OptionsHeros): Combatant {
  const perso: PersoState = persoAuNiveau(o.classeId, o.niveau, 0);
  const zone = zoneDeToile(o.toile);
  const pool = zone ? butinToile(zone)?.normales ?? [] : [];
  // stat visée pour le choix d'objet : le premier élément déclaré de la classe,
  // comme le fait déjà `src/sim.ts` (l'adaptatif alimente les deux éléments)
  const stat = STAT_PAR_ELEMENT[CLASSES[o.classeId].elements[0]];
  for (const slot of SLOTS_PAR_ETAT[o.equipement]) {
    const id = meilleurItemToile(pool, slot, stat);
    if (!id) continue;
    const inst = instanceDuTier(id, ITEMS[id].tiers?.[o.rarete] ? o.rarete : "commun");
    if (inst) perso.equipement[slot] = inst;
  }
  for (const [slot, inst] of Object.entries(o.surcharges ?? {}))
    if (inst) perso.equipement[slot as EquipSlot] = inst;

  const c = combattantDepuisPerso(perso);
  // `perso.pvActuels` a été fixé par `persoAuNiveau` AVANT que l'équipement ne
  // soit ajouté ci-dessus (PV de base, sans le bonus de vitalité du stuff) ;
  // `combattantDepuisPerso` fait `pvActuels: Math.min(state.pvActuels, pvMax)`
  // et retiendrait donc cette valeur périmée, plus basse que le vrai pvMax
  // équipé, pour n'importe quel stuff qui donne de la vitalité — un héros du
  // banc démarrerait sous son PV max. `etatCombatInitial()` n'est PAS
  // ré-appliqué ici : `combattantDepuisPerso` l'applique déjà en interne
  // (`run.ts`), puis écrase `bouclier` avec le bonus de départ du Bonnet
  // Spairance (`bouclierDebut`) — le refaire ici effacerait ce bouclier.
  c.pvActuels = c.pvMax;
  return c;
}

export interface SpecMannequin {
  position: number;
  resistances?: Partial<Record<Element, number>>;
}

export function construireMannequins(specs: SpecMannequin[]): Combatant[] {
  return specs.map((s, i) => ({
    ref: `mannequin_${i}`,
    nom: `Mannequin ${i + 1}`,
    pvBase: PV_MANNEQUIN,
    pvMax: PV_MANNEQUIN,
    pvActuels: PV_MANNEQUIN,
    // agilité nulle : un mannequin qui esquive transformerait la mesure en
    // mesure de sa chance, pas de la puissance du sort
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, chance: 0, soin: 0, prospection: 0 },
    paMax: 6,
    paActuels: 6,
    initiative: 0,
    resistances: { ...(s.resistances ?? {}) },
    sorts: [],
    camp: "ennemi" as const,
    position: s.position,
    niveau: 1,
    ...etatCombatInitial(),
  }));
}
