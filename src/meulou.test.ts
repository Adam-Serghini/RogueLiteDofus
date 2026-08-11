// =============================================================================
//  meulou.test.ts — Tanière du Meulou (zone 10 de la Tranche 2)
//  annulations par tour (les N premiers coups reçus font zéro), bestiaire, PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { lancerSort, effetsDebutTour, controllerIA, runCombat } from "./combat";
import type { Combatant } from "./types";

const ctxNeuf = () => {
  let g = 8642097;
  const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return { rng, log: () => {}, playerDamageBonus: 1 };
};

/** Un frappeur à la puissance du niveau où la zone se joue (≈ 85). On ne monte QUE la
 *  force : il faut que ses coups dépassent largement zéro pour qu'« annulé » se
 *  distingue de « faible ». Le reste des stats est laissé tel quel. */
const frappeur = (): Combatant => {
  const [h] = fabriquerEquipe();
  h.stats = { ...h.stats, force: 160 };
  h.position = 0;
  return h;
};

/** Une cible neutre prise dans une AUTRE zone (Dragoeuf Calcaire, toile 21) : aucune
 *  rencontre de la tanière n'existe encore, et le socle doit de toute façon se prouver
 *  indépendamment de son contenu. */
const cibleNeutre = (): Combatant => fabriquerEnnemis("khz_1")[0];

/** Frappe `n` fois la cible et renvoie les dégâts subis coup par coup. */
function coupParCoup(cible: Combatant, n: number): number[] {
  const ctx = ctxNeuf();
  const h = frappeur();
  cible.position = 0;
  const cs = [h, cible];
  const coups: number[] = [];
  for (let i = 0; i < n; i++) {
    const avant = cible.pvActuels;
    lancerSort(h, SORTS.morsure, cible.ref, cs, ctx);
    coups.push(avant - cible.pvActuels);
  }
  return coups;
}

describe("socle : les N premiers coups reçus par tour sont annulés", () => {
  it("trois coups à zéro, le quatrième passe", () => {
    const c = cibleNeutre();
    c.pvBase = 5000; c.pvMax = 5000; c.pvActuels = 5000; // qu'il survive aux quatre coups
    c.nullifieParTour = 3;
    c.coupsAnnulesRestants = 3;
    const coups = coupParCoup(c, 4);
    expect(coups.slice(0, 3), `annulés attendus, reçu ${coups.join("/")}`).toEqual([0, 0, 0]);
    expect(coups[3], "le 4e coup doit passer").toBeGreaterThan(0);
  });

  it("un monstre SANS le champ n'annule rien", () => {
    // Pendant du contrôle « armé dès la fabrication », qui arrive avec le vrai contenu :
    // sans armement à la fabrication, un héros plus rapide que le porteur le frapperait
    // avant son premier tour et l'annulation ne serait pas encore en place.
    const c = cibleNeutre();
    expect(c.coupsAnnulesRestants ?? 0).toBe(0);
  });

  it("sans le champ, rien ne change (pas de NaN, pas de régression)", () => {
    const c = cibleNeutre();
    c.pvBase = 5000; c.pvMax = 5000; c.pvActuels = 5000;
    const coups = coupParCoup(c, 3);
    for (const d of coups) expect(Number.isFinite(d)).toBe(true);
    expect(coups.some((d) => d > 0), "les coups doivent porter normalement").toBe(true);
  });

  it("le POISON ignore l'annulation", () => {
    // Le tick de poison retire les PV directement dans `effetsDebutTour`, sans passer par
    // `infligerDegats` : il traverse donc l'annulation. C'est le contre de la zone, offert
    // par la leçon du Laboratoire (toile 16) — ce test empêche qu'une refonte le casse en
    // silence.
    const c = cibleNeutre();
    c.pvBase = 5000; c.pvMax = 5000; c.pvActuels = 5000;
    c.nullifieParTour = 3;
    c.coupsAnnulesRestants = 3;
    c.effets.push({ stat: "poison", valeur: 40, toursRestants: 2 });
    const ctx = ctxNeuf();
    const avant = c.pvActuels;
    effetsDebutTour(c, [c], ctx);
    expect(c.pvActuels, "le poison doit mordre malgré l'annulation").toBeLessThan(avant);
    expect(c.coupsAnnulesRestants, "et ne doit pas consommer d'annulation").toBe(3);
  });
});

const ELEMENT_DE = {
  mulou: "terre", muloubard: "air", cocholou: "eau",
  mulounoke: "air", mergranlou: "terre", meulou: "air",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = { mulou: "Muloufok l'Hilarant" } as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire de la Tanière du Meulou", () => {
  it("les 6 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("une SEULE espèce est capturable — la plus faible couverture du jeu, assumée", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi).toEqual(["mulou"]);
    expect(MONSTRES.mulou.archiNom).toBe(ARCHIS.mulou);
  });

  it("aucun monstre de la zone n'est feu, boss compris", () => {
    // Les deux zones précédentes réservaient le feu au boss pour que le doublement de
    // l'intelligence joue pour lui ; ici personne ne l'est, donc le doublement n'entre
    // pas en jeu et il n'y a rien à compenser.
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(dominante(id), `${id}`).not.toBe("intelligence");
    }
  });

  it("Croc Gland n'est PAS dans la zone, bien qu'il soit dans le donjon 15", () => {
    // Il est déjà au Laboratoire de Brumen (toile 16, 280 PV) : le réutiliser six toiles
    // plus haut serait une redite sans archi neuf. Ce test fige la décision, comme celui
    // du Bateau du Chouque pour les trois gardes de la Cale.
    expect(Object.keys(ELEMENT_DE)).not.toContain("croc_gland");
  });

  it("aucun sprite en doublon dans la zone", () => {
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("le boss annule 3 coups par tour, un normal en annule 1", () => {
    expect(MONSTRES.meulou.nullifieParTour).toBe(3);
    expect(MONSTRES.mulounoke.nullifieParTour).toBe(1);
    // et personne d'autre, sinon la zone deviendrait illisible
    const porteurs = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].nullifieParTour);
    expect(porteurs.sort()).toEqual(["meulou", "mulounoke"]);
  });

  it("qui frappe deux fois frappe plus faible", () => {
    expect(MONSTRES.mergranlou.pa).toBe(8);
    for (const lent of ["mulou", "muloubard"]) {
      expect(dom("mergranlou"), `contre ${lent}`).toBeLessThan(dom(lent));
    }
  });

  it("aucune escorte n'a le budget de PA du boss", () => {
    for (const id of Object.keys(ELEMENT_DE)) {
      if (!MONSTRES[id].boss) expect(MONSTRES[id].pa, `${id}`).toBeLessThan(MONSTRES.meulou.pa);
    }
  });

  it("le croc de l'alpha est une signature en règle", () => {
    const s = SORTS.croc_de_l_alpha;
    expect(s.type).toBe("degats");
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
    // `boss.test.ts` exige que la desc contienne le nom du boss : le Meulou garde un
    // sort-signature, contrairement au Kharnozor, pour ne pas allonger d'une seconde
    // entrée d'affilée la liste nommée des boss sans signature.
    expect(s.desc).toContain("Meulou");
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Tanière du Meulou", () => {
  it("est la 10e zone de la Tranche 2, sur la toile 22", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[9]).toBe("taniere_meulou");
    const loc = localiserZone("taniere_meulou")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(22); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale a UN boss, qui lâche le Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss)).toEqual(["meulou"]);
  });

  it("le compteur d'annulations est armé dès la fabrication", () => {
    // Pendant du test de socle, cette fois sur le vrai contenu : sans armement à la
    // fabrication, un héros plus rapide frapperait avant le premier tour du Meulou.
    const meulou = fabriquerEnnemis("mlo_boss").find((x) => x.monstreId === "meulou")!;
    expect(meulou.coupsAnnulesRestants).toBe(3);
  });

  it("chaque pack normal contient un porteur d'annulation", () => {
    // Le joueur apprend à gaspiller un coup avant d'en gaspiller trois devant le boss.
    const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) => MONSTRES[e.monstre].nullifieParTour);
      expect(porte, `${id} n'enseigne pas l'annulation`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("la seule espèce capturable apparaît en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 22 ne lâche rien pour l'instant", () => {
    expect(butinToile("taniere_meulou")).toBeNull();
  });
});

describe("budget de PA, rechargement et domination", () => {
  async function paOrphelins(c: Combatant, cs: Combatant[], cooldowns: Record<string, number> = {}): Promise<number> {
    c.paActuels = c.paMax;
    c.cooldowns = { ...cooldowns };
    c.lancersCeTour = {};
    for (let garde = 0; garde < 10; garde++) {
      const action = await controllerIA(c, cs);
      if (!action || action.sort.coutPA <= 0) break;
      c.paActuels -= action.sort.coutPA;
      const l = (c.lancersCeTour ??= {}); // le moteur l'incrémente au lancement
      l[action.sort.id] = (l[action.sort.id] ?? 0) + 1;
    }
    return c.paActuels;
  }

  const equipe = () => {
    const h = fabriquerEquipe();
    for (const [i, x] of h.entries()) {
      x.position = i < 2 ? i : i + 2;
      x.pvBase = 900; x.pvMax = 900; x.pvActuels = 900;
    }
    return h;
  };

  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "taniere_meulou")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  it("aucune des 6 espèces ne laisse de PA sur la table", async () => {
    const eq = equipe();
    for (const espece of [...especesDeLaZone()]) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...eq]), `${espece} laisse des PA`).toBe(0);
    }
  });

  it("le boss ne gaspille rien quand son croc recharge", async () => {
    const eq = equipe();
    const m = trouver("meulou");
    expect(await paOrphelins(m, [m, ...eq], { croc_de_l_alpha: 1 })).toBe(0);
  });

  it("le boss lance réellement son croc", async () => {
    const eq = equipe();
    const m = trouver("meulou");
    m.paActuels = m.paMax;
    m.cooldowns = {};
    m.lancersCeTour = {};
    expect((await controllerIA(m, [m, ...eq]))!.sort.id).toBe("croc_de_l_alpha");
  });

  it("les annulations se RECHARGENT dans la vraie boucle de combat", async () => {
    // Pendant du test de socle, qui ne prouvait que la consommation. Ici on épuise les
    // trois annulations puis on laisse le moteur jouer un tour complet : le rechargement
    // se fait au début du tour du porteur, pas ailleurs.
    const m = trouver("meulou");
    m.position = 0;
    const eq = equipe();
    const cs = [...eq, m];
    m.coupsAnnulesRestants = 0; // épuisé
    let vu = -1;
    await runCombat(cs, {
      controllers: {
        // le joueur ne fait rien : on veut seulement que le tour du Meulou arrive
        joueur: () => null,
        ennemi: (acteur) => {
          if (acteur.monstreId === "meulou" && vu < 0) vu = acteur.coupsAnnulesRestants ?? 0;
          return null; // personne n'agit : le combat s'arrête faute d'action
        },
      },
      rng: ctxNeuf().rng,
    });
    expect(vu, "au début de son tour, le Meulou doit avoir retrouvé ses 3 annulations").toBe(3);
  });

  /** Dégâts par tour estimés. Modèle de CONCEPTION, pas une simulation du moteur.
   *
   *  L'ANNULATION est exclue : c'est de la défense, pas des dégâts — comme l'armure aux
   *  Pitons, le soin au Repaire, le désenvoûtement à l'Antre. Le Laboratoire avait fait
   *  l'erreur inverse (son modèle ignorait le poison, l'identité même de la zone). */
  const degatsParTour = (id: string, cibles: number): number => {
    const m = MONSTRES[id];
    const stats = m.stats as unknown as Record<string, number>;
    const d = Math.max(stats.force ?? 0, stats.intelligence ?? 0, stats.agilite ?? 0, stats.chance ?? 0);
    const mult = 1 + Math.min(0.5, (stats.intelligence ?? 0) * 0.005);
    const offensifs = m.sorts.filter((s) => SORTS[s].type === "degats");
    const coup = (s: string) => {
      const sort = SORTS[s];
      const direct = ((sort.baseMin + sort.baseMax) / 2 + d * sort.scaling) * mult;
      return direct * (sort.zoneLigne ? cibles : 1);
    };
    const cycle = (dispo: string[]) => {
      let pa = m.pa, total = 0;
      const lances: Record<string, number> = {};
      for (const s of [...dispo].sort((a, b) => SORTS[b].coutPA - SORTS[a].coutPA)) {
        const max = SORTS[s].maxParTour ?? Infinity;
        while (pa >= SORTS[s].coutPA && (lances[s] ?? 0) < max) {
          total += coup(s); pa -= SORTS[s].coutPA; lances[s] = (lances[s] ?? 0) + 1;
        }
      }
      return total;
    };
    const enRecharge = offensifs.filter((s) => !SORTS[s].cooldownTours);
    const avec = cycle(offensifs);
    return offensifs.length === enRecharge.length ? avec : (avec + cycle(enRecharge)) / 2;
  };

  it("le Meulou frappe plus fort que TOUTE espèce non-boss de la zone", () => {
    const nonBoss = [...especesDeLaZone()].filter((m) => !MONSTRES[m].boss);
    expect(nonBoss.length).toBeGreaterThan(0);
    for (const cibles of [1, 2]) {
      const b = degatsParTour("meulou", cibles);
      for (const e of nonBoss) {
        const esc = degatsParTour(e, cibles);
        expect(b, `à ${cibles} cible(s) : le Meulou (${b.toFixed(0)}) doit dépasser ${e} (${esc.toFixed(0)})`)
          .toBeGreaterThan(esc);
      }
    }
  });
});
