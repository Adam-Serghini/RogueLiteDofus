// =============================================================================
//  sim.ts — Harnais d'ÉQUILIBRAGE (headless, hors `npm test`).
//  Lancer : `npm run sim`  (vitest --config vitest.sim.config.ts)
//
//  Il mesure un PARCOURS DE ZONE, pas une rencontre isolée : c'est l'attrition
//  qui fait la difficulté de ce jeu (les PV persistent d'un nœud au suivant, la
//  taverne est le seul soin). Un boss gagné à 100 % depuis des PV pleins peut
//  être un wipe quand on y arrive à 45 % après six nœuds et une élite — ce que la
//  mesure par rencontre ne pouvait pas voir.
//
//  MODÈLE DE PARCOURS (par zone, calqué sur `main.ts`) : 6 combats normaux + 1
//  élite dans un ordre tiré, UNE taverne à position tirée, puis le donjon. Les PV
//  se reportent de combat en combat, l'équipe entre à 100 % (soin de fin de zone
//  précédente), l'XP monte en route, et rencontres comme salle de boss sont tirées
//  dans les pools de la zone à chaque parcours.
//
//  LOADOUTS : plus de colonne « nu » — personne n'est nu à un boss, et elle
//  pilotait les drapeaux. À la place, deux cas RÉALISTES qui encadrent la vérité :
//  ATTENDU (4 pièces de la toile, rareté tirée aux vrais poids 60/25/12/3) et
//  MALCHANCE (2 pièces, commun seulement).
//
//  LIMITES : `controllerIA` ne joue que les sorts de dégâts (le plus cher d'abord)
//  et soigne de façon optimale — il ignore buffs, placements et séquences de PA,
//  c'est-à-dire l'essentiel des onze kits reworkés. Le sim est donc un PLANCHER,
//  informatif dans UN SEUL SENS : un `clear` élevé prouve que la zone est facile,
//  un `clear` bas ne prouve pas qu'elle est trop dure.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  ASCENSION, TRANCHES, zonesDeTranche, offsetToile, CLASSES, XP_PAR_TYPE,
  xpEffective, SORTS, butinToile,
  type TrancheDef, type ZoneDef,
} from "./data";

import { runCombat, controllerIA } from "./combat";
import { progressionInitiale, STAT_PAR_ELEMENT } from "./progression";
import {
  nouvelleRun, equipeCombattante, fabriquerEnnemis, pvMaxPerso, appliquerModificateursElite,
  instanceDuTier, rollItemRarete, persoAuNiveau, effetsAscension, appliquerAscensionEnnemis,
  especesNormalesDeZone, meilleurItemToile, synchroniserPV, soignerEquipe,
  tavernePctAscension, gagnerXPPerso, sansNoeudsDeZone,
  type RunState,
} from "./run";
import { mulberry32 } from "./rng";
import type { EquipSlot } from "./types";

// Tranches mesurées, dans l'ordre d'affichage. T1 doit TOUJOURS rester mesurée en
// premier (garde-fou anti-régression : ses chiffres servent de référence d'un run
// de sim à l'autre) ; ajouter des ids ici pour en mesurer d'autres.
const TRANCHES_MESUREES: TrancheDef[] = [TRANCHES[0], TRANCHES[1]];

// --- Paramètres (tunables) ---------------------------------------------------
// SIM_TANK=1 → config « tortue » positionnelle : Feca seul devant, le reste derrière.
const TANK = !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SIM_TANK;
const TEAM: Array<{ classe: string; pos?: number }> = TANK
  ? [
    { classe: "feca", pos: 0 },
    { classe: "iop", pos: 4 },
    { classe: "cra", pos: 5 },
    { classe: "eniripsa", pos: 6 },
  ]
  : [
    { classe: "iop" },
    { classe: "cra" },
    { classe: "eniripsa" },
    { classe: "ecaflip" }, // la sadida est désactivée
  ];
const IDS = TEAM.map((t) => t.classe);

const N = 100;             // parcours par (zone × loadout) pour le rapport principal
const N_ASC = 60;          // parcours par (zone × cran) pour le tableau d'Ascension
const COMBATS_PAR_ZONE = 6; // nœuds « combat » d'un parcours moyen (plateau ~10-12 rangées)
const ELITES_PAR_ZONE = 1;

const SLOTS_SIM: EquipSlot[] = ["arme", "coiffe", "cape", "anneau"];

type Loadout = "attendu" | "malchance";
const NB_PIECES: Record<Loadout, number> = { attendu: 4, malchance: 2 };

const estSoutien = (classeId: string): boolean =>
  CLASSES[classeId].sorts.some((id) => SORTS[id]?.type === "soin");

/** Niveau d'ENTRÉE de chaque zone d'une tranche. Le niveau ne se fige plus en
 *  sortie de zone : le parcours simulé fait monter l'XP lui-même, exactement comme
 *  le jeu. Départ, cap et xpMult viennent tous de `TrancheDef`, la numérotation de
 *  toile est continue via `offsetToile` — mêmes formules que le jeu réel, et le
 *  donjon ne rapporte PAS d'XP (voir `case "donjon"` de `resoudreType`, main.ts). */
function niveauxDEntree(tranche: TrancheDef, zones: ZoneDef[]): number[] {
  const sonde = persoAuNiveau(IDS[0], tranche.niveaux[0], 0);
  const offset = offsetToile(tranche.id);
  const entree: number[] = [];
  for (let z = 0; z < zones.length; z++) {
    entree.push(sonde.progression.niveau);
    const toile = offset + z + 1;
    for (let i = 0; i < COMBATS_PAR_ZONE; i++)
      gagnerXPPerso(sonde, xpEffective(XP_PAR_TYPE.combat, toile, tranche.id), tranche.id);
    for (let i = 0; i < ELITES_PAR_ZONE; i++)
      gagnerXPPerso(sonde, xpEffective(XP_PAR_TYPE.combat_dur, toile, tranche.id), tranche.id);
  }
  return entree;
}

/** Équipe de référence au niveau donné, équipée selon le loadout.
 *
 *  ATTENDU tire la rareté de chaque pièce au vrai tirage (`rollItemRarete`, poids
 *  60/25/12/3) : le stuff varie donc d'un parcours à l'autre, et la moyenne sur N
 *  intègre la chance de drop au lieu de figer tout le monde en commun — l'ancien
 *  banc mesurait le PIRE palier en l'appelant « set complet ». */
function equipeReference(niveau: number, zoneId: string, loadout: Loadout, ascension: number, trancheId: string, rng: () => number): RunState {
  const run = nouvelleRun(IDS, ascension, trancheId);
  const pool = butinToile(zoneId)?.normales ?? null;
  run.persos.forEach((perso, i) => {
    perso.progression = { ...progressionInitiale(), niveau };
    if (TEAM[i].pos !== undefined) perso.position = TEAM[i].pos!;
    if (pool) {
      // `statPref` ne départage en réalité rien (aucun objet ne porte de ligne de
      // caractéristique élémentaire sèche) mais reste la clé de `meilleurItemToile`.
      const statPref = STAT_PAR_ELEMENT[CLASSES[TEAM[i].classe].elements[0]];
      for (const slot of SLOTS_SIM.slice(0, NB_PIECES[loadout])) {
        const id = meilleurItemToile(pool, slot, statPref);
        if (!id) continue;
        const inst = loadout === "attendu" ? rollItemRarete(id, rng) : instanceDuTier(id, "commun");
        if (inst) perso.equipement[slot] = inst;
      }
    }
    perso.pvActuels = pvMaxPerso(perso); // l'équipe entre dans la zone à 100 %
  });
  return run;
}

// --- Simulation d'un PARCOURS de zone ----------------------------------------
interface BilanZone {
  clear: number;        // fraction de parcours menés jusqu'au bout
  pvDonjon: number;     // PV d'équipe moyens à l'entrée du donjon (parcours qui y arrivent)
  pvFin: number;        // PV d'équipe moyens après le donjon (parcours réussis)
  koDonjon: number;     // héros à 0 PV en moyenne à l'entrée du donjon
  wipes: Map<string, number>; // où ça casse, par étiquette d'étape
}

type Etape =
  | { genre: "combat" | "combat_dur" | "donjon"; combatId: string }
  | { genre: "taverne" };

/** Construit le parcours d'un tirage : 6 combats + 1 élite dans un ordre tiré, une
 *  taverne à position tirée (sauf si l'Ascension la supprime), puis le donjon.
 *  Les rencontres sont tirées dans les pools, comme la génération de carte le fait. */
function construireParcours(zone: ZoneDef, run: RunState, rng: () => number): Etape[] {
  const pioche = (pool: readonly string[]): string => pool[Math.floor(rng() * pool.length)];
  const combats: Etape[] = [];
  for (let i = 0; i < COMBATS_PAR_ZONE; i++)
    combats.push({ genre: "combat", combatId: pioche(zone.pools.normales) });
  for (let i = 0; i < ELITES_PAR_ZONE; i++) {
    const pool = zone.pools.elite.length ? zone.pools.elite : zone.pools.normales;
    // l'élite se place à un rang tiré : la rencontrer tôt ou tard ne coûte pas pareil
    combats.splice(Math.floor(rng() * (combats.length + 1)), 0, { genre: "combat_dur", combatId: pioche(pool) });
  }
  // `sansNoeudsDeZone` est la SOURCE UNIQUE lue aussi par la génération de carte :
  // à l'Ultime, une équipe au complet n'a plus aucune taverne.
  if (!sansNoeudsDeZone(run, zone).includes("taverne"))
    combats.splice(Math.floor(rng() * (combats.length + 1)), 0, { genre: "taverne" });
  combats.push({ genre: "donjon", combatId: pioche(zone.pools.boss) });
  return combats;
}

async function simulerZone(
  zone: ZoneDef, tranche: TrancheDef, niveau: number, toile: number,
  loadout: Loadout, ascension: number, seed0: number, nbParcours: number,
): Promise<BilanZone> {
  const eff = effetsAscension(ascension);
  const especesZone = especesNormalesDeZone(zone);
  let clears = 0, pvDonjonTot = 0, nbArrivesDonjon = 0, pvFinTot = 0, koTot = 0;
  const wipes = new Map<string, number>();

  for (let i = 0; i < nbParcours; i++) {
    const rng = mulberry32((seed0 + i * 0x9e3779b9) >>> 0);
    const run = equipeReference(niveau, zone.id, loadout, ascension, tranche.id, rng);
    const parcours = construireParcours(zone, run, rng);

    const pvEquipe = (): number => {
      const cur = run.persos.reduce((s, p) => s + Math.max(0, p.pvActuels), 0);
      const max = run.persos.reduce((s, p) => s + pvMaxPerso(p), 0);
      return max ? cur / max : 0;
    };

    let vivant = true;
    for (const etape of parcours) {
      if (etape.genre === "taverne") {
        soignerEquipe(run, tavernePctAscension(ascension));
        continue;
      }
      if (etape.genre === "donjon") {
        nbArrivesDonjon++;
        pvDonjonTot += pvEquipe();
        koTot += run.persos.filter((p) => p.pvActuels <= 0).length;
      }
      const equipe = equipeCombattante(run);
      run.persos.forEach((p, j) => { if (estSoutien(p.classeId)) equipe[j].ia = "soutien"; });
      const ennemis = fabriquerEnnemis(etape.combatId);
      // comme en jeu : le renfort d'Ascension rejoint la meute AVANT le modificateur
      // d'élite, sinon il y échapperait
      appliquerAscensionEnnemis(ennemis, eff, { type: etape.genre, especesZone, rng });
      if (etape.genre === "combat_dur") appliquerModificateursElite(ennemis, rng, undefined);
      const cs = [...equipe, ...ennemis];
      const win = await runCombat(cs, {
        controllers: { joueur: controllerIA, ennemi: controllerIA },
        rng,
        log: () => {},
        enemyDamageBonus: eff.degatsMult ?? 1,
      });
      synchroniserPV(run, cs);
      if (!win) {
        const cle = etape.genre === "donjon" ? "donjon" : `${etape.genre}:${etape.combatId}`;
        wipes.set(cle, (wipes.get(cle) ?? 0) + 1);
        vivant = false;
        break;
      }
      // le donjon ne rapporte pas d'XP en jeu, et la zone s'arrête juste après
      if (etape.genre !== "donjon") {
        const xp = xpEffective(XP_PAR_TYPE[etape.genre], toile, tranche.id);
        for (const p of run.persos) gagnerXPPerso(p, xp, tranche.id);
      }
    }
    if (vivant) { clears++; pvFinTot += pvEquipe(); }
  }

  return {
    clear: clears / nbParcours,
    pvDonjon: nbArrivesDonjon ? pvDonjonTot / nbArrivesDonjon : 0,
    pvFin: clears ? pvFinTot / clears : 0,
    koDonjon: nbArrivesDonjon ? koTot / nbArrivesDonjon : 0,
    wipes,
  };
}

// --- Helpers d'affichage -----------------------------------------------------
const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(4);
const pireWipe = (w: Map<string, number>): string => {
  if (!w.size) return "";
  const [cle, n] = [...w.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  return `${cle} (${n})`;
};

/** Verdict par rapport à la CIBLE : « clairable simplement, mais pas autowin ».
 *  Un clear parfait sans entamer les PV n'offre aucune tension ; un clear qui
 *  s'effondre est un mur que ce plancher d'IA ne peut de toute façon pas juger. */
function verdict(b: BilanZone): string {
  if (b.clear >= 0.995 && b.pvFin > 0.6) return "· AUTOWIN";
  if (b.clear < 0.6) return "⚠ MUR";
  if (b.clear >= 0.9) return "· ok";
  return "· serré";
}

// --- Rapport -----------------------------------------------------------------
describe("équilibrage — simulation par parcours de zone", () => {
  it("rapport", async () => {
    const out: string[] = [];
    out.push(`\n=== ÉQUILIBRAGE · parcours de ZONE · N=${N} parcours/scénario · IA des 2 côtés ===`);
    out.push(`Équipe: ${TEAM.map((t) => `${t.classe}(${CLASSES[t.classe].elements.join("/")})`).join(" ")}`);
    out.push(`Parcours : ${COMBATS_PAR_ZONE} combats + ${ELITES_PAR_ZONE} élite (ordre tiré) + 1 taverne (position tirée) + le donjon.`);
    out.push(`PV reportés d'un combat au suivant, entrée de zone à 100 %, XP en route, rencontres tirées dans les pools.`);
    out.push(`ATTENDU = 4 pièces de la toile, rareté tirée (60/25/12/3) · MALCHANCE = 2 pièces commun.`);
    out.push(`clear = parcours menés au bout · PVdon = PV d'équipe à l'entrée du donjon · PVfin = après le donjon · KO = héros à 0 PV au donjon\n`);

    for (const tranche of TRANCHES_MESUREES) {
      const zones = zonesDeTranche(tranche);
      const niveaux = niveauxDEntree(tranche, zones);
      const offset = offsetToile(tranche.id);
      out.push(`\n### ${tranche.nom} ###`);
      out.push(
        "toile zone                          niv | ATTENDU  clear PVdon PVfin  KO  | MALCH clear PVdon | verdict     ça casse à",
      );

      for (let z = 0; z < zones.length; z++) {
        const zone = zones[z];
        const toile = offset + z + 1;
        const seed = z * 100000 + toile * 7717;
        const att = await simulerZone(zone, tranche, niveaux[z], toile, "attendu", 0, seed, N);
        const mal = await simulerZone(zone, tranche, niveaux[z], toile, "malchance", 0, seed, N);
        out.push(
          String(toile).padEnd(6) +
          zone.nom.slice(0, 29).padEnd(30) +
          String(niveaux[z]).padEnd(4) + "|  " +
          `${pct(att.clear)} ${pct(att.pvDonjon)} ${pct(att.pvFin)} ${att.koDonjon.toFixed(1)}` + " | " +
          `      ${pct(mal.clear)} ${pct(mal.pvDonjon)}` + " | " +
          verdict(att).padEnd(11) + " " + pireWipe(att.wipes),
        );
      }
    }

    // --- Échelle d'Ascension --------------------------------------------------
    // La cible de conception : ★1 clairable sans être un autowin, et Cauchemar /
    // Ultime HORS DE PORTÉE en l'état — la méta-progression à venir (Dofus,
    // parchotage) aplanira tout ça, il faut donc de la marge au-dessus.
    out.push(`\n\n=== ÉCHELLE D'ASCENSION · clear% du parcours de zone · loadout ATTENDU · N=${N_ASC} ===`);
    for (const tranche of TRANCHES_MESUREES) {
      const zones = zonesDeTranche(tranche);
      const niveaux = niveauxDEntree(tranche, zones);
      const offset = offsetToile(tranche.id);
      out.push(`\n### ${tranche.nom} ###`);
      out.push(
        "toile zone                          " +
        ASCENSION.map((a, i) => `★${i + 1} ${a.nom}`.padStart(14)).join(""),
      );
      for (let z = 0; z < zones.length; z++) {
        const zone = zones[z];
        const toile = offset + z + 1;
        const cols: string[] = [];
        for (let cran = 0; cran < ASCENSION.length; cran++) {
          const b = await simulerZone(zone, tranche, niveaux[z], toile, "attendu", cran, z * 7919 + cran * 104729, N_ASC);
          cols.push(pct(b.clear).padStart(14));
        }
        out.push(String(toile).padEnd(6) + zone.nom.slice(0, 29).padEnd(30) + cols.join(""));
      }
    }

    expect(TRANCHES_MESUREES.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(out.join("\n"));
  });
});
