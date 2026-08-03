// =============================================================================
//  kanniboul.test.ts — Bateau du Chouque & Village Kanniboul (zone 7 de la T2)
//  curare (friction : soins ET boucliers bloqués), festin du Chouque, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, localiserZone, butinToile } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { lancerSort } from "./combat";
import type { Combatant } from "./types";

const ELEMENT_DE = {
  kanniboul_ark: "terre", kanniboul_eth: "feu", kanniboul_jav: "air",
  kanniboul_sarbak: "eau", kanniboul_tam: "terre",
  ricanif: "air", ivremor: "eau",
  le_chouque: "feu", kanniboul_ebil: "eau",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  kanniboul_ark: "Kannibal le Lecteur",
  kanniboul_eth: "Kannisterik le Forcené",
  kanniboul_jav: "Kapota la Fraise",
  kanniboul_sarbak: "Kannémik le Maigre",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};

describe("bestiaire du Bateau du Chouque", () => {
  it("les 9 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 9 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("les trois gardes de la Cale de l'Arche ne sont PAS réutilisés", () => {
    // Le donjon 91 les contient, mais ils sont déjà à la toile 14 avec des stats
    // calibrées cinq toiles plus bas : les réutiliser serait une redite sans archi
    // neuf. Ce test fige la décision.
    for (const id of ["boomba", "nakunbra", "canondorf"]) {
      expect(Object.keys(ELEMENT_DE)).not.toContain(id);
    }
  });

  it("qui frappe deux fois frappe plus faible", () => {
    // Sans cet écart, deux morsures d'un ennemi à 8 PA dépassent un boss à 6 PA :
    // ce serait la 4e inversion boss/escorte du projet.
    for (const rapide of ["kanniboul_jav", "ivremor"]) {
      expect(MONSTRES[rapide].pa).toBe(8);
      for (const lent of ["kanniboul_ark", "kanniboul_eth"]) {
        expect(dom(rapide), `${rapide} doit frapper plus faible que ${lent}`).toBeLessThan(dom(lent));
      }
    }
  });
});

describe("les sorts du curare", () => {
  it("la sarbacane pose la friction sur sa CIBLE", () => {
    // `friction` s'applique à la cible : bon sens pour un sort de monstre, à la
    // différence de `nullifieProchain`, écarté aux Pitons pour cette raison.
    const s = SORTS.sarbacane_curare;
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.effet?.stat).toBe("friction");
    expect(s.effet!.duree).toBeGreaterThan(0);
  });

  it("la fumée frappe la rangée entière et l'empoisonne de curare", () => {
    const s = SORTS.fumee_de_curare;
    expect(s.zoneLigne).toBe(true);
    expect(s.effet?.stat).toBe("friction");
    expect(s.cooldownTours).toBe(2);
  });

  it("la ripaille nourrit son lanceur", () => {
    const s = SORTS.ripaille;
    expect(s.type).toBe("degats");
    expect(s.vampirismeRatio!).toBeGreaterThan(0);
    expect(s.cooldownTours).toBe(2);
  });

  it("les deux boss n'ont que des sorts à 6 PA — une action par tour, zéro PA orphelin", () => {
    // Précédent des Blops Royaux : une salle jumelée aligne deux budgets. Au
    // Terrier, 10 PA chacun avaient fait la salle la plus lourde de la tranche.
    for (const id of ["le_chouque", "kanniboul_ebil"]) {
      expect(MONSTRES[id].pa).toBe(6);
      for (const s of MONSTRES[id].sorts) expect(SORTS[s].coutPA, `${id} / ${s}`).toBe(6);
    }
  });
});

/** Union des espèces des trois pools — source unique du bestiaire testé. */
const especesDeLaZone = (): Set<string> => {
  const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
  const combats = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  return new Set(combats.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};

describe("la zone Bateau du Chouque", () => {
  it("est la 7e zone de la Tranche 2, sur la toile 19", () => {
    expect(TRANCHES.find((t) => t.id === "t2")!.zones[6]).toBe("bateau_du_chouque");
    const loc = localiserZone("bateau_du_chouque")!;
    expect(loc.tranche.id).toBe("t2");
    expect(loc.index + 1 + 12).toBe(19); // 12 toiles consommées par la t1
  });

  it("les espèces des pools sont exactement celles déclarées ici", () => {
    expect([...especesDeLaZone()].sort()).toEqual(Object.keys(ELEMENT_DE).sort());
  });

  it("la salle finale aligne les DEUX boss, tous deux porteurs du Turquoise", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    expect(zone.pools.boss).toHaveLength(1);
    const salle = COMBATS[zone.pools.boss[0]].ennemis.map((e) => e.monstre);
    expect(salle.filter((m) => MONSTRES[m].boss).sort()).toEqual(["kanniboul_ebil", "le_chouque"]);
    for (const id of ["le_chouque", "kanniboul_ebil"]) {
      expect(MONSTRES[id].dofus).toBe("dofus_turquoise");
    }
  });

  it("chaque pack normal contient un porteur de curare", () => {
    // La leçon se paie tôt et sur un petit ennemi, avant qu'Ebil n'enfume une rangée.
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    for (const id of zone.pools.normales) {
      const porte = COMBATS[id].ennemis.some((e) =>
        MONSTRES[e.monstre].sorts.some((s) => SORTS[s].effet?.stat === "friction"));
      expect(porte, `${id} n'enseigne pas le curare`).toBe(true);
    }
  });

  it("l'élite n'est le doublon d'aucun pack normal", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    const cle = (id: string) => [...COMBATS[id].ennemis.map((e) => e.monstre)].sort().join("+");
    const elites = zone.pools.elite.map(cle);
    for (const n of zone.pools.normales.map(cle)) expect(elites).not.toContain(n);
  });

  it("aucune rencontre ne double une espèce, ni ne dépasse 5 ennemis", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
      expect(e.length, `${id} dépasse 5 ennemis`).toBeLessThanOrEqual(5);
    }
  });

  it("les 4 espèces capturables apparaissent toutes en pack NORMAL", () => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    const enNormal = new Set(zone.pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of Object.keys(ARCHIS)) {
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("la toile 19 ne lâche rien pour l'instant", () => {
    expect(butinToile("bateau_du_chouque")).toBeNull();
  });
});

describe("le curare part vraiment, côté ENNEMI", () => {
  const ctxNeuf = () => {
    let g = 24680;
    const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    return { rng, log: () => {}, playerDamageBonus: 1 };
  };

  /** Cherche une espèce dans une rencontre où elle figure VRAIMENT — et jette sinon. */
  const trouver = (espece: string): Combatant => {
    const zone = ZONES.find((z) => z.id === "bateau_du_chouque")!;
    for (const id of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
      const c = fabriquerEnnemis(id).find((x) => x.monstreId === espece);
      if (c) return c;
    }
    throw new Error(`${espece} n'apparaît dans aucune rencontre de la zone`);
  };

  /** Une équipe aux PV du niveau OÙ LA ZONE SE JOUE (≈ 73), stats INCHANGÉES.
   *
   *  Deux pièges, tous deux rencontrés en écrivant ces tests :
   *  — `fabriquerEquipe()` sort des héros de niveau 1 à ~60 PV, qu'un coup de
   *    sarbacane (≈ 60 dégâts) tue net ; or le moteur ne pose un effet que sur une
   *    cible VIVANTE (`t.pvActuels > 0`), donc le curare n'était jamais appliqué et
   *    le test mesurait la mort du héros au lieu de la friction. D'où les PV.
   *  — monter leur agilité leur donnait une grosse ESQUIVE, et un coup esquivé ne
   *    pose ni dégât ni effet ; avec une graine fixe, l'esquive tombait toujours au
   *    même endroit et les tests échouaient de façon parfaitement reproductible.
   *    D'où les stats laissées telles quelles : ici les héros encaissent, ils ne
   *    frappent pas. */
  const equipeDeSonde = (): Combatant[] => {
    const equipe = fabriquerEquipe();
    for (const h of equipe) {
      h.pvBase = 600;
      h.pvMax = 600;
      h.pvActuels = 600;
    }
    return equipe;
  };

  /** Un Sarbak, une victime en rangée avant, un soigneur derrière. */
  const scene = () => {
    const sarbak = trouver("kanniboul_sarbak");
    const [victime, soigneur] = equipeDeSonde();
    victime.position = 0;
    soigneur.position = 4;
    sarbak.position = 0;
    return { sarbak, victime, soigneur, cs: [victime, soigneur, sarbak] };
  };

  it("un héros sous curare ne peut plus être soigné", () => {
    const ctx = ctxNeuf();
    const { sarbak, victime, soigneur, cs } = scene();
    victime.pvActuels = Math.round(victime.pvMax / 2);
    lancerSort(sarbak, SORTS.sarbacane_curare, victime.ref, cs, ctx);
    expect(victime.effets.some((e) => e.stat === "friction"), "le curare doit être posé").toBe(true);
    const avant = victime.pvActuels;
    lancerSort(soigneur, SORTS.soin_noir, victime.ref, cs, ctx);
    expect(victime.pvActuels, "le soin doit être refusé").toBe(avant);
  });

  it("un héros sous curare ne peut plus être protégé non plus", () => {
    // C'est la moitié oubliée de `friction` : elle bloque les BOUCLIERS autant que
    // les soins. Une zone qui ne fermerait que les soins laisserait le Féca intact.
    const ctx = ctxNeuf();
    const { sarbak, victime, soigneur, cs } = scene();
    lancerSort(sarbak, SORTS.sarbacane_curare, victime.ref, cs, ctx);
    const avant = victime.bouclier;
    lancerSort(soigneur, SORTS.mot_prevention, victime.ref, cs, ctx);
    expect(victime.bouclier, "le bouclier doit être refusé").toBe(avant);
  });

  it("un héros SANS curare se soigne et se protège normalement (témoin)", () => {
    // Sans ce témoin, les deux tests ci-dessus passeraient même si les sorts de
    // soin étaient cassés pour une raison n'ayant rien à voir avec la friction.
    const ctx = ctxNeuf();
    const { victime, soigneur, cs } = scene();
    const moitie = Math.round(victime.pvMax / 2);
    victime.pvActuels = moitie;
    lancerSort(soigneur, SORTS.soin_noir, victime.ref, cs, ctx);
    expect(victime.pvActuels).toBeGreaterThan(moitie);
    lancerSort(soigneur, SORTS.mot_prevention, victime.ref, cs, ctx);
    expect(victime.bouclier).toBeGreaterThan(0);
  });

  it("le curare EXPIRE : le soin repasse quand l'effet tombe", () => {
    const ctx = ctxNeuf();
    const { sarbak, victime, soigneur, cs } = scene();
    lancerSort(sarbak, SORTS.sarbacane_curare, victime.ref, cs, ctx);
    // `decrementerEffets` n'est pas exporté : on reproduit sa règle (−1 par tour du
    // porteur, effet retiré à 0), comme les autres tests reproduisent `lancersCeTour`.
    const duree = SORTS.sarbacane_curare.effet!.duree;
    for (let t = 0; t < duree; t++) {
      victime.effets.forEach((e) => { e.toursRestants -= 1; });
      victime.effets = victime.effets.filter((e) => e.toursRestants > 0);
    }
    expect(victime.effets.some((e) => e.stat === "friction")).toBe(false);
    const moitie = Math.round(victime.pvMax / 2);
    victime.pvActuels = moitie;
    lancerSort(soigneur, SORTS.soin_noir, victime.ref, cs, ctx);
    expect(victime.pvActuels).toBeGreaterThan(moitie);
  });

  it("la fumée d'Ebil met TOUTE la rangée sous curare, et elle seule", () => {
    const ctx = ctxNeuf();
    const ebil = trouver("kanniboul_ebil");
    const equipe = equipeDeSonde();
    for (const [i, h] of equipe.entries()) h.position = i < 3 ? i : 4; // 3 devant, 1 derrière
    ebil.position = 0;
    const cs = [...equipe, ebil];
    const devant = equipe.filter((h) => h.position < 4);
    expect(devant.length, "il faut plusieurs héros devant pour que le test ait un sens").toBeGreaterThan(1);
    lancerSort(ebil, SORTS.fumee_de_curare, devant[0].ref, cs, ctx);
    for (const h of devant) {
      expect(h.effets.some((e) => e.stat === "friction"), `${h.nom} doit être enfumé`).toBe(true);
    }
    const derriere = equipe.find((h) => h.position >= 4)!;
    expect(derriere.effets.some((e) => e.stat === "friction"), "la rangée arrière est épargnée").toBe(false);
  });

  it("Le Chouque se nourrit de sa ripaille, et PAS de sa charge", () => {
    const ctx = ctxNeuf();
    const chouque = trouver("le_chouque");
    const [victime] = equipeDeSonde();
    victime.position = 0;
    chouque.position = 0;
    const cs = [victime, chouque];

    chouque.pvActuels = Math.round(chouque.pvMax / 2);
    const avantRipaille = chouque.pvActuels;
    lancerSort(chouque, SORTS.ripaille, victime.ref, cs, ctx);
    expect(chouque.pvActuels, "la ripaille doit le nourrir").toBeGreaterThan(avantRipaille);

    victime.pvActuels = victime.pvMax;
    chouque.pvActuels = Math.round(chouque.pvMax / 2);
    const avantCharge = chouque.pvActuels;
    lancerSort(chouque, SORTS.charge, victime.ref, cs, ctx);
    expect(chouque.pvActuels, "la charge ne doit rien lui rendre").toBe(avantCharge);
  });
});
