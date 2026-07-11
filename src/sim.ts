// =============================================================================
//  sim.ts — Harnais d'ÉQUILIBRAGE (headless, hors `npm test`).
//  Lancer : `npm run sim`  (vitest --config vitest.sim.config.ts)
//
//  Rejoue chaque rencontre N fois (IA des deux côtés, RNG graine reproductible)
//  et sort un tableau : taux de victoire, tours joués, PV restants sur victoire.
//  Équipe de référence : 4 classes par défaut, montée au NIVEAU ATTENDU de la
//  zone (dérivé de la courbe d'XP), points investis dans la stat offensive
//  dominante. Deux scénarios de stuff : « nu » et « set de zone » (rolls moyens).
//
//  LIMITES (à garder en tête) : `controllerIA` ne joue pas de façon optimale
//  (spam du sort le plus cher, focus PV le plus bas ; seul le soin est géré via
//  ia="soutien"). Aucun choix d'élément de frappe adaptatif → mesure « si le
//  joueur ne s'adapte pas ». C'est une BASELINE RELATIVE, pas le ressenti réel.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  TRANCHES, zonesDeTranche, COMBATS, MONSTRES, CLASSES, ITEMS, PANOPLIES, BUTIN_ZONE, XP_PAR_TYPE, XP_PAR_TOILE, SORTS, butinToile,
} from "./data";

import { runCombat, controllerIA } from "./combat";
import { progressionInitiale, gagnerXP, investirN, POINTS_PAR_NIVEAU } from "./progression";
import {
  nouvelleRun, equipeCombattante, fabriquerEnnemis, pvMaxPerso, appliquerModificateurElite, instanceDuTier,
  type RunState,
} from "./run";
import type { ItemInstance, Rarete, Stats } from "./types";

// Zones de la tranche active, dans l'ORDRE DE JEU (la courbe d'XP en dépend).
const ZONES_SIM = zonesDeTranche(TRANCHES.find((t) => t.active)!);

// --- Paramètres du sim (tunables) --------------------------------------------
// Les classes ont 0 stat offensive de base → l'élément vient des points investis.
// On répartit donc un élément par membre (couverture multi-élément = jeu attendu,
// nécessaire pour juger honnêtement les zones à puzzle élémentaire).
// SIM_TANK=1 → config « tortue » : Feca FULL VITA seul en ligne avant, le reste
// à l'arrière (teste l'exploit tank+heal : les sorts ennemi_ligne ne touchent
// que la ligne avant, l'Eni régénère le tank).
const TANK = !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SIM_TANK;
const TEAM: Array<{ classe: string; stat: keyof Stats; pos?: number; fullVita?: boolean }> = TANK
  ? [
    { classe: "feca", stat: "vitalite", pos: 0, fullVita: true }, // mur
    { classe: "iop", stat: "force", pos: 4 },
    { classe: "cra", stat: "agilite", pos: 5 },
    { classe: "eniripsa", stat: "intelligence", pos: 6 }, // soigneur
  ]
  : [
    { classe: "iop", stat: "force" }, // terre
    { classe: "cra", stat: "agilite" }, // air
    { classe: "eniripsa", stat: "intelligence" }, // feu (+ soin de classe)
    { classe: "ecaflip", stat: "chance" }, // eau (le sadida est désactivé)
  ];
const IDS = TEAM.map((t) => t.classe);
const ELEM_DE_STAT: Record<string, string> = { force: "terre", intelligence: "feu", agilite: "air", chance: "eau" };
const N = 200; // combats par (rencontre × scénario de stuff)
const NORMAUX_PAR_ZONE = 6; // path moyen supposé pour la courbe d'XP (plateau Pokelike ~10 nœuds)
const ELITES_PAR_ZONE = 1;

// --- PRNG reproductible (mulberry32, pur, sans dépendance) -------------------
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Construction de l'équipe de référence -----------------------------------
const estSoutien = (classeId: string): boolean =>
  CLASSES[classeId].sorts.some((id) => SORTS[id]?.type === "soin");

/** ItemInstance aux stats = milieu de chaque fourchette (drop « moyen », legacy). */
function itemMoyen(id: string): ItemInstance {
  const rolls = ITEMS[id]?.rolls ?? {};
  const stats: Partial<Stats> = {};
  for (const k of Object.keys(rolls) as (keyof Stats)[]) {
    const [lo, hi] = rolls[k]!;
    stats[k] = Math.floor((lo + hi) / 2);
  }
  return { id, stats };
}

const SLOTS_SIM = ["arme", "coiffe", "cape", "anneau"] as const;

/** Exemplaire d'un objet à rareté au palier demandé (repli : premier palier défini). */
function itemPalier(id: string, rarete: "commun" | "rare"): ItemInstance {
  const tiers = ITEMS[id].tiers!;
  const r = tiers[rarete] ? rarete : (Object.keys(tiers)[0] as Rarete);
  return instanceDuTier(id, r)!;
}

/** Meilleur objet du pool de toile pour un slot et une stat (celui qui maximise
 *  la stat investie du membre, vitalité en départage) — ce qu'un joueur garderait. */
function meilleurItemToile(pool: string[], slot: string, stat: keyof Stats): string | null {
  const candidats = pool.filter((id) => ITEMS[id].slot === slot && ITEMS[id].tiers?.commun);
  if (!candidats.length) return null;
  const score = (id: string) => {
    const t = ITEMS[id].tiers!.commun!;
    // la vitalité pèse : un vrai joueur prend la coiffe tank face aux boss burst
    return ((t.stats[stat] ?? 0) + (t.adaptatif ?? 0)) * 10 + (t.stats.vitalite ?? 0) * 4;
  };
  return candidats.sort((a, b) => score(b) - score(a))[0];
}

/** Niveaux attendus par zone : à l'ENTRÉE (normales/élites) et en FIN de zone
 *  (le donjon se joue après les combats de la zone — mesurer le boss au niveau
 *  d'entrée le rendait artificiellement injouable en début de tranche). */
function courbeNiveaux(): { entree: number[]; fin: number[] } {
  const p = progressionInitiale();
  const entree: number[] = [];
  const fin: number[] = [];
  for (let z = 0; z < ZONES_SIM.length; z++) {
    entree.push(p.niveau);
    const mult = 1 + XP_PAR_TOILE * z; // toile = z+1
    for (let i = 0; i < NORMAUX_PAR_ZONE; i++) gagnerXP(p, Math.round(XP_PAR_TYPE.combat * mult), 50);
    for (let i = 0; i < ELITES_PAR_ZONE; i++) gagnerXP(p, Math.round(XP_PAR_TYPE.combat_dur * mult), 50);
    fin.push(p.niveau);
  }
  return { entree, fin };
}

/**
 * Équipe de référence au niveau `niveau`, éventuellement stuffée des
 * `nbPieces` premières pièces du set `setId` (2 = mi-set réaliste, avec le
 * bonus de panoplie 2 pièces ; défaut = set complet).
 */
function equipeReference(niveau: number, zoneId?: string, nbPieces = 4): RunState {
  const run = nouvelleRun(IDS);
  const pool = zoneId ? (butinToile(zoneId)?.normales ?? null) : null;
  run.persos.forEach((perso, i) => {
    const p = progressionInitiale();
    p.niveau = niveau;
    p.pointsDispo = POINTS_PAR_NIVEAU * (niveau - 1);
    // build de référence RÉALISTE : ~25 % des points en vitalité, le reste
    // dans la stat offensive (un full glass cannon rendait les boss 10 PA
    // « injouables » à la sim alors qu'ils ne le sont pas en vrai jeu).
    // Config tortue (SIM_TANK) : le tank met TOUT en vitalité.
    if (TEAM[i].fullVita) investirN(p, "vitalite", Infinity);
    else { investirN(p, "vitalite", Math.floor(p.pointsDispo * 0.25)); investirN(p, TEAM[i].stat, Infinity); }
    perso.progression = p;
    if (TEAM[i].pos !== undefined) perso.position = TEAM[i].pos!;
    if (pool) {
      // zone à toile : chaque membre porte le meilleur objet COMMUN de sa stat
      // par slot (arme et coiffe d'abord pour le mi-set) — plancher réaliste,
      // les paliers rare/épique/légendaire rendent le vrai jeu plus facile.
      for (const slot of SLOTS_SIM.slice(0, nbPieces)) {
        const id = meilleurItemToile(pool, slot, TEAM[i].stat);
        if (id) perso.equipement[slot] = itemPalier(id, "commun");
      }
    } else if (zoneId) {
      const setId = BUTIN_ZONE[zoneId];
      for (const pieceId of PANOPLIES[setId]?.pieces.slice(0, nbPieces) ?? []) {
        perso.equipement[ITEMS[pieceId].slot] = itemMoyen(pieceId);
      }
    }
    perso.pvActuels = pvMaxPerso(perso);
  });
  return run;
}

// --- Simulation d'une rencontre ----------------------------------------------
interface Bilan { win: number; turns: number; hpWin: number; maxTurns: number; }

async function simuler(run: RunState, combatId: string, seed0: number, elite = false): Promise<Bilan> {
  let wins = 0, turnsTot = 0, hpWinTot = 0, maxTurns = 0;
  for (let i = 0; i < N; i++) {
    const equipe = equipeCombattante(run);
    run.persos.forEach((p, j) => { if (estSoutien(p.classeId)) equipe[j].ia = "soutien"; });
    const rng = mulberry32((seed0 + i * 0x9e3779b9) >>> 0);
    const ennemis = fabriquerEnnemis(combatId);
    if (elite) appliquerModificateurElite(ennemis, rng); // comme en jeu : la meute est modifiée
    const cs = [...equipe, ...ennemis];
    let turns = 0;
    const win = await runCombat(cs, {
      controllers: { joueur: controllerIA, ennemi: controllerIA },
      rng,
      log: (m) => { if (m.charCodeAt(0) === 0x25b6) turns++; }, // « ▶ Tour de … »
    });
    turnsTot += turns;
    if (turns > maxTurns) maxTurns = turns;
    if (win) {
      wins++;
      const cur = equipe.reduce((s, c) => s + Math.max(0, c.pvActuels), 0);
      const max = equipe.reduce((s, c) => s + c.pvMax, 0);
      hpWinTot += max ? cur / max : 0;
    }
  }
  return { win: wins / N, turns: turnsTot / N, hpWin: wins ? hpWinTot / wins : 0, maxTurns };
}

// --- Helpers d'affichage -----------------------------------------------------
const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(4);
const f1 = (x: number) => x.toFixed(1).padStart(5);
function labelEnnemis(combatId: string): string {
  const cptr: Record<string, number> = {};
  for (const e of COMBATS[combatId].ennemis) cptr[e.monstre] = (cptr[e.monstre] ?? 0) + 1;
  return Object.entries(cptr)
    .map(([m, n]) => `${n}×${MONSTRES[m]?.nom ?? m}`)
    .join(", ");
}
function drapeaux(type: string, nu: Bilan, mi: Bilan, set: Bilan): string {
  const f: string[] = [];
  if (nu.win < 0.5 || set.win < 0.5) f.push("⚠ DUR");
  if (type === "boss" && set.win > 0.9) f.push("· facile");
  if ((type === "normale") && nu.win > 0.98 && nu.hpWin > 0.85) f.push("· trivial");
  if (set.win - mi.win > 0.5) f.push("· falaise 2→4p"); // le saut se joue entre mi-set et full set
  if (Math.max(nu.maxTurns, mi.maxTurns, set.maxTurns) >= 90) f.push("· stalemate?");
  return f.join(" ");
}

// --- Rapport -----------------------------------------------------------------
describe("équilibrage — simulation par rencontre", () => {
  it("rapport", async () => {
    const { entree: niveaux, fin: niveauxFin } = courbeNiveaux();
    const out: string[] = [];
    out.push(`\n=== ÉQUILIBRAGE · sim par rencontre · N=${N}/scénario · IA des 2 côtés ===`);
    out.push(`Équipe: ${TEAM.map((t) => `${t.classe}(${ELEM_DE_STAT[t.stat as string]})`).join(" ")}`);
    out.push(`Niveau attendu/zone: ${ZONES_SIM.map((z, i) => `${z.nom.split(" ").pop()} L${niveaux[i]}`).join(" · ")}`);
    out.push(`Colonnes — NU (sans stuff) | MI (2 pièces + bonus 2p) | SET (4 pièces, rolls moyens) : win% · tours · PV%restant(sur victoire)\n`);

    for (let z = 0; z < ZONES_SIM.length; z++) {
      const zone = ZONES_SIM[z];
      const niveau = niveaux[z];
      const runNu = equipeReference(niveau);
      const runMi = equipeReference(niveau, zone.id, 2);
      const runSet = equipeReference(niveau, zone.id);
      out.push(`── ${zone.nom} (niv ${niveau}, ${butinToile(zone.id) ? "toile (objets communs)" : `set « ${PANOPLIES[BUTIN_ZONE[zone.id]]?.nom ?? "?"} »`}) ──`);
      const lignes: Array<{ id: string; type: string }> = [
        ...zone.pools.normales.map((id) => ({ id, type: "normale" })),
        ...zone.pools.elite.map((id) => ({ id, type: "élite" })),
        { id: zone.pools.boss, type: "boss" },
      ];
      // le donjon se joue en FIN de zone : équipes de boss au niveau de sortie
      const runNuBoss = equipeReference(niveauxFin[z]);
      const runMiBoss = equipeReference(niveauxFin[z], zone.id, 2);
      const runSetBoss = equipeReference(niveauxFin[z], zone.id);
      for (const { id, type } of lignes) {
        const seed = z * 100000 + id.split("").reduce((s, c) => s + c.charCodeAt(0), 0) * 7;
        const boss = type === "boss";
        const elite = type === "élite";
        const nu = await simuler(boss ? runNuBoss : runNu, id, seed, elite);
        const mi = await simuler(boss ? runMiBoss : runMi, id, seed, elite);
        const set = await simuler(boss ? runSetBoss : runSet, id, seed, elite);
        const dr = drapeaux(type === "élite" ? "elite" : type, nu, mi, set);
        out.push(
          `  ${type.padEnd(7)} ${id.padEnd(10)} ` +
          `NU ${pct(nu.win)} ${f1(nu.turns)}t ${pct(nu.hpWin)} | ` +
          `MI ${pct(mi.win)} ${f1(mi.turns)}t ${pct(mi.hpWin)} | ` +
          `SET ${pct(set.win)} ${f1(set.turns)}t ${pct(set.hpWin)}  ` +
          `${dr}   [${labelEnnemis(id)}]`,
        );
      }
      out.push("");
    }
    // eslint-disable-next-line no-console
    console.log(out.join("\n"));
    expect(niveaux.length).toBe(ZONES_SIM.length);
    expect(niveauxFin.length).toBe(ZONES_SIM.length);
  });
});
