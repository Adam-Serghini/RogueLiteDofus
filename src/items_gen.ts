// =============================================================================
//  items_gen.ts — AUTO-GÉNÉRÉ par scripts/import-items.mjs depuis items.csv.
//  NE PAS ÉDITER À LA MAIN : modifier le CSV puis relancer l'import.
// =============================================================================
import type { Item } from "./types";

/** Objets à rareté (stats fixes par palier), par id. */
export const ITEMS_TOILES: Record<string, Item> = {
  "coiffe_boune": {
    "id": "coiffe_boune",
    "nom": "Coiffe Boune",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "force": 2,
          "vitalite": 4
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "rare": {
        "stats": {
          "force": 3,
          "vitalite": 6
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "epique": {
        "stats": {
          "force": 5,
          "vitalite": 8,
          "crit": 1
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "force": 6,
          "vitalite": 12,
          "crit": 2
        },
        "resistances": {
          "terre": 0.03,
          "feu": 0.03
        }
      }
    }
  },
  "cape_sloque": {
    "id": "cape_sloque",
    "nom": "Cape Sloque",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "force": 1,
          "vitalite": 6,
          "prospection": 2
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "rare": {
        "stats": {
          "force": 2,
          "vitalite": 8,
          "prospection": 3
        },
        "resistances": {
          "terre": 0.01,
          "feu": 0.01
        }
      },
      "epique": {
        "stats": {
          "force": 3,
          "vitalite": 12,
          "prospection": 4
        },
        "resistances": {
          "terre": 0.02,
          "feu": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "force": 4,
          "vitalite": 20,
          "prospection": 6
        },
        "resistances": {
          "terre": 0.03,
          "feu": 0.03
        }
      }
    }
  },
  "le_plussain": {
    "id": "le_plussain",
    "nom": "Le Plussain",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "force": 3,
          "crit": 1
        }
      },
      "rare": {
        "stats": {
          "force": 4,
          "crit": 1
        }
      },
      "epique": {
        "stats": {
          "force": 5,
          "crit": 1
        }
      },
      "legendaire": {
        "stats": {
          "force": 7,
          "crit": 2
        }
      }
    }
  },
  "epee_de_boisaille": {
    "id": "epee_de_boisaille",
    "nom": "Épée de Boisaille",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "force": 4,
          "vitalite": 4,
          "crit": 1
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "rare": {
        "stats": {
          "force": 6,
          "vitalite": 6,
          "crit": 1
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "epique": {
        "stats": {
          "force": 8,
          "vitalite": 8,
          "crit": 1
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 12,
          "scaling": 0.3
        }
      },
      "legendaire": {
        "stats": {
          "force": 10,
          "vitalite": 12,
          "crit": 2
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 13,
          "scaling": 0.32
        }
      }
    }
  },
  "chapeau_de_l_intrepide": {
    "id": "chapeau_de_l_intrepide",
    "nom": "Chapeau de l'Intrépide",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "intelligence": 2,
          "vitalite": 4
        },
        "resistances": {
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "intelligence": 3,
          "vitalite": 6
        },
        "resistances": {
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "intelligence": 5,
          "vitalite": 8,
          "crit": 1
        },
        "resistances": {
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "intelligence": 6,
          "vitalite": 12,
          "crit": 2
        },
        "resistances": {
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "cape_de_l_intrepide": {
    "id": "cape_de_l_intrepide",
    "nom": "Cape de l'Intrépide",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "intelligence": 1,
          "vitalite": 6,
          "prospection": 2
        },
        "resistances": {
          "eau": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "intelligence": 2,
          "vitalite": 8,
          "prospection": 3
        },
        "resistances": {
          "eau": 0.01,
          "air": 0.01
        }
      },
      "epique": {
        "stats": {
          "intelligence": 3,
          "vitalite": 12,
          "crit": 1,
          "prospection": 4
        },
        "resistances": {
          "eau": 0.02,
          "air": 0.02
        }
      },
      "legendaire": {
        "stats": {
          "intelligence": 4,
          "vitalite": 20,
          "crit": 2,
          "prospection": 6
        },
        "resistances": {
          "eau": 0.03,
          "air": 0.03
        }
      }
    }
  },
  "anneau_de_l_intrepide": {
    "id": "anneau_de_l_intrepide",
    "nom": "Anneau de l'Intrépide",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "intelligence": 3,
          "crit": 1
        }
      },
      "rare": {
        "stats": {
          "intelligence": 4,
          "crit": 1
        }
      },
      "epique": {
        "stats": {
          "intelligence": 5,
          "crit": 1
        }
      },
      "legendaire": {
        "stats": {
          "intelligence": 7,
          "crit": 2
        }
      }
    }
  },
  "baton_de_boisaille": {
    "id": "baton_de_boisaille",
    "nom": "Bâton de Boisaille",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "intelligence": 4,
          "vitalite": 4,
          "crit": 1
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "rare": {
        "stats": {
          "intelligence": 6,
          "vitalite": 6,
          "crit": 1
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 7,
          "baseMax": 11,
          "scaling": 0.3
        }
      },
      "epique": {
        "stats": {
          "intelligence": 8,
          "vitalite": 8,
          "crit": 1
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 12,
          "scaling": 0.3
        }
      },
      "legendaire": {
        "stats": {
          "intelligence": 10,
          "vitalite": 12,
          "crit": 2
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 13,
          "scaling": 0.32
        }
      }
    }
  },
  "bandeau_komintot": {
    "id": "bandeau_komintot",
    "nom": "Bandeau Komintot",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "force": 2,
          "intelligence": 2,
          "chance": 2,
          "agilite": 2,
          "crit": 1
        }
      },
      "rare": {
        "stats": {
          "force": 3,
          "intelligence": 3,
          "chance": 3,
          "agilite": 3,
          "crit": 1
        }
      },
      "epique": {
        "stats": {
          "force": 5,
          "intelligence": 5,
          "chance": 5,
          "agilite": 5,
          "crit": 1
        }
      },
      "legendaire": {
        "stats": {
          "force": 7,
          "intelligence": 7,
          "chance": 7,
          "agilite": 7,
          "crit": 2
        }
      }
    }
  }
};

/** Pool d'objets par toile (index de zone dans l'ordre de jeu de la tranche). */
export const BUTIN_TOILES: Record<number, string[]> = {
  "1": [
    "coiffe_boune",
    "cape_sloque",
    "le_plussain",
    "epee_de_boisaille",
    "chapeau_de_l_intrepide",
    "cape_de_l_intrepide",
    "anneau_de_l_intrepide",
    "baton_de_boisaille",
    "bandeau_komintot"
  ]
};
