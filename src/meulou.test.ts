// =============================================================================
//  meulou.test.ts — Tanière du Meulou (zone 10 de la Tranche 2)
//  annulations par tour (les N premiers coups reçus font zéro), bestiaire, PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { lancerSort, effetsDebutTour } from "./combat";
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
