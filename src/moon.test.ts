// =============================================================================
//  moon.test.ts — Arbre de Moon (zone 12 et DERNIÈRE de la Tranche 2)
//  la finale est un examen : son sortilège tire une des quatre leçons de la tranche.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { lancerSort, controllerIA } from "./combat";
import type { Combatant } from "./types";
import { multStatFrappe } from "./progression";

const ELEMENT_DE = {
  trukikol: "terre", moon: "terre",
  gloutovore: "eau", domoizelle: "eau",
  fourbasse: "air", dostrogo: "air",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  trukikol: "Trukul le Lent",
  gloutovore: "Gloubibou le Gars",
  fourbasse: "Fourapin le Chaud",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire de l'Arbre de Moon", () => {
  it("les 6 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("3 espèces sur 6 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("aucun monstre de la zone n'est feu", () => {
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(dominante(id), `${id}`).not.toBe("intelligence");
    }
  });

  it("aucun sprite en doublon dans la zone", () => {
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("qui frappe deux fois frappe plus faible", () => {
    expect(MONSTRES.fourbasse.pa).toBe(8);
    for (const lent of ["trukikol", "gloutovore"]) {
      expect(dom("fourbasse"), `contre ${lent}`).toBeLessThan(dom(lent));
    }
  });

  it("aucune escorte n'atteint le budget de PA du boss", () => {
    // Inégalité STRICTE ici : la salle est à boss unique (10 PA). Au Repaire du Kharnozor
    // et au Domaine Ancestral, les salles JUMELÉES mettent les boss à 6 PA, ce qui avait
    // forcé à assouplir ce garde-fou — cet assouplissement n'est pas la règle générale.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (!MONSTRES[id].boss) expect(MONSTRES[id].pa, `${id}`).toBeLessThan(MONSTRES.moon.pa);
    }
  });
});

describe("le sortilège de Moon est un examen de la tranche", () => {
  it("il tire parmi EXACTEMENT les quatre leçons de la Tranche 2", () => {
    // Le contraste avec l'Antre du Dragon Cochon est DÉLIBÉRÉ : là-bas `procAleatoire`
    // n'a qu'UNE entrée pour être déterministe, et deux tests l'y verrouillent. Ici la
    // pluralité est le propos. Ne PAS « harmoniser » les deux zones : ce sont deux
    // usages opposés du même champ, chacun voulu.
    const procs = SORTS.sortilege_lunaire.procAleatoire!;
    expect(procs, "quatre leçons, une par tirage").toHaveLength(4);
    const signatures = procs.map((p) => (p.dissipePositifs ? "dissipePositifs" : p.effet!.stat)).sort();
    expect(signatures, "les quatre leçons nommées, pour qu'un retrait silencieux se voie")
      .toEqual(["dissipePositifs", "friction", "poison", "tetanise"]);
  });

  it("la signature de Moon est cadencée et à 6 PA", () => {
    const s = SORTS.sortilege_lunaire;
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
  });

  it("le caprice du Dostrogo a DEUX entrées — une préparation, pas une copie du boss", () => {
    const procs = SORTS.souffle_capricieux.procAleatoire!;
    expect(procs).toHaveLength(2);
    const signatures = procs.map((p) => p.effet!.stat).sort();
    expect(signatures).toEqual(["friction", "tetanise"]);
    expect(SORTS.souffle_capricieux.coutPA).toBe(4);
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Arbre de Moon", () => {
  it("est la 12e et DERNIÈRE zone de la Tranche 2, sur la toile 24", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[11]).toBe("arbre_de_moon");
    expect(t2.zones, "la Tranche 2 est complète").toHaveLength(12);
    const loc = localiserZone("arbre_de_moon")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(24); // 12 toiles consommées par la t1
  });

  it("la Tranche 2 reste EN CHANTIER malgré ses 12 zones", () => {
    // Le contenu existe, l'équilibrage non : la tranche doit rester non lançable jusqu'à
    // ce qu'Adam la juge prête. Retirer `enChantier` est un choix, pas un effet de bord
    // de la complétion du contenu — d'où ce test.
    expect(TRANCHES.find((t) => t.id === "t2")!.enChantier).toBe(true);
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale a UN boss, qui lâche le Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss)).toEqual(["moon"]);
  });

  it("chaque pack normal contient un porteur de proc aléatoire", () => {
    // Ce n'est pas un effet qu'il faut apprendre ici — les quatre le sont déjà — mais
    // l'IMPRÉVISIBILITÉ, et elle se découvre sur un petit ennemi.
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) =>
        MONSTRES[e.monstre].sorts.some((s) => SORTS[s].procAleatoire?.length));
      expect(porte, `${id} n'enseigne pas l'imprévisibilité`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 3 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 24 lâche la Panoplie Fourbe et ses élites — mais AUCUN objet de boss", () => {
    const pool = butinToile("arbre_de_moon")!;
    expect(pool.normales).toEqual(["fourbacoiffe", "fourbacape", "fourballiance", "fourbaton"]);
    expect(pool.elites).toEqual(["marteau_m_pouce", "coiffe_du_gaddie"]);
    // le tableau d'Adam ne fournit pas d'objets de boss pour Moon : liste vide
    // ASSUMÉE (comme la toile 1 en t1) — ce test tombera le jour où ils arrivent.
    expect(pool.boss).toEqual([]);
  });
});

describe("les quatre tirages prouvés PAR LE MOTEUR", () => {
  /** Une équipe aux PV du niveau où la zone se joue (≈ 93), stats INCHANGÉES.
   *  Pièges déjà rencontrés (Bateau, Antre, Repaire, Domaine) : un héros de niveau 1
   *  meurt du coup qu'on veut observer, or le moteur n'applique effets et procs que sur
   *  une cible VIVANTE ; et monter son agilité lui donne une esquive qui annule dégât ET
   *  proc, de façon reproductible puisque la graine est fixe. */
  const equipeDeSonde = (): Combatant[] => {
    const equipe = fabriquerEquipe();
    for (const h of equipe) {
      h.pvBase = 1200; h.pvMax = 1200; h.pvActuels = 1200;
    }
    return equipe;
  };

  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  /** Lance `sortId` de `lanceurId` sur une victime préparée (bouclier + HoT via
   *  `mot_galvanisant`), avec un rng CONSTANT calé pour viser l'index `i` de
   *  `procAleatoire` — le tirage vaut `Math.floor(rng() × longueur)`.
   *
   *  Mesuré : une constante ne provoque aucune esquive systématique (les quatre coups
   *  portent), ce qui rend la technique fiable. */
  const tirage = (lanceurId: string, sortId: string, i: number, total: number) => {
    const ctx = { rng: () => (i + 0.5) / total, log: () => {}, playerDamageBonus: 1 };
    const lanceur = trouver(lanceurId);
    lanceur.position = 0;
    const [victime, allie] = equipeDeSonde();
    victime.position = 0;
    allie.position = 4;
    const cs = [victime, allie, lanceur];
    // `mot_galvanisant` pose un bouclier ET un HoT : c'est le HoT qui sert de marqueur du
    // désenvoûtement, car le bouclier tombe de toute façon à 0, absorbé par les dégâts —
    // le vérifier ne prouverait donc rien (piège relevé à la sonde).
    lancerSort(allie, SORTS.mot_galvanisant, victime.ref, cs, ctx);
    expect(victime.effets.some((e) => e.stat === "hot"), "la mise en place doit avoir marché").toBe(true);
    lancerSort(lanceur, SORTS[sortId], victime.ref, cs, ctx);
    return victime;
  };

  const a = (v: Combatant, stat: string) => v.effets.some((e) => e.stat === stat);

  it("tirage 0 : le désenvoûtement retire le HoT, et rien d'autre ne s'applique", () => {
    const v = tirage("moon", "sortilege_lunaire", 0, 4);
    expect(a(v, "hot"), "le HoT doit avoir été dévoré").toBe(false);
    for (const autre of ["friction", "tetanise", "poison"]) {
      expect(a(v, autre), `${autre} ne doit PAS s'appliquer sur ce tirage`).toBe(false);
    }
  });

  it("tirage 1 : la friction s'applique, et le HoT survit", () => {
    const v = tirage("moon", "sortilege_lunaire", 1, 4);
    expect(a(v, "friction")).toBe(true);
    expect(a(v, "hot"), "pas de désenvoûtement sur ce tirage").toBe(true);
  });

  it("tirage 2 : la toile s'applique, et le HoT survit", () => {
    const v = tirage("moon", "sortilege_lunaire", 2, 4);
    expect(a(v, "tetanise")).toBe(true);
    expect(a(v, "hot"), "pas de désenvoûtement sur ce tirage").toBe(true);
  });

  it("tirage 3 : le poison s'applique, et le HoT survit", () => {
    const v = tirage("moon", "sortilege_lunaire", 3, 4);
    expect(a(v, "poison")).toBe(true);
    expect(a(v, "hot"), "pas de désenvoûtement sur ce tirage").toBe(true);
  });

  it("le caprice du Dostrogo tire bien parmi ses DEUX entrées", () => {
    const friction = tirage("dostrogo", "souffle_capricieux", 0, 2);
    expect(a(friction, "friction")).toBe(true);
    expect(a(friction, "tetanise")).toBe(false);
    const toile = tirage("dostrogo", "souffle_capricieux", 1, 2);
    expect(a(toile, "tetanise")).toBe(true);
    expect(a(toile, "friction")).toBe(false);
  });
});

describe("budget de PA et domination", () => {
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
      x.pvBase = 1200; x.pvMax = 1200; x.pvActuels = 1200;
    }
    return h;
  };

  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "arbre_de_moon")!;
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

  it("Moon ne gaspille rien quand son sortilège recharge", async () => {
    const eq = equipe();
    const m = trouver("moon");
    expect(await paOrphelins(m, [m, ...eq], { sortilege_lunaire: 1 })).toBe(0);
  });

  it("chaque porteur de signature la lance réellement", async () => {
    const eq = equipe();
    for (const [espece, attendu] of [
      ["dostrogo", "souffle_capricieux"], ["moon", "sortilege_lunaire"],
    ] as const) {
      const c = trouver(espece);
      c.paActuels = c.paMax;
      c.cooldowns = {};
      c.lancersCeTour = {};
      expect((await controllerIA(c, [c, ...eq]))!.sort.id, `${espece}`).toBe(attendu);
    }
  });

  /** Dégâts par tour estimés. Modèle de CONCEPTION, pas une simulation du moteur.
   *
   *  Les RIDERS sont exclus : ce sont des contrôles et de l'usure, pas des dégâts
   *  directs — même exclusion que l'armure aux Pitons, le soin au Repaire, le
   *  désenvoûtement à l'Antre, l'annulation à la Tanière et la toile au Domaine. Le
   *  Laboratoire avait fait l'erreur inverse (son modèle ignorait le poison, l'identité
   *  même de la zone) et validé une inversion boss/escorte. */
  const degatsParTour = (id: string, cibles: number): number => {
    const m = MONSTRES[id];
    const stats = m.stats as unknown as Record<string, number>;
    const d = Math.max(stats.force ?? 0, stats.intelligence ?? 0, stats.agilite ?? 0, stats.chance ?? 0);
    const mult = 1 + Math.min(0.5, (stats.intelligence ?? 0) * 0.005);
    const offensifs = m.sorts.filter((s) => SORTS[s].type === "degats");
    const coup = (s: string) => {
      const sort = SORTS[s];
      const direct = ((sort.baseMin + sort.baseMax) / 2) * multStatFrappe(d) * mult;
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

  it("Moon frappe plus fort que TOUTE espèce non-boss de la zone", () => {
    const nonBoss = [...especesDeLaZone()].filter((m) => !MONSTRES[m].boss);
    expect(nonBoss.length).toBeGreaterThan(0);
    for (const cibles of [1, 2]) {
      const b = degatsParTour("moon", cibles);
      for (const e of nonBoss) {
        const esc = degatsParTour(e, cibles);
        expect(b, `à ${cibles} cible(s) : Moon (${b.toFixed(0)}) doit dépasser ${e} (${esc.toFixed(0)})`)
          .toBeGreaterThan(esc);
      }
    }
  });
});
