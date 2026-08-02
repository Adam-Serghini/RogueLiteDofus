// =============================================================================
//  gelees.test.ts — Gelaxième Dimension (zone 3 de la Tranche 2) : bestiaire,
//  absorption des Gelées Royales, budget de PA, salles de boss et zone.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS, ZONES, TRANCHES, COMBATS, zonesDeTranche, localiserZone, butinToile } from "./data";
import { toileDeZone, fabriquerEquipe, fabriquerEnnemis } from "./run";
import { controllerIA } from "./combat";
import type { Combatant } from "./types";

const COULEURS = ["fraise", "bleuet", "menthe", "citron"] as const;
const ELEM_DE_COULEUR = { fraise: "feu", bleuet: "eau", menthe: "air", citron: "terre" } as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  fraise: "Gelaviv le Glaçon",
  bleuet: "Gelanal le Huileux",
  menthe: "Geloliaine l'Aérien",
} as const;

/** Statistique offensive dominante d'un monstre (vitalité exclue). */
const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire de la Gelaxième Dimension", () => {
  it("les 4 Gelées normales frappent ET résistent dans leur couleur", () => {
    for (const c of COULEURS) {
      const m = MONSTRES[`gelee_${c}`];
      expect(m, `gelee_${c} manquante`).toBeTruthy();
      expect(dominante(`gelee_${c}`)).toBe(STAT_DE_ELEMENT[ELEM_DE_COULEUR[c]]);
      expect(m.resistances?.[ELEM_DE_COULEUR[c]]).toBeGreaterThan(0);
    }
  });

  it("3 Gelées sur 8 portent un archimonstre ; la Citron et les Royales n'en ont pas", () => {
    for (const [c, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[`gelee_${c}`].archiNom, `gelee_${c}`).toBe(nom);
    }
    expect(MONSTRES.gelee_citron.archiNom).toBeUndefined();
    for (const c of COULEURS) expect(MONSTRES[`gelee_royale_${c}`].archiNom).toBeUndefined();
  });

  it("les Royales sont des boss qui lâchent le Dofus Pourpre et frappent dans leur couleur", () => {
    for (const c of COULEURS) {
      const r = MONSTRES[`gelee_royale_${c}`];
      expect(r, `gelee_royale_${c} manquante`).toBeTruthy();
      expect(r.boss).toBe(true);
      expect(r.dofus).toBe("dofus_pourpre"); // la paire est tirée au hasard : les 4 doivent le porter
      expect(dominante(`gelee_royale_${c}`)).toBe(STAT_DE_ELEMENT[ELEM_DE_COULEUR[c]]);
      expect(r.pv).toBeGreaterThan(MONSTRES[`gelee_${c}`].pv);
    }
  });
});

describe("l'absorption : la leçon propre à cette zone", () => {
  it("les Royales n'ont AUCUN pic de résistance — le puzzle élémentaire du Clos ne se rejoue pas", () => {
    for (const c of COULEURS) {
      const res = MONSTRES[`gelee_royale_${c}`].resistances ?? {};
      for (const [elem, v] of Object.entries(res)) {
        expect(v, `gelee_royale_${c} : pic de résistance en ${elem}`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it("les QUATRE Royales partagent la même signature d'absorption", () => {
    for (const c of COULEURS) {
      // même signature pour les quatre : au Clos, des signatures différentes ont rendu
      // les six paires inégales alors que le joueur ne choisit pas sa paire.
      expect(MONSTRES[`gelee_royale_${c}`].sorts[0]).toBe("gelification");
    }
  });

  it("Gélification donne un bouclier proportionnel aux dégâts infligés", () => {
    const s = SORTS.gelification;
    expect(s, "sort gelification manquant").toBeTruthy();
    expect(s.bouclierRatioDegats).toBeGreaterThan(0);
    expect(s.coutPA).toBe(6);
    expect(s.cooldownTours).toBeGreaterThanOrEqual(2);
  });
});

describe("zone Gelaxième Dimension", () => {
  const zone = () => ZONES.find((z) => z.id === "gelaxieme_dimension")!;

  it("est la 3ᵉ zone de la Tranche 2 et porte la toile 15", () => {
    const t2 = TRANCHES.find((t) => t.id === "t2")!;
    expect(t2.zones[2]).toBe("gelaxieme_dimension");
    expect(zonesDeTranche(t2)[2].nom).toBe("Gelaxième Dimension");
    expect(localiserZone("gelaxieme_dimension")!.tranche.id).toBe("t2");
    expect(toileDeZone("gelaxieme_dimension")).toBe(15); // T1 = 1-12, Clos = 13, Cale = 14
  });

  it("propose 6 salles de boss, chacune avec DEUX Royales distinctes et deux Gelées d'escorte", () => {
    const paires = new Set<string>();
    expect(zone().pools.boss.length).toBe(6);
    for (const id of zone().pools.boss) {
      const ennemis = COMBATS[id].ennemis.map((e) => e.monstre);
      const royales = ennemis.filter((m) => MONSTRES[m]?.boss);
      expect(royales.length, `${id} : il faut exactement 2 Royales`).toBe(2);
      expect(new Set(royales).size, `${id} : les 2 Royales doivent être distinctes`).toBe(2);
      expect(ennemis.length, `${id} : salle 4v4`).toBe(4);
      expect(new Set(ennemis).size, `${id} : pas deux fois la même espèce`).toBe(4);
      paires.add([...royales].sort().join("+"));
    }
    expect(paires.size, "les 6 paires doivent être différentes").toBe(6);
  });

  it("les trois Gelées à archimonstre sont chassables en combat normal", () => {
    const dansNormales = new Set(zone().pools.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const c of ["fraise", "bleuet", "menthe"]) {
      expect(dansNormales.has(`gelee_${c}`), `gelee_${c} n'apparaît dans aucun pack normal`).toBe(true);
    }
  });

  it("la zone n'a pas encore de butin (les objets de la toile 15 viendront plus tard)", () => {
    expect(butinToile("gelaxieme_dimension")).toBeNull();
  });
});

describe("jouabilité : les Gelées dépensent tout leur budget de PA", () => {
  /**
   * Rejoue un tour complet de l'IA et renvoie les PA laissés sur la table.
   * `cooldowns` permet de tester l'état « signature en recharge » (repli).
   */
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

  const pools = () => ZONES.find((z) => z.id === "gelaxieme_dimension")!.pools;

  /** Trouve un monstre dans la première rencontre du pool qui le contient réellement. */
  const trouverDans = (combatIds: string[], monstreId: string, ou: string): Combatant => {
    for (const combatId of combatIds) {
      const trouve = fabriquerEnnemis(combatId).find((x) => x.monstreId === monstreId);
      if (trouve) return trouve;
    }
    // Échec BRUYANT : une espèce absente de son pool est un bug de contenu, pas
    // une raison de sauter l'assertion.
    throw new Error(`${monstreId} : introuvable dans ${ou} (${combatIds.join(", ")})`);
  };

  /** Trouve une Royale d'une couleur donnée dans la première salle de boss qui la contient réellement. */
  const trouverRoyale = (couleur: string): Combatant =>
    trouverDans(pools().boss, `gelee_royale_${couleur}`, "les salles de boss de la zone");

  /** Idem pour une Gelée normale : les packs normaux ne contiennent pas tous les 4 couleurs. */
  const trouverNormale = (couleur: string): Combatant =>
    trouverDans(pools().normales, `gelee_${couleur}`, "les packs normaux de la zone");

  // Deux fois de suite (Blops Royaux, puis Canondorf), un monstre s'est retrouvé avec
  // des PA inutilisables faute de sort assez bon marché. On le vérifie désormais.
  // Correction ronde 1 : le test précédent cherchait les 4 Royales dans UNE seule
  // salle (gel_boss_fraise_bleuet) ; Menthe et Citron n'y figurent pas, donc leur
  // assertion ne s'exécutait jamais (échec silencieux). On dérive la bonne salle
  // par couleur et on fait échouer bruyamment toute espèce introuvable.
  // Correction ronde 2 : même trou côté Gelées normales, qui étaient cherchées en
  // dur dans `gel_3` — or `gel_3` n'aligne plus les 4 couleurs depuis que l'élite
  // a cessé d'en être le doublon exact. On dérive aussi le pack par couleur.
  it("aucune espèce de la zone ne laisse de PA sur la table", async () => {
    const equipe = heros();
    for (const c of ["fraise", "bleuet", "menthe", "citron"]) {
      const normale = trouverNormale(c);
      expect(await paOrphelins(normale, [normale, ...equipe]), `gelee_${c} laisse des PA`).toBe(0);

      const royale = trouverRoyale(c);
      expect(await paOrphelins(royale, [royale, ...equipe]), `gelee_royale_${c} laisse des PA`).toBe(0);
      // L'état « signature en recharge » est couvert par le test de repli ci-dessous.
    }
  });

  // Porter la signature ne suffit pas : l'IA agressive joue le sort le PLUS CHER
  // ciblable, donc une signature moins coûteuse qu'un `charge` ne sortirait jamais.
  // Correction ronde 1 : étendu aux 4 Royales (pas seulement Fraise) — identiques
  // aujourd'hui, elles ne le resteront pas forcément.
  it("chaque Royale LANCE réellement sa Gélification", async () => {
    const equipe = heros();
    for (const c of ["fraise", "bleuet", "menthe", "citron"]) {
      const royale = trouverRoyale(c);
      const cs = [royale, ...equipe];
      for (let tour = 0; tour < 3; tour++) {
        royale.paActuels = royale.paMax;
        royale.cooldowns = {};
        royale.lancersCeTour = {};
        const action = await controllerIA(royale, cs);
        expect(action, `gelee_royale_${c} : aucune action au tour ${tour + 1}`).toBeTruthy();
        expect(action!.sort.id,
          `gelee_royale_${c} joue ${action!.sort.id} au tour ${tour + 1} au lieu de sa signature`,
        ).toBe("gelification");
      }
    }
  });

  // Correction ronde 2 : la boucle ci-dessus remet `cooldowns = {}` à chaque tour,
  // donc elle rejoue trois fois le MÊME état et ne voit jamais le repli. Ici la
  // signature est explicitement en recharge : c'est `charge` qui doit sortir, et
  // tout le budget de PA doit y passer.
  it("chaque Royale se replie sur charge quand sa Gélification recharge, sans PA orphelin", async () => {
    const equipe = heros();
    for (const c of ["fraise", "bleuet", "menthe", "citron"]) {
      const royale = trouverRoyale(c);
      const cs = [royale, ...equipe];
      royale.paActuels = royale.paMax;
      royale.cooldowns = { gelification: 1 };
      royale.lancersCeTour = {};
      const action = await controllerIA(royale, cs);
      expect(action, `gelee_royale_${c} : aucune action avec la signature en recharge`).toBeTruthy();
      expect(action!.sort.id, `gelee_royale_${c} : repli inattendu`).toBe("charge");
      expect(
        await paOrphelins(royale, cs, { gelification: 1 }),
        `gelee_royale_${c} : PA orphelins avec la signature en recharge`,
      ).toBe(0);
    }
  });
});
