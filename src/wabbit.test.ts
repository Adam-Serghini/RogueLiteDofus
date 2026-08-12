// =============================================================================
//  wabbit.test.ts — Terrier du Wa Wabbit (zone 5 de la Tranche 2)
//  bestiaire, riposte ennemie (mécanique dormante réveillée), budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { controllerIA, lancerSort } from "./combat";
import type { Combatant } from "./types";
import { multStatFrappe } from "./progression";

const ELEMENT_DE = {
  wabbit: "terre", black_wabbit: "feu", tiwabbit: "air", tiwabbit_kiafin: "eau",
  wo_wabbit: "air", grand_pa_wabbit: "terre",
  tiwobot: "feu", wobot: "terre", wa_wabbit: "air", wa_wobot: "terre",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;

const ARCHIS = {
  tiwabbit: "Tiwalpé le Dévêtu",
  tiwabbit_kiafin: "Tiwoflan le Lâche",
  wabbit: "Wabbitud le Constant",
  black_wabbit: "Wagnagnah le Sanglant",
  wo_wabbit: "Wokènrôl le Danseur",
  grand_pa_wabbit: "Grandilok le Clameur",
} as const;

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Terrier du Wa Wabbit", () => {
  it("les 10 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      const m = MONSTRES[id];
      expect(m, `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("6 espèces sur 10 sont capturables, avec des archis tous distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    // Metamob ne référence AUCUN archimonstre wobot — vérifié. Les quatre robots
    // (dont les deux boss) n'en portent donc pas, et c'est intentionnel.
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("le lapin est fragile et le robot est blindé", () => {
    for (const id of ["tiwobot", "wobot", "wa_wobot"]) {
      const r = MONSTRES[id].resistances ?? {};
      const valeurs = (["terre", "feu", "air", "eau"] as const).map((e) => r[e] ?? 0);
      // blindage = une résistance PLATE, pas un pic élémentaire : le Clos des Blops
      // enseigne déjà le puzzle des couleurs, le Terrier ne le rejoue pas.
      expect(new Set(valeurs).size, `${id} doit être blindé uniformément`).toBe(1);
      expect(valeurs[0], `${id} doit être plus résistant qu'un lapin`).toBeGreaterThanOrEqual(0.2);
    }
    for (const id of Object.keys(ARCHIS)) {
      const r = MONSTRES[id].resistances ?? {};
      const max = Math.max(...(["terre", "feu", "air", "eau"] as const).map((e) => r[e] ?? 0));
      expect(max, `${id} (lapin) ne doit pas être blindé comme un robot`).toBeLessThan(0.25);
    }
  });
});

describe("les sorts du Terrier", () => {
  it("la riposte mécanique arme son propre lanceur", () => {
    // `contre` existait dans le moteur bien avant cette zone (le Sabre Shodanwa le porte
    // toujours ; le Duel du Iop, l'autre porteur d'alors, a disparu au rework du Iop),
    // mais AUCUN ennemi n'avait jamais riposté. Le sort est de type `degats` — donc
    // jouable par `iaAgressif`, qui ignore les buffs — et la posture passe par
    // `effetLanceur`, appliqué au lanceur dans le chemin des sorts de dégâts.
    for (const id of ["riposte_mecanique", "contre_mesure"]) {
      const s = SORTS[id];
      expect(s, `${id} manquant`).toBeTruthy();
      expect(s.type).toBe("degats");
      expect(s.effetLanceur?.stat, `${id} doit poser une posture de contre`).toBe("contre");
      expect(s.effetLanceur!.valeur).toBeGreaterThan(0);
      expect(s.effetLanceur!.duree).toBeGreaterThan(0);
    }
  });

  it("la contre-mesure du boss est strictement plus forte que la riposte de base", () => {
    const petite = SORTS.riposte_mecanique.effetLanceur!;
    const grande = SORTS.contre_mesure.effetLanceur!;
    expect(grande.valeur * grande.duree).toBeGreaterThan(petite.valeur * petite.duree);
  });

  it("riposte_mecanique est limitée à un lancer par tour", () => {
    // Le Wobot a 8 PA et deux sorts à 4. `iaAgressif` n'a aucune mémoire du tour :
    // sans ce champ il rejouerait la posture et l'EMPILERAIT (sommeEffet additionne
    // les valeurs de `contre`), rendant `morsure` inatteignable. Bug du Kolérat.
    expect(SORTS.riposte_mecanique.maxParTour).toBe(1);
  });

  it("le caprice royal balaie une rangée et lui retire des PA", () => {
    const s = SORTS.caprice_royal;
    expect(s.zoneLigne).toBe(true);
    expect(s.retraitPA).toBeGreaterThan(0);
    expect(s.cooldownTours).toBe(2);
  });
});

describe("la zone Terrier du Wa Wabbit", () => {
  it("est la 5e zone de la Tranche 2, sur la toile 17", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[4]).toBe("terrier_wa_wabbit");
    const loc = localiserZone("terrier_wa_wabbit")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(17); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    // Garde-fou : une 11e espèce ajoutée à un pack sans être déclarée dans
    // ELEMENT_DE échapperait sinon à tous les contrôles d'élément et d'archi.
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale aligne les deux rois et une escorte capturable", () => {
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle).toContain("wa_wabbit");
    expect(salle).toContain("wa_wobot");
    expect(salle.some((m) => MONSTRES[m].archiNom), "l'escorte doit être capturable").toBe(true);
  });

  it("aucune rencontre n'aligne deux fois la même espèce, ni plus de 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const especes = COMBATS[id].ennemis.map((e) => e.monstre);
      expect(new Set(especes).size, `${id} double une espèce`).toBe(especes.length);
      expect(especes.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("la toile 17 lâche la Panoplie du Wa Wabbit, ses élites et ses boss", () => {
    const pool = butinToile("terrier_wa_wabbit")!;
    expect(pool.normales).toEqual(["couronne_du_wa_wabbit", "cape_du_wa_wabbit", "sceptre_du_wa_wabbit", "bracelet_du_wa_wabbit"]);
    expect(pool.elites).toEqual(["oreilles_du_wabbit", "sac_cawotte"]);
    expect(pool.boss).toEqual(["sabre_sandawa", "couronne_du_wa_wobot", "cape_du_wa_wobot"]);
  });
});

describe("la leçon de la zone est enseignée tôt", () => {
  it("chaque pack normal contient un porteur de riposte", () => {
    // Le projet s'est déjà fait piéger deux fois en enfermant l'identité d'une zone
    // dans le nœud élite : Canondorf ne tirait jamais son canon, le Kolérat
    // n'apparaissait qu'en élite. Ici le joueur se brûle sur un Tiwobot d'abord.
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) => MONSTRES[e.monstre].sorts.includes("riposte_mecanique"));
      expect(porte, `${id} n'enseigne pas la riposte`).toBe(true);
    }
  });

  it("les 6 espèces capturables apparaissent toutes en pack NORMAL", () => {
    // Sinon leur archi est enfermé derrière les nœuds élite, qui sont rares.
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
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
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  it("aucune des 10 espèces ne laisse de PA sur la table", async () => {
    const equipe = heros();
    for (const espece of [...especesDeLaZone()]) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...equipe]), `${espece} laisse des PA`).toBe(0);
    }
  });

  it("les deux boss ne gaspillent rien NON PLUS quand leur signature est en recharge", async () => {
    const equipe = heros();
    for (const [espece, signature] of [["wa_wobot", "contre_mesure"], ["wa_wabbit", "caprice_royal"]] as const) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...equipe], { [signature]: 1 }), `${espece} en recharge`).toBe(0);
    }
  });

  it("chaque porteur de signature la lance réellement", async () => {
    const equipe = heros();
    for (const [espece, attendu] of [
      ["tiwobot", "riposte_mecanique"], ["wa_wobot", "contre_mesure"], ["wa_wabbit", "caprice_royal"],
    ] as const) {
      const c = trouver(espece);
      expect((await sequenceDuTour(c, [c, ...equipe], 1))[0], `${espece}`).toBe(attendu);
    }
  });

  it("le Wobot enchaîne Riposte PUIS Morsure — il n'empile pas deux postures", async () => {
    const equipe = heros();
    const w = trouver("wobot");
    expect(await sequenceDuTour(w, [w, ...equipe], 2)).toEqual(["riposte_mecanique", "morsure"]);
  });

  // Erreur commise TROIS fois dans ce projet : Blops Royaux, Gourlo, Nelween étaient
  // moins dangereux que leurs propres escortes. Ici la salle aligne un Grand Pa
  // Wabbit à 10 PA, soit le même budget que les boss.
  it("chacun des deux boss frappe plus fort que l'escorte", () => {
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    /** Dégâts par tour estimés. Modèle de CONCEPTION, pas une simulation du moteur.
     *
     *  La RIPOSTE n'est PAS comptée : c'est un dégât renvoyé, pas infligé, et son
     *  montant ne dépend pas du tour joué. La mélanger fausserait la comparaison —
     *  au Laboratoire, ce même garde-fou mesurait la mauvaise grandeur et validait
     *  une inversion. `zoneLigne` est évalué sur `cibles` cibles, dont le cas le
     *  plus défavorable au boss (une seule cible en rangée avant). */
    const degatsParTour = (id: string, cibles: number): number => {
      const m = MONSTRES[id];
      const stats = m.stats as unknown as Record<string, number>;
      const dom = Math.max(stats.force ?? 0, stats.intelligence ?? 0, stats.agilite ?? 0, stats.chance ?? 0);
      const mult = 1 + Math.min(0.5, (stats.intelligence ?? 0) * 0.005);
      const coup = (s: string) => {
        const sort = SORTS[s];
        const direct = ((sort.baseMin + sort.baseMax) / 2) * multStatFrappe(dom) * mult;
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
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    const escortes = salle.filter((m) => !MONSTRES[m].boss);
    expect(escortes.length, "la salle doit avoir une escorte à comparer").toBeGreaterThan(0);
    for (const cibles of [1, 2]) {
      for (const boss of ["wa_wabbit", "wa_wobot"]) {
        const b = degatsParTour(boss, cibles);
        for (const e of escortes) {
          const esc = degatsParTour(e, cibles);
          expect(b, `à ${cibles} cible(s) : ${boss} (${b.toFixed(0)}) doit dépasser ${e} (${esc.toFixed(0)})`)
            .toBeGreaterThan(esc);
        }
      }
    }
  });
});

describe("la riposte part vraiment, côté ENNEMI", () => {
  // Le test décisif de la zone. Tous les autres vérifient des champs de données ;
  // celui-ci vérifie le moteur. `combat.ts` porte le commentaire « contre/riposteAvant
  // sont des mécaniques côté joueur uniquement » — il décrivait le contenu existant,
  // pas une restriction du code, mais toute l'identité du Terrier en dépend.
  const trouverWobot = (): Combatant => {
    const zone = ZONES.find((z) => z.id === "terrier_wa_wabbit")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === "wobot");
      if (c) return c;
    }
    throw new Error("wobot introuvable dans les rencontres de la zone");
  };

  it("un héros qui frappe un Wobot en posture encaisse des dégâts en retour", () => {
    let graine = 12345;
    const rng = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const ctx = { rng, log: () => {}, playerDamageBonus: 1 };

    const wobot = trouverWobot();
    const [heros] = fabriquerEquipe();
    heros.position = 0;
    wobot.position = 0;
    const cs = [heros, wobot];

    // le Wobot frappe et s'arme du même geste (`effetLanceur`)
    lancerSort(wobot, SORTS.riposte_mecanique, heros.ref, cs, ctx);
    expect(wobot.effets.some((e) => e.stat === "contre"), "le Wobot doit porter la posture").toBe(true);

    // 300 frappes du héros sur le Wobot armé : la riposte doit partir parfois,
    // et seulement parfois (c'est un jet à 25 %, pas un effet automatique).
    let ripostes = 0;
    for (let i = 0; i < 300; i++) {
      heros.pvActuels = heros.pvMax;
      wobot.pvActuels = wobot.pvMax; // on ne veut pas le tuer en cours de route
      lancerSort(heros, SORTS.morsure, wobot.ref, cs, ctx);
      if (heros.pvActuels < heros.pvMax) ripostes++;
    }
    expect(ripostes, "aucune riposte : le moteur ignore `contre` côté ennemi").toBeGreaterThan(0);
    expect(ripostes, "riposte systématique : le jet de probabilité n'est pas appliqué").toBeLessThan(300);
  });
});
