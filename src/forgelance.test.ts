// =============================================================================
//  forgelance.test.ts — Kit du Forgelance : la Lance, Muspel, Hydra, Jormun,
//  Vajra, Étreinte de Valkyr. Interactions croisées avec le socle (Flèche de
//  recul, Pendule, bombes).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, poserBombe, degatsCible, LANCE_DURABILITE,
  invoquerLance, runCombat, controllerIA,
  type CombatCtx,
} from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante } from "./run";
import type { Combatant, Action } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Forgelance prêt à combattre (agilité 0 pour le déterminisme). */
function forgelance(): Combatant {
  const c = equipeCombattante(nouvelleRun(["forgelance"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
/** Un ennemi « bouche-trou » placé à une position précise. */
function ennemiA(position: number): Combatant {
  const c = equipeCombattante(nouvelleRun(["cra"]))[0];
  c.camp = "ennemi";
  c.position = position;
  c.ref = `e_${position}_${Math.random().toString(36).slice(2)}`;
  c.resistances = {};
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}
/** Un allié « bouche-trou » placé à une position précise. */
function allieA(position: number): Combatant {
  const c = equipeCombattante(nouvelleRun(["iop"]))[0];
  c.position = position;
  c.ref = `a_${position}_${Math.random().toString(36).slice(2)}`;
  c.resistances = {};
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

const laLance = (cs: Combatant[]) => cs.find((c) => c.estLance);

describe("classe Forgelance", () => {
  it("est recrutable, avec son kit de 6 sorts", () => {
    expect(CLASSES.forgelance).toBeDefined();
    expect(CLASSES.forgelance.sorts).toEqual([
      "muspel", "hydra", "jormun", "lance", "vajra", "etreinte_de_valkyr",
    ]);
    expect(CLASSES.forgelance.sorts.length).toBe(6);
    for (const id of CLASSES.forgelance.sorts) expect(SORTS[id], id).toBeDefined();
  });
});

describe("Lance", () => {
  it("se plante dans la rangée de la cible (avant), limitée à 2/tour", () => {
    const f = forgelance();
    const en0 = ennemiA(0); // avant
    const cs = [f, en0];
    expect(SORTS.lance.maxParTour).toBe(2);
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance).toBeDefined();
    expect(lance.position).toBeLessThan(4);
    expect(lance.lanceurRef).toBe(f.ref);
    expect(lance.pvActuels).toBe(LANCE_DURABILITE);
    expect(lance.img).toBe("/assets/spells/forgelance/lance.png"); // MINOR : icône dédiée sur la carte
  });

  it("se plante dans la rangée de la cible (arrière)", () => {
    const f = forgelance();
    const en1 = ennemiA(4); // arrière
    const cs = [f, en1];
    lancerSort(f, SORTS.lance, en1.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.position).toBeGreaterThanOrEqual(4);
  });

  it("est grisée (aucune cible) tant qu'une lance du lanceur est vivante", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const cs = [f, en0];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    expect(ciblesValides(f, SORTS.lance, cs)).toEqual([]);
  });

  it("CRIT — une lance vivante ne maintient PAS son camp en vie : victoire dès le dernier ennemi réel mort (runCombat)", async () => {
    const f = forgelance();
    f.initiative = 100; // agit en premier
    const faible = ennemiA(0);
    faible.pvActuels = 1; faible.pvMax = 1;
    faible.initiative = 0;
    const cs = [f, faible];

    const lance = invoquerLance(f, faible, cs, { rng: rngMax, log: () => {}, playerDamageBonus: 1 })!;
    expect(lance).not.toBeNull();
    expect(lance.pvActuels).toBeGreaterThan(0);

    let joueurAJoue = false;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref === f.ref && !joueurAJoue) {
        joueurAJoue = true;
        return { sort: SORTS.muspel, cibleRef: faible.ref };
      }
      return null;
    };
    const controllerEnnemi = (): Action | null => null;

    const gagne = await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: controllerEnnemi },
      rng: rngMax,
    });

    expect(faible.pvActuels).toBe(0); // le seul ennemi réel est mort
    expect(lance.pvActuels).toBeGreaterThan(0); // la lance, elle, est toujours vivante
    expect(gagne).toBe(true); // victoire immédiate malgré la lance vivante
  });
});

describe("Muspel", () => {
  it("multiplie chaque jet ×1,30 à 2 ennemis touchés", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    const base = degatsCible(f, SORTS.muspel, en0, { useMax: false, mult: 1, ctx: ctx() }).dmg;

    const avant0 = en0.pvActuels;
    lancerSort(f, SORTS.muspel, en0.ref, cs, ctx());
    const dmgZone = avant0 - en0.pvActuels;

    expect(Math.abs(dmgZone - Math.round(base * 1.3))).toBeLessThanOrEqual(1);
    expect(en1.pvActuels).toBeLessThan(500); // toute la rangée avant est touchée
  });

  it("la lance de la zone prend −1 durabilité et NE compte PAS dans le bonus", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx()); // plante en rangée avant
    const lance = laLance(cs)!;
    expect(lance.pvActuels).toBe(LANCE_DURABILITE);

    const base = degatsCible(f, SORTS.muspel, en0, { useMax: false, mult: 1, ctx: ctx() }).dmg;

    const avant0 = en0.pvActuels;
    lancerSort(f, SORTS.muspel, en0.ref, cs, ctx());
    const dmgZone = avant0 - en0.pvActuels;

    expect(lance.pvActuels).toBe(LANCE_DURABILITE - 1); // touchée, mais pas comptée
    // toujours ×1,30 (2 ennemis RÉELS : en0 + en1), la lance ne s'ajoute pas au calcul
    expect(Math.abs(dmgZone - Math.round(base * 1.3))).toBeLessThanOrEqual(1);
  });
});

describe("Hydra", () => {
  it("octroie 6 de bouclier par ennemi (non-lance) touché", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    expect(f.bouclier).toBe(0);
    lancerSort(f, SORTS.hydra, en0.ref, cs, ctx());
    expect(f.bouclier).toBe(6 * 2);
  });

  it("la lance touchée dans la zone ne compte pas dans le bouclier", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(1);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    lancerSort(f, SORTS.hydra, en0.ref, cs, ctx());
    expect(f.bouclier).toBe(6 * 2); // en0 + en1, pas la lance
  });

  it("MINOR — le bouclier ne compte que les ennemis RÉELLEMENT touchés (pas ceux qui esquivent)", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    en0.stats = { ...en0.stats, agilite: 500 }; // esquive garantie (chance plafonnée à 50 %)
    const en1 = ennemiA(1); // agilité 0 : ne peut pas esquiver
    const cs = [f, en0, en1];
    // rng bas et constant : force l'esquive d'en0 (chance>0) sans faire dévier en1 (chance=0)
    lancerSort(f, SORTS.hydra, en0.ref, cs, ctx({ rng: () => 0.01 }));
    expect(f.bouclier).toBe(6); // seul en1 compte : en0 a esquivé
  });
});

describe("Jormun", () => {
  it("sur un ennemi avant : ne touche que la rangée avant", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(4);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.jormun, en0.ref, cs, ctx());
    expect(en0.pvActuels).toBeLessThan(500);
    expect(en1.pvActuels).toBe(500);
  });

  it("sur la lance en rangée ARRIÈRE : touche TOUS les ennemis", () => {
    const f = forgelance();
    const en0 = ennemiA(0); // avant
    const en1 = ennemiA(4); // arrière — la lance ira ici
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en1.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.position).toBeGreaterThanOrEqual(4);

    lancerSort(f, SORTS.jormun, lance.ref, cs, ctx());
    expect(en0.pvActuels).toBeLessThan(500);
    expect(en1.pvActuels).toBeLessThan(500);
    expect(lance.pvActuels).toBe(LANCE_DURABILITE - 1);
  });

  it("la lance en rangée AVANT est une cible valide, mais ne déclenche pas le tous-azimuts", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    const en1 = ennemiA(4);
    const cs = [f, en0, en1];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx()); // plante en AVANT
    const lance = laLance(cs)!;
    expect(lance.position).toBeLessThan(4);
    expect(ciblesValides(f, SORTS.jormun, cs).some((c) => c.ref === lance.ref)).toBe(true);

    lancerSort(f, SORTS.jormun, lance.ref, cs, ctx());
    expect(en1.pvActuels).toBe(500); // arrière épargnée : lance en AVANT
  });
});

describe("Vajra", () => {
  it("est injouable sans lance vivante du lanceur", () => {
    const f = forgelance();
    const en0 = ennemiA(0);
    expect(ciblesValides(f, SORTS.vajra, [f, en0])).toEqual([]);
  });

  it("rappelle la lance intacte : soigne 2×7 (multSoin=1) + bouclier de bris", () => {
    const f = forgelance();
    f.stats = { ...f.stats, intelligence: 0, soin: 0 }; // multSoin = 1
    f.pvActuels = 100;
    const en0 = ennemiA(0);
    const cs = [f, en0];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.pvActuels).toBe(LANCE_DURABILITE); // intacte

    expect(ciblesValides(f, SORTS.vajra, cs)).toEqual([f]);
    lancerSort(f, SORTS.vajra, f.ref, cs, ctx());
    expect(f.pvActuels).toBe(100 + 7 * LANCE_DURABILITE); // soin selon durabilité restante
    expect(f.bouclier).toBeGreaterThan(0); // bouclier de bris standard, en plus du soin
    expect(cs.filter((c) => c.pvActuels > 0 && c.estLance).length).toBe(0); // la lance a disparu
  });

  it("rappelle la lance endommagée : soin réduit à la durabilité restante", () => {
    const f = forgelance();
    f.stats = { ...f.stats, intelligence: 0, soin: 0 };
    const en0 = ennemiA(0);
    const cs = [f, en0];
    lancerSort(f, SORTS.lance, en0.ref, cs, ctx());
    const lance = laLance(cs)!;
    // simule un coup déjà encaissé : il ne reste qu'1 point de durabilité
    lance.pvActuels = LANCE_DURABILITE - 1;

    f.pvActuels = 100;
    lancerSort(f, SORTS.vajra, f.ref, cs, ctx());
    expect(f.pvActuels).toBe(100 + 7 * (LANCE_DURABILITE - 1));
  });
});

describe("Étreinte de Valkyr", () => {
  it("pose une redirection 1 tour, expire ensuite, cooldown de 2", () => {
    const f = forgelance();
    const cs = [f];
    lancerSort(f, SORTS.etreinte_de_valkyr, f.ref, cs, ctx());
    expect(f.redirection).toEqual({ ratio: 0.5, tours: 1 });
    expect(f.cooldowns["etreinte_de_valkyr"]).toBe(2);
  });

  it("dévie la moitié des dégâts destinés à un allié arrière vers le porteur", () => {
    const f = forgelance();
    f.position = 0; // avant
    const alliéArriere = allieA(4);
    alliéArriere.pvActuels = 200; alliéArriere.pvMax = 200;
    f.pvActuels = 200; f.pvMax = 200;
    const en0 = ennemiA(0);
    const cs = [f, alliéArriere, en0];
    lancerSort(f, SORTS.etreinte_de_valkyr, f.ref, cs, ctx());

    lancerSort(en0, SORTS.morsure, alliéArriere.ref, cs, ctx());
    const dmgAllie = 200 - alliéArriere.pvActuels;
    const dmgF = 200 - f.pvActuels;
    expect(dmgAllie).toBeGreaterThan(0);
    expect(dmgF).toBeGreaterThan(0);
    expect(Math.abs(dmgAllie - dmgF)).toBeLessThanOrEqual(1);
  });

  it("CRIT — protège la rangée arrière au tour ADVERSE suivant, puis expire (runCombat, pas seulement lancerSort direct)", async () => {
    const f = forgelance();
    f.position = 0; // avant
    f.initiative = 100; // agit en premier côté joueur, tous les rounds
    const alliéArriere = allieA(4);
    alliéArriere.pvActuels = 300; alliéArriere.pvMax = 300;
    const en0 = ennemiA(0);
    en0.paMax = SORTS.morsure.coutPA; // exactement 1 attaque possible par tour
    en0.paActuels = en0.paMax;
    const cs = [f, alliéArriere, en0];

    let etreintePosee = false;
    const controllerJoueur = (acteur: Combatant): Action | null => {
      if (acteur.ref === f.ref && !etreintePosee) {
        etreintePosee = true;
        return { sort: SORTS.etreinte_de_valkyr, cibleRef: f.ref };
      }
      return null;
    };
    let attaques = 0;
    const snapshots: Array<[number, number]> = [];
    const controllerEnnemi = (acteur: Combatant): Action | null => {
      if (acteur.paActuels < SORTS.morsure.coutPA || attaques >= 2) return null;
      attaques++;
      snapshots.push([f.pvActuels, alliéArriere.pvActuels]); // PV juste AVANT cette attaque
      return { sort: SORTS.morsure, cibleRef: alliéArriere.ref };
    };

    await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: controllerEnnemi },
      rng: ctx().rng,
    });

    expect(attaques).toBe(2);
    // attaque 1 (round où l'Étreinte vient d'être posée) : redirigée, le porteur encaisse sa part
    const [fAvant1, aAvant1] = snapshots[0];
    const [fAvant2, aAvant2] = snapshots[1]; // = PV juste après l'attaque 1 (rien d'autre n'a bougé entre-temps)
    const dmgF1 = fAvant1 - fAvant2;
    const dmgA1 = aAvant1 - aAvant2;
    expect(dmgF1).toBeGreaterThan(0); // le porteur a bien encaissé sa part au tour adverse SUIVANT la pose
    expect(dmgA1).toBeGreaterThan(0);
    // attaque 2 (round suivant : redirection expirée au tour de f) : plus aucune déviation
    const dmgF2 = fAvant2 - f.pvActuels;
    const dmgA2 = aAvant2 - alliéArriere.pvActuels;
    expect(dmgF2).toBe(0);
    expect(dmgA2).toBeGreaterThan(0);
  });
});

describe("interactions croisées", () => {
  it("Flèche de recul : la poussée qui percute la lance lui retire 1 durabilité", () => {
    const cra = equipeCombattante(nouvelleRun(["cra"]))[0];
    cra.stats = { ...cra.stats, agilite: 0 };
    const f = forgelance();
    const cible = ennemiA(0); // avant, sera repoussée
    const cs = [cra, f, cible];
    // plante la lance en rangée arrière : elle occupera la case d'arrivée de la poussée
    lancerSort(f, SORTS.lance, cible.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(lance.position).toBeLessThan(4); // la lance suit la rangée de sa cible (avant)

    // on replante manuellement une situation où la lance occupe la rangée ARRIÈRE de la cible
    lance.position = 4;
    const avantDurabilite = lance.pvActuels;
    lancerSort(cra, SORTS.fleche_de_recul, cible.ref, cs, ctx());
    expect(lance.pvActuels).toBe(avantDurabilite - 1);
  });

  it("Pendule : si la seule case libre de la rangée opposée est occupée par la lance, le déplacement échoue", () => {
    const xelor = equipeCombattante(nouvelleRun(["xelor"]))[0];
    xelor.stats = { ...xelor.stats, agilite: 0 };
    const f = forgelance();
    const cible = ennemiA(0); // avant
    const bloque1 = ennemiA(5);
    const bloque2 = ennemiA(6);
    const cs = [xelor, f, cible, bloque1, bloque2];
    lancerSort(f, SORTS.lance, bloque1.ref, cs, ctx()); // plante en arrière (rangée de bloque1)
    const lance = laLance(cs)!;
    expect(lance.position).toBeGreaterThanOrEqual(4);
    // la rangée arrière (4-7) est désormais : bloque1, bloque2, lance → 3/4 cases prises,
    // il reste une case libre ; on la comble aussi pour forcer l'échec du déplacement.
    const positionsPrises = new Set([bloque1.position, bloque2.position, lance.position]);
    const derniereCaseLibre = [4, 5, 6, 7].find((p) => !positionsPrises.has(p))!;
    const bloqueur = ennemiA(derniereCaseLibre);
    const csComplet = [...cs, bloqueur];

    const posAvant = cible.position;
    lancerSort(xelor, SORTS.pendule, cible.ref, csComplet, ctx());
    expect(cible.position).toBe(posAvant); // rangée arrière pleine (dont la lance) : échec silencieux
  });

  it("les bombes (Roublard) refusent de coller à la lance", () => {
    const f = forgelance();
    const cible = ennemiA(0);
    const cs = [f, cible];
    lancerSort(f, SORTS.lance, cible.ref, cs, ctx());
    const lance = laLance(cs)!;
    expect(poserBombe(lance)).toBe(false);
    expect(lance.bombes ?? 0).toBe(0);
  });

  it("IMPORTANT — un soigneur ennemi ne peut jamais cibler la Lance, même la plus « blessée »", () => {
    const f = forgelance();
    const cible = ennemiA(0);
    const cs = [f, cible];
    lancerSort(f, SORTS.lance, cible.ref, cs, ctx());
    const lance = laLance(cs)!;
    lance.pvActuels = 1; // la plus "blessée" du camp ennemi si elle comptait comme alliée
    const soigneur = ennemiA(1);
    soigneur.ia = "soutien";
    soigneur.sorts = ["soin_noir"];
    cible.pvActuels = 200; cible.pvMax = 500; // seul allié RÉEL blessé du soigneur
    cs.push(soigneur);

    expect(ciblesValides(soigneur, SORTS.soin_noir, cs).some((c) => c.estLance)).toBe(false);
    const action = controllerIA(soigneur, cs) as Action | null; // controllerIA est synchrone en pratique
    expect(action).not.toBeNull();
    expect(action!.cibleRef).not.toBe(lance.ref); // jamais la lance
    expect(action!.cibleRef).toBe(cible.ref); // le vrai blessé
  });

  it("IMPORTANT — Étreinte : le bouclier de la victime absorbe D'ABORD, la nullification du porteur n'est jamais consommée par la part redirigée", () => {
    const f = forgelance();
    f.position = 0; // avant
    f.pvActuels = 200; f.pvMax = 200;
    f.nullifieProchainCoup = true; // le porteur a une nullification prête (Roublardise)
    const alliéArriere = allieA(4);
    alliéArriere.pvActuels = 200; alliéArriere.pvMax = 200;
    alliéArriere.bouclier = 10; // bouclier de la VICTIME (partiel) : doit absorber avant tout partage
    const en0 = ennemiA(0);
    const cs = [f, alliéArriere, en0];
    lancerSort(f, SORTS.etreinte_de_valkyr, f.ref, cs, ctx());

    lancerSort(en0, SORTS.morsure, alliéArriere.ref, cs, ctx());
    const dmgAllie = 200 - alliéArriere.pvActuels;
    const dmgF = 200 - f.pvActuels;
    expect(alliéArriere.bouclier).toBe(0); // le bouclier de la victime a bien été consommé
    expect(dmgAllie).toBeGreaterThan(0);
    expect(dmgF).toBeGreaterThan(0);
    // la moitié/moitié porte sur le RESTE post-bouclier, pas sur le montant plein
    expect(Math.abs(dmgAllie - dmgF)).toBeLessThanOrEqual(1);
    // la nullification du porteur n'a PAS été consommée par la part redirigée
    expect(f.nullifieProchainCoup).toBe(true);
  });
});
