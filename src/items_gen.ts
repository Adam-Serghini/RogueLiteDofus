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
          "force": 4,
          "intelligence": 4,
          "chance": 4,
          "agilite": 4,
          "crit": 2
        }
      },
      "legendaire": {
        "stats": {
          "force": 5,
          "intelligence": 5,
          "chance": 5,
          "agilite": 5,
          "crit": 3
        }
      }
    }
  },
  "cape_pandawashu": {
    "id": "cape_pandawashu",
    "nom": "Cape Pandawashu",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "vitalite": 10
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
          "vitalite": 14
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
          "terre": 0.02,
          "feu": 0.02,
          "eau": 0.02,
          "air": 0.02
        }
      }
    }
  },
  "epee_de_yanguru": {
    "id": "epee_de_yanguru",
    "nom": "Épée de Yanguru",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "force": 4,
          "vitalite": 4,
          "crit": 2
        },
        "resistances": {
          "terre": -0.03,
          "feu": -0.03
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 12,
          "scaling": 0.32
        }
      },
      "rare": {
        "stats": {
          "force": 7,
          "vitalite": 8,
          "crit": 3
        },
        "resistances": {
          "terre": -0.02,
          "feu": -0.02
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 8,
          "baseMax": 12,
          "scaling": 0.32
        }
      },
      "epique": {
        "stats": {
          "force": 10,
          "vitalite": 10,
          "crit": 4
        },
        "resistances": {
          "terre": -0.02,
          "feu": -0.02
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 9,
          "baseMax": 13,
          "scaling": 0.34
        }
      },
      "legendaire": {
        "stats": {
          "force": 16,
          "vitalite": 15,
          "crit": 5
        },
        "resistances": {
          "terre": -0.01,
          "feu": -0.01
        },
        "attaque": {
          "coutPA": 3,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      }
    }
  },
  "baguette_de_glace": {
    "id": "baguette_de_glace",
    "nom": "Baguette de Glace",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "intelligence": 4,
          "vitalite": 4,
          "prospection": 2
        },
        "resistances": {
          "eau": 0.01,
          "air": 0.01
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
          "prospection": 3
        },
        "resistances": {
          "eau": 0.01,
          "air": 0.01
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
          "intelligence": 10,
          "vitalite": 10,
          "prospection": 4
        },
        "resistances": {
          "eau": 0.02,
          "air": 0.02
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
          "intelligence": 12,
          "vitalite": 16,
          "prospection": 6
        },
        "resistances": {
          "eau": 0.03,
          "air": 0.03
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
  "coiffe_champ_champ": {
    "id": "coiffe_champ_champ",
    "nom": "Coiffe Champ Champ",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "chance": 3,
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "resistances": {
          "terre": 0.01,
          "eau": 0.01
        }
      },
      "rare": {
        "stats": {
          "chance": 4,
          "vitalite": 8,
          "crit": 1,
          "prospection": 3
        },
        "resistances": {
          "terre": 0.02,
          "eau": 0.02
        }
      },
      "epique": {
        "stats": {
          "chance": 6,
          "vitalite": 12,
          "crit": 2,
          "prospection": 4
        },
        "resistances": {
          "terre": 0.03,
          "eau": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "chance": 8,
          "vitalite": 16,
          "crit": 3,
          "prospection": 6
        },
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
          "chance": 2,
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "resistances": {
          "terre": 0.01,
          "eau": 0.01
        }
      },
      "rare": {
        "stats": {
          "chance": 3,
          "vitalite": 10,
          "crit": 1,
          "prospection": 3
        },
        "resistances": {
          "terre": 0.02,
          "eau": 0.02
        }
      },
      "epique": {
        "stats": {
          "chance": 5,
          "vitalite": 14,
          "crit": 2,
          "prospection": 5
        },
        "resistances": {
          "terre": 0.03,
          "eau": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "chance": 7,
          "vitalite": 22,
          "crit": 3,
          "prospection": 7
        },
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
          "chance": 4,
          "crit": 1
        }
      },
      "rare": {
        "stats": {
          "chance": 5,
          "crit": 2
        }
      },
      "epique": {
        "stats": {
          "chance": 6,
          "crit": 2
        }
      },
      "legendaire": {
        "stats": {
          "chance": 8,
          "crit": 3
        }
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
          "chance": 5,
          "vitalite": 6,
          "crit": 1
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      },
      "rare": {
        "stats": {
          "chance": 7,
          "vitalite": 8,
          "crit": 1
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      },
      "epique": {
        "stats": {
          "chance": 9,
          "vitalite": 10,
          "crit": 2
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 11,
          "baseMax": 16,
          "scaling": 0.35
        }
      },
      "legendaire": {
        "stats": {
          "chance": 12,
          "vitalite": 12,
          "crit": 3
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 18,
          "scaling": 0.38
        }
      }
    }
  },
  "coiffe_champetre": {
    "id": "coiffe_champetre",
    "nom": "Coiffe Champêtre",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "agilite": 3,
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "resistances": {
          "feu": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "agilite": 4,
          "vitalite": 8,
          "crit": 1,
          "prospection": 3
        },
        "resistances": {
          "feu": 0.02,
          "air": 0.02
        }
      },
      "epique": {
        "stats": {
          "agilite": 6,
          "vitalite": 12,
          "crit": 2,
          "prospection": 4
        },
        "resistances": {
          "feu": 0.03,
          "air": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "agilite": 8,
          "vitalite": 16,
          "crit": 3,
          "prospection": 6
        },
        "resistances": {
          "feu": 0.04,
          "air": 0.04
        }
      }
    }
  },
  "capouze_des_champs": {
    "id": "capouze_des_champs",
    "nom": "Capouze des Champs",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "agilite": 2,
          "vitalite": 6,
          "crit": 1,
          "prospection": 2
        },
        "resistances": {
          "feu": 0.01,
          "air": 0.01
        }
      },
      "rare": {
        "stats": {
          "agilite": 3,
          "vitalite": 10,
          "crit": 1,
          "prospection": 3
        },
        "resistances": {
          "feu": 0.02,
          "air": 0.02
        }
      },
      "epique": {
        "stats": {
          "agilite": 5,
          "vitalite": 14,
          "crit": 2,
          "prospection": 5
        },
        "resistances": {
          "feu": 0.03,
          "air": 0.03
        }
      },
      "legendaire": {
        "stats": {
          "agilite": 7,
          "vitalite": 22,
          "crit": 3,
          "prospection": 7
        },
        "resistances": {
          "feu": 0.04,
          "air": 0.04
        }
      }
    }
  },
  "anneau_champetre": {
    "id": "anneau_champetre",
    "nom": "Anneau Champêtre",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "agilite": 4,
          "crit": 1
        }
      },
      "rare": {
        "stats": {
          "agilite": 5,
          "crit": 2
        }
      },
      "epique": {
        "stats": {
          "agilite": 6,
          "crit": 2
        }
      },
      "legendaire": {
        "stats": {
          "agilite": 8,
          "crit": 3
        }
      }
    }
  },
  "plantouze_des_champs": {
    "id": "plantouze_des_champs",
    "nom": "Plantouze des Champs",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "agilite": 5,
          "vitalite": 6,
          "crit": 1
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      },
      "rare": {
        "stats": {
          "agilite": 7,
          "vitalite": 8,
          "crit": 1
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.35
        }
      },
      "epique": {
        "stats": {
          "agilite": 9,
          "vitalite": 10,
          "crit": 2
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 11,
          "baseMax": 16,
          "scaling": 0.35
        }
      },
      "legendaire": {
        "stats": {
          "agilite": 12,
          "vitalite": 12,
          "crit": 3
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 12,
          "baseMax": 18,
          "scaling": 0.38
        }
      }
    }
  },
  "toady": {
    "id": "toady",
    "nom": "Toady",
    "slot": "coiffe",
    "tiers": {
      "commun": {
        "stats": {
          "chance": 4,
          "crit": 1
        }
      },
      "rare": {
        "stats": {
          "chance": 6,
          "crit": 1
        }
      },
      "epique": {
        "stats": {
          "chance": 9,
          "crit": 2
        }
      },
      "legendaire": {
        "stats": {
          "chance": 15,
          "crit": 3
        }
      }
    }
  },
  "cape_du_tofu_fou": {
    "id": "cape_du_tofu_fou",
    "nom": "Cape du Tofu Fou",
    "slot": "cape",
    "tiers": {
      "commun": {
        "stats": {
          "agilite": 4
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
          "agilite": 6
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
          "agilite": 9
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
          "agilite": 15
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
  "anneau_du_bandit": {
    "id": "anneau_du_bandit",
    "nom": "Anneau du Bandit",
    "slot": "anneau",
    "tiers": {
      "commun": {
        "stats": {
          "force": 2,
          "intelligence": 2,
          "chance": 2,
          "agilite": 2,
          "vitalite": 6,
          "crit": 3,
          "prospection": 2
        }
      },
      "rare": {
        "stats": {
          "force": 2,
          "intelligence": 2,
          "chance": 2,
          "agilite": 2,
          "vitalite": 8,
          "crit": 4,
          "prospection": 3
        }
      },
      "epique": {
        "stats": {
          "force": 3,
          "intelligence": 3,
          "chance": 3,
          "agilite": 3,
          "vitalite": 10,
          "crit": 5,
          "prospection": 4
        }
      },
      "legendaire": {
        "stats": {
          "force": 4,
          "intelligence": 4,
          "chance": 4,
          "agilite": 4,
          "vitalite": 12,
          "crit": 7,
          "prospection": 6
        }
      }
    }
  },
  "sargasse": {
    "id": "sargasse",
    "nom": "Sargasse",
    "slot": "arme",
    "tiers": {
      "commun": {
        "stats": {
          "force": 1,
          "intelligence": 1,
          "chance": 1,
          "agilite": 1,
          "vitalite": 10,
          "crit": 3
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 9,
          "baseMax": 14,
          "scaling": 0.32
        }
      },
      "rare": {
        "stats": {
          "force": 1,
          "intelligence": 1,
          "chance": 1,
          "agilite": 1,
          "vitalite": 15,
          "crit": 4
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 9,
          "baseMax": 14,
          "scaling": 0.32
        }
      },
      "epique": {
        "stats": {
          "force": 2,
          "intelligence": 2,
          "chance": 2,
          "agilite": 2,
          "vitalite": 20,
          "crit": 5
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 10,
          "baseMax": 15,
          "scaling": 0.34
        }
      },
      "legendaire": {
        "stats": {
          "force": 4,
          "intelligence": 4,
          "chance": 4,
          "agilite": 4,
          "vitalite": 30,
          "crit": 7
        },
        "attaque": {
          "coutPA": 4,
          "baseMin": 11,
          "baseMax": 17,
          "scaling": 0.35
        }
      }
    }
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
          "scaling": 0.25
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
          "scaling": 0.25
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
    "bandeau_komintot",
    "cape_pandawashu",
    "epee_de_yanguru",
    "baguette_de_glace"
  ],
  "2": [
    "coiffe_champ_champ",
    "cape_champ_champ",
    "anneau_champ_champ",
    "baton_carnivore",
    "coiffe_champetre",
    "capouze_des_champs",
    "anneau_champetre",
    "plantouze_des_champs",
    "toady",
    "cape_du_tofu_fou",
    "anneau_du_bandit",
    "sargasse",
    "arc_en_racine_d_abraknyde"
  ]
};
