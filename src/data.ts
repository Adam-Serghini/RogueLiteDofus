// =============================================================================
//  data.ts — Données du jeu (data-driven)
//  Classes, sorts, monstres et séquence de la run. Aucune logique ici.
// =============================================================================
import { ITEMS_TOILES, BUTIN_TOILES } from "./items_gen";
import type { Classe, Item, Monstre, Panoplie, Rarete, Spell } from "./types";

// --- Sorts -------------------------------------------------------------------
export const SORTS: Record<string, Spell> = {
  // ---- Iop : bruiser de mêlée ----
  epee_celeste: {
    id: "epee_celeste", nom: "Épée Céleste", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 14, scaling: 0.4,
    siCibleMeurt: { rebondDegatsX: 2 }, cooldownTours: 1,
    desc: "Si la cible meurt, rebondit sur un ennemi proche en infligeant le double.",
  },
  epee_divine: {
    id: "epee_divine", nom: "Épée divine", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 9, baseMax: 13, scaling: 0.35,
    vampirismeRatio: 0.3,
    desc: "Dégâts modérés ; rend 30 % des dégâts infligés en PV au lanceur.",
  },
  tempete_lames: {
    id: "tempete_lames", nom: "Tempête de lames", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 6, baseMax: 10, scaling: 0.25,
    zoneLigne: true,
    desc: "Dégâts de zone sur toute la ligne ciblée (avant ou arrière).",
  },
  fracas: {
    id: "fracas", nom: "Fracas", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 14, baseMax: 18, scaling: 0.5,
    retraitPA: 3,
    desc: "Gros dégâts ; 30 % de chance de retirer 3 PA à la cible au prochain tour.",
  },
  colere: {
    id: "colere", nom: "Colère de Iop", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 18, baseMax: 24, scaling: 0.6,
    passeTourSiSurvie: true, cooldownTours: 2,
    desc: "Très gros dégâts ; le Iop passe son prochain tour si la cible survit.",
  },
  epee_jugement: {
    id: "epee_jugement", nom: "Épée du Jugement", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 12, baseMax: 16, scaling: 0.4,
    effetLanceur: { stat: "resAll", valeur: 0.05, duree: 2 }, cooldownTours: 2,
    desc: "Dégâts modérés à élevés ; +5 % de résistances au lanceur (2t).",
  },
  duel: {
    id: "duel", nom: "Duel", type: "buff", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    provoqueTours: 2, contre: { chance: 0.2, duree: 2 }, cooldownTours: 3,
    desc: "Provoque les ennemis (2t) et prend une posture de contre : 20 % de riposte quand frappé.",
  },
  vitalite: {
    id: "vitalite", nom: "Vitalité", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effet: { stat: "vitalite", valeur: 0.2, duree: 5 }, cooldownTours: 5,
    desc: "+20 % PV max au lanceur pendant 5 tours.",
  },

  // ---- Cra : tireuse à distance ----
  fleche_corrosive: {
    id: "fleche_corrosive", nom: "Flèche corrosive", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 6, baseMax: 9, scaling: 0.25,
    rebond: { sauts: 1, bonusParSaut: 0 }, // touche les 2 premiers
    effet: { stat: "reductionDegats", valeur: -0.1, duree: 2 }, // vulnérabilité : +10 % dégâts subis
    desc: "Touche 2 ennemis (faibles dégâts) + vulnérabilité : +10 % de dégâts subis (2t).",
  },
  fleche_magique: {
    id: "fleche_magique", nom: "Flèche magique", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 9, baseMax: 13, scaling: 0.35,
    rembPA: true,
    desc: "Dégâts modérés ; faible chance (scale Chance) de rembourser le coût en PA.",
  },
  fleche_percante: {
    id: "fleche_percante", nom: "Flèche perçante", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 9, baseMax: 13, scaling: 0.4,
    rebond: { sauts: 2, bonusParSaut: 0.2 }, cooldownTours: 2,
    desc: "Touche le 1er ennemi puis rebondit 2 fois, +20 % de dégâts par saut.",
  },
  fleche_intrusive: {
    id: "fleche_intrusive", nom: "Flèche intrusive", type: "degats", coutPA: 3,
    cible: "ennemi_tous", baseMin: 5, baseMax: 7, scaling: 0.2,
    ignoreResistances: true, ignoreBouclier: true,
    desc: "Frappe n'importe quel ennemi (même l'arrière) ; ignore résistances et bouclier.",
  },
  fleche_explosive: {
    id: "fleche_explosive", nom: "Flèche Explosive", type: "degats", coutPA: 5,
    cible: "ennemi_ligne", baseMin: 12, baseMax: 16, scaling: 0.4,
    rebond: { sauts: 2, bonusParSaut: 0 }, // zone de 3 max
    poison: { degats: 6, duree: 2 }, // brûlure (DoT feu)
    cooldownTours: 2,
    desc: "Gros dégâts de zone (3 max) + brûlure sur chaque cible (6/t, 2t).",
  },
  tir_puissant: {
    id: "tir_puissant", nom: "Tir Puissant", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    doubleEffetProchain: true, cooldownTours: 2,
    desc: "Double la durée de l'effet de la prochaine flèche.",
  },
  maitrise_arc: {
    id: "maitrise_arc", nom: "Maîtrise de l'arc", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    maitriseArc: { principal: 10, secondaire: 5, duree: 3 }, cooldownTours: 4,
    desc: "+10 à l'élément de frappe et +5 au 2ᵉ pendant 3 tours.",
  },
  oeil_affute: {
    id: "oeil_affute", nom: "Œil affûté", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effet: { stat: "maxRoll", valeur: 2, duree: 99 }, cooldownTours: 3,
    desc: "Les 2 prochains sorts offensifs tapent au maximum de leur fourchette.",
  },

  // ---- Eniripsa : soutien défensif ----
  mot_interdit: {
    id: "mot_interdit", nom: "Mot interdit", type: "degats", coutPA: 5,
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
  mot_alternatif: {
    id: "mot_alternatif", nom: "Mot Alternatif", type: "degats", coutPA: 3,
    cible: "mixte", baseMin: 6, baseMax: 9, scaling: 0.25,
    mixte: { surAllie: { soin: { min: 14, max: 20 } } },
    desc: "Allié : soin modéré. Ennemi : dégâts faibles.",
  },
  mot_reconstitution: {
    id: "mot_reconstitution", nom: "Mot de reconstitution", type: "soin", coutPA: 6,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    soinComplet: true, cooldownTours: 4,
    desc: "Soigne entièrement un allié.",
  },
  mot_revitalisant: {
    id: "mot_revitalisant", nom: "Mot revitalisant", type: "soin", coutPA: 2,
    cible: "allie_tous", baseMin: 8, baseMax: 12, scaling: 0, cooldownTours: 2,
    desc: "Soin faible sur toute l'équipe (un tour sur deux).",
  },
  mot_prevention: {
    id: "mot_prevention", nom: "Mot de prévention", type: "buff", coutPA: 3,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    bouclierPct: 0.15, hotPct: 0.05, hotDuree: 3, cooldownTours: 2,
    desc: "Bouclier (15 % PV) + soin sur la durée (5 % vita / 3t).",
  },
  mot_jouvence: {
    id: "mot_jouvence", nom: "Mot de jouvence", type: "buff", coutPA: 2,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    dissipe: true, hotPct: 0.05, hotDuree: 2,
    desc: "Dissipe les effets négatifs + soin sur la durée (5 % vita / 2t).",
  },
  mot_stimulant: {
    id: "mot_stimulant", nom: "Mot stimulant", type: "buff", coutPA: 2,
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
  attaque_ombre: {
    id: "attaque_ombre", nom: "Attaque d'ombre", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 14, baseMax: 20, scaling: 0.5,
    poison: { degats: 6, duree: 2 },
    desc: "Dégâts élevés + poison (2t).",
  },
  mise_a_mort: {
    id: "mise_a_mort", nom: "Mise à mort", type: "degats", coutPA: 6,
    cible: "ennemi_tous", baseMin: 32, baseMax: 46, scaling: 0.7,
    executeSeulement: true, cooldownTours: 3,
    desc: "Très lourds dégâts — échoue si la cible n'en meurt pas.",
  },
  coup_insidieux: {
    id: "coup_insidieux", nom: "Coup Insidieux", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    poison: { degats: 5, duree: 2 },
    desc: "Dégâts modérés + poison (2t).",
  },
  flasque_empoisonnee: {
    id: "flasque_empoisonnee", nom: "Flasque empoisonnée", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 3, baseMax: 6, scaling: 0.15,
    rebond: { sauts: 2, bonusParSaut: 0 },
    poison: { degats: 5, duree: 3 }, cooldownTours: 2,
    desc: "Poison (3t) sur 3 cibles.",
  },
  deluge_lames: {
    id: "deluge_lames", nom: "Déluge de lames", type: "degats", coutPA: 5,
    cible: "ennemi_tous", baseMin: 0, baseMax: 0, scaling: 0,
    projectiles: { nb: 10, baseMin: 1, baseMax: 3, scaling: 0.05, pProc: 0.2, poison: { degats: 3, duree: 1 } },
    cooldownTours: 1,
    desc: "10 lames sur des ennemis au hasard ; 20 % de poison (1t) par lame.",
  },
  coup_sournois: {
    id: "coup_sournois", nom: "Coup sournois", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 0, baseMax: 0, scaling: 0,
    coups: [
      { baseMin: 8, baseMax: 12, scaling: 0.3, proc: { p: 0.3, poison: { degats: 5, duree: 2 } } },
      { baseMin: 4, baseMax: 7, scaling: 0.15, proc: { p: 0.3, friction: 2 } },
    ],
    cooldownTours: 1,
    desc: "2 coups ; 30 % poison au 1er, 30 % friction (anti-soin/bouclier) au 2nd.",
  },
  invisibilite: {
    id: "invisibilite", nom: "Invisibilité", type: "buff", coutPA: 3,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effets: [{ stat: "esquive", valeur: 0.25, duree: 3 }],
    effetParNiveau: { stat: "agilite", base: 15, parNiveau: 0.5, duree: 2 }, cooldownTours: 3,
    desc: "+25 % d'esquive (3t) et boost d'Agilité (15 + 0,5/niv, 2t).",
  },
  expert_poisons: {
    id: "expert_poisons", nom: "Expert des poisons", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    poisonAmpli: 2, cooldownTours: 2,
    desc: "Double les dégâts des poisons appliqués pendant 2 tours.",
  },

  // ---- Feca (support défensif) ----
  attaque_naturelle: {
    id: "attaque_naturelle", nom: "Attaque Naturelle", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 8, baseMax: 12, scaling: 0.3,
    bouclierRatioDegats: 0.2,
    desc: "Dégâts modérés ; bouclier = 20 % des dégâts infligés.",
  },
  glyphe_agressif: {
    id: "glyphe_agressif", nom: "Glyphe Agressif", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 4, baseMax: 7, scaling: 0.2,
    rebond: { sauts: 2, bonusParSaut: 0 },
    effet: { stat: "degatsInfliges", valeur: -0.1, duree: 2 }, cooldownTours: 3,
    desc: "3 ennemis : dégâts faibles + −10 % de dégâts infligés (2t).",
  },
  glyphe_stimulant: {
    id: "glyphe_stimulant", nom: "Glyphe Stimulant", type: "buff", coutPA: 3,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    nbCibles: 2,
    effetParNiveau: { stat: "degatsInfliges", base: 0.1, parNiveau: 0.01, duree: 2 }, cooldownTours: 2,
    desc: "+10 % de dégâts finaux (+0,01/niv) à 2 alliés (2t).",
  },
  attaque_nuageuse: {
    id: "attaque_nuageuse", nom: "Attaque nuageuse", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 15, scaling: 0.4,
    rebond: { sauts: 2, bonusParSaut: 0 },
    effet: { stat: "echecCritique", valeur: 0.05, duree: 2 }, cooldownTours: 1,
    desc: "3 ennemis : dégâts modérés + déstabilise (+5 % d'échec critique, 2t).",
  },
  bulle: {
    id: "bulle", nom: "Bulle", type: "degats", coutPA: 2,
    cible: "mixte", baseMin: 4, baseMax: 7, scaling: 0.2,
    mixte: { surAllie: { bouclierPct: 0.03 } },
    desc: "Ennemi : dégâts faibles. Allié : bouclier (3 % PV max).",
  },
  baton_du_berger: {
    id: "baton_du_berger", nom: "Bâton du berger", type: "buff", coutPA: 4,
    cible: "allie", baseMin: 0, baseMax: 0, scaling: 0,
    effet: { stat: "reductionDegats", valeur: 0.5, duree: 1 }, cooldownTours: 3,
    desc: "Un allié reçoit −50 % de dégâts pendant 1 tour.",
  },
  provocation: {
    id: "provocation", nom: "Provocation", type: "buff", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    provoqueTours: 1, cooldownTours: 3,
    desc: "Le Feca provoque les ennemis pendant 1 tour.",
  },
  armures: {
    id: "armures", nom: "Armures", type: "buff", coutPA: 2,
    cible: "allie_tous", baseMin: 0, baseMax: 0, scaling: 0,
    effetParNiveau: { stat: "armure", base: 2, parNiveau: 0.5, duree: 3 }, cooldownTours: 4,
    desc: "Réduit les dégâts subis de l'équipe (2 + 0,5/niv plats, 3t).",
  },

  // ---- Ecaflip (mixte / hasard) ----
  des_double: {
    id: "des_double", nom: "Dès double", type: "degats", coutPA: 3,
    cible: "mixte", baseMin: 5, baseMax: 9, scaling: 0.25,
    rebond: { sauts: 2, bonusParSaut: 0 },
    mixte: { surAllie: { effet: { stat: "degatsInfliges", valeur: 0.05, duree: 2 }, nonCumulable: true } },
    desc: "Ennemi : rebondit sur 3 cibles. Allié : +5 % de dégâts finaux (non cumulable).",
  },
  tarot: {
    id: "tarot", nom: "Tarot", type: "degats", coutPA: 6,
    cible: "mixte", baseMin: 12, baseMax: 20, scaling: 0.5,
    tarot: true, cooldownTours: 2,
    desc: "Tire une carte : effet variable selon la couleur (ennemi ou allié).",
  },
  all_in: {
    id: "all_in", nom: "All in", type: "degats", coutPA: 2,
    cible: "ennemi_ligne", baseMin: 6, baseMax: 10, scaling: 0.3,
    de: { faces: 6, multMin: 0.3, multMax: 2.5 },
    desc: "Mise au dé : dégâts de très faibles à très élevés selon le tirage.",
  },
  griffe_joueuse: {
    id: "griffe_joueuse", nom: "Griffe joueuse", type: "degats", coutPA: 3,
    cible: "ennemi_ligne", baseMin: 9, baseMax: 13, scaling: 0.35,
    vampirismeRatio: 0.3, cooldownTours: 2,
    desc: "Dégâts modérés ; rend 30 % des dégâts infligés en PV au lanceur.",
  },
  langue_rapeuse: {
    id: "langue_rapeuse", nom: "Langue râpeuse", type: "degats", coutPA: 4,
    cible: "ennemi_ligne", baseMin: 10, baseMax: 14, scaling: 0.4,
    procAleatoire: [
      { dissipePositifs: true },
      { effet: { stat: "friction", valeur: 1, duree: 2 } },
      { effet: { stat: "echecCritique", valeur: 0.1, duree: 2 } },
    ],
    cooldownTours: 1,
    desc: "Dégâts modérés + 1 effet aléatoire : désenvoûte / friction / +10 % d'échec critique.",
  },
  odorat: {
    id: "odorat", nom: "Odorat", type: "buff", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    paGainAdjacents: 1, cooldownTours: 3,
    desc: "+1 PA aux alliés des cases adjacentes (prochain tour).",
  },
  perception: {
    id: "perception", nom: "Perception", type: "buff", coutPA: 2,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    effets: [
      { stat: "force", valeur: 5, duree: 2 },
      { stat: "intelligence", valeur: 5, duree: 2 },
      { stat: "agilite", valeur: 5, duree: 2 },
      { stat: "chance", valeur: 5, duree: 2 },
    ],
    cooldownTours: 4,
    desc: "+5 à toutes les caractéristiques pendant 2 tours.",
  },
  esprit_felin: {
    id: "esprit_felin", nom: "Esprit félin", type: "buff", coutPA: 4,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    espritFelin: true, cooldownTours: 2,
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
    cible: "ennemi_ligne", baseMin: 26, baseMax: 36, scaling: 0.72,
    desc: "Attaque dévastatrice du boss.",
  },
  ecrasement: {
    id: "ecrasement", nom: "Écrasement", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 20, baseMax: 28, scaling: 0.55, zoneLigne: true,
    cooldownTours: 2,
    desc: "Piétine toute la ligne avant adverse (le soin de zone ne suit plus).",
  },

  // ---- Sorts SIGNATURES des boss (1 par boss, en plus du kit standard) ----
  // Placés en tête de la liste `sorts` du boss : à coût PA égal, l'IA agressive
  // les joue en priorité dès que leur cooldown le permet.
  etreinte_glaciale: {
    id: "etreinte_glaciale", nom: "Étreinte glaciale", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 18, baseMax: 24, scaling: 0.5, zoneLigne: true,
    effet: { stat: "initiative", valeur: -6, duree: 2 }, cooldownTours: 3,
    desc: "Kardorim — glace toute la ligne avant : dégâts + initiative réduite (2t).",
  },
  racines_voraces: {
    id: "racines_voraces", nom: "Racines voraces", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 18, baseMax: 24, scaling: 0.5,
    soinEquipeRatio: 1.0, cooldownTours: 3,
    desc: "Tournesol Affamé — draine la cible et rend les dégâts en PV à tout son camp.",
  },
  colere_royale: {
    id: "colere_royale", nom: "Colère royale", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 14, baseMax: 20, scaling: 0.45,
    effetLanceur: { stat: "force", valeur: 15, duree: 99 }, cooldownTours: 2,
    desc: "Bouftou Royal — frappe et entre en rage : +15 Force cumulable jusqu'à la fin du combat.",
  },
  pique_fulgurant: {
    id: "pique_fulgurant", nom: "Piqué fulgurant", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 26, baseMax: 34, scaling: 0.6,
    effetLanceur: { stat: "esquive", valeur: 0.25, duree: 2 }, cooldownTours: 3,
    desc: "Batofu — plonge sur sa proie puis vole en zigzag : +25 % d'esquive (2t).",
  },
  carapace_doree: {
    id: "carapace_doree", nom: "Carapace dorée", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 16, baseMax: 22, scaling: 0.45,
    bouclierRatioDegats: 1.0, cooldownTours: 3,
    desc: "Scarabosse Doré — charge cornée : gagne un bouclier de 100 % des dégâts infligés.",
  },
  machoire_du_coffre: {
    id: "machoire_du_coffre", nom: "Mâchoire du coffre", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 26, baseMax: 34, scaling: 0.6,
    effetLanceur: { stat: "resAll", valeur: 0.3, duree: 1 }, cooldownTours: 2,
    desc: "Coffre des Forgerons — happe violemment puis se referme : +30 % de résistances (1t).",
  },
  rostre_broyeur: {
    id: "rostre_broyeur", nom: "Rostre broyeur", type: "degats", coutPA: 6,
    cible: "ennemi_ligne", baseMin: 24, baseMax: 32, scaling: 0.55,
    effet: { stat: "degatsInfliges", valeur: -0.15, duree: 1 }, cooldownTours: 3,
    desc: "Corailleur Magistral — broie la ligne avant : la cible inflige −15 % de dégâts (1t).",
  },
  sfvc: {
    id: "sfvc", nom: "Sfvc%$*R ?!", type: "invocation", coutPA: 6,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    invoqueMonstre: { pool: ["pyrasite", "ceglumen", "cafarcher", "mirgrillon"], max: 2 },
    cooldownTours: 3,
    desc: "Kankreblath — borborygme imprévisible : invoque un monstre aléatoire de la zone (2 max).",
  },
  enfer_des_zombies: {
    id: "enfer_des_zombies", nom: "L'Enfer des Zombies", type: "invocation", coutPA: 6,
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    ressuscite: { pvPct: 0.5 },
    cooldownTours: 3,
    desc: "Boostache — réinvoque un monstre vaincu à 50 % de ses PV.",
  },
  ponte_larvaire: {
    id: "ponte_larvaire", nom: "Ponte larvaire", type: "invocation", coutPA: 2, // laisse 4 PA pour frapper le même tour
    cible: "soi", baseMin: 0, baseMax: 0, scaling: 0,
    invoqueMonstre: { pool: ["larve_bleue", "larve_verte", "larve_orange"], max: 1 },
    cooldownTours: 3,
    desc: "Shin Larve — pond une larve (Bleue, Verte ou Orange, 1 à la fois).",
  },
};

// --- Classes jouables --------------------------------------------------------
export const CLASSES: Record<string, Classe> = {
  iop: {
    id: "iop", nom: "Iop", pvBase: 60,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, prospection: 100 },
    pa: 6, initiative: 8,
    sorts: ["epee_celeste", "epee_divine", "tempete_lames", "fracas", "colere", "epee_jugement", "duel", "vitalite"],
    img: "/assets/classes/iop.png",
  }, // stats de build à 0 : le joueur choisit son élément/build au level-up
  cra: {
    id: "cra", nom: "Cra", pvBase: 45,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, prospection: 100 },
    pa: 6, initiative: 12,
    sorts: ["fleche_corrosive", "fleche_magique", "fleche_percante", "fleche_intrusive", "fleche_explosive", "tir_puissant", "maitrise_arc", "oeil_affute"],
    img: "/assets/classes/cra.png", // PNG transparent (meilleur rendu sur la carte)
  },
  eniripsa: {
    id: "eniripsa", nom: "Eniripsa", pvBase: 50,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, soin: 20, prospection: 100 },
    pa: 6, initiative: 11,
    sorts: [
      "mot_interdit", "mot_vampirique", "mot_alternatif", "mot_reconstitution",
      "mot_revitalisant", "mot_prevention", "mot_jouvence", "mot_stimulant",
    ],
    img: "/assets/classes/eniripsa.png",
  }, // élément de frappe = Feu (Intelligence) ; soutien défensif
  sadida: {
    id: "sadida", nom: "Sadida", pvBase: 55,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, prospection: 100 },
    pa: 6, initiative: 9,
    sorts: [
      "crachat_de_seve", "deferlante", "lame_liquide", "etreinte_ronces",
      "poupee_garde", "rosee_regenerante", "vigueur_bois",
    ],
    img: "/assets/classes/sadida.png",
  }, // élément de frappe = Air (Agilité) ; contrôleur / invocateur
  sram: {
    id: "sram", nom: "Sram", pvBase: 48,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, prospection: 100 },
    pa: 6, initiative: 13,
    sorts: [
      "attaque_ombre", "coup_insidieux", "coup_sournois", "flasque_empoisonnee",
      "deluge_lames", "mise_a_mort", "expert_poisons", "invisibilite",
    ],
    img: "/assets/classes/sram.png",
  }, // élément de frappe = Air (Agilité) ; DPT monocible & poisons
  feca: {
    id: "feca", nom: "Feca", pvBase: 72,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, prospection: 100 },
    pa: 6, initiative: 7,
    sorts: [
      "attaque_naturelle", "glyphe_agressif", "glyphe_stimulant", "attaque_nuageuse",
      "bulle", "baton_du_berger", "provocation", "armures",
    ],
    img: "/assets/classes/feca.png",
  }, // élément de frappe = Feu (Intelligence) ; tank / support défensif
  ecaflip: {
    id: "ecaflip", nom: "Ecaflip", pvBase: 58,
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, prospection: 100 },
    pa: 6, initiative: 10,
    sorts: [
      "des_double", "tarot", "all_in", "griffe_joueuse",
      "langue_rapeuse", "odorat", "perception", "esprit_felin",
    ],
    img: "/assets/classes/ecaflip.png",
  }, // élément de frappe = Terre (Force) ; mixte / hasard
};

// --- Monstres ----------------------------------------------------------------
// resistances : fraction par élément. 0.25 = −25 % subis ; négatif = faiblesse.
// Stats/PV en échelle « jeu » (PV joueur gonflés) ; résistances inspirées de
// DofusDB (signe/élément réels, ÷100). archiNom = vrai nom d'Archimonstre.
export const MONSTRES: Record<string, Monstre> = {
  // ===== Incarnam — Crypte de Kardorim (tier 1, morts-vivants) =====
  // Les Chafers de la crypte n'ont pas d'Archimonstre dans Dofus → non capturables.
  chafer_debutant: {
    id: "chafer_debutant", nom: "Chafer Débutant", pv: 16,
    stats: { force: 16, intelligence: 4, agilite: 6, vitalite: 12 },
    pa: 4, initiative: 7,
    resistances: { feu: -0.2 }, // morts-vivants : brûlent
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/chafer_debutant.png",
  },
  chafer_eclaireur: {
    id: "chafer_eclaireur", nom: "Chafer Éclaireur", pv: 15,
    stats: { force: 4, intelligence: 18, agilite: 10, vitalite: 11 },
    pa: 5, initiative: 11,
    resistances: { terre: 0.1, feu: -0.15 },
    sorts: ["picotement"], ia: "agressif", // tireur
    img: "/assets/monstres/chafer_eclaireur.png",
  },
  chafer_furtif: {
    id: "chafer_furtif", nom: "Chafer Furtif", pv: 17,
    stats: { force: 8, intelligence: 4, agilite: 22, vitalite: 12 },
    pa: 5, initiative: 13,
    resistances: { air: 0.1, feu: -0.15 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/chafer_furtif.png",
  },
  chafer_piquier: {
    id: "chafer_piquier", nom: "Chafer Piquier", pv: 22,
    stats: { force: 20, intelligence: 5, agilite: 8, vitalite: 16 },
    pa: 5, initiative: 8,
    resistances: { eau: 0.1, feu: -0.15 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/chafer_piquier.png",
  },
  sergent_chafer: {
    id: "sergent_chafer", nom: "Sergent Chafer", pv: 48,
    stats: { force: 28, intelligence: 24, agilite: 12, vitalite: 30 },
    pa: 6, initiative: 9,
    resistances: { feu: 0.1 },
    sorts: ["soin_noir", "picotement"], ia: "soutien", // miniboss : soigne ses Chafers
    img: "/assets/monstres/sergent_chafer.png",
  },
  kardorim: {
    id: "kardorim", nom: "Kardorim", pv: 165,
    stats: { force: 18, intelligence: 27, agilite: 12, vitalite: 55 },
    pa: 10, initiative: 9,
    resistances: { feu: 0.25, air: 0.1, terre: -0.2, eau: -0.15 },
    sorts: ["etreinte_glaciale", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, dofus: "dofawa",
    img: "/assets/monstres/kardorim.png",
  },

  // ===== Champs d'Astrub — fleurs (tier 2) =====
  tournesol_sauvage: {
    id: "tournesol_sauvage", nom: "Tournesol Sauvage", pv: 42,
    stats: { force: 12, intelligence: 34, agilite: 14, vitalite: 36 },
    pa: 5, initiative: 10,
    resistances: { eau: 0.1, terre: 0.05, feu: -0.1, air: -0.15 },
    sorts: ["picotement"], ia: "agressif",
    archiNom: "Tour le Vice",
    img: "/assets/monstres/tournesol_sauvage.png",
  },
  rose_demoniaque: {
    id: "rose_demoniaque", nom: "Rose Démoniaque", pv: 44,
    stats: { force: 14, intelligence: 36, agilite: 16, vitalite: 34 },
    pa: 5, initiative: 11,
    resistances: { feu: 0.3, air: 0.05, terre: -0.2, eau: -0.1 },
    sorts: ["picotement"], ia: "agressif",
    archiNom: "Roz la Magicienne",
    img: "/assets/monstres/rose_demoniaque.png",
  },
  pissenlit_diabolique: {
    id: "pissenlit_diabolique", nom: "Pissenlit Diabolique", pv: 46,
    stats: { force: 12, intelligence: 32, agilite: 18, vitalite: 38 },
    pa: 5, initiative: 10,
    resistances: { terre: 0.15, air: 0.1, feu: -0.1 },
    sorts: ["picotement"], ia: "agressif",
    archiNom: "Pissdane l'Insipide",
    img: "/assets/monstres/pissenlit_diabolique.png",
  },
  epouvanteur: {
    id: "epouvanteur", nom: "Épouvanteur", pv: 60,
    stats: { force: 34, intelligence: 8, agilite: 12, vitalite: 46 },
    pa: 5, initiative: 8,
    resistances: { eau: 0.1, air: 0.05, feu: -0.1 },
    sorts: ["morsure"], ia: "agressif", // épouvantail de mêlée, encaisse
    img: "/assets/monstres/epouvanteur.png",
  },
  gardienne_champetre: {
    id: "gardienne_champetre", nom: "Gardienne Champêtre", pv: 95,
    stats: { force: 18, intelligence: 30, agilite: 28, vitalite: 50 },
    pa: 6, initiative: 11,
    resistances: { air: 0.2, eau: 0.15, terre: -0.1, feu: -0.15 },
    sorts: ["soin_noir", "picotement"], ia: "soutien", // miniboss : soigne les fleurs
    img: "/assets/monstres/gardienne_champetre.png",
  },
  tournesol_affame: {
    id: "tournesol_affame", nom: "Tournesol Affamé", pv: 265,
    stats: { force: 12, intelligence: 40, agilite: 11, vitalite: 75 },
    pa: 10, initiative: 9,
    resistances: { terre: 0.25, feu: 0.25, eau: -0.1, air: -0.15 },
    sorts: ["racines_voraces", "ecrasement", "charge", "picotement"], ia: "agressif",
    boss: true, // pas de Dofus pour l'instant (réservé pour plus tard)
    img: "/assets/monstres/tournesol_affame.png",
  },

  // ===== Tainéla — Donjon Bouftou (tier 3) =====
  // Iconique : toute la famille est faible à l'Air.
  bouftou: {
    id: "bouftou", nom: "Bouftou", pv: 45,
    stats: { force: 32, intelligence: 6, agilite: 14, vitalite: 36 },
    pa: 4, initiative: 7,
    resistances: { air: -0.3, eau: 0.05, terre: 0.1, feu: -0.1 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Boufdégou le Refoulant",
    img: "/assets/monstres/bouftou.png",
  },
  boufton_blanc: {
    id: "boufton_blanc", nom: "Boufton Blanc", pv: 40,
    stats: { force: 24, intelligence: 8, agilite: 24, vitalite: 30 },
    pa: 4, initiative: 13,
    resistances: { terre: 0.15, air: 0.1, eau: -0.15, feu: -0.1 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Boudalf le Blanc",
    img: "/assets/monstres/boufton_blanc.png",
  },
  boufton_noir: {
    id: "boufton_noir", nom: "Boufton Noir", pv: 42,
    stats: { force: 30, intelligence: 8, agilite: 16, vitalite: 30 },
    pa: 4, initiative: 11,
    resistances: { eau: 0.15, feu: 0.1, terre: -0.15, air: -0.1 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Boulgourvil le Lointain",
    img: "/assets/monstres/boufton_noir.png",
  },
  bouftou_noir: {
    id: "bouftou_noir", nom: "Bouftou Noir", pv: 60,
    stats: { force: 44, intelligence: 6, agilite: 12, vitalite: 46 },
    pa: 5, initiative: 7,
    resistances: { feu: 0.15, eau: 0.1, terre: -0.1, air: -0.15 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/bouftou_noir.png",
  },
  chef_de_guerre_bouftou: {
    id: "chef_de_guerre_bouftou", nom: "Chef de Guerre Bouftou", pv: 150,
    stats: { force: 50, intelligence: 12, agilite: 18, vitalite: 64 },
    pa: 6, initiative: 8,
    resistances: { air: 0.1, terre: 0.1, eau: -0.1 },
    sorts: ["charge", "morsure"], ia: "agressif", // miniboss
    archiNom: "Bouflet le Puéril",
    img: "/assets/monstres/chef_de_guerre_bouftou.png",
  },
  bouftou_royal: {
    id: "bouftou_royal", nom: "Bouftou Royal", pv: 340,
    stats: { force: 47, intelligence: 9, agilite: 12, vitalite: 80 },
    pa: 10, initiative: 8,
    resistances: { eau: 0.25, terre: 0.2, feu: 0.2, air: 0.05 },
    sorts: ["colere_royale", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, dofus: "dofus_argente",
    img: "/assets/monstres/bouftou_royal.png",
  },

  // ===== Donjon des Tofus (tier 4, après Tainéla) =====
  // Iconique : essaim volant, attaquants Air (agilité dominante) ;
  // le gros du groupe est faible au Feu (sauf le Tofu de base, weak Terre/Air).
  tofu: {
    id: "tofu", nom: "Tofu", pv: 50,
    stats: { force: 6, intelligence: 6, agilite: 32, vitalite: 42 },
    pa: 4, initiative: 12,
    resistances: { feu: 0.15, eau: 0.1, terre: -0.1, air: -0.1 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Tofuldebeu l'Explosif",
    img: "/assets/monstres/tofu.png",
  },
  tofu_noir: {
    id: "tofu_noir", nom: "Tofu Noir", pv: 55,
    stats: { force: 8, intelligence: 6, agilite: 34, vitalite: 46 },
    pa: 4, initiative: 13,
    resistances: { eau: 0.15, air: 0.15, terre: 0.1, feu: -0.15 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/tofu_noir.png",
  },
  tofukaz: {
    id: "tofukaz", nom: "Tofukaz", pv: 48,
    stats: { force: 6, intelligence: 6, agilite: 40, vitalite: 38 },
    pa: 5, initiative: 16, // rapide et fragile
    resistances: { terre: 0.25, air: 0.1, eau: -0.1, feu: -0.15 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/tofukaz.png",
  },
  tofoune: {
    id: "tofoune", nom: "Tofoune", pv: 50,
    stats: { force: 6, intelligence: 8, agilite: 12, chance: 30, vitalite: 42 }, // frappe Eau (piaillarde)
    pa: 4, initiative: 11,
    resistances: { eau: 0.15, air: 0.1, terre: -0.1 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/tofoune.png",
  },
  tofu_mutant: {
    id: "tofu_mutant", nom: "Tofu Mutant", pv: 88,
    stats: { force: 12, intelligence: 8, agilite: 33, vitalite: 62 }, // élite du donjon
    pa: 5, initiative: 12,
    resistances: { eau: 0.2, terre: 0.15, air: -0.15, feu: -0.2 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/tofu_mutant.png",
  },
  tofu_malefique: {
    id: "tofu_malefique", nom: "Tofu Maléfique", pv: 88,
    stats: { force: 12, intelligence: 8, agilite: 33, vitalite: 62 }, // vit à la Maison Fantôme (pas au Donjon des Tofus)
    pa: 5, initiative: 12,
    resistances: { eau: 0.2, terre: 0.15, air: -0.15, feu: -0.2 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Tofumanchou l'Empereur",
    img: "/assets/monstres/tofu_malefique.png",
  },
  tofu_ventripotent: {
    id: "tofu_ventripotent", nom: "Tofu Ventripotent", pv: 175,
    stats: { force: 14, intelligence: 10, agilite: 30, vitalite: 96 },
    pa: 5, initiative: 6, // miniboss encaisseur
    resistances: { air: 0.2, feu: 0.15, eau: 0.1, terre: -0.2 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/tofu_ventripotent.png",
  },
  batofu: {
    id: "batofu", nom: "Batofu", pv: 480,
    stats: { force: 5, intelligence: 6, agilite: 49, vitalite: 110 },
    pa: 10, initiative: 11,
    resistances: { air: 0.25, terre: 0.1, eau: -0.05, feu: -0.15 },
    sorts: ["pique_fulgurant", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus pour l'instant (réservé pour plus tard)
    img: "/assets/monstres/batofu.png",
  },

  // ===== Donjon des Scarafeuilles (tier 5, après les Tofus) =====
  // Puzzle élémentaire : chaque couleur RÉSISTE fort à un élément et est FAIBLE
  // à un autre, et frappe dans son propre élément. Une équipe mono-élément bute
  // → récompense le multi-élément. (résist. fortes mais non totales : pas d'immunité)
  scarafeuille_rouge: {
    id: "scarafeuille_rouge", nom: "Scarafeuille Rouge", pv: 60,
    stats: { force: 6, intelligence: 34, agilite: 8, vitalite: 48 }, // frappe Feu
    pa: 5, initiative: 10,
    resistances: { feu: 0.5, eau: -0.4 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Scarouarze l'Epopée",
    img: "/assets/monstres/scarafeuille_rouge.png",
  },
  scarafeuille_bleu: {
    id: "scarafeuille_bleu", nom: "Scarafeuille Bleu", pv: 60,
    stats: { force: 6, intelligence: 6, agilite: 8, chance: 34, vitalite: 48 }, // frappe Eau
    pa: 5, initiative: 10,
    resistances: { eau: 0.5, feu: -0.4 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Scarfayss le Balafré",
    img: "/assets/monstres/scarafeuille_bleu.png",
  },
  scarafeuille_vert: {
    id: "scarafeuille_vert", nom: "Scarafeuille Vert", pv: 60,
    stats: { force: 34, intelligence: 6, agilite: 8, vitalite: 48 }, // frappe Terre
    pa: 5, initiative: 10,
    resistances: { terre: 0.5, air: -0.4 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Scaramel le Fondant",
    img: "/assets/monstres/scarafeuille_vert.png",
  },
  scarafeuille_blanc: {
    id: "scarafeuille_blanc", nom: "Scarafeuille Blanc", pv: 60,
    stats: { force: 6, intelligence: 6, agilite: 34, vitalite: 48 }, // frappe Air
    pa: 5, initiative: 11,
    resistances: { air: 0.5, terre: -0.4 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Scapé l'Epée",
    img: "/assets/monstres/scarafeuille_blanc.png",
  },
  scarafeuille_immature: {
    id: "scarafeuille_immature", nom: "Scarafeuille Immature", pv: 42,
    stats: { force: 22, intelligence: 4, agilite: 4, vitalite: 34 }, // faible partout sauf Terre
    pa: 4, initiative: 8,
    resistances: { terre: 0.5, feu: -0.15, eau: -0.15, air: -0.15 },
    sorts: ["picotement"], ia: "agressif",
    img: "/assets/monstres/scarafeuille_immature.png",
  },
  scarafeuille_noir: {
    id: "scarafeuille_noir", nom: "Scarafeuille Noir", pv: 90,
    stats: { force: 30, intelligence: 12, agilite: 12, vitalite: 60 }, // encaisseur équilibré (élite/miniboss)
    pa: 5, initiative: 9,
    resistances: { terre: 0.15, feu: 0.15, eau: 0.15, air: 0.15 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/scarafeuille_noir.png",
  },
  scarabosse_dore: {
    id: "scarabosse_dore", nom: "Scarabosse Doré", pv: 640,
    stats: { force: 41, intelligence: 11, agilite: 12, chance: 11, vitalite: 132 },
    pa: 10, initiative: 10,
    resistances: { terre: 0.2, feu: 0.2, eau: 0.2, air: 0.2 }, // résiste tout : il faut le user
    sorts: ["carapace_doree", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus pour l'instant (réservé pour plus tard)
    img: "/assets/monstres/scarabosse_dore.png",
  },

  // ===== Donjon des Forgerons (tier 6, après les Scarafeuilles) =====
  // Le clan des Sombres (artisans maléfiques) + un bandit, gardant un coffre piégé.
  mineur_sombre: {
    id: "mineur_sombre", nom: "Mineur Sombre", pv: 60,
    stats: { force: 10, intelligence: 6, agilite: 34, vitalite: 52 }, // frappe Air (vif)
    pa: 5, initiative: 10,
    resistances: { terre: 0.15, air: 0.1 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Minsinistre l'Elu",
    img: "/assets/monstres/mineur_sombre.png",
  },
  boulanger_sombre: {
    id: "boulanger_sombre", nom: "Boulanger Sombre", pv: 55,
    stats: { force: 8, intelligence: 34, agilite: 8, vitalite: 48 }, // frappe Feu (four)
    pa: 5, initiative: 9,
    resistances: { feu: 0.2 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Boudur le Raide",
    img: "/assets/monstres/boulanger_sombre.png",
  },
  bandit_roublard: {
    id: "bandit_roublard", nom: "Bandit du clan des Roublards", pv: 72,
    stats: { force: 36, intelligence: 8, agilite: 16, vitalite: 56 }, // frappe Terre (brutal)
    pa: 5, initiative: 11,
    resistances: { terre: 0.1 },
    sorts: ["morsure", "charge"], ia: "agressif",
    archiNom: "Bandson le Tonitruant",
    img: "/assets/monstres/bandit_roublard.png",
  },
  forgeron_sombre: {
    id: "forgeron_sombre", nom: "Forgeron Sombre", pv: 105,
    stats: { force: 36, intelligence: 10, agilite: 14, vitalite: 66 }, // frappe Terre (marteau) — élite/miniboss
    pa: 5, initiative: 8,
    resistances: { terre: 0.1, feu: 0.1, eau: -0.1, air: -0.1 },
    sorts: ["morsure", "charge"], ia: "agressif",
    archiNom: "Forboyar l'Enigmatique",
    img: "/assets/monstres/forgeron_sombre.png",
  },
  coffre_forgerons: {
    id: "coffre_forgerons", nom: "Coffre des Forgerons", pv: 640,
    stats: { force: 46, intelligence: 18, agilite: 13, chance: 12, vitalite: 164 },
    pa: 10, initiative: 6, // mimic lourd et lent, mais énorme sac de PV
    resistances: { terre: 0.15, feu: 0.15, eau: 0.1, air: 0.1 },
    sorts: ["machoire_du_coffre", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus pour l'instant (réservé pour plus tard)
    img: "/assets/monstres/coffre_forgerons.png",
  },

  // ===== Akadémie des Gobs (joué entre Tofus et Kankreblath) =====
  // Gobelins bagarreurs : mêlée Terre + un coureur Air. Boss : le Directeur.
  // (Signature future : « Travail d'équipe » — +dégâts par gob dans la ligne.)
  gobet: {
    id: "gobet", nom: "Gobet", pv: 52,
    stats: { force: 30, intelligence: 6, agilite: 10, vitalite: 44 }, // frappe Terre (petit teigneux)
    pa: 4, initiative: 11,
    resistances: { terre: 0.15, feu: -0.1 },
    sorts: ["picotement"], ia: "agressif",
    archiNom: "Gobstiniais le Têtu",
    img: "/assets/monstres/gobet.png",
  },
  gobichon: {
    id: "gobichon", nom: "Gobichon", pv: 62,
    stats: { force: 34, intelligence: 6, agilite: 12, vitalite: 50 }, // frappe Terre
    pa: 5, initiative: 10,
    resistances: { terre: 0.15, air: -0.1 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/gobichon.png",
  },
  gobaliste: {
    id: "gobaliste", nom: "Gobaliste", pv: 56,
    stats: { force: 10, intelligence: 32, agilite: 12, vitalite: 46 }, // frappe Feu (projectiles)
    pa: 5, initiative: 12,
    resistances: { feu: 0.15, eau: -0.1 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/gobaliste.png",
  },
  gob_trotteur: {
    id: "gob_trotteur", nom: "Gob-Trotteur", pv: 54,
    stats: { force: 8, intelligence: 6, agilite: 36, vitalite: 44 }, // frappe Air (coureur)
    pa: 5, initiative: 15,
    resistances: { air: 0.15, terre: -0.1 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Chevaustine le Reconstruit",
    img: "/assets/monstres/gob_trotteur.png",
  },
  gobaladee: {
    id: "gobaladee", nom: "Gobaladée", pv: 95,
    stats: { force: 38, intelligence: 8, agilite: 16, vitalite: 70 }, // élite/miniboss de l'Akadémie
    pa: 5, initiative: 9,
    resistances: { terre: 0.15, feu: 0.1, eau: -0.1 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/gobaladee.png",
  },
  directeur_grunob: {
    id: "directeur_grunob", nom: "Directeur Grunob", pv: 450,
    stats: { force: 31, intelligence: 8, agilite: 12, vitalite: 118 },
    pa: 10, initiative: 10,
    resistances: { terre: 0.2, feu: 0.15, air: 0.1, eau: -0.05 },
    bonusParAllieLigne: 0.1, // « Travail d'équipe » : +10 % de dégâts par allié vivant dans sa rangée
    sorts: ["ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus (réservé)
    img: "/assets/monstres/directeur_grunob.png",
  },

  // ===== Cache de Kankreblath (grenier de Kérubim, insectes de feu) =====
  // Vermine pyromane : frappes Feu dominantes + un archer Air en retrait.
  // (Signature future : sort aléatoire — invoque un monstre de la zone.)
  pyrasite: {
    id: "pyrasite", nom: "Pyrasite", pv: 56,
    stats: { force: 8, intelligence: 38, agilite: 10, vitalite: 46 }, // frappe Feu (le plus dangereux)
    pa: 5, initiative: 12,
    resistances: { feu: 0.25, eau: -0.2 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/pyrasite.png",
  },
  ceglumen: {
    id: "ceglumen", nom: "Céglumen", pv: 62,
    stats: { force: 8, intelligence: 34, agilite: 12, vitalite: 52 }, // frappe Feu (luciole)
    pa: 5, initiative: 10,
    resistances: { feu: 0.2, air: 0.1, terre: -0.1 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/ceglumen.png",
  },
  cafarcher: {
    id: "cafarcher", nom: "Cafarcher", pv: 58,
    stats: { force: 8, intelligence: 10, agilite: 36, vitalite: 46 }, // frappe Air (tireur)
    pa: 5, initiative: 13,
    resistances: { air: 0.15, feu: -0.1 },
    sorts: ["coup_de_bec"], ia: "agressif",
    img: "/assets/monstres/cafarcher.png",
  },
  mirgrillon: {
    id: "mirgrillon", nom: "Mirgrillon", pv: 48,
    stats: { force: 6, intelligence: 30, agilite: 14, vitalite: 40 }, // frappe Feu (fragile)
    pa: 4, initiative: 14,
    resistances: { feu: 0.15, terre: -0.15 },
    sorts: ["picotement"], ia: "agressif",
    img: "/assets/monstres/mirgrillon.png",
  },
  sakarien: {
    id: "sakarien", nom: "Sakarien", pv: 120,
    stats: { force: 36, intelligence: 14, agilite: 14, vitalite: 72 }, // élite/miniboss cuirassé
    pa: 5, initiative: 8,
    resistances: { terre: 0.2, feu: 0.15, eau: -0.1 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/sakarien.png",
  },
  kankreblath: {
    id: "kankreblath", nom: "Kankreblath", pv: 560,
    stats: { force: 10, intelligence: 30, agilite: 11, vitalite: 126 },
    pa: 10, initiative: 11,
    resistances: { terre: 0.25, eau: 0.2, feu: 0.15, air: -0.05 }, // résist. réelles DofusDB (terre/eau)
    sorts: ["sfvc", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus (réservé)
    img: "/assets/monstres/kankreblath.png",
  },

  // ===== Maison Fantôme (Foire du Trool) =====
  // Roster réel DofusDB (donjon 34) : Vampire, Kwoan, Gargrouille,
  // Tofu Maléfique (réutilisé de la zone Tofus), Boostache Prépubère (miniboss).
  // (Signature future de Boostache : réinvoque un monstre vaincu.)
  vampire: {
    id: "vampire", nom: "Vampire", pv: 60,
    stats: { force: 8, intelligence: 36, agilite: 14, vitalite: 48 }, // frappe Feu (drain nocturne)
    pa: 5, initiative: 12,
    resistances: { feu: 0.2, air: 0.1, terre: -0.1 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Vampunor le Glacial",
    img: "/assets/monstres/vampire.png",
  },
  kwoan: {
    id: "kwoan", nom: "Kwoan", pv: 56,
    stats: { force: 8, intelligence: 10, agilite: 35, vitalite: 46 }, // frappe Air (vif)
    pa: 5, initiative: 14,
    resistances: { air: 0.2, terre: -0.15 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Kwoanneur le Frimeur",
    img: "/assets/monstres/kwoan.png",
  },
  gargrouille: {
    id: "gargrouille", nom: "Gargrouille", pv: 66,
    stats: { force: 34, intelligence: 10, agilite: 12, vitalite: 54 }, // frappe Terre (pierre animée)
    pa: 4, initiative: 9,
    resistances: { terre: 0.2, eau: 0.1, feu: -0.1 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Garsim le Mort",
    img: "/assets/monstres/gargrouille.png",
  },
  boostache_prepubere: {
    id: "boostache_prepubere", nom: "Boostache Prépubère", pv: 112,
    stats: { force: 12, intelligence: 16, agilite: 33, vitalite: 68 }, // miniboss (rejeton du boss)
    pa: 5, initiative: 13,
    resistances: { air: 0.2, feu: 0.1, terre: -0.1 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/boostache_prepubere.png",
  },
  boostache: {
    id: "boostache", nom: "Boostache", pv: 520,
    stats: { force: 8, intelligence: 12, agilite: 29, vitalite: 122 },
    pa: 10, initiative: 12,
    resistances: { air: 0.25, terre: 0.15, eau: 0.1, feu: -0.1 },
    sorts: ["enfer_des_zombies", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus (réservé)
    img: "/assets/monstres/boostache.png",
  },

  // ===== Donjon des Larves (joué après les Forgerons) =====
  // Puzzle élémentaire allégé (3 couleurs), chiffres au-dessus des Forgerons.
  larve_bleue: {
    id: "larve_bleue", nom: "Larve Bleue", pv: 70,
    stats: { force: 8, intelligence: 8, agilite: 10, chance: 40, vitalite: 54 }, // frappe Eau
    pa: 5, initiative: 8,
    resistances: { eau: 0.3, feu: -0.25 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Larvonika l'Instrument",
    img: "/assets/monstres/larve_bleue.png",
  },
  larve_verte: {
    id: "larve_verte", nom: "Larve Verte", pv: 70,
    stats: { force: 40, intelligence: 8, agilite: 10, vitalite: 54 }, // frappe Terre
    pa: 5, initiative: 8,
    resistances: { terre: 0.3, air: -0.25 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Larchimaide la Poussée",
    img: "/assets/monstres/larve_verte.png",
  },
  larve_orange: {
    id: "larve_orange", nom: "Larve Orange", pv: 70,
    stats: { force: 8, intelligence: 40, agilite: 10, vitalite: 54 }, // frappe Feu
    pa: 5, initiative: 8,
    resistances: { feu: 0.3, eau: -0.25 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Larvapstrè le Subjectif",
    img: "/assets/monstres/larve_orange.png",
  },
  larve_saphir: {
    id: "larve_saphir", nom: "Larve Saphir", pv: 78,
    stats: { force: 8, intelligence: 8, agilite: 10, chance: 44, vitalite: 60 }, // frappe Eau
    pa: 5, initiative: 9,
    resistances: { eau: 0.4, feu: -0.3 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/larve_saphir.png",
  },
  larve_emeraude: {
    id: "larve_emeraude", nom: "Larve Émeraude", pv: 78,
    stats: { force: 44, intelligence: 8, agilite: 10, vitalite: 60 }, // frappe Terre
    pa: 5, initiative: 9,
    resistances: { terre: 0.4, air: -0.3 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/larve_emeraude.png",
  },
  larve_rubis: {
    id: "larve_rubis", nom: "Larve Rubis", pv: 78,
    stats: { force: 8, intelligence: 44, agilite: 10, vitalite: 60 }, // frappe Feu
    pa: 5, initiative: 9,
    resistances: { feu: 0.4, eau: -0.3 },
    sorts: ["morsure"], ia: "agressif",
    img: "/assets/monstres/larve_rubis.png",
  },
  larve_doree: {
    id: "larve_doree", nom: "Larve Dorée", pv: 150,
    stats: { force: 46, intelligence: 18, agilite: 14, vitalite: 88 }, // élite/miniboss luisant
    pa: 5, initiative: 8,
    resistances: { terre: 0.15, feu: 0.15, eau: 0.15, air: 0.15 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/larve_doree.png",
  },
  shin_larve: {
    id: "shin_larve", nom: "Shin Larve", pv: 820,
    stats: { force: 14, intelligence: 14, agilite: 11, chance: 46, vitalite: 176 },
    pa: 10, initiative: 9,
    resistances: { eau: 0.3, terre: 0.15, feu: -0.1 },
    sorts: ["ponte_larvaire", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus (réservé)
    img: "/assets/monstres/shin_larve.png",
  },

  // ===== Grotte Hesque (plage corail d'Otomaï) =====
  // Roster réel DofusDB (donjon 25) : Corailleur + Crustorail/Palmifleur
  // (déclinaisons élémentaires Kouraçao/Morito/Passaoh/Malibout).
  // (Signature future du Magistral : ne frappe qu'au corps à corps.)
  corailleur: {
    id: "corailleur", nom: "Corailleur", pv: 85,
    stats: { force: 12, intelligence: 10, agilite: 12, chance: 48, vitalite: 66 }, // frappe Eau
    pa: 5, initiative: 9,
    resistances: { eau: 0.3, terre: 0.1, feu: -0.15 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Corboyard l'Enigmatique",
    img: "/assets/monstres/corailleur.png",
  },
  crustorail_kouracao: {
    id: "crustorail_kouracao", nom: "Crustorail Kouraçao", pv: 90,
    stats: { force: 12, intelligence: 10, agilite: 12, chance: 46, vitalite: 68 }, // frappe Eau
    pa: 5, initiative: 8,
    resistances: { eau: 0.3, feu: -0.2 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Crustterus l'Organique",
    img: "/assets/monstres/crustorail_kouracao.png",
  },
  crustorail_morito: {
    id: "crustorail_morito", nom: "Crustorail Morito", pv: 95,
    stats: { force: 48, intelligence: 10, agilite: 12, vitalite: 72 }, // frappe Terre (pinces)
    pa: 5, initiative: 8,
    resistances: { terre: 0.3, air: -0.2 },
    sorts: ["morsure", "charge"], ia: "agressif",
    archiNom: "Cruskof le Rustre",
    img: "/assets/monstres/crustorail_morito.png",
  },
  palmifleur_passaoh: {
    id: "palmifleur_passaoh", nom: "Palmifleur Passaoh", pv: 88,
    stats: { force: 12, intelligence: 46, agilite: 12, vitalite: 66 }, // frappe Feu
    pa: 5, initiative: 10,
    resistances: { feu: 0.3, eau: -0.2 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Palmiflette le Convivial",
    img: "/assets/monstres/palmifleur_passaoh.png",
  },
  palmifleur_malibout: {
    id: "palmifleur_malibout", nom: "Palmifleur Malibout", pv: 88,
    stats: { force: 12, intelligence: 10, agilite: 46, vitalite: 66 }, // frappe Air
    pa: 5, initiative: 11,
    resistances: { air: 0.3, terre: -0.2 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Palmito le Menteur",
    img: "/assets/monstres/palmifleur_malibout.png",
  },
  palmifleur_morito: {
    id: "palmifleur_morito", nom: "Palmifleur Morito", pv: 170,
    stats: { force: 50, intelligence: 14, agilite: 14, vitalite: 96 }, // élite/miniboss du récif
    pa: 5, initiative: 9,
    resistances: { terre: 0.25, eau: 0.15, feu: -0.1 },
    sorts: ["morsure", "charge"], ia: "agressif",
    archiNom: "Palmiche le Serein",
    img: "/assets/monstres/palmifleur_morito.png",
  },
  corailleur_magistral: {
    id: "corailleur_magistral", nom: "Corailleur Magistral", pv: 660,
    stats: { force: 13, intelligence: 10, agilite: 11, chance: 28, vitalite: 175 },
    pa: 10, initiative: 8,
    resistances: { eau: 0.3, terre: 0.2, feu: -0.05 },
    sorts: ["rostre_broyeur", "ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus (réservé)
    img: "/assets/monstres/corailleur_magistral.png",
  },

  // ===== Nid du Kwakwa (final de la Tranche 1) =====
  // Quatre kwaks élémentaires : chacun frappe ET résiste dans son élément —
  // l'aboutissement du puzzle multi-élément de la tranche.
  // (Signature future du Kwakwa : 75 % de résist partout sauf 1 élément aléatoire.)
  kwak_de_terre: {
    id: "kwak_de_terre", nom: "Kwak de Terre", pv: 100,
    stats: { force: 54, intelligence: 10, agilite: 12, vitalite: 76 },
    pa: 5, initiative: 10,
    resistances: { terre: 0.5, air: -0.3 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Kwakamole l'Appétissant",
    img: "/assets/monstres/kwak_de_terre.png",
  },
  kwak_de_feu: {
    id: "kwak_de_feu", nom: "Kwak de Flamme", pv: 100,
    stats: { force: 10, intelligence: 54, agilite: 12, vitalite: 76 },
    pa: 5, initiative: 10,
    resistances: { feu: 0.5, eau: -0.3 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Kwakolak le Chocolaté",
    img: "/assets/monstres/kwak_de_feu.png",
  },
  kwak_d_eau: {
    id: "kwak_d_eau", nom: "Kwak de Glace", pv: 100,
    stats: { force: 10, intelligence: 10, agilite: 12, chance: 54, vitalite: 76 },
    pa: 5, initiative: 10,
    resistances: { eau: 0.5, feu: -0.3 },
    sorts: ["morsure"], ia: "agressif",
    archiNom: "Kwakwatique le Trempé",
    img: "/assets/monstres/kwak_d_eau.png",
  },
  kwak_de_vent: {
    id: "kwak_de_vent", nom: "Kwak de Vent", pv: 100,
    stats: { force: 10, intelligence: 10, agilite: 54, vitalite: 76 },
    pa: 5, initiative: 12,
    resistances: { air: 0.5, terre: -0.3 },
    sorts: ["coup_de_bec"], ia: "agressif",
    archiNom: "Kwaké le Piraté",
    img: "/assets/monstres/kwak_de_vent.png",
  },
  kwakere_de_terre: {
    id: "kwakere_de_terre", nom: "Kwakere de Terre", pv: 190,
    stats: { force: 30, intelligence: 30, agilite: 22, chance: 30, vitalite: 104 }, // élite/miniboss multi-élément
    pa: 5, initiative: 11,
    resistances: { terre: 0.15, feu: 0.15, eau: 0.15, air: 0.15 },
    sorts: ["morsure", "charge"], ia: "agressif",
    img: "/assets/monstres/kwakere_de_terre.png",
  },
  kwakwa: {
    id: "kwakwa", nom: "Kwakwa", pv: 780,
    stats: { force: 23, intelligence: 23, agilite: 16, chance: 23, vitalite: 180 },
    pa: 10, initiative: 12,
    resistances: { terre: 0.25, feu: 0.25, eau: 0.25, air: 0.25 }, // avant son 1er tour ; ensuite la mue prend le relais
    mueElementaire: 0.55, // signature : 55 % de résist partout sauf 1 élément (aléatoire) à 0, retiré chaque tour
    sorts: ["ecrasement", "charge", "morsure"], ia: "agressif",
    boss: true, // pas de Dofus (réservé)
    img: "/assets/monstres/kwakwa.png",
  },
};

// --- Dofus (reliques permanentes) --------------------------------------------
export interface DofusDef {
  id: string;
  nom: string;
  desc: string;
  bonusDegatsParCopie: number; // +% dégâts d'équipe par copie (Pourpre)
  vitaParCopie?: number; // +vitalité d'équipe par copie (Dofawa)
  resAllParCopie?: number; // +résistance toutes par copie (Argenté)
  maxCopies?: number; // nombre de copies max prises en compte pour l'effet
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

// Effets des Dofus dotés (les autres restent « à débloquer »).
type DofusEffet = Partial<Omit<DofusDef, "id" | "nom" | "img">>;
const DOFUS_EFFETS: Record<string, DofusEffet> = {
  dofus_pourpre: { desc: "+15 % de dégâts pour toute l'équipe (cumulable).", bonusDegatsParCopie: 0.15 },
  dofawa: { desc: "+1 Vitalité à toute l'équipe par copie (max 10).", vitaParCopie: 1, maxCopies: 10 },
  dofus_argente: { desc: "+1 % de résistance à tous les éléments par copie, pour l'équipe (max 10).", resAllParCopie: 0.01, maxCopies: 10 },
};

export const DOFUS: Record<string, DofusDef> = Object.fromEntries(
  CATALOGUE_DOFUS.map(([id, nom]) => {
    const eff = DOFUS_EFFETS[id];
    return [
      id,
      {
        id, nom,
        desc: eff?.desc ?? "Relique légendaire — effet à venir.",
        bonusDegatsParCopie: eff?.bonusDegatsParCopie ?? 0,
        vitaParCopie: eff?.vitaParCopie,
        resAllParCopie: eff?.resAllParCopie,
        maxCopies: eff?.maxCopies,
        img: `/assets/dofus/${id}.png`,
      },
    ];
  }),
);

/** Dofus → boss qui le lâche (nom + sprite), dérivé des monstres `dofus`. */
export const DOFUS_DROP: Record<string, { nom: string; img?: string }> = Object.fromEntries(
  Object.values(MONSTRES)
    .filter((m) => m.dofus)
    .map((m) => [m.dofus as string, { nom: m.nom, img: m.img }]),
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
  // ===== Incarnam — Crypte de Kardorim =====
  inc_1: { nom: "Chafers égarés", ennemis: [
    { monstre: "chafer_debutant", position: 0 }, { monstre: "chafer_eclaireur", position: 4 }, // tireur protégé derrière
  ] },
  inc_2: { nom: "Patrouille de la crypte", ennemis: [
    { monstre: "chafer_furtif", position: 0 }, { monstre: "chafer_debutant", position: 1 }, { monstre: "chafer_eclaireur", position: 4 },
  ] },
  inc_3: { nom: "Embuscade morte-vivante", ennemis: [
    { monstre: "chafer_piquier", position: 0 }, { monstre: "chafer_furtif", position: 1 }, { monstre: "chafer_debutant", position: 2 },
  ] },
  inc_elite: { nom: "Garde de la crypte (dur)", ennemis: [
    { monstre: "chafer_piquier", position: 0 }, { monstre: "chafer_furtif", position: 1 },
    { monstre: "chafer_eclaireur", position: 2 }, { monstre: "sergent_chafer", position: 4 }, // sergent-soigneur protégé
  ] },
  inc_boss: { nom: "Donjon — Kardorim", ennemis: [
    { monstre: "kardorim", position: 0 }, { monstre: "sergent_chafer", position: 1 }, // boss + miniboss devant
    { monstre: "chafer_piquier", position: 2 }, // garde rapprochée (4v3 : 1er boss)
  ] },

  // ===== Champs d'Astrub — fleurs (ids historiques, conservés) =====
  combat_1: { nom: "Parterre hostile", ennemis: [
    { monstre: "tournesol_sauvage", position: 0 }, { monstre: "pissenlit_diabolique", position: 1 },
  ] },
  combat_2: { nom: "Roseraie maudite", ennemis: [
    { monstre: "rose_demoniaque", position: 0 }, { monstre: "tournesol_sauvage", position: 1 }, { monstre: "pissenlit_diabolique", position: 4 },
  ] },
  combat_3: { nom: "Épouvante", ennemis: [
    { monstre: "epouvanteur", position: 0 }, { monstre: "pissenlit_diabolique", position: 1 }, { monstre: "rose_demoniaque", position: 2 },
  ] },
  combat_elite: { nom: "Jardin déchaîné (dur)", ennemis: [
    { monstre: "epouvanteur", position: 0 }, { monstre: "rose_demoniaque", position: 1 },
    { monstre: "tournesol_sauvage", position: 2 }, { monstre: "pissenlit_diabolique", position: 3 },
  ] },
  boss: { nom: "Donjon — Tournesol Affamé", ennemis: [
    { monstre: "tournesol_affame", position: 0 }, { monstre: "gardienne_champetre", position: 1 }, // boss + miniboss devant
    { monstre: "pissenlit_diabolique", position: 2 }, { monstre: "rose_demoniaque", position: 4 }, // parterre hostile
  ] },

  // ===== Tainéla — Donjon Bouftou =====
  tai_1: { nom: "Troupeau de Bouftous", ennemis: [
    { monstre: "bouftou", position: 0 }, { monstre: "boufton_blanc", position: 1 },
  ] },
  tai_2: { nom: "Harde noire", ennemis: [
    { monstre: "bouftou_noir", position: 0 }, { monstre: "boufton_noir", position: 1 }, { monstre: "bouftou", position: 4 },
  ] },
  tai_3: { nom: "Charge sauvage", ennemis: [
    { monstre: "bouftou", position: 0 }, { monstre: "bouftou_noir", position: 1 }, { monstre: "boufton_blanc", position: 2 },
  ] },
  tai_elite: { nom: "Furie ovine (dur)", ennemis: [
    { monstre: "bouftou_noir", position: 0 }, { monstre: "bouftou", position: 1 },
    { monstre: "boufton_noir", position: 2 }, { monstre: "boufton_blanc", position: 3 },
  ] },
  tai_boss: { nom: "Donjon — Bouftou Royal", ennemis: [
    { monstre: "bouftou_royal", position: 0 }, { monstre: "chef_de_guerre_bouftou", position: 1 }, // boss + miniboss devant
    { monstre: "bouftou", position: 2 }, // le troupeau suit son roi (4v3)
  ] },

  // ===== Donjon des Tofus =====
  tof_1: { nom: "Volée de Tofus", ennemis: [
    { monstre: "tofu", position: 0 }, { monstre: "tofu_noir", position: 1 },
  ] },
  tof_2: { nom: "Nuée noire", ennemis: [
    { monstre: "tofu_noir", position: 0 }, { monstre: "tofukaz", position: 1 }, { monstre: "tofoune", position: 4 },
  ] },
  tof_3: { nom: "Tourbillon de plumes", ennemis: [
    { monstre: "tofukaz", position: 0 }, { monstre: "tofu", position: 1 }, { monstre: "tofu_noir", position: 2 },
  ] },
  tof_elite: { nom: "Essaim maudit (dur)", ennemis: [
    { monstre: "tofu_mutant", position: 0 }, { monstre: "tofukaz", position: 1 },
    { monstre: "tofu_noir", position: 2 }, { monstre: "tofu", position: 3 },
  ] },
  tof_boss: { nom: "Donjon — Batofu", ennemis: [
    { monstre: "batofu", position: 0 }, { monstre: "tofu_ventripotent", position: 1 }, // boss + miniboss devant
    { monstre: "tofu_noir", position: 2 }, { monstre: "tofukaz", position: 4 }, // essaim d'escorte
  ] },

  // ===== Donjon des Scarafeuilles =====
  scr_1: { nom: "Duo prismatique", ennemis: [
    { monstre: "scarafeuille_rouge", position: 0 }, { monstre: "scarafeuille_bleu", position: 1 }, // feu-immune + eau-immune
  ] },
  scr_2: { nom: "Carapaces terreuses", ennemis: [
    { monstre: "scarafeuille_vert", position: 0 }, { monstre: "scarafeuille_blanc", position: 1 }, { monstre: "scarafeuille_immature", position: 4 },
  ] },
  scr_3: { nom: "Arc-en-ciel hostile", ennemis: [
    { monstre: "scarafeuille_rouge", position: 0 }, { monstre: "scarafeuille_vert", position: 1 }, { monstre: "scarafeuille_bleu", position: 2 },
  ] },
  scr_elite: { nom: "Essaim chromatique (dur)", ennemis: [
    { monstre: "scarafeuille_noir", position: 0 }, { monstre: "scarafeuille_rouge", position: 1 },
    { monstre: "scarafeuille_blanc", position: 2 }, { monstre: "scarafeuille_bleu", position: 3 },
  ] },
  scr_boss: { nom: "Donjon — Scarabosse Doré", ennemis: [
    { monstre: "scarabosse_dore", position: 0 }, { monstre: "scarafeuille_noir", position: 1 }, // boss + miniboss devant
    { monstre: "scarafeuille_rouge", position: 2 }, { monstre: "scarafeuille_blanc", position: 4 }, // couleurs de garde
  ] },

  // ===== Donjon des Forgerons =====
  frg_1: { nom: "Atelier maudit", ennemis: [
    { monstre: "forgeron_sombre", position: 0 }, { monstre: "mineur_sombre", position: 1 },
  ] },
  frg_2: { nom: "Fournée sombre", ennemis: [
    { monstre: "boulanger_sombre", position: 0 }, { monstre: "mineur_sombre", position: 1 }, { monstre: "bandit_roublard", position: 4 },
  ] },
  frg_3: { nom: "Embuscade de roublards", ennemis: [
    { monstre: "bandit_roublard", position: 0 }, { monstre: "forgeron_sombre", position: 1 }, { monstre: "boulanger_sombre", position: 2 },
  ] },
  frg_elite: { nom: "Forge en fusion (dur)", ennemis: [
    { monstre: "forgeron_sombre", position: 0 }, { monstre: "bandit_roublard", position: 1 },
    { monstre: "boulanger_sombre", position: 2 }, { monstre: "mineur_sombre", position: 3 },
  ] },
  frg_boss: { nom: "Donjon — Coffre des Forgerons", ennemis: [
    { monstre: "coffre_forgerons", position: 0 }, { monstre: "forgeron_sombre", position: 1 }, // boss + miniboss devant
    { monstre: "bandit_roublard", position: 2 }, { monstre: "boulanger_sombre", position: 4 }, // le clan défend son butin
  ] },

  // ===== Akadémie des Gobs =====
  gob_1: { nom: "Cour de récré", ennemis: [
    { monstre: "gobichon", position: 0 }, { monstre: "gobet", position: 1 },
  ] },
  gob_2: { nom: "Leçon de bagarre", ennemis: [
    { monstre: "gobichon", position: 0 }, { monstre: "gobet", position: 1 }, { monstre: "gobaliste", position: 4 },
  ] },
  gob_3: { nom: "Sprint des trotteurs", ennemis: [
    { monstre: "gob_trotteur", position: 0 }, { monstre: "gobichon", position: 1 }, { monstre: "gobet", position: 2 },
  ] },
  gob_elite: { nom: "Examen d'arène (dur)", ennemis: [
    { monstre: "gobaladee", position: 0 }, { monstre: "gobichon", position: 1 },
    { monstre: "gob_trotteur", position: 2 }, { monstre: "gobaliste", position: 4 },
  ] },
  gob_boss: { nom: "Donjon — Directeur Grunob", ennemis: [
    { monstre: "directeur_grunob", position: 0 }, { monstre: "gobaladee", position: 1 }, // boss + miniboss devant
    { monstre: "gobichon", position: 2 }, // Travail d'équipe : 2 alliés en ligne avant (4v3)
  ] },

  // ===== Cache de Kankreblath =====
  kan_1: { nom: "Grenier infesté", ennemis: [
    { monstre: "pyrasite", position: 0 }, { monstre: "mirgrillon", position: 1 },
  ] },
  kan_2: { nom: "Lueurs malsaines", ennemis: [
    { monstre: "ceglumen", position: 0 }, { monstre: "mirgrillon", position: 1 }, { monstre: "cafarcher", position: 4 },
  ] },
  kan_3: { nom: "Vermine en embuscade", ennemis: [
    { monstre: "pyrasite", position: 0 }, { monstre: "ceglumen", position: 1 }, { monstre: "cafarcher", position: 4 },
  ] },
  kan_elite: { nom: "Nid de la vermine (dur)", ennemis: [
    { monstre: "sakarien", position: 0 }, { monstre: "pyrasite", position: 1 },
    { monstre: "ceglumen", position: 2 }, { monstre: "cafarcher", position: 4 },
  ] },
  kan_boss: { nom: "Donjon — Kankreblath", ennemis: [
    { monstre: "kankreblath", position: 0 }, { monstre: "sakarien", position: 1 }, // boss + miniboss devant
    { monstre: "cafarcher", position: 4 }, // 4v3 : le boss repeuple lui-même (Sfvc%$*R ?!)
  ] },

  // ===== Maison Fantôme =====
  fan_1: { nom: "Couloir qui grince", ennemis: [
    { monstre: "gargrouille", position: 0 }, { monstre: "kwoan", position: 1 },
  ] },
  fan_2: { nom: "Chandelles bleues", ennemis: [
    { monstre: "vampire", position: 0 }, { monstre: "gargrouille", position: 1 }, { monstre: "kwoan", position: 4 },
  ] },
  fan_3: { nom: "Sarabande spectrale", ennemis: [
    { monstre: "tofu_mutant", position: 0 }, { monstre: "vampire", position: 1 }, { monstre: "kwoan", position: 2 },
  ] },
  fan_elite: { nom: "Nuit de poltergeists (dur)", ennemis: [
    { monstre: "boostache_prepubere", position: 0 }, { monstre: "vampire", position: 1 },
    { monstre: "gargrouille", position: 2 }, { monstre: "kwoan", position: 4 },
  ] },
  fan_boss: { nom: "Donjon — Boostache", ennemis: [
    { monstre: "boostache", position: 0 }, { monstre: "boostache_prepubere", position: 1 }, // boss + miniboss devant
    { monstre: "gargrouille", position: 2 }, // 4v3 : le boss réinvoque les vaincus
  ] },

  // ===== Donjon des Larves =====
  lrv_1: { nom: "Reptation gluante", ennemis: [
    { monstre: "larve_bleue", position: 0 }, { monstre: "larve_orange", position: 1 },
  ] },
  lrv_2: { nom: "Couvée multicolore", ennemis: [
    { monstre: "larve_verte", position: 0 }, { monstre: "larve_saphir", position: 1 }, { monstre: "larve_rubis", position: 2 },
  ] },
  lrv_3: { nom: "Marée rampante", ennemis: [
    { monstre: "larve_rubis", position: 0 }, { monstre: "larve_emeraude", position: 1 }, { monstre: "larve_saphir", position: 2 },
  ] },
  lrv_elite: { nom: "Couvain doré (dur)", ennemis: [
    { monstre: "larve_doree", position: 0 }, { monstre: "larve_emeraude", position: 1 },
    { monstre: "larve_saphir", position: 2 }, { monstre: "larve_rubis", position: 3 },
  ] },
  lrv_boss: { nom: "Donjon — Shin Larve", ennemis: [
    { monstre: "shin_larve", position: 0 }, { monstre: "larve_doree", position: 1 }, // boss + miniboss devant
    { monstre: "larve_emeraude", position: 2 }, // 4v3 : la Shin Larve pond en combat
  ] },

  // ===== Grotte Hesque =====
  hsk_1: { nom: "Marée montante", ennemis: [
    { monstre: "corailleur", position: 0 }, { monstre: "crustorail_kouracao", position: 1 },
  ] },
  hsk_2: { nom: "Pinces au récif", ennemis: [
    { monstre: "crustorail_morito", position: 0 }, { monstre: "palmifleur_passaoh", position: 1 }, { monstre: "corailleur", position: 4 },
  ] },
  hsk_3: { nom: "Banc de coraux", ennemis: [
    { monstre: "palmifleur_malibout", position: 0 }, { monstre: "crustorail_kouracao", position: 1 }, { monstre: "palmifleur_passaoh", position: 4 },
  ] },
  hsk_elite: { nom: "Fond de la grotte (dur)", ennemis: [
    { monstre: "palmifleur_morito", position: 0 }, { monstre: "crustorail_morito", position: 1 },
    { monstre: "palmifleur_malibout", position: 2 }, { monstre: "corailleur", position: 4 },
  ] },
  hsk_boss: { nom: "Donjon — Corailleur Magistral", ennemis: [
    { monstre: "corailleur_magistral", position: 0 }, { monstre: "palmifleur_morito", position: 1 }, // boss + miniboss devant
    { monstre: "corailleur", position: 4 }, // 4v3 : récif dense
  ] },

  // ===== Nid du Kwakwa =====
  kwa_1: { nom: "Plumes élémentaires", ennemis: [
    { monstre: "kwak_de_terre", position: 0 }, { monstre: "kwak_de_feu", position: 1 },
  ] },
  kwa_2: { nom: "Duo des extrêmes", ennemis: [
    { monstre: "kwak_d_eau", position: 0 }, { monstre: "kwak_de_vent", position: 1 }, { monstre: "kwak_de_feu", position: 4 },
  ] },
  kwa_3: { nom: "Tempête au nid", ennemis: [
    { monstre: "kwak_de_vent", position: 0 }, { monstre: "kwak_de_terre", position: 1 }, { monstre: "kwak_d_eau", position: 2 },
  ] },
  kwa_elite: { nom: "Les quatre vents (dur)", ennemis: [
    { monstre: "kwakere_de_terre", position: 0 }, { monstre: "kwak_de_terre", position: 1 },
    { monstre: "kwak_de_feu", position: 2 }, { monstre: "kwak_d_eau", position: 4 },
  ] },
  kwa_boss: { nom: "Donjon — Kwakwa", ennemis: [
    { monstre: "kwakwa", position: 0 }, { monstre: "kwakere_de_terre", position: 1 }, // boss + miniboss devant
    { monstre: "kwak_d_eau", position: 4 }, // un kwak en soutien arrière (4v3)
  ] },
};

// --- Zones (mondes traversés successivement durant une run) ------------------
export interface ZonePools { normales: string[]; elite: string[]; boss: string; }
export interface ZoneDef {
  id: string;
  nom: string;
  pools: ZonePools;
  sansNoeuds?: string[]; // types de nœuds exclus du plateau de cette zone
}

export const ZONES: ZoneDef[] = [
  { id: "incarnam", nom: "Incarnam",
    pools: { normales: ["inc_1", "inc_2", "inc_3"], elite: ["inc_elite"], boss: "inc_boss" },
    sansNoeuds: ["otomai"] }, // pas de restat en zone de départ
  { id: "astrub", nom: "Champs d'Astrub",
    pools: { normales: ["combat_1", "combat_2", "combat_3"], elite: ["combat_elite"], boss: "boss" } },
  { id: "tainela", nom: "Tainéla",
    pools: { normales: ["tai_1", "tai_2", "tai_3"], elite: ["tai_elite"], boss: "tai_boss" } },
  { id: "tofus", nom: "Donjon des Tofus",
    pools: { normales: ["tof_1", "tof_2", "tof_3"], elite: ["tof_elite"], boss: "tof_boss" } },
  { id: "scarafeuilles", nom: "Donjon des Scarafeuilles",
    pools: { normales: ["scr_1", "scr_2", "scr_3"], elite: ["scr_elite"], boss: "scr_boss" } },
  { id: "forgerons", nom: "Donjon des Forgerons",
    pools: { normales: ["frg_1", "frg_2", "frg_3"], elite: ["frg_elite"], boss: "frg_boss" } },
  { id: "akademie", nom: "Akadémie des Gobs",
    pools: { normales: ["gob_1", "gob_2", "gob_3"], elite: ["gob_elite"], boss: "gob_boss" } },
  { id: "kankreblath", nom: "Cache de Kankreblath",
    pools: { normales: ["kan_1", "kan_2", "kan_3"], elite: ["kan_elite"], boss: "kan_boss" } },
  { id: "maison_fantome", nom: "Maison Fantôme",
    pools: { normales: ["fan_1", "fan_2", "fan_3"], elite: ["fan_elite"], boss: "fan_boss" } },
  { id: "larves", nom: "Donjon des Larves",
    pools: { normales: ["lrv_1", "lrv_2", "lrv_3"], elite: ["lrv_elite"], boss: "lrv_boss" } },
  { id: "grotte_hesque", nom: "Grotte Hesque",
    pools: { normales: ["hsk_1", "hsk_2", "hsk_3"], elite: ["hsk_elite"], boss: "hsk_boss" } },
  { id: "kwakwa", nom: "Nid du Kwakwa",
    pools: { normales: ["kwa_1", "kwa_2", "kwa_3"], elite: ["kwa_elite"], boss: "kwa_boss" } },
];

// --- Tranches (paliers de niveau — une run = une tranche) ---------------------
// NB : les donjons ÉVÉNEMENTIELS (Nowel/Sapik, Halouine, Pwak…) sont réservés à un
// futur contenu saisonnier et ne doivent JAMAIS figurer dans les zones d'une tranche.
export interface TrancheDef {
  id: string;
  nom: string;
  niveaux: [number, number]; // fourchette de niveaux affichée (fiction Dofus)
  zones: string[]; // ids de ZONES, dans l'ordre de jeu
  active: boolean; // false = affichée verrouillée à l'accueil (pas encore jouable)
}

export const TRANCHES: TrancheDef[] = [
  { id: "t1", nom: "Tranche 1", niveaux: [1, 50], active: true,
    // ordre de jeu = niveau officiel des donjons (cf. PLAN-CONTENU.md §4)
    zones: ["incarnam", "astrub", "tainela", "tofus", "akademie", "kankreblath",
      "maison_fantome", "scarafeuilles", "forgerons", "larves", "grotte_hesque", "kwakwa"] },
  { id: "t2", nom: "Tranche 2", niveaux: [51, 100], active: false, zones: [] },
  { id: "t3", nom: "Tranche 3", niveaux: [101, 150], active: false, zones: [] },
  { id: "t4", nom: "Tranche 4", niveaux: [151, 199], active: false, zones: [] },
  { id: "t5", nom: "Tranche 5", niveaux: [200, 200], active: false, zones: [] },
];

/** Zones (dans l'ordre de jeu) de la tranche active. */
export function zonesDeTranche(tranche: TrancheDef): ZoneDef[] {
  return tranche.zones.map((id) => ZONES.find((z) => z.id === id)!);
}

/** Récompense d'XP par type de nœud de combat (tunable). */
export const XP_PAR_TYPE = { combat: 40, combat_dur: 70 } as const;

/** Fraction de PV max rendue par la Taverne. */
export const TAVERNE_PCT = 0.5;

/** Paramètres de génération de la carte (tunable). */
export const GEN_CARTE = {
  lignesMin: 7, // bornes du nombre de rangées (donjon inclus)
  lignesMax: 9,
  largeurMax: 4, // largeur du losange au plateau (nb de colonnes) — style Pokelike
  // poids des types pour les rangées intermédiaires
  poids: { combat: 60, combat_dur: 12, taverne: 12, otomai: 8, zaap: 8 } as Record<string, number>,
};

// --- Rareté d'équipement --------------------------------------------------------
export const RARETES = ["commun", "rare", "epique", "legendaire"] as const;
export const RARETE_INFO: Record<Rarete, { nom: string; poids: number }> = {
  commun: { nom: "Commun", poids: 60 },
  rare: { nom: "Rare", poids: 25 },
  epique: { nom: "Épique", poids: 12 },
  legendaire: { nom: "Légendaire", poids: 3 },
};

// --- Équipement & panoplies --------------------------------------------------
// Stats en FOURCHETTES (rolls) tirées au drop — valeurs réelles DofusDB,
// filtrées aux stats gérées par le moteur (vita/force/int/agi/chance/prospection).
// 4 slots par perso : coiffe, cape, anneau, arme (amulette/ceinture/bottes retirés).
export const ITEMS: Record<string, Item> = {
  // ===== Panoplie de l'Aventurier (Incarnam, set #5 : +toutes carac) =====
  aventurier_coiffe: { id: "aventurier_coiffe", nom: "Chapeau de l'Aventurier", slot: "coiffe", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_cape: { id: "aventurier_cape", nom: "Cape de l'Aventurier", slot: "cape", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_anneau: { id: "aventurier_anneau", nom: "Anneau de l'Aventurier", slot: "anneau", panoplie: "aventurier", rolls: { force: [0, 2], intelligence: [0, 2], chance: [0, 2], agilite: [0, 2] } },
  aventurier_arme: { id: "aventurier_arme", nom: "Épée de l'Aventurier", slot: "arme", panoplie: "aventurier", rolls: { force: [0, 4], intelligence: [0, 4], chance: [0, 4], agilite: [0, 4] }, attaque: { coutPA: 3, baseMin: 7, baseMax: 11, scaling: 0.3 } },

  // ===== Panoplie du Paysan (Champs d'Astrub, set #47 : vita / chance) =====
  paysan_coiffe: { id: "paysan_coiffe", nom: "Bob du Paysan", slot: "coiffe", panoplie: "paysan", rolls: { vitalite: [26, 30] } },
  paysan_cape: { id: "paysan_cape", nom: "Sac du Paysan", slot: "cape", panoplie: "paysan", rolls: { chance: [16, 20] } },
  paysan_anneau: { id: "paysan_anneau", nom: "Mitaines Mitées du Paysan", slot: "anneau", panoplie: "paysan", rolls: { chance: [11, 15] } },
  paysan_arme: { id: "paysan_arme", nom: "Faux usée du Paysan", slot: "arme", panoplie: "paysan", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 3, baseMin: 9, baseMax: 14, scaling: 0.35 } },

  // ===== Panoplie du Bouftou (Tainéla, set #1 : vita/force/int) =====
  bouftou_coiffe: { id: "bouftou_coiffe", nom: "Coiffe du Bouftou", slot: "coiffe", panoplie: "bouftou", rolls: { force: [16, 20], intelligence: [16, 20] } },
  bouftou_cape: { id: "bouftou_cape", nom: "Cape Bouffante", slot: "cape", panoplie: "bouftou", rolls: { vitalite: [26, 30] } },
  bouftou_anneau: { id: "bouftou_anneau", nom: "Anneau de Bouze le Clerc", slot: "anneau", panoplie: "bouftou", rolls: { vitalite: [21, 30] } },
  bouftou_arme: { id: "bouftou_arme", nom: "Marteau du Bouftou", slot: "arme", panoplie: "bouftou", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 4, baseMin: 16, baseMax: 22, scaling: 0.45 } },

  // ===== Panoplie du Tofu (Donjon des Tofus : vita / agilité, thème Air) =====
  tofu_coiffe: { id: "tofu_coiffe", nom: "Coiffe du Tofu", slot: "coiffe", panoplie: "tofu", rolls: { vitalite: [16, 20], agilite: [16, 20] } },
  tofu_cape: { id: "tofu_cape", nom: "Cape Tofue", slot: "cape", panoplie: "tofu", rolls: { vitalite: [26, 30] } },
  tofu_anneau: { id: "tofu_anneau", nom: "Anneau du Tofu", slot: "anneau", panoplie: "tofu", rolls: { agilite: [11, 15] } },
  tofu_arme: { id: "tofu_arme", nom: "Aile du Batofu", slot: "arme", panoplie: "tofu", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 4, baseMin: 14, baseMax: 20, scaling: 0.4 } },

  // ===== Panoplie du Scarafeuille (Donjon des Scarafeuilles : défensif, résist. toutes) =====
  scarafeuille_coiffe: { id: "scarafeuille_coiffe", nom: "Coiffe du Scarafeuille", slot: "coiffe", panoplie: "scarafeuille", rolls: { vitalite: [20, 24] } },
  scarafeuille_cape: { id: "scarafeuille_cape", nom: "Élytre du Scarafeuille", slot: "cape", panoplie: "scarafeuille", rolls: { vitalite: [21, 25] } },
  scarafeuille_anneau: { id: "scarafeuille_anneau", nom: "Anneau du Scarafeuille", slot: "anneau", panoplie: "scarafeuille", rolls: { vitalite: [11, 15] } },
  scarafeuille_arme: { id: "scarafeuille_arme", nom: "Rostre du Scarabosse", slot: "arme", panoplie: "scarafeuille", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 4, baseMin: 15, baseMax: 21, scaling: 0.4 } },

  // ===== Panoplie du Forgeron (Donjon des Forgerons : force/vita + prospection au set) =====
  forgeron_coiffe: { id: "forgeron_coiffe", nom: "Heaume du Forgeron", slot: "coiffe", panoplie: "forgeron", rolls: { force: [16, 20], vitalite: [16, 20] } },
  forgeron_cape: { id: "forgeron_cape", nom: "Tablier du Forgeron", slot: "cape", panoplie: "forgeron", rolls: { vitalite: [26, 30] } },
  forgeron_anneau: { id: "forgeron_anneau", nom: "Anneau du Forgeron", slot: "anneau", panoplie: "forgeron", rolls: { vitalite: [21, 25] } },
  forgeron_arme: { id: "forgeron_arme", nom: "Marteau du Forgeron Sombre", slot: "arme", panoplie: "forgeron", rolls: { force: [11, 15] }, attaque: { coutPA: 5, baseMin: 20, baseMax: 28, scaling: 0.5 } },

  // ===== Panoplie du Gladiateur (Akadémie des Gobs : force/agi de bagarreur) =====
  gladiateur_coiffe: { id: "gladiateur_coiffe", nom: "Casque du Gladiateur", slot: "coiffe", panoplie: "gladiateur", rolls: { force: [11, 15], vitalite: [11, 15] } },
  gladiateur_cape: { id: "gladiateur_cape", nom: "Cape du Gladiateur", slot: "cape", panoplie: "gladiateur", rolls: { agilite: [11, 15], vitalite: [11, 15] } },
  gladiateur_anneau: { id: "gladiateur_anneau", nom: "Anneau du Gladiateur", slot: "anneau", panoplie: "gladiateur", rolls: { force: [8, 12], agilite: [8, 12] } },
  gladiateur_arme: { id: "gladiateur_arme", nom: "Lance du Gob-Lancier", slot: "arme", panoplie: "gladiateur", rolls: { force: [8, 12] }, attaque: { coutPA: 4, baseMin: 16, baseMax: 22, scaling: 0.42 } },

  // ===== Panoplie de Kankreblath (Cache de Kankreblath : intelligence/vita) =====
  kankreblath_coiffe: { id: "kankreblath_coiffe", nom: "Chitine de Kankreblath", slot: "coiffe", panoplie: "kankreblath", rolls: { intelligence: [12, 16], vitalite: [11, 15] } },
  kankreblath_cape: { id: "kankreblath_cape", nom: "Élytres de Kankreblath", slot: "cape", panoplie: "kankreblath", rolls: { intelligence: [11, 15], vitalite: [12, 16] } },
  kankreblath_anneau: { id: "kankreblath_anneau", nom: "Anneau grouillant", slot: "anneau", panoplie: "kankreblath", rolls: { intelligence: [11, 15] } },
  kankreblath_arme: { id: "kankreblath_arme", nom: "Dard de Kankreblath", slot: "arme", panoplie: "kankreblath", rolls: { intelligence: [8, 12] }, attaque: { coutPA: 4, baseMin: 16, baseMax: 23, scaling: 0.45 } },

  // ===== Panoplie Fantomatique (Maison Fantôme : agilité/esquive) =====
  fantome_coiffe: { id: "fantome_coiffe", nom: "Capuche Fantomatique", slot: "coiffe", panoplie: "fantome", rolls: { agilite: [12, 16], vitalite: [11, 15] } },
  fantome_cape: { id: "fantome_cape", nom: "Suaire Fantomatique", slot: "cape", panoplie: "fantome", rolls: { agilite: [12, 16], vitalite: [11, 15] } },
  fantome_anneau: { id: "fantome_anneau", nom: "Anneau Spectral", slot: "anneau", panoplie: "fantome", rolls: { agilite: [11, 15] } },
  fantome_arme: { id: "fantome_arme", nom: "Canne de Boostache", slot: "arme", panoplie: "fantome", rolls: { agilite: [8, 12] }, attaque: { coutPA: 4, baseMin: 17, baseMax: 23, scaling: 0.45 } },

  // ===== Panoplie de la Larve (Donjon des Larves : vita + résistances) =====
  larve_coiffe: { id: "larve_coiffe", nom: "Coiffe de la Larve", slot: "coiffe", panoplie: "larve", rolls: { vitalite: [24, 28] } },
  larve_cape: { id: "larve_cape", nom: "Mue de la Shin Larve", slot: "cape", panoplie: "larve", rolls: { vitalite: [26, 30] } },
  larve_anneau: { id: "larve_anneau", nom: "Anneau Larvesque", slot: "anneau", panoplie: "larve", rolls: { vitalite: [16, 20], chance: [8, 12] } },
  larve_arme: { id: "larve_arme", nom: "Dard de la Shin Larve", slot: "arme", panoplie: "larve", rolls: { chance: [11, 15] }, attaque: { coutPA: 5, baseMin: 21, baseMax: 29, scaling: 0.5 } },

  // ===== Panoplie du Corailleur (Grotte Hesque : chance/eau, 2e set Eau après le Paysan) =====
  corailleur_coiffe: { id: "corailleur_coiffe", nom: "Coiffe de Corail", slot: "coiffe", panoplie: "corailleur", rolls: { chance: [14, 18], vitalite: [12, 16] } },
  corailleur_cape: { id: "corailleur_cape", nom: "Cape Récifale", slot: "cape", panoplie: "corailleur", rolls: { chance: [12, 16], vitalite: [14, 18] } },
  corailleur_anneau: { id: "corailleur_anneau", nom: "Anneau de Nacre", slot: "anneau", panoplie: "corailleur", rolls: { chance: [12, 16] } },
  corailleur_arme: { id: "corailleur_arme", nom: "Rostre du Magistral", slot: "arme", panoplie: "corailleur", rolls: { chance: [8, 12] }, attaque: { coutPA: 5, baseMin: 22, baseMax: 31, scaling: 0.52 } },

  // ===== Panoplie du Kwak (Nid du Kwakwa : toutes carac — meilleur set de la T1) =====
  kwak_coiffe: { id: "kwak_coiffe", nom: "Coiffe du Kwak", slot: "coiffe", panoplie: "kwak", rolls: { force: [8, 13], intelligence: [8, 13], agilite: [8, 13], chance: [8, 13] } },
  kwak_cape: { id: "kwak_cape", nom: "Cape du Kwak", slot: "cape", panoplie: "kwak", rolls: { force: [8, 13], intelligence: [8, 13], agilite: [8, 13], chance: [8, 13], vitalite: [11, 15] } },
  kwak_anneau: { id: "kwak_anneau", nom: "Anneau du Kwak", slot: "anneau", panoplie: "kwak", rolls: { force: [6, 10], intelligence: [6, 10], agilite: [6, 10], chance: [6, 10] } },
  kwak_arme: { id: "kwak_arme", nom: "Bec du Kwakwa", slot: "arme", panoplie: "kwak", rolls: { vitalite: [16, 20] }, attaque: { coutPA: 5, baseMin: 24, baseMax: 33, scaling: 0.55 } },
};
// objets à rareté (générés depuis scripts/items.csv — voir import-items.mjs)
Object.assign(ITEMS, ITEMS_TOILES);

/** Pool d'objets à rareté d'une zone (toile = index+1 dans l'ordre de jeu t1) ; null = zone legacy. */
export function butinToile(zoneId: string): string[] | null {
  const idx = TRANCHES[0].zones.indexOf(zoneId);
  if (idx < 0) return null;
  return BUTIN_TOILES[idx + 1] ?? null;
}

// Sets de 4 pièces : bonus à 2/4 (moitié / complet).
export const PANOPLIES: Record<string, Panoplie> = {
  aventurier: {
    id: "aventurier", nom: "Panoplie de l'Aventurier",
    pieces: ["aventurier_coiffe", "aventurier_cape", "aventurier_anneau", "aventurier_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 10 } },
      { seuil: 4, stats: { vitalite: 15 }, resistances: { terre: 0.05, feu: 0.05, eau: 0.05, air: 0.05 } },
    ],
  },
  paysan: {
    id: "paysan", nom: "Panoplie du Paysan",
    pieces: ["paysan_coiffe", "paysan_cape", "paysan_anneau", "paysan_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 12, chance: 8 } },
      { seuil: 4, stats: { vitalite: 18, prospection: 30 } },
    ],
  },
  bouftou: {
    id: "bouftou", nom: "Panoplie du Bouftou",
    pieces: ["bouftou_coiffe", "bouftou_cape", "bouftou_anneau", "bouftou_arme"],
    bonus: [
      { seuil: 2, stats: { force: 12 }, pvBonus: 15 },
      { seuil: 4, stats: { force: 22 }, resistances: { terre: 0.12 } },
    ],
  },
  tofu: {
    id: "tofu", nom: "Panoplie du Tofu",
    pieces: ["tofu_coiffe", "tofu_cape", "tofu_anneau", "tofu_arme"],
    bonus: [
      { seuil: 2, stats: { agilite: 12 }, pvBonus: 12 },
      { seuil: 4, stats: { agilite: 22 }, resistances: { air: 0.12 } },
    ],
  },
  scarafeuille: {
    id: "scarafeuille", nom: "Panoplie du Scarafeuille",
    pieces: ["scarafeuille_coiffe", "scarafeuille_cape", "scarafeuille_anneau", "scarafeuille_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 12 }, resistances: { terre: 0.04, feu: 0.04, eau: 0.04, air: 0.04 } },
      { seuil: 4, pvBonus: 20, resistances: { terre: 0.06, feu: 0.06, eau: 0.06, air: 0.06 } },
    ],
  },
  forgeron: {
    id: "forgeron", nom: "Panoplie du Forgeron",
    pieces: ["forgeron_coiffe", "forgeron_cape", "forgeron_anneau", "forgeron_arme"],
    bonus: [
      { seuil: 2, stats: { force: 12 }, pvBonus: 15 },
      { seuil: 4, stats: { force: 18, prospection: 40 } },
    ],
  },
  gladiateur: {
    id: "gladiateur", nom: "Panoplie du Gladiateur",
    pieces: ["gladiateur_coiffe", "gladiateur_cape", "gladiateur_anneau", "gladiateur_arme"],
    bonus: [
      { seuil: 2, stats: { force: 8, agilite: 8 } },
      { seuil: 4, stats: { force: 14, agilite: 14 }, pvBonus: 15 },
    ],
  },
  kankreblath: {
    id: "kankreblath", nom: "Panoplie de Kankreblath",
    pieces: ["kankreblath_coiffe", "kankreblath_cape", "kankreblath_anneau", "kankreblath_arme"],
    bonus: [
      { seuil: 2, stats: { intelligence: 10 }, pvBonus: 10 },
      { seuil: 4, stats: { intelligence: 20 }, resistances: { feu: 0.1 } },
    ],
  },
  fantome: {
    id: "fantome", nom: "Panoplie Fantomatique",
    pieces: ["fantome_coiffe", "fantome_cape", "fantome_anneau", "fantome_arme"],
    bonus: [
      { seuil: 2, stats: { agilite: 10 }, pvBonus: 10 },
      { seuil: 4, stats: { agilite: 20 }, resistances: { air: 0.1 } },
    ],
  },
  larve: {
    id: "larve", nom: "Panoplie de la Larve",
    pieces: ["larve_coiffe", "larve_cape", "larve_anneau", "larve_arme"],
    bonus: [
      { seuil: 2, stats: { vitalite: 14 }, resistances: { terre: 0.04, feu: 0.04, eau: 0.04, air: 0.04 } },
      { seuil: 4, pvBonus: 25, resistances: { terre: 0.07, feu: 0.07, eau: 0.07, air: 0.07 } },
    ],
  },
  corailleur: {
    id: "corailleur", nom: "Panoplie du Corailleur",
    pieces: ["corailleur_coiffe", "corailleur_cape", "corailleur_anneau", "corailleur_arme"],
    bonus: [
      { seuil: 2, stats: { chance: 12 }, pvBonus: 12 },
      { seuil: 4, stats: { chance: 20 }, resistances: { eau: 0.12 } },
    ],
  },
  kwak: {
    id: "kwak", nom: "Panoplie du Kwak",
    pieces: ["kwak_coiffe", "kwak_cape", "kwak_anneau", "kwak_arme"],
    bonus: [
      { seuil: 2, stats: { force: 8, intelligence: 8, agilite: 8, chance: 8 } },
      { seuil: 4, stats: { force: 14, intelligence: 14, agilite: 14, chance: 14 }, resistances: { terre: 0.06, feu: 0.06, eau: 0.06, air: 0.06 } },
    ],
  },
};

/** Panoplie qui droppe dans chaque zone (id de zone → id de panoplie). */
export const BUTIN_ZONE: Record<string, string> = {
  incarnam: "aventurier",
  astrub: "paysan",
  tainela: "bouftou",
  tofus: "tofu",
  scarafeuilles: "scarafeuille",
  forgerons: "forgeron",
  akademie: "gladiateur",
  kankreblath: "kankreblath",
  maison_fantome: "fantome",
  larves: "larve",
  grotte_hesque: "corailleur",
  kwakwa: "kwak",
};

/** Taux de drop par victoire et par pièce éligible (tunable). */
export const DROP = {
  taux: { combat: 0.2, combat_dur: 0.32, donjon: 0.5 } as Record<string, number>,
  coefProspection: 0.001, // dropChance ×= 1 + min(cap, prospectionÉquipe × coef)
  capProspection: 0.75,
};

/** Chance qu'un boss de zone lâche son Dofus (tunable). */
export const DOFUS_DROP_RATE = 0.01;

// --- Modificateurs d'élites (cases « combat dur ») ------------------------------
/** Chaque combat dur tire un modificateur : toute la meute est boostée, et la
 *  récompense grimpe (butin au taux donjon). Appliqué par appliquerModificateurElite. */
export interface ModificateurElite {
  id: string;
  nom: string; // suffixe du titre de la rencontre
  desc: string;
  statMult?: number; // multiplie les stats OFFENSIVES (pas la vitalité)
  pvMult?: number;
  resAll?: number;
  initBonus?: number;
  paBonus?: number;
}
export const MODIFICATEURS_ELITE: ModificateurElite[] = [
  { id: "enrage", nom: "Enragés", desc: "+35 % aux caractéristiques offensives", statMult: 1.35 },
  { id: "cuirasse", nom: "Cuirassés", desc: "+30 % de PV et +10 % de résistances", pvMult: 1.3, resAll: 0.1 },
  { id: "veloce", nom: "Véloces", desc: "+6 d'initiative et +1 PA", initBonus: 6, paBonus: 1 },
];

// --- Archimonstres & Dofus Ocre ----------------------------------------------
/** Paramètres des Archimonstres (variante rare et boostée, capturable). */
export const ARCHI = {
  chance: 0.01, // probabilité par ennemi d'apparaître en Archimonstre

  pvMult: 2, // multiplicateur de PV
  statMult: 1.5, // multiplicateur des caractéristiques
};

/** Paliers du Dofus Ocre : tous les 50 archis (valeur TOTALE du Dofus à ce palier). */
export interface OcrePalier { seuil: number; paBonus: number; degats: number }
export const OCRE_PALIERS: OcrePalier[] = [
  { seuil: 50, paBonus: 1, degats: 0 },
  { seuil: 100, paBonus: 2, degats: 0.1 },
  { seuil: 150, paBonus: 2, degats: 0.2 },
  { seuil: 200, paBonus: 3, degats: 0.2 },
  { seuil: 250, paBonus: 3, degats: 0.3 },
];

/** Sous-dossier d'icône de chaque sort (rangé par classe propriétaire ; sorts de mobs → « monstres »). */
export const SORT_DOSSIER: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of Object.values(CLASSES)) for (const s of c.sorts) m[s] = c.id;
  for (const mon of Object.values(MONSTRES)) for (const s of mon.sorts) if (!(s in m)) m[s] = "monstres";
  return m;
})();

/** Espèces de monstres apparaissant dans une zone (uniques) — pour l'encyclopédie. */
export function monstresDeZone(zone: ZoneDef): string[] {
  const combatIds = [...zone.pools.normales, ...zone.pools.elite, zone.pools.boss];
  const ids = new Set<string>();
  for (const cid of combatIds) {
    for (const e of COMBATS[cid]?.ennemis ?? []) ids.add(e.monstre);
  }
  return [...ids];
}
