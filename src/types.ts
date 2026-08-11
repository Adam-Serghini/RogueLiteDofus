// =============================================================================
//  types.ts — Modèle de données (issu du spec V0)
// =============================================================================

export type Element = "terre" | "feu" | "eau" | "air";

export interface Stats {
  force: number; // dégâts Terre + vitalité passive (1 par VITA_PAR_FORCE)
  intelligence: number; // dégâts Feu + dégâts finaux (multOffensif)
  agilite: number; // dégâts Air + taux ET dégâts de coup critique
  vitalite: number; // PV max (pvBase + vitalité × PV_PAR_VITA)
  // --- stats étendues (optionnelles, défaut 0) ---
  chance?: number; // dégâts Eau + prospection passive (1 par PROSP_PAR_CHANCE)
  soin?: number; // puissance de soin (× les soins prodigués)
  prospection?: number; // booste le taux de drop d'équipement (cumulé sur l'équipe)
  crit?: number; // % plat de coup critique (équipement) — s'ajoute au crit dérivé de l'Agilité
}

// --- Équipement --------------------------------------------------------------
export type EquipSlot = "arme" | "coiffe" | "cape" | "anneau";

/** Raretés d'objet (halo vert / bleu / violet / doré). */
export type Rarete = "commun" | "rare" | "epique" | "legendaire";

export interface AttaqueArme {
  coutPA: number;
  baseMin: number;
  baseMax: number;
  scaling: number;
  cible?: "ennemi_ligne" | "ennemi_tous"; // ennemi_tous = l'arme atteint la ligne arrière (Arc)
  vampirisme?: number; // fraction des dégâts rendue en PV au porteur (Ergot Mina)
}

/** Un palier de rareté d'un objet « à toiles » : stats FIXES (pas de roll). */
export interface TierItem {
  stats: Partial<Stats>;
  adaptatif?: number; // stat ADAPTATIVE : s'ajoute à la carac de la voie du porteur
  resistances?: Partial<Record<Element, number>>;
  pa?: number; // PA max bonus (ex. futur Gelano)
  attaque?: AttaqueArme; // armes : peut progresser avec la rareté
}

export interface Item {
  id: string;
  nom: string;
  slot: EquipSlot;
  panoplie?: string; // nom affichable de la panoplie — 4 pièces équipées = +1 PA (élite/boss : jamais de panoplie)
  tiers?: Partial<Record<Rarete, TierItem>>; // objets à rareté (stats fixes par palier)
  source?: "boss" | "elite" | "elite_boss"; // drop exclusif : donjon / combat dur / les deux
  paGamble?: { pPlus: number; plus: number; moins: number }; // Chance d'Ecaflip : pari de PA à chaque tour
  ligneAvant?: boolean; // équipable UNIQUEMENT sur un perso de la ligne avant (Cape Edepee)
  riposteAvant?: number; // Sabre Shodanwa : chance de riposte quand frappé, si ligne avant
  esquiveArriere?: number; // Baguette Rikiki : esquive bonus, si ligne arrière
  soinDegatsRecus?: number; // Goyave : fraction des dégâts subis récupérée en PV
  changeLigne?: number; // Dagues Eurfolles : action « Changer de ligne » à N PA en combat
  perceResistances?: number; // Dagues Aj'Deh'La : l'attaque d'arme ignore cette fraction des résistances
  frappeDerriere?: boolean; // Masse Aj Taye : l'attaque touche aussi l'ennemi derrière la cible
  prospParPvManquant?: number; // Caskoffre : +prospection par PV manquant du porteur au moment du butin
  multKamas?: number; // Ann'or : multiplie les kamas gagnés en combat
  bouclierDebut?: number; // Bonnet Spairance : bouclier de départ = fraction des PV max
  poisonArme?: { degats: number; duree: number }; // Scalpel de Bworknroll : l'attaque empoisonne
  soinAllieBlesse?: number; // Masse du Corailleur : l'attaque soigne l'allié le plus blessé (fraction des dégâts)
  retraitPA?: number; // Arc des Rivages : 30 % de chance de retirer N PA (réutilise Spell.retraitPA)
  elementLibre?: boolean; // Kwakwaffe : frappe dans N'IMPORTE quel élément (plus limité au top 2)
  renaissance?: number; // Kwakwanneau : renaît une fois par combat à cette fraction des PV max
  pvBonus?: number; // PV max plats (fixe)
  resistances?: Partial<Record<Element, number>>;
  img?: string;
}

/** Exemplaire d'item (inventaire/équipement) : stats/résists/PA du palier, FIGÉS ici au drop
 *  (la save reste autonome). */
export interface ItemInstance {
  id: string; // id de l'Item de base
  stats: Partial<Stats>; // valeurs du palier (rareté)
  rarete?: Rarete;
  adaptatif?: number; // stat adaptative du palier (carac de la voie du porteur)
  resistances?: Partial<Record<Element, number>>; // résistances du palier
  pa?: number; // PA bonus du palier
}

export type SpellTarget =
  | "ennemi_ligne" // un ennemi en position 1 ou 2 uniquement
  | "ennemi_tous" // n'importe quel ennemi (outrepasse la ligne)
  | "soi"
  | "allie"
  | "allie_tous" // tous les alliés vivants
  | "mixte"; // n'importe quelle unité vivante (effet selon le camp ciblé)

export type SpellType = "degats" | "soin" | "buff" | "debuff" | "invocation";

/** Stat ciblée par un effet temporaire. */
export type EffetStat =
  | "vitalite" // +% PV max
  | "maxRoll" // charges : les prochains sorts offensifs tapent au max
  | "degatsInfliges" // modifie les dégâts infligés par la cible (= « dégâts finaux »)
  | "poison" // dégâts par tour (DoT)
  | "hot" // soin par tour (heal over time)
  | "initiative" // modifie l'initiative (négatif = ralentit l'ordre des tours)
  | "echecCritique" // +% de chance que le sort du porteur échoue
  | "esquive" // +% d'esquive
  | "reductionDegats" // −% de dégâts subis
  | "armure" // −X plat de dégâts subis
  | "resAll" // ± résistance à tous les éléments
  | "contre" // posture de contre (Wobots du Terrier du Wa Wabbit, via effetLanceur) : valeur = probabilité de riposte quand frappé
  | "friction" // bloque soins ET boucliers du porteur (flag : valeur ignorée)
  | "proie" // marque de l'Ouginak : valeur = vol de vie d'ÉQUIPE contre le porteur (unique)
  | "tetanise" // Tétanisation : le porteur ne peut pas viser la ligne arrière (flag)
  | "ignoreLigne" // le porteur ignore la règle de ligne : ses sorts ennemi_ligne visent aussi l'arrière (flag)
  | "paParTour" // crédite ce nombre de PA à chaque début de tour du porteur, tant que l'effet dure
  | "aiguille" // Xélor : chaque Téléfrag reçu par le porteur le reblesse (écho d'Aiguille)
  | "crit" // Tir Puissant : + crit plat temporaire (propagé dans statsEffectives → se.crit)
  | "degatsCritSubis" // Griffe joueuse — majore les dégâts des coups critiques SUBIS par le porteur
  | "bonusPieges" // Concentration de Chakra (Sram) : majore les dégâts d'un piège au DÉCLENCHEMENT, lu sur le POSEUR
  // buffs/debuffs temporaires de caractéristique (sommés dans statsEffectives) :
  | "force"
  | "intelligence"
  | "agilite"
  | "chance";

export interface EffetSpec {
  stat: EffetStat;
  valeur: number;
  duree: number;
  transmet?: boolean; // poison : se transmet au combattant derrière si la cible meurt
}

export interface Spell {
  id: string;
  nom: string;
  type: SpellType;
  coutPA: number;
  cible: SpellTarget;
  baseMin: number;
  baseMax: number;
  scaling: number; // multiplie la stat de l'élément de frappe
  desc?: string;
  img?: string; // icône explicite (attaque d'arme) ; sinon dérivée de l'id via sortIcon
  // effets spéciaux (optionnels, un sort peut en cumuler) :
  rebond?: { sauts: number; bonusParSaut: number }; // touche les ennemis suivants
  ignoreResistances?: boolean; // Flèche intrusive
  ignoreBouclier?: boolean; // Flèche intrusive : les dégâts sautent le bouclier
  retraitPA?: number; // Caprice royal : −PA immédiat à la cible (visible avant son tour)
  effet?: EffetSpec; // buff/debuff appliqué à la cible
  effetLanceur?: EffetSpec; // buff appliqué au lanceur après le sort (Mâchoire du Coffre, Colère royale)
  zoneLigne?: boolean; // dégâts sur TOUTE la rangée de la cible cliquée (Zénith du Iop)
  cooldownTours?: number; // cooldown par sort côté lanceur (indispo Nt, toutes cibles)
  // --- mécaniques de soutien (Eniripsa) ---
  poison?: { degats: number; duree: number; transmet?: boolean }; // applique un DoT
  soinComplet?: boolean; // soigne entièrement la cible
  soinEquipeRatio?: number; // soigne l'équipe d'une fraction des dégâts infligés
  bouclierPct?: number; // bouclier = pct des PV max de la cible
  hotPct?: number; // soin/tour = pct de la vitalité de la cible
  hotDuree?: number; // durée du HoT
  dissipe?: boolean; // retire les effets négatifs de la cible
  paGain?: number; // octroie des PA à la cible (au prochain tour)
  cooldown?: number; // tours avant de pouvoir relancer sur la même cible
  bonusProchainSortPct?: number; // Vigueur des bois : +% au prochain sort offensif
  invocation?: { nom: string; pv: number; provoque: boolean }; // Poupée de garde
  // --- mécaniques des nouvelles classes (Sram / Feca / Ecaflip) ---
  bouclierRatioDegats?: number; // Attaque céleste : bouclier = pct des dégâts infligés
  vampirismeRatio?: number; // Pattounes : soigne le lanceur d'une fraction des dégâts
  dissipePositifs?: boolean; // désenvoûtement : retire boucliers + effets bénéfiques
  mixte?: { surAllie: SurAllie }; // sort lançable sur ennemi (dégâts) ou allié (soutien)
  // --- signatures de boss (invocations côté monstres) ---
  invoqueMonstre?: { pool: string[]; max: number }; // invoque un monstre (id tiré dans pool) ; max = invocations vivantes simultanées
  ressuscite?: { pvPct: number }; // réinvoque un allié monstre vaincu (Boostache) à pvPct de ses PV max
  procAleatoire?: ProcAleatoire[]; // 1 effet tiré au hasard sur la cible (sorts de monstres)
  changeLigne?: boolean; // « Changer de ligne » (Dagues Eurfolles) : déplace le lanceur dans la rangée opposée
  perceResistances?: number; // fraction des résistances ignorée par ce sort (attaque d'arme)
  toucheDerriere?: boolean; // l'attaque touche aussi l'ennemi juste derrière la cible (Masse Aj Taye)
  soinAllieBlesseRatio?: number; // soigne l'allié le plus blessé d'une fraction des dégâts infligés (Masse du Corailleur)
  // --- mécaniques de l'Ouginak ---
  marqueProie?: number; // Proie : marque UNIQUE sur un ennemi — l'équipe vole cette fraction des dégâts qu'elle lui inflige
  rage?: boolean; // le sort confère 1 état de Rage au lanceur (cap RAGE_MAX)
  consommeRage?: boolean; // Apaisement : consomme TOUTE la Rage, soigne baseMin-baseMax PAR charge
  bonusParEnnemiLigneCible?: number; // Dépouille : +% de dégâts par AUTRE ennemi sur la ligne de la cible
  maxParTour?: number; // nombre maximum de lancers de ce sort par tour (toutes cibles confondues)
  pasPremierTour?: boolean; // indisponible pendant le PREMIER tour de son lanceur (Précipitation)
  maxParCibleParTour?: number; // nombre maximum de lancers de ce sort SUR UNE MÊME cible par tour
  // --- socle Roublard / Xélor / rework Cra ---
  deplaceCible?: "toggle" | "arriere"; // déplace la CIBLE dans la rangée opposée ("toggle") ou vers l'arrière seulement ("arriere") ; échec silencieux si la rangée est pleine
  nullifieProchain?: boolean; // buff : le porteur annule son prochain coup direct reçu (pas les poisons)
  paParTourLigne?: { valeur: number; duree: number }; // crédite ce nombre de PA à chaque début de tour, à TOUTE la rangée de l'allié ciblé, pendant la durée
  retraitPAChance?: number; // probabilité du retrait de PA (retraitPA) ; défaut 0.3 si absent
  bonusParPADispo?: number; // Flèche Punitive : +X % de dégâts par PA dispo AVANT le paiement du coût
  bonusParTelefrag?: number; // Rayon Obscur : +X % de dégâts par Téléfrag posé sur la cible
  /** Pugilat (Iop) : fraction des dégâts infligée aux AUTRES ennemis de la rangée de
   *  la cible. Distinct de `zoneLigne`, qui frappe toute la rangée à pleine puissance. */
  ratioLigne?: number;
  /** Pugilat (Iop) : +N par RELANCE du sort dans le tour (additif). Alimente lui-même
   *  `lancersCeTour` (même garde que `maxParTour`/`maxParCibleParTour`, jamais en
   *  double si le sort porte aussi l'une de ces limites) : porter ce champ SUFFIT à
   *  escalader, aucune limite de lancers n'est requise en plus. Le compteur étant
   *  incrémenté AVANT la résolution, le premier lancer vaut 1 et ne doit donc PAS
   *  être majoré — d'où le « −1 » du calcul dans `combat.ts`. */
  bonusParRelanceCeTour?: number;
  /** Colère de Iop : +N par lancer PRÉCÉDENT du sort, pour tout le reste du combat.
   *  Lit `lancersCombat`, qui survit aux tours — contrairement à `lancersCeTour`. */
  bonusParLancerCombat?: number;
  // --- rework du Cra ---
  enflammee?: boolean; // Flèche enflammée : handler dédié (éclaboussure asymétrique avant/arrière)
  degatsPoussee?: boolean; // Flèche de recul : rider du handler dédié `lancerFlecheDeRecul` (deplaceCible "arriere" a été retiré du sort, orphelin) — dégâts ignoreResistances si ça bouscule
  // --- kit du Roublard ---
  poseBombe?: boolean; // Bombe collante : colle une charge sur la cible (sans dégâts), cap BOMBES_MAX
  kaboom?: boolean; // Kaboom : handler dédié (détonne toutes les bombes posées)
  boomerang?: boolean; // Dagues Boomerang : frappe la cible, l'ennemi derrière, puis re-frappe la cible
  resquille?: number; // Resquille : PA retirés à chaque ennemi touché par le prochain Kaboom du lanceur
  // --- kit du Xélor ---
  etatAiguille?: boolean; // Aiguille : marqueur documentaire — dégâts + pose l'effet "aiguille" (générique via `effet`)
  telefragSiOccupee?: boolean; // Pendule : rider de deplaceCible — double Téléfrag si la rangée de destination était occupée
  paProchainTour?: number; // Prémonition : paBonusNextTurn = max(actuel, valeur) — non cumulable avec lui-même
  // --- kit de l'Éliotrope ---
  posePortail?: boolean; // Portail : ouvre un portail (compteur cumulable, cap PORTAILS_MAX)
  soinLigneAvantRatio?: number; // Rayon de Wakfu : les dégâts RÉELLEMENT infligés sur la rangée soignent la rangée avant alliée (répartis à parts égales)
  effetSiPortails?: { seuil: number; valeur: number }; // Sarcasme : remplace la valeur de `effet` si portails du lanceur ≥ seuil
  poisonSiPortails?: { seuil: number; ratio: number; duree: number }; // Parasite : pose un poison = jet × ratio si portails du lanceur ≥ seuil
  paProchainTourLigne?: { valeur: number; seuil: number; valeurSeuil: number }; // Coalition : paBonusNextTurn += sur le lanceur et sa rangée (valeurSeuil si portails ≥ seuil)
  conjuration?: { pct: number; seuil: number; pctSeuil: number; duree: number }; // Conjuration : pose la marque Combatant.conjuration sur la cible (pctSeuil si portails du lanceur ≥ seuil)
  // --- kit du Forgelance ---
  invoqueLance?: boolean; // Lance : plante la Lance dans la rangée de la cible ; grisé si une lance du lanceur est déjà vivante
  zoneLance?: boolean; // Muspel/Hydra/Jormun : cible = ennemi de rangée avant OU la lance alliée ; résolution = la rangée de la cible
  bonusParEnnemiToucheZone?: number; // Muspel : ×(1 + taux × nb d'ennemis VIVANTS non-lance dans la zone), calculé AVANT les jets
  bouclierParEnnemiTouche?: number; // Hydra : bouclier au lanceur = cette valeur × nb d'ennemis (non-lance) touchés
  tousSiLanceArriere?: boolean; // Jormun : si la cible est la lance en rangée ARRIÈRE, touche TOUS les ennemis
  rappelleLance?: { soinParDurabilite: number }; // Vajra : rappelle la lance (bris standard) et soigne selon sa durabilité restante ; injouable sans lance vivante
  redirigeArriere?: { ratio: number; duree: number }; // Étreinte de Valkyr : pose Combatant.redirection sur le lanceur
  // --- rework de l'Ecaflip (primitives du pipeline de dégâts) ---
  /** Pile ou Face : quand ce sort critique, réduit de N PA le coût de son PROCHAIN
   *  lancer (cumulatif d'un critique à l'autre, plancher 1 PA — voir `coutEffectif`).
   *  Remise posée sur `Combatant.remisesCout`, remise à {} en DÉBUT de tour du porteur
   *  (même point d'entrée que `lancersCeTour`) : elle ne survit jamais au tour où elle
   *  a été gagnée. Anciennement `rembPASiCrit` (remboursement immédiat) — remplacé, pas
   *  ajouté : un seul champ porte la mécanique. */
  reduitCoutSiCrit?: number;
  elementPire?: boolean; // Bluff : frappe dans le PIRE élément (dernier du classement) plutôt que le meilleur
  secondCoupSiCrit?: boolean; // Bluff : sur critique, frappe une seconde fois dans l'AUTRE élément (le meilleur)
  effetLigneCible?: EffetSpec; // débuff appliqué à TOUTE la rangée de la cible ; non cumulable (durée rafraîchie)
  soinAvantBlesseRatio?: number; // soigne l'allié le plus blessé de la RANGÉE AVANT d'une fraction des dégâts infligés
  // --- rework de l'Ecaflip (primitives du chemin de soutien) ---
  bouclierPctSiCrit?: number; // remplace bouclierPct si le sort de soutien critique (voir tiragesSiCrit)
  bouclierTours?: number; // Château de cartes : le bouclier octroyé expire après N tours du porteur
  facesAleatoires?: FaceRoulette[]; // Roulette : handler dédié (tirage(s) de face indépendants)
  tiragesSiCrit?: number; // Roulette : nombre de faces tirées si le sort critique (sinon 1 seule)
  // --- rework du Féca (primitives de rangée) ---
  effetRangeeAlliee?: BuffRangeeAlliee; // buffe une rangée ALLIÉE absolue (Vigie, Pâturage, Fortification)
  retraitPAProchainTour?: number; // Tétanie : la cible commence son prochain tour amputée de N PA
  invoqueEgide?: { tours: number }; // Égide : invoque une garde sur la rangée de l'allié ciblé, qui intercepte tous les dégâts destinés à cette rangée pendant N tours ; grisé si une Égide du lanceur est déjà vivante ou si la rangée est pleine
  // --- rework du Iop ---
  /** Endurance / Vertu (Iop) : bouclier en % des PV max de CHAQUE bénéficiaire, sur une
   *  portée, avec une durée. Même triplet que les faces de la Roulette, dont la
   *  résolution est partagée (`appliquerBouclierPortee`). Sans `tours`, le bouclier est
   *  PERMANENT et se cumule sans borne : toujours en fournir une pour un sort répétable. */
  bouclierPortee?: { portee: "soi" | "rangee_lanceur" | "rangee_avant"; pct: number; tours?: number };
  /** Précipitation (Iop) : PA crédités TOUT DE SUITE sur `paActuels`, utilisables dans le
   *  tour en cours et perdus à sa fin. À distinguer de `paGain`/`paProchainTour`, qui
   *  créditent tous deux `paBonusNextTurn`, donc le tour SUIVANT. */
  paImmediat?: number;
  // --- kit du Sram ---
  /** Pose un piège sur la rangée de la cible (voir `Piege`). Un SEUL champ, pas de
   *  variante « funeste »/« fragmentation » : le piège retient son `sortId`, donc
   *  c'est le sort lui-même qui porte ses riders de déclenchement — deux pièges
   *  diffèrent par leurs riders, jamais par un discriminant à maintenir en double.
   *  Aucun dégât au LANCER : ses jets/riders ne sont lus qu'au déclenchement. */
  posePiege?: boolean;
  bonusParChausseTrappe?: number; // Attaque Mortelle : +N par cumul de Chausse-Trappe du lanceur, cap CHAUSSE_TRAPPE_MAX
  consommeChausseTrappe?: boolean; // remet le compteur de Chausse-Trappe du lanceur à zéro APRÈS lecture, inconditionnellement
  /** Concentration de Chakra : pose sur le LANCEUR un effet `EffetStat` "bonusPieges" de
   *  cette valeur, pour `bonusPiegesDuree` tours (du lanceur — défaut 1 si absent). Lu au
   *  DÉCLENCHEMENT d'un piège via `sommeEffet(poseur, "bonusPieges")`, donc un piège
   *  déclenché par un allié en bénéficie quand même. Même patron valeur/durée que
   *  `hotPct`/`hotDuree` : deux champs plats plutôt qu'un objet, pour rester cohérent
   *  avec le reste du fichier. */
  bonusPieges?: number;
  bonusPiegesDuree?: number;
  /** Brume : partage l'esquive du LANCEUR (agilité + effets `esquive`, SANS le bonus de
   *  position `esquiveArriere` ni une Brume déjà active sur lui-même — sans quoi une
   *  Brume active sur le lanceur gonflerait la valeur d'une Brume suivante) à TOUS les
   *  alliés vivants de la rangée de la CIBLE, lanceur compris s'il s'y trouve, comme un
   *  effet `esquive` de cette durée. Résolu UNE SEULE FOIS par lancer, jamais une fois
   *  par bénéficiaire — la portée ne dépend pas de qui le sort a « touché » (un buff n'a
   *  pas de notion de touché/esquivé). */
  esquivePartageeRangee?: { duree: number };
}

/** Piège du Sram : posé sur une rangée d'un camp, déclenché quand un adversaire y
 *  est DÉPLACÉ (voir `deplacerCible`, combat.ts). N'est PAS un combattant et
 *  n'occupe AUCUNE case de la grille — s'il en prenait une, il remplirait la
 *  rangée de destination, `caseLibreRangeeOpposee` renverrait `null`, le
 *  déplacement échouerait EN SILENCE, et le piège ne pourrait alors jamais se
 *  déclencher : il serait sa propre négation. C'est la contrainte qui décide de
 *  toute l'implémentation. */
export interface Piege {
  sortId: string; // le sort qui l'a posé : porte jet, scaling et riders de déclenchement
  camp: Camp; // camp des victimes potentielles (la rangée surveillée appartient à CE camp)
  avant: boolean; // rangée surveillée (avant/arrière) de ce camp
}

/** Un effet de buff de rangée. Distinct d'`EffetSpec` parce qu'il porte une valeur
 *  conditionnelle, que le reste du moteur n'a pas à connaître. */
export interface EffetRangee {
  stat: EffetStat;
  valeur: number;
  duree: number;
  /** Valeur employée à la place de `valeur` si AU MOINS DEUX héros hors invocation
   *  occupent la rangée AVANT alliée (Pâturage, Fortification). */
  valeurSiDeuxDevant?: number;
}

/** Buff appliqué à une rangée ALLIÉE — absolue, pas relative au lanceur. */
export interface BuffRangeeAlliee { rangee: "avant" | "arriere"; effets: EffetRangee[] }

/** Une face de Roulette (Ecaflip) : une portée, et ce qu'elle applique à chaque unité. */
export interface FaceRoulette {
  portee: "soi" | "rangee_lanceur" | "rangee_avant";
  effet?: EffetSpec; // buff appliqué à chaque unité de la portée
  bouclierPct?: number; // ou bouclier en % des PV max
  duree?: number; // durée du bouclier de `bouclierPct`, en tours du porteur (Combatant.boucliersTemporaires) ; sans elle, le bouclier serait permanent
}

/** Un effet possible d'un proc aléatoire : quatre sorts de monstres l'emploient
 *  (Goinfrerie, Morsure vorace, Sortilège lunaire, Souffle capricieux). */
export interface ProcAleatoire {
  effet?: EffetSpec;
  dissipePositifs?: boolean;
}

/** Effet appliqué quand un sort `mixte` est lancé sur un allié. */
export interface SurAllie {
  effet?: EffetSpec;
  soin?: { min: number; max: number }; // soigne l'allié (Mot Alternatif)
  nonCumulable?: boolean; // remplace l'effet existant au lieu de l'empiler
}

/** Archétype d'une classe : pilote les gains de caractéristique par niveau
 *  (voir GAINS_ARCHETYPE dans progression.ts). */
export type Archetype = "melee" | "distance";

export interface Classe {
  id: string;
  nom: string;
  pvBase: number;
  archetype: Archetype;
  /** Les DEUX éléments de la classe : l'élément de frappe se choisit parmi eux
   *  (sauf `elementLibre`, Kwakwaffe). Leurs caractéristiques montent à chaque
   *  niveau, les deux autres restent à la base de classe. */
  elements: [Element, Element];
  stats: Stats;
  pa: number; // budget de PA par tour
  initiative: number;
  sorts: string[]; // ids de sorts
  img?: string; // chemin du portrait (public/assets)
}

export type IA = "agressif" | "soutien";

export interface Monstre {
  id: string;
  nom: string;
  pv: number;
  stats: Stats;
  pa: number;
  initiative: number;
  resistances: Partial<Record<Element, number>>; // fraction : 0.25 = −25 % subis
  sorts: string[];
  ia: IA;
  boss?: boolean;
  archiNom?: string; // vrai nom d'Archimonstre (DofusDB) ; absent = pas d'archi → non capturable
  img?: string; // chemin du sprite (public/assets)
  /** Signature du Kwakwa : au début de son tour, résistances = cette valeur
   *  dans TOUS les éléments sauf un, tiré au hasard, qui tombe à 0. */
  mueElementaire?: number;
  /** Signature de Grunob : +X (fraction) de dégâts infligés par allié vivant
   *  dans sa rangée (avant/arrière), lui exclu. */
  bonusParAllieLigne?: number;
  /** Craqueleurs : réduction PLATE et PERMANENTE des dégâts subis, retranchée de
   *  chaque frappe (plancher à 0). Distincte des résistances, qui sont un
   *  pourcentage : le plat mange les petits coups et laisse passer les gros. */
  armure?: number;
  /** Meulou : réduit à ZÉRO les N premiers coups directs reçus à chaque tour.
   *  Distinct de `nullifieProchainCoup` (Roublardise), qui est un booléen à un seul
   *  coup et non un compteur rechargé. Le poison n'est pas concerné : il ne passe pas
   *  par `infligerDegats`. */
  nullifieParTour?: number;
}

export type Camp = "joueur" | "ennemi";

export interface EffetActif {
  stat: EffetStat;
  valeur: number;
  toursRestants: number;
  transmet?: boolean; // poison transmissible
  // Marqueur MOTEUR (jamais posé par le contenu) : distingue un effet posé par
  // `appliquerBuffRangee` (Vigie/Pâturage/Fortification) de tout autre effet de
  // même `stat` venu d'une AUTRE source (débuff de monstre, objet, autre sort).
  // Sans lui, la garde de non-cumul du buff de rangée (qui doit pouvoir RAFRAÎCHIR
  // sa propre valeur — l'escalade 10 %→15 % à deux héros devant) écraserait aussi
  // un effet étranger de la même stat au lieu de coexister avec lui.
  viaBuffRangee?: boolean;
  // Marqueur MOTEUR (jamais posé par le contenu) : distingue un effet `esquive` posé par
  // Brume (Sram) de tout autre effet `esquive` (équipement, autre sort). Sert UNIQUEMENT
  // à exclure ces entrées du calcul de la Brume SUIVANTE (voir `partagerEsquive`,
  // combat.ts) — sans lui, une Brume déjà active sur le lanceur gonflerait la valeur
  // qu'il partage à sa rangée à chaque relance, une auto-alimentation non voulue.
  viaBrume?: boolean;
  // Marqueur MOTEUR (jamais posé par le contenu) : identifie la relique qui a posé cet
  // effet (ex. "dofus_tachete") — sert UNIQUEMENT à reconnaître ses propres exemplaires
  // pour un buff « non cumulable », sur le même principe que `viaBuffRangee`/`viaBrume`
  // ci-dessus (deux marqueurs dédiés plutôt qu'un seul champ générique, pour rester
  // cohérent avec l'existant).
  source?: string;
}

export interface Combatant {
  ref: string; // identifiant unique dans le combat
  nom: string;
  pvBase: number;
  pvMax: number;
  pvActuels: number;
  stats: Stats;
  paMax: number;
  paActuels: number;
  initiative: number;
  resistances: Partial<Record<Element, number>>;
  sorts: string[];
  camp: Camp;
  position: number; // 1..n, ordre dans la ligne (sert surtout aux ennemis)
  niveau: number; // niveau du personnage (1 pour les monstres) ; scaling « +x/lvl »
  monstreId?: string; // espèce (ennemis) — sert à la capture d'Archimonstre
  archi?: boolean; // variante Archimonstre (boostée, capturable)
  archiNom?: string; // vrai nom d'Archimonstre de l'espèce (absent = non capturable)
  ia?: IA;
  effets: EffetActif[];
  img?: string; // chemin du portrait/sprite
  mueElementaire?: number; // signature du Kwakwa (cf. Monstre.mueElementaire)
  paGamble?: { pPlus: number; plus: number; moins: number }; // Chance d'Ecaflip portée
  rage?: number; // états de Rage (Ouginak) : +RAGE_BONUS de dégâts par charge, consommés par Apaisement
  elementLibre?: boolean; // Kwakwaffe portée : l'élément choisi n'est plus limité au top 2
  renaissance?: number; // Kwakwanneau : fraction de PV de la renaissance (une par combat)
  renaissancesRestantes?: number; // compteur de renaissances disponibles ce combat
  riposteAvant?: number; // riposte d'équipement (Sabre Shodanwa), active si ligne avant
  armure?: number; // armure NATIVE permanente (Craqueleurs) — s'ajoute aux effets `armure` temporaires
  perceResistances?: number; // fraction des résistances ignorée par TOUTES ses frappes (relique)
  nullifieParTour?: number; // allocation par tour (Meulou) — voir Monstre.nullifieParTour
  coupsAnnulesRestants?: number; // annulations encore disponibles ce tour-ci
  esquiveArriere?: number; // esquive d'équipement (Baguette Rikiki), active si ligne arrière
  soinDegatsRecus?: number; // récupération d'équipement (Goyave) : % des dégâts subis rendus en PV
  bonusParAllieLigne?: number; // signature de Grunob (cf. Monstre.bonusParAllieLigne)
  invoquePar?: string; // ref de l'invocateur (monstres invoqués en combat)
  /** Les 2 éléments DÉCLARÉS (héros seulement) : le choix de frappe se limite à eux.
   *  Absent chez les monstres, dont les 2 éléments se déduisent des stats. */
  elements?: [Element, Element];
  // état transitoire :
  maxRollCharges: number; // Œil affûté
  bouclier: number; // points d'absorption (encaissés avant les PV)
  paBonusNextTurn: number; // delta de PA appliqué à la prochaine recharge, positif ou négatif (Mot Ivation, Tétanie)
  cooldowns: Record<string, number>; // `${sortId}:${cibleRef}` -> tours restants
  /** Clés de `cooldowns` posées PENDANT le tour en cours : la passe de fin de tour
   *  les saute une fois, sinon un cooldown perdrait un tour avant d'avoir commencé. */
  cooldownsPosesCeTour?: Set<string>;
  bonusOffensifProchain: number; // Vigueur des bois : bonus % consommé au prochain sort de dégâts
  armeSort?: Spell; // attaque d'arme équipée (case 1 « corps à corps »), sinon absente
  ouvreToujours?: boolean; // Dofus du Cauchemar : force l'ouverture du camp joueur, quelle que soit l'initiative moyenne
  // --- invocation (Poupée de garde) ---
  estInvocation?: boolean; // ne joue pas de tour
  joueTour?: boolean; // false pour une invocation
  provoque?: boolean; // les ennemis doivent la cibler en priorité
  dureeRestante?: number; // optionnel : disparaît après N tours
  lancersCeTour?: Record<string, number>; // clés `sortId` et `sortId:cibleRef` — remis à {} au début du tour du combattant
  /** Lancers par sort depuis le DÉBUT DU COMBAT (clé `sortId`). Jamais remis à zéro
   *  en cours de combat, contrairement à `lancersCeTour`. Alimenté uniquement pour les
   *  sorts qui déclarent `bonusParLancerCombat`. */
  lancersCombat?: Record<string, number>;
  /** Nombre de tours que ce combattant a COMMENCÉS (1 pendant son premier tour).
   *  Lu par `pasPremierTour` ; incrémenté par `runCombat`, jamais par un sort. */
  toursJoues?: number;
  // --- reliques Dofus à déclenchement (src/dofus-effets.ts) ---
  /** Argenté : seuil franchi, soin dû à un tour STRICTEMENT postérieur. Retient le
   *  numéro de `toursJoues` du porteur au moment de l'armement (pas un booléen) :
   *  la consommation compare ce numéro à `toursJoues` courant, pour que la règle
   *  « jamais pendant le tour où le seuil a été franchi » tienne quel que soit
   *  l'ORDRE des appels moteur qui peuvent armer ce drapeau (poison en tout début
   *  de tour du porteur lui-même, ou coup direct pendant le tour d'un autre). */
  argenteArme?: number;
  argenteUtilise?: boolean; // Argenté : déjà déclenché ce combat
  degatsPctDofus?: number; // bonus/malus de dégâts finaux du tour en cours (Nébuleux, Domakuro)
  /** Domakuro : a-t-il infligé des dégâts pendant le tour COURANT ? Posé par
   *  `infligerDegats` (src/combat.ts) — PAS par `crochetDegatsInfliges`, qui ne couvre
   *  que le chemin de dégâts « normal » de `lancerSort` : les branches à retour
   *  anticipé (Dagues Boomerang, Flèche Enflammée/de Recul, Rayon de Wakfu)
   *  infligent, elles aussi, de vrais dégâts et doivent marquer le porteur — seul
   *  `infligerDegats` est traversé par TOUS ces chemins (Round de correction 1).
   *  Remis à `false` par `crochetFinTour` à la fin de CHAQUE tour (quelles que soient
   *  les reliques actives), sinon un porteur qui frappe une fois resterait marqué
   *  pour tout le combat. */
  aFrappeCeTour?: boolean;
  /** Domakuro : bonus de dégâts finaux acquis pour le RESTE du combat — décidé une
   *  fois, à la fin du PREMIER tour du porteur, jamais réarmé après. Distinct de
   *  `degatsPctDofus` ci-dessus (qui ne vaut que pour le tour en cours) : ne pas
   *  confondre les deux, malgré la ressemblance des noms. */
  degatsPctPermanent?: number;
  /** Veilleurs : ce BÉNÉFICIAIRE a déjà reçu le soin non cumulable depuis son propre
   *  dernier tour. Posé sur le bénéficiaire (pas le porteur), remis à `false` au
   *  début de son tour dans `reinitialiserLancersTour`. */
  veilleursRecuCeTour?: boolean;
  nullifieProchainCoup?: boolean; // le prochain coup DIRECT reçu (pas un poison) est annulé (0 dégâts), flag consommé
  bombes?: number; // charges de bombe posées (Roublard), cap BOMBES_MAX
  telefrags?: number; // Téléfrags posés (Xélor), cap TELEFRAGS_MAX
  resquilleActive?: number; // Resquille (Roublard) : PA à retirer par ennemi touché au prochain Kaboom (expire en fin de tour)
  portails?: number; // portails ouverts (Éliotrope), cap PORTAILS_MAX — aura de dégâts pour le porteur et sa rangée
  conjuration?: { pct: number; lanceurRef: string; tours: number }; // marque Conjuration (Éliotrope) : +pct dégâts pour le lanceur et sa rangée, décompte en fin de tour du lanceur
  // --- Sram (pièges) ---
  pieges?: Piege[]; // pièges vivants de CE poseur, dans l'ordre de pose ; cap PIEGES_MAX. Un poseur MORT les garde actifs (ce ne sont pas des invocations).
  chausseTrappe?: number; // cumuls de Chausse-Trappe, cap CHAUSSE_TRAPPE_MAX ; crédités au poseur à chaque déclenchement, même provoqué par un allié
  // --- Forgelance ---
  estLance?: boolean; // vrai pour le pseudo-combattant « Lance » (camp ennemi, invocation)
  lanceurRef?: string; // ref du Forgelance propriétaire de la lance (réutilisé par l'Égide du Féca : ref du lanceur)
  redirection?: { ratio: number; tours: number }; // Étreinte : redirige une fraction des dégâts subis par un allié arrière vers le porteur
  redirectionPoseCeTour?: boolean; // vrai le tour où redirection est posée : le décompte de fin de tour est sauté une fois (même mécanique de garde qu'un minuteur posé en cours de tour)
  // --- Féca (Égide) ---
  estEgide?: boolean; // vrai pour le pseudo-combattant « Égide » (camp du lanceur, invocation qui intercepte pour sa rangée)
  toursRestantsInvocation?: number; // minuteur de l'Égide, décompté au début du tour de son invocateur (comme Combatant.conjuration)
  // --- Ecaflip (Château de cartes) ---
  /** Boucliers à DURÉE (distincts du bouclier permanent) : chaque entrée retient le
   *  montant octroyé pour ne jamais retirer plus que ce qui a été donné à l'expiration.
   *  L'absorption (`infligerDegats`) ne trace pas la source des points de bouclier : si un
   *  bouclier permanent coexiste avec un temporaire, l'expiration retire ce qui reste du
   *  bouclier total sans savoir à qui il appartenait — imperfection assumée, pas un oubli. */
  boucliersTemporaires?: { montant: number; tours: number }[];
  /** Pile ou Face (Ecaflip) : remise de coût accumulée PAR sortId (clé = `Spell.id`),
   *  lue par `coutEffectif()`. Remise à {} au DÉBUT du tour du porteur, comme
   *  `lancersCeTour` — une remise ne survit donc jamais au tour où elle a été gagnée. */
  remisesCout?: Record<string, number>;
}

/** Progression d'un personnage pendant une run (réinitialisée à la mort).
 *  Les stats sont entièrement dérivées de (classe, niveau) — voir `statsFinales`
 *  dans `progression.ts` ; il n'y a plus de pool de points à allouer. */
export interface Progression {
  niveau: number;
  xp: number; // xp accumulée vers le niveau suivant
}

/** État persistant — la seule chose qui survit à la mort. */
/** Un exemplaire possédé d'une relique. `jet` n'existe que pour les reliques à
 *  tirage (Kalyptus) : sa valeur est figée à l'obtention. */
export interface DofusInstance {
  id: string;
  jet?: number;
}

export interface Meta {
  dofus: DofusInstance[]; // exemplaires de Dofus possédés (peut contenir des doublons)
  archis: string[]; // ids d'espèces de monstres capturées en Archimonstre (uniques)
  runs: number; // nombre total de runs terminées (victoire ou mort)
  victoires: number; // sous-ensemble : runs achevées (les 6 zones vaincues)
  succes?: string[]; // ids des succès débloqués (optionnel : rétro-compat)
  collection?: Record<string, string>; // Armurerie : itemId → meilleure rareté obtenue
  ascension?: Record<string, number>; // record par tranche : plus haut palier VAINCU (absent = tranche jamais finie)
  /** Version du schéma. Absente ou < 2 = sauvegarde d'avant la refonte de
   *  l'Ascension : ses records sont remis à zéro au chargement, une seule fois. Le
   *  seuil est FIGÉ à 2, pas `< META_VERSION` : un joueur déjà en version 2 ne doit
   *  pas revoir ses records remis à zéro simplement parce que META_VERSION grimpe
   *  depuis (voir `chargerMeta`, src/run.ts, et le test qui verrouille ce découplage). */
  version?: number;
}

// --- Plateau (carte de nœuds) ------------------------------------------------
export type NodeType = "combat" | "combat_dur" | "taverne" | "otomai" | "zaap" | "donjon" | "hdv" | "forgemagie";

export interface MapNode {
  id: string;
  type: NodeType;
  ligne: number; // 0 = départ ... N = boss
  colonne: number;
  suivants: string[]; // ids atteignables à la rangée suivante
  visite?: boolean;
  combatId?: string; // pour les nœuds de combat : quel encounter
  xp?: number; // récompense XP (combats)
  eliteModifs?: string[]; // combat_dur : ids des modificateurs (tirés à la génération, affichés au survol)
}

export interface GameMap {
  noeuds: MapNode[];
  courant: string | null; // null avant le 1er choix
  depart: string[]; // ids de la 1re rangée
}

/** Décision d'action renvoyée par un contrôleur (joueur ou IA). */
export interface Action {
  sort: Spell;
  cibleRef: string;
}
