// =============================================================================
//  banc.ts — cœur du banc d'essai de l'éditeur. Module PUR (aucun DOM, aucun
//  localStorage) : il construit un héros et des mannequins, puis mesure les
//  sorts en lançant RÉELLEMENT le moteur. L'interface de l'éditeur ne fait
//  qu'appeler ces fonctions et afficher leurs résultats.
// =============================================================================
import { CLASSES, ITEMS, SORTS, butinToile, localiserZone, offsetToile, ZONES } from "./data";
import {
  BOMBES_MAX, CHAUSSE_TRAPPE_MAX, PORTAILS_MAX, RAGE_MAX, TELEFRAGS_MAX,
  ciblesValides, coutEffectif, estAvant, etatCombatInitial, invoquerLance,
  lancerSort, reinitialiserLancersTour, type CombatCtx,
} from "./combat";
import { mulberry32 } from "./rng";
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

/** Héros du banc, ET ce qu'il porte RÉELLEMENT.
 *
 *  `slotsEquipes` n'est pas une redite de `OptionsHeros.equipement` : une toile
 *  sans aucun objet (les douze toiles de la Tranche 2 sont dans ce cas) rend un
 *  héros NU alors que le réglage annonce « Set complet ». Sans ce compte remonté
 *  depuis le moteur, l'écran afficherait trois colonnes NU/MI/SET identiques
 *  sans que rien ne le dise. */
export interface HerosConstruit {
  heros: Combatant;
  /** Emplacements effectivement pourvus (état pré-réglé + surcharges). */
  slotsEquipes: EquipSlot[];
}

/** Variante détaillée de `construireHeros` : rend aussi ce qui a pu être équipé. */
export function construireHerosDetaille(o: OptionsHeros): HerosConstruit {
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
  // on RELIT `perso.equipement` plutôt que de compter les tours de boucle : c'est
  // le seul état qui dit ce qui a vraiment été posé, repli de rareté et pool de
  // toile vide compris.
  const slotsEquipes = Object.keys(perso.equipement).filter(
    (s) => perso.equipement[s as EquipSlot],
  ) as EquipSlot[];
  return { heros: c, slotsEquipes };
}

export function construireHeros(o: OptionsHeros): Combatant {
  return construireHerosDetaille(o).heros;
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

/** La MÊME graine sert à tous les sorts, sinon on comparerait de la chance et
 *  non de la puissance. Le générateur vit dans `./rng`, partagé avec `npm run
 *  sim` : deux générateurs, ce serait deux qualités de tirage pour deux chiffres
 *  censés se comparer. */
const GRAINE = 123456789;

export interface Conditionnels {
  chausseTrappe?: number;
  telefrags?: number;
  portails?: number;
  bombes?: number;
  rage?: number;
  /** PA disponibles AVANT paiement (Zénith, Flèche Punitive : `bonusParPADispo`).
   *  Absent ou 0 = barre pleine, c'est-à-dire le MAXIMUM de ces sorts — d'où le
   *  réglage : sans lui le banc les lit toujours à leur plus haut, en silence. */
  paDispo?: number;
  /** Lance du Forgelance plantée dans cette rangée ennemie. Sans elle, Muspel /
   *  Hydra / Jormun sont mesurés sans leur signature (`zoneLance`) : Jormun rend
   *  alors exactement le chiffre d'Hydra. */
  lance?: "avant" | "arriere";
}

/** Plafonds du MOTEUR pour chaque compteur conditionnel. Exposés pour que
 *  l'interface borne ses champs de saisie sur la vérité du jeu au lieu de
 *  recopier des nombres : `multPortails` et `bonusParTelefrag` ne plafonnent
 *  qu'à la POSE, pas à la lecture, donc un compteur saisi à 50 produirait un
 *  chiffre inatteignable en partie — exactement le genre de mensonge qu'un
 *  outil de décision d'équilibrage ne doit pas afficher. */
export const MAX_COMPTEURS = {
  chausseTrappe: CHAUSSE_TRAPPE_MAX,
  telefrags: TELEFRAGS_MAX,
  portails: PORTAILS_MAX,
  bombes: BOMBES_MAX,
  rage: RAGE_MAX,
} as const;

const borne = (v: number | undefined, max: number): number => Math.max(0, Math.min(max, v ?? 0));

export function appliquerConditionnels(heros: Combatant, cibles: Combatant[], c: Conditionnels): void {
  // chaque compteur est BORNÉ au plafond du moteur : au-delà, on mesurerait un
  // état que le jeu ne peut pas produire.
  heros.chausseTrappe = borne(c.chausseTrappe, MAX_COMPTEURS.chausseTrappe);
  heros.portails = borne(c.portails, MAX_COMPTEURS.portails);
  heros.rage = borne(c.rage, MAX_COMPTEURS.rage);
  // `paDispo` est écrêté à `paMax` comme les cinq compteurs voisins le sont à
  // leur plafond : la barre de PA d'un tour ne peut pas dépasser le maximum du
  // héros, et `bonusParPADispo` (Zénith, Flèche Punitive) n'a AUCUN plafond de
  // lecture — une saisie à 999 rendait Zénith ×48, un chiffre inatteignable.
  if (c.paDispo) heros.paActuels = Math.min(c.paDispo, heros.paMax);
  // Téléfrags et bombes vivent sur la CIBLE, pas sur le lanceur
  for (const cible of cibles) {
    cible.telefrags = borne(c.telefrags, MAX_COMPTEURS.telefrags);
    cible.bombes = borne(c.bombes, MAX_COMPTEURS.bombes);
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
 *  `dofusLache`, `mueElementaire`. Également laissés intacts :
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
  heros.cooldownsPosesCeTour = undefined; // sinon une marque survit d'une mesure à l'autre
  heros.lancersCombat = {};
  // Une mesure représente un tour ORDINAIRE, pas l'ouverture du combat : à 0 (ou 1),
  // tout sort marqué `pasPremierTour` sortirait de `ciblesValides` et se mesurerait
  // à zéro sans un mot, ce qui se lirait comme un sort cassé plutôt qu'un sort tardif.
  heros.toursJoues = 2;
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

/** Tableau de combattants d'UNE répétition : le héros, les mannequins, et — si le
 *  réglage le demande — une Lance du Forgelance plantée dans la rangée voulue.
 *  La Lance est invoquée par le VRAI `invoquerLance`, jamais fabriquée à la main :
 *  c'est lui qui choisit sa case et refuse une rangée pleine. */
function preparerCombat(heros: Combatant, cibles: Combatant[], cond: Conditionnels, ctx: CombatCtx): Combatant[] {
  const cs = [heros, ...cibles];
  if (cond.lance) {
    const avant = cond.lance === "avant";
    const ancre = cibles.find((c) => estAvant(c) === avant);
    if (ancre) invoquerLance(heros, ancre, cs, ctx);
  }
  return cs;
}

/** Une Lance est-elle plantée pour ce héros dans ce combat ? */
const lancePlantee = (heros: Combatant, cs: Combatant[]): boolean =>
  cs.some((c) => c.estLance && c.lanceurRef === heros.ref && c.pvActuels > 0);

/** Cible retenue parmi celles que `ciblesValides` accepte : la PREMIÈRE, sauf
 *  pour un sort `zoneLance` (Muspel / Hydra / Jormun), où c'est la Lance —
 *  `ciblesValides` la range en fin de liste, or c'est le seul point de visée qui
 *  déclenche la signature de ces sorts (Jormun ne frappe TOUT le monde que s'il
 *  est lancé sur une Lance en rangée arrière). Viser un mannequin plutôt que la
 *  Lance qu'on vient délibérément de planter mesurerait le sort amputé de ce qui
 *  fait son intérêt. */
function choisirCible(sort: Spell, valides: Combatant[]): Combatant {
  if (sort.zoneLance) return valides.find((c) => c.estLance) ?? valides[0];
  return valides[0];
}

/** Contexte de combat minimal : on ne garde que les dégâts, via `onDegats` —
 *  le seul point du moteur traversé par CHAQUE coup, éclaboussures, zones et
 *  pièges compris, sans que le banc ait à connaître la forme du sort.
 *
 *  Seuls les dégâts DU HÉROS sont comptés (`attaquantRef`) : sans ce filtre,
 *  une riposte ou un sort d'un autre combattant entrerait dans la « production
 *  du sort mesuré ». Aucun mannequin ne riposte aujourd'hui — c'est une ligne de
 *  durcissement, pas une correction d'un chiffre faux. */
function ctxMesure(rng: () => number, refHeros: string, surDegats: (dmg: number) => void): CombatCtx {
  return {
    rng,
    log: () => {},
    playerDamageBonus: 1,
    onDegats: (attaquantRef, dmg) => { if (attaquantRef === refHeros) surDegats(dmg); },
  };
}

/** Pourquoi le chiffre affiché ne dit pas tout ce que le sort produit.
 *  Généralisé au-delà du poison : trois familles de sorts rendent 0 (ou leur
 *  plancher) au lancer sans que rien ne le signale, et un game designer qui lit
 *  « les pièges du Sram font 0 » les gonflerait. */
export type RaisonIncomplete =
  /** poison : le tick retire les PV hors de `infligerDegats`, `onDegats` ne le voit jamais */
  | "poison"
  /** piège (Sram) : jet et riders sont lus au DÉCLENCHEMENT, jamais à la pose */
  | "piege"
  /** bombe collante (Roublard) : la pose ne frappe pas, les dégâts partent au Kaboom */
  | "bombe"
  /** Muspel / Hydra / Jormun mesurés SANS Lance plantée : leur signature `zoneLance` est muette */
  | "lance_absente";

/** Toutes les raisons pour lesquelles la mesure de ce sort est incomplète, dans
 *  cet état de réglage. Un tableau et non une valeur unique : rien n'interdit à
 *  un sort de cumuler deux causes. */
function raisonsIncompletes(s: Spell, aLance: boolean): RaisonIncomplete[] {
  const r: RaisonIncomplete[] = [];
  if (s.poison || s.poisonSiPortails) r.push("poison");
  if (s.posePiege) r.push("piege");
  if (s.poseBombe) r.push("bombe");
  if (s.zoneLance && !aLance) r.push("lance_absente");
  return r;
}

export interface MesureLancer {
  lancable: boolean;
  moyenne: number;
  min: number;
  max: number;
  /** Coût RÉELLEMENT débité (`coutEffectif`), remises comprises — c'est lui qui
   *  doit servir de diviseur au « par PA », jamais `sort.coutPA` : une seconde
   *  source de vérité finirait par diverger, et diviserait par zéro le jour où
   *  un sort de dégâts à 0 PA existera (le Iop en a déjà un, hors dégâts). */
  cout: number;
  /** Vide quand le chiffre est complet ; voir `RaisonIncomplete`. */
  raisons: RaisonIncomplete[];
}

export function mesurerLancer(
  heros: Combatant, sortId: string, cibles: Combatant[], cond: Conditionnels = {},
): MesureLancer {
  const sort = SORTS[sortId];
  const rng = mulberry32(GRAINE);
  let total = 0, min = Infinity, max = 0, lancesReussis = 0;
  let aLance = false;
  let cout = 0;
  for (let i = 0; i < REPETITIONS; i++) {
    reinitialiser(heros, cibles, cond);
    let coup = 0;
    const ctx = ctxMesure(rng, heros.ref, (d) => { coup += d; });
    const cs = preparerCombat(heros, cibles, cond, ctx);
    aLance = lancePlantee(heros, cs);
    const valides = ciblesValides(heros, sort, cs);
    if (!valides.length) continue;
    cout = coutEffectif(sort, heros);
    heros.paActuels -= cout; // la boucle de tour débite AVANT
    lancerSort(heros, sort, choisirCible(sort, valides).ref, cs, ctx);
    total += coup; min = Math.min(min, coup); max = Math.max(max, coup);
    lancesReussis++;
  }
  const raisons = raisonsIncompletes(sort, aLance);
  if (!lancesReussis) return { lancable: false, moyenne: 0, min: 0, max: 0, cout: coutEffectif(sort, heros), raisons };
  return { lancable: true, moyenne: Math.round(total / lancesReussis), min, max, cout, raisons };
}

export interface MesureTour { total: number; lancers: number }

/** Total produit par un sort dans UN tour : on laisse `lancersCeTour`, les
 *  recharges et les compteurs d'escalade courir d'un lancer à l'autre — c'est
 *  exactement ce qu'une mesure isolée ne peut pas voir (Pugilat, Colère de Iop). */
export function mesurerTour(
  heros: Combatant, sortId: string, cibles: Combatant[], cond: Conditionnels = {},
): MesureTour {
  const sort = SORTS[sortId];
  const rng = mulberry32(GRAINE);
  let cumul = 0, cumulLancers = 0;
  for (let i = 0; i < REPETITIONS; i++) {
    reinitialiser(heros, cibles, cond);
    const ctx = ctxMesure(rng, heros.ref, (d) => { cumul += d; });
    const cs = preparerCombat(heros, cibles, cond, ctx);
    let lancers = 0;
    for (;;) {
      const cout = coutEffectif(sort, heros);
      if (heros.paActuels < cout) break;
      const valides = ciblesValides(heros, sort, cs);
      if (!valides.length) break; // maxParTour atteint, ou plus de cible
      heros.paActuels -= cout;
      lancerSort(heros, sort, choisirCible(sort, valides).ref, cs, ctx);
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
