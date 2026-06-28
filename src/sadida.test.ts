// =============================================================================
//  sadida.test.ts — Invocation (Poupée de garde), provocation, réduction
//  d'initiative et buff Vigueur des bois.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  lancerSort, ciblesValides, runCombat, controllerIA, type Controller, type CombatCtx,
} from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";

const rngMax: () => number = () => 0.99;
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

// L'équipe de départ est désormais [Iop, Cra, Eniripsa, Sadida].
const sadidaEt = () => {
  const team = fabriquerEquipe();
  return team[3];
};

describe("Poupée de garde (invocation)", () => {
  it("crée une invocation alliée qui ne joue pas de tour", () => {
    const sadida = sadidaEt();
    const cs = [sadida];
    lancerSort(sadida, SORTS.poupee_garde, sadida.ref, cs, ctx());
    const poupee = cs.find((c) => c.estInvocation);
    expect(poupee).toBeDefined();
    expect(poupee!.pvActuels).toBe(40);
    expect(poupee!.joueTour).toBe(false);
    expect(poupee!.provoque).toBe(true);
    expect(poupee!.camp).toBe("joueur");
  });

  it("une seule poupée active par invocateur", () => {
    const sadida = sadidaEt();
    const cs = [sadida];
    lancerSort(sadida, SORTS.poupee_garde, sadida.ref, cs, ctx());
    lancerSort(sadida, SORTS.poupee_garde, sadida.ref, cs, ctx());
    expect(cs.filter((c) => c.estInvocation).length).toBe(1);
  });

  it("ne prend jamais de tour dans la boucle de combat", async () => {
    const team = fabriquerEquipe();
    const sadida = team[3];
    const cs = [...team, ...fabriquerEnnemis("combat_1")];
    lancerSort(sadida, SORTS.poupee_garde, sadida.ref, cs, ctx());
    const poupeeRef = cs.find((c) => c.estInvocation)!.ref;

    const aJoue: string[] = [];
    await runCombat(cs, {
      controllers: {
        joueur: (a) => (aJoue.push(a.ref), null), // les joueurs passent
        ennemi: (a) => (aJoue.push(a.ref), controllerIA(a, cs)),
      },
      rng: rngMax,
    });
    expect(aJoue).not.toContain(poupeeRef); // jamais acteur
  });
});

describe("provocation", () => {
  it("les ennemis ciblent la poupée en priorité tant qu'elle vit", () => {
    const team = fabriquerEquipe();
    const sadida = team[3];
    const ennemis = fabriquerEnnemis("combat_1");
    const cs = [...team, ...ennemis];
    lancerSort(sadida, SORTS.poupee_garde, sadida.ref, cs, ctx());
    const poupee = cs.find((c) => c.estInvocation)!;

    const cibles = ciblesValides(ennemis[0], SORTS.morsure, cs);
    expect(cibles.length).toBe(1);
    expect(cibles[0].ref).toBe(poupee.ref);
  });
});

describe("réduction d'initiative", () => {
  it("Déferlante applique un malus d'initiative aux cibles", () => {
    const sadida = sadidaEt();
    const ennemis = fabriquerEnnemis("combat_2"); // pos 1, 2, 3
    const front = ennemis.find((e) => e.position === 1)!;
    lancerSort(sadida, SORTS.deferlante, front.ref, [sadida, ...ennemis], ctx());
    expect(front.effets.some((e) => e.stat === "initiative" && e.valeur < 0)).toBe(true);
  });

  it("un malus d'initiative change l'ordre des tours", async () => {
    const [iop] = fabriquerEquipe(); // initiative 8
    const tofu = fabriquerEnnemis("inc_1").find((e) => e.nom === "Tofu")!; // initiative 14

    const premier = async (cs: typeof iop[]): Promise<string> => {
      const ordre: string[] = [];
      const rec: Controller = (a) => (ordre.push(a.ref), null);
      await runCombat(cs, { controllers: { joueur: rec, ennemi: rec }, rng: rngMax });
      return ordre[0];
    };

    expect(await premier([iop, tofu])).toBe(tofu.ref); // le Tofu (init 14) d'abord
    tofu.effets.push({ stat: "initiative", valeur: -10, toursRestants: 99 }); // 14 → 4
    expect(await premier([iop, tofu])).toBe(iop.ref); // l'Iop (init 8) passe devant
  });
});

describe("Vigueur des bois & poison", () => {
  it("Vigueur des bois renforce le prochain sort offensif puis se consomme", () => {
    const sadida = sadidaEt();
    const boss = fabriquerEnnemis("boss")[0];
    const cs = [sadida, boss];

    lancerSort(sadida, SORTS.lame_liquide, boss.ref, cs, ctx());
    const sansVigueur = boss.pvMax - boss.pvActuels;

    boss.pvActuels = boss.pvMax; // reset
    lancerSort(sadida, SORTS.vigueur_bois, sadida.ref, cs, ctx());
    expect(sadida.bonusOffensifProchain).toBeCloseTo(0.3);
    lancerSort(sadida, SORTS.lame_liquide, boss.ref, cs, ctx());
    const avecVigueur = boss.pvMax - boss.pvActuels;

    expect(avecVigueur).toBeGreaterThan(sansVigueur);
    expect(sadida.bonusOffensifProchain).toBe(0); // consommé
  });

  it("Crachat de sève applique un poison", () => {
    const sadida = sadidaEt();
    const boss = fabriquerEnnemis("boss")[0];
    lancerSort(sadida, SORTS.crachat_de_seve, boss.ref, [sadida, boss], ctx());
    expect(boss.pvActuels).toBeGreaterThan(0);
    expect(boss.effets.some((e) => e.stat === "poison")).toBe(true);
  });
});
