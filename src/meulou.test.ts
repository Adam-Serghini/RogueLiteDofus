// =============================================================================
//  meulou.test.ts — Tanière du Meulou (zone 10 de la Tranche 2)
//  annulations par tour (les N premiers coups reçus font zéro), bestiaire, PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { SORTS } from "./data";
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
