// =============================================================================
//  feca.test.ts — Le kit RÉEL du Féca, de bout en bout, via `lancerSort` dans
//  un vrai combat. Les primitives (effetRangeeAlliee, retraitPAProchainTour,
//  l'Égide) sont déjà couvertes par `feca-moteur.test.ts` sur des sorts
//  synthétiques : ici on vérifie que le CONTENU réel (src/content/sorts.json)
//  les emploie correctement, un test par sort.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, ciblesValides, type CombatCtx } from "./combat";
import { SORTS } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

const equipe = (ids: string[] = ["feca", "iop"]) => {
  const team = equipeCombattante(nouvelleRun(ids));
  team.forEach((c) => { c.stats = { ...c.stats, agilite: 0 }; }); // pas d'esquive/crit parasite
  return team;
};

// `fabriquerEnnemis("combat_1")` fabrique toujours le même ref (`e0_<monstre>`) :
// deux mannequins dans le même test doivent recevoir un ref DISTINCT, sans quoi
// `lancerSort` résout la cible sur le premier trouvé dans la liste et non sur
// celui réellement visé.
let mannequinSeq = 0;
const mannequin = () => {
  const e = fabriquerEnnemis("combat_1")[0];
  e.ref = `${e.ref}_${mannequinSeq++}`;
  e.stats = { ...e.stats, agilite: 0 };
  e.resistances = {};
  e.pvMax = 500;
  e.pvActuels = 500;
  return e;
};

describe("Vigie", () => {
  it("inflige des dégâts et renforce la rangée arrière alliée (ignoreLigne + degatsInfliges)", () => {
    const [f, iop] = equipe();
    f.position = 0; // avant
    iop.position = 4; // arrière : bénéficiaire de Vigie
    const e = mannequin();

    lancerSort(f, SORTS.vigie, e.ref, [f, iop, e], ctx());

    expect(e.pvActuels).toBeLessThan(500);
    expect(iop.effets.some((x) => x.stat === "ignoreLigne")).toBe(true);
    expect(iop.effets.some((x) => x.stat === "degatsInfliges" && x.valeur === 0.05)).toBe(true);
    // le Féca lui-même (rangée avant) n'est pas concerné, c'est une rangée arrière
    expect(f.effets.some((x) => x.stat === "degatsInfliges")).toBe(false);
  });
});

describe("Pâturage", () => {
  it("inflige des dégâts et renforce la rangée avant alliée, valeur de base à un seul héros devant", () => {
    const [f, iop] = equipe();
    f.position = 0; // avant, seul
    iop.position = 4; // arrière : pas concerné
    const e = mannequin();

    lancerSort(f, SORTS.paturage, e.ref, [f, iop, e], ctx());

    expect(e.pvActuels).toBeLessThan(500);
    const effet = f.effets.find((x) => x.stat === "degatsInfliges");
    expect(effet?.valeur).toBe(0.10);
    expect(iop.effets.some((x) => x.stat === "degatsInfliges")).toBe(false);
  });

  it("majore le bonus à +15 % quand DEUX héros occupent la rangée avant", () => {
    const [f, iop] = equipe();
    f.position = 0; // avant
    iop.position = 1; // avant aussi : seuil des deux héros devant atteint
    const e = mannequin();

    lancerSort(f, SORTS.paturage, e.ref, [f, iop, e], ctx());

    expect(f.effets.find((x) => x.stat === "degatsInfliges")?.valeur).toBe(0.15);
    expect(iop.effets.find((x) => x.stat === "degatsInfliges")?.valeur).toBe(0.15);
  });
});

describe("Bulle", () => {
  it("atteint la rangée arrière derrière un ennemi vivant (ennemi_tous) et le tétanise", () => {
    // `lancerSort` n'applique lui-même AUCUN filtre de ligne (c'est `ciblesValides`
    // qui gate le ciblage, en amont, côté IA/UI) : appeler `lancerSort` directement
    // avec n'importe quelle cible ne prouverait donc rien sur `ennemi_tous` vs
    // `ennemi_ligne` — la seule assertion discriminante est sur `ciblesValides`.
    const [f] = equipe();
    const devant = mannequin(); // rangée avant ennemie VIVANTE : sans elle, la règle de
    devant.position = 0;        // ligne exposerait déjà la rangée arrière d'elle-même,
    const e = mannequin();      // et le test ne distinguerait pas ennemi_tous d'ennemi_ligne.
    e.position = 4; // rangée arrière ennemie : atteignable seulement via ennemi_tous
    const cs = [f, devant, e];

    expect(ciblesValides(f, SORTS.bulle, cs)).toContain(e);

    lancerSort(f, SORTS.bulle, e.ref, cs, ctx());

    expect(e.pvActuels).toBeLessThan(500);
    expect(e.effets.some((x) => x.stat === "tetanise")).toBe(true);
  });

  it("n'a plus de branche alliée : ne peut plus être lancée sur un allié", () => {
    const [f, iop] = equipe();
    const e = mannequin();

    const cibles = ciblesValides(f, SORTS.bulle, [f, iop, e]);

    expect(cibles).toContain(e);
    expect(cibles).not.toContain(iop);
  });
});

describe("Tétanie", () => {
  it("inflige des dégâts faibles et ampute la cible de 2 PA à son prochain tour", () => {
    const [f] = equipe();
    const e = mannequin();
    e.paActuels = 6;

    lancerSort(f, SORTS.tetanie, e.ref, [f, e], ctx());

    expect(e.pvActuels).toBeLessThan(500);
    expect(e.paBonusNextTurn).toBe(-2);
  });
});

describe("Égide", () => {
  it("invoque une garde sur la rangée de l'allié ciblé, PV = PV max du Féca, et se grise ensuite", () => {
    const [f, iop] = equipe();
    f.pvMax = 400; f.pvActuels = 400;
    iop.position = 0; // avant
    const cs = [f, iop];

    lancerSort(f, SORTS.egide, iop.ref, cs, ctx());

    const egide = cs.find((c) => c.estEgide);
    expect(egide).toBeTruthy();
    expect(egide!.pvMax).toBe(400);
    expect(egide!.pvActuels).toBe(400);
    // une Égide du lanceur est déjà vivante : le sort se grise (garde-fou du contenu réel)
    expect(ciblesValides(f, SORTS.egide, cs).length).toBe(0);
  });

  it("intercepte réellement les dégâts destinés à la rangée de l'allié ciblé", () => {
    const [f, iop] = equipe();
    f.position = 0; iop.position = 1; // même rangée avant
    const e = mannequin();
    const cs = [f, iop, e];

    lancerSort(f, SORTS.egide, iop.ref, cs, ctx());
    const egide = cs.find((c) => c.estEgide);
    expect(egide).toBeTruthy();
    expect(egide!.pvMax).toBe(f.pvMax);

    lancerSort(e, SORTS.morsure, iop.ref, cs, ctx());

    expect(iop.pvActuels).toBe(iop.pvMax); // protégée
    expect(egide!.pvActuels).toBeLessThan(egide!.pvMax); // l'Égide a encaissé
  });
});

describe("Fortification", () => {
  it("se lance sur soi et renforce la rangée avant alliée en résistance, valeur de base à un seul héros devant", () => {
    const [f, iop] = equipe();
    f.position = 0; // avant, seul
    iop.position = 4; // arrière : pas concerné

    lancerSort(f, SORTS.fortification, f.ref, [f, iop], ctx());

    expect(f.effets.find((x) => x.stat === "resAll")?.valeur).toBe(0.10);
    expect(iop.effets.some((x) => x.stat === "resAll")).toBe(false);
  });

  it("majore le bonus à +15 % quand DEUX héros occupent la rangée avant", () => {
    const [f, iop] = equipe();
    f.position = 0;
    iop.position = 1; // avant aussi

    lancerSort(f, SORTS.fortification, f.ref, [f, iop], ctx());

    expect(f.effets.find((x) => x.stat === "resAll")?.valeur).toBe(0.15);
    expect(iop.effets.find((x) => x.stat === "resAll")?.valeur).toBe(0.15);
  });
});
