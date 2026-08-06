// =============================================================================
//  element.test.ts — L'élément de frappe est CALCULÉ par cible, jamais stocké.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  elementsCandidats, elementsForts, elementDeFrappe, elementContre, degatsCible, statsEffectives, ELEMENTS,
} from "./combat";
import { combattantDepuisPerso, persoAuNiveau, fabriquerEnnemis } from "./run";
import { SORTS } from "./data";
import { statElement } from "./progression";
import type { Combatant, Element, Spell } from "./types";

const ctx = (rng = () => 0.99) => ({ rng, log: () => {}, playerDamageBonus: 1, combatants: [] as Combatant[] });

/** Cible nue dont on ne règle QUE les résistances. */
const cible = (res: Partial<Record<Element, number>>): Combatant => {
  const [m] = fabriquerEnnemis("inc_1");
  return { ...m, resistances: { ...res } };
};

describe("l'élément de frappe suit la cible", () => {
  it("une paire eau/air frappe EAU face à 10 % air et 0 % eau", () => {
    // Le cas d'origine. Aucune classe ne porte la paire eau/air (cf.
    // CLASSES-ELEMENTS.md), d'où le combattant synthétique : on teste la RÈGLE,
    // pas le roster.
    // Le Xélor porte réellement eau+terre : son agilité (air) est nulle en jeu. On
    // égalise agilité et chance ici pour isoler la règle testée (la résistance
    // départage à caractéristiques égales) — sinon la stat, pas la résistance,
    // déciderait toujours et le test ne prouverait rien.
    const heros = combattantDepuisPerso(persoAuNiveau("xelor", 50, 0));
    const eauAir: Combatant = {
      ...heros,
      elements: ["eau", "air"],
      stats: { ...heros.stats, agilite: heros.stats.chance ?? 0 },
    };
    expect(elementContre(eauAir, cible({ air: 0.1, eau: 0 }))).toBe("eau");
    expect(elementContre(eauAir, cible({ air: 0, eau: 0.1 }))).toBe("air");
  });

  it("sur une vraie classe : un feu/eau évite l'élément résisté", () => {
    const eni = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0)); // feu + eau
    expect(elementContre(eni, cible({ feu: 0.25, eau: 0 }))).toBe("eau");
    expect(elementContre(eni, cible({ feu: 0, eau: 0.25 }))).toBe("feu");
  });

  it("la caractéristique peut renverser la résistance", () => {
    // 10 % de résistance ne compense pas un gros écart de caractéristique : c'est
    // tout l'objet du critère « le plus de dégâts » plutôt que « le moins résisté ».
    const heros = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0));
    const buffe: Combatant = { ...heros, stats: { ...heros.stats, chance: heros.stats.chance! + 200 } };
    expect(elementContre(buffe, cible({ feu: 0, eau: 0.1 }))).toBe("eau");
  });

  it("ignoreResistances ramène le critère à la plus haute caractéristique", () => {
    const heros = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0));
    const plusFeu: Combatant = { ...heros, stats: { ...heros.stats, intelligence: heros.stats.intelligence + 50 } };
    const sortIgnore = { ...SORTS.morsure, ignoreResistances: true } as Spell;
    expect(elementContre(plusFeu, cible({ feu: 0.9, eau: 0 }), sortIgnore)).toBe("feu");
  });

  it("un monstre garde exactement l'élément qu'il avait", () => {
    // 177 espèces sur 187 sont mono-élément : la règle doit être INERTE pour elles,
    // sinon l'équilibrage de 24 zones bouge en silence. abr_elite (Domaine Ancestral)
    // est choisie précisément parce qu'AUCUNE de ses 5 espèces n'a de véritable
    // égalité de caractéristiques (contrairement à tai_1, dont le Boufton Blanc a
    // FORCE = AGILITÉ = 24 : ce n'est pas un mono-élément, une résistance de 50 % sur
    // l'élément arbitrairement choisi par le tri y basculerait légitimement vers
    // l'autre — la règle du test voisin, pas un bug). Sur les 181 espèces du jeu,
    // seules 6 ont une telle égalité : Boufton Blanc, le Kwakwa et ses 4 Kwakere —
    // aucune n'est dans ce pack, donc aucune exclusion à faire ici.
    const pack = fabriquerEnnemis("abr_elite");
    expect(pack.length).toBeGreaterThan(0); // le garde-fou ne doit jamais tourner à vide
    for (const m of pack) {
      const [p, s] = elementsForts(m);
      const se = statsEffectives(m);
      expect(statElement(se, p)).not.toBe(statElement(se, s)); // garde contre une future égalité silencieuse
      const avant = elementDeFrappe(m);
      expect(elementContre(m, cible({ [avant]: 0.5 }))).toBe(avant);
    }
  });

  it("le Kwakwaffe élargit le choix aux quatre éléments", () => {
    const heros = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0)); // feu + eau
    expect(elementsCandidats(heros)).toEqual(["feu", "eau"]);
    const libre: Combatant = { ...heros, elementLibre: true };
    expect(elementsCandidats(libre)).toEqual(ELEMENTS);
  });

  it("le choix ne consomme AUCUN tirage supplémentaire", () => {
    // Sinon toute la séquence aléatoire d'un combat décale, et les tests à graine
    // fixe du reste du projet deviennent faux sans qu'on sache pourquoi.
    const heros = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0));
    let appels = 0;
    const compteur = () => { appels += 1; return 0.5; };
    degatsCible(heros, SORTS.morsure, cible({ feu: 0.2 }),
      { useMax: false, mult: 1, ctx: ctx(compteur) });
    // esquive + jet + critique = 3 tirages, comme avant le changement
    expect(appels).toBe(3);
  });

  it("le ResultatDegats.element est bien celui CHOISI pour cette cible, pas l'élément aveugle", () => {
    // Remplacer `element: el` par `element: elementDeFrappe(lanceur)` dans degatsAvec
    // (réintroduisant le choix aveugle à la cible que cette tâche supprime) ne ferait
    // échouer AUCUN autre test du fichier : il faut une assertion sur la VALEUR réelle,
    // pas seulement sur l'égalité de deux appels identiques (cf. test suivant).
    const heros = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0)); // feu + eau
    const c = cible({ feu: 0.8, eau: 0 }); // feu fortement résisté → le choix doit basculer sur eau
    const r = degatsCible(heros, SORTS.morsure, c, { useMax: false, mult: 1, ctx: ctx(() => 0.5) });
    expect(r.element).toBe("eau");
    // elementDeFrappe(heros), lui, ignore la cible : sans résistance il retiendrait
    // la meilleure caractéristique BRUTE — ici pas nécessairement "eau". La preuve que
    // ResultatDegats.element suit la CIBLE (et non l'aveugle) tient à ce contraste.
  });

  it("le résultat est déterministe à graine fixe", () => {
    const heros = combattantDepuisPerso(persoAuNiveau("eniripsa", 50, 0));
    const c = cible({ feu: 0.2, eau: 0.05 });
    const a = degatsCible(heros, SORTS.morsure, c, { useMax: false, mult: 1, ctx: ctx(() => 0.5) });
    const b = degatsCible(heros, SORTS.morsure, c, { useMax: false, mult: 1, ctx: ctx(() => 0.5) });
    expect(a.element).toBe(b.element);
    expect(a.dmg).toBe(b.dmg);
  });
});
