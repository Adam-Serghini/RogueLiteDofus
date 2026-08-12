// =============================================================================
//  ancestral.test.ts — Domaine Ancestral & Antre de la Reine Nyée (zone 11, T2)
//  la toile coupe l'accès à la rangée arrière (`tetanise` côté ennemi, une première).
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { lancerSort, ciblesValides, controllerIA } from "./combat";
import type { Combatant } from "./types";
import { multStatFrappe } from "./progression";

const ELEMENT_DE = {
  abraknyde_venerable: "terre", abraknyde_sombre: "terre",
  abrakne_sombre: "eau", abraknyde_ancestral: "eau",
  arapex: "air", araknotron: "air", nefileuse: "air", reine_nyee: "air",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  abraknyde_venerable: "Abrakildas le Vénérable",
  abraknyde_sombre: "Abrakanette l'Encapsulé",
  abrakne_sombre: "Abraklette le Fondant",
  arapex: "Arapliké la Calligraphe",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire du Domaine Ancestral", () => {
  it("les 8 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 8 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("aucun monstre de la zone n'est feu", () => {
    // Règle reprise de la Tanière du Meulou : personne n'est feu, donc le doublement de
    // l'intelligence n'entre pas en jeu et il n'y a rien à compenser entre les deux boss.
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(dominante(id), `${id}`).not.toBe("intelligence");
    }
  });

  it("aucun sprite en doublon dans la zone", () => {
    const imgs = Object.keys(ELEMENT_DE).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("deux espèces tissent : la Néfileuse et la Reine", () => {
    const tisseuses = Object.keys(ELEMENT_DE).filter((id) =>
      MONSTRES[id].sorts.some((s) => SORTS[s].effet?.stat === "tetanise"));
    expect(tisseuses.sort()).toEqual(["nefileuse", "reine_nyee"]);
  });

  it("qui frappe deux fois frappe plus faible", () => {
    expect(MONSTRES.araknotron.pa).toBe(8);
    for (const lent of ["abraknyde_venerable", "abraknyde_sombre"]) {
      expect(dom("araknotron"), `contre ${lent}`).toBeLessThan(dom(lent));
    }
  });

  it("une escorte ne dépasse le budget de PA d'un boss QUE si elle frappe plus faible", () => {
    // Dans une salle jumelée les boss sont à 6 PA (précédent des Blops Royaux, refus de
    // refaire les 20 PA du Terrier), et `charge` en coûte 6 : un cogneur de la zone y est
    // donc à 6 PA lui aussi, et un frappeur-deux-fois à 8 DÉPASSE le boss. L'invariant
    // « escorte ≤ boss » est donc faux pour cette forme de zone — c'était déjà le cas au
    // Bateau du Chouque, où ce test n'existait pas.
    //
    // La règle réelle, elle, tient : un budget de PA supérieur doit être payé par une
    // dominante strictement plus faible. C'est ce qui empêche l'inversion boss/escorte,
    // et la garantie finale reste le test de domination sur les dégâts par tour.
    const paBoss = MONSTRES.reine_nyee.pa;
    const dominanteMax = Math.max(
      ...Object.keys(ELEMENT_DE).filter((id) => !MONSTRES[id].boss && MONSTRES[id].pa <= paBoss)
        .map(dom),
    );
    for (const id of Object.keys(ELEMENT_DE)) {
      if (MONSTRES[id].boss || MONSTRES[id].pa <= paBoss) continue;
      expect(dom(id), `${id} a plus de PA qu'un boss, il doit frapper plus faible`)
        .toBeLessThan(dominanteMax);
    }
  });
});

describe("les sorts de la toile", () => {
  it("le fil et la toile posent `tetanise` sur leur cible", () => {
    for (const id of ["fil_collant", "toile_gluante"]) {
      const s = SORTS[id];
      expect(s, `${id} manquant`).toBeTruthy();
      expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
      expect(s.effet?.stat, `${id}`).toBe("tetanise");
      expect(s.effet!.duree, `${id} : 1 tour, c'est la soupape anti-frustration`).toBe(1);
    }
  });

  it("la toile de la Reine couvre une rangée et recharge", () => {
    const s = SORTS.toile_gluante;
    expect(s.zoneLigne).toBe(true);
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2); // l'autre soupape : jamais un verrou permanent
  });

  it("les racines atteignent n'importe qui", () => {
    const s = SORTS.racines_ancestrales;
    expect(s.cible).toBe("ennemi_tous");
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBe(2);
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Domaine Ancestral", () => {
  it("est la 11e zone de la Tranche 2, sur la toile 23", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[10]).toBe("domaine_ancestral");
    const loc = localiserZone("domaine_ancestral")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(23); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale aligne les DEUX boss, tous deux porteurs du Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss).sort()).toEqual(["abraknyde_ancestral", "reine_nyee"]);
  });

  it("la salle finale place l'Ancestral DERRIÈRE la Reine — c'est le design", () => {
    // Tant que la toile tient et que la rangée avant vit, le grand arbre est hors
    // d'atteinte pendant qu'il frappe : un boss protège l'autre. Inverser les deux
    // détruirait la leçon sans rien casser d'autre, d'où ce test.
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    const salle = COMBATS[zone.pools.boss[0]].ennemis;
    const arbre = salle.find((e) => e.monstre === "abraknyde_ancestral")!;
    const reine = salle.find((e) => e.monstre === "reine_nyee")!;
    expect(arbre.position, "l'Ancestral doit être en rangée ARRIÈRE").toBeGreaterThanOrEqual(4);
    expect(reine.position, "la Reine doit être devant lui").toBeLessThan(4);
  });

  it("chaque pack normal contient une tisseuse", () => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) =>
        MONSTRES[e.monstre].sorts.some((s) => SORTS[s].effet?.stat === "tetanise"));
      expect(porte, `${id} n'enseigne pas la toile`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 23 lâche la Panoplie Tissée, ses élites et ses boss", () => {
    const pool = butinToile("domaine_ancestral")!;
    expect(pool.normales).toEqual(["coiffe_tissee", "capraignee", "anneau_tisse", "racine_istre"]);
    expect(pool.elites).toEqual(["alliance_des_forestiers", "baton_de_marie_aigue"]);
    expect(pool.boss).toEqual(["coiffe_de_l_abraknyde_ancestral", "cape_de_l_abraknyde_ancestral", "baguette_des_limbes"]);
  });
});

describe("la toile prouvée PAR LE MOTEUR", () => {
  const ctxNeuf = () => {
    let g = 3141592;
    const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    return { rng, log: () => {}, playerDamageBonus: 1 };
  };

  /** Une équipe aux PV du niveau où la zone se joue (≈ 89), stats INCHANGÉES.
   *  Pièges déjà rencontrés (Bateau, Antre, Repaire) : un héros de niveau 1 meurt du coup
   *  qu'on veut observer, or le moteur n'applique un effet que sur une cible VIVANTE ; et
   *  monter son agilité lui donne une esquive qui annule dégât ET effet, de façon
   *  reproductible puisque la graine est fixe. */
  const equipeDeSonde = (): Combatant[] => {
    const equipe = fabriquerEquipe();
    for (const h of equipe) {
      h.pvBase = 900; h.pvMax = 900; h.pvActuels = 900;
    }
    return equipe;
  };

  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  /** Une scène : un héros face à un ennemi DEVANT et un ennemi DERRIÈRE. C'est celui de
   *  derrière qui doit devenir inatteignable une fois le héros englué. */
  const scene = (tisseuse: string) => {
    const devant = trouver(tisseuse);
    devant.position = 0;
    const derriere = trouver("abraknyde_venerable");
    derriere.position = 4;
    const equipe = equipeDeSonde();
    for (const [i, h] of equipe.entries()) h.position = i < 2 ? i : i + 2;
    return { devant, derriere, equipe, cs: [...equipe, devant, derriere] };
  };

  it("un héros englué ne peut plus viser la rangée arrière", () => {
    // LE test de la zone. `tetanise` n'agit pas sur les dégâts mais sur `ciblesValides` :
    // interroger le champ du sort n'aurait rien prouvé.
    const ctx = ctxNeuf();
    const { devant, derriere, equipe, cs } = scene("nefileuse");
    const [victime] = equipe;

    const avant = ciblesValides(victime, SORTS.tir_courbe, cs).map((c) => c.ref);
    expect(avant, "hors toile, la rangée arrière est atteignable").toContain(derriere.ref);

    lancerSort(devant, SORTS.fil_collant, victime.ref, cs, ctx);
    expect(victime.effets.some((e) => e.stat === "tetanise"), "la toile doit être posée").toBe(true);

    const apres = ciblesValides(victime, SORTS.tir_courbe, cs).map((c) => c.ref);
    expect(apres, "englué, il ne doit plus atteindre l'arrière").not.toContain(derriere.ref);
    expect(apres, "mais la rangée avant reste visée").toContain(devant.ref);
  });

  it("la toile EXPIRE et les cibles reviennent", () => {
    const ctx = ctxNeuf();
    const { devant, derriere, equipe, cs } = scene("nefileuse");
    const [victime] = equipe;
    lancerSort(devant, SORTS.fil_collant, victime.ref, cs, ctx);
    expect(ciblesValides(victime, SORTS.tir_courbe, cs).map((c) => c.ref)).not.toContain(derriere.ref);

    // `decrementerEffets` n'est pas exporté : on reproduit sa règle (−1 par tour du
    // porteur, effet retiré à 0), comme les autres tests reproduisent `lancersCeTour`.
    const duree = SORTS.fil_collant.effet!.duree;
    for (let t = 0; t < duree; t++) {
      victime.effets.forEach((e) => { e.toursRestants -= 1; });
      victime.effets = victime.effets.filter((e) => e.toursRestants > 0);
    }
    expect(victime.effets.some((e) => e.stat === "tetanise")).toBe(false);
    expect(ciblesValides(victime, SORTS.tir_courbe, cs).map((c) => c.ref)).toContain(derriere.ref);
  });

  it("`ignoreLigne` est bien le contre", () => {
    // Sans ce test, une refonte pourrait rendre la zone insoluble sans qu'on le voie :
    // l'Acuité absolue du Cra est la sortie de secours documentée de `tetanise`.
    const ctx = ctxNeuf();
    const { devant, derriere, equipe, cs } = scene("nefileuse");
    const [victime] = equipe;
    lancerSort(devant, SORTS.fil_collant, victime.ref, cs, ctx);
    victime.effets.push({ stat: "ignoreLigne", valeur: 1, toursRestants: 2 });
    expect(ciblesValides(victime, SORTS.tir_courbe, cs).map((c) => c.ref)).toContain(derriere.ref);
  });

  it("la toile de la Reine englue TOUTE la rangée ciblée, et elle seule", () => {
    const ctx = ctxNeuf();
    const reine = trouver("reine_nyee");
    reine.position = 0;
    const equipe = equipeDeSonde();
    for (const [i, h] of equipe.entries()) h.position = i < 3 ? i : 4; // 3 devant, 1 derrière
    const cs = [...equipe, reine];
    const devantJoueur = equipe.filter((h) => h.position < 4);
    expect(devantJoueur.length, "il faut plusieurs héros devant").toBeGreaterThan(1);

    lancerSort(reine, SORTS.toile_gluante, devantJoueur[0].ref, cs, ctx);
    for (const h of devantJoueur) {
      expect(h.effets.some((e) => e.stat === "tetanise"), `${h.nom} doit être englué`).toBe(true);
    }
    const arriere = equipe.find((h) => h.position >= 4)!;
    expect(arriere.effets.some((e) => e.stat === "tetanise"), "la rangée arrière est épargnée").toBe(false);
  });

  it("les racines de l'Ancestral atteignent la rangée arrière du joueur", () => {
    // `ennemi_tous` : depuis sa propre rangée arrière, il touche un héros de l'arrière.
    const ctx = ctxNeuf();
    const arbre = trouver("abraknyde_ancestral");
    arbre.position = 4;
    const equipe = equipeDeSonde();
    for (const [i, h] of equipe.entries()) h.position = i < 2 ? i : i + 2;
    const cs = [...equipe, arbre];
    const cible = equipe.find((h) => h.position >= 4)!;

    expect(ciblesValides(arbre, SORTS.racines_ancestrales, cs).map((c) => c.ref))
      .toContain(cible.ref);
    const avant = cible.pvActuels;
    lancerSort(arbre, SORTS.racines_ancestrales, cible.ref, cs, ctx);
    expect(cible.pvActuels, "les racines doivent mordre la rangée arrière").toBeLessThan(avant);
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
      x.pvBase = 900; x.pvMax = 900; x.pvActuels = 900;
    }
    return h;
  };

  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "domaine_ancestral")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  it("aucune des 8 espèces ne laisse de PA sur la table", async () => {
    const eq = equipe();
    for (const espece of [...especesDeLaZone()]) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...eq]), `${espece} laisse des PA`).toBe(0);
    }
  });

  it("les deux boss ne gaspillent rien quand leur signature recharge", async () => {
    const eq = equipe();
    for (const [espece, signature] of [
      ["reine_nyee", "toile_gluante"], ["abraknyde_ancestral", "racines_ancestrales"],
    ] as const) {
      const c = trouver(espece);
      expect(await paOrphelins(c, [c, ...eq], { [signature]: 1 }), `${espece} en recharge`).toBe(0);
    }
  });

  it("chaque porteur de signature la lance réellement", async () => {
    const eq = equipe();
    for (const [espece, attendu] of [
      ["nefileuse", "fil_collant"], ["reine_nyee", "toile_gluante"],
      ["abraknyde_ancestral", "racines_ancestrales"],
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
   *  La `tetanise` est exclue : c'est du contrôle, pas des dégâts — comme l'armure aux
   *  Pitons, le soin au Repaire, le désenvoûtement à l'Antre et l'annulation à la
   *  Tanière. Le Laboratoire avait fait l'erreur inverse (son modèle ignorait le poison,
   *  l'identité même de la zone) et validé une inversion. */
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

  it("chaque boss frappe plus fort que TOUTE espèce non-boss de la zone", () => {
    const nonBoss = [...especesDeLaZone()].filter((m) => !MONSTRES[m].boss);
    expect(nonBoss.length).toBeGreaterThan(0);
    for (const cibles of [1, 2]) {
      for (const boss of ["reine_nyee", "abraknyde_ancestral"]) {
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
