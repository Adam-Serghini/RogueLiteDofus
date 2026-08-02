// =============================================================================
//  laboratoire.test.ts — Laboratoire de Brumen Tinctorias (zone 4 de la Tranche 2)
//  bestiaire, poison qui ignore boucliers et résistances, contagion, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, zonesDeTranche, localiserZone, butinToile } from "./data";
import { toileDeZone, fabriquerEquipe, fabriquerEnnemis } from "./run";
import { controllerIA } from "./combat";
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

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Laboratoire", () => {
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
    expect(MONSTRES.macien.archiNom).toBeUndefined();
    expect(MONSTRES.nelween.archiNom).toBeUndefined();
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
    expect(n.dofus).toBe("dofus_pourpre");
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

  it("la zone n'a pas encore de butin (les objets de la toile 16 viendront plus tard)", () => {
    expect(butinToile("laboratoire_brumen")).toBeNull();
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

  const ESPECES = ["scorbute", "croc_gland", "crowneille", "macien", "kolerat", "nelween"];

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

  it("le Kolérat lance sa Contagion et Nelween ses Vapeurs", async () => {
    const equipe = heros();
    for (const [espece, attendu] of [["kolerat", "contagion"], ["nelween", "vapeurs_corrosives"]] as const) {
      const c = trouver(espece);
      c.paActuels = c.paMax;
      c.cooldowns = {};
      c.lancersCeTour = {};
      const action = await controllerIA(c, [c, ...equipe]);
      expect(action, `${espece} : aucune action`).toBeTruthy();
      expect(action!.sort.id, `${espece} joue ${action!.sort.id}`).toBe(attendu);
    }
  });

  // Erreur commise deux fois : au Clos les Blops Royaux, à la Cale Gourlo, étaient
  // moins dangereux que leurs propres escortes.
  it("Nelween frappe plus fort que chacune de ses escortes", () => {
    const zone = ZONES.find((z) => z.id === "laboratoire_brumen")!;
    /** Dégâts par tour estimés : l'IA dépense son budget en jouant le plus cher
     *  d'abord ; on moyenne le tour « signature » et le tour « signature en
     *  recharge ». Modèle de conception, pas une simulation du moteur. */
    const degatsParTour = (id: string): number => {
      const m = MONSTRES[id];
      const stats = m.stats as unknown as Record<string, number>;
      const dom = Math.max(stats.force ?? 0, stats.intelligence ?? 0, stats.agilite ?? 0, stats.chance ?? 0);
      const mult = 1 + Math.min(0.5, (stats.intelligence ?? 0) * 0.005);
      const coup = (s: string) => ((SORTS[s].baseMin + SORTS[s].baseMax) / 2 + dom * SORTS[s].scaling) * mult;
      const cycle = (dispo: string[]) => {
        let pa = m.pa, total = 0;
        for (const s of [...dispo].sort((a, b) => SORTS[b].coutPA - SORTS[a].coutPA)) {
          while (pa >= SORTS[s].coutPA) { total += coup(s); pa -= SORTS[s].coutPA; }
        }
        return total;
      };
      const enRecharge = m.sorts.filter((s) => !SORTS[s].cooldownTours);
      const avec = cycle(m.sorts);
      return m.sorts.length === enRecharge.length ? avec : (avec + cycle(enRecharge)) / 2;
    };
    const boss = degatsParTour("nelween");
    for (const e of COMBATS[zone.pools.boss[0]].ennemis.map((x) => x.monstre).filter((m) => m !== "nelween")) {
      expect(boss, `Nelween (${boss.toFixed(0)}) doit dépasser ${e} (${degatsParTour(e).toFixed(0)})`)
        .toBeGreaterThan(degatsParTour(e));
    }
  });
});
