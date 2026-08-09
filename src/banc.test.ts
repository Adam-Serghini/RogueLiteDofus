// =============================================================================
//  banc.test.ts — cœur du banc d'essai (module PUR, sans DOM) : construction du
//  héros et des mannequins, compteurs conditionnels, boucles de mesure.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  construireHeros, construireHerosDetaille, construireMannequins, mesurerLancer,
  mesurerTour, MAX_COMPTEURS, PV_MANNEQUIN, REPETITIONS,
} from "./banc";
import { SORTS } from "./data";
import { CLASSES, butinToile } from "./data";
import { statsFinales } from "./progression";
import { instanceDuTier } from "./run";

describe("construireHeros", () => {
  it("rend un combattant du bon niveau, aux caractéristiques de sa classe", () => {
    const h = construireHeros({ classeId: "iop", niveau: 50, toile: 1, equipement: "nu", rarete: "commun" });
    expect(h.niveau).toBe(50);
    expect(h.camp).toBe("joueur");
    const attendu = statsFinales(CLASSES.iop, { niveau: 50, xp: 0 });
    expect(h.stats.agilite).toBe(attendu.agilite);
  });

  it("l'équipement AUGMENTE les caractéristiques : set complet > nu", () => {
    const base = { classeId: "iop", niveau: 50, toile: 1, rarete: "commun" } as const;
    const nu = construireHeros({ ...base, equipement: "nu" });
    const set = construireHeros({ ...base, equipement: "set" });
    expect(set.pvMax).toBeGreaterThan(nu.pvMax);
  });

  it("le set complet porte plus de pièces que le mi-équipement", () => {
    const base = { classeId: "cra", niveau: 30, toile: 5, rarete: "commun" } as const;
    const mi = construireHeros({ ...base, equipement: "mi" });
    const set = construireHeros({ ...base, equipement: "set" });
    expect(set.pvMax).toBeGreaterThanOrEqual(mi.pvMax);
  });

  it("a des PA et un état de combat initialisés (sinon aucun sort n'est lançable)", () => {
    const h = construireHeros({ classeId: "iop", niveau: 1, toile: 1, equipement: "nu", rarete: "commun" });
    expect(h.paActuels).toBe(h.paMax);
    expect(h.paMax).toBeGreaterThanOrEqual(6);
    expect(h.effets).toEqual([]);
    expect(h.cooldowns).toEqual({});
  });

  it("porte le bouclier de départ du Bonnet Spairance (non-régression : combattantDepuisPerso l'écrase, il ne doit jamais être remis à 0 après)", () => {
    const bonnet = instanceDuTier("bonnet_spairance", "legendaire");
    expect(bonnet).not.toBeNull(); // sinon le test ne prouve rien
    const h = construireHeros({
      classeId: "iop", niveau: 50, toile: 10, equipement: "nu", rarete: "commun",
      surcharges: { coiffe: bonnet! },
    });
    expect(h.bouclier).toBeGreaterThan(0);
  });
});

// --- I3 : une toile sans butin rend un héros NU tout en affichant « Set complet »
describe("construireHerosDetaille", () => {
  it("dit combien de pièces ont RÉELLEMENT été équipées", () => {
    const d = construireHerosDetaille({ classeId: "iop", niveau: 50, toile: 1, equipement: "set", rarete: "commun" });
    expect(d.slotsEquipes.length).toBeGreaterThan(0);
    expect(d.heros.pvMax).toBeGreaterThan(0);
  });

  it("rend une liste VIDE sur une toile sans aucun objet, même en « Set complet »", () => {
    // la toile 13 (Clos des Blops) n'a aucun objet : les colonnes NU/MI/SET y
    // sont identiques par construction, et c'est ce que l'écran doit pouvoir dire
    expect(butinToile("clos_des_blops"), "l'assertion suivante suppose une toile sans butin").toBeNull();
    const d = construireHerosDetaille({ classeId: "iop", niveau: 50, toile: 13, equipement: "set", rarete: "commun" });
    expect(d.slotsEquipes).toEqual([]);
  });

  it("compte aussi les surcharges manuelles", () => {
    const arme = instanceDuTier("baguette_du_tofu", "commun")!;
    const d = construireHerosDetaille({
      classeId: "iop", niveau: 50, toile: 13, equipement: "nu", rarete: "commun",
      surcharges: { arme },
    });
    expect(d.slotsEquipes).toEqual(["arme"]);
  });
});

describe("construireMannequins", () => {
  it("place les mannequins aux positions demandées, dans le camp ennemi", () => {
    const m = construireMannequins([{ position: 0 }, { position: 4 }]);
    expect(m.map((x) => x.position)).toEqual([0, 4]);
    expect(m.every((x) => x.camp === "ennemi")).toBe(true);
    expect(new Set(m.map((x) => x.ref)).size).toBe(2); // refs uniques
  });

  it("leur donne des PV assez grands pour ne jamais mourir pendant une mesure", () => {
    const [m] = construireMannequins([{ position: 0 }]);
    expect(m.pvActuels).toBe(PV_MANNEQUIN);
    expect(m.pvMax).toBe(PV_MANNEQUIN);
  });

  it("applique les résistances demandées, 0 par défaut", () => {
    const [avecRes, sansRes] = construireMannequins([
      { position: 0, resistances: { feu: 0.5 } },
      { position: 1 },
    ]);
    expect(avecRes.resistances.feu).toBe(0.5);
    expect(sansRes.resistances).toEqual({});
  });

  it("ne peut pas esquiver : l'esquive brouillerait la mesure", () => {
    const [m] = construireMannequins([{ position: 0 }]);
    expect(m.stats.agilite).toBe(0);
  });
});

const heros = (classeId: string, niveau = 50) =>
  construireHeros({ classeId, niveau, toile: 1, equipement: "nu", rarete: "commun" });

describe("REPETITIONS", () => {
  it("est une valeur unique, exportée, jamais recopiée dans les mesures", () => {
    expect(REPETITIONS).toBe(500);
  });
});

describe("mesurerLancer", () => {
  it("mesure des dégâts non nuls et cohérents (min ≤ moyenne ≤ max)", () => {
    const m = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    expect(m.lancable).toBe(true);
    expect(m.moyenne).toBeGreaterThan(0);
    expect(m.min).toBeLessThanOrEqual(m.moyenne);
    expect(m.moyenne).toBeLessThanOrEqual(m.max);
  });

  it("est DÉTERMINISTE : deux appels identiques rendent le même chiffre", () => {
    const a = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    const b = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    expect(a.moyenne).toBe(b.moyenne);
  });

  it("compte l'ÉCLABOUSSURE : Zénith frappe plus fort sur 3 mannequins que sur 1", () => {
    const un = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    const trois = mesurerLancer(heros("iop"), "zenith",
      construireMannequins([{ position: 0 }, { position: 1 }, { position: 2 }]));
    expect(trois.moyenne).toBeGreaterThan(un.moyenne);
  });

  it("les résistances de la cible font baisser les dégâts", () => {
    const nu = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    const dur = mesurerLancer(heros("iop"), "zenith",
      construireMannequins([{ position: 0, resistances: { air: 0.5, eau: 0.5 } }]));
    expect(dur.moyenne).toBeLessThan(nu.moyenne);
  });

  it("ne remet PAS en cause l'état du héros entre deux mesures (compteurs remis à zéro)", () => {
    const h = heros("iop");
    const m1 = mesurerLancer(h, "pugilat", construireMannequins([{ position: 0 }]));
    const m2 = mesurerLancer(h, "pugilat", construireMannequins([{ position: 0 }]));
    // l'escalade de Pugilat ne doit PAS fuiter d'une mesure à l'autre
    expect(m2.moyenne).toBe(m1.moyenne);
  });

  it("signale un sort non lançable dans l'état courant plutôt que d'afficher 0", () => {
    // Kaboom exige au moins une bombe posée sur un ennemi
    const m = mesurerLancer(heros("roublard"), "kaboom", construireMannequins([{ position: 0 }]));
    expect(m.lancable).toBe(false);
    expect(m.moyenne).toBe(0);
  });

  it("marque les sorts dont une part des dégâts échappe à la mesure (poison)", () => {
    const m = mesurerLancer(heros("eliotrope"), "parasite", construireMannequins([{ position: 0 }]));
    expect(m.raisons).toContain("poison"); // Parasite poisonne à 3+ portails
  });

  it("remonte le coût EFFECTIF, pour que le « par PA » ne soit pas divisé par une seconde vérité", () => {
    const m = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    expect(m.cout).toBe(SORTS.zenith.coutPA);
    // même sur un sort refusé, le diviseur reste utilisable (jamais 0/undefined)
    const refuse = mesurerLancer(heros("roublard"), "kaboom", construireMannequins([{ position: 0 }]));
    expect(refuse.lancable).toBe(false);
    expect(refuse.cout).toBeGreaterThan(0);
  });

  // --- I1 : les sorts à dégâts DIFFÉRÉS ne doivent pas passer pour des sorts faibles
  it("signale un PIÈGE du Sram : son jet n'est lu qu'au déclenchement, jamais à la pose", () => {
    for (const id of ["piege_funeste", "piege_a_fragmentation"]) {
      const m = mesurerLancer(heros("sram"), id, construireMannequins([{ position: 0 }]));
      expect(m.moyenne, id).toBe(0); // constat : la pose ne frappe pas
      expect(m.raisons, id).toContain("piege"); // …et le banc le DIT
    }
  });

  it("signale la Bombe collante : elle ne frappe qu'au Kaboom", () => {
    const m = mesurerLancer(heros("roublard"), "bombe_collante", construireMannequins([{ position: 0 }]));
    expect(m.moyenne).toBe(0);
    expect(m.raisons).toContain("bombe");
  });

  it("signale un sort de Lance mesuré SANS Lance plantée", () => {
    const m = mesurerLancer(heros("forgelance"), "jormun", construireMannequins([{ position: 0 }]));
    expect(m.raisons).toContain("lance_absente");
  });

  it("une Lance plantée en rangée ARRIÈRE rend sa signature à Jormun (qui frappe alors tout le monde)", () => {
    const cibles = () => construireMannequins([{ position: 0 }, { position: 1 }, { position: 5 }]);
    const sans = mesurerLancer(heros("forgelance"), "jormun", cibles());
    const avec = mesurerLancer(heros("forgelance"), "jormun", cibles(), { lance: "arriere" });
    expect(avec.raisons).not.toContain("lance_absente");
    // sans Lance, Jormun se résout comme une simple rangée ; avec une Lance en
    // rangée arrière (`tousSiLanceArriere`), il touche TOUS les ennemis
    expect(avec.moyenne).toBeGreaterThan(sans.moyenne);
  });

  it("ne signale rien pour un sort dont la mesure est complète", () => {
    const m = mesurerLancer(heros("iop"), "zenith", construireMannequins([{ position: 0 }]));
    expect(m.raisons).toEqual([]);
  });

  // --- M1 : les deux compteurs conditionnels qui n'avaient aucun test
  it("les portails majorent un sort de dégâts de l'Éliotrope", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const sans = mesurerLancer(heros("eliotrope"), "parasite", cibles());
    const avec = mesurerLancer(heros("eliotrope"), "parasite", cibles(), { portails: 4 });
    expect(avec.moyenne).toBeGreaterThan(sans.moyenne);
  });

  it("la Rage majore un sort de dégâts de l'Ouginak", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const sans = mesurerLancer(heros("ouginak"), "depouille", cibles());
    const avec = mesurerLancer(heros("ouginak"), "depouille", cibles(), { rage: 3 });
    expect(avec.moyenne).toBeGreaterThan(sans.moyenne);
  });

  // --- M4 : un compteur saisi au-delà du plafond du moteur mesurerait un état
  // que le jeu ne peut pas produire
  it("borne les compteurs conditionnels aux plafonds du moteur", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const auCap = mesurerLancer(heros("eliotrope"), "parasite", cibles(), { portails: MAX_COMPTEURS.portails });
    const absurde = mesurerLancer(heros("eliotrope"), "parasite", cibles(), { portails: 50 });
    expect(absurde.moyenne).toBe(auCap.moyenne);

    const telefragCap = mesurerLancer(heros("xelor"), "rayon_obscur", cibles(), { telefrags: MAX_COMPTEURS.telefrags });
    const telefragAbsurde = mesurerLancer(heros("xelor"), "rayon_obscur", cibles(), { telefrags: 50 });
    expect(telefragAbsurde.moyenne).toBe(telefragCap.moyenne);
  });

  // --- M8 : sans réglage, Zénith et Flèche Punitive sont lus barre pleine,
  // c'est-à-dire à leur MAXIMUM, sans que rien ne le dise
  it("le réglage « PA disponibles » fait varier les sorts qui en dépendent", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const maigre = mesurerLancer(heros("iop"), "zenith", cibles(), { paDispo: 4 });
    const pleine = mesurerLancer(heros("iop"), "zenith", cibles());
    expect(maigre.moyenne).toBeLessThan(pleine.moyenne);
  });

  it("« PA disponibles » n'affecte PAS un sort qui ne les lit pas", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const a = mesurerLancer(heros("iop"), "colere_de_iop", cibles(), { paDispo: 5 });
    const b = mesurerLancer(heros("iop"), "colere_de_iop", cibles());
    expect(a.moyenne).toBe(b.moyenne);
  });

  it("ne fait PAS fuiter les boucliers à durée d'une répétition à l'autre (boucliersTemporaires vidé)", () => {
    // Endurance (Iop) est un sort de DÉGÂTS qui pose en plus un bouclier à
    // durée sur le lanceur (`bouclierPortee`, cumulable si relancé dans le
    // même tour) — sa décrémentation vit dans `decrementerEffets`, jamais
    // appelé par `mesurerLancer`. Sans remise à zéro de `boucliersTemporaires`
    // au début de CHAQUE répétition, les 500 répétitions empileraient chacune
    // une entrée sur le MÊME objet `heros`, sans borne.
    const h = heros("iop");
    mesurerLancer(h, "endurance", construireMannequins([{ position: 0 }]));
    // la dernière répétition en pose au plus une (le sort n'est lancé qu'une
    // fois par répétition dans mesurerLancer) — jamais REPETITIONS.
    expect((h.boucliersTemporaires ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe("appliquerConditionnels", () => {
  it("les bombes rendent Kaboom lançable", () => {
    const h = heros("roublard");
    const cibles = construireMannequins([{ position: 0 }]);
    const m = mesurerLancer(h, "kaboom", cibles, { bombes: 3 });
    expect(m.lancable).toBe(true);
    expect(m.moyenne).toBeGreaterThan(0);
  });

  it("les Chausse-Trappes augmentent Attaque Mortelle", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const sans = mesurerLancer(heros("sram"), "attaque_mortelle", cibles());
    const avec = mesurerLancer(heros("sram"), "attaque_mortelle", cibles(), { chausseTrappe: 5 });
    expect(avec.moyenne).toBeGreaterThan(sans.moyenne);
  });

  it("les Téléfrags augmentent Rayon Obscur", () => {
    const cibles = () => construireMannequins([{ position: 0 }]);
    const sans = mesurerLancer(heros("xelor"), "rayon_obscur", cibles());
    const avec = mesurerLancer(heros("xelor"), "rayon_obscur", cibles(), { telefrags: 4 });
    expect(avec.moyenne).toBeGreaterThan(sans.moyenne);
  });
});

describe("mesurerTour", () => {
  it("rejoue le sort tant qu'il reste des PA, et compte les lancers", () => {
    // Pile ou Face : 3 PA, maxParTour 4 → 2 lancers dans 6 PA
    const t = mesurerTour(heros("ecaflip"), "pile_ou_face", construireMannequins([{ position: 0 }]));
    expect(t.lancers).toBe(2);
    expect(t.total).toBeGreaterThan(0);
  });

  it("respecte maxParTour", () => {
    // Bluff : 4 PA, maxParTour 1 → un seul lancer même si les PA le permettaient
    const t = mesurerTour(heros("ecaflip"), "bluff", construireMannequins([{ position: 0 }]));
    expect(t.lancers).toBe(1);
  });

  it("laisse l'escalade courir : le total d'un tour de Pugilat dépasse 3 lancers isolés", () => {
    const cibles = () => construireMannequins([{ position: 0 }, { position: 1 }, { position: 2 }]);
    const isole = mesurerLancer(heros("iop"), "pugilat", cibles());
    const tour = mesurerTour(heros("iop"), "pugilat", cibles());
    expect(tour.lancers).toBeGreaterThan(1);
    expect(tour.total).toBeGreaterThan(isole.moyenne * tour.lancers);
  });
});
