// =============================================================================
//  items_gen.ts — AUTO-GÉNÉRÉ par scripts/import-items.mjs depuis items.csv.
//  NE PAS ÉDITER À LA MAIN : modifier le CSV puis relancer l'import.
// =============================================================================
import type { Item } from "./types";

/** Objets à rareté (stats fixes par palier), par id. */
export const ITEMS_TOILES: Record<string, Item> = {
  "chapeau_de_l_aventurier": {
    "id": "chapeau_de_l_aventurier",
    "nom": "Chapeau de l'Aventurier",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 4
        },
        "adaptatif": 2,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 6
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 5,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 12,
          "crit": 2
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03
        }
      }
    }
  },
  "cape_de_l_aventurier": {
    "id": "cape_de_l_aventurier",
    "nom": "Cape de l'Aventurier",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "prospection": 2
        },
        "adaptatif": 1,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "prospection": 3
        },
        "adaptatif": 2,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12,
          "prospection": 4
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20,
          "prospection": 6
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03
        }
      }
    }
  },
  "anneau_de_l_aventurier": {
    "id": "anneau_de_l_aventurier",
    "nom": "Anneau de l'Aventurier",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 3
      },
      "rare": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 4
      },
      "epique": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 5
      },
      "legendaire": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 7
      }
    }
  },
  "epee_de_l_aventurier": {
    "id": "epee_de_l_aventurier",
    "nom": "Épée de l'Aventurier",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 4,
          "crit": 1
        },
        "adaptatif": 4,
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "rare": {
        "stats": {
          "vitalite": 6,
          "crit": 1
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "epique": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 12,
          "scaling": 0.3
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 12,
          "crit": 2
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 13,
          "scaling": 0.32
        }
      }
    }
  },
  "coiffe_champ_champ": {
    "id": "coiffe_champ_champ",
    "nom": "Coiffe Champ Champ",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.01,
          "eau": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 1,
          "prospection": 3
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.02,
          "eau": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12,
          "crit": 2,
          "prospection": 4
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.03,
          "eau": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 16,
          "crit": 3,
          "prospection": 6
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.04,
          "eau": 0.04
        }
      }
    }
  },
  "cape_champ_champ": {
    "id": "cape_champ_champ",
    "nom": "Cape Champ Champ",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "adaptatif": 2,
        "resistances": {
          "terre": 0.01,
          "eau": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 10,
          "crit": 1,
          "prospection": 3
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.02,
          "eau": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 14,
          "crit": 2,
          "prospection": 5
        },
        "adaptatif": 5,
        "resistances": {
          "terre": 0.03,
          "eau": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 22,
          "crit": 3,
          "prospection": 7
        },
        "adaptatif": 7,
        "resistances": {
          "terre": 0.04,
          "eau": 0.04
        }
      }
    }
  },
  "anneau_champ_champ": {
    "id": "anneau_champ_champ",
    "nom": "Anneau Champ Champ",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 4
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 5
      },
      "epique": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 6
      },
      "legendaire": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 8
      }
    }
  },
  "baton_carnivore": {
    "id": "baton_carnivore",
    "nom": "Bâton Carnivore",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1
        },
        "adaptatif": 5,
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 7,
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      },
      "epique": {
        "stats": {
          "vitalite": 10,
          "crit": 2
        },
        "adaptatif": 9,
        "attaque": {
          "coutPA": 4,
          "baseMin": 11,
          "baseMax": 16,
          "scaling": 0.35
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 12,
          "crit": 3
        },
        "adaptatif": 12,
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 18,
          "scaling": 0.38
        }
      }
    }
  },
  "anneau_du_bandit": {
    "id": "anneau_du_bandit",
    "nom": "Anneau du Bandit",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 3,
          "prospection": 2
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 4,
          "prospection": 3
        },
        "adaptatif": 2
      },
      "epique": {
        "stats": {
          "vitalite": 10,
          "crit": 5,
          "prospection": 4
        },
        "adaptatif": 3
      },
      "legendaire": {
        "stats": {
          "vitalite": 12,
          "crit": 7,
          "prospection": 6
        },
        "adaptatif": 4
      }
    },
    "source": "elite"
  },
  "arc_en_racine_d_abraknyde": {
    "id": "arc_en_racine_d_abraknyde",
    "nom": "Arc en Racine d'Abraknyde",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": -20
        },
        "resistances": {
          "terre": -0.05,
          "feu": -0.05,
          "eau": -0.05,
          "air": -0.05
        },
        "pa": 1,
        "attaque": {
          "coutPA": 3,
          "baseMin": 5,
          "baseMax": 8,
          "scaling": 0.25,
          "cible": "ennemi_tous"
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": -10
        },
        "resistances": {
          "terre": -0.02,
          "feu": -0.02,
          "eau": -0.02,
          "air": -0.02
        },
        "pa": 1,
        "attaque": {
          "coutPA": 3,
          "baseMin": 5,
          "baseMax": 8,
          "scaling": 0.25,
          "cible": "ennemi_tous"
        }
      }
    },
    "source": "elite"
  },
  "coiffe_bouftou": {
    "id": "coiffe_bouftou",
    "nom": "Coiffe Bouftou",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1,
          "prospection": 2
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "rare": {
        "stats": {
          "crit": 1,
          "prospection": 3
        },
        "adaptatif": 5,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "epique": {
        "stats": {
          "crit": 2,
          "prospection": 5
        },
        "adaptatif": 7,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "crit": 4,
          "prospection": 7
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04
        }
      }
    }
  },
  "cape_du_bouftou": {
    "id": "cape_du_bouftou",
    "nom": "Cape du Bouftou",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "prospection": 3
        },
        "adaptatif": 2,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "prospection": 4
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 20,
          "prospection": 6
        },
        "adaptatif": 5,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30,
          "prospection": 8
        },
        "adaptatif": 7,
        "resistances": {
          "terre": 0.05,
          "feu": 0.05
        }
      }
    }
  },
  "anneau_bouftou": {
    "id": "anneau_bouftou",
    "nom": "Anneau Bouftou",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 4
      },
      "rare": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 5
      },
      "epique": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 7
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 9
      }
    }
  },
  "marteau_bouftou": {
    "id": "marteau_bouftou",
    "nom": "Marteau Bouftou",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 7,
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 17,
          "scaling": 0.4
        }
      },
      "rare": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 9,
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 17,
          "scaling": 0.4
        }
      },
      "epique": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 11,
        "attaque": {
          "coutPA": 4,
          "baseMin": 13,
          "baseMax": 18,
          "scaling": 0.4
        }
      },
      "legendaire": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 14,
        "attaque": {
          "coutPA": 4,
          "baseMin": 14,
          "baseMax": 20,
          "scaling": 0.42
        }
      }
    }
  },
  "boufcoiffe_royale": {
    "id": "boufcoiffe_royale",
    "nom": "Boufcoiffe Royale",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 12,
          "crit": 1
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 15,
          "crit": 2
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 22,
          "crit": 3
        },
        "adaptatif": 16,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      }
    },
    "source": "boss"
  },
  "boufcape_royale": {
    "id": "boufcape_royale",
    "nom": "Boufcape Royale",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 2,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "rare": {
        "stats": {
          "vitalite": 20
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 30
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 45
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04
        }
      }
    },
    "source": "boss"
  },
  "alliance_de_silimelle": {
    "id": "alliance_de_silimelle",
    "nom": "Alliance de Silimelle",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "prospection": 2
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 10,
          "prospection": 4
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 14,
          "prospection": 6
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20,
          "prospection": 9
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      }
    },
    "source": "elite"
  },
  "arc_en_corne_de_bouftou": {
    "id": "arc_en_corne_de_bouftou",
    "nom": "Arc en Corne de Bouftou",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 9,
          "baseMax": 13,
          "scaling": 0.32,
          "cible": "ennemi_tous"
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 9,
          "baseMax": 13,
          "scaling": 0.32,
          "cible": "ennemi_tous"
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12,
          "crit": 1
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 14,
          "scaling": 0.34,
          "cible": "ennemi_tous"
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 16,
          "crit": 2
        },
        "adaptatif": 12,
        "attaque": {
          "coutPA": 4,
          "baseMin": 11,
          "baseMax": 15,
          "scaling": 0.35,
          "cible": "ennemi_tous"
        }
      }
    },
    "source": "elite"
  },
  "ergot_mina": {
    "id": "ergot_mina",
    "nom": "Ergot Mina",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "prospection": 4
        },
        "adaptatif": 1,
        "attaque": {
          "coutPA": 3,
          "baseMin": 6,
          "baseMax": 9,
          "scaling": 0.3,
          "vampirisme": 0.5
        }
      },
      "rare": {
        "stats": {
          "prospection": 6
        },
        "adaptatif": 2,
        "attaque": {
          "coutPA": 3,
          "baseMin": 6,
          "baseMax": 9,
          "scaling": 0.3,
          "vampirisme": 0.5
        }
      },
      "epique": {
        "stats": {
          "prospection": 8
        },
        "adaptatif": 3,
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 10,
          "scaling": 0.32,
          "vampirisme": 0.5
        }
      },
      "legendaire": {
        "stats": {
          "prospection": 12
        },
        "adaptatif": 5,
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 12,
          "scaling": 0.34,
          "vampirisme": 0.5
        }
      }
    },
    "source": "elite"
  },
  "coiffe_du_tofu": {
    "id": "coiffe_du_tofu",
    "nom": "Coiffe du Tofu",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {},
        "adaptatif": 6,
        "resistances": {
          "air": 0.02
        }
      },
      "rare": {
        "stats": {},
        "adaptatif": 8,
        "resistances": {
          "air": 0.04
        }
      },
      "epique": {
        "stats": {},
        "adaptatif": 10,
        "resistances": {
          "air": 0.06
        }
      },
      "legendaire": {
        "stats": {},
        "adaptatif": 16,
        "resistances": {
          "air": 0.08
        }
      }
    }
  },
  "cape_du_tofu": {
    "id": "cape_du_tofu",
    "nom": "Cape du Tofu",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {},
        "adaptatif": 4,
        "resistances": {
          "air": 0.02
        }
      },
      "rare": {
        "stats": {},
        "adaptatif": 6,
        "resistances": {
          "air": 0.04
        }
      },
      "epique": {
        "stats": {},
        "adaptatif": 8,
        "resistances": {
          "air": 0.06
        }
      },
      "legendaire": {
        "stats": {},
        "adaptatif": 12,
        "resistances": {
          "air": 0.08
        }
      }
    }
  },
  "anneau_du_tofu": {
    "id": "anneau_du_tofu",
    "nom": "Anneau du Tofu",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 3
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 3
      },
      "legendaire": {
        "stats": {
          "crit": 5
        },
        "adaptatif": 4
      }
    }
  },
  "baguette_du_tofu": {
    "id": "baguette_du_tofu",
    "nom": "Baguette du Tofu",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 2,
          "crit": 1
        },
        "adaptatif": 3,
        "attaque": {
          "coutPA": 4,
          "baseMin": 13,
          "baseMax": 18,
          "scaling": 0.4
        }
      },
      "rare": {
        "stats": {
          "vitalite": 4,
          "crit": 1
        },
        "adaptatif": 4,
        "attaque": {
          "coutPA": 4,
          "baseMin": 13,
          "baseMax": 18,
          "scaling": 0.4
        }
      },
      "epique": {
        "stats": {
          "vitalite": 6,
          "crit": 1
        },
        "adaptatif": 5,
        "attaque": {
          "coutPA": 4,
          "baseMin": 14,
          "baseMax": 19,
          "scaling": 0.4
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 10,
          "crit": 2
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 21,
          "scaling": 0.42
        }
      }
    }
  },
  "le_houde": {
    "id": "le_houde",
    "nom": "Le Houde",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 16
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 20
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 30
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 45
        },
        "resistances": {
          "terre": 0.04,
          "feu": 0.04,
          "eau": 0.04
        }
      }
    }
  },
  "baton_du_maitre_des_tabis": {
    "id": "baton_du_maitre_des_tabis",
    "nom": "Bâton du Maître des Tabis",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "crit": 1
        },
        "resistances": {
          "terre": 0.01,
          "eau": 0.02,
          "air": 0.02
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 16,
          "scaling": 0.38
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "crit": 1
        },
        "resistances": {
          "terre": 0.01,
          "eau": 0.03,
          "air": 0.04
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 16,
          "scaling": 0.38
        }
      },
      "epique": {
        "stats": {
          "vitalite": 18,
          "crit": 2
        },
        "resistances": {
          "terre": 0.02,
          "eau": 0.05,
          "air": 0.06
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 13,
          "baseMax": 17,
          "scaling": 0.38
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 25,
          "crit": 3
        },
        "resistances": {
          "terre": 0.03,
          "eau": 0.06,
          "air": 0.08
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 14,
          "baseMax": 19,
          "scaling": 0.4
        }
      }
    }
  },
  "chance_d_ecaflip": {
    "id": "chance_d_ecaflip",
    "nom": "Chance d'Ecaflip",
    "slot": "anneau",
    "tiers": {
      "epique": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 7
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 10
      }
    },
    "source": "boss",
    "paGamble": {
      "pPlus": 0.3333333333333333,
      "plus": 1,
      "moins": 1
    }
  },
  "cape_edepee": {
    "id": "cape_edepee",
    "nom": "Cape Edepee",
    "slot": "cape",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 14,
          "crit": 3
        },
        "adaptatif": 12,
        "resistances": {
          "terre": -0.06,
          "feu": -0.06,
          "eau": -0.06,
          "air": -0.06
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20,
          "crit": 5
        },
        "adaptatif": 20,
        "resistances": {
          "terre": -0.04,
          "feu": -0.04,
          "eau": -0.04,
          "air": -0.04
        }
      }
    },
    "source": "boss",
    "ligneAvant": true
  }
};

/** Pools par toile et par source de drop (normales / élites / boss). */
export interface PoolsToile { normales: string[]; elites: string[]; boss: string[] }
export const BUTIN_TOILES: Record<number, PoolsToile> = {
  "1": {
    "normales": [
      "chapeau_de_l_aventurier",
      "cape_de_l_aventurier",
      "anneau_de_l_aventurier",
      "epee_de_l_aventurier"
    ],
    "elites": [],
    "boss": []
  },
  "2": {
    "normales": [
      "coiffe_champ_champ",
      "cape_champ_champ",
      "anneau_champ_champ",
      "baton_carnivore"
    ],
    "elites": [
      "anneau_du_bandit",
      "arc_en_racine_d_abraknyde"
    ],
    "boss": []
  },
  "3": {
    "normales": [
      "coiffe_bouftou",
      "cape_du_bouftou",
      "anneau_bouftou",
      "marteau_bouftou"
    ],
    "elites": [
      "alliance_de_silimelle",
      "arc_en_corne_de_bouftou",
      "ergot_mina"
    ],
    "boss": [
      "boufcoiffe_royale",
      "boufcape_royale"
    ]
  },
  "4": {
    "normales": [
      "coiffe_du_tofu",
      "cape_du_tofu",
      "anneau_du_tofu",
      "baguette_du_tofu",
      "le_houde",
      "baton_du_maitre_des_tabis"
    ],
    "elites": [],
    "boss": [
      "chance_d_ecaflip",
      "cape_edepee"
    ]
  }
};
