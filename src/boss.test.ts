// =============================================================================
//  boss.test.ts — Signatures des boss (mécanique unique par boss, kit standard
//  conservé). Le Kwakwa a en plus la « mue élémentaire » (moteur).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, appliquerMueElementaire, controllerIA, type CombatCtx } from "./combat";
import { SORTS, MONSTRES, ZONES } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import type { Combatant } from "./types";

const rngMax: () => number = () => 0.99; // pas d'esquive, jet max, pas de crit
const ctx = (over: Partial<CombatCtx> = {}): CombatCtx => ({
  rng: rngMax, log: () => {}, playerDamageBonus: 1, ...over,
});

const bossDe = (combatId: string): Combatant =>
  fabriquerEnnemis(combatId).find((c) => MONSTRES[c.monstreId!]?.boss)!;

describe("signatures des boss", () => {
  it("chaque boss a exactement un sort signature en tête de kit (sauf le Kwakwa : mue moteur)", () => {
    for (const zone of ZONES) {
      const boss = bossDe(zone.pools.boss);
      const m = MONSTRES[boss.monstreId!];
      const aSignatureSort = !["kwakwa", "directeur_grunob"].includes(m.id); // mue moteur / passif de ligne
      if (m.id === "directeur_grunob") expect(m.bonusParAllieLigne).toBe(0.15);
      if (aSignatureSort) {
        const premier = SORTS[m.sorts[0]];
        expect(premier.desc, `${m.nom} : signature en tête de kit`).toContain(m.nom.split(" ")[0]);
        expect(premier.cooldownTours, `${m.nom} : signature sous cooldown`).toBeGreaterThan(0);
      }
      if (m.id === "kwakwa") expect(m.mueElementaire).toBe(0.65);
    }
  });

  it("Colère royale : le Bouftou Royal cumule de la Force à chaque lancer", () => {
    const boss = bossDe("tai_boss");
    const [iop] = fabriquerEquipe();
    const forceAvant = boss.stats.force;
    lancerSort(boss, SORTS.colere_royale, iop.ref, [boss, iop], ctx());
    lancerSort(boss, SORTS.colere_royale, iop.ref, [boss, iop], ctx());
    const bonus = boss.effets.filter((e) => e.stat === "force").reduce((s, e) => s + e.valeur, 0);
    expect(bonus).toBe(50); // 2 lancers cumulés
    expect(boss.stats.force).toBe(forceAvant); // la base ne bouge pas : c'est un effet temporaire
  });

  it("Carapace dorée : le Scarabosse gagne un bouclier de 100 % des dégâts", () => {
    const boss = bossDe("scr_boss");
    const [iop] = fabriquerEquipe();
    iop.pvMax = 500; iop.pvActuels = 500;
    lancerSort(boss, SORTS.carapace_doree, iop.ref, [boss, iop], ctx());
    const degats = 500 - iop.pvActuels;
    expect(degats).toBeGreaterThan(0);
    expect(boss.bouclier).toBe(Math.round(degats * 1.0));
  });

  it("Racines voraces : le Tournesol soigne tout son camp des dégâts infligés", () => {
    const boss = bossDe("boss"); // Tournesol Affamé + Gardienne Champêtre
    const allie = fabriquerEnnemis("boss").find((c) => c.ref !== boss.ref)!;
    const [iop] = fabriquerEquipe();
    iop.pvMax = 500; iop.pvActuels = 500;
    boss.pvActuels = Math.round(boss.pvMax / 2);
    const pvAvant = boss.pvActuels;
    lancerSort(boss, SORTS.racines_voraces, iop.ref, [boss, allie, iop], ctx());
    const degats = 500 - iop.pvActuels;
    expect(degats).toBeGreaterThan(0);
    expect(boss.pvActuels).toBe(Math.min(boss.pvMax, pvAvant + degats)); // soinEquipeRatio 1.0
  });

  it("Rostre broyeur : la cible inflige −25 % de dégâts (1 tour)", () => {
    const boss = bossDe("hsk_boss");
    const [iop] = fabriquerEquipe();
    iop.pvMax = 500; iop.pvActuels = 500;
    lancerSort(boss, SORTS.rostre_broyeur, iop.ref, [boss, iop], ctx());
    expect(iop.effets.some((e) => e.stat === "degatsInfliges" && e.valeur === -0.25 && e.toursRestants === 1)).toBe(true);
  });

  it("mue élémentaire : 65 % partout sauf UN élément à 0, retiré via le rng", () => {
    const kwakwa = bossDe("kwa_boss");
    expect(kwakwa.mueElementaire).toBe(0.65);
    appliquerMueElementaire(kwakwa, ctx({ rng: () => 0 })); // index 0 → terre
    expect(kwakwa.resistances).toEqual({ terre: 0, feu: 0.65, eau: 0.65, air: 0.65 });
    appliquerMueElementaire(kwakwa, ctx({ rng: () => 0.6 })); // index 2 → eau
    expect(kwakwa.resistances).toEqual({ terre: 0.65, feu: 0.65, eau: 0, air: 0.65 });
  });

  it("Sfvc%$*R ?! : Kankreblath invoque un monstre de la zone (2 max en vie)", () => {
    const cs = fabriquerEnnemis("kan_boss");
    const boss = cs.find((c) => c.monstreId === "kankreblath")!;
    lancerSort(boss, SORTS.sfvc, boss.ref, cs, ctx());
    expect(cs.length).toBe(3); // boss + miniboss + 1 invocation
    const invoc = cs[2];
    expect(["pyrasite", "ceglumen", "cafarcher", "mirgrillon"]).toContain(invoc.monstreId);
    expect(invoc.camp).toBe("ennemi");
    expect(invoc.invoquePar).toBe(boss.ref);
    expect(invoc.estInvocation).toBeFalsy(); // il JOUE ses tours (≠ Poupée)
    lancerSort(boss, SORTS.sfvc, boss.ref, cs, ctx());
    expect(cs.length).toBe(4); // 2e invocation OK
    lancerSort(boss, SORTS.sfvc, boss.ref, cs, ctx());
    expect(cs.length).toBe(4); // cap à 2 vivantes
  });

  it("L'Enfer des Zombies : Boostache réinvoque un allié vaincu à 50 % de ses PV", () => {
    const cs = fabriquerEnnemis("fan_boss");
    const boss = cs.find((c) => c.monstreId === "boostache")!;
    const mini = cs.find((c) => c.monstreId === "boostache_prepubere")!;
    mini.pvActuels = 0; // vaincu
    lancerSort(boss, SORTS.enfer_des_zombies, boss.ref, cs, ctx());
    expect(mini.pvActuels).toBe(Math.round(mini.pvMax * 0.5));
    // personne de mort → le sort ne fait rien
    lancerSort(boss, SORTS.enfer_des_zombies, boss.ref, cs, ctx());
    expect(cs.length).toBe(2);
  });

  it("Travail d'équipe : Grunob inflige +15 % par allié vivant dans sa rangée", () => {
    const cs = fabriquerEnnemis("gob_boss"); // Grunob (pos 0) + Gobaladée (pos 1)
    const boss = cs.find((c) => c.monstreId === "directeur_grunob")!;
    const [iop] = fabriquerEquipe();
    iop.pvMax = 5000; iop.pvActuels = 5000;
    lancerSort(boss, SORTS.morsure, iop.ref, [...cs, iop], ctx());
    const avecAllie = 5000 - iop.pvActuels;
    iop.pvActuels = 5000;
    cs[1].pvActuels = 0; // la Gobaladée tombe → le bonus disparaît
    lancerSort(boss, SORTS.morsure, iop.ref, [...cs, iop], ctx());
    const seul = 5000 - iop.pvActuels;
    expect(avecAllie).toBe(Math.round(seul * 1.15));
  });

  it("l'IA agressive joue l'invocation signature en priorité quand elle est utile", async () => {
    const cs = fabriquerEnnemis("kan_boss");
    const boss = cs.find((c) => c.monstreId === "kankreblath")!;
    const [iop] = fabriquerEquipe();
    boss.paActuels = 6;
    const a = (await controllerIA(boss, [...cs, iop]))!;
    expect(a.sort.id).toBe("sfvc");
  });

  it("l'IA agressive joue la signature en priorité, puis retombe sur le kit standard (cooldown)", async () => {
    const boss = bossDe("tai_boss");
    const [iop] = fabriquerEquipe();
    boss.paActuels = 6;
    const a1 = (await controllerIA(boss, [boss, iop]))!;
    expect(a1.sort.id).toBe("colere_royale");
    lancerSort(boss, a1.sort, iop.ref, [boss, iop], ctx()); // pose le cooldown
    boss.paActuels = 6;
    const a2 = (await controllerIA(boss, [boss, iop]))!;
    expect(a2.sort.id).not.toBe("colere_royale"); // sous cooldown → écrasement/charge
  });
});
