// =============================================================================
//  types.ts — Modèle de données (issu du spec V0)
// =============================================================================

export type Element = "terre" | "feu" | "eau" | "air";

export interface Stats {
  force: number; // dégâts Terre + taux de crit
  intelligence: number; // dégâts Feu + puissance offensive
  agilite: number; // dégâts Air + esquive + dégâts de crit
  vitalite: number; // PV (réserve, non utilisée pour le calcul de PV max en V0)
  // --- stats étendues (optionnelles, défaut 0) ---
  chance?: number; // dégâts Eau
  soin?: number; // puissance de soin (× les soins prodigués)
  prospection?: number; // booste le taux de drop d'équipement (cumulé sur l'équipe)
  crit?: number; // % plat de coup critique (équipement) — s'ajoute au crit dérivé de la Force
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
  retraitPA?: number; // Arc des Rivages : 30 % de chance de retirer N PA (mécanique Fracas)
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
  | "contre" // posture de contre (Duel) : valeur = probabilité de riposte quand frappé
  | "friction" // bloque soins ET boucliers du porteur (flag : valeur ignorée)
  | "proie" // marque de l'Ouginak : valeur = vol de vie d'ÉQUIPE contre le porteur (unique)
  | "tetanise" // Tétanisation : le porteur ne peut pas viser la ligne arrière (flag)
  | "ignoreLigne" // le porteur ignore la règle de ligne : ses sorts ennemi_ligne visent aussi l'arrière (flag)
  | "paParTour" // crédite ce nombre de PA à chaque début de tour du porteur, tant que l'effet dure
  | "aiguille" // Xélor : chaque Téléfrag reçu par le porteur le reblesse (écho d'Aiguille)
  | "crit" // Tir Puissant : + crit plat temporaire (propagé dans statsEffectives → se.crit)
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
  siCibleMeurt?: { rebondDegatsX: number }; // Épée hostile : x2 sur un autre ennemi
  ignoreResistances?: boolean; // Flèche intrusive
  ignoreBouclier?: boolean; // Flèche intrusive : les dégâts sautent le bouclier
  retraitPA?: number; // Fracas : −PA immédiat à la cible (visible avant son tour)
  rembPA?: boolean; // Flèche magique : chance (Chance) de rembourser le coût en PA
  maitriseArc?: { principal: number; secondaire: number; duree: number }; // +X/+Y aux 2 éléments de frappe
  doubleEffetProchain?: boolean; // Tir Puissant : double la DURÉE de l'effet de la prochaine flèche
  passeTourSiSurvie?: boolean; // Colère
  effet?: EffetSpec; // buff/debuff appliqué à la cible
  effetLanceur?: EffetSpec; // buff appliqué au lanceur après le sort (Épée du Jugement)
  zoneLigne?: boolean; // dégâts sur TOUTE la rangée de la cible cliquée (Tempête de lames)
  cooldownTours?: number; // cooldown par sort côté lanceur (indispo Nt, toutes cibles)
  contre?: { chance: number; duree: number }; // Duel : posture de riposte (chance/durée)
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
  executeSeulement?: boolean; // Mise à mort : échoue si la cible survivrait au coup
  coups?: Coup[]; // Coup double : plusieurs frappes sur la cible primaire
  projectiles?: Projectiles; // Déluge de lames : N frappes sur cibles aléatoires
  nbCibles?: number; // buff/soin/dégâts sur N cibles (primaire + voisins par position)
  dissipePositifs?: boolean; // désenvoûtement : retire boucliers + effets bénéfiques
  provoqueTours?: number; // Provocation : le lanceur provoque pendant N tours
  mixte?: { surAllie: SurAllie }; // sort lançable sur ennemi (dégâts) ou allié (soutien)
  de?: { faces: number; multMin: number; multMax: number }; // All in : mult tiré au dé
  tarot?: boolean; // Tarot : handler dédié (tirage de couleur)
  espritFelin?: boolean; // Esprit félin : handler dédié (effet aléatoire par unité)
  effets?: EffetSpec[]; // plusieurs effets cumulés (ex. Maître des ombres)
  // --- signatures de boss (invocations côté monstres) ---
  invoqueMonstre?: { pool: string[]; max: number }; // invoque un monstre (id tiré dans pool) ; max = invocations vivantes simultanées
  ressuscite?: { pvPct: number }; // réinvoque un allié monstre vaincu (Boostache) à pvPct de ses PV max
  effetParNiveau?: { stat: EffetStat; base: number; parNiveau: number; duree: number }; // valeur = base + parNiveau×niveau
  poisonAmpli?: number; // Arsenic : active le doublement des poisons pour N tours
  donneBonusDe?: { min: number; max: number; duree: number }; // Bonne pioche
  paGainAdjacents?: number; // Tactique féline : +PA aux alliés des cases adjacentes
  procAleatoire?: ProcAleatoire[]; // Langue râpeuse : 1 effet tiré au hasard sur la cible
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
  maxParCibleParTour?: number; // nombre maximum de lancers de ce sort SUR UNE MÊME cible par tour
  // --- socle Roublard / Xélor / rework Cra ---
  deplaceCible?: "toggle" | "arriere"; // déplace la CIBLE dans la rangée opposée ("toggle") ou vers l'arrière seulement ("arriere") ; échec silencieux si la rangée est pleine
  nullifieProchain?: boolean; // buff : le porteur annule son prochain coup direct reçu (pas les poisons)
  paParTourLigne?: { valeur: number; duree: number }; // crédite ce nombre de PA à chaque début de tour, à TOUTE la rangée de l'allié ciblé, pendant la durée
  retraitPAChance?: number; // probabilité du retrait de PA (retraitPA) ; défaut 0.3 si absent
  bonusParPADispo?: number; // Flèche Punitive : +X % de dégâts par PA dispo AVANT le paiement du coût
  bonusParTelefrag?: number; // Rayon Obscur : +X % de dégâts par Téléfrag posé sur la cible
  // --- rework du Cra ---
  enflammee?: boolean; // Flèche enflammée : handler dédié (éclaboussure asymétrique avant/arrière)
  degatsPoussee?: boolean; // Flèche de recul : rider de deplaceCible "arriere" — dégâts ignoreResistances si ça bouscule
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
}

/** Un effet possible d'un proc aléatoire (Langue râpeuse). */
export interface ProcAleatoire {
  effet?: EffetSpec;
  dissipePositifs?: boolean;
}

/** Une frappe d'un sort multi-coups (Coup double). */
export interface Coup {
  baseMin: number;
  baseMax: number;
  scaling: number;
  proc?: { p: number; poison?: { degats: number; duree: number }; friction?: number };
}

/** Salve de projectiles sur cibles aléatoires (Déluge de lames). */
export interface Projectiles {
  nb: number;
  baseMin: number;
  baseMax: number;
  scaling: number;
  pProc?: number; // probabilité d'effet par projectile
  poison?: { degats: number; duree: number };
}

/** Effet appliqué quand un sort `mixte` est lancé sur un allié. */
export interface SurAllie {
  bouclierPct?: number;
  effet?: EffetSpec;
  soin?: { min: number; max: number }; // soigne l'allié (Mot Alternatif)
  nonCumulable?: boolean; // remplace l'effet existant au lieu de l'empiler
}

export interface Classe {
  id: string;
  nom: string;
  pvBase: number;
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
  dofus?: string; // id du Dofus lâché (boss uniquement)
  archiNom?: string; // vrai nom d'Archimonstre (DofusDB) ; absent = pas d'archi → non capturable
  img?: string; // chemin du sprite (public/assets)
  /** Signature du Kwakwa : au début de son tour, résistances = cette valeur
   *  dans TOUS les éléments sauf un, tiré au hasard, qui tombe à 0. */
  mueElementaire?: number;
  /** Signature de Grunob : +X (fraction) de dégâts infligés par allié vivant
   *  dans sa rangée (avant/arrière), lui exclu. */
  bonusParAllieLigne?: number;
}

export type Camp = "joueur" | "ennemi";

export interface EffetActif {
  stat: EffetStat;
  valeur: number;
  toursRestants: number;
  transmet?: boolean; // poison transmissible
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
  enrage?: number; // Ascension A3 : +X de dégâts infligés par tour (posé par run.ts sur le boss)
  enrageCumul?: number; // accumulé par le moteur au début de chaque tour de l'enragé
  renaissance?: number; // Kwakwanneau : fraction de PV de la renaissance (une par combat)
  renaissancesRestantes?: number; // compteur de renaissances disponibles ce combat
  riposteAvant?: number; // riposte d'équipement (Sabre Shodanwa), active si ligne avant
  esquiveArriere?: number; // esquive d'équipement (Baguette Rikiki), active si ligne arrière
  soinDegatsRecus?: number; // récupération d'équipement (Goyave) : % des dégâts subis rendus en PV
  bonusParAllieLigne?: number; // signature de Grunob (cf. Monstre.bonusParAllieLigne)
  invoquePar?: string; // ref de l'invocateur (monstres invoqués en combat)
  elementChoisi?: Element; // élément de frappe choisi (parmi les 2 plus forts) ; sinon = le plus fort
  // état transitoire :
  maxRollCharges: number; // Œil affûté
  passeProchainTour: boolean; // Colère
  bouclier: number; // points d'absorption (encaissés avant les PV)
  paBonusNextTurn: number; // PA bonus appliqués à la prochaine recharge (Mot Ivation)
  cooldowns: Record<string, number>; // `${sortId}:${cibleRef}` -> tours restants
  bonusOffensifProchain: number; // Vigueur des bois : bonus % consommé au prochain sort de dégâts
  doubleEffetProchain?: boolean; // Tir Puissant : la prochaine flèche applique ses effets à durée doublée
  armeSort?: Spell; // attaque d'arme équipée (case 1 « corps à corps »), sinon absente
  poisonAmpliTours: number; // Arsenic : poisons appliqués ×2 tant que > 0
  bonusDe: number; // Bonne pioche : +X aux tirages dé/carte
  bonusDeTours: number; // durée restante du bonus de dé
  dofusLache?: string; // pour le boss
  // --- invocation (Poupée de garde) ---
  estInvocation?: boolean; // ne joue pas de tour
  joueTour?: boolean; // false pour une invocation
  provoque?: boolean; // les ennemis doivent la cibler en priorité
  provoqueTours?: number; // Provocation : tours restants de provocation (sinon permanent)
  provoquePoseCeTour?: boolean; // vrai le tour où provoqueTours est posé : le décompte de fin de tour est sauté une fois (sinon la provocation expirerait avant le tour adverse suivant)
  dureeRestante?: number; // optionnel : disparaît après N tours
  lancersCeTour?: Record<string, number>; // clés `sortId` et `sortId:cibleRef` — remis à {} au début du tour du combattant
  nullifieProchainCoup?: boolean; // le prochain coup DIRECT reçu (pas un poison) est annulé (0 dégâts), flag consommé
  bombes?: number; // charges de bombe posées (Roublard), cap BOMBES_MAX
  telefrags?: number; // Téléfrags posés (Xélor), cap TELEFRAGS_MAX
  resquilleActive?: number; // Resquille (Roublard) : PA à retirer par ennemi touché au prochain Kaboom (expire en fin de tour)
  portails?: number; // portails ouverts (Éliotrope), cap PORTAILS_MAX — aura de dégâts pour le porteur et sa rangée
  conjuration?: { pct: number; lanceurRef: string; tours: number }; // marque Conjuration (Éliotrope) : +pct dégâts pour le lanceur et sa rangée, décompte en fin de tour du lanceur
  // --- Forgelance ---
  estLance?: boolean; // vrai pour le pseudo-combattant « Lance » (camp ennemi, invocation)
  lanceurRef?: string; // ref du Forgelance propriétaire de la lance
  redirection?: { ratio: number; tours: number }; // Étreinte : redirige une fraction des dégâts subis par un allié arrière vers le porteur
  redirectionPoseCeTour?: boolean; // vrai le tour où redirection est posée : le décompte de fin de tour est sauté une fois (même bug/fix que provoquePoseCeTour)
}

/** Progression d'un personnage pendant une run (réinitialisée à la mort). */
export interface Progression {
  niveau: number;
  xp: number; // xp accumulée vers le niveau suivant
  pointsDispo: number; // points de caractéristique non dépensés
  pointsInvestis: Stats; // points dépensés par stat, au-dessus de la base de classe
}

/** État persistant — la seule chose qui survit à la mort. */
export interface Meta {
  dofus: string[]; // ids des Dofus possédés (peut contenir des doublons)
  archis: string[]; // ids d'espèces de monstres capturées en Archimonstre (uniques)
  runs: number; // nombre total de runs terminées (victoire ou mort)
  victoires: number; // sous-ensemble : runs achevées (les 6 zones vaincues)
  succes?: string[]; // ids des succès débloqués (optionnel : rétro-compat)
  collection?: Record<string, string>; // Armurerie : itemId → meilleure rareté obtenue
  ascension?: Record<string, number>; // record par tranche : plus haut palier VAINCU (absent = tranche jamais finie)
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
