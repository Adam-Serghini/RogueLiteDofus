// =============================================================================
//  wabbit.test.ts — Terrier du Wa Wabbit (zone 5 de la Tranche 2)
//  bestiaire, riposte ennemie (mécanique dormante réveillée), budget de PA.
// =============================================================================
import { describe, it, expect } from "vitest";
import { MONSTRES, SORTS } from "./data";

const ELEMENT_DE = {
  wabbit: "terre", black_wabbit: "feu", tiwabbit: "air", tiwabbit_kiafin: "eau",
  wo_wabbit: "air", grand_pa_wabbit: "terre",
  tiwobot: "feu", wobot: "terre", wa_wabbit: "air", wa_wobot: "terre",
} as const;
const STAT_DE_ELEMENT = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" } as const;

const ARCHIS = {
  tiwabbit: "Tiwalpé le Dévêtu",
  tiwabbit_kiafin: "Tiwoflan le Lâche",
  wabbit: "Wabbitud le Constant",
  black_wabbit: "Wagnagnah le Sanglant",
  wo_wabbit: "Wokènrôl le Danseur",
  grand_pa_wabbit: "Grandilok le Clameur",
} as const;

const dominante = (id: string): string => {
  const stats = MONSTRES[id].stats as unknown as Record<string, number>;
  return Object.entries(stats).filter(([k]) => k !== "vitalite").sort((a, b) => b[1] - a[1])[0][0];
};

describe("bestiaire du Terrier du Wa Wabbit", () => {
  it("les 10 espèces existent et frappent dans leur élément", () => {
    for (const [id, element] of Object.entries(ELEMENT_DE)) {
      const m = MONSTRES[id];
      expect(m, `${id} manquant`).toBeTruthy();
      expect(dominante(id), `${id} doit dominer en ${element}`).toBe(STAT_DE_ELEMENT[element]);
    }
  });

  it("6 espèces sur 10 sont capturables, avec des archis tous distincts", () => {
    const avecArchi = Object.keys(ELEMENT_DE).filter((id) => MONSTRES[id].archiNom);
    expect(avecArchi.sort()).toEqual(Object.keys(ARCHIS).sort());
    for (const [id, nom] of Object.entries(ARCHIS)) expect(MONSTRES[id].archiNom).toBe(nom);
    // Metamob ne référence AUCUN archimonstre wobot — vérifié. Les quatre robots
    // (dont les deux boss) n'en portent donc pas, et c'est intentionnel.
    const noms = avecArchi.map((id) => MONSTRES[id].archiNom);
    expect(new Set(noms).size, "deux espèces ne peuvent pas partager un archi").toBe(noms.length);
  });

  it("le lapin est fragile et le robot est blindé", () => {
    for (const id of ["tiwobot", "wobot", "wa_wobot"]) {
      const r = MONSTRES[id].resistances ?? {};
      const valeurs = (["terre", "feu", "air", "eau"] as const).map((e) => r[e] ?? 0);
      // blindage = une résistance PLATE, pas un pic élémentaire : le Clos des Blops
      // enseigne déjà le puzzle des couleurs, le Terrier ne le rejoue pas.
      expect(new Set(valeurs).size, `${id} doit être blindé uniformément`).toBe(1);
      expect(valeurs[0], `${id} doit être plus résistant qu'un lapin`).toBeGreaterThanOrEqual(0.2);
    }
    for (const id of Object.keys(ARCHIS)) {
      const r = MONSTRES[id].resistances ?? {};
      const max = Math.max(...(["terre", "feu", "air", "eau"] as const).map((e) => r[e] ?? 0));
      expect(max, `${id} (lapin) ne doit pas être blindé comme un robot`).toBeLessThan(0.25);
    }
  });
});

describe("les sorts du Terrier", () => {
  it("la riposte mécanique arme son propre lanceur", () => {
    // `contre` existe dans le moteur depuis le Duel du Sram et le Sabre Shodanwa,
    // mais AUCUN ennemi n'avait jamais riposté. Le sort est de type `degats` — donc
    // jouable par `iaAgressif`, qui ignore les buffs — et la posture passe par
    // `effetLanceur`, appliqué au lanceur dans le chemin des sorts de dégâts.
    for (const id of ["riposte_mecanique", "contre_mesure"]) {
      const s = SORTS[id];
      expect(s, `${id} manquant`).toBeTruthy();
      expect(s.type).toBe("degats");
      expect(s.effetLanceur?.stat, `${id} doit poser une posture de contre`).toBe("contre");
      expect(s.effetLanceur!.valeur).toBeGreaterThan(0);
      expect(s.effetLanceur!.duree).toBeGreaterThan(0);
    }
  });

  it("la contre-mesure du boss est strictement plus forte que la riposte de base", () => {
    const petite = SORTS.riposte_mecanique.effetLanceur!;
    const grande = SORTS.contre_mesure.effetLanceur!;
    expect(grande.valeur * grande.duree).toBeGreaterThan(petite.valeur * petite.duree);
  });

  it("riposte_mecanique est limitée à un lancer par tour", () => {
    // Le Wobot a 8 PA et deux sorts à 4. `iaAgressif` n'a aucune mémoire du tour :
    // sans ce champ il rejouerait la posture et l'EMPILERAIT (sommeEffet additionne
    // les valeurs de `contre`), rendant `morsure` inatteignable. Bug du Kolérat.
    expect(SORTS.riposte_mecanique.maxParTour).toBe(1);
  });

  it("le caprice royal balaie une rangée et lui retire des PA", () => {
    const s = SORTS.caprice_royal;
    expect(s.zoneLigne).toBe(true);
    expect(s.retraitPA).toBeGreaterThan(0);
    expect(s.cooldownTours).toBe(2);
  });
});
