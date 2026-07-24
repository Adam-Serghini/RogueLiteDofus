// =============================================================================
//  boss.test.ts — Signatures des boss (mécanique unique par boss, kit standard
//  conservé). Le Kwakwa a en plus la « mue élémentaire » (moteur).
// =============================================================================
import { describe, it, expect } from "vitest";
import { lancerSort, appliquerMueElementaire, controllerIA, type CombatCtx } from "./combat";
import { multSoin } from "./progression";
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
      if (m.id === "directeur_grunob") expect(m.bonusParAllieLigne).toBe(0.06);
      if (aSignatureSort) {
        const premier = SORTS[m.sorts[0]];
        expect(premier.desc, `${m.nom} : signature en tête de kit`).toContain(m.nom.split(" ")[0]);
        expect(premier.cooldownTours, `${m.nom} : signature sous cooldown`).toBeGreaterThan(0);
      }
      if (m.id === "kwakwa") expect(m.mueElementaire).toBe(0.5);
    }
  });

  it("Étreinte glaciale : Kardorim gèle TOUTE la ligne — dégâts et −1 PA garanti à chaque cible", () => {
    // Le rider −initiative est mort avec l'ordre des tours figé → remplacé par du retrait de PA.
    const boss = bossDe("inc_boss");
    const equipe = fabriquerEquipe().slice(0, 2);
    for (const [i, h] of equipe.entries()) {
      h.position = i; // les deux en ligne avant
      h.stats = { ...h.stats, agilite: 0 };
      h.pvActuels = 500; h.pvMax = 500;
      h.paActuels = h.paMax;
    }
    const cs = [boss, ...equipe];
    lancerSort(boss, SORTS.etreinte_glaciale, equipe[0].ref, cs, ctx({ rng: () => 0.9 })); // 0.9 raterait un 30 %
    for (const h of equipe) {
      expect(h.pvActuels).toBeLessThan(500); // toute la ligne touchée
      expect(h.paActuels).toBe(h.paMax - 1); // −1 PA garanti
      expect(h.effets.some((e) => e.stat === "initiative")).toBe(false); // plus de rider d'init
    }
  });

  it("Colère royale : le Bouftou Royal cumule de la Force à chaque lancer", () => {
    const boss = bossDe("tai_boss");
    const [iop] = fabriquerEquipe();
    const forceAvant = boss.stats.force;
    lancerSort(boss, SORTS.colere_royale, iop.ref, [boss, iop], ctx());
    lancerSort(boss, SORTS.colere_royale, iop.ref, [boss, iop], ctx());
    const bonus = boss.effets.filter((e) => e.stat === "force").reduce((s, e) => s + e.valeur, 0);
    expect(bonus).toBe(30); // 2 lancers cumulés (+15 chacun)
    expect(boss.stats.force).toBe(forceAvant); // la base ne bouge pas : c'est un effet temporaire
  });

  it("Carapace dorée : le Scarabosse gagne un bouclier de 40 % des dégâts", () => {
    const boss = bossDe("scr_boss");
    const [iop] = fabriquerEquipe();
    iop.pvMax = 500; iop.pvActuels = 500;
    lancerSort(boss, SORTS.carapace_doree, iop.ref, [boss, iop], ctx());
    const degats = 500 - iop.pvActuels;
    expect(degats).toBeGreaterThan(0);
    expect(boss.bouclier).toBe(Math.round(degats * 0.4));
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
    // soinEquipeRatio 0.6 × multSoin (l'Intelligence scale aussi les soins des monstres)
    const attendu = Math.round(degats * 0.6 * multSoin(boss.stats));
    expect(boss.pvActuels).toBe(Math.min(boss.pvMax, pvAvant + attendu));
  });

  it("Rostre broyeur : la cible inflige −15 % de dégâts (1 tour)", () => {
    const boss = bossDe("hsk_boss");
    const [iop] = fabriquerEquipe();
    iop.pvMax = 500; iop.pvActuels = 500;
    lancerSort(boss, SORTS.rostre_broyeur, iop.ref, [boss, iop], ctx());
    expect(iop.effets.some((e) => e.stat === "degatsInfliges" && e.valeur === -0.15 && e.toursRestants === 1)).toBe(true);
  });

  it("mue élémentaire : 50 % partout sauf UN élément à 0, retiré via le rng", () => {
    const kwakwa = bossDe("kwa_boss");
    expect(kwakwa.mueElementaire).toBe(0.5);
    appliquerMueElementaire(kwakwa, ctx({ rng: () => 0 })); // index 0 → terre
    expect(kwakwa.resistances).toEqual({ terre: 0, feu: 0.5, eau: 0.5, air: 0.5 });
    appliquerMueElementaire(kwakwa, ctx({ rng: () => 0.6 })); // index 2 → eau
    expect(kwakwa.resistances).toEqual({ terre: 0.5, feu: 0.5, eau: 0, air: 0.5 });
  });

  it("Sfvc%$*R ?! : Kankreblath invoque un monstre de la zone (2 max en vie)", () => {
    const cs = fabriquerEnnemis("kan_boss");
    const boss = cs.find((c) => c.monstreId === "kankreblath")!;
    lancerSort(boss, SORTS.sfvc, boss.ref, cs, ctx());
    expect(cs.length).toBe(4); // boss + miniboss + cafarcher + 1 invocation
    const invoc = cs[3];
    expect(["pyrasite", "ceglumen", "cafarcher", "mirgrillon"]).toContain(invoc.monstreId);
    expect(invoc.camp).toBe("ennemi");
    expect(invoc.invoquePar).toBe(boss.ref);
    expect(invoc.estInvocation).toBeFalsy(); // il JOUE ses tours (≠ Poupée)
    lancerSort(boss, SORTS.sfvc, boss.ref, cs, ctx());
    expect(cs.length).toBe(5); // 2e invocation OK
    lancerSort(boss, SORTS.sfvc, boss.ref, cs, ctx());
    expect(cs.length).toBe(5); // cap à 2 vivantes
  });

  it("L'Enfer des Zombies : Boostache réinvoque un allié vaincu à 35 % de ses PV", () => {
    const cs = fabriquerEnnemis("fan_boss");
    const boss = cs.find((c) => c.monstreId === "boostache")!;
    const mini = cs.find((c) => c.monstreId === "boostache_prepubere")!;
    mini.pvActuels = 0; // vaincu
    lancerSort(boss, SORTS.enfer_des_zombies, boss.ref, cs, ctx());
    expect(mini.pvActuels).toBe(Math.round(mini.pvMax * 0.35));
    // personne de mort → le sort ne fait rien (aucun combattant ajouté)
    lancerSort(boss, SORTS.enfer_des_zombies, boss.ref, cs, ctx());
    expect(cs.length).toBe(3);
  });

  it("réinvocation : les compteurs de bombes/téléfrags du mort sont purgés (ressuscité \"propre\")", () => {
    const cs = fabriquerEnnemis("fan_boss");
    const boss = cs.find((c) => c.monstreId === "boostache")!;
    const mini = cs.find((c) => c.monstreId === "boostache_prepubere")!;
    mini.bombes = 3;
    mini.telefrags = 2;
    mini.pvActuels = 0; // vaincu, compteurs encore posés
    lancerSort(boss, SORTS.enfer_des_zombies, boss.ref, cs, ctx());
    expect(mini.pvActuels).toBeGreaterThan(0); // bien réinvoqué
    expect(mini.bombes ?? 0).toBe(0);
    expect(mini.telefrags ?? 0).toBe(0);
  });

  it("Travail d'équipe : Grunob inflige +6 % par allié vivant dans sa rangée", () => {
    const cs = fabriquerEnnemis("gob_boss"); // Grunob + Gobaladée + Gobichon (avant) + Gobaliste (arrière)
    const boss = cs.find((c) => c.monstreId === "directeur_grunob")!;
    const [iop] = fabriquerEquipe();
    iop.pvMax = 5000; iop.pvActuels = 5000;
    lancerSort(boss, SORTS.morsure, iop.ref, [...cs, iop], ctx());
    const deuxAllies = 5000 - iop.pvActuels; // Gobaladée + Gobichon en ligne avant → ×1.12
    iop.pvActuels = 5000;
    for (const c of cs) if (c.ref !== boss.ref && c.position < 4) c.pvActuels = 0; // la ligne avant tombe
    lancerSort(boss, SORTS.morsure, iop.ref, [...cs, iop], ctx());
    const seul = 5000 - iop.pvActuels; // plus d'allié dans sa rangée → ×1.0
    expect(Math.abs(deuxAllies - seul * 1.12)).toBeLessThanOrEqual(1); // ±1 d'arrondi interne
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
