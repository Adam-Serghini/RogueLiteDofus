// =============================================================================
//  data.ts — Données du jeu (data-driven)
//  Classes, sorts, monstres et séquence de la run. Aucune logique ici.
// =============================================================================
import type { Classe, Item, Monstre, Panoplie, Spell } from "./types";

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
    desc: "Gros dégâts ; chance (scale Wakfu) de retirer 3 PA à la cible au prochain tour.",
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
    cible: "allie_tous", baseMin: 8, baseMax: 12, scaling: 0,
    desc: "Soin faible sur toute l'équipe.",
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
      { stat: "wakfu", valeur: 5, duree: 2 },
      { stat: "stasis", valeur: 5, duree: 2 },
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
    cible: "ennemi_ligne", baseMin: 20, baseMax: 28, scaling: 0.6,
    desc: "Attaque dévastatrice du boss.",
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
    id: "kardorim", nom: "Kardorim", pv: 130,
    stats: { force: 30, intelligence: 38, agilite: 20, vitalite: 55 },
    pa: 6, initiative: 9,
    resistances: { feu: 0.25, air: 0.1, stasis: 0.1, terre: -0.2, eau: -0.15 },
    sorts: ["charge", "morsure"], ia: "agressif",
    boss: true, dofus: "dofus_turquoise",
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
    id: "tournesol_affame", nom: "Tournesol Affamé", pv: 200,
    stats: { force: 20, intelligence: 55, agilite: 18, vitalite: 75 },
    pa: 6, initiative: 9,
    resistances: { terre: 0.25, feu: 0.25, wakfu: 0.2, stasis: 0.2, eau: -0.1, air: -0.15 },
    sorts: ["charge", "picotement"], ia: "agressif",
    boss: true, dofus: "dofus_emeraude",
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
    id: "bouftou_royal", nom: "Bouftou Royal", pv: 240,
    stats: { force: 56, intelligence: 15, agilite: 20, vitalite: 80 },
    pa: 6, initiative: 8,
    resistances: { eau: 0.25, terre: 0.2, feu: 0.2, wakfu: 0.25, stasis: 0.25, air: 0.05 },
    sorts: ["charge", "morsure"], ia: "agressif",
    boss: true, dofus: "dofus_pourpre",
    img: "/assets/monstres/bouftou_royal.png",
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
// Stats en FOURCHETTES (rolls) tirées au drop — valeurs réelles DofusDB,
// filtrées aux stats gérées par le moteur (vita/force/int/agi/chance/prospection).
export const ITEMS: Record<string, Item> = {
  // ===== Panoplie de l'Aventurier (Incarnam, set #5 : +toutes carac) =====
  aventurier_amulette: { id: "aventurier_amulette", nom: "Amulette de l'Aventurier", slot: "amulette", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_coiffe: { id: "aventurier_coiffe", nom: "Chapeau de l'Aventurier", slot: "coiffe", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_cape: { id: "aventurier_cape", nom: "Cape de l'Aventurier", slot: "cape", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_ceinture: { id: "aventurier_ceinture", nom: "Ceinture de l'Aventurier", slot: "ceinture", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_bottes: { id: "aventurier_bottes", nom: "Bottes de l'Aventurier", slot: "bottes", panoplie: "aventurier", rolls: { force: [0, 5], intelligence: [0, 5], chance: [0, 5], agilite: [0, 5] } },
  aventurier_anneau: { id: "aventurier_anneau", nom: "Anneau de l'Aventurier", slot: "anneau", panoplie: "aventurier", rolls: { force: [0, 2], intelligence: [0, 2], chance: [0, 2], agilite: [0, 2] } },

  // ===== Panoplie du Paysan (Champs d'Astrub, set #47 : vita / chance) =====
  paysan_amulette: { id: "paysan_amulette", nom: "Amulette Paysanne", slot: "amulette", panoplie: "paysan", rolls: { chance: [11, 15] } },
  paysan_coiffe: { id: "paysan_coiffe", nom: "Bob du Paysan", slot: "coiffe", panoplie: "paysan", rolls: { vitalite: [26, 30] } },
  paysan_cape: { id: "paysan_cape", nom: "Sac du Paysan", slot: "cape", panoplie: "paysan", rolls: { chance: [16, 20] } },
  paysan_ceinture: { id: "paysan_ceinture", nom: "Ceinturemuda du Paysan", slot: "ceinture", panoplie: "paysan", rolls: { vitalite: [16, 20], chance: [16, 20] } },
  paysan_bottes: { id: "paysan_bottes", nom: "Bottes Paysannes", slot: "bottes", panoplie: "paysan", rolls: { vitalite: [16, 20], chance: [7, 10] } },
  paysan_anneau: { id: "paysan_anneau", nom: "Mitaines Mitées du Paysan", slot: "anneau", panoplie: "paysan", rolls: {} },
  paysan_arme: { id: "paysan_arme", nom: "Faux usée du Paysan", slot: "arme", panoplie: "paysan", rolls: { vitalite: [16, 20] } },

  // ===== Panoplie du Bouftou (Tainéla, set #1 : vita/force/int) =====
  bouftou_amulette: { id: "bouftou_amulette", nom: "Amulette du Bouftou", slot: "amulette", panoplie: "bouftou", rolls: { vitalite: [11, 15], force: [11, 15], intelligence: [11, 15] } },
  bouftou_coiffe: { id: "bouftou_coiffe", nom: "Coiffe du Bouftou", slot: "coiffe", panoplie: "bouftou", rolls: { force: [16, 20], intelligence: [16, 20] } },
  bouftou_cape: { id: "bouftou_cape", nom: "Cape Bouffante", slot: "cape", panoplie: "bouftou", rolls: { vitalite: [36, 40] } },
  bouftou_ceinture: { id: "bouftou_ceinture", nom: "Ceinture du Bouftou", slot: "ceinture", panoplie: "bouftou", rolls: { force: [11, 15], intelligence: [11, 15] } },
  bouftou_bottes: { id: "bouftou_bottes", nom: "Boufbottes", slot: "bottes", panoplie: "bouftou", rolls: { vitalite: [16, 20] } },
  bouftou_anneau: { id: "bouftou_anneau", nom: "Anneau de Bouze le Clerc", slot: "anneau", panoplie: "bouftou", rolls: { vitalite: [21, 30] } },
  bouftou_arme: { id: "bouftou_arme", nom: "Marteau du Bouftou", slot: "arme", panoplie: "bouftou", rolls: { vitalite: [16, 20] } },
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
  paysan: {
    id: "paysan", nom: "Panoplie du Paysan",
    pieces: ["paysan_amulette", "paysan_coiffe", "paysan_cape", "paysan_ceinture", "paysan_bottes", "paysan_anneau", "paysan_arme"],
    bonus: [
      { seuil: 3, stats: { vitalite: 12, chance: 8 } },
      { seuil: 6, stats: { vitalite: 18, prospection: 30 } },
    ],
  },
  bouftou: {
    id: "bouftou", nom: "Panoplie du Bouftou",
    pieces: ["bouftou_amulette", "bouftou_coiffe", "bouftou_cape", "bouftou_ceinture", "bouftou_bottes", "bouftou_anneau", "bouftou_arme"],
    bonus: [
      { seuil: 3, stats: { force: 15 }, pvBonus: 20 },
      { seuil: 6, stats: { force: 30 }, resistances: { terre: 0.15 } },
    ],
  },
};

/** Panoplie qui droppe dans chaque zone (id de zone → id de panoplie). */
export const BUTIN_ZONE: Record<string, string> = {
  incarnam: "aventurier",
  astrub: "paysan",
  tainela: "bouftou",
};

/** Taux de drop par victoire et par pièce éligible (tunable). */
export const DROP = {
  taux: { combat: 0.25, combat_dur: 0.4, donjon: 0.8 } as Record<string, number>,
  coefProspection: 0.001, // dropChance ×= 1 + min(cap, prospectionÉquipe × coef)
  capProspection: 0.75,
};

// --- Archimonstres & Dofus Ocre ----------------------------------------------
/** Paramètres des Archimonstres (variante rare et boostée, capturable). */
export const ARCHI = {
  chance: 0.08, // probabilité par ennemi d'apparaître en Archimonstre

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
