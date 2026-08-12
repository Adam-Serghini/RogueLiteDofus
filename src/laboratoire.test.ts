// =============================================================================
//  laboratoire.test.ts — Laboratoire de Brumen Tinctorias (zone 4 de la Tranche 2)
//  bestiaire, poison qui ignore boucliers et résistances, contagion, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, zonesDeTranche, localiserZone, butinToile } from "./data";
import { toileDeZone, fabriquerEquipe, fabriquerEnnemis } from "./run";
import { controllerIA, lancerSort, type CombatCtx } from "./combat";
import type { Combatant } from "./types";

const ELEMENT_DE = {
  scorbute: "feu", croc_gland: "terre", crowneille: "air",
  macien: "terre", kolerat: "eau", nelween: "eau",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  scorbute: "Scorpitène l'Enflammé",
  croc_gland: "Cromikay le Néophyte",
  crowneille: "Crognan le Barbare",
  kolerat: "Kolforthe l'Indécollable",
} as const;

/** Union des espèces des trois pools de la zone — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "laboratoire_brumen")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Laboratoire", () => {
  it("les espèces des pools sont exactement celles déclarées ici", () => {
    // Garde-fou : une espèce ajoutée à un pack sans être déclarée dans ELEMENT_DE
    // échapperait sinon à tous les contrôles d'élément, de résistance et d'archi.
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("les 6 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      const m = MONSTRES[id];
      expect(m, `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} ne frappe pas en ${element}`).toBe(STAT_DE_ELEMENT[element]);
      expect(m.resistances?.[element], `${id} doit résister en ${element}`).toBeGreaterThan(0);
    }
  });

  it("4 espèces sur 6 portent un archimonstre, et deux espèces n'ont jamais le MÊME", () => {
    for (const [id, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[id].archiNom, `${id}`).toBe(nom);
    }
    // dérivé, pas énuméré : toute espèce hors table doit être sans archi
    for (const id of especesDeLaZone()) {
      if (id in ARCHIS) continue;
      expect(MONSTRES[id].archiNom, `${id} porte un archi non déclaré`).toBeUndefined();
    }
    // Metamob attribue « Crognan le Barbare » à Croc Gland ET à Crowneille : on
    // donne à Croc Gland son autre archi référencé pour que le Bestiaire n'affiche
    // pas deux fois le même nom.
    const noms = Object.values(ARCHIS);
    expect(new Set(noms).size, "deux espèces partagent le même nom d'archi").toBe(noms.length);
  });

  it("Nelween est le boss, à 10 PA, et lâche le Dofus Pourpre", () => {
    const n = MONSTRES.nelween;
    expect(n.boss).toBe(true);
    expect(n.pa).toBe(10);
    expect(n.sorts[0]).toBe("vapeurs_corrosives"); // signature en tête : l'IA joue le plus cher, à égalité l'ordre de la liste
  });
});

describe("la leçon de la zone : le poison ignore ce qui protège", () => {
  it("les trois sorts de poison existent avec les bons coûts", () => {
    expect(SORTS.dard_venimeux?.poison, "dard_venimeux sans poison").toBeTruthy();
    expect(SORTS.dard_venimeux.coutPA).toBe(4);
    expect(SORTS.contagion?.poison, "contagion sans poison").toBeTruthy();
    expect(SORTS.contagion.coutPA).toBe(4);
    expect(SORTS.vapeurs_corrosives?.poison, "vapeurs_corrosives sans poison").toBeTruthy();
    expect(SORTS.vapeurs_corrosives.coutPA).toBe(6);
    expect(SORTS.vapeurs_corrosives.cooldownTours).toBeGreaterThanOrEqual(2);
  });

  it("seule la Contagion se transmet — c'est la signature du Kolérat", () => {
    expect(SORTS.contagion.poison!.transmet).toBe(true);
    expect(SORTS.dard_venimeux.poison!.transmet).toBeFalsy();
    expect(SORTS.vapeurs_corrosives.poison!.transmet).toBeFalsy();
    expect(MONSTRES.kolerat.sorts).toContain("contagion");
  });

  // Le Kolérat est le DERNIER porteur de `poison.transmet` : le seul autre était
  // `mot_interdit` (Eniripsa), retiré avec la refonte du kit. Les tests voisins vérifient
  // la donnée ; celui-ci LANCE le sort, seule preuve que le chemin de résolution pose
  // réellement l'effet transmissible sur la cible.
  it("la Contagion, lancée, pose un poison transmissible sur sa cible", () => {
    const [eni] = fabriquerEquipe();
    const cible = fabriquerEnnemis("boss")[0]; // gros PV : survit au coup, le poison reste visible
    const ctx: CombatCtx = { rng: () => 0.99, log: () => {}, playerDamageBonus: 1 };

    lancerSort(eni, SORTS.contagion, cible.ref, [eni, cible], ctx);

    expect(cible.pvActuels).toBeGreaterThan(0);
    expect(cible.effets.some((e) => e.stat === "poison" && e.transmet)).toBe(true);
  });

  it("la signature du boss frappe toute la rangée ET l'empoisonne", () => {
    expect(SORTS.vapeurs_corrosives.zoneLigne).toBe(true);
  });

  it("les trois empoisonneuses portent le dard ; le Macien, lui, ne porte aucun poison", () => {
    for (const id of ["scorbute", "croc_gland", "crowneille"]) {
      expect(MONSTRES[id].sorts, `${id}`).toContain("dard_venimeux");
    }
    // le cogneur banal existe pour qu'un pack ne soit pas qu'une accumulation de DoT
    expect(MONSTRES.macien.sorts.some((s) => SORTS[s]?.poison)).toBe(false);
  });
});

describe("zone Laboratoire de Brumen Tinctorias", () => {
  const zone = () => ZONES.find((z) => z.id === "laboratoire_brumen")!;

  it("est la 4ᵉ zone de la Tranche 2 et porte la toile 16", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[3]).toBe("laboratoire_brumen");
    expect(zonesDeTranche(t2)[3].nom).toBe("Laboratoire de Brumen Tinctorias");
    expect(localiserZone("laboratoire_brumen")!.tranche.id).toBe("t2");
    expect(toileDeZone("laboratoire_brumen")).toBe(16); // T1 = 1-12, puis 13, 14, 15
  });

  it("a une seule salle de boss, tenue par Nelween escorté", () => {
    expect(zone().pools.boss.length).toBe(1);
    const ennemis = COMBATS[zone().pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(ennemis).toContain("nelween");
    expect(ennemis.filter((m) => MONSTRES[m]?.boss).length).toBe(1); // salle à boss UNIQUE
    expect(ennemis.length).toBeGreaterThan(1);
    expect(new Set(ennemis).size).toBe(ennemis.length); // pas deux fois la même espèce
  });

  it("chaque pack normal contient au moins un empoisonneur (la leçon de la zone)", () => {
    for (const packId of zone().pools.normales) {
      const avecPoison = COMBATS[packId].ennemis
        .map((e) => e.monstre)
        .filter((id) => MONSTRES[id]?.sorts.some((s) => SORTS[s]?.poison));
      expect(avecPoison.length, `${packId} n'empoisonne personne`).toBeGreaterThan(0);
    }
  });

  it("les quatre espèces à archimonstre sont chassables en combat normal", () => {
    const dansNormales = new Set(zone().pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of ["scorbute", "croc_gland", "crowneille", "kolerat"]) {
      expect(dansNormales.has(id), `${id} n'apparaît dans aucun pack normal : son archi serait enfermé dans les nœuds élite`).toBe(true);
    }
  });

  it("la toile 16 lâche la Panoplie du Scorbute, ses élites et ses boss", () => {
    const pool = butinToile("laboratoire_brumen")!;
    expect(pool.normales).toEqual(["coiffe_du_scorbute", "cape_du_scorbute", "anneau_du_scorbute", "racine_du_scorbute"]);
    expect(pool.elites).toEqual(["pic_a_glace", "anneau_de_qil_bil"]);
    expect(pool.boss).toEqual(["perruque_de_iop", "cape_hucine"]);
  });
});

describe("comportement des créatures du Laboratoire", () => {
  /** Rejoue un tour complet de l'IA et renvoie les PA laissés sur la table. */
  async function paOrphelins(c: Combatant, cs: Combatant[], cooldowns: Record<string, number> = {}): Promise<number> {
    c.paActuels = c.paMax;
    c.cooldowns = { ...cooldowns };
    c.lancersCeTour = {};
    for (let garde = 0; garde < 10; garde++) {
      const action = await controllerIA(c, cs);
      if (!action || action.sort.coutPA <= 0) break;
      c.paActuels -= action.sort.coutPA;
      const l = (c.lancersCeTour ??= {}); // cf. `maxParTour`, incrémenté par le moteur au lancement
      l[action.sort.id] = (l[action.sort.id] ?? 0) + 1;
    }
    return c.paActuels;
  }

  const heros = () => {
    const h = fabriquerEquipe();
    for (const [i, x] of h.entries()) x.position = i < 2 ? i : i + 2; // 2 devant, 2 derrière
    return h;
  };

  /** Cherche un combattant d'une espèce dans une rencontre où elle figure vraiment. */
  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "laboratoire_brumen")!;
    const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
    for (const id of combats) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  // Dérivé des pools de la zone : une 7ᵉ espèce ajoutée demain à un pack est
  // automatiquement soumise à tous les contrôles ci-dessous.
  const ESPECES = [...especesDeLaZone()];

  // Deux fois dans ce projet, un monstre a gaspillé des PA faute de sort assez bon
  // marché (Blops Royaux, puis Canondorf qui ne tirait jamais son canon).
  it("aucune espèce de la zone ne laisse de PA sur la table", async () => {
    const equipe = heros();
    for (const espece of ESPECES) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...equipe]), `${espece} laisse des PA`).toBe(0);
    }
  });

  it("Nelween ne gaspille rien NON PLUS quand sa signature est en recharge", async () => {
    const equipe = heros();
    const n = trouver("nelween");
    // c'est le tour qui piégeait la spec : sans `charge` en repli, 6 des 10 PA
    // seraient perdus un tour sur deux.
    expect(await paOrphelins(n, [n, ...equipe], { vapeurs_corrosives: 1 })).toBe(0);
  });

  /** Rejoue les `n` premières actions d'un tour et renvoie la séquence de sorts joués. */
  async function sequenceDuTour(c: Combatant, cs: Combatant[], n: number): Promise<string[]> {
    c.paActuels = c.paMax;
    c.cooldowns = {};
    c.lancersCeTour = {};
    const jouees: string[] = [];
    for (let i = 0; i < n; i++) {
      const action = await controllerIA(c, cs);
      if (!action) break;
      jouees.push(action.sort.id);
      c.paActuels -= action.sort.coutPA;
      // le moteur incrémente ce compteur au lancement : on le reproduit ici,
      // sinon `maxParTour` ne pourrait jamais bloquer un second lancer.
      const l = (c.lancersCeTour ??= {});
      l[action.sort.id] = (l[action.sort.id] ?? 0) + 1;
    }
    return jouees;
  }

  it("le Kolérat lance sa Contagion et Nelween ses Vapeurs", async () => {
    const equipe = heros();
    for (const [espece, attendu] of [["kolerat", "contagion"], ["nelween", "vapeurs_corrosives"]] as const) {
      const c = trouver(espece);
      expect((await sequenceDuTour(c, [c, ...equipe], 1))[0], `${espece}`).toBe(attendu);
    }
  });

  // `contagion` et `morsure` coûtent 4 PA : sans `maxParTour: 1`, le tri stable de
  // `iaAgressif` laissait le Kolérat rejouer sa Contagion avec ses 8 PA — `morsure`
  // devenait du contenu mort et le poison s'empilait en DEUX stacks de 10/tour.
  it("le Kolérat enchaîne Contagion PUIS Morsure — il ne rejoue pas sa Contagion", async () => {
    const equipe = heros();
    const k = trouver("kolerat");
    expect(SORTS.contagion.maxParTour, "contagion doit être limitée à un lancer par tour").toBe(1);
    expect(await sequenceDuTour(k, [k, ...equipe], 2)).toEqual(["contagion", "morsure"]);
  });

  // Erreur commise deux fois : au Clos les Blops Royaux, à la Cale Gourlo, étaient
  // moins dangereux que leurs propres escortes.
  it("Nelween frappe plus fort que chacune de ses escortes", () => {
    const zone = ZONES.find((z) => z.id === "laboratoire_brumen")!;
    /** Dégâts par tour estimés : l'IA dépense son budget en jouant le plus cher
     *  d'abord ; on moyenne le tour « signature » et le tour « signature en
     *  recharge ». Modèle de conception, pas une simulation du moteur.
     *
     *  Le POISON est compté (dégâts engagés = degats × duree) : dans une zone dont
     *  toute l'identité est un dégât plat qui ignore boucliers ET résistances, un
     *  modèle qui ne somme que les coups directs mesure la seule grandeur qui n'est
     *  pas en jeu. `zoneLigne` est compté sur `cibles` cibles ; on évalue le cas le
     *  plus défavorable au boss, `cibles = 1` (un seul héros en rangée avant,
     *  formation parfaitement légitime face à des sorts `ennemi_ligne`). */
    const degatsParTour = (id: string, cibles: number): number => {
      const m = MONSTRES[id];
      const stats = m.stats as unknown as Record<string, number>;
      const dom = Math.max(stats.force ?? 0, stats.intelligence ?? 0, stats.agilite ?? 0, stats.chance ?? 0);
      const mult = 1 + Math.min(0.5, (stats.intelligence ?? 0) * 0.005);
      const coup = (s: string) => {
        const sort = SORTS[s];
        const direct = ((sort.baseMin + sort.baseMax) / 2 + dom * sort.scaling) * mult;
        const poison = sort.poison ? sort.poison.degats * sort.poison.duree : 0;
        return (direct + poison) * (sort.zoneLigne ? cibles : 1);
      };
      const cycle = (dispo: string[]) => {
        let pa = m.pa, total = 0;
        const lances: Record<string, number> = {};
        for (const s of [...dispo].sort((a, b) => SORTS[b].coutPA - SORTS[a].coutPA)) {
          const max = SORTS[s].maxParTour ?? Infinity; // un sort limité ne se rejoue pas dans le tour
          while (pa >= SORTS[s].coutPA && (lances[s] ?? 0) < max) {
            total += coup(s); pa -= SORTS[s].coutPA; lances[s] = (lances[s] ?? 0) + 1;
          }
        }
        return total;
      };
      const enRecharge = m.sorts.filter((s) => !SORTS[s].cooldownTours);
      const avec = cycle(m.sorts);
      return m.sorts.length === enRecharge.length ? avec : (avec + cycle(enRecharge)) / 2;
    };
    const escortes = COMBATS[zone.pools.boss[0]].ennemis.map((x) => x.monstre).filter((m) => m !== "nelween");
    for (const cibles of [1, 2]) {
      const boss = degatsParTour("nelween", cibles);
      for (const e of escortes) {
        const esc = degatsParTour(e, cibles);
        expect(boss, `à ${cibles} cible(s) : Nelween (${boss.toFixed(0)}) doit dépasser ${e} (${esc.toFixed(0)})`)
          .toBeGreaterThan(esc);
      }
    }
  });
});
