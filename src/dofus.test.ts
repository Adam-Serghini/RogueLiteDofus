// =============================================================================
//  dofus.test.ts — effets des reliques : modèle, données, déclenchements.
// =============================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { DOFUS } from "./data";
import { chargerMeta, ajouterDofus, bonusEquipe, reliquesActives, meilleurJet } from "./run";
import type { Meta } from "./types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const metaVide = (): Meta => ({ version: 3, dofus: [], archis: [], runs: 0, victoires: 0 });

describe("modèle des reliques", () => {
  beforeEach(() => store.clear());

  it("une sauvegarde en chaînes est convertie en exemplaires", () => {
    store.set("rld_meta_v0", JSON.stringify({
      version: 2, dofus: ["dofus_pourpre", "dofus_pourpre", "dofawa"],
      archis: [], runs: 1, victoires: 0,
    }));
    const meta = chargerMeta();
    expect(meta.dofus).toEqual([
      { id: "dofus_pourpre" }, { id: "dofus_pourpre" }, { id: "dofawa" },
    ]);
    expect(meta.version).toBe(3);
  });

  it("la conversion ne passe QU'UNE FOIS", () => {
    store.set("rld_meta_v0", JSON.stringify({ version: 2, dofus: ["dofawa"], archis: [], runs: 0, victoires: 0 }));
    const meta = chargerMeta();
    ajouterDofus(meta, "dofus_pourpre"); // persiste en version 3
    expect(chargerMeta().dofus).toEqual([{ id: "dofawa" }, { id: "dofus_pourpre" }]);
  });

  it("les exemplaires supplémentaires n'ajoutent RIEN à l'effet", () => {
    const un = metaVide(); un.dofus = [{ id: "dofus_ebene" }];
    const trois = metaVide(); trois.dofus = [{ id: "dofus_ebene" }, { id: "dofus_ebene" }, { id: "dofus_ebene" }];
    expect(bonusEquipe(trois)).toEqual(bonusEquipe(un));
  });

  it("reliquesActives dédoublonne", () => {
    const meta = metaVide();
    meta.dofus = [{ id: "dofawa" }, { id: "dofawa" }, { id: "dofus_ivoire" }];
    expect([...reliquesActives(meta)].sort()).toEqual(["dofawa", "dofus_ivoire"]);
  });

  it("meilleurJet retient le plus haut, undefined si la relique est absente", () => {
    const meta = metaVide();
    meta.dofus = [{ id: "dofus_kaliptus", jet: 7 }, { id: "dofus_kaliptus", jet: 22 }, { id: "dofus_kaliptus", jet: 3 }];
    expect(meilleurJet(meta, "dofus_kaliptus")).toBe(22);
    expect(meilleurJet(meta, "dofawa")).toBeUndefined();
  });

  it("aucune relique ne déclare plus d'effet PAR COPIE", () => {
    // Le modèle par copie et son plafond `maxCopies` ont disparu : leur survivance
    // dans les données ferait croire à un cumul qui n'existe plus.
    for (const d of Object.values(DOFUS)) {
      expect(d, d.id).not.toHaveProperty("bonusDegatsParCopie");
      expect(d, d.id).not.toHaveProperty("maxCopies");
    }
  });
});
