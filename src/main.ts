// =============================================================================
//  main.ts — Orchestration (Phase B) : accueil → carte de nœuds → Dofus.
// =============================================================================
import "./style.css";
import { CLASSES, MONSTRES, COMBATS, XP_PAR_TYPE, TAVERNE_PCT, ZONES, BUTIN_ZONE, DOFUS_DROP_RATE, DROP, type ZonePools, type ZoneDef } from "./data";
import { runCombat, controllerIA, ELEMENTS, type Controller } from "./combat";
import { gagnerXP, restat, PV_PAR_VITA } from "./progression";
import { genererCarte } from "./carte";
import {
  nouvelleRun, equipeCombattante, fabriquerEnnemis, synchroniserPV, soignerEquipe,
  chargerMeta, ajouterDofus, reinitialiserMeta, bonusEquipe, prospectionEquipe,
  propositionsRecrutement, recruter, tenterButin, enregistrerRun,
  appliquerArchimonstres, capturerArchi, type RunState,
} from "./run";
import * as ui from "./ui";
import type { Combatant, NodeType } from "./types";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const app = document.getElementById("app");
if (!app) throw new Error("#app introuvable");
ui.init(app);

const meta = chargerMeta();

const enemyController: Controller = async (acteur, cs) => {
  await sleep(550);
  return controllerIA(acteur, cs);
};

interface ResultatCombat {
  gagne: boolean;
  combatants: Combatant[];
}

async function resoudreCombat(run: RunState, combatId: string): Promise<ResultatCombat> {
  const titre = COMBATS[combatId]?.nom ?? "Combat";
  const equipe = equipeCombattante(run);
  const ennemis = fabriquerEnnemis(combatId);
  appliquerArchimonstres(ennemis, Math.random); // chance qu'un ennemi pop en Archimonstre
  // bonus d'équipe (Dofus + paliers Ocre) : dégâts, PA, vitalité (Dofawa), résistances (Argenté)
  const { damageMult, paBonus, vitaBonus, resAllBonus } = bonusEquipe(meta);
  for (const c of equipe) {
    if (paBonus) { c.paMax += paBonus; c.paActuels = c.paMax; }
    if (vitaBonus) {
      c.stats.vitalite += vitaBonus;
      const add = vitaBonus * PV_PAR_VITA;
      c.pvBase += add; c.pvMax += add; c.pvActuels += add;
    }
    if (resAllBonus) for (const el of ELEMENTS) c.resistances[el] = (c.resistances[el] ?? 0) + resAllBonus;
  }
  const combatants = [...equipe, ...ennemis];
  ui.beginCombat(combatants, titre, meta);
  const gagne = await runCombat(combatants, {
    controllers: { joueur: ui.playerController, ennemi: enemyController },
    log: ui.log,
    onUpdate: async () => {
      ui.onUpdate();
      await sleep(60);
    },
    playerDamageBonus: damageMult,
  });
  synchroniserPV(run, combatants); // PV conservés d'un nœud à l'autre
  if (gagne) await capturerArchis(combatants); // captures d'Archimonstres
  return { gagne, combatants };
}

async function recompenserXP(run: RunState, gain: number): Promise<void> {
  let levelUp = false;
  for (const p of run.persos) if (gagnerXP(p.progression, gain) > 0) levelUp = true;
  if (levelUp) await ui.showStatPanel(run.persos, "Niveau gagné !", "Tu as des points à dépenser.", false, meta);
}

/** Capture les âmes des Archimonstres vaincus (uniques) et annonce les nouvelles. */
async function capturerArchis(combatants: Combatant[]): Promise<void> {
  const nouvelles: string[] = [];
  for (const c of combatants) {
    if (c.camp === "ennemi" && c.archi && c.monstreId && capturerArchi(meta, c.monstreId)) {
      nouvelles.push(MONSTRES[c.monstreId]?.nom ?? c.monstreId);
    }
  }
  if (nouvelles.length) await ui.showCapture(nouvelles);
}

/** Tire le butin d'équipement de la zone après une victoire et l'annonce. */
async function recompenserButin(run: RunState, butinPano: string | undefined, type: NodeType): Promise<void> {
  if (!butinPano) return;
  const drops = tenterButin(run, butinPano, type, Math.random);
  if (drops.length) await ui.showDrop(drops);
}

type Issue = "continue" | "wipe" | "victoire";

const LABEL_FR: Record<NodeType, string> = {
  combat: "un combat", combat_dur: "un combat dur", taverne: "une taverne",
  otomai: "un Otomai", zaap: "un zaap", donjon: "le donjon",
};

async function resoudreType(
  run: RunState, type: NodeType, combatId: string | undefined, xp: number, butinPano?: string,
): Promise<Issue> {
  switch (type) {
    case "combat":
    case "combat_dur": {
      const { gagne } = await resoudreCombat(run, combatId!);
      if (!gagne) return "wipe";
      await recompenserXP(run, xp);
      await recompenserButin(run, butinPano, type);
      return "continue";
    }
    case "taverne": {
      const propos = propositionsRecrutement(run, Math.random);
      const choix = await ui.showTaverne(run.persos, propos, TAVERNE_PCT);
      if (choix.type === "soin") {
        soignerEquipe(run, TAVERNE_PCT);
        await ui.showTransition("🍺 Taverne", `L'équipe récupère ${Math.round(TAVERNE_PCT * 100)} % de ses PV max.`);
      } else {
        recruter(run, choix.classeId, choix.remplace);
        await ui.showTransition("🍺 Recrue !", `${CLASSES[choix.classeId].nom} rejoint l'équipe.`);
      }
      return "continue";
    }
    case "otomai": {
      const cible = await ui.showOtomai(run.persos);
      if (cible) {
        restat(cible.progression);
        await ui.showStatPanel([cible], "🔄 Otomai", `Points de ${CLASSES[cible.classeId].nom} remboursés — réattribue-les librement.`, false, meta);
      }
      return "continue";
    }
    case "donjon": {
      const { gagne, combatants } = await resoudreCombat(run, combatId!);
      if (!gagne) return "wipe";
      await recompenserButin(run, butinPano, type);
      const boss = combatants.find((c) => c.camp === "ennemi" && c.dofusLache);
      if (boss?.dofusLache) {
        // 1 % de base, boosté par la prospection d'équipe (même formule que les items)
        const mult = 1 + Math.min(DROP.capProspection, prospectionEquipe(run) * DROP.coefProspection);
        if (Math.random() < DOFUS_DROP_RATE * mult) {
          ajouterDofus(meta, boss.dofusLache);
          const copies = meta.dofus.filter((d) => d === boss.dofusLache).length;
          await ui.showDofus(boss.dofusLache, copies);
        } else {
          await ui.showTransition("Donjon vaincu !", "Le boss n'a pas lâché son Dofus cette fois… (1 % de chance)");
        }
      }
      return "victoire";
    }
    default:
      return "continue";
  }
}

/** Un Zaap se résout en un type aléatoire à l'entrée (pioché dans la zone). */
async function deZaap(pools: ZonePools): Promise<{ type: NodeType; combatId?: string; xp: number }> {
  const type = pick<NodeType>(["combat", "combat_dur", "taverne"]);
  await ui.showZaap(LABEL_FR[type]);
  if (type === "combat") return { type, combatId: pick(pools.normales), xp: XP_PAR_TYPE.combat };
  if (type === "combat_dur") return { type, combatId: pick(pools.elite), xp: XP_PAR_TYPE.combat_dur };
  return { type, xp: 0 };
}

/** Parcourt le plateau d'une zone jusqu'au donjon. */
async function jouerZone(run: RunState, zone: ZoneDef): Promise<"wipe" | "clear"> {
  run.carte = genererCarte(Math.random, zone.pools);
  for (;;) {
    const node = await ui.showCarte(run.carte!, run.persos, meta, zone.nom, run.inventaire);

    let { type } = node;
    let combatId = node.combatId;
    let xp = node.xp ?? 0;
    if (type === "zaap") ({ type, combatId, xp } = await deZaap(zone.pools));

    const issue = await resoudreType(run, type, combatId, xp, BUTIN_ZONE[zone.id]);

    node.visite = true;
    run.carte!.courant = node.id;

    if (issue === "wipe") return "wipe";
    if (issue === "victoire") return "clear"; // donjon de la zone vaincu (+ Dofus)
  }
}

async function jouerRun(): Promise<void> {
  const choix = await ui.showChoixEquipe();
  const run = nouvelleRun(choix);
  for (let z = 0; z < ZONES.length; z++) {
    const zone = ZONES[z];
    const issue = await jouerZone(run, zone);
    if (issue === "wipe") {
      enregistrerRun(meta, false); // run terminée : échec
      await ui.showWipe(); // mort : Progression perdue, Meta (Dofus) conservé
      return;
    }
    soignerEquipe(run, 1); // boss de zone vaincu → équipe soignée à 100 % pour la zone suivante
    if (z < ZONES.length - 1) {
      await ui.showTransition(`${zone.nom} — vaincu !`, `Équipe soignée à 100 %. Tu pénètres dans ${ZONES[z + 1].nom}.`);
    }
  }
  enregistrerRun(meta, true); // run terminée : toutes les zones vaincues
  await ui.showTransition("Krosmoz traversé !", "Tu as vaincu toutes les zones. Retour à l'accueil.");
}

async function boucle(): Promise<void> {
  for (;;) {
    await ui.showStart(meta, () => reinitialiserMeta(meta));
    await jouerRun();
  }
}

void boucle();
