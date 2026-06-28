// =============================================================================
//  data.ts — Données du jeu (data-driven)
//  Classes, sorts, monstres et séquence de la run. Aucune logique ici.
// =============================================================================
import type { Classe, Item, Monstre, Panoplie, Spell } from "./types";

// --- Sorts -------------------------------------------------------------------
export const SORTS: Record<string, Spell> = {
  // ---- Iop : bruiser de mêlée ----
  pression: {
    id: "pression", nom: "Pression", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    desc: "Dégâts simples sur un ennemi de la ligne.",
  },
  epee_hostile: {
    id: "epee_hostile", nom: "Épée hostile", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 14, scaling: 0.4,
    siCibleMeurt: { rebondDegatsX: 2 },
    desc: "Si la cible meurt, rebondit sur un autre ennemi en infligeant le double.",
  },
  fracas: {
    id: "fracas", nom: "Fracas", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 14, baseMax: 18, scaling: 0.5,
    retraitPA: 3,
    desc: "Gros dégâts + retire 3 PA à la cible au prochain tour.",
  },
  colere: {
    id: "colere", nom: "Colère", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 18, baseMax: 24, scaling: 0.6,
    passeTourSiSurvie: true,
    desc: "Très gros dégâts ; le Iop passe son prochain tour si la cible survit.",
  },
  vitalite: {
    id: "vitalite", nom: "Vitalité", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effet: { stat: "vitalite", valeur: 0.2, duree: 3 },
    desc: "+20 % PV max au lanceur pendant 3 tours.",
  },

  // ---- Cra : tireuse à distance ----
  fleche_magique: {
    id: "fleche_magique", nom: "Flèche magique", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    desc: "Dégâts simples sur un ennemi de la ligne.",
  },
  fleche_corrosive: {
    id: "fleche_corrosive", nom: "Flèche corrosive", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 6, baseMax: 9, scaling: 0.25,
    rebond: { sauts: 1, bonusParSaut: 0 },
    effet: { stat: "degatsInfliges", valeur: -0.1, duree: 2 },
    desc: "Touche 2 ennemis + malus −10 % de dégâts infligés pendant 2 tours.",
  },
  fleche_percante: {
    id: "fleche_percante", nom: "Flèche perçante", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 9, baseMax: 13, scaling: 0.4,
    rebond: { sauts: 2, bonusParSaut: 0.2 },
    desc: "Touche le 1er ennemi puis rebondit 2 fois, +20 % de dégâts par saut.",
  },
  fleche_intrusive: {
    id: "fleche_intrusive", nom: "Flèche intrusive", type: "degats", coutPA: 3,
    cible: "ennemi_tous", baseMin: 5, baseMax: 7, scaling: 0.2,
    ignoreResistances: true,
    desc: "Frappe n'importe quel ennemi (même l'arrière) et ignore les résistances.",
  },
  oeil_affute: {
    id: "oeil_affute", nom: "Œil affûté", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effet: { stat: "maxRoll", valeur: 2, duree: 99 },
    desc: "Les 2 prochains sorts offensifs tapent au maximum de leur fourchette.",
  },

  // ---- Eniripsa : soutien défensif ----
  fiole_douleur: {
    id: "fiole_douleur", nom: "Fiole de douleur", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 14, baseMax: 18, scaling: 0.5,
    poison: { degats: 6, duree: 2, transmet: true },
    desc: "Gros dégâts + poison (2t). Si la cible meurt du poison, il passe au monstre derrière.",
  },
  mot_vampirique: {
    id: "mot_vampirique", nom: "Mot vampirique", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.35,
    soinEquipeRatio: 0.25,
    desc: "Dégâts modérés ; soigne l'équipe de 25 % des dégâts infligés.",
  },
  mot_reconfortant: {
    id: "mot_reconfortant", nom: "Mot réconfortant", type: "soin", coutPA: 3,
    cible: "allie", baseMin: 14, baseMax: 20, scaling: 0,
    desc: "Soigne modérément un allié.",
  },
  mot_reconstitution: {
    id: "mot_reconstitution", nom: "Mot de reconstitution", type: "soin", coutPA: 6,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    soinComplet: true,
    desc: "Soigne entièrement un allié.",
  },
  mot_entraide: {
    id: "mot_entraide", nom: "Mot d'entraide", type: "soin", coutPA: 3,
    cible: "allie_tous", baseMin: 8, baseMax: 12, scaling: 0,
    desc: "Soin faible sur toute l'équipe.",
  },
  mot_preventif: {
    id: "mot_preventif", nom: "Mot préventif", type: "buff", coutPA: 4,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    bouclierPct: 0.15, hotPct: 0.05, hotDuree: 3,
    desc: "Bouclier (15 % PV) + soin sur la durée (5 % vita / 3t).",
  },
  antivenin: {
    id: "antivenin", nom: "Antivenin", type: "buff", coutPA: 2,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    dissipe: true, hotPct: 0.05, hotDuree: 2,
    desc: "Dissipe les effets négatifs + soin sur la durée (5 % vita / 2t).",
  },
  mot_ivation: {
    id: "mot_ivation", nom: "Mot d'ivation", type: "buff", coutPA: 2,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    paGain: 2, cooldown: 3,
    desc: "Octroie 2 PA à un allié (prochain tour). Non relançable sur la même cible (3t).",
  },

  // ---- Sadida : contrôleur / invocateur ----
  crachat_de_seve: {
    id: "crachat_de_seve", nom: "Crachat de sève", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    poison: { degats: 4, duree: 2 },
    desc: "Dégâts simples + poison léger (2t).",
  },
  deferlante: {
    id: "deferlante", nom: "Déferlante", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 5, baseMax: 8, scaling: 0.25,
    rebond: { sauts: 1, bonusParSaut: 0 }, // touche les 2 premiers
    effet: { stat: "initiative", valeur: -5, duree: 1 },
    desc: "Touche les 2 premiers ennemis (dégâts faibles) + initiative réduite (1t).",
  },
  lame_liquide: {
    id: "lame_liquide", nom: "Lame liquide", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 16, baseMax: 22, scaling: 0.5,
    desc: "Gros dégâts mono-cible.",
  },
  etreinte_ronces: {
    id: "etreinte_ronces", nom: "Étreinte des ronces", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 14, scaling: 0.35,
    rebond: { sauts: 1, bonusParSaut: 0 }, // 1ʳᵉ ligne
    effet: { stat: "initiative", valeur: -5, duree: 1 },
    desc: "Dégâts modérés à la 1ʳᵉ ligne + initiative réduite (1t).",
  },
  poupee_garde: {
    id: "poupee_garde", nom: "Poupée de garde", type: "invocation", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    invocation: { nom: "Poupée", pv: 40, provoque: true },
    desc: "Invoque une poupée qui provoque les ennemis. Elle encaisse mais ne joue pas.",
  },
  rosee_regenerante: {
    id: "rosee_regenerante", nom: "Rosée régénérante", type: "buff", coutPA: 3,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    hotPct: 0.05, hotDuree: 3,
    desc: "Soin sur la durée sur un allié (5 % vita / 3t).",
  },
  vigueur_bois: {
    id: "vigueur_bois", nom: "Vigueur des bois", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    bonusProchainSortPct: 0.3,
    desc: "+30 % de dégâts au prochain sort offensif du lanceur.",
  },

  // ---- Sram (DPT monocible & poisons) ----
  coupe_jarret: {
    id: "coupe_jarret", nom: "Coupe Jarret", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 14, baseMax: 20, scaling: 0.5,
    poison: { degats: 6, duree: 2 },
    desc: "Gros dégâts + poison (2t).",
  },
  mise_a_mort: {
    id: "mise_a_mort", nom: "Mise à mort", type: "degats", coutPA: 6,
    cible: "ennemi_tous", baseMin: 32, baseMax: 46, scaling: 0.7,
    executeSeulement: true,
    desc: "Très lourds dégâts — échoue si la cible n'en meurt pas.",
  },
  dagues_insidieuses: {
    id: "dagues_insidieuses", nom: "Dagues insidieuses", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    poison: { degats: 5, duree: 2 },
    desc: "Dégâts modérés + poison (2t).",
  },
  flasque_venimeuse: {
    id: "flasque_venimeuse", nom: "Flasque vénimeuse", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 3, baseMax: 6, scaling: 0.15,
    rebond: { sauts: 2, bonusParSaut: 0 },
    poison: { degats: 5, duree: 3 },
    desc: "Poison (3t) sur 3 cibles.",
  },
  deluge_de_lames: {
    id: "deluge_de_lames", nom: "Déluge de lames", type: "degats", coutPA: 5,
    cible: "ennemi_tous", baseMin: 0, baseMax: 0, scaling: 0,
    projectiles: { nb: 10, baseMin: 1, baseMax: 3, scaling: 0.05, pProc: 0.2, poison: { degats: 3, duree: 1 } },
    desc: "10 lames sur des ennemis au hasard ; 20 % de poison (1t) par lame.",
  },
  coup_double: {
    id: "coup_double", nom: "Coup double", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 0, baseMax: 0, scaling: 0,
    coups: [
      { baseMin: 8, baseMax: 12, scaling: 0.3, proc: { p: 0.3, poison: { degats: 5, duree: 2 } } },
      { baseMin: 4, baseMax: 7, scaling: 0.15, proc: { p: 0.3, friction: 2 } },
    ],
    desc: "2 coups ; 30 % poison au 1er, 30 % friction (anti-soin/bouclier) au 2nd.",
  },
  maitre_des_ombres: {
    id: "maitre_des_ombres", nom: "Maître des ombres", type: "buff", coutPA: 3,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effets: [{ stat: "esquive", valeur: 0.25, duree: 3 }],
    effetParNiveau: { stat: "agilite", base: 15, parNiveau: 0.5, duree: 2 },
    desc: "+25 % d'esquive (3t) et boost d'Agilité (15 + 0,5/niv, 2t).",
  },
  arsenic: {
    id: "arsenic", nom: "Arsenic", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    poisonAmpli: 2,
    desc: "Double les dégâts des poisons appliqués pendant 2 tours.",
  },

  // ---- Feca (support défensif) ----
  attaque_celeste: {
    id: "attaque_celeste", nom: "Attaque céleste", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    bouclierRatioDegats: 0.2,
    desc: "Dégâts modérés ; bouclier = 20 % des dégâts infligés.",
  },
  glyphe_naturel: {
    id: "glyphe_naturel", nom: "Glyphe naturel", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 4, baseMax: 7, scaling: 0.2,
    rebond: { sauts: 2, bonusParSaut: 0 },
    effet: { stat: "degatsInfliges", valeur: -0.1, duree: 2 },
    desc: "3 ennemis : dégâts faibles + −10 % de dégâts infligés (2t).",
  },
  glyphe_stimulant: {
    id: "glyphe_stimulant", nom: "Glyphe stimulant", type: "buff", coutPA: 3,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    nbCibles: 2,
    effetParNiveau: { stat: "degatsInfliges", base: 0.1, parNiveau: 0.01, duree: 2 },
    desc: "+10 % de dégâts finaux (+0,01/niv) à 2 alliés (2t).",
  },
  ouragan: {
    id: "ouragan", nom: "Ouragan", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 15, scaling: 0.4,
    rebond: { sauts: 2, bonusParSaut: 0 },
    effet: { stat: "echecCritique", valeur: 0.05, duree: 2 },
    desc: "3 ennemis : dégâts modérés + déstabilise (+5 % d'échec critique, 2t).",
  },
  onde: {
    id: "onde", nom: "Onde", type: "degats", coutPA: 2,
    cible: "mixte", baseMin: 4, baseMax: 7, scaling: 0.2,
    mixte: { surAllie: { bouclierPct: 0.03 } },
    desc: "Ennemi : dégâts faibles. Allié : bouclier (3 % PV max).",
  },
  baton_du_berger: {
    id: "baton_du_berger", nom: "Bâton du berger", type: "buff", coutPA: 4,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    effet: { stat: "reductionDegats", valeur: 0.5, duree: 1 },
    desc: "Un allié reçoit −50 % de dégâts pendant 1 tour.",
  },
  provocation: {
    id: "provocation", nom: "Provocation", type: "buff", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    provoqueTours: 2,
    desc: "Le Feca provoque les ennemis pendant 2 tours.",
  },
  armures: {
    id: "armures", nom: "Armures", type: "buff", coutPA: 2,
    cible: "allie_tous", baseMin: 0, baseMax: 0, scaling: 0,
    effetParNiveau: { stat: "armure", base: 2, parNiveau: 0.5, duree: 2 },
    desc: "Réduit les dégâts subis de l'équipe (2 + 0,5/niv plats, 2t).",
  },

  // ---- Ecaflip (mixte / hasard) ----
  pelote_chaude: {
    id: "pelote_chaude", nom: "Pelote chaude", type: "degats", coutPA: 3,
    cible: "mixte", baseMin: 5, baseMax: 9, scaling: 0.25,
    rebond: { sauts: 2, bonusParSaut: 0 },
    mixte: { surAllie: { effet: { stat: "degatsInfliges", valeur: 0.05, duree: 2 }, nonCumulable: true } },
    desc: "Ennemi : rebondit sur 3 cibles. Allié : +5 % de dégâts finaux (non cumulable).",
  },
  pattounes: {
    id: "pattounes", nom: "Pattounes", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 9, baseMax: 13, scaling: 0.35,
    vampirismeRatio: 0.3,
    desc: "Dégâts modérés ; rend 30 % des dégâts infligés en PV au lanceur.",
  },
  all_in: {
    id: "all_in", nom: "All in", type: "degats", coutPA: 2,
    cible: "ennemi_ligne", baseMin: 6, baseMax: 10, scaling: 0.3,
    de: { faces: 6, multMin: 0.3, multMax: 2.5 },
    desc: "Mise au dé : dégâts de très faibles à très élevés selon le tirage.",
  },
  langue_rapeuse: {
    id: "langue_rapeuse", nom: "Langue râpeuse", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 14, scaling: 0.4,
    procAleatoire: [
      { dissipePositifs: true },
      { effet: { stat: "friction", valeur: 1, duree: 2 } },
      { effet: { stat: "echecCritique", valeur: 0.1, duree: 2 } },
    ],
    desc: "Dégâts modérés + 1 effet aléatoire : désenvoûte / friction / +10 % d'échec critique.",
  },
  tarot: {
    id: "tarot", nom: "Tarot", type: "degats", coutPA: 6,
    cible: "mixte", baseMin: 12, baseMax: 20, scaling: 0.5,
    tarot: true,
    desc: "Tire une carte : effet variable selon la couleur (ennemi ou allié).",
  },
  tactique_feline: {
    id: "tactique_feline", nom: "Tactique féline", type: "buff", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    paGainAdjacents: 1, cooldown: 3,
    desc: "+1 PA aux alliés des cases adjacentes (prochain tour).",
  },
  bonne_pioche: {
    id: "bonne_pioche", nom: "Bonne pioche", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    donneBonusDe: { min: 1, max: 2, duree: 2 },
    desc: "+1 à 2 aux tirages de dé/carte pendant 2 tours.",
  },
  esprit_felin: {
    id: "esprit_felin", nom: "Esprit félin", type: "buff", coutPA: 6,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    espritFelin: true,
    desc: "Applique un effet aléatoire à chaque unité du combat (alliés bénéfiques, ennemis néfastes).",
  },

  // ---- Sorts de monstres (re-tunés pour les PV joueur V1) ----
  morsure: {
    id: "morsure", nom: "Morsure", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 12, baseMax: 18, scaling: 0.4,
    desc: "Coup de mêlée.",
  },
  coup_de_bec: {
    id: "coup_de_bec", nom: "Coup de bec", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 7, baseMax: 12, scaling: 0.4,
    desc: "Piqûre rapide.",
  },
  picotement: {
    id: "picotement", nom: "Picotement", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 5, baseMax: 9, scaling: 0.3,
    desc: "Dégâts faibles.",
  },
  soin_noir: {
    id: "soin_noir", nom: "Soin noir", type: "soin", coutPA: 4,
    cible: "allie", baseMin: 12, baseMax: 18, scaling: 0,
    desc: "Rend des PV à un allié.",
  },
  charge: {
    id: "charge", nom: "Charge", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 20, baseMax: 28, scaling: 0.6,
    desc: "Attaque dévastatrice du boss.",
  },
};

// --- Classes jouables --------------------------------------------------------
export const CLASSES: Record<string, Classe> = {
  iop: {
    id: "iop", nom: "Iop", pvBase: 60,
    stats: { force: 60, intelligence: 10, agilite: 20, vitalite: 50, prospection: 100 },
    pa: 6, initiative: 8,
    sorts: ["pression", "epee_hostile", "fracas", "colere", "vitalite"],
    img: "/assets/classes/iop.png",
  }, // élément de frappe = Terre (Force la plus haute) ; crit ≈ 30 %
  cra: {
    id: "cra", nom: "Cra", pvBase: 45,
    stats: { force: 15, intelligence: 20, agilite: 55, vitalite: 40, prospection: 140 },
    pa: 6, initiative: 12,
    sorts: ["fleche_magique", "fleche_corrosive", "fleche_percante", "fleche_intrusive", "oeil_affute"],
    img: "/assets/classes/cra.png", // PNG transparent (meilleur rendu sur la carte)
  }, // élément de frappe = Air ; esquive ≈ 11 %
  eniripsa: {
    id: "eniripsa", nom: "Eniripsa", pvBase: 50,
    stats: { force: 10, intelligence: 40, agilite: 20, vitalite: 45, soin: 60, prospection: 120 },
    pa: 6, initiative: 11,
    sorts: [
      "fiole_douleur", "mot_vampirique", "mot_reconfortant", "mot_reconstitution",
      "mot_entraide", "mot_preventif", "antivenin", "mot_ivation",
    ],
    img: "/assets/classes/eniripsa.png",
  }, // élément de frappe = Feu (Intelligence) ; soutien défensif
  sadida: {
    id: "sadida", nom: "Sadida", pvBase: 55,
    stats: { force: 10, intelligence: 25, agilite: 40, vitalite: 45, soin: 25, prospection: 110 },
    pa: 6, initiative: 9,
    sorts: [
      "crachat_de_seve", "deferlante", "lame_liquide", "etreinte_ronces",
      "poupee_garde", "rosee_regenerante", "vigueur_bois",
    ],
    img: "/assets/classes/sadida.png",
  }, // élément de frappe = Air (Agilité) ; contrôleur / invocateur
  sram: {
    id: "sram", nom: "Sram", pvBase: 48,
    stats: { force: 20, intelligence: 10, agilite: 55, vitalite: 38, prospection: 130 },
    pa: 6, initiative: 13,
    sorts: [
      "coupe_jarret", "dagues_insidieuses", "coup_double", "flasque_venimeuse",
      "deluge_de_lames", "mise_a_mort", "arsenic", "maitre_des_ombres",
    ],
    img: "/assets/classes/sram.png",
  }, // élément de frappe = Air (Agilité) ; DPT monocible & poisons
  feca: {
    id: "feca", nom: "Feca", pvBase: 72,
    stats: { force: 10, intelligence: 35, agilite: 15, vitalite: 60, prospection: 90 },
    pa: 6, initiative: 7,
    sorts: [
      "attaque_celeste", "glyphe_naturel", "ouragan", "onde",
      "glyphe_stimulant", "baton_du_berger", "armures", "provocation",
    ],
    img: "/assets/classes/feca.png",
  }, // élément de frappe = Feu (Intelligence) ; tank / support défensif
  ecaflip: {
    id: "ecaflip", nom: "Ecaflip", pvBase: 58,
    stats: { force: 35, intelligence: 20, agilite: 25, chance: 25, vitalite: 45, prospection: 120 },
    pa: 6, initiative: 10,
    sorts: [
      "pelote_chaude", "pattounes", "all_in", "langue_rapeuse",
      "tarot", "tactique_feline", "bonne_pioche", "esprit_felin",
    ],
    img: "/assets/classes/ecaflip.png",
  }, // élément de frappe = Terre (Force) ; mixte / hasard
};

// --- Monstres ----------------------------------------------------------------
// resistances : fraction par élément. 0.25 = −25 % subis ; négatif = faiblesse.
export const MONSTRES: Record<string, Monstre> = {
  // ===== Incarnam (tier 1) =====
  tofu: {
    id: "tofu", nom: "Tofu", pv: 18,
    stats: { force: 5, intelligence: 8, agilite: 25, vitalite: 15 },
    pa: 4, initiative: 14,
    resistances: { terre: -0.3 }, // faible à la Terre, rapide
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/tofu.png",
  },
  larve_bleue: {
    id: "larve_bleue", nom: "Larve Bleue", pv: 22,
    stats: { force: 16, intelligence: 5, agilite: 8, vitalite: 22 },
    pa: 3, initiative: 5,
    resistances: { feu: -0.25 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/larve_bleue.png",
  },
  arakne: {
    id: "arakne", nom: "Arakne", pv: 16,
    stats: { force: 8, intelligence: 10, agilite: 18, vitalite: 14 },
    pa: 4, initiative: 12,
    resistances: { feu: -0.2 },
    sorts: ["picotement"], ia: "agressif",
    img: "/assets/monstres/arakne.png",
  },
  moskito: {
    id: "moskito", nom: "Moskito", pv: 14,
    stats: { force: 5, intelligence: 6, agilite: 22, vitalite: 10 },
    pa: 3, initiative: 16,
    resistances: { terre: -0.2 },
    sorts: ["picotement"], ia: "agressif",
    img: "/assets/monstres/moskito.png",
  },
  tofu_malefique: {
    id: "tofu_malefique", nom: "Tofu Maléfique", pv: 40,
    stats: { force: 5, intelligence: 22, agilite: 15, vitalite: 30 },
    pa: 5, initiative: 11,
    resistances: {},
    sorts: ["soin_noir", "picotement"], ia: "soutien", // miniboss soigneur
    img: "/assets/monstres/tofu_malefique.png",
  },
  milimilou: {
    id: "milimilou", nom: "Milimilou", pv: 130,
    stats: { force: 35, intelligence: 25, agilite: 20, vitalite: 55 },
    pa: 6, initiative: 9,
    resistances: { air: -0.2, terre: 0.15, eau: 0.2, wakfu: 0.1 },
    sorts: ["charge", "morsure"], ia: "agressif",
    boss: true, dofus: "dofus_turquoise",
    img: "/assets/monstres/milimilou.png",
  },

  // ===== Champs d'Astrub (tier 2) =====
  bouftou: {
    id: "bouftou", nom: "Bouftou", pv: 35,
    stats: { force: 30, intelligence: 5, agilite: 10, vitalite: 30 },
    pa: 4, initiative: 6,
    resistances: { air: -0.3, terre: 0.15 }, // faible à l'Air
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/bouftou.png",
  },
  bouftou_noir: {
    id: "bouftou_noir", nom: "Bouftou Noir", pv: 55,
    stats: { force: 42, intelligence: 5, agilite: 10, vitalite: 42 },
    pa: 5, initiative: 7,
    resistances: { air: -0.25, terre: 0.2 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/bouftou_noir.png",
  },
  boufton_noir: {
    id: "boufton_noir", nom: "Boufton Noir", pv: 28,
    stats: { force: 20, intelligence: 5, agilite: 18, vitalite: 22 },
    pa: 4, initiative: 12,
    resistances: { air: -0.2 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/boufton_noir.png",
  },
  prespic: {
    id: "prespic", nom: "Prespic", pv: 48,
    stats: { force: 28, intelligence: 8, agilite: 12, vitalite: 42 },
    pa: 4, initiative: 8,
    resistances: { feu: 0.2, air: -0.2 }, // piquant, encaisse
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/prespic.png",
  },
  bouftou_royal: {
    id: "bouftou_royal", nom: "Bouftou Royal", pv: 95,
    stats: { force: 40, intelligence: 8, agilite: 12, vitalite: 52 },
    pa: 5, initiative: 8,
    resistances: { air: -0.2, terre: 0.2 },
    sorts: ["charge", "morsure"], ia: "agressif", // miniboss
    img: "/assets/monstres/bouftou_royal.png",
  },
  chef_de_guerre_bouftou: {
    id: "chef_de_guerre_bouftou", nom: "Chef de Guerre Bouftou", pv: 185,
    stats: { force: 48, intelligence: 10, agilite: 15, vitalite: 65 },
    pa: 6, initiative: 7,
    resistances: { air: -0.25, terre: 0.25, stasis: 0.15, eau: -0.15 }, // faible à l'Air/Eau
    sorts: ["charge", "morsure"], ia: "agressif",
    boss: true, dofus: "dofus_pourpre",
    img: "/assets/monstres/chef_de_guerre_bouftou.png",
  },

  // ===== Tainéla (tier 3) =====
  pissenlit_diabolique: {
    id: "pissenlit_diabolique", nom: "Pissenlit Diabolique", pv: 52,
    stats: { force: 10, intelligence: 35, agilite: 15, vitalite: 42 },
    pa: 5, initiative: 10,
    resistances: { terre: 0.2, air: -0.2 },
    sorts: ["picotement"], ia: "agressif",
    img: "/assets/monstres/pissenlit_diabolique.png",
  },
  boufton_blanc: {
    id: "boufton_blanc", nom: "Boufton Blanc", pv: 38,
    stats: { force: 26, intelligence: 8, agilite: 20, vitalite: 28 },
    pa: 4, initiative: 13,
    resistances: { air: -0.25 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/boufton_blanc.png",
  },
  bouftou_halouine: {
    id: "bouftou_halouine", nom: "Bouftou d'Halouine", pv: 115,
    stats: { force: 45, intelligence: 15, agilite: 15, vitalite: 58 },
    pa: 6, initiative: 8,
    resistances: { air: -0.2, feu: 0.2 },
    sorts: ["charge", "morsure"], ia: "agressif", // miniboss
    img: "/assets/monstres/bouftou_halouine.png",
  },
  tournesol_affame: {
    id: "tournesol_affame", nom: "Tournesol Affamé", pv: 205,
    stats: { force: 15, intelligence: 50, agilite: 18, vitalite: 70 },
    pa: 6, initiative: 9,
    resistances: { feu: 0.3, air: -0.2, eau: -0.25, wakfu: 0.2, stasis: 0.2 },
    sorts: ["charge", "picotement"], ia: "agressif",
    boss: true, dofus: "dofus_ocre",
    img: "/assets/monstres/tournesol_affame.png",
  },
};

// --- Dofus (reliques permanentes) --------------------------------------------
export interface DofusDef {
  id: string;
  nom: string;
  desc: string;
  bonusDegatsParCopie: number;
  img?: string;
}

// Catalogue complet des Dofus (assets DofusDB). L'ordre = ordre d'affichage.
// Seul le Pourpre a un effet en V0 ; les autres sont « à débloquer ».
const CATALOGUE_DOFUS: Array<[string, string]> = [
  // les six primordiaux d'abord
  ["dofus_pourpre", "Dofus Pourpre"], ["dofus_turquoise", "Dofus Turquoise"],
  ["dofus_emeraude", "Dofus Émeraude"], ["dofus_ocre", "Dofus Ocre"],
  ["dofus_ivoire", "Dofus Ivoire"], ["dofus_ebene", "Dofus Ébène"],
  // autres Dofus notables
  ["dofus_vulbis", "Dofus Vulbis"], ["dofus_abyssal", "Dofus Abyssal"],
  ["dofus_cawotte", "Dofus Cawotte"], ["dolmanax", "Dolmanax"],
  ["dofus_des_veilleurs", "Dofus des Veilleurs"], ["dofus_du_cauchemar", "Dofus du Cauchemar"],
  ["dofus_des_glaces", "Dofus des Glaces"], ["dofus_forgelave", "Dofus Forgelave"],
  ["dofus_kaliptus", "Dofus Kaliptus"], ["dofus_nebuleux", "Dofus Nébuleux"],
  ["dofus_sylvestre", "Dofus Sylvestre"], ["dofus_verdoyant", "Dofus Verdoyant"],
  ["dofus_tachete", "Dofus Tacheté"], ["dofus_argente", "Dofus Argenté"],
  ["dofus_argente_scintillant", "Dofus Argenté Scintillant"], ["dofus_cacao", "Dofus Cacao"],
  // Dofus fantaisistes
  ["dofawa", "Dofawa"], ["dofoozbz", "Dofoozbz"], ["dokille", "Dokille"],
  ["dokoko", "Dokoko"], ["dom_de_pin", "Dom de Pin"], ["domakuro", "Domakuro"],
  ["dorigami", "Dorigami"], ["dotruche", "Dotruche"], ["jyfus", "Jyfus"],
];

export const DOFUS: Record<string, DofusDef> = Object.fromEntries(
  CATALOGUE_DOFUS.map(([id, nom]) => [
    id,
    {
      id, nom,
      desc: id === "dofus_pourpre"
        ? "+15 % de dégâts pour toute l'équipe (cumulable)."
        : "Relique légendaire — effet à venir.",
      bonusDegatsParCopie: id === "dofus_pourpre" ? 0.15 : 0,
      img: `/assets/dofus/${id}.png`,
    },
  ]),
);

/** Dofus → nom du boss qui le lâche (dérivé des monstres `dofus`). */
export const DOFUS_DROP: Record<string, string> = Object.fromEntries(
  Object.values(MONSTRES)
    .filter((m) => m.dofus)
    .map((m) => [m.dofus as string, m.nom]),
);

// --- Composition des combats (séquence linéaire de la run) -------------------
// position : ordre dans la ligne ennemie (1 = devant). Recalculé à la mort.
export interface EnnemiPlace {
  monstre: string;
  position: number;
}
export interface CombatDef {
  nom: string;
  ennemis: EnnemiPlace[];
}

export const COMBATS: Record<string, CombatDef> = {
  // ===== Incarnam =====
  inc_1: { nom: "Tofus égarés", ennemis: [
    { monstre: "tofu", position: 0 }, { monstre: "larve_bleue", position: 1 },
  ] },
  inc_2: { nom: "Nuée d'Araknes", ennemis: [
    { monstre: "arakne", position: 0 }, { monstre: "moskito", position: 1 }, { monstre: "tofu", position: 2 },
  ] },
  inc_3: { nom: "Larves & Tofus", ennemis: [
    { monstre: "larve_bleue", position: 0 }, { monstre: "tofu", position: 1 }, { monstre: "arakne", position: 4 },
  ] },
  inc_elite: { nom: "Essaim (dur)", ennemis: [
    { monstre: "tofu", position: 0 }, { monstre: "arakne", position: 1 },
    { monstre: "moskito", position: 2 }, { monstre: "larve_bleue", position: 3 },
  ] },
  inc_boss: { nom: "Donjon — Milimilou", ennemis: [
    { monstre: "milimilou", position: 0 }, { monstre: "tofu_malefique", position: 4 }, // boss devant, soigneur protégé derrière
  ] },

  // ===== Champs d'Astrub (ids historiques, conservés) =====
  combat_1: { nom: "Bouftous des champs", ennemis: [
    { monstre: "bouftou", position: 0 }, { monstre: "boufton_noir", position: 1 },
  ] },
  combat_2: { nom: "Troupeau noir", ennemis: [
    { monstre: "bouftou", position: 0 }, { monstre: "bouftou_noir", position: 1 }, { monstre: "boufton_noir", position: 4 },
  ] },
  combat_3: { nom: "Embuscade", ennemis: [
    { monstre: "prespic", position: 0 }, { monstre: "bouftou", position: 1 }, { monstre: "boufton_noir", position: 2 },
  ] },
  combat_elite: { nom: "Harde furieuse (dur)", ennemis: [
    { monstre: "bouftou_noir", position: 0 }, { monstre: "bouftou", position: 1 },
    { monstre: "prespic", position: 2 }, { monstre: "boufton_noir", position: 3 },
  ] },
  boss: { nom: "Donjon — Chef de Guerre Bouftou", ennemis: [
    { monstre: "chef_de_guerre_bouftou", position: 0 }, { monstre: "bouftou_royal", position: 1 }, // boss + miniboss devant
  ] },

  // ===== Tainéla =====
  tai_1: { nom: "Pousses hostiles", ennemis: [
    { monstre: "boufton_blanc", position: 0 }, { monstre: "pissenlit_diabolique", position: 4 }, // plante protégée derrière
  ] },
  tai_2: { nom: "Lande empoisonnée", ennemis: [
    { monstre: "boufton_blanc", position: 0 }, { monstre: "arakne", position: 1 }, { monstre: "pissenlit_diabolique", position: 4 },
  ] },
  tai_3: { nom: "Vol nocturne", ennemis: [
    { monstre: "boufton_blanc", position: 0 }, { monstre: "moskito", position: 1 }, { monstre: "pissenlit_diabolique", position: 4 },
  ] },
  tai_elite: { nom: "Ronceraie (dur)", ennemis: [
    { monstre: "boufton_blanc", position: 0 }, { monstre: "arakne", position: 1 },
    { monstre: "pissenlit_diabolique", position: 4 }, { monstre: "pissenlit_diabolique", position: 5 }, // 2 plantes derrière
  ] },
  tai_boss: { nom: "Donjon — Tournesol Affamé", ennemis: [
    { monstre: "tournesol_affame", position: 0 }, { monstre: "bouftou_halouine", position: 1 }, // boss + miniboss devant
  ] },
};

// --- Zones (mondes traversés successivement durant une run) ------------------
export interface ZonePools { normales: string[]; elite: string[]; boss: string; }
export interface ZoneDef { id: string; nom: string; pools: ZonePools; }

export const ZONES: ZoneDef[] = [
  { id: "incarnam", nom: "Incarnam",
    pools: { normales: ["inc_1", "inc_2", "inc_3"], elite: ["inc_elite"], boss: "inc_boss" } },
  { id: "astrub", nom: "Champs d'Astrub",
    pools: { normales: ["combat_1", "combat_2", "combat_3"], elite: ["combat_elite"], boss: "boss" } },
  { id: "tainela", nom: "Tainéla",
    pools: { normales: ["tai_1", "tai_2", "tai_3"], elite: ["tai_elite"], boss: "tai_boss" } },
];

/** Récompense d'XP par type de nœud de combat (tunable). */
export const XP_PAR_TYPE = { combat: 40, combat_dur: 70 } as const;

/** Fraction de PV max rendue par la Taverne. */
export const TAVERNE_PCT = 0.5;

/** Paramètres de génération de la carte (tunable). */
export const GEN_CARTE = {
  lignesMin: 7, // bornes du nombre de rangées (départ inclus, donjon inclus)
  lignesMax: 9,
  departNoeudsMin: 2,
  departNoeudsMax: 3,
  noeudsMin: 2, // par rangée intermédiaire
  noeudsMax: 4,
  // poids des types pour les rangées intermédiaires
  poids: { combat: 60, combat_dur: 12, taverne: 12, otomai: 8, zaap: 8 } as Record<string, number>,
};

// --- Équipement & panoplies --------------------------------------------------
export const ITEMS: Record<string, Item> = {
  // ===== Panoplie de l'Aventurier (Incarnam, bas niveau, générique) =====
  aventurier_amulette: { id: "aventurier_amulette", nom: "Amulette de l'Aventurier", slot: "amulette", panoplie: "aventurier", stats: { vitalite: 10, soin: 5 } },
  aventurier_coiffe: { id: "aventurier_coiffe", nom: "Coiffe de l'Aventurier", slot: "coiffe", panoplie: "aventurier", stats: { vitalite: 12 } },
  aventurier_cape: { id: "aventurier_cape", nom: "Cape de l'Aventurier", slot: "cape", panoplie: "aventurier", stats: { agilite: 6, prospection: 20 } },
  aventurier_ceinture: { id: "aventurier_ceinture", nom: "Ceinture de l'Aventurier", slot: "ceinture", panoplie: "aventurier", stats: { force: 6 } },
  aventurier_bottes: { id: "aventurier_bottes", nom: "Bottes de l'Aventurier", slot: "bottes", panoplie: "aventurier", stats: { agilite: 8 } },
  aventurier_anneau: { id: "aventurier_anneau", nom: "Anneau de l'Aventurier", slot: "anneau", panoplie: "aventurier", stats: { vitalite: 8, force: 4 } },

  // ===== Panoplie du Bouftou (Champs d'Astrub, vita/force-Terre, plus fort) =====
  bouftou_amulette: { id: "bouftou_amulette", nom: "Amulette du Bouftou", slot: "amulette", panoplie: "bouftou", stats: { vitalite: 20, force: 8 } },
  bouftou_coiffe: { id: "bouftou_coiffe", nom: "Coiffe du Bouftou", slot: "coiffe", panoplie: "bouftou", stats: { vitalite: 25 } },
  bouftou_cape: { id: "bouftou_cape", nom: "Cape Boufton", slot: "cape", panoplie: "bouftou", stats: { force: 12, agilite: 6 } },
  bouftou_ceinture: { id: "bouftou_ceinture", nom: "Ceinture du Bouftou", slot: "ceinture", panoplie: "bouftou", stats: { force: 15 } },
  bouftou_bottes: { id: "bouftou_bottes", nom: "Bottes du Bouftou", slot: "bottes", panoplie: "bouftou", stats: { vitalite: 15, agilite: 6 } },
  bouftou_anneau: { id: "bouftou_anneau", nom: "Anneau Royal Bouftou", slot: "anneau", panoplie: "bouftou", stats: { force: 10, prospection: 30 } },
};

export const PANOPLIES: Record<string, Panoplie> = {
  aventurier: {
    id: "aventurier", nom: "Panoplie de l'Aventurier",
    pieces: ["aventurier_amulette", "aventurier_coiffe", "aventurier_cape", "aventurier_ceinture", "aventurier_bottes", "aventurier_anneau"],
    bonus: [
      { seuil: 3, stats: { vitalite: 10 } },
      { seuil: 6, stats: { vitalite: 15 }, resistances: { terre: 0.05, feu: 0.05, eau: 0.05, air: 0.05, wakfu: 0.05, stasis: 0.05 } },
    ],
  },
  bouftou: {
    id: "bouftou", nom: "Panoplie du Bouftou",
    pieces: ["bouftou_amulette", "bouftou_coiffe", "bouftou_cape", "bouftou_ceinture", "bouftou_bottes", "bouftou_anneau"],
    bonus: [
      { seuil: 3, stats: { force: 15 }, pvBonus: 20 },
      { seuil: 6, stats: { force: 30 }, resistances: { terre: 0.15 } },
    ],
  },
};

/** Panoplie qui droppe dans chaque zone (id de zone → id de panoplie). */
export const BUTIN_ZONE: Record<string, string> = {
  incarnam: "aventurier",
  astrub: "bouftou",
};

/** Taux de drop par victoire et par pièce éligible (tunable). */
export const DROP = {
  taux: { combat: 0.25, combat_dur: 0.4, donjon: 0.8 } as Record<string, number>,
  coefProspection: 0.001, // dropChance ×= 1 + min(cap, prospectionÉquipe × coef)
  capProspection: 0.75,
};
