// =============================================================================
//  config.test.ts — Réglages joueur : partie PURE (sans localStorage).
// =============================================================================
import { describe, it, expect } from "vitest";
import { rangClasse, ORDRE_DEFAUT } from "./config";
import { CLASSES } from "./data";
import { EQUIPE_DEPART } from "./run";

describe("rang de jeu par classe", () => {
  it("rend le rang déclaré", () => {
    expect(rangClasse({ iop: 3, cra: 1 }, "cra")).toBe(1);
    expect(rangClasse({ iop: 3, cra: 1 }, "iop")).toBe(3);
  });

  it("une classe absente passe en queue, sans planter", () => {
    // cas réel : sauvegarde antérieure à ce réglage, ou classe ajoutée depuis
    expect(rangClasse({ cra: 1 }, "xelor")).toBe(99);
    expect(rangClasse({}, "iop")).toBe(99);
  });

  it("les défauts couvrent TOUTES les classes du jeu", () => {
    // sinon une classe non listée se retrouverait silencieusement en queue
    for (const id of Object.keys(CLASSES)) {
      expect(ORDRE_DEFAUT[id], `classe sans rang par défaut : ${id}`).toBeTypeOf("number");
    }
  });

  it("les rangs par défaut sont tous distincts", () => {
    const rangs = Object.values(ORDRE_DEFAUT);
    expect(new Set(rangs).size).toBe(rangs.length);
  });

  it("les rangs par défaut reproduisent l'ordre de EQUIPE_DEPART", () => {
    // GARDE-FOU CRITIQUE : `fabriquerEquipe()` = `equipeCombattante(nouvelleRun())`,
    // et 35 destructurations positionnelles (`const [iop] = fabriquerEquipe()`) dans
    // 15 fichiers de test en dépendent. Si ce test casse, ce ne sont pas les défauts
    // qu'il faut changer sans réfléchir : c'est toute la suite qui teste alors une
    // autre classe que celle que ses variables nomment.
    const trie = [...EQUIPE_DEPART].sort((a, b) => rangClasse(ORDRE_DEFAUT, a) - rangClasse(ORDRE_DEFAUT, b));
    expect(trie).toEqual(EQUIPE_DEPART);
  });
});
