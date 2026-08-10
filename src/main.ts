// =============================================================================
//  main.ts — Orchestration (Phase B) : accueil → carte de nœuds → Dofus.
// =============================================================================
import "./style.css";
import { CLASSES, MONSTRES, COMBATS, XP_PAR_TYPE, xpEffective, zonesDeTranche, trancheDe, DROP, type ZonePools, type ZoneDef } from "./data";
import { runCombat, controllerIA, type Controller } from "./combat";
import { genererCarte, tirerTypeZaap } from "./carte";
import {
  nouvelleRun, equipeCombattante, fabriquerEnnemis, synchroniserPV, soignerEquipe,
  appliquerModificateursElite, effetsAscension, appliquerAscensionEnnemis, especesNormalesDeZone,
  tavernePctAscension, tauxDofusAscension, enregistrerAscension,
  chargerMeta, ajouterDofus, reinitialiserMeta, bonusEquipe, appliquerBonusEquipeCombat, prospectionEquipe,
  propositionsRecrutement, recruter, tenterButin, enregistrerRun, gagnerXPPerso, enregistrerCollection,
  appliquerArchimonstres, appliquerErrants, capturerArchi, chanceArchi, verifierSucces, type RunState,
  gainKamas, crediterKamas, multKamasEquipe, genererStockHDV, toileDeZone,
  sauverRunEnCours, chargerRunEnCours, effacerRunEnCours, type RunSauvee,
  sansNoeudsDeZone, verifierDofusCauchemar,
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

interface OptsCombat {
  elite?: boolean;
  eliteModifs?: string[];
  type: "combat" | "combat_dur" | "donjon";
  zone?: ZoneDef;
  derniereZone?: boolean;
}

async function resoudreCombat(
  run: RunState, combatId: string, opts: OptsCombat,
): Promise<ResultatCombat> {
  let titre = COMBATS[combatId]?.nom ?? "Combat";
  const equipe = equipeCombattante(run);
  const ennemis = fabriquerEnnemis(combatId);
  if (opts.elite) {
    // combat dur : le(s) modificateur(s) vien(nen)t du nœud (affichés au survol sur la carte) ;
    // absent (zaap, vieille save) → tirage aléatoire
    const nombre = effetsAscension(run.ascension).elitesDoubles ? 2 : 1;
    const modifs = appliquerModificateursElite(ennemis, Math.random, opts.eliteModifs, nombre);
    titre = `${titre} · ${modifs.map((m) => `${m.nom} (${m.desc})`).join(" · ")}`;
  }
  // palier d'Ascension : renfort en ligne avant + PV des monstres (les dégâts
  // passent par `enemyDamageBonus`, plus bas)
  appliquerAscensionEnnemis(ennemis, effetsAscension(run.ascension), {
    type: opts.type,
    especesZone: opts.zone ? especesNormalesDeZone(opts.zone) : undefined,
    rng: Math.random,
  });
  appliquerArchimonstres(ennemis, Math.random, chanceArchi(run)); // taux de base + philtres d'Otomai
  // archimonstre errant (Piou) : APRÈS le tirage d'archi, sinon il subirait un second
  // doublement. Annoncé dans le titre, comme les modificateurs d'élite — un ennemi
  // surgissant sans un mot serait illisible.
  const errant = appliquerErrants(ennemis, Math.random, { type: opts.type, tranche: run.trancheId });
  if (errant) titre = `${titre} · ⭐ ${errant}`;
  // bonus d'équipe (Dofus + paliers Ocre) : dégâts, PA, vitalité (Dofawa), résistances (Argenté)
  const bonus = bonusEquipe(meta);
  appliquerBonusEquipeCombat(equipe, bonus); // un héros mort reste mort (pas de résurrection Dofawa)
  const damageMult = bonus.damageMult;
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
    enemyDamageBonus: effetsAscension(run.ascension).degatsMult ?? 1,
  });
  synchroniserPV(run, combatants); // PV conservés d'un nœud à l'autre
  if (gagne) {
    run.stats.combats += 1;
    run.stats.archis += await capturerArchis(combatants); // captures d'Archimonstres
  }
  return { gagne, combatants };
}

// Synchrone : gagner de l'XP ne fait plus qu'avancer le niveau et marquer l'animation
// (les stats découlent de (classe, niveau), il n'y a plus de points à dépenser ni
// d'écran à ouvrir pour les allouer).
function recompenserXP(run: RunState, gain: number): void {
  for (const p of run.persos) {
    if (gagnerXPPerso(p, gain, run.trancheId) > 0) p.flashNiveau = true; // pour l'animation dans le panneau d'équipe
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
async function recompenserButin(run: RunState, zoneId: string | undefined, type: NodeType, tauxType?: string): Promise<void> {
  if (!zoneId) return;
  const drops = tenterButin(run, zoneId, type, Math.random, tauxType);
  enregistrerCollection(meta, drops); // Armurerie : la collection persiste au-delà de la run
  run.stats.objets += drops.length;
  if (drops.length) await ui.showDrop(drops);
}

type Issue = "continue" | "wipe" | "victoire";

const LABEL_FR: Record<NodeType, string> = {
  combat: "un combat", combat_dur: "un combat dur", taverne: "une taverne",
  otomai: "un Otomai", zaap: "un zaap", donjon: "le donjon", hdv: "un Hôtel de vente",
  forgemagie: "un Forgemage",
};

async function resoudreType(
  run: RunState, type: NodeType, combatId: string | undefined, xp: number,
  zone?: ZoneDef, derniereZone?: boolean, eliteModifs?: string[],
): Promise<Issue> {
  const zoneId = zone?.id;
  switch (type) {
    case "combat":
    case "combat_dur": {
      const { gagne } = await resoudreCombat(run, combatId!, { elite: type === "combat_dur", eliteModifs, type, zone });
      if (!gagne) return "wipe";
      const toile = zoneId ? toileDeZone(zoneId) : 1;
      crediterKamas(run, Math.round(gainKamas(type, toile, Math.random) * multKamasEquipe(run)));
      recompenserXP(run, xpEffective(xp, toile, run.trancheId));
      // combat dur → butin au TAUX donjon (la prise de risque paie), mais le pool
      // exclusif reste celui des élites (les objets boss ne tombent qu'au donjon)
      await recompenserButin(run, zoneId, type, type === "combat_dur" ? "donjon" : undefined);
      return "continue";
    }
    case "taverne": {
      const pct = tavernePctAscension(run.ascension);
      const propos = propositionsRecrutement(run, Math.random);
      const choix = await ui.showTaverne(run.persos, propos, pct);
      if (choix.type === "soin") {
        soignerEquipe(run, pct);
        await ui.showTransition("🍺 Taverne", `L'équipe récupère ${Math.round(pct * 100)} % de ses PV max.`);
      } else {
        recruter(run, choix.classeId, choix.remplace);
        await ui.showTransition("🍺 Recrue !", `${CLASSES[choix.classeId].nom} rejoint l'équipe.`);
      }
      return "continue";
    }
    case "hdv": {
      await ui.showHDV(run, genererStockHDV(zoneId ?? "", Math.random), meta);
      return "continue";
    }
    case "forgemagie": {
      await ui.showForgemagie(run, meta);
      return "continue";
    }
    case "otomai": {
      run.philtres += 1;
      await ui.showTransition(
        "🧪 Otomai",
        `L'alchimiste te prépare un philtre d'archimonstre : les archis apparaissent plus souvent pour le reste de la run (${Math.round(chanceArchi(run) * 1000) / 10} %).`,
      );
      return "continue";
    }
    case "donjon": {
      const { gagne, combatants } = await resoudreCombat(run, combatId!, { type: "donjon", zone, derniereZone });
      if (!gagne) return "wipe";
      await recompenserButin(run, zoneId, type);
      const boss = combatants.find((c) => c.camp === "ennemi" && c.dofusLache);
      if (boss?.dofusLache) {
        // taux de base + prospection d'équipe (même formule que les items) + palier d'Ascension
        const mult = 1 + Math.min(DROP.capProspection, prospectionEquipe(run) * DROP.coefProspection);
        const taux = tauxDofusAscension(run.ascension);
        if (Math.random() < taux * mult) {
          ajouterDofus(meta, boss.dofusLache);
          const copies = meta.dofus.filter((d) => d === boss.dofusLache).length;
          await ui.showDofus(boss.dofusLache, copies);
        } else {
          await ui.showTransition("Donjon vaincu !", `Le boss n'a pas lâché son Dofus cette fois… (${Math.round(taux * 100)} % de chance)`);
        }
      }
      return "victoire";
    }
    default:
      return "continue";
  }
}

/** Un Zaap se résout en un type aléatoire à l'entrée (pioché dans la zone). */
async function deZaap(
  pools: ZonePools, exclus: NodeType[],
): Promise<{ type: NodeType; combatId?: string; xp: number }> {
  const type = tirerTypeZaap(Math.random, exclus);
  await ui.showZaap(LABEL_FR[type]);
  if (type === "combat") return { type, combatId: pick(pools.normales), xp: XP_PAR_TYPE.combat };
  if (type === "combat_dur") return { type, combatId: pick(pools.elite), xp: XP_PAR_TYPE.combat_dur };
  return { type, xp: 0 };
}

/** Parcourt le plateau d'une zone jusqu'au donjon.
 *  Sauvegarde la run après chaque nœud résolu (reprise possible à tout moment ;
 *  un combat en cours n'est pas sauvegardé → nœud à refaire). */
async function jouerZone(run: RunState, zone: ZoneDef, zoneIdx: number, derniereZone: boolean): Promise<"wipe" | "clear" | "accueil" | "recommencer-memes" | "recommencer-choix"> {
  if (!run.carte) {
    // pas de carte sauvegardée (nouvelle zone) — sinon on reprend celle en cours.
    // Les exclusions sont calculées ICI, donc une fois par zone : recruter son 4ᵉ
    // héros en milieu de zone laisse les tavernes déjà posées sur ce plateau, la
    // coupure prend effet à la zone suivante. On ne réécrit pas un plateau sous
    // les pieds du joueur.
    const nbModifsElite = effetsAscension(run.ascension).elitesDoubles ? 2 : 1;
    run.carte = genererCarte(Math.random, zone.pools, sansNoeudsDeZone(run, zone), nbModifsElite);
    sauverRunEnCours(zoneIdx, run);
  }
  for (;;) {
    const node = await ui.showCarte(run.carte!, run.persos, meta, zone.nom, run.inventaire, run.kamas, run.ascension, run.philtres);
    if (node === "accueil") return "accueil"; // la run reste sauvegardée → « Reprendre »
    if (node === "recommencer-memes" || node === "recommencer-choix") return node;

    let { type } = node;
    let combatId = node.combatId;
    let xp = node.xp ?? 0;
    // Le Zaap est résolu à l'entrée du nœud : avec l'effectif du moment (recrutement possible entretemps).
    if (type === "zaap") ({ type, combatId, xp } = await deZaap(zone.pools, sansNoeudsDeZone(run, zone)));

    const issue = await resoudreType(run, type, combatId, xp, zone, derniereZone, node.eliteModifs);

    node.visite = true;
    run.carte!.courant = node.id;

    if (issue === "wipe") return "wipe";
    if (issue === "victoire") {
      crediterKamas(run, Math.round(gainKamas("donjon", toileDeZone(zone.id), Math.random) * multKamasEquipe(run)));
      return "clear"; // donjon de la zone vaincu (+ Dofus)
    }
    sauverRunEnCours(zoneIdx, run); // étape franchie → point de reprise
  }
}

/** Ce que la boucle doit faire après une run : rien, ou en relancer une. */
type SuiteRun = null | { relancer: string[] | "selection"; ascension: number; trancheId: string };

async function jouerRun(
  reprise: RunSauvee | null,
  choixImpose?: string[],
  ascension = 0,
  trancheId = "t1",
): Promise<SuiteRun> {
  const tranche = trancheDe(reprise ? reprise.run.trancheId : trancheId);
  const zones = zonesDeTranche(tranche); // une run = une tranche
  if (!zones.length) {
    // Tranche déverrouillée mais sans contenu : on n'entre PAS dans la boucle
    // (sinon la victoire serait accordée sans le moindre combat). L'UI garde déjà
    // le clic, mais la reprise d'une save portant cette tranche passe aussi ici.
    await ui.showTransition("🚧 En construction", `${tranche.nom} n'a pas encore de zone : son contenu arrive dans un prochain chantier.`);
    return null; // aucun enregistrement de run, d'Ascension ni de succès
  }
  let run: RunState;
  let depart = 0;
  if (reprise) {
    run = reprise.run;
    depart = reprise.zoneIdx;
  } else {
    // Toute tranche démarre de la même façon : on compose une équipe neuve, qui
    // naît au niveau de DÉPART de la tranche (`TrancheDef.niveaux[0]`, 50 pour
    // la t2). Il n'y a plus d'héritage d'équipe d'une tranche à l'autre.
    const choix = choixImpose ?? (await ui.showChoixEquipe());
    if (!choix) return null; // retour à l'accueil depuis la sélection
    run = nouvelleRun(choix, ascension, tranche.id);
  }
  ui.setFondTranche(tranche.id); // fond d'écran de la tranche, retiré au retour à l'accueil
  try {
    for (let z = depart; z < zones.length; z++) {
      const zone = zones[z];
      const issue = await jouerZone(run, zone, z, z === zones.length - 1);
      if (issue === "accueil") return null; // run sauvegardée, retour au lobby
      if (issue === "recommencer-memes" || issue === "recommencer-choix") {
        effacerRunEnCours();
        enregistrerRun(meta, false); // recommencer = abandonner (run échouée)
        return {
          relancer: issue === "recommencer-memes" ? (run.choixDepart ?? run.persos.slice(0, 2).map((p) => p.classeId)) : "selection",
          ascension: run.ascension, // le palier de la run abandonnée est conservé pour la relance
          trancheId: tranche.id, // idem pour la tranche
        };
      }
      if (issue === "wipe") {
        effacerRunEnCours();
        enregistrerRun(meta, false); // run terminée : échec
        await ui.showRecap(run, false, verifierSucces(meta, run, false)); // mort : Meta conservée
        return null;
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
    enregistrerAscension(meta, tranche.id, run.ascension); // record d'Ascension de la tranche
    if (verifierDofusCauchemar(meta)) {
      await ui.showTransition("🥚 Dofus du Cauchemar", "Les cinq tranches sont tombées en Cauchemar.");
    }
    await ui.showRecap(run, true, verifierSucces(meta, run, true));
    return null;
  } finally {
    ui.setFondTranche(null);
  }
}

async function boucle(): Promise<void> {
  for (;;) {
    const reprise = chargerRunEnCours();
    const zones = zonesDeTranche(trancheDe(reprise?.run.trancheId ?? "t1"));
    const repriseInfo = reprise
      ? { zoneNom: zones[reprise.zoneIdx]?.nom ?? "?", zoneNum: reprise.zoneIdx + 1, nbZones: zones.length, ascension: reprise.run.ascension, trancheId: reprise.run.trancheId }
      : null;
    const { action, ascension, trancheId } = await ui.showStart(meta, () => reinitialiserMeta(meta), repriseInfo);
    if (action === "abandonner") {
      effacerRunEnCours();
      enregistrerRun(meta, false); // l'abandon compte comme une run échouée
      continue; // retour à l'accueil
    }
    let suite = await jouerRun(action === "reprendre" ? reprise : null, undefined, ascension, trancheId);
    // redémarrages en chaîne (bouton ↻ de la carte), sans repasser par l'accueil
    while (suite?.relancer) {
      suite = await jouerRun(null, suite.relancer === "selection" ? undefined : suite.relancer, suite.ascension, suite.trancheId);
    }
  }
}

void boucle();
