// =============================================================================
//  banc.ts — cœur du banc d'essai de l'éditeur. Module PUR (aucun DOM, aucun
//  localStorage) : il construit un héros et des mannequins, puis mesure les
//  sorts en lançant RÉELLEMENT le moteur. L'interface de l'éditeur ne fait
//  qu'appeler ces fonctions et afficher leurs résultats.
// =============================================================================
import { CLASSES, ITEMS, SORTS, butinToile, localiserZone, offsetToile, ZONES } from "./data";
import { ciblesValides, coutEffectif, etatCombatInitial, lancerSort, reinitialiserLancersTour, type CombatCtx } from "./combat";
import { combattantDepuisPerso, instanceDuTier, meilleurItemToile, persoAuNiveau, type PersoState } from "./run";
import { STAT_PAR_ELEMENT } from "./progression";
import type { Combatant, Element, EquipSlot, ItemInstance, Rarete, Spell } from "./types";

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

// =============================================================================
//  Mesure d'un lancer / d'un tour — les deux boucles du banc d'essai.
// =============================================================================

/** Répétitions par mesure : assez pour que la moyenne soit stable malgré
 *  l'esquive et le critique, assez peu pour que le tableau se recalcule sans
 *  latence pendant qu'on déplace le curseur de niveau. */
export const REPETITIONS = 500;

/** Générateur à graine (LCG) : la MÊME graine sert à tous les sorts, sinon on
 *  comparerait de la chance et non de la puissance. */
function rngGraine(graine: number): () => number {
  let g = graine >>> 0;
  return () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
const GRAINE = 123456789;

export interface Conditionnels {
  chausseTrappe?: number;
  telefrags?: number;
  portails?: number;
  bombes?: number;
  rage?: number;
}

export function appliquerConditionnels(heros: Combatant, cibles: Combatant[], c: Conditionnels): void {
  if (c.chausseTrappe) heros.chausseTrappe = c.chausseTrappe;
  if (c.portails) heros.portails = c.portails;
  if (c.rage) heros.rage = c.rage;
  // Téléfrags et bombes vivent sur la CIBLE, pas sur le lanceur
  for (const cible of cibles) {
    if (c.telefrags) cible.telefrags = c.telefrags;
    if (c.bombes) cible.bombes = c.bombes;
  }
}

/** Remet à zéro l'état transitoire de combat d'UN combattant (héros ou cible) —
 *  tout ce que `runCombat` décompte normalement à la fin d'un tour ou au début
 *  du suivant (`decrementerEffets`/`effetsDebutTour`), et que la boucle du banc
 *  ne rejoue jamais puisqu'elle ne fait tourner que `lancerSort`. Sans ce
 *  nettoyage, un champ posé par le sort mesuré (bouclier à durée, marque,
 *  redirection…) ne serait jamais consommé et s'accumulerait, RÉPÉTITION APRÈS
 *  RÉPÉTITION, sur le MÊME objet `Combatant` réutilisé par `mesurerLancer` —
 *  et l'onglet de l'éditeur réutilisant lui-même le même héros à chaque
 *  mouvement de curseur, la fuite ne serait bornée par rien.
 *
 *  Volontairement PAS touché ici (config permanente venant de la classe ou de
 *  l'équipement, jamais un compteur de combat) : `paGamble`, `elementLibre`,
 *  `renaissance` (la fraction, pas `renaissancesRestantes` — sans mort possible
 *  en mesure, ce compteur ne varie jamais ici), `riposteAvant`, `armure`
 *  (native), `nullifieParTour` (allocation, distincte de son compteur
 *  `coupsAnnulesRestants`, réinitialisé plus bas), `esquiveArriere`,
 *  `soinDegatsRecus`, `bonusParAllieLigne`, `elements`, `armeSort`,
 *  `dofusLache`, `mueElementaire`, `enrage`/`enrageCumul` (posés par `run.ts`
 *  pour l'Ascension, jamais par un sort). Également laissés intacts :
 *  `estInvocation`/`joueTour`/`provoque`/`estLance`/`estEgide`/`lanceurRef`/
 *  `toursRestantsInvocation` — vérifié dans `combat.ts` : ces champs ne sont
 *  posés QUE sur un pseudo-combattant tout neuf (Poupée/Lance/Égide) poussé
 *  dans le tableau `cs` local à chaque répétition, jamais mutés sur le héros
 *  ou la cible existants ; `cs` étant reconstruit à chaque répétition, cette
 *  invocation ne survit de toute façon pas à la répétition suivante. */
function reinitialiserEtatTransitoire(c: Combatant): void {
  c.effets = [];
  c.bouclier = 0;
  c.boucliersTemporaires = [];
  c.maxRollCharges = 0;
  c.paBonusNextTurn = 0;
  c.bonusOffensifProchain = 0;
  c.doubleEffetProchain = false;
  c.nullifieProchainCoup = false;
  c.resquilleActive = undefined;
  c.conjuration = undefined;
  c.redirection = undefined;
  c.redirectionPoseCeTour = false;
  c.coupsAnnulesRestants = 0;
}

/** Remet le combattant dans l'état d'un début de tour neuf. */
function reinitialiser(heros: Combatant, cibles: Combatant[], cond: Conditionnels): void {
  reinitialiserLancersTour(heros);
  reinitialiserEtatTransitoire(heros);
  heros.cooldowns = {};
  heros.lancersCombat = {};
  heros.paActuels = heros.paMax;
  heros.pvActuels = heros.pvMax;
  for (const c of cibles) {
    reinitialiserEtatTransitoire(c);
    c.pvActuels = c.pvMax;
    c.telefrags = 0;
    c.bombes = 0;
  }
  heros.pieges = [];
  heros.chausseTrappe = 0;
  heros.portails = 0;
  heros.rage = 0;
  appliquerConditionnels(heros, cibles, cond);
}

/** Contexte de combat minimal : on ne garde que les dégâts, via `onDegats` —
 *  le seul point du moteur traversé par CHAQUE coup, éclaboussures, zones et
 *  pièges compris, sans que le banc ait à connaître la forme du sort. */
function ctxMesure(rng: () => number, surDegats: (dmg: number) => void): CombatCtx {
  return {
    rng,
    log: () => {},
    playerDamageBonus: 1,
    onDegats: (_ref, dmg) => surDegats(dmg),
  };
}

export interface MesureLancer {
  lancable: boolean;
  moyenne: number;
  min: number;
  max: number;
  /** Une part des dégâts du sort échappe à la mesure : le poison retire les PV
   *  hors de `infligerDegats`, donc `onDegats` ne le voit jamais. */
  horsPoison: boolean;
}

const poseDuPoison = (s: Spell): boolean => Boolean(s.poison || s.poisonSiPortails);

export function mesurerLancer(
  heros: Combatant, sortId: string, cibles: Combatant[], cond: Conditionnels = {},
): MesureLancer {
  const sort = SORTS[sortId];
  const rng = rngGraine(GRAINE);
  let total = 0, min = Infinity, max = 0, lancesReussis = 0;
  for (let i = 0; i < REPETITIONS; i++) {
    reinitialiser(heros, cibles, cond);
    const cs = [heros, ...cibles];
    const valides = ciblesValides(heros, sort, cs);
    if (!valides.length) continue;
    let coup = 0;
    heros.paActuels -= coutEffectif(sort, heros); // la boucle de tour débite AVANT
    lancerSort(heros, sort, valides[0].ref, cs, ctxMesure(rng, (d) => { coup += d; }));
    total += coup; min = Math.min(min, coup); max = Math.max(max, coup);
    lancesReussis++;
  }
  if (!lancesReussis) return { lancable: false, moyenne: 0, min: 0, max: 0, horsPoison: poseDuPoison(sort) };
  return {
    lancable: true,
    moyenne: Math.round(total / lancesReussis),
    min, max,
    horsPoison: poseDuPoison(sort),
  };
}

export interface MesureTour { total: number; lancers: number }

/** Total produit par un sort dans UN tour : on laisse `lancersCeTour`, les
 *  recharges et les compteurs d'escalade courir d'un lancer à l'autre — c'est
 *  exactement ce qu'une mesure isolée ne peut pas voir (Pugilat, Colère de Iop). */
export function mesurerTour(
  heros: Combatant, sortId: string, cibles: Combatant[], cond: Conditionnels = {},
): MesureTour {
  const sort = SORTS[sortId];
  const rng = rngGraine(GRAINE);
  let cumul = 0, cumulLancers = 0;
  for (let i = 0; i < REPETITIONS; i++) {
    reinitialiser(heros, cibles, cond);
    const cs = [heros, ...cibles];
    let lancers = 0;
    for (;;) {
      const cout = coutEffectif(sort, heros);
      if (heros.paActuels < cout) break;
      const valides = ciblesValides(heros, sort, cs);
      if (!valides.length) break; // maxParTour atteint, ou plus de cible
      heros.paActuels -= cout;
      lancerSort(heros, sort, valides[0].ref, cs, ctxMesure(rng, (d) => { cumul += d; }));
      lancers++;
      if (lancers > 20) break; // garde-fou : aucun sort ne part 20 fois dans 6 PA
    }
    cumulLancers += lancers;
  }
  return {
    total: Math.round(cumul / REPETITIONS),
    lancers: Math.round(cumulLancers / REPETITIONS),
  };
}
