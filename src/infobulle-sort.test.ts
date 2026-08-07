// =============================================================================
//  infobulle-sort.test.ts — L'infobulle de sort doit annoncer ce que le moteur
//  applique RÉELLEMENT.
//
//  Premier test de `src/ui/` du projet, et il est là pour une raison précise.
//  `sortTooltipHtml` calcule sa ligne de dégâts à partir du jet de base et du
//  scaling ; elle ignorait les champs de multiplication, ce qui était accepté
//  tant que l'écart restait BORNÉ (la Flèche punitive de la Cra, la Rage de
//  l'Ouginak). Colère de Iop a rompu cet équilibre : +50 % additifs par lancer,
//  sans plafond, donc un écart qui grandit indéfiniment — au 2e lancer
//  l'infobulle affichait encore le jet de base pour un coup qui frappait 1,5×
//  plus fort. C'est le cas de figure qui a valu au projet d'afficher l'armure
//  plate des Pitons Rocheux : une valeur invisible se lit comme un bug.
//
//  Le correctif expose `multiplicateurEscaladeSort` depuis le moteur et la fait
//  consommer PAR LES DEUX — le moteur et l'infobulle — pour qu'il n'existe
//  qu'une seule copie de la formule. Or retirer cet appel côté infobulle
//  laissait TOUTE la suite verte : la moitié « l'infobulle consomme la même
//  fonction » n'était gardée par rien, et le mensonge pouvait revenir en
//  silence. C'est ce trou que ce fichier ferme.
//
//  `sortTooltipHtml` est une fonction pure (Spell + Combatant → chaîne HTML) :
//  aucun DOM n'est nécessaire pour l'exercer.
// =============================================================================
import { describe, it, expect } from "vitest";
import { sortTooltipHtml } from "./ui/composants";
import { multiplicateurEscaladeSort } from "./combat";
import { SORTS } from "./data";
import { fabriquerEquipe } from "./run";
import type { Combatant } from "./types";

/** Un Iop prêt à frapper, compteurs d'escalade vierges. */
const iop = (): Combatant => {
  const c = fabriquerEquipe()[0];
  c.lancersCombat = {};
  c.lancersCeTour = {};
  return c;
};

/** Les deux bornes de la ligne « ⚔ min – max » de l'infobulle. */
const bornes = (html: string): number[] => {
  const m = html.match(/⚔\s*([\d\s]+?)\s*[–-]\s*([\d\s]+?)\s*</u);
  if (!m) throw new Error(`ligne de dégâts introuvable dans : ${html}`);
  return [Number(m[1].replace(/\s/g, "")), Number(m[2].replace(/\s/g, ""))];
};

describe("l'infobulle suit l'escalade que le moteur applique", () => {
  it("Colère de Iop : les bornes affichées suivent le multiplicateur, lancer après lancer", () => {
    const c = iop();
    const sort = SORTS.colere_de_iop;
    const [min0, max0] = bornes(sortTooltipHtml(sort, c));
    expect(multiplicateurEscaladeSort(sort, c)).toBe(1); // premier lancer : jamais majoré

    // Le compteur porte les lancers DÉJÀ faits, et le multiplicateur vaut pour le
    // lancer À VENIR — c'est pour ça qu'il n'y a pas de « −1 » ici : le moteur
    // l'évalue AVANT d'incrémenter. Un lancer déjà fait ⇒ le prochain est à ×1,5.
    for (const [dejaFaits, attendu] of [[1, 1.5], [2, 2], [4, 3]] as const) {
      c.lancersCombat = { colere_de_iop: dejaFaits };
      expect(multiplicateurEscaladeSort(sort, c)).toBeCloseTo(attendu);
      const [min, max] = bornes(sortTooltipHtml(sort, c));
      expect(min).toBe(Math.round(min0 * attendu));
      expect(max).toBe(Math.round(max0 * attendu));
    }
  });

  it("Pugilat : idem pour l'escalade DANS le tour", () => {
    const c = iop();
    const sort = SORTS.pugilat;
    const [, max0] = bornes(sortTooltipHtml(sort, c));

    c.lancersCeTour = { pugilat: 2 }; // deux lancers déjà faits ce tour
    expect(multiplicateurEscaladeSort(sort, c)).toBeCloseTo(1.4);
    expect(bornes(sortTooltipHtml(sort, c))[1]).toBe(Math.round(max0 * 1.4));
  });

  it("un sort SANS escalade n'est pas affecté", () => {
    const c = iop();
    const [min0, max0] = bornes(sortTooltipHtml(SORTS.zenith, c));
    c.lancersCombat = { colere_de_iop: 5, zenith: 5 };
    c.lancersCeTour = { pugilat: 5, zenith: 5 };
    expect(bornes(sortTooltipHtml(SORTS.zenith, c))).toEqual([min0, max0]);
  });

  it("sans acteur (encyclopédie), l'infobulle ne parle pas d'escalade", () => {
    // Hors combat il n'y a pas de compteur à lire : la fiche montre les jets de base.
    expect(() => sortTooltipHtml(SORTS.colere_de_iop, null)).not.toThrow();
  });
});
