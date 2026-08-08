// =============================================================================
//  ecaflip.test.ts — Task 3 du rework Ecaflip : le kit RÉEL (6 sorts, paire
//  air+eau). Les primitives moteur qu'il emploie (reduitCoutSiCrit/coutEffectif,
//  elementPire, secondCoupSiCrit, degatsCritSubis/effetLigneCible,
//  soinAvantBlesseRatio, bouclierPctSiCrit/bouclierTours,
//  facesAleatoires/tiragesSiCrit) sont déjà couvertes contre des sorts
//  synthétiques dans ecaflip-moteur.test.ts : ici on vérifie le CONTENU réel —
//  les valeurs exactes du tableau du plan, la disparition des 6 anciens sorts,
//  la nouvelle paire, et chaque sort produisant son effet de bout en bout via
//  lancerSort dans un vrai combat.
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, estAvant, effetsDebutTour, coutEffectif, runCombat, type CombatCtx } from "./combat";
import { SORTS, CLASSES } from "./data";
import { nouvelleRun, equipeCombattante, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet haut, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

/** Un Ecaflip prêt à combattre, agilité nulle par défaut (esquive/crit déterministes
 *  côté défense — les tests qui ont besoin de contrôler l'attaque redéfinissent
 *  agilite/chance explicitement). */
function ecaflip(): Combatant {
  const c = equipeCombattante(nouvelleRun(["ecaflip"]))[0];
  c.stats = { ...c.stats, agilite: 0 };
  c.pvMax = 500; c.pvActuels = 500;
  return c;
}

/** Un mannequin ennemi sans résistances, PV confortables. */
function mannequin(id = "combat_1"): Combatant {
  const e = fabriquerEnnemis(id)[0];
  e.stats = { ...e.stats, agilite: 0 };
  e.resistances = {};
  e.pvMax = 500; e.pvActuels = 500;
  return e;
}

const KIT = ["pile_ou_face", "bluff", "langue_rapeuse", "griffe_joueuse", "roulette", "chateau_de_cartes"];
const RETIRES = ["des_double", "tarot", "all_in", "odorat", "perception", "esprit_felin"];

describe("la classe", () => {
  it("frappe désormais en air et en eau (plus terre+eau)", () => {
    expect(CLASSES.ecaflip.elements).toEqual(["air", "eau"]);
  });

  it("son kit est EXACTEMENT les 6 nouveaux sorts, dans cet ordre", () => {
    expect(CLASSES.ecaflip.sorts).toEqual(KIT);
  });

  it("les 6 anciens sorts ont disparu du contenu", () => {
    for (const id of RETIRES) expect(SORTS[id as keyof typeof SORTS], id).toBeUndefined();
  });
});

describe("Pile ou Face", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.pile_ou_face;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(6);
    expect(s.baseMax).toBe(10);
    expect(s.scaling).toBeCloseTo(0.27);
    expect(s.maxParTour).toBe(4);
    expect(s.reduitCoutSiCrit).toBe(1);
    expect(s.type).toBe("degats");
  });

  it("bout en bout : inflige des dégâts, et réduit le coût du PROCHAIN lancer de 1 PA SEULEMENT sur critique", () => {
    const eca = ecaflip();
    const cible = mannequin();
    lancerSort(eca, SORTS.pile_ou_face, cible.ref, [eca, cible], ctx({ rng: () => 0 })); // crit forcé
    expect(cible.pvActuels).toBeLessThan(500);
    // aucun remboursement immédiat de PA : la remise ne se voit que sur le PROCHAIN lancer
    expect(coutEffectif(SORTS.pile_ou_face, eca)).toBe(2); // 3 - 1

    const eca2 = ecaflip();
    const cible2 = mannequin();
    lancerSort(eca2, SORTS.pile_ou_face, cible2.ref, [eca2, cible2], ctx({ rng: () => 0.5 })); // pas de crit
    expect(cible2.pvActuels).toBeLessThan(500);
    expect(coutEffectif(SORTS.pile_ou_face, eca2)).toBe(3); // inchangé sans critique
  });

  it("la séquence complète d'un tour avec critiques forcés : 3 → 2 → 1 → 1 (plancher 1 PA)", () => {
    const eca = ecaflip();
    const coups = [0, 1, 2, 3].map(() => mannequin());
    const attendus = [3, 2, 1, 1];
    for (let i = 0; i < 4; i++) {
      expect(coutEffectif(SORTS.pile_ou_face, eca)).toBe(attendus[i]);
      lancerSort(eca, SORTS.pile_ou_face, coups[i].ref, [eca, coups[i]], ctx({ rng: () => 0 })); // crit forcé
    }
    expect(coutEffectif(SORTS.pile_ou_face, eca)).toBe(1); // 3 - 4 remises d'affilée, plancher tenu
  });

  it("la remise ne profite PAS à un autre sort de la même Ecaflip", () => {
    const eca = ecaflip();
    const cible = mannequin();
    lancerSort(eca, SORTS.pile_ou_face, cible.ref, [eca, cible], ctx({ rng: () => 0 })); // crit forcé sur Pile ou Face
    expect(coutEffectif(SORTS.pile_ou_face, eca)).toBe(2);
    // Bluff n'a jamais porté `reduitCoutSiCrit` : son coût effectif reste son coût nominal
    expect(coutEffectif(SORTS.bluff, eca)).toBe(SORTS.bluff.coutPA);
  });

  it("la BOUCLE DE COMBAT (runCombat) débite le coût EFFECTIF, pas le coût nominal — les QUATRE débits 3 → 2 → 1 → 1", async () => {
    // 4 mannequins à 1 PV : chaque lancer de Pile ou Face (crit forcé, dégâts très
    // supérieurs à 1) en tue un, ce qui fait progresser le combat sans dépendre d'un
    // second tour — la remise se lit donc uniquement sur ce que la boucle a RÉELLEMENT
    // débité de `paActuels`, pas sur un appel direct à `lancerSort` (qui ne débite rien).
    const eca = ecaflip();
    eca.paMax = 10; eca.paActuels = 10; // large assez pour les 4 casts (3+2+1+1 = 7)
    // `mannequin()` réutilise le même combat de fabrique à chaque appel, donc la même
    // ref (`e0_<monstre>`) : sans les forcer à être DISTINCTES, `parRef` retrouverait
    // toujours le premier mannequin quelle que soit la cible visée par l'action.
    const cibles = [0, 1, 2, 3].map((n) => {
      const c = mannequin();
      c.ref = `mannequin_${n}`;
      c.pvMax = 1; c.pvActuels = 1;
      return c;
    });
    const cs = [eca, ...cibles];

    let i = 0;
    const controllerJoueur = () => (i < cibles.length ? { sort: SORTS.pile_ou_face, cibleRef: cibles[i++].ref } : null);

    // Trace la PA de l'Ecaflip à chaque mise à jour moteur, DÉDUPLIQUÉE (ne garde
    // que les valeurs qui changent) : le 4ᵉ cast tue le 4ᵉ mannequin et clôt le
    // combat DANS le même appel — aucun 5ᵉ appel au contrôleur n'a jamais lieu pour
    // le capturer avant coup, d'où l'observation APRÈS coup via `onUpdate`, seule
    // façon de voir les 4 débits (le 4ᵉ, celui qui porte le plancher, ne serait
    // sinon jamais mesuré).
    const trace: number[] = [];
    let dernier: number | null = null;
    const onUpdate = () => {
      if (eca.paActuels !== dernier) {
        dernier = eca.paActuels;
        trace.push(eca.paActuels);
      }
    };

    const gagne = await runCombat(cs, {
      controllers: { joueur: controllerJoueur, ennemi: () => null },
      rng: () => 0, // pas d'esquive, critique forcé à chaque coup
      onUpdate,
    });

    expect(gagne).toBe(true);
    expect(cibles.every((c) => c.pvActuels <= 0)).toBe(true);
    // 10 → 7 (coût 3) → 5 (coût 2) → 4 (coût 1) → 3 (coût 1, la 2ᵉ fois au plancher) :
    // les 4 débits de la séquence 3 → 2 → 1 → 1, plancher inclus.
    expect(trace).toEqual([10, 7, 5, 4, 3]);
  });
});

describe("Bluff", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.bluff;
    expect(s.coutPA).toBe(4);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(7);
    expect(s.baseMax).toBe(11);
    expect(s.scaling).toBeCloseTo(0.28);
    expect(s.maxParTour).toBe(1); // retour d'équilibrage : un seul lancer par tour (était 2)
    expect(s.elementPire).toBe(true);
    expect(s.secondCoupSiCrit).toBe(true);
    expect(s.type).toBe("degats");
  });

  it("bout en bout, sans critique : un seul coup, dans le PIRE élément (eau, chance faible)", () => {
    const eca = ecaflip();
    eca.stats = { ...eca.stats, agilite: 100, chance: 10 }; // air fort, eau faible → pire = eau
    const cible = mannequin();
    const elements: string[] = [];
    const logCtx = ctx({
      rng: () => 0.5, // jamais d'esquive (seuil 0), jamais de critique (seuil 0.05)
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
    });
    lancerSort(eca, SORTS.bluff, cible.ref, [eca, cible], logCtx);
    expect(elements).toEqual(["eau"]);
  });

  it("bout en bout, sur critique : DEUX coups, le second dans le MEILLEUR élément (air)", () => {
    const eca = ecaflip();
    eca.stats = { ...eca.stats, agilite: 100, chance: 10 };
    const cible = mannequin();
    const elements: string[] = [];
    const crits: string[] = [];
    const logCtx = ctx({
      rng: () => 0, // crit forcé, pas d'esquive
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
      fx: (ev) => { if (ev.type === "crit") crits.push(ev.ref); },
    });
    lancerSort(eca, SORTS.bluff, cible.ref, [eca, cible], logCtx);
    expect(elements).toEqual(["eau", "air"]); // pire, puis meilleur (le retour)
    expect(crits).toEqual([cible.ref]); // le retour ne recritique pas
  });

  it("bout en bout, à résistances ET stats ÉGALES : les deux coups partent dans DEUX éléments distincts de la classe (pas le même)", () => {
    // Contrairement à ce que dit la description d'origine du sort, une égalité de score
    // ne fait pas se confondre pire et meilleur : le classement les départage par
    // l'ordre déclaré (stable), et Bluff frappe donc bien deux éléments différents,
    // simplement sans conséquence sur les dégâts puisque les deux scores sont égaux.
    const eca = ecaflip();
    eca.stats = { ...eca.stats, agilite: 50, chance: 50 }; // air == eau, résistances nulles des deux côtés
    const cible = mannequin();
    const elements: string[] = [];
    const logCtx = ctx({
      rng: () => 0, // crit forcé (déclenche le second coup), pas d'esquive
      log: (_msg, meta) => { if (meta) elements.push(meta.element); },
    });
    lancerSort(eca, SORTS.bluff, cible.ref, [eca, cible], logCtx);
    expect(elements).toEqual(["eau", "air"]); // deux éléments distincts de la paire, jamais le même
    expect(new Set(elements).size).toBe(2);
  });
});

describe("Langue râpeuse", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.langue_rapeuse;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(5);
    expect(s.baseMax).toBe(9);
    expect(s.scaling).toBeCloseTo(0.24);
    expect(s.maxParTour).toBe(2);
    expect(s.soinAvantBlesseRatio).toBeCloseTo(0.65);
    expect(s.type).toBe("degats");
  });

  it("bout en bout : inflige des dégâts et soigne le plus blessé de la RANGÉE AVANT alliée", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, front, back] = team;
    eca.position = 0;
    front.position = 1; front.pvMax = 100; front.pvActuels = 80; // avant, peu blessé
    back.position = 4; back.pvMax = 100; back.pvActuels = 50; // arrière, PLUS blessé
    expect(estAvant(front)).toBe(true);
    expect(estAvant(back)).toBe(false);

    const ennemi = mannequin();
    lancerSort(eca, SORTS.langue_rapeuse, ennemi.ref, [eca, front, back, ennemi], ctx());

    expect(ennemi.pvActuels).toBeLessThan(500);
    expect(front.pvActuels).toBeGreaterThan(80); // soigné : plus blessé EN RANGÉE AVANT
    expect(back.pvActuels).toBe(50); // inchangé : plus blessé dans l'absolu, mais hors rangée avant
  });
});

describe("Griffe joueuse", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.griffe_joueuse;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("ennemi_ligne");
    expect(s.baseMin).toBe(8);
    expect(s.baseMax).toBe(11);
    expect(s.scaling).toBeCloseTo(0.29);
    expect(s.effetLigneCible).toEqual({ stat: "degatsCritSubis", valeur: 0.05, duree: 2 });
    expect(s.type).toBe("degats");
    // le vol de vie de l'ancien kit a bien disparu
    expect(s.vampirismeRatio).toBeUndefined();
  });

  it("bout en bout : inflige des dégâts et majore de 5 % les critiques subis par TOUTE la rangée de la cible", () => {
    const eca = ecaflip();
    const ennemis = fabriquerEnnemis("combat_elite"); // 4 ennemis
    ennemis.forEach((e, i) => {
      e.stats = { ...e.stats, agilite: 0 };
      e.position = i < 3 ? i : 4; // 3 en rangée avant, 1 en arrière (témoin)
      e.pvMax = 500; e.pvActuels = 500; e.resistances = {};
    });
    const [e0, e1, e2, arriere] = ennemis;
    const cs = [eca, ...ennemis];

    lancerSort(eca, SORTS.griffe_joueuse, e0.ref, cs, ctx());

    expect(e0.pvActuels).toBeLessThan(500);
    for (const e of [e0, e1, e2]) {
      const marques = e.effets.filter((x) => x.stat === "degatsCritSubis");
      expect(marques.length, e.ref).toBe(1);
      expect(marques[0].valeur).toBeCloseTo(0.05);
      expect(marques[0].toursRestants).toBe(2);
    }
    expect(estAvant(arriere)).toBe(false);
    expect(arriere.effets.some((x) => x.stat === "degatsCritSubis")).toBe(false);
  });

  it("journalise l'application du débuff de rangée (invisible sinon, comme l'armure des Craqueleurs)", () => {
    const eca = ecaflip();
    const ennemis = fabriquerEnnemis("combat_elite");
    ennemis.forEach((e, i) => {
      e.stats = { ...e.stats, agilite: 0 };
      e.position = i < 3 ? i : 4;
      e.pvMax = 500; e.pvActuels = 500; e.resistances = {};
    });
    const [e0] = ennemis;
    const cs = [eca, ...ennemis];
    const logs: string[] = [];

    lancerSort(eca, SORTS.griffe_joueuse, e0.ref, cs, ctx({ log: (msg) => logs.push(msg) }));

    expect(logs.some((m) => m.includes("degatsCritSubis"))).toBe(true);
  });
});

describe("Roulette", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.roulette;
    expect(s.coutPA).toBe(3);
    expect(s.cible).toBe("soi");
    expect(s.cooldownTours).toBe(3);
    expect(s.tiragesSiCrit).toBe(2);
    expect(s.type).toBe("buff");
    expect(s.facesAleatoires).toEqual([
      { portee: "soi", effet: { stat: "degatsInfliges", valeur: 0.10, duree: 3 } },
      { portee: "rangee_lanceur", effet: { stat: "crit", valeur: 10, duree: 3 } },
      { portee: "rangee_avant", bouclierPct: 0.15, duree: 3 },
    ]);
  });

  it("face « soi » : +10 % de dégâts finaux sur le lanceur pendant 3 tours", () => {
    const eca = ecaflip();
    // rng : pas de critique (0.99), puis tirage de la face d'index 0 (soi/degatsInfliges)
    const queue = [0.99, 0];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++] }));
    const marque = eca.effets.find((e) => e.stat === "degatsInfliges");
    expect(marque?.valeur).toBeCloseTo(0.10);
    expect(marque?.toursRestants).toBe(3);
  });

  it("face « rangée du lanceur » : +10 crit à toute sa rangée, PAS aux autres rangées", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, memeRangee, autreRangee] = team;
    eca.position = 0; memeRangee.position = 1; autreRangee.position = 4;
    // rng : pas de critique, puis tirage de la face d'index 1 (rangee_lanceur/crit)
    const queue = [0.99, 0.5];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, team, ctx({ rng: () => queue[i++] }));
    expect(eca.effets.some((e) => e.stat === "crit" && e.valeur === 10)).toBe(true);
    expect(memeRangee.effets.some((e) => e.stat === "crit")).toBe(true);
    expect(autreRangee.effets.some((e) => e.stat === "crit")).toBe(false);
  });

  it("face « rangée avant » : bouclier de 15 % des PV max à la rangée avant alliée", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop", "cra"]));
    const [eca, avant, arriere] = team;
    eca.position = 0; avant.position = 1; arriere.position = 4;
    avant.pvMax = 200; avant.pvActuels = 200;
    arriere.pvMax = 200; arriere.pvActuels = 200;
    // rng : pas de critique, puis tirage de la face d'index 2 (rangee_avant/bouclier)
    const queue = [0.99, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, team, ctx({ rng: () => queue[i++] }));
    expect(avant.bouclier).toBe(30); // round(200 * 0.15)
    expect(arriere.bouclier).toBe(0);
  });

  it("face « rangée avant » : le bouclier est à DURÉE, il disparaît après 3 tours du porteur (CRITIQUE : plan bouclier permanent)", () => {
    const eca = ecaflip();
    eca.position = 0; // rangée avant
    eca.pvMax = 200; eca.pvActuels = 200;
    // rng : pas de critique, puis tirage de la face d'index 2 (rangee_avant/bouclier)
    const queue = [0.99, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++] }));
    expect(eca.bouclier).toBe(30); // round(200 * 0.15)
    expect(eca.boucliersTemporaires).toEqual([{ montant: 30, tours: 3 }]);

    // Comme le bouclier de Château de cartes : décompte à chaque début de tour du
    // porteur, retire exactement ce qui a été donné à l'expiration, pas plus.
    effetsDebutTour(eca, [eca], ctx());
    expect(eca.boucliersTemporaires).toEqual([{ montant: 30, tours: 2 }]);
    effetsDebutTour(eca, [eca], ctx());
    expect(eca.boucliersTemporaires).toEqual([{ montant: 30, tours: 1 }]);
    expect(eca.bouclier).toBe(30); // pas encore expiré

    effetsDebutTour(eca, [eca], ctx());
    expect(eca.bouclier).toBe(0); // expiré : le bouclier n'était pas permanent
    expect(eca.boucliersTemporaires).toEqual([]);
  });

  it("face « rangée avant » : friction bloque le bouclier ET n'ajoute aucune entrée temporaire", () => {
    const eca = ecaflip();
    eca.position = 0;
    eca.pvMax = 200; eca.pvActuels = 200;
    eca.effets.push({ stat: "friction", valeur: 1, toursRestants: 3 });
    const queue = [0.99, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++] }));
    expect(eca.bouclier).toBe(0);
    expect(eca.boucliersTemporaires ?? []).toEqual([]);
  });

  it("sur critique : DEUX faces sont tirées (cumulables)", () => {
    const eca = ecaflip();
    eca.position = 0; // rangée avant : nécessaire pour que la face « rangee_avant » l'inclue
    // crit (0), face 0 (0 → index 0, soi), face 1 (0.99 → index 2, dernier)
    const queue = [0, 0, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++] }));
    expect(eca.effets.some((e) => e.stat === "degatsInfliges")).toBe(true);
    expect(eca.bouclier).toBeGreaterThan(0); // face rangee_avant : eca est en rangée avant
  });

  it("annonce CHAQUE face tirée dans le journal, pas seulement le nom du sort (deux tirages sur critique → deux lignes)", () => {
    const eca = ecaflip();
    eca.position = 0;
    const logs: string[] = [];
    // crit (0), face 0 (0 → index 0), face 1 (0.99 → index 2)
    const queue = [0, 0, 0.99];
    let i = 0;
    lancerSort(eca, SORTS.roulette, eca.ref, [eca], ctx({ rng: () => queue[i++], log: (msg) => logs.push(msg) }));

    const annoncesDeFace = logs.filter((m) => m.includes("tire :"));
    expect(annoncesDeFace).toHaveLength(2); // une par face tirée, en plus de « lance Roulette. »
  });
});

describe("Château de cartes", () => {
  it("porte les valeurs du plan", () => {
    const s = SORTS.chateau_de_cartes;
    expect(s.coutPA).toBe(2);
    expect(s.cible).toBe("allie");
    expect(s.cooldownTours).toBe(4);
    expect(s.bouclierPct).toBeCloseTo(0.20);
    expect(s.bouclierPctSiCrit).toBeCloseTo(0.40);
    expect(s.bouclierTours).toBe(2);
    expect(s.type).toBe("buff");
  });

  it("bout en bout, sans critique : bouclier de 20 % des PV max, à durée", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop"]));
    const [eca, allie] = team;
    allie.pvMax = 300; allie.pvActuels = 300;
    lancerSort(eca, SORTS.chateau_de_cartes, allie.ref, team, ctx({ rng: () => 0.5 })); // pas de crit
    expect(allie.bouclier).toBe(60); // round(300 * 0.2)
    expect(allie.boucliersTemporaires).toEqual([{ montant: 60, tours: 2 }]);
  });

  it("bout en bout, sur critique : bouclier DOUBLÉ (40 %)", () => {
    const team = equipeCombattante(nouvelleRun(["ecaflip", "iop"]));
    const [eca, allie] = team;
    allie.pvMax = 300; allie.pvActuels = 300;
    lancerSort(eca, SORTS.chateau_de_cartes, allie.ref, team, ctx({ rng: () => 0 })); // crit forcé
    expect(allie.bouclier).toBe(120); // round(300 * 0.4)
  });
});
