// =============================================================================
//  craqueleurs.test.ts — Pitons Rocheux des Craqueleurs (zone 6 de la Tranche 2)
//  armure native (réduction PLATE des dégâts subis), bestiaire, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { controllerIA, lancerSort } from "./combat";
import type { Combatant } from "./types";

/** Un héros de sonde au niveau OÙ LA ZONE SE JOUE (≈ 70, stat dominante ≈ 150).
 *  `fabriquerEquipe()` sort une équipe de niveau 1 dont les coups tournent à ~19
 *  dégâts : une armure de 20 les annulerait tous, et le test mesurerait alors le
 *  plancher à 0 au lieu de la réduction. Constat à retenir pour l'équilibrage —
 *  l'armure de cette zone est violente contre un personnage sous-niveau. */
function herosDeSonde(): Combatant {
  const [h] = fabriquerEquipe();
  h.stats = { ...h.stats, force: 150, intelligence: 150, agilite: 150, chance: 150 };
  return h;
}

/** Frappe `n` fois la cible et renvoie les dégâts subis coup par coup.
 *  La graine est réinitialisée à chaque appel : deux appels rejouent donc
 *  exactement la même suite de jets (esquives et crits inclus), ce qui rend les
 *  séries comparables terme à terme. */
function coupParCoup(cible: Combatant, sortId: string, n: number): number[] {
  let g = 987654321;
  const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ctx = { rng, log: () => {}, playerDamageBonus: 1 };
  const heros = herosDeSonde();
  heros.position = 0;
  cible.position = 0;
  const cs = [heros, cible];
  const coups: number[] = [];
  for (let i = 0; i < n; i++) {
    cible.pvActuels = cible.pvMax;
    lancerSort(heros, SORTS[sortId], cible.ref, cs, ctx);
    coups.push(cible.pvMax - cible.pvActuels);
  }
  return coups;
}

const degatsCumules = (cible: Combatant, sortId: string, n: number): number =>
  coupParCoup(cible, sortId, n).reduce((a, b) => a + b, 0);

/** Une cible neutre quelconque, pour éprouver le socle sans dépendre du contenu
 *  de la zone (qui n'existe pas encore à ce stade). */
const cibleNeutre = (): Combatant => fabriquerEnnemis("wab_1")[0];

describe("socle : l'armure native retranche un montant PLAT", () => {
  it("une cible blindée encaisse strictement moins, à jets identiques", () => {
    const nu = cibleNeutre();
    const blinde = cibleNeutre();
    blinde.armure = 20;
    const sansArmure = degatsCumules(nu, "morsure", 30);
    const avecArmure = degatsCumules(blinde, "morsure", 30);
    expect(avecArmure).toBeLessThan(sansArmure);
    expect(avecArmure).toBeGreaterThan(0); // 20 ne doit pas suffire à tout annuler
  });

  it("chaque coup perd EXACTEMENT le montant de l'armure", () => {
    // Le cœur de la zone : plate, pas en pourcentage. Un pourcentage serait des
    // résistances sous un autre nom — la leçon du Clos des Blops, déjà donnée.
    const A = 20;
    const nu = coupParCoup(cibleNeutre(), "morsure", 25);
    const blinde = cibleNeutre();
    blinde.armure = A;
    const avec = coupParCoup(blinde, "morsure", 25);
    expect(avec).toHaveLength(nu.length);
    let comparés = 0;
    for (const [i, brut] of nu.entries()) {
      if (brut === 0) { expect(avec[i], `coup ${i} : esquive des deux côtés`).toBe(0); continue; }
      expect(avec[i], `coup ${i} : ${brut} − ${A}`).toBe(Math.max(0, brut - A));
      comparés++;
    }
    expect(comparés, "aucun coup n'a porté : la sonde est trop faible").toBeGreaterThan(10);
  });

  it("une frappe plus faible que l'armure inflige ZÉRO", () => {
    // Le plancher à 0 du moteur EST la leçon de la zone : les petits coups ne
    // rayent pas la pierre. C'est aussi son mode de défaillance, d'où ce test.
    const mur = cibleNeutre();
    mur.armure = 100000;
    expect(degatsCumules(mur, "morsure", 10)).toBe(0);
  });

  it("armure absente ≡ armure nulle (pas de NaN)", () => {
    // `dmg -= undefined` donnerait NaN et casserait silencieusement TOUT le jeu :
    // c'est le vrai risque de la ligne ajoutée au moteur.
    const sansChamp = cibleNeutre();
    const zero = cibleNeutre();
    zero.armure = 0;
    const a = degatsCumules(sansChamp, "morsure", 20);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(degatsCumules(zero, "morsure", 20));
  });

  it("l'armure native s'ajoute à l'armure temporaire, sans la remplacer", () => {
    const c = cibleNeutre();
    c.armure = 15;
    const natif = degatsCumules(c, "morsure", 20);
    c.effets.push({ stat: "armure", valeur: 15, toursRestants: 99 });
    expect(degatsCumules(c, "morsure", 20)).toBeLessThan(natif);
  });
});

const ELEMENT_DE = {
  craqueleur: "terre", craqueleur_des_plaines: "eau", craqueboule: "air",
  craquelourd: "terre", craqueleur_legendaire: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  craqueleur: "Crakmitaine le Faucheur",
  craqueleur_des_plaines: "Cramikaz le Suicidaire",
  craqueboule: "Craquetuss le Piquant",
  craquelourd: "Craquecrac l'Endurant",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire des Pitons Rocheux", () => {
  it("les 5 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 5 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("toute la zone est blindée, et le boss plus que ses escortes", () => {
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(MONSTRES[id].armure ?? 0, `${id} doit porter une armure native`).toBeGreaterThan(0);
    }
    const boss = MONSTRES.craqueleur_legendaire.armure!;
    for (const id of Object.keys(ARCHIS)) expect(boss).toBeGreaterThan(MONSTRES[id].armure!);
  });

  it("la pierre ne rejoue PAS le puzzle élémentaire du Clos des Blops", () => {
    // L'identité de la zone est l'armure plate. Un pic de résistance ramènerait
    // la leçon des couleurs, déjà donnée à la toile 13.
    for (const id of Object.keys(ELEMENT_DE)) {
      const r = MONSTRES[id].resistances ?? {};
      for (const el of ["terre", "feu", "air", "eau"] as const) {
        expect(Math.abs(r[el] ?? 0), `${id} : résistance ${el} trop marquée`).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it("le durcissement empile de l'armure sur son lanceur", () => {
    const s = SORTS.durcissement;
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.effetLanceur?.stat).toBe("armure");
    expect(s.cooldownTours).toBe(2);
    // la durée doit dépasser le cooldown, sinon l'armure ne s'accumule jamais
    expect(s.effetLanceur!.duree).toBeGreaterThan(s.cooldownTours!);
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Pitons Rocheux", () => {
  it("est la 6e zone de la Tranche 2, sur la toile 18", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[5]).toBe("pitons_rocheux");
    const loc = localiserZone("pitons_rocheux")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(18); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale a UN boss, qui lâche le Dofus Pourpre", () => {
    const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss)).toEqual(["craqueleur_legendaire"]);
    expect(MONSTRES.craqueleur_legendaire.dofus).toBe("dofus_pourpre");
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    // La Gelaxième avait livré un `gel_elite` identique à `gel_3` : le nœud élite
    // n'apportait alors aucune rencontre distincte.
    const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    // Sinon leur archi est enfermé derrière les nœuds élite, qui sont rares.
    const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 18 ne lâche rien pour l'instant", () => {
    expect(butinToile("pitons_rocheux")).toBeNull();
  });
});

describe("budget de PA et jouabilité", () => {
  /** Rejoue un tour complet et renvoie les PA restés sur la table. */
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

  /** Séquence des `n` premières actions d'un tour. */
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
      const l = (c.lancersCeTour ??= {});
      l[action.sort.id] = (l[action.sort.id] ?? 0) + 1;
    }
    return jouees;
  }

  const heros = () => {
    const h = fabriquerEquipe();
    for (const [i, x] of h.entries()) x.position = i < 2 ? i : i + 2; // 2 devant, 2 derrière
    return h;
  };

  /** Cherche une espèce dans une rencontre où elle figure VRAIMENT — et jette sinon :
   *  un test doit échouer bruyamment quand son sujet est introuvable, jamais le sauter. */
  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  it("aucune des 5 espèces ne laisse de PA sur la table", async () => {
    const equipe = heros();
    for (const espece of [...especesDeLaZone()]) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...equipe]), `${espece} laisse des PA`).toBe(0);
    }
  });

  it("le boss ne gaspille rien NON PLUS quand son durcissement recharge", async () => {
    const equipe = heros();
    const b = trouver("craqueleur_legendaire");
    expect(await paOrphelins(b, [b, ...equipe], { durcissement: 1 })).toBe(0);
  });

  it("le boss lance réellement son durcissement", async () => {
    const equipe = heros();
    const b = trouver("craqueleur_legendaire");
    expect((await sequenceDuTour(b, [b, ...equipe], 1))[0]).toBe("durcissement");
  });

  it("le boss durcit VRAIMENT : son armure effective monte au fil du combat", () => {
    // Test de moteur, pas de données : c'est la promesse de la salle (une course).
    let g = 555;
    const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const ctx = { rng, log: () => {}, playerDamageBonus: 1 };
    const boss = trouver("craqueleur_legendaire");
    const [h] = fabriquerEquipe();
    h.position = 0;
    boss.position = 0;
    const cs = [h, boss];
    const natif = boss.armure ?? 0;
    lancerSort(boss, SORTS.durcissement, h.ref, cs, ctx);
    const apresUn = natif + boss.effets.filter((e) => e.stat === "armure").reduce((s, e) => s + e.valeur, 0);
    lancerSort(boss, SORTS.durcissement, h.ref, cs, ctx);
    const apresDeux = natif + boss.effets.filter((e) => e.stat === "armure").reduce((s, e) => s + e.valeur, 0);
    expect(apresUn).toBeGreaterThan(natif);
    expect(apresDeux).toBeGreaterThan(apresUn); // il s'empile, il ne se rafraîchit pas
  });

  // Erreur commise TROIS fois dans ce projet : Blops Royaux, Gourlo, Nelween étaient
  // moins dangereux que leurs propres escortes.
  it("le Légendaire frappe plus fort que chacune de ses escortes", () => {
    const zone = ZONES.find((z) => z.id === "pitons_rocheux")!;
    /** Dégâts par tour estimés. Modèle de CONCEPTION, pas une simulation du moteur.
     *
     *  L'ARMURE est exclue : c'est de la défense, pas des dégâts par tour. Au
     *  Laboratoire, ce garde-fou avait mesuré la mauvaise grandeur (il ignorait le
     *  poison, l'identité même de la zone) et validé une inversion ; ici l'erreur
     *  symétrique serait de faire entrer une valeur défensive dans le calcul.
     *  `zoneLigne` est évalué sur `cibles` cibles, dont le cas le plus défavorable
     *  au boss (une seule cible en rangée avant). */
    const degatsParTour = (id: string, cibles: number): number => {
      const m = MONSTRES[id];
      const stats = m.stats as unknown as Record<string, number>;
      const dom = Math.max(stats.force ?? 0, stats.intelligence ?? 0, stats.agilite ?? 0, stats.chance ?? 0);
      const mult = 1 + Math.min(0.5, (stats.intelligence ?? 0) * 0.005);
      const coup = (s: string) => {
        const sort = SORTS[s];
        const direct = ((sort.baseMin + sort.baseMax) / 2 + dom * sort.scaling) * mult;
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
      const enRecharge = m.sorts.filter((s) => !SORTS[s].cooldownTours);
      const avec = cycle(m.sorts);
      return m.sorts.length === enRecharge.length ? avec : (avec + cycle(enRecharge)) / 2;
    };
    const escortes = COMBATS[zone.pools.boss[0]].ennemis
      .map((e) => e.monstre).filter((m) => !MONSTRES[m].boss);
    expect(escortes.length, "la salle doit avoir une escorte à comparer").toBeGreaterThan(0);
    for (const cibles of [1, 2]) {
      const boss = degatsParTour("craqueleur_legendaire", cibles);
      for (const e of escortes) {
        const esc = degatsParTour(e, cibles);
        expect(boss, `à ${cibles} cible(s) : le Légendaire (${boss.toFixed(0)}) doit dépasser ${e} (${esc.toFixed(0)})`)
          .toBeGreaterThan(esc);
      }
    }
  });
});
