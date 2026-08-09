// =============================================================================
//  injection.test.ts — `appliquerContenuEdite` : remplace les tables du moteur
//  par le contenu en cours d'édition (banc d'essai de l'éditeur).
// =============================================================================
import { describe, it, expect, afterEach } from "vitest";
import { SORTS, MONSTRES, BUTIN_TOILES, butinToile, appliquerContenuEdite } from "./data";
import sortsLivres from "./content/sorts.json";
import monstresLivres from "./content/monstres.json";
import butinLivre from "./content/butin_toiles.json";

// chaque test remet les tables dans leur état livré : elles sont partagées par
// TOUTE la suite, une fuite ferait échouer des tests sans rapport avec cette tâche
afterEach(() => {
  appliquerContenuEdite({
    sorts: sortsLivres as never, monstres: monstresLivres as never,
    butin_toiles: butinLivre as never,
  });
});

describe("appliquerContenuEdite", () => {
  it("remplace la valeur d'un sort existant", () => {
    expect(SORTS.zenith.scaling).toBe(0.32);
    appliquerContenuEdite({ sorts: { ...sortsLivres, zenith: { ...SORTS.zenith, scaling: 9 } } as never });
    expect(SORTS.zenith.scaling).toBe(9);
  });

  it("ajoute une entrée absente des données livrées", () => {
    appliquerContenuEdite({ sorts: { ...sortsLivres, sort_neuf: { ...SORTS.zenith, id: "sort_neuf" } } as never });
    expect(SORTS.sort_neuf).toBeTruthy();
  });

  // le point qui distingue cette fonction d'un simple Object.assign
  it("fait DISPARAÎTRE une entrée supprimée dans le contenu édité", () => {
    const sansZenith = { ...sortsLivres } as Record<string, unknown>;
    delete sansZenith.zenith;
    appliquerContenuEdite({ sorts: sansZenith as never });
    expect(SORTS.zenith).toBeUndefined();
  });

  it("ne touche pas les tables absentes de l'objet passé", () => {
    const avant = MONSTRES.bouftou.pv;
    appliquerContenuEdite({ sorts: sortsLivres as never });
    expect(MONSTRES.bouftou.pv).toBe(avant);
  });

  // l'éditeur permet de DÉPLACER un objet d'une toile à l'autre : sans cette
  // table injectable, le banc d'essai équiperait toujours l'ancien butin, en
  // silence — un designer mesurerait l'arme qu'il vient justement de ranger ailleurs
  it("remplace aussi les pools de butin par toile", () => {
    const avant = butinToile("incarnam")!.normales;
    expect(avant).not.toContain("arc_des_rivages");
    appliquerContenuEdite({
      butin_toiles: {
        ...butinLivre,
        "1": { ...BUTIN_TOILES["1"], normales: [...avant, "arc_des_rivages"] },
      } as never,
    });
    expect(butinToile("incarnam")!.normales).toContain("arc_des_rivages");
  });

  it("conserve l'IDENTITÉ des tables (les modules qui les ont importées voient la mise à jour)", () => {
    const reference = SORTS; // ce que combat.ts détient depuis son import
    appliquerContenuEdite({ sorts: { ...sortsLivres, zenith: { ...SORTS.zenith, scaling: 7 } } as never });
    expect(reference.zenith.scaling).toBe(7);
  });
});
