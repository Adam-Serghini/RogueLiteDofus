// =============================================================================
//  sim.ts — Harnais d'ÉQUILIBRAGE (headless, hors `npm test`).
//  Lancer : `npm run sim`  (vitest --config vitest.sim.config.ts)
//
//  Rejoue chaque rencontre N fois (IA des deux côtés, RNG graine reproductible)
//  et sort un tableau : taux de victoire, tours joués, PV restants sur victoire.
//  Équipe de référence : 4 classes par défaut, montée au NIVEAU ATTENDU de la
//  zone (dérivé de la courbe d'XP). Deux scénarios de stuff : « nu » et « set
//  de zone » (toile, palier commun).
//
//  LIMITES (à garder en tête) : `controllerIA` ne joue pas de façon optimale
//  (spam du sort le plus cher, focus PV le plus bas ; seul le soin est géré via
//  ia="soutien"). L'élément de frappe se calcule automatiquement coup par coup
//  (le plus fort des deux éléments de la classe, par cible) — même moteur qu'en
//  jeu. C'est une BASELINE RELATIVE, pas le ressenti réel.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  TRANCHES, zonesDeTranche, offsetToile, COMBATS, MONSTRES, CLASSES, ITEMS, XP_PAR_TYPE, xpEffective, SORTS, butinToile,
  type TrancheDef, type ZoneDef,
} from "./data";

import { runCombat, controllerIA } from "./combat";
import { progressionInitiale, gagnerXP, STAT_PAR_ELEMENT } from "./progression";
import {
  nouvelleRun, equipeCombattante, fabriquerEnnemis, pvMaxPerso, appliquerModificateursElite, instanceDuTier,
  effetsAscension, appliquerAscensionEnnemis, especesNormalesDeZone, meilleurItemToile,
  type RunState,
} from "./run";
import { mulberry32 } from "./rng";
import type { ItemInstance, Rarete } from "./types";

// Tranches mesurées par le banc, dans l'ordre d'affichage du rapport. T1 doit
// TOUJOURS rester mesurée en premier et à l'identique (garde-fou anti-régression :
// ses chiffres ne doivent jamais bouger d'un run de sim à l'autre) ; ajouter d'autres
// ids ici pour les faire apparaître à la suite (ex. T2 pour mesurer le Clos des Blops).
const TRANCHES_MESUREES: TrancheDef[] = [TRANCHES[0], TRANCHES[1]];

// --- Paramètres du sim (tunables) --------------------------------------------
// Les classes portent désormais leurs deux éléments (voir CLASSES-ELEMENTS.md), et
// l'élément de frappe se calcule automatiquement coup par coup (le plus fort des
// deux) : il n'y a plus rien à choisir côté banc. On garde les quatre mêmes
// classes, qui couvrent les quatre éléments — nécessaire pour juger honnêtement
// les zones à puzzle élémentaire.
// SIM_TANK=1 → config « tortue » positionnelle : Feca seul en ligne avant, le reste
// derrière (l'exploit full-vitalité, lui, n'existe plus : l'allocation est automatique).
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
    { classe: "ecaflip" }, // le sadida est désactivé
  ];
const IDS = TEAM.map((t) => t.classe);
const N = 200; // combats par (rencontre × scénario de stuff)
const NORMAUX_PAR_ZONE = 6; // path moyen supposé pour la courbe d'XP (plateau Pokelike ~10 nœuds)
const ELITES_PAR_ZONE = 1;
// Palier d'Ascension mesuré par le sim (0 = jeu de base). Le sim ne rejoue que des
// RENCONTRES ISOLÉES, pas des runs entières : la taverne réduite (tavernePct) et la
// mort définitive, ainsi que les tavernes coupées à l'équipe complète, ne s'appliquent
// qu'entre/au début des runs réelles et restent donc HORS scope de cette mesure —
// seuls les effets qui modifient directement les ennemis (renfort de meute, PV,
// multiplicateur de dégâts) sont appliqués ici via
// `appliquerAscensionEnnemis`/`appliquerModificateursElite` et le `enemyDamageBonus`
// passé à `runCombat`.
const ASCENSION = 0;
const EFF_ASCENSION = effetsAscension(ASCENSION);

// --- PRNG reproductible : `mulberry32` vit dans `./rng`, partagé avec le banc
// d'essai de l'éditeur — deux générateurs différents, ce serait deux qualités de
// tirage pour deux chiffres censés se comparer.

// --- Construction de l'équipe de référence -----------------------------------
const estSoutien = (classeId: string): boolean =>
  CLASSES[classeId].sorts.some((id) => SORTS[id]?.type === "soin");

const SLOTS_SIM = ["arme", "coiffe", "cape", "anneau"] as const;

/** Exemplaire d'un objet à rareté au palier demandé (repli : premier palier défini). */
function itemPalier(id: string, rarete: "commun" | "rare"): ItemInstance {
  const tiers = ITEMS[id].tiers!;
  const r = tiers[rarete] ? rarete : (Object.keys(tiers)[0] as Rarete);
  return instanceDuTier(id, r)!;
}

/** Niveaux attendus par zone d'une tranche donnée : à l'ENTRÉE (normales/élites)
 *  et en FIN de zone (le donjon se joue après les combats de la zone — mesurer le
 *  boss au niveau d'entrée le rendait artificiellement injouable en début de
 *  tranche). Départ/cap/xpMult viennent tous de `TrancheDef` — mêmes formules que
 *  le jeu réel (`xpEffective`, partagée), la numérotation de toile continue d'une
 *  tranche à l'autre via `offsetToile`. Pour t1 (départ niveau 1, xpMult absent,
 *  offset 0) ceci reproduit EXACTEMENT l'ancien calcul figé sur "t1"/cap 50. */
function courbeNiveaux(tranche: TrancheDef, zones: ZoneDef[]): { entree: number[]; fin: number[] } {
  const p = progressionInitiale();
  p.niveau = tranche.niveaux[0];
  const niveauMax = tranche.niveaux[1];
  const offset = offsetToile(tranche.id);
  const entree: number[] = [];
  const fin: number[] = [];
  for (let z = 0; z < zones.length; z++) {
    entree.push(p.niveau);
    const toile = offset + z + 1;
    for (let i = 0; i < NORMAUX_PAR_ZONE; i++) gagnerXP(p, xpEffective(XP_PAR_TYPE.combat, toile, tranche.id), niveauMax);
    for (let i = 0; i < ELITES_PAR_ZONE; i++) gagnerXP(p, xpEffective(XP_PAR_TYPE.combat_dur, toile, tranche.id), niveauMax);
    fin.push(p.niveau);
  }
  return { entree, fin };
}

/**
 * Équipe de référence au niveau `niveau`, éventuellement stuffée des
 * `nbPieces` premières pièces du pool de toile de la zone (2 = mi-set
 * réaliste ; défaut = set complet).
 */
function equipeReference(niveau: number, zoneId?: string, nbPieces = 4): RunState {
  const run = nouvelleRun(IDS);
  const pool = zoneId ? (butinToile(zoneId)?.normales ?? null) : null;
  run.persos.forEach((perso, i) => {
    perso.progression = { ...progressionInitiale(), niveau };
    if (TEAM[i].pos !== undefined) perso.position = TEAM[i].pos!;
    if (pool) {
      // zone à toile : chaque membre porte le meilleur objet COMMUN de sa stat
      // par slot (arme et coiffe d'abord pour le mi-set) — plancher réaliste,
      // les paliers rare/épique/légendaire rendent le vrai jeu plus facile. Les
      // 2 éléments de la classe montent tous les deux (allocation automatique) :
      // `statPref` ne départage en réalité RIEN — aucun objet du jeu ne porte de
      // ligne de caractéristique élémentaire sèche (voir Archétypes & éléments,
      // CLAUDE.md), donc ce tri par premier élément déclaré n'a jamais l'occasion
      // de s'exercer sur le stuff non-adaptatif.
      const statPref = STAT_PAR_ELEMENT[CLASSES[TEAM[i].classe].elements[0]];
      for (const slot of SLOTS_SIM.slice(0, nbPieces)) {
        const id = meilleurItemToile(pool, slot, statPref);
        if (id) perso.equipement[slot] = itemPalier(id, "commun");
      }
    }
    perso.pvActuels = pvMaxPerso(perso);
  });
  return run;
}

// --- Simulation d'une rencontre ----------------------------------------------
interface Bilan { win: number; turns: number; hpWin: number; maxTurns: number; }

interface OptsRencontre {
  type: "combat" | "combat_dur" | "donjon";
  especesZone?: string[];
  derniereZone?: boolean;
}

async function simuler(run: RunState, combatId: string, seed0: number, opts: OptsRencontre): Promise<Bilan> {
  let wins = 0, turnsTot = 0, hpWinTot = 0, maxTurns = 0;
  for (let i = 0; i < N; i++) {
    const equipe = equipeCombattante(run);
    run.persos.forEach((p, j) => { if (estSoutien(p.classeId)) equipe[j].ia = "soutien"; });
    const rng = mulberry32((seed0 + i * 0x9e3779b9) >>> 0);
    const ennemis = fabriquerEnnemis(combatId);
    if (opts.type === "combat_dur") {
      // comme en jeu : la meute élite est modifiée (A5 : 2 modificateurs distincts)
      appliquerModificateursElite(ennemis, rng, undefined, EFF_ASCENSION.elitesDoubles ? 2 : 1);
    }
    appliquerAscensionEnnemis(ennemis, EFF_ASCENSION, {
      type: opts.type, especesZone: opts.especesZone, derniereZone: opts.derniereZone, rng,
    });
    const cs = [...equipe, ...ennemis];
    let turns = 0;
    const win = await runCombat(cs, {
      controllers: { joueur: controllerIA, ennemi: controllerIA },
      rng,
      log: (m) => { if (m.charCodeAt(0) === 0x25b6) turns++; }, // « ▶ Tour de … »
      enemyDamageBonus: EFF_ASCENSION.degatsMult ?? 1,
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
    const out: string[] = [];
    out.push(`\n=== ÉQUILIBRAGE · sim par rencontre · N=${N}/scénario · IA des 2 côtés ===`);
    out.push(`Équipe: ${TEAM.map((t) => `${t.classe}(${CLASSES[t.classe].elements.join("/")})`).join(" ")}`);
    out.push(`Colonnes — NU (sans stuff) | MI (2 pièces, toile commun) | SET (4 pièces, toile commun) : win% · tours · PV%restant(sur victoire)\n`);

    for (const tranche of TRANCHES_MESUREES) {
    const ZONES_SIM = zonesDeTranche(tranche);
    const { entree: niveaux, fin: niveauxFin } = courbeNiveaux(tranche, ZONES_SIM);
    out.push(`\n### ${tranche.nom} ###`);
    out.push(`Niveau attendu/zone: ${ZONES_SIM.map((z, i) => `${z.nom.split(" ").pop()} L${niveaux[i]}`).join(" · ")}`);

    for (let z = 0; z < ZONES_SIM.length; z++) {
      const zone = ZONES_SIM[z];
      const niveau = niveaux[z];
      const runNu = equipeReference(niveau);
      const runMi = equipeReference(niveau, zone.id, 2);
      const runSet = equipeReference(niveau, zone.id);
      out.push(`── ${zone.nom} (niv ${niveau}, toile (objets communs)) ──`);
      const lignes: Array<{ id: string; type: string }> = [
        ...zone.pools.normales.map((id) => ({ id, type: "normale" })),
        ...zone.pools.elite.map((id) => ({ id, type: "élite" })),
        ...zone.pools.boss.map((id) => ({ id, type: "boss" as const })),
      ];
      // le donjon se joue en FIN de zone : équipes de boss au niveau de sortie
      const runNuBoss = equipeReference(niveauxFin[z]);
      const runMiBoss = equipeReference(niveauxFin[z], zone.id, 2);
      const runSetBoss = equipeReference(niveauxFin[z], zone.id);
      const especesZone = especesNormalesDeZone(zone);
      const derniereZone = z === ZONES_SIM.length - 1;
      for (const { id, type } of lignes) {
        const seed = z * 100000 + id.split("").reduce((s, c) => s + c.charCodeAt(0), 0) * 7;
        const boss = type === "boss";
        const elite = type === "élite";
        const opts: OptsRencontre = {
          type: boss ? "donjon" : elite ? "combat_dur" : "combat",
          especesZone, derniereZone,
        };
        const nu = await simuler(boss ? runNuBoss : runNu, id, seed, opts);
        const mi = await simuler(boss ? runMiBoss : runMi, id, seed, opts);
        const set = await simuler(boss ? runSetBoss : runSet, id, seed, opts);
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
    expect(niveaux.length).toBe(ZONES_SIM.length);
    expect(niveauxFin.length).toBe(ZONES_SIM.length);
    }
    // eslint-disable-next-line no-console
    console.log(out.join("\n"));
  });
});
