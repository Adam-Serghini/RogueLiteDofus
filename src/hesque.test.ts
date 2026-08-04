// =============================================================================
//  hesque.test.ts — Grotte Hesque (zone 11 de la Tranche 1, toile 11)
//  le carré 4 Palmifleurs × 4 Crustorails, et le cocktail comme élément.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, ZONES, COMBATS } from "./data";
import { ELEMENTS } from "./combat";
import type { Element } from "./types";

/** Le nom du cocktail EST un élément, dans les DEUX familles. Grammaire déjà présente
 *  dans les espèces d'origine ; trois manquaient au carré, ce test empêche qu'on le
 *  laisse incomplet à nouveau. */
const COCKTAIL_ELEMENT = {
  passaoh: "feu", malibout: "air", kouracao: "eau", morito: "terre",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;

const ARCHIS = {
  corailleur: "Corboyard l'Enigmatique",
  palmifleur_passaoh: "Palmiflette le Convivial",
  palmifleur_malibout: "Palmito le Menteur",
  palmifleur_morito: "Palmiche le Serein",
  palmifleur_kouracao: "Palmbytch la Bronzée",
  crustorail_passaoh: "Crusmeyer le Pervers",
  crustorail_malibout: "Crustensyl le Pragmatique",
  crustorail_morito: "Cruskof le Rustre",
  crustorail_kouracao: "Crustterus l'Organique",
} as const;

const zone = () => ZONES.find((z) => z.id === "grotte_hesque")!;
const especesDeLaZone = (): Set<string> => {
  const z = zone();
  return new Set([...z.pools.normales, ...z.pools.elite, ...z.pools.boss]
    .flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
};
const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire de la Grotte Hesque", () => {
  it("la zone aligne les 10 espèces du donjon 25 : le carré complet + Corailleur + boss", () => {
    // Il en manquait TROIS (Palmifleur Kouraçao, Crustorail Passaoh, Crustorail Malibout),
    // signalées par Adam le 2026-08-04 : le Bestiaire affichait un carré troué.
    const attendues = [
      "corailleur", "corailleur_magistral",
      ...(["passaoh", "malibout", "morito", "kouracao"] as const)
        .flatMap((c) => [`palmifleur_${c}`, `crustorail_${c}`]),
    ];
    expect([...especesDeLaZone()].sort()).toEqual(attendues.sort());
  });

  it("le nom du cocktail est un élément, dans les deux familles", () => {
    for (const [cocktail, element] of Object.entries(COCKTAIL_ELEMENT)) {
      for (const famille of ["palmifleur", "crustorail"]) {
        const id = `${famille}_${cocktail}`;
        expect(MONSTRES[id], `${id} manquant`).toBeTruthy();
        expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
        // annotation nécessaire : `?? {}` élargit le type et `{}` n'est pas indexable ;
        // et `ELEMENTS` est copié avant tri, `sort` mutant son tableau
        const res: Partial<Record<Element, number>> = MONSTRES[id].resistances ?? {};
        const meilleure = [...ELEMENTS].sort((a, b) => (res[b] ?? 0) - (res[a] ?? 0))[0];
        expect(meilleure, `${id} doit AUSSI résister en ${element}`).toBe(element);
      }
    }
  });

  it("les 9 espèces capturables portent des archis distincts", () => {
    const avecArchi = [...especesDeLaZone()].filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("les capturables apparaissent en pack NORMAL, sauf le Palmifleur Morito", () => {
    // Exception NOMMÉE et préexistante : le Morito (219 PV contre 113-123 pour ses
    // cousins) n'est qu'en élite et en donjon, donc son archi est enfermé derrière les
    // nœuds élite. Le déplacer changerait la difficulté d'un pack normal de T1, qui est
    // équilibrée — décision laissée à Adam. Toute AUTRE espèce enfermée est un bug.
    const ENFERME_ASSUME = ["palmifleur_morito"];
    const enNormal = new Set(zone().pools.normales
      .flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)));
    for (const id of [...especesDeLaZone()].filter((x) => MONSTRES[x].archiNom)) {
      if (ENFERME_ASSUME.includes(id)) {
        expect(enNormal.has(id), `${id} est l'exception assumée, il ne doit PAS être en normal`).toBe(false);
        continue;
      }
      expect(enNormal.has(id), `${id} est capturable mais absent des packs normaux`).toBe(true);
    }
  });

  it("les tailles de packs n'ont pas bougé — l'équilibrage de T1 est préservé", () => {
    // Les trois espèces manquantes ont été introduites par SUBSTITUTION de doublons, pas
    // en agrandissant les packs : mesuré au banc, les taux de victoire sont restés
    // identiques (100 % sur les trois packs normaux, élite et boss non touchés).
    const attendu = { hsk_1: 2, hsk_2: 3, hsk_3: 3, hsk_elite: 4, hsk_boss: 3 };
    for (const [id, n] of Object.entries(attendu)) {
      expect(COMBATS[id].ennemis, `${id}`).toHaveLength(n);
    }
  });

  it("aucune rencontre ne double une espèce", () => {
    const z = zone();
    for (const id of [...z.pools.normales, ...z.pools.elite, ...z.pools.boss]) {
      const e = COMBATS[id].ennemis.map((x) => x.monstre);
      expect(new Set(e).size, `${id} double une espèce`).toBe(e.length);
    }
  });
});
