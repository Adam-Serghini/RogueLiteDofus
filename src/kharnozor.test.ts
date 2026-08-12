// =============================================================================
//  kharnozor.test.ts — Repaire du Kharnozor & Épreuve de Draegnerys (zone 9, T2)
//  le premier soigneur ennemi de la tranche, et un boss qui grandit avec ses alliés.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { controllerIA, lancerSort } from "./combat";
import type { Combatant } from "./types";

const ELEMENT_DE = {
  dragoeuf_calcaire: "terre", dragoeuf_argile: "terre",
  dragoeuf_ardoise: "air", dragoeuf_charbon: "eau",
  dragoss_ardoise: "air", dragoss_charbon: "eau", dragoss_proteiforme: "eau",
  kharnozor: "air", draegnerys: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  dragoeuf_calcaire: "Dragstayr le Fonceur",
  dragoeuf_argile: "Dragkouine la Déguisée",
  dragoeuf_ardoise: "Dragmoclaiss le Fataliste",
  dragoeuf_charbon: "Dragnostik le Sceptique",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Repaire du Kharnozor", () => {
  it("les 9 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 9 sont capturables — les quatre Dragoeufs, jamais les Dragoss", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("aucun sprite en doublon dans la zone", () => {
    // Garde-fou permanent depuis l'Antre du Dragon Cochon (Cochon de Lait écarté).
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("seul Draegnerys est feu", () => {
    // L'intelligence compte DEUX fois (scaling élémentaire ET `multOffensif`, plafonné
    // dès 100) : au Bateau du Chouque, le seul monstre feu de la zone était devenu son
    // meilleur DPS, au-dessus des deux boss. Le feu reste donc à un boss.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (id === "draegnerys") expect(dominante(id)).toBe("intelligence");
      else expect(dominante(id), `${id} ne doit pas être feu`).not.toBe("intelligence");
    }
  });

  it("les matériaux ne sont PAS des éléments", () => {
    // Les Blops (toile 13) et les Gelées (toile 15) ont déjà fait couleur→élément. Ici
    // un même matériau existe en œuf ET en adulte ; ce test fige l'intention en
    // vérifiant que le matériau ne détermine pas mécaniquement l'élément.
    const memeMateriau = (mot: string) =>
      Object.keys(ELEMENT_DE).filter((id) => id.includes(mot));
    expect(memeMateriau("ardoise")).toHaveLength(2);
    expect(memeMateriau("charbon")).toHaveLength(2);
  });

  it("exactement UNE espèce de la zone soigne", () => {
    const soigneurs = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].ia === "soutien");
    expect(soigneurs).toEqual(["dragoss_proteiforme"]);
  });

  it("le soigneur ne peut soigner qu'UNE fois par tour", () => {
    // 4 PA et deux sorts à 4 PA = une seule action. Sans ce plafond naturel, un
    // Protéiforme à 8 PA soignerait deux fois et verrouillerait le combat.
    const p = MONSTRES.dragoss_proteiforme;
    expect(p.pa).toBe(4);
    for (const s of p.sorts) expect(SORTS[s].coutPA, `${s}`).toBe(4);
  });

  it("le Kharnozor grandit avec ses alliés et n'a PAS de sort-signature", () => {
    // Son identité est le passif, comme Grunob en Tranche 1 — seul précédent du jeu.
    // Grunob est à 0,06 après avoir été descendu de 0,10 (il asphyxiait les dégâts en
    // équipement commun) ; 0,10 ici est un cran au-dessus pour une toile bien plus
    // avancée, et c'est le PREMIER bouton à tourner si la salle est oppressante.
    expect(MONSTRES.kharnozor.bonusParAllieLigne).toBe(0.1);
    expect(MONSTRES.kharnozor.sorts).toEqual(["charge"]);
  });

  it("aucune escorte ne DÉPASSE le budget de PA d'un boss", () => {
    // Inégalité LARGE, et non stricte comme aux zones à boss unique : dans une salle
    // jumelée les boss sont à 6 PA (précédent des Blops Royaux, refus de refaire les
    // 20 PA du Terrier), or `charge` coûte 6, donc tout cogneur de la zone est à 6 PA
    // lui aussi. L'égalité est inévitable ici ; ce qui doit rester vrai, c'est qu'une
    // escorte ne joue jamais plus d'actions qu'un boss — et la vraie garantie est le
    // test de domination, qui compare les dégâts par tour.
    for (const id of Object.keys(ELEMENT_DE)) {
      if (!MONSTRES[id].boss) {
        expect(MONSTRES[id].pa, `${id}`).toBeLessThanOrEqual(MONSTRES.kharnozor.pa);
      }
    }
  });
});

describe("les sorts de la zone", () => {
  it("le souffle régénérant est un vrai sort de soin sur allié", () => {
    const s = SORTS.souffle_regenerant;
    expect(s, "souffle_regenerant manquant").toBeTruthy();
    expect(s.type).toBe("soin");   // sinon `iaSoutien` ne le trouverait pas
    expect(s.cible).toBe("allie");
    expect(s.baseMin).toBeGreaterThan(0);
    // `scaling` est IGNORÉ pour les soins (combat.ts:1451) : la puissance se règle
    // uniquement par baseMin/baseMax. Le mettre à autre chose que 0 induirait en erreur.
    expect(s.scaling).toBe(0);
  });

  it("le souffle draconique balaie une rangée", () => {
    const s = SORTS.souffle_draconique;
    expect(s.type).toBe("degats");
    expect(s.zoneLigne).toBe(true);
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Repaire du Kharnozor", () => {
  it("est la 9e zone de la Tranche 2, sur la toile 21", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[8]).toBe("repaire_kharnozor");
    const loc = localiserZone("repaire_kharnozor")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(21); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale aligne les DEUX boss et le soigneur", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss).sort()).toEqual(["draegnerys", "kharnozor"]);
    expect(salle, "le soigneur doit être dans la salle finale").toContain("dragoss_proteiforme");
  });

  it("le soigneur est dans les TROIS packs normaux", () => {
    // La leçon s'apprend sur un petit ennemi avant de se payer devant les boss.
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    for (const id of zone.pools.normales) {
      const especes = COMBATS[id].ennemis.map((e) => e.monstre);
      expect(especes, `${id} n'enseigne pas la leçon`).toContain("dragoss_proteiforme");
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 21 lâche la Panoplie du Commandant, ses élites et ses boss", () => {
    const pool = butinToile("repaire_kharnozor")!;
    expect(pool.normales).toEqual(["casque_du_commandant_dragoeuf", "cape_du_commandant_dragoeuf", "anneau_du_commandant_dragoeuf", "lame_du_commandant_dragoeuf"]);
    expect(pool.elites).toEqual(["dragocoiffe_charbon", "dragocoiffe_blanche"]);
    expect(pool.boss).toEqual(["le_kikoularc", "bracelet_tmotiv", "la_brouteuse"]);
  });
});

describe("le soigneur et le passif, prouvés PAR LE MOTEUR", () => {
  const ctxNeuf = () => {
    let g = 97531;
    const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    return { rng, log: () => {}, playerDamageBonus: 1 };
  };

  /** Une équipe aux PV du niveau OÙ LA ZONE SE JOUE (≈ 81), stats INCHANGÉES.
   *
   *  Deux pièges rencontrés au Bateau puis à l'Antre : un héros de niveau 1 (~60 PV)
   *  meurt du coup qu'on veut observer, et monter son agilité lui donne une esquive qui
   *  annule dégât ET effet — de façon parfaitement reproductible puisque la graine est
   *  fixe. Ici les héros encaissent, ils ne frappent pas. */
  const equipeDeSonde = (): Combatant[] => {
    const equipe = fabriquerEquipe();
    for (const h of equipe) {
      h.pvBase = 800;
      h.pvMax = 800;
      h.pvActuels = 800;
    }
    return equipe;
  };

  const heros = () => {
    const h = equipeDeSonde();
    for (const [i, x] of h.entries()) x.position = i < 2 ? i : i + 2; // 2 devant, 2 derrière
    return h;
  };

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

  it("le Protéiforme soigne l'allié blessé, et mord quand personne ne l'est", async () => {
    // `iaSoutien` cherche un sort `type: "soin"`, cible le PLUS blessé, et retombe sur
    // `iaAgressif` si l'équipe est intacte — donc il ne gaspille jamais son tour. C'est
    // ce comportement qu'on vérifie, pas le champ `ia` dans les données.
    const equipe = heros();
    const pack = fabriquerEnnemis("khz_3");
    const soigneur = pack.find((x) => x.monstreId === "dragoss_proteiforme")!;
    const blesse = pack.find((x) => x.monstreId !== "dragoss_proteiforme")!;
    const cs = [...pack, ...equipe];

    // personne de blessé → il attaque
    soigneur.paActuels = soigneur.paMax;
    expect((await controllerIA(soigneur, cs))!.sort.id).toBe("morsure");

    // un allié blessé → il soigne, et c'est bien lui qu'il cible
    blesse.pvActuels = Math.round(blesse.pvMax / 4);
    soigneur.paActuels = soigneur.paMax;
    const action = (await controllerIA(soigneur, cs))!;
    expect(action.sort.id).toBe("souffle_regenerant");
    expect(action.cibleRef).toBe(blesse.ref);
  });

  it("le soin remonte vraiment les PV", () => {
    const ctx = ctxNeuf();
    const pack = fabriquerEnnemis("khz_3");
    const soigneur = pack.find((x) => x.monstreId === "dragoss_proteiforme")!;
    const blesse = pack.find((x) => x.monstreId !== "dragoss_proteiforme")!;
    blesse.pvActuels = Math.round(blesse.pvMax / 4);
    const avant = blesse.pvActuels;
    lancerSort(soigneur, SORTS.souffle_regenerant, blesse.ref, pack, ctx);
    expect(blesse.pvActuels).toBeGreaterThan(avant);
  });

  it("il ne soigne qu'UNE fois par tour même avec deux blessés", async () => {
    // Contrôle par exécution, en plus du contrôle sur les données : deux alliés à terre,
    // une seule action doit sortir avant l'épuisement des PA.
    const equipe = heros();
    const pack = fabriquerEnnemis("khz_elite");
    const soigneur = pack.find((x) => x.monstreId === "dragoss_proteiforme")!;
    const blesses = pack.filter((x) => x.monstreId !== "dragoss_proteiforme").slice(0, 2);
    expect(blesses).toHaveLength(2);
    for (const b of blesses) b.pvActuels = Math.round(b.pvMax / 4);
    const cs = [...pack, ...equipe];
    expect(await sequenceDuTour(soigneur, cs, 3)).toEqual(["souffle_regenerant"]);
  });

  it("le passif du Kharnozor mord : il frappe plus fort entouré", () => {
    // `bonusParAllieLigne` compte les alliés VIVANTS de sa rangée, lui exclu. Mêmes
    // jets (graine réinitialisée), une fois seul, une fois entouré de deux alliés.
    const degats = (compagnons: number): number => {
      const ctx = ctxNeuf();
      const boss = fabriquerEnnemis("khz_boss").find((x) => x.monstreId === "kharnozor")!;
      boss.position = 0;
      const voisins = fabriquerEnnemis("khz_elite")
        .filter((x) => x.monstreId !== "kharnozor").slice(0, compagnons);
      for (const [i, v] of voisins.entries()) v.position = i + 1; // même rangée que le boss
      const [h] = equipeDeSonde();
      h.position = 0;
      const cs = [h, boss, ...voisins];
      lancerSort(boss, SORTS.charge, h.ref, cs, ctx);
      return h.pvMax - h.pvActuels;
    };
    const seul = degats(0);
    const entoure = degats(2);
    expect(seul, "la charge doit porter").toBeGreaterThan(0);
    expect(entoure, `entouré ${entoure} doit dépasser seul ${seul}`).toBeGreaterThan(seul);
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
      x.pvBase = 800; x.pvMax = 800; x.pvActuels = 800;
    }
    return h;
  };

  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "repaire_kharnozor")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  it("aucune des 9 espèces ne laisse de PA sur la table", async () => {
    const eq = equipe();
    for (const espece of [...especesDeLaZone()]) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...eq]), `${espece} laisse des PA`).toBe(0);
    }
  });

  it("Draegnerys ne gaspille rien quand son souffle recharge", async () => {
    const eq = equipe();
    const d = trouver("draegnerys");
    expect(await paOrphelins(d, [d, ...eq], { souffle_draconique: 1 })).toBe(0);
  });

  it("le Kharnozor n'a AUCUN sort sous cooldown — donc rien à recharger", () => {
    // Dit explicitement plutôt qu'omis : son identité est le passif, il n'a pas de
    // signature, donc le cas « signature en recharge » n'existe pas pour lui. L'omettre
    // laisserait croire à un oubli de couverture.
    for (const s of MONSTRES.kharnozor.sorts) {
      expect(SORTS[s].cooldownTours, `${s}`).toBeUndefined();
    }
  });

  /** Dégâts par tour estimés. Modèle de CONCEPTION, pas une simulation du moteur.
   *
   *  Le SOIN et le PASSIF sont exclus : l'un n'est pas un dégât, l'autre dépend du
   *  nombre d'alliés vivants et non du tour joué — comme la friction et le vampirisme
   *  au Bateau, l'armure aux Pitons, le désenvoûtement à l'Antre. Le Laboratoire avait
   *  fait l'erreur inverse (son modèle ignorait le poison, l'identité même de la zone)
   *  et validé une inversion. */
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

  it("chaque boss frappe plus fort que TOUTE espèce non-boss de la zone", () => {
    const nonBoss = [...especesDeLaZone()].filter((m) => !MONSTRES[m].boss);
    expect(nonBoss.length).toBeGreaterThan(0);
    for (const cibles of [1, 2]) {
      for (const boss of ["kharnozor", "draegnerys"]) {
        const b = degatsParTour(boss, cibles);
        for (const e of nonBoss) {
          const esc = degatsParTour(e, cibles);
          expect(b, `à ${cibles} cible(s) : ${boss} (${b.toFixed(0)}) doit dépasser ${e} (${esc.toFixed(0)})`)
            .toBeGreaterThan(esc);
        }
      }
    }
  });
});
