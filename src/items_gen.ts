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
  },
  "chapeau_du_directeur_grunob": {
    "id": "chapeau_du_directeur_grunob",
    "nom": "Chapeau du Directeur Grunob",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 4,
          "prospection": 2
        },
        "adaptatif": 6,
        "resistances": {
          "eau": 0.02,
          "air": 0.02
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "prospection": 4
        },
        "adaptatif": 8,
        "resistances": {
          "eau": 0.02,
          "air": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12,
          "prospection": 6
        },
        "adaptatif": 10,
        "resistances": {
          "eau": 0.03,
          "air": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 16,
          "prospection": 8
        },
        "adaptatif": 16,
        "resistances": {
          "eau": 0.05,
          "air": 0.05
        }
      }
    }
  },
  "faux_du_directeur_grunob": {
    "id": "faux_du_directeur_grunob",
    "nom": "Faux du Directeur Grunob",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1
        },
        "adaptatif": 3,
        "attaque": {
          "coutPA": 4,
          "baseMin": 14,
          "baseMax": 19,
          "scaling": 0.42
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 2
        },
        "adaptatif": 4,
        "attaque": {
          "coutPA": 4,
          "baseMin": 14,
          "baseMax": 19,
          "scaling": 0.42
        }
      },
      "epique": {
        "stats": {
          "vitalite": 10,
          "crit": 2
        },
        "adaptatif": 5,
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 20,
          "scaling": 0.42
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 16,
          "crit": 3
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 22,
          "scaling": 0.44
        }
      }
    }
  },
  "bague_rafe": {
    "id": "bague_rafe",
    "nom": "Bague Rafe",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "crit": 2
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "crit": 2
        }
      },
      "epique": {
        "stats": {
          "vitalite": 18,
          "crit": 3
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 25,
          "crit": 5
        }
      }
    }
  },
  "cape_ricefini": {
    "id": "cape_ricefini",
    "nom": "Cape Ricéfini",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "adaptatif": 4
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 1,
          "prospection": 4
        },
        "adaptatif": 6
      },
      "epique": {
        "stats": {
          "vitalite": 10,
          "crit": 1,
          "prospection": 6
        },
        "adaptatif": 8
      },
      "legendaire": {
        "stats": {
          "vitalite": 15,
          "crit": 2,
          "prospection": 8
        },
        "adaptatif": 10
      }
    }
  },
  "abracape": {
    "id": "abracape",
    "nom": "Abracape",
    "slot": "cape",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 10
        },
        "adaptatif": -14,
        "pa": 1
      },
      "legendaire": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": -10,
        "pa": 1
      }
    },
    "source": "boss"
  },
  "dora": {
    "id": "dora",
    "nom": "Dora",
    "slot": "coiffe",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 20,
          "prospection": 6
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30,
          "prospection": 8
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04,
          "eau": 0.04,
          "air": 0.04
        }
      }
    },
    "source": "elite_boss"
  },
  "baton_tont_ata": {
    "id": "baton_tont_ata",
    "nom": "Bâton Tont'Ata",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": -10,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 23,
          "scaling": 0.45
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14
        },
        "adaptatif": -8,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 23,
          "scaling": 0.45
        }
      },
      "epique": {
        "stats": {
          "vitalite": 18
        },
        "adaptatif": -6,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 25,
          "scaling": 0.46
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 26
        },
        "adaptatif": -4,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03,
          "eau": 0.03,
          "air": 0.03
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 27,
          "scaling": 0.48
        }
      }
    },
    "source": "elite_boss"
  },
  "sabre_shodanwa": {
    "id": "sabre_shodanwa",
    "nom": "Sabre Shodanwa",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 6,
          "crit": 4
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 21,
          "scaling": 0.44
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 10,
          "crit": 6
        },
        "adaptatif": 18,
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 23,
          "scaling": 0.46
        }
      }
    },
    "source": "boss",
    "riposteAvant": 0.33
  },
  "casque_noix": {
    "id": "casque_noix",
    "nom": "Casque Noix",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "prospection": 2
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04,
          "eau": -0.04,
          "air": -0.04
        }
      },
      "rare": {
        "stats": {
          "vitalite": 12,
          "prospection": 4
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04,
          "eau": -0.04,
          "air": -0.04
        }
      },
      "epique": {
        "stats": {
          "vitalite": 20,
          "prospection": 6
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.05,
          "feu": 0.05,
          "eau": -0.03,
          "air": -0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30,
          "prospection": 8
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.06,
          "feu": 0.06,
          "eau": -0.02,
          "air": -0.02
        }
      }
    }
  },
  "cape_lumette": {
    "id": "cape_lumette",
    "nom": "Cape Lumette",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "prospection": 2
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04
        }
      },
      "rare": {
        "stats": {
          "vitalite": 12,
          "prospection": 4
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04
        }
      },
      "epique": {
        "stats": {
          "vitalite": 16,
          "prospection": 6
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.05,
          "feu": 0.05
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 22,
          "prospection": 8
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.06,
          "feu": 0.06
        }
      }
    }
  },
  "anneau_bille": {
    "id": "anneau_bille",
    "nom": "Anneau Bille",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6
        },
        "adaptatif": 3,
        "resistances": {
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8
        },
        "adaptatif": 5,
        "resistances": {
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 10
        },
        "adaptatif": 7,
        "resistances": {
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 14
        },
        "adaptatif": 8,
        "resistances": {
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "baguette_cetera": {
    "id": "baguette_cetera",
    "nom": "Baguette Cetera",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10
        },
        "resistances": {
          "terre": -0.04,
          "feu": -0.04,
          "eau": 0.04,
          "air": 0.04
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 20,
          "scaling": 0.42
        }
      },
      "rare": {
        "stats": {
          "vitalite": 12
        },
        "resistances": {
          "terre": -0.04,
          "feu": -0.04,
          "eau": 0.04,
          "air": 0.04
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 20,
          "scaling": 0.42
        }
      },
      "epique": {
        "stats": {
          "vitalite": 16
        },
        "resistances": {
          "terre": -0.03,
          "feu": -0.03,
          "eau": 0.05,
          "air": 0.05
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 21,
          "scaling": 0.44
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30
        },
        "resistances": {
          "terre": -0.02,
          "feu": -0.02,
          "eau": 0.06,
          "air": 0.06
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 23,
          "scaling": 0.44
        }
      }
    }
  },
  "baguette_rikiki": {
    "id": "baguette_rikiki",
    "nom": "Baguette Rikiki",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 8,
          "crit": 2
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 3,
          "baseMin": 10,
          "baseMax": 13,
          "scaling": 0.32
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 12,
          "crit": 4
        },
        "adaptatif": 14,
        "attaque": {
          "coutPA": 3,
          "baseMin": 11,
          "baseMax": 15,
          "scaling": 0.34
        }
      }
    },
    "source": "boss",
    "esquiveArriere": 0.1
  },
  "goyave": {
    "id": "goyave",
    "nom": "Goyave",
    "slot": "coiffe",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 20,
          "prospection": 6
        },
        "adaptatif": 8
      },
      "legendaire": {
        "stats": {
          "vitalite": 40,
          "prospection": 8
        },
        "adaptatif": 12
      }
    },
    "source": "boss",
    "soinDegatsRecus": 0.02
  },
  "couteau_a_stek": {
    "id": "couteau_a_stek",
    "nom": "Couteau à Stek",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 4,
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 12,
          "scaling": 0.3
        }
      },
      "rare": {
        "stats": {
          "vitalite": 10,
          "crit": 2
        },
        "adaptatif": 5,
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 12,
          "scaling": 0.3
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12,
          "crit": 2
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 3,
          "baseMin": 10,
          "baseMax": 13,
          "scaling": 0.32
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 18,
          "crit": 3
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 3,
          "baseMin": 11,
          "baseMax": 15,
          "scaling": 0.34
        }
      }
    },
    "source": "elite"
  },
  "grosse_bagouze_du_parrain": {
    "id": "grosse_bagouze_du_parrain",
    "nom": "Grosse Bagouze du Parrain",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 4
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 6
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 10
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 12
      }
    },
    "source": "elite"
  },
  "shako": {
    "id": "shako",
    "nom": "Shako",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 8
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 10
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 12
      },
      "legendaire": {
        "stats": {
          "crit": 5
        },
        "adaptatif": 20
      }
    }
  },
  "cape_du_boostache": {
    "id": "cape_du_boostache",
    "nom": "Cape du Boostache",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 6
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 8
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 10
      },
      "legendaire": {
        "stats": {
          "crit": 5
        },
        "adaptatif": 14
      }
    }
  },
  "anneau_du_boostache": {
    "id": "anneau_du_boostache",
    "nom": "Anneau du Boostache",
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
  "pelle_du_bois_dormant": {
    "id": "pelle_du_bois_dormant",
    "nom": "Pelle du Bois Dormant",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 4,
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 21,
          "scaling": 0.44
        }
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 21,
          "scaling": 0.44
        }
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 22,
          "scaling": 0.44
        }
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 12,
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 24,
          "scaling": 0.46
        }
      }
    }
  },
  "dagues_eurfolles": {
    "id": "dagues_eurfolles",
    "nom": "Dagues Eurfolles",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 14,
          "prospection": 8
        },
        "adaptatif": 7,
        "attaque": {
          "coutPA": 3,
          "baseMin": 11,
          "baseMax": 14,
          "scaling": 0.34
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20,
          "prospection": 19
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 3,
          "baseMin": 12,
          "baseMax": 16,
          "scaling": 0.36
        }
      }
    },
    "source": "boss",
    "changeLigne": 1
  },
  "cape_du_vampyre": {
    "id": "cape_du_vampyre",
    "nom": "Cape du Vampyre",
    "slot": "cape",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": -16,
          "crit": 1
        },
        "adaptatif": 14
      },
      "legendaire": {
        "stats": {
          "vitalite": -10,
          "crit": 2
        },
        "adaptatif": 22
      }
    },
    "source": "boss"
  },
  "anneau_forrain": {
    "id": "anneau_forrain",
    "nom": "Anneau Forrain",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "prospection": 8
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "prospection": 10
        },
        "adaptatif": 3
      },
      "epique": {
        "stats": {
          "prospection": 12
        },
        "adaptatif": 4
      },
      "legendaire": {
        "stats": {
          "prospection": 16
        },
        "adaptatif": 6
      }
    },
    "source": "elite"
  },
  "masque_traumatisant": {
    "id": "masque_traumatisant",
    "nom": "Masque Traumatisant",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "prospection": 2
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.04,
          "feu": 0.04,
          "air": -0.04
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "prospection": 4
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.05,
          "feu": 0.05,
          "air": -0.04
        }
      },
      "epique": {
        "stats": {
          "vitalite": 18,
          "prospection": 6
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.06,
          "feu": 0.06,
          "air": -0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 22,
          "prospection": 8
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.08,
          "feu": 0.08,
          "air": -0.02
        }
      }
    },
    "source": "elite"
  },
  "scaracoiffe_noire": {
    "id": "scaracoiffe_noire",
    "nom": "Scaracoiffe Noire",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 14,
          "crit": 2,
          "prospection": 4
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 16,
          "crit": 2,
          "prospection": 6
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 20,
          "crit": 3,
          "prospection": 8
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30,
          "crit": 4,
          "prospection": 10
        },
        "adaptatif": 14,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      }
    }
  },
  "scaracape_noire": {
    "id": "scaracape_noire",
    "nom": "Scaracape Noire",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 12,
          "crit": 2,
          "prospection": 2
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "crit": 2,
          "prospection": 4
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 20,
          "crit": 3,
          "prospection": 6
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30,
          "crit": 4,
          "prospection": 8
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      }
    }
  },
  "scaranneau_noir": {
    "id": "scaranneau_noir",
    "nom": "Scaranneau Noir",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6,
          "crit": 1
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8,
          "crit": 1
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12,
          "crit": 2
        },
        "adaptatif": 8,
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
          "crit": 3
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      }
    }
  },
  "baguette_scafeuille": {
    "id": "baguette_scafeuille",
    "nom": "Baguette Scafeuille",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "crit": 1
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 22,
          "scaling": 0.44
        }
      },
      "rare": {
        "stats": {
          "vitalite": 12,
          "crit": 2
        },
        "adaptatif": 7,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 22,
          "scaling": 0.44
        }
      },
      "epique": {
        "stats": {
          "vitalite": 14,
          "crit": 2
        },
        "adaptatif": 9,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 23,
          "scaling": 0.44
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20,
          "crit": 3
        },
        "adaptatif": 11,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 25,
          "scaling": 0.46
        }
      }
    }
  },
  "baguette_ni_ninnin": {
    "id": "baguette_ni_ninnin",
    "nom": "Baguette Ni'ninnin",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": -30,
          "crit": 1
        },
        "adaptatif": 2,
        "pa": 1,
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": -15,
          "crit": 3
        },
        "adaptatif": 6,
        "pa": 1,
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 12,
          "scaling": 0.3
        }
      }
    },
    "source": "boss"
  },
  "palmano": {
    "id": "palmano",
    "nom": "Palmano",
    "slot": "anneau",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 15,
          "prospection": 4
        },
        "resistances": {
          "terre": 0.04,
          "feu": -0.14,
          "eau": 0.04,
          "air": 0.04
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 25,
          "prospection": 8
        },
        "resistances": {
          "terre": 0.06,
          "feu": -0.1,
          "eau": 0.06,
          "air": 0.06
        }
      }
    },
    "source": "boss"
  },
  "anneau_poupayahn": {
    "id": "anneau_poupayahn",
    "nom": "Anneau Poupayahn",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "crit": 2
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "crit": 2
        },
        "adaptatif": 3
      },
      "epique": {
        "stats": {
          "vitalite": 18,
          "crit": 3
        },
        "adaptatif": 4
      },
      "legendaire": {
        "stats": {
          "vitalite": 25,
          "crit": 5
        },
        "adaptatif": 6
      }
    },
    "source": "elite"
  },
  "la_guenille": {
    "id": "la_guenille",
    "nom": "La Guenille",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 4,
          "prospection": 2
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "crit": 6,
          "prospection": 4
        },
        "adaptatif": 3
      },
      "epique": {
        "stats": {
          "crit": 8,
          "prospection": 6
        },
        "adaptatif": 4
      },
      "legendaire": {
        "stats": {
          "crit": 12,
          "prospection": 8
        },
        "adaptatif": 6
      }
    },
    "source": "elite"
  },
  "vegacoiffe": {
    "id": "vegacoiffe",
    "nom": "Vegacoiffe",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "prospection": 6
        },
        "adaptatif": 3
      },
      "rare": {
        "stats": {
          "prospection": 8
        },
        "adaptatif": 5
      },
      "epique": {
        "stats": {
          "prospection": 10
        },
        "adaptatif": 7
      },
      "legendaire": {
        "stats": {
          "prospection": 14
        },
        "adaptatif": 10
      }
    }
  },
  "vegacape": {
    "id": "vegacape",
    "nom": "Vegacape",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "prospection": 6
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "prospection": 8
        },
        "adaptatif": 4
      },
      "epique": {
        "stats": {
          "prospection": 10
        },
        "adaptatif": 6
      },
      "legendaire": {
        "stats": {
          "prospection": 14
        },
        "adaptatif": 8
      }
    }
  },
  "veganneau": {
    "id": "veganneau",
    "nom": "Veganneau",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "prospection": 2
        },
        "adaptatif": 2
      },
      "rare": {
        "stats": {
          "prospection": 4
        },
        "adaptatif": 4
      },
      "epique": {
        "stats": {
          "prospection": 6
        },
        "adaptatif": 6
      },
      "legendaire": {
        "stats": {
          "prospection": 8
        },
        "adaptatif": 8
      }
    }
  },
  "vegaton": {
    "id": "vegaton",
    "nom": "Vegaton",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "prospection": 2
        },
        "adaptatif": 2,
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 23,
          "scaling": 0.46
        }
      },
      "rare": {
        "stats": {
          "prospection": 4
        },
        "adaptatif": 4,
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 23,
          "scaling": 0.46
        }
      },
      "epique": {
        "stats": {
          "prospection": 6
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 24,
          "scaling": 0.46
        }
      },
      "legendaire": {
        "stats": {
          "prospection": 8
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 26,
          "scaling": 0.48
        }
      }
    }
  },
  "dagues_aj_deh_la": {
    "id": "dagues_aj_deh_la",
    "nom": "Dagues Aj'Deh'La",
    "slot": "arme",
    "tiers": {
      "rare": {
        "stats": {
          "vitalite": 4,
          "crit": 2
        },
        "adaptatif": 6,
        "resistances": {
          "feu": 0.01,
          "air": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 20,
          "scaling": 0.42
        }
      },
      "epique": {
        "stats": {
          "vitalite": 6,
          "crit": 3
        },
        "adaptatif": 10,
        "resistances": {
          "feu": 0.02,
          "air": 0.02
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 21,
          "scaling": 0.42
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 10,
          "crit": 4
        },
        "adaptatif": 14,
        "resistances": {
          "feu": 0.04,
          "air": 0.04
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 23,
          "scaling": 0.44
        }
      }
    },
    "source": "elite",
    "perceResistances": 0.5
  },
  "masse_aj_taye": {
    "id": "masse_aj_taye",
    "nom": "Masse Aj Taye",
    "slot": "arme",
    "tiers": {
      "rare": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "eau": 0.01
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 14,
          "baseMax": 19,
          "scaling": 0.4
        }
      },
      "epique": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.02,
          "eau": 0.02
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 15,
          "baseMax": 20,
          "scaling": 0.4
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 24
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.04,
          "eau": 0.04
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 16,
          "baseMax": 22,
          "scaling": 0.42
        }
      }
    },
    "source": "elite",
    "frappeDerriere": true
  },
  "caskoffre": {
    "id": "caskoffre",
    "nom": "Caskoffre",
    "slot": "coiffe",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 15
        },
        "adaptatif": 6,
        "resistances": {
          "terre": -0.06,
          "feu": -0.06,
          "eau": -0.06,
          "air": -0.06
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20
        },
        "adaptatif": 10,
        "resistances": {
          "terre": -0.04,
          "feu": -0.04,
          "eau": -0.04,
          "air": -0.04
        }
      }
    },
    "source": "boss",
    "prospParPvManquant": 0.2
  },
  "ann_or": {
    "id": "ann_or",
    "nom": "Ann'or",
    "slot": "anneau",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 10,
          "crit": 1
        },
        "adaptatif": 6,
        "resistances": {
          "terre": -0.04,
          "feu": -0.04,
          "eau": -0.04,
          "air": -0.04
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 18,
          "crit": 2
        },
        "adaptatif": 8,
        "resistances": {
          "terre": -0.02,
          "feu": -0.02,
          "eau": -0.02,
          "air": -0.02
        }
      }
    },
    "source": "boss",
    "multKamas": 1.2
  },
  "chapeau_lithique": {
    "id": "chapeau_lithique",
    "nom": "Chapeau Lithique",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 20
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 26
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 36
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03,
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "la_mokette": {
    "id": "la_mokette",
    "nom": "La Mokette",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 5,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "vitalite": 22
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03,
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "bague_cristalline": {
    "id": "bague_cristalline",
    "nom": "Bague Cristalline",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 8
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
          "vitalite": 12,
          "crit": 1
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
          "vitalite": 16,
          "crit": 1
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
          "vitalite": 22,
          "crit": 2
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      }
    }
  },
  "baguette_larvesque": {
    "id": "baguette_larvesque",
    "nom": "Baguette Larvesque",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 8
        },
        "adaptatif": 5,
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 24,
          "scaling": 0.46
        }
      },
      "rare": {
        "stats": {
          "vitalite": 10
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 24,
          "scaling": 0.46
        }
      },
      "epique": {
        "stats": {
          "vitalite": 14
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 25,
          "scaling": 0.46
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 20
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 4,
          "baseMin": 21,
          "baseMax": 27,
          "scaling": 0.48
        }
      }
    }
  },
  "bonnet_spairance": {
    "id": "bonnet_spairance",
    "nom": "Bonnet Spairance",
    "slot": "coiffe",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 25
        },
        "adaptatif": 8
      },
      "legendaire": {
        "stats": {
          "vitalite": 40
        },
        "adaptatif": 12
      }
    },
    "source": "boss",
    "bouclierDebut": 0.15
  },
  "scalpel_de_bworknroll": {
    "id": "scalpel_de_bworknroll",
    "nom": "Scalpel de Bworknroll",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 23,
          "scaling": 0.46
        }
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 14,
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 26,
          "scaling": 0.48
        }
      }
    },
    "source": "boss",
    "poisonArme": {
      "degats": 5,
      "duree": 2
    }
  },
  "cape_sanguine": {
    "id": "cape_sanguine",
    "nom": "Cape Sanguine",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1,
          "prospection": 2
        },
        "adaptatif": 3,
        "resistances": {
          "feu": 0.02
        }
      },
      "rare": {
        "stats": {
          "crit": 2,
          "prospection": 4
        },
        "adaptatif": 4,
        "resistances": {
          "feu": 0.02
        }
      },
      "epique": {
        "stats": {
          "crit": 2,
          "prospection": 6
        },
        "adaptatif": 6,
        "resistances": {
          "feu": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "crit": 3,
          "prospection": 8
        },
        "adaptatif": 8,
        "resistances": {
          "feu": 0.04
        }
      }
    },
    "source": "elite"
  },
  "anneau_de_grouillot": {
    "id": "anneau_de_grouillot",
    "nom": "Anneau de Grouillot",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10
        },
        "adaptatif": 3,
        "resistances": {
          "terre": 0.02
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14
        },
        "adaptatif": 4,
        "resistances": {
          "terre": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 18
        },
        "adaptatif": 6,
        "resistances": {
          "terre": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 26
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.04
        }
      }
    },
    "source": "elite"
  },
  "chapeau_akwadala": {
    "id": "chapeau_akwadala",
    "nom": "Chapeau Akwadala",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10
        },
        "adaptatif": 6,
        "resistances": {
          "feu": -0.02,
          "eau": 0.03
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14
        },
        "adaptatif": 8,
        "resistances": {
          "feu": -0.02,
          "eau": 0.03
        }
      },
      "epique": {
        "stats": {
          "vitalite": 18
        },
        "adaptatif": 10,
        "resistances": {
          "feu": -0.01,
          "eau": 0.04
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 26
        },
        "adaptatif": 14,
        "resistances": {
          "eau": 0.06
        }
      }
    }
  },
  "cape_akwadala": {
    "id": "cape_akwadala",
    "nom": "Cape Akwadala",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 8,
          "soin": 4
        },
        "adaptatif": 4
      },
      "rare": {
        "stats": {
          "vitalite": 12,
          "soin": 6
        },
        "adaptatif": 6
      },
      "epique": {
        "stats": {
          "vitalite": 16,
          "soin": 8
        },
        "adaptatif": 8
      },
      "legendaire": {
        "stats": {
          "vitalite": 22,
          "soin": 12
        },
        "adaptatif": 10
      }
    }
  },
  "alliance_akwadala": {
    "id": "alliance_akwadala",
    "nom": "Alliance Akwadala",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
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
          "crit": 3
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
  "baton_akwadala": {
    "id": "baton_akwadala",
    "nom": "Bâton Akwadala",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 6
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 25,
          "scaling": 0.48
        }
      },
      "rare": {
        "stats": {
          "vitalite": 8
        },
        "adaptatif": 7,
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 25,
          "scaling": 0.48
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": 9,
        "attaque": {
          "coutPA": 4,
          "baseMin": 21,
          "baseMax": 26,
          "scaling": 0.48
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 11,
        "attaque": {
          "coutPA": 4,
          "baseMin": 22,
          "baseMax": 28,
          "scaling": 0.5
        }
      }
    }
  },
  "masse_du_corailleur": {
    "id": "masse_du_corailleur",
    "nom": "Masse du Corailleur",
    "slot": "arme",
    "tiers": {
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 12,
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 24,
          "scaling": 0.48
        }
      },
      "legendaire": {
        "stats": {
          "crit": 5
        },
        "adaptatif": 16,
        "attaque": {
          "coutPA": 4,
          "baseMin": 21,
          "baseMax": 27,
          "scaling": 0.5
        }
      }
    },
    "source": "boss",
    "soinAllieBlesse": 0.2
  },
  "alliance_de_corail": {
    "id": "alliance_de_corail",
    "nom": "Alliance de Corail",
    "slot": "anneau",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 15,
          "soin": 10
        },
        "resistances": {
          "terre": -0.03,
          "feu": -0.03,
          "eau": -0.03,
          "air": -0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 25,
          "soin": 16
        },
        "resistances": {
          "terre": -0.02,
          "feu": -0.02,
          "eau": -0.02,
          "air": -0.02
        }
      }
    },
    "source": "boss"
  },
  "arc_des_rivages": {
    "id": "arc_des_rivages",
    "nom": "Arc des Rivages",
    "slot": "arme",
    "tiers": {
      "rare": {
        "stats": {
          "vitalite": 8
        },
        "adaptatif": 6,
        "attaque": {
          "coutPA": 4,
          "baseMin": 17,
          "baseMax": 22,
          "scaling": 0.44
        }
      },
      "epique": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 18,
          "baseMax": 23,
          "scaling": 0.44
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 12,
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 25,
          "scaling": 0.46
        }
      }
    },
    "source": "elite",
    "retraitPA": 1
  },
  "scaphandre_ojine": {
    "id": "scaphandre_ojine",
    "nom": "Scaphandre Ojine",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": 3,
        "resistances": {
          "eau": 0.03,
          "air": 0.02
        }
      },
      "rare": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 4,
        "resistances": {
          "eau": 0.03,
          "air": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 20
        },
        "adaptatif": 6,
        "resistances": {
          "eau": 0.04,
          "air": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 28
        },
        "adaptatif": 8,
        "resistances": {
          "eau": 0.05,
          "air": 0.04
        }
      }
    },
    "source": "elite"
  },
  "kwakoiffe_de_flammes": {
    "id": "kwakoiffe_de_flammes",
    "nom": "Kwakoiffe de Flammes",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 12
        },
        "adaptatif": 8,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 10,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 22
        },
        "adaptatif": 14,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30
        },
        "adaptatif": 18,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03,
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "kwape_de_glace": {
    "id": "kwape_de_glace",
    "nom": "Kwape de Glace",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10
        },
        "adaptatif": 7,
        "resistances": {
          "terre": 0.01,
          "feu": 0.01,
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "vitalite": 14
        },
        "adaptatif": 9,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "epique": {
        "stats": {
          "vitalite": 20
        },
        "adaptatif": 12,
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 28
        },
        "adaptatif": 16,
        "resistances": {
          "terre": 0.03,
          "feu": 0.03,
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "kwakanneau_de_terre": {
    "id": "kwakanneau_de_terre",
    "nom": "Kwakanneau de Terre",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 1
        },
        "adaptatif": 6
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 8
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 10
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 13
      }
    }
  },
  "kwaklame_de_vent": {
    "id": "kwaklame_de_vent",
    "nom": "Kwaklame de Vent",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 21,
          "baseMax": 26,
          "scaling": 0.5
        }
      },
      "rare": {
        "stats": {
          "crit": 2
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 4,
          "baseMin": 21,
          "baseMax": 26,
          "scaling": 0.5
        }
      },
      "epique": {
        "stats": {
          "crit": 3
        },
        "adaptatif": 12,
        "attaque": {
          "coutPA": 4,
          "baseMin": 22,
          "baseMax": 27,
          "scaling": 0.5
        }
      },
      "legendaire": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 15,
        "attaque": {
          "coutPA": 4,
          "baseMin": 24,
          "baseMax": 30,
          "scaling": 0.52
        }
      }
    }
  },
  "kwakwaffe": {
    "id": "kwakwaffe",
    "nom": "Kwakwaffe",
    "slot": "coiffe",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 16
        },
        "adaptatif": 14
      },
      "legendaire": {
        "stats": {
          "vitalite": 26
        },
        "adaptatif": 20
      }
    },
    "source": "boss",
    "elementLibre": true
  },
  "kwakwanneau": {
    "id": "kwakwanneau",
    "nom": "Kwakwanneau",
    "slot": "anneau",
    "tiers": {
      "epique": {
        "stats": {
          "vitalite": 20
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "vitalite": 30
        },
        "resistances": {
          "terre": 0.03,
          "feu": 0.03,
          "eau": 0.03,
          "air": 0.03
        }
      }
    },
    "source": "boss",
    "renaissance": 0.3
  },
  "kwakwalame": {
    "id": "kwakwalame",
    "nom": "Kwakwalame",
    "slot": "arme",
    "tiers": {
      "rare": {
        "stats": {
          "crit": 4
        },
        "adaptatif": 8,
        "attaque": {
          "coutPA": 4,
          "baseMin": 19,
          "baseMax": 24,
          "scaling": 0.48
        }
      },
      "epique": {
        "stats": {
          "crit": 6
        },
        "adaptatif": 10,
        "attaque": {
          "coutPA": 4,
          "baseMin": 20,
          "baseMax": 25,
          "scaling": 0.48
        }
      },
      "legendaire": {
        "stats": {
          "crit": 8
        },
        "adaptatif": 14,
        "attaque": {
          "coutPA": 4,
          "baseMin": 21,
          "baseMax": 27,
          "scaling": 0.5
        }
      }
    },
    "source": "elite"
  },
  "bandeau_rokwa": {
    "id": "bandeau_rokwa",
    "nom": "Bandeau Rokwa",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10,
          "prospection": 4
        },
        "adaptatif": 6
      },
      "rare": {
        "stats": {
          "vitalite": 14,
          "prospection": 6
        },
        "adaptatif": 8
      },
      "epique": {
        "stats": {
          "vitalite": 18,
          "prospection": 8
        },
        "adaptatif": 10
      },
      "legendaire": {
        "stats": {
          "vitalite": 24,
          "prospection": 10
        },
        "adaptatif": 13
      }
    },
    "source": "elite"
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
  },
  "5": {
    "normales": [
      "chapeau_du_directeur_grunob",
      "faux_du_directeur_grunob",
      "bague_rafe",
      "cape_ricefini"
    ],
    "elites": [
      "dora",
      "baton_tont_ata"
    ],
    "boss": [
      "abracape",
      "dora",
      "baton_tont_ata",
      "sabre_shodanwa"
    ]
  },
  "6": {
    "normales": [
      "casque_noix",
      "cape_lumette",
      "anneau_bille",
      "baguette_cetera"
    ],
    "elites": [
      "couteau_a_stek",
      "grosse_bagouze_du_parrain"
    ],
    "boss": [
      "baguette_rikiki",
      "goyave"
    ]
  },
  "7": {
    "normales": [
      "shako",
      "cape_du_boostache",
      "anneau_du_boostache",
      "pelle_du_bois_dormant"
    ],
    "elites": [
      "anneau_forrain",
      "masque_traumatisant"
    ],
    "boss": [
      "dagues_eurfolles",
      "cape_du_vampyre"
    ]
  },
  "8": {
    "normales": [
      "scaracoiffe_noire",
      "scaracape_noire",
      "scaranneau_noir",
      "baguette_scafeuille"
    ],
    "elites": [
      "anneau_poupayahn",
      "la_guenille"
    ],
    "boss": [
      "baguette_ni_ninnin",
      "palmano"
    ]
  },
  "9": {
    "normales": [
      "vegacoiffe",
      "vegacape",
      "veganneau",
      "vegaton"
    ],
    "elites": [
      "dagues_aj_deh_la",
      "masse_aj_taye"
    ],
    "boss": [
      "caskoffre",
      "ann_or"
    ]
  },
  "10": {
    "normales": [
      "chapeau_lithique",
      "la_mokette",
      "bague_cristalline",
      "baguette_larvesque"
    ],
    "elites": [
      "cape_sanguine",
      "anneau_de_grouillot"
    ],
    "boss": [
      "bonnet_spairance",
      "scalpel_de_bworknroll"
    ]
  },
  "11": {
    "normales": [
      "chapeau_akwadala",
      "cape_akwadala",
      "alliance_akwadala",
      "baton_akwadala"
    ],
    "elites": [
      "arc_des_rivages",
      "scaphandre_ojine"
    ],
    "boss": [
      "masse_du_corailleur",
      "alliance_de_corail"
    ]
  },
  "12": {
    "normales": [
      "kwakoiffe_de_flammes",
      "kwape_de_glace",
      "kwakanneau_de_terre",
      "kwaklame_de_vent"
    ],
    "elites": [
      "kwakwalame",
      "bandeau_rokwa"
    ],
    "boss": [
      "kwakwaffe",
      "kwakwanneau"
    ]
  }
};
