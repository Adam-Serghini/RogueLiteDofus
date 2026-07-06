// =============================================================================
//  main.ts — Orchestration (Phase B) : accueil → carte de nœuds → Dofus.
// =============================================================================
import "./style.css";
import { CLASSES, MONSTRES, COMBATS, XP_PAR_TYPE, TAVERNE_PCT, TRANCHES, zonesDeTranche, BUTIN_ZONE, DOFUS_DROP_RATE, DROP, type ZonePools, type ZoneDef } from "./data";
import { runCombat, controllerIA, ELEMENTS, type Controller } from "./combat";
import { restat, PV_PAR_VITA } from "./progression";
import { genererCarte } from "./carte";
import {
  nouvelleRun, equipeCombattante, fabriquerEnnemis, synchroniserPV, soignerEquipe,
  appliquerModificateurElite,
  chargerMeta, ajouterDofus, reinitialiserMeta, bonusEquipe, prospectionEquipe,
  propositionsRecrutement, recruter, tenterButin, enregistrerRun, gagnerXPPerso,
  appliquerArchimonstres, capturerArchi, verifierSucces, type RunState,
  sauverRunEnCours, chargerRunEnCours, effacerRunEnCours, type RunSauvee,
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

async function resoudreCombat(run: RunState, combatId: string, elite = false): Promise<ResultatCombat> {
  let titre = COMBATS[combatId]?.nom ?? "Combat";
  const equipe = equipeCombattante(run);
  const ennemis = fabriquerEnnemis(combatId);
  if (elite) {
    // combat dur : toute la meute reçoit un modificateur tiré au sort
    const modif = appliquerModificateurElite(ennemis, Math.random);
    titre = `${titre} · ${modif.nom} (${modif.desc})`;
  }
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
    fx: ui.fxEvent, // crit / esquive → nombres flottants
    onDegats: (ref, dmg) => {
      // récap de fin de run : dégâts infligés par héros (refs joueur = "j_<classe>")
      if (ref.startsWith("j_")) {
        const cid = ref.slice(2);
        run.stats.degats[cid] = (run.stats.degats[cid] ?? 0) + dmg;
      }
    },
    onUpdate: async () => {
      ui.onUpdate();
      await sleep(60);
    },
    playerDamageBonus: damageMult,
  });
  synchroniserPV(run, combatants); // PV conservés d'un nœud à l'autre
  if (gagne) {
    run.stats.combats += 1;
    run.stats.archis += await capturerArchis(combatants); // captures d'Archimonstres
  }
  return { gagne, combatants };
}

async function recompenserXP(run: RunState, gain: number): Promise<void> {
  // Chaque perso monte ; en mode « élément » les points sont investis auto.
  // On n'ouvre le panneau que si un héros en mode MANUEL a des points à dépenser.
  let manuelAvecPoints = false;
  for (const p of run.persos) {
    if (gagnerXPPerso(p, gain) > 0) p.flashNiveau = true; // pour l'animation dans le panneau d'équipe
    if (!p.elementChoisi && p.progression.pointsDispo > 0) manuelAvecPoints = true;
  }
  if (manuelAvecPoints) {
    await ui.showStatPanel(run.persos, "Niveau gagné !", "Dépense les points des héros en mode manuel.", false, meta);
  }
}

/** Capture les âmes des Archimonstres vaincus (uniques), annonce et compte les nouvelles. */
async function capturerArchis(combatants: Combatant[]): Promise<number> {
  const nouvelles: string[] = [];
  for (const c of combatants) {
    if (c.camp === "ennemi" && c.archi && c.monstreId && capturerArchi(meta, c.monstreId)) {
      nouvelles.push(MONSTRES[c.monstreId]?.nom ?? c.monstreId);
    }
  }
  if (nouvelles.length) await ui.showCapture(nouvelles);
  return nouvelles.length;
}

/** Tire le butin d'équipement de la zone après une victoire et l'annonce. */
async function recompenserButin(run: RunState, butinPano: string | undefined, type: NodeType): Promise<void> {
  if (!butinPano) return;
  const drops = tenterButin(run, butinPano, type, Math.random);
  run.stats.objets += drops.length;
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
      const { gagne } = await resoudreCombat(run, combatId!, type === "combat_dur");
      if (!gagne) return "wipe";
      await recompenserXP(run, xp);
      // combat dur modifié → butin au taux donjon (la prise de risque paie)
      await recompenserButin(run, butinPano, type === "combat_dur" ? "donjon" : type);
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

/** Parcourt le plateau d'une zone jusqu'au donjon.
 *  Sauvegarde la run après chaque nœud résolu (reprise possible à tout moment ;
 *  un combat en cours n'est pas sauvegardé → nœud à refaire). */
async function jouerZone(run: RunState, zone: ZoneDef, zoneIdx: number): Promise<"wipe" | "clear"> {
  if (!run.carte) {
    // pas de carte sauvegardée (nouvelle zone) — sinon on reprend celle en cours
    run.carte = genererCarte(Math.random, zone.pools, (zone.sansNoeuds ?? []) as NodeType[]);
    sauverRunEnCours(zoneIdx, run);
  }
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
    sauverRunEnCours(zoneIdx, run); // étape franchie → point de reprise
  }
}

async function jouerRun(reprise: RunSauvee | null): Promise<void> {
  let run: RunState;
  let depart = 0;
  if (reprise) {
    run = reprise.run;
    depart = reprise.zoneIdx;
  } else {
    const choix = await ui.showChoixEquipe();
    run = nouvelleRun(choix);
  }
  const zones = zonesDeTranche(TRANCHES.find((t) => t.active)!); // une run = une tranche
  for (let z = depart; z < zones.length; z++) {
    const zone = zones[z];
    const issue = await jouerZone(run, zone, z);
    if (issue === "wipe") {
      effacerRunEnCours();
      enregistrerRun(meta, false); // run terminée : échec
      await ui.showRecap(run, false, verifierSucces(meta, run, false)); // mort : Meta conservée
      return;
    }
    soignerEquipe(run, 1); // boss de zone vaincu → équipe soignée à 100 % pour la zone suivante
    run.stats.zones += 1;
    run.carte = null; // la zone est finie : la prochaine génère son plateau
    if (z < zones.length - 1) {
      sauverRunEnCours(z + 1, run); // reprise en début de zone suivante
      await ui.showTransition(`${zone.nom} — vaincu !`, `Équipe soignée à 100 %. Tu pénètres dans ${zones[z + 1].nom}.`);
    }
  }
  effacerRunEnCours();
  enregistrerRun(meta, true); // run terminée : toutes les zones vaincues
  await ui.showRecap(run, true, verifierSucces(meta, run, true));
}

async function boucle(): Promise<void> {
  for (;;) {
    const reprise = chargerRunEnCours();
    const zones = zonesDeTranche(TRANCHES.find((t) => t.active)!);
    const repriseInfo = reprise
      ? { zoneNom: zones[reprise.zoneIdx]?.nom ?? "?", zoneNum: reprise.zoneIdx + 1, nbZones: zones.length }
      : null;
    const action = await ui.showStart(meta, () => reinitialiserMeta(meta), repriseInfo);
    if (action === "abandonner") {
      effacerRunEnCours();
      enregistrerRun(meta, false); // l'abandon compte comme une run échouée
      continue; // retour à l'accueil
    }
    await jouerRun(action === "reprendre" ? reprise : null);
  }
}

void boucle();
