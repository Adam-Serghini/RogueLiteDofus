// =============================================================================
//  craqueleurs.test.ts — Pitons Rocheux des Craqueleurs (zone 6 de la Tranche 2)
//  armure native (réduction PLATE des dégâts subis), bestiaire, budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";
import { fabriquerEquipe, fabriquerEnnemis } from "./run";
import { lancerSort } from "./combat";
import type { Combatant } from "./types";

/** Un héros de sonde au niveau OÙ LA ZONE SE JOUE (≈ 70, stat dominante ≈ 150).
 *  `fabriquerEquipe()` sort une équipe de niveau 1 dont les coups tournent à ~19
 *  dégâts : une armure de 20 les annulerait tous, et le test mesurerait alors le
 *  plancher à 0 au lieu de la réduction. Constat à retenir pour l'équilibrage —
 *  l'armure de cette zone est violente contre un personnage sous-niveau. */
function herosDeSonde(): Combatant {
  const [h] = fabriquerEquipe();
  h.stats = { ...h.stats, force: 150, intelligence: 150, agilite: 150, chance: 150 };
  return h;
}

/** Frappe `n` fois la cible et renvoie les dégâts subis coup par coup.
 *  La graine est réinitialisée à chaque appel : deux appels rejouent donc
 *  exactement la même suite de jets (esquives et crits inclus), ce qui rend les
 *  séries comparables terme à terme. */
function coupParCoup(cible: Combatant, sortId: string, n: number): number[] {
  let g = 987654321;
  const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ctx = { rng, log: () => {}, playerDamageBonus: 1 };
  const heros = herosDeSonde();
  heros.position = 0;
  cible.position = 0;
  const cs = [heros, cible];
  const coups: number[] = [];
  for (let i = 0; i < n; i++) {
    cible.pvActuels = cible.pvMax;
    lancerSort(heros, SORTS[sortId], cible.ref, cs, ctx);
    coups.push(cible.pvMax - cible.pvActuels);
  }
  return coups;
}

const degatsCumules = (cible: Combatant, sortId: string, n: number): number =>
  coupParCoup(cible, sortId, n).reduce((a, b) => a + b, 0);

/** Une cible neutre quelconque, pour éprouver le socle sans dépendre du contenu
 *  de la zone (qui n'existe pas encore à ce stade). */
const cibleNeutre = (): Combatant => fabriquerEnnemis("wab_1")[0];

describe("socle : l'armure native retranche un montant PLAT", () => {
  it("une cible blindée encaisse strictement moins, à jets identiques", () => {
    const nu = cibleNeutre();
    const blinde = cibleNeutre();
    blinde.armure = 20;
    const sansArmure = degatsCumules(nu, "morsure", 30);
    const avecArmure = degatsCumules(blinde, "morsure", 30);
    expect(avecArmure).toBeLessThan(sansArmure);
    expect(avecArmure).toBeGreaterThan(0); // 20 ne doit pas suffire à tout annuler
  });

  it("chaque coup perd EXACTEMENT le montant de l'armure", () => {
    // Le cœur de la zone : plate, pas en pourcentage. Un pourcentage serait des
    // résistances sous un autre nom — la leçon du Clos des Blops, déjà donnée.
    const A = 20;
    const nu = coupParCoup(cibleNeutre(), "morsure", 25);
    const blinde = cibleNeutre();
    blinde.armure = A;
    const avec = coupParCoup(blinde, "morsure", 25);
    expect(avec).toHaveLength(nu.length);
    let comparés = 0;
    for (const [i, brut] of nu.entries()) {
      if (brut === 0) { expect(avec[i], `coup ${i} : esquive des deux côtés`).toBe(0); continue; }
      expect(avec[i], `coup ${i} : ${brut} − ${A}`).toBe(Math.max(0, brut - A));
      comparés++;
    }
    expect(comparés, "aucun coup n'a porté : la sonde est trop faible").toBeGreaterThan(10);
  });

  it("une frappe plus faible que l'armure inflige ZÉRO", () => {
    // Le plancher à 0 du moteur EST la leçon de la zone : les petits coups ne
    // rayent pas la pierre. C'est aussi son mode de défaillance, d'où ce test.
    const mur = cibleNeutre();
    mur.armure = 100000;
    expect(degatsCumules(mur, "morsure", 10)).toBe(0);
  });

  it("armure absente ≡ armure nulle (pas de NaN)", () => {
    // `dmg -= undefined` donnerait NaN et casserait silencieusement TOUT le jeu :
    // c'est le vrai risque de la ligne ajoutée au moteur.
    const sansChamp = cibleNeutre();
    const zero = cibleNeutre();
    zero.armure = 0;
    const a = degatsCumules(sansChamp, "morsure", 20);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(degatsCumules(zero, "morsure", 20));
  });

  it("l'armure native s'ajoute à l'armure temporaire, sans la remplacer", () => {
    const c = cibleNeutre();
    c.armure = 15;
    const natif = degatsCumules(c, "morsure", 20);
    c.effets.push({ stat: "armure", valeur: 15, toursRestants: 99 });
    expect(degatsCumules(c, "morsure", 20)).toBeLessThan(natif);
  });
});

const ELEMENT_DE = {
  craqueleur: "terre", craqueleur_des_plaines: "eau", craqueboule: "air",
  craquelourd: "terre", craqueleur_legendaire: "feu",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const ARCHIS = {
  craqueleur: "Crakmitaine le Faucheur",
  craqueleur_des_plaines: "Cramikaz le Suicidaire",
  craqueboule: "Craquetuss le Piquant",
  craquelourd: "Craquecrac l'Endurant",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire des Pitons Rocheux", () => {
  it("les 5 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("4 espèces sur 5 sont capturables, avec des archis distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("toute la zone est blindée, et le boss plus que ses escortes", () => {
    for (const id of Object.keys(ELEMENT_DE)) {
      expect(MONSTRES[id].armure ?? 0, `${id} doit porter une armure native`).toBeGreaterThan(0);
    }
    const boss = MONSTRES.craqueleur_legendaire.armure!;
    for (const id of Object.keys(ARCHIS)) expect(boss).toBeGreaterThan(MONSTRES[id].armure!);
  });

  it("la pierre ne rejoue PAS le puzzle élémentaire du Clos des Blops", () => {
    // L'identité de la zone est l'armure plate. Un pic de résistance ramènerait
    // la leçon des couleurs, déjà donnée à la toile 13.
    for (const id of Object.keys(ELEMENT_DE)) {
      const r = MONSTRES[id].resistances ?? {};
      for (const el of ["terre", "feu", "air", "eau"] as const) {
        expect(Math.abs(r[el] ?? 0), `${id} : résistance ${el} trop marquée`).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it("le durcissement empile de l'armure sur son lanceur", () => {
    const s = SORTS.durcissement;
    expect(s.type).toBe("degats"); // sinon `iaAgressif` ne le jouerait jamais
    expect(s.effetLanceur?.stat).toBe("armure");
    expect(s.cooldownTours).toBe(2);
    // la durée doit dépasser le cooldown, sinon l'armure ne s'accumule jamais
    expect(s.effetLanceur!.duree).toBeGreaterThan(s.cooldownTours!);
  });
});
