// =============================================================================
//  errants.test.ts — Archimonstres errants (les Piou)
//  Ils n'appartiennent à AUCUNE zone : ils surgissent rarement en plus d'un pack
//  normal de Tranche 1, et toujours déjà sous forme d'archimonstre.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, ERRANTS, ARCHI } from "./data";
import { fabriquerEnnemis, appliquerErrants, appliquerArchimonstres } from "./run";
import type { Combatant } from "./types";

const ELEMENT_DE = {
  piou_rouge: "feu", piou_vert: "terre", piou_bleu: "eau", piou_jaune: "air",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;
const PLATS = ["piou_rose", "piou_violet"]; // hors carré : aucun pic élémentaire
const ARCHIS = {
  piou_rouge: "Pioulette la Coquine",
  piou_vert: "Pioukas la Plante",
  piou_bleu: "Pioustone le Problème",
  piou_jaune: "Pioulbrineur le Mercenaire",
  piou_rose: "Pioufe la Maquillée",
  piou_violet: "Pioussokrim le Délétère",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};
const dom = (id: string): number => {
  const s = MONSTRES[id].stats as unknown as Record<string, number>;
  return Math.max(s.force ?? 0, s.intelligence ?? 0, s.agilite ?? 0, s.chance ?? 0);
};
/** Un rng constant : `k` bas garantit l'apparition, `k` haut la refuse. */
const rngFixe = (k: number) => () => k;

describe("les six Piou", () => {
  it("existent, avec des archimonstres distincts", () => {
    for (const [id, nom] of Object.entries(ARCHIS)) {
      expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
      expect(MONSTRES[id].archiNom, `${id}`).toBe(nom);
    }
    const noms = Object.keys(ARCHIS).map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux Piou ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("les quatre couleurs canoniques portent un élément, Rose et Violet sont plats", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      expect(dominante(id), `${id}`).toBe(STAT_DE_ELEMENT[element]);
      const r = MONSTRES[id].resistances ?? {};
      expect(Math.max(...Object.values(r)), `${id} doit résister dans son élément`).toBeGreaterThan(0);
    }
    for (const id of PLATS) {
      // Hors carré : on n'invente pas une 5e et 6e correspondance couleur→élément qui
      // n'existe pas — même traitement que la Larve Champêtre.
      const vals = Object.values(MONSTRES[id].resistances ?? {});
      expect(new Set(vals).size, `${id} doit avoir des résistances plates`).toBe(1);
    }
  });

  it("aucun sprite en doublon", () => {
    const imgs = Object.keys(ARCHIS).map((id) => MONSTRES[id].img);
    expect(new Set(imgs).size, `sprites en doublon : ${imgs.join(", ")}`).toBe(imgs.length);
  });

  it("restent FAIBLES même en forme d'archi", () => {
    // Le calibrage vise le PREMIER combat d'une run, pas la moyenne : un Piou archi doit
    // s'insérer à Incarnam comme un ennemi normal de plus. Sans ce test, quelqu'un
    // gonflera un jour ces valeurs et un Piou surgissant au combat 1 terminerait la run.
    const incarnam = ["chafer_debutant", "chafer_eclaireur", "chafer_furtif", "chafer_piquier"];
    const pvMaxIncarnam = Math.max(...incarnam.map((id) => MONSTRES[id].pv));
    const domMaxIncarnam = Math.max(...incarnam.map(dom));
    for (const id of Object.keys(ARCHIS)) {
      expect(MONSTRES[id].pv * ARCHI.pvMult, `${id} : trop de PV en archi`)
        .toBeLessThanOrEqual(pvMaxIncarnam * 2);
      expect(dom(id) * ARCHI.statMult, `${id} : frappe trop fort en archi`)
        .toBeLessThanOrEqual(domMaxIncarnam * 1.5);
    }
  });

  it("ne sont dans AUCUNE zone — c'est ce qui les rend errants", () => {
    expect(ERRANTS.t1.especes.slice().sort()).toEqual(Object.keys(ARCHIS).sort());
  });

  it("ERRANTS ne déclare QUE la Tranche 1 aujourd'hui", () => {
    // Pour que l'ajout d'errants en T2 soit un choix visible et non un effet de bord.
    expect(Object.keys(ERRANTS)).toEqual(["t1"]);
  });
});

describe("appliquerErrants", () => {
  const pack = (): Combatant[] => fabriquerEnnemis("inc_1"); // 2 ennemis, 6 cases libres

  it("ajoute un Piou DÉJÀ archi, avec son vrai nom et ses PV doublés", () => {
    const ennemis = pack();
    const avant = ennemis.length;
    const nom = appliquerErrants(ennemis, rngFixe(0), { type: "combat", tranche: "t1" });
    expect(ennemis).toHaveLength(avant + 1);
    const piou = ennemis[ennemis.length - 1];
    expect(ERRANTS.t1.especes, "l'ajouté doit être un Piou").toContain(piou.monstreId);
    expect(piou.archi, "il arrive DÉJÀ en archi").toBe(true);
    expect(piou.nom).toBe(MONSTRES[piou.monstreId!].archiNom);
    expect(piou.pvMax).toBe(MONSTRES[piou.monstreId!].pv * ARCHI.pvMult);
    expect(nom, "le nom est renvoyé pour l'annonce du titre").toBe(piou.nom);
  });

  it("un Piou déjà archi ne remute pas — pas de double doublement de PV", () => {
    // L'ordre d'appel dans main.ts (archis PUIS errants) suffit aujourd'hui, mais un
    // inversement futur diviserait la lisibilité de la zone par deux sans rien casser.
    const ennemis = pack();
    appliquerErrants(ennemis, rngFixe(0), { type: "combat", tranche: "t1" });
    const piou = ennemis[ennemis.length - 1];
    const pv = piou.pvMax;
    const force = piou.stats.force;
    appliquerArchimonstres(ennemis, rngFixe(0), 1); // taux 1 : tout le monde tenterait de muter
    expect(piou.pvMax).toBe(pv);
    expect(piou.stats.force).toBe(force);
  });

  it("n'ajoute rien en élite ni en donjon, même avec un tirage garanti", () => {
    // Ces salles sont équilibrées ; un archi de plus les déréglerait, et une salle de
    // boss tendue pourrait devenir infaisable.
    for (const type of ["combat_dur", "donjon"] as const) {
      const ennemis = pack();
      const avant = ennemis.length;
      expect(appliquerErrants(ennemis, rngFixe(0), { type, tranche: "t1" })).toBeUndefined();
      expect(ennemis, `${type}`).toHaveLength(avant);
    }
  });

  it("n'ajoute rien pour une tranche sans errants déclarés", () => {
    const ennemis = pack();
    expect(appliquerErrants(ennemis, rngFixe(0), { type: "combat", tranche: "t2" })).toBeUndefined();
    expect(ennemis).toHaveLength(2);
  });

  it("n'ajoute rien quand le tirage échoue", () => {
    const ennemis = pack();
    expect(appliquerErrants(ennemis, rngFixe(0.99), { type: "combat", tranche: "t1" })).toBeUndefined();
    expect(ennemis).toHaveLength(2);
  });

  it("respecte le taux déclaré, LU depuis la constante", () => {
    // Ordre de grandeur, pas égalité : Adam veut pouvoir passer 1 % à 1,5 % sans casser
    // ce test, donc il ne code JAMAIS 0,01 en dur.
    let g = 123456789;
    const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const n = 20000;
    let apparus = 0;
    for (let i = 0; i < n; i++) {
      const ennemis = pack();
      if (appliquerErrants(ennemis, rng, { type: "combat", tranche: "t1" })) apparus++;
    }
    const taux = apparus / n;
    const attendu = ERRANTS.t1.chance;
    expect(taux, `taux mesuré ${(taux * 100).toFixed(2)} % pour ${(attendu * 100).toFixed(2)} % attendu`)
      .toBeGreaterThan(attendu * 0.6);
    expect(taux).toBeLessThan(attendu * 1.4);
  });

  it("place le Piou sur une case LIBRE, et n'ajoute rien si la grille est pleine", () => {
    const ennemis = pack();
    appliquerErrants(ennemis, rngFixe(0), { type: "combat", tranche: "t1" });
    const cases = ennemis.map((e) => e.position);
    expect(new Set(cases).size, "aucune case occupée deux fois").toBe(cases.length);
    for (const c of cases) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(8);
    }

    // grille pleine : rien ne doit être ajouté, et rien ne doit casser
    const plein = pack();
    for (let c = 0; c < 8; c++) {
      if (!plein.some((e) => e.position === c)) plein.push({ ...plein[0], ref: `x${c}`, position: c });
    }
    expect(plein).toHaveLength(8);
    expect(appliquerErrants(plein, rngFixe(0), { type: "combat", tranche: "t1" })).toBeUndefined();
    expect(plein).toHaveLength(8);
  });

  it("les six espèces sortent toutes à la longue", () => {
    // Sinon un bug de tirage pourrait n'en produire qu'une, et cinq archis resteraient
    // inaccessibles sans que rien ne le signale.
    let g = 42;
    const rng = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const vus = new Set<string>();
    for (let i = 0; i < 5000 && vus.size < 6; i++) {
      const ennemis = pack();
      // rng garanti pour l'APPARITION (1er appel), puis le vrai rng pour le CHOIX
      let premier = true;
      const rngApparition = () => {
        if (premier) { premier = false; return 0; }
        return rng();
      };
      if (appliquerErrants(ennemis, rngApparition, { type: "combat", tranche: "t1" })) {
        vus.add(ennemis[ennemis.length - 1].monstreId!);
      }
    }
    expect([...vus].sort()).toEqual(ERRANTS.t1.especes.slice().sort());
  });
});
