// =============================================================================
//  ui/carte.ts — écran du plateau (carte de nœuds), transition et zaap.
// =============================================================================
import { CLASSES, COMBATS, MONSTRES, MODIFICATEURS_ELITE } from "../data";
import { atteignables, noeud } from "../carte";
import { escapeHtml, ecran, root } from "./dom";
import {
  A,
  BTN_CONTINUER,
  MENU_PERSOS,
  MENU_FORMATION,
  MENU_INVENTAIRE,
  MENU_BESTIAIRE,
  MENU_ARMURERIE,
  MENU_DOFUS,
  MENU_ACCUEIL,
  MENU_RESTART,
  MENU_RESTART_PERSO,
  CASE_DEPART,
} from "./assets";
import { classSymbol, pastillesElements, kamasHtml } from "./composants";
import { pvMaxPerso, type PersoState } from "../run";
import { showStatPanel, showFormation } from "./equipe";
import { showInventaire } from "./inventaire";
import { showBestiaire, showArmurerie } from "./collections";
import { showCollectionDofus } from "./accueil";
import type { GameMap, ItemInstance, MapNode, Meta, NodeType } from "../types";

export function showZaap(typeRevele: string): Promise<void> {
  return showTransition("🌀 Zaap", `La rencontre se révèle : ${typeRevele}.`);
}

export function showTransition(
  message: string,
  sousTitre: string,
): Promise<void> {
  return new Promise((res) => {
    ecran(`
      <h1>${escapeHtml(message)}</h1>
      <p class="sous-titre">${escapeHtml(sousTitre)}</p>
      <div class="boutons-ecran"><button id="btn-next" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("btn-next")?.addEventListener("click", () => res());
  });
}

// --- Plateau (carte de nœuds) ------------------------------------------------
const NODE_ICON: Record<NodeType, string> = {
  combat: "⚔️",
  combat_dur: "💀",
  taverne: "🍺",
  otomai: "🔄",
  zaap: "🌀",
  donjon: "🐉",
  hdv: "🪙",
  forgemagie: "🔨",
};
const NODE_LABEL: Record<NodeType, string> = {
  combat: "Combat",
  combat_dur: "Combat dur",
  taverne: "Taverne",
  otomai: "Otomai",
  zaap: "Zaap",
  donjon: "Donjon",
  hdv: "Hôtel de vente",
  forgemagie: "Forgemage",
};
// fichier de tuile par type de nœud (le type "combat_dur" utilise l'asset "combat_elite")
const CASE_FILE: Record<NodeType, string> = {
  combat: "combat",
  combat_dur: "combat_elite",
  taverne: "taverne",
  otomai: "otomai",
  zaap: "zaap",
  donjon: "donjon",
  hdv: "hdv",
  forgemagie: "forgemagie",
};
/** Sprite du boss d'un nœud donjon (résolu depuis son combat → 1er ennemi « boss »). */
function bossImg(n: MapNode): string | null {
  const ennemis = n.combatId ? COMBATS[n.combatId]?.ennemis : undefined;
  const ent = ennemis?.find((e) => MONSTRES[e.monstre]?.boss) ?? ennemis?.[0];
  const img = ent ? MONSTRES[ent.monstre]?.img : undefined;
  return img ? A(img) : null;
}

// La case Donjon affiche le sprite du boss de la zone plutôt qu'une tuile de case.
const caseAsset = (n: MapNode): string =>
  (n.type === "donjon" ? bossImg(n) : null) ??
  A(`/assets/cases/${CASE_FILE[n.type]}.png`);

// Plateau HORIZONTAL : la progression va de gauche (Départ) à droite (Donjon).
const HAUTEUR_CARTE = 440; // hauteur du treillis (3 rangées de large en quinconce)
const ESPACE_COL = 116; // espacement horizontal entre deux rangées de la progression
const MARGE_COTE = 56;

export function showCarte(
  carte: GameMap,
  persos: PersoState[],
  meta: Meta,
  zoneNom: string,
  inventaire: ItemInstance[] = [],
  kamas = 0,
): Promise<MapNode | "accueil" | "recommencer-memes" | "recommencer-choix"> {
  return new Promise((res) => {
    const draw = () => {
      const maxL = Math.max(...carte.noeuds.map((n) => n.ligne));
      const W = MARGE_COTE * 2 + (maxL + 1) * ESPACE_COL; // +1 colonne pour le Départ
      const departPos = { x: MARGE_COTE, y: HAUTEUR_CARTE / 2 };
      const pos = new Map<string, { x: number; y: number }>();
      // Treillis couché : la « ligne » de génération devient l'axe X (progression),
      // la « colonne » (offset centré autour de 0) devient l'axe Y.
      const parLigne = new Map<number, number>();
      for (const n of carte.noeuds) parLigne.set(n.ligne, (parLigne.get(n.ligne) ?? 0) + 1);
      const maxNb = Math.max(1, ...parLigne.values());
      const pas = HAUTEUR_CARTE / (maxNb + 1);
      for (const n of carte.noeuds) {
        pos.set(n.id, {
          x: MARGE_COTE + (n.ligne + 1) * ESPACE_COL,
          y: HAUTEUR_CARTE / 2 + n.colonne * pas,
        });
      }

      const reach = new Set(atteignables(carte).map((n) => n.id));
      const depuisCourant = (nid: string) =>
        carte.courant === nid ||
        (carte.courant === null && noeud(carte, nid)?.ligne === 0);

      const lignesSvg = carte.noeuds
        .flatMap((n) =>
          n.suivants.map((s) => {
            const a = pos.get(n.id)!;
            const b = pos.get(s)!;
            const actif = reach.has(s) && depuisCourant(n.id);
            return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="arete ${actif ? "arete-actif" : ""}"/>`;
          }),
        )
        .join("");

      // chemins du Départ vers les nœuds de la 1ʳᵉ rangée
      const departSvg = carte.depart
        .map((id) => {
          const b = pos.get(id)!;
          return `<line x1="${departPos.x}" y1="${departPos.y}" x2="${b.x}" y2="${b.y}" class="arete ${carte.courant === null ? "arete-actif" : ""}"/>`;
        })
        .join("");

      const boutons = carte.noeuds
        .map((n) => {
          const p = pos.get(n.id)!;
          const r = reach.has(n.id);
          const cls = [
            "map-node",
            `t-${n.type}`,
            n.visite ? "visite" : "",
            n.id === carte.courant ? "courant" : "",
            r ? "atteignable" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const modif = n.type === "combat_dur" ? MODIFICATEURS_ELITE.find((m) => m.id === n.eliteModif) : undefined;
          const tip = modif ? ` data-tip="${escapeHtml(`Combat dur — ${modif.nom}
${modif.desc}
Butin au taux donjon.`)}"` : "";
          return `<button class="${cls}" data-id="${n.id}" ${r ? "" : "disabled"} style="left:${p.x}px;top:${p.y}px"${tip}>
            <span class="case-art">
              <img class="case-img" src="${caseAsset(n)}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />
              <span class="mn-icon" style="display:none">${NODE_ICON[n.type]}</span>
            </span>
            <span class="mn-lbl">${NODE_LABEL[n.type]}${modif ? `<small class="mn-modif">${escapeHtml(modif.nom)}</small>` : ""}</span>
          </button>`;
        })
        .join("");

      const points = persos.reduce((s, p) => s + p.progression.pointsDispo, 0);
      const asideEquipe = persos
        .map((p) => {
          const classe = CLASSES[p.classeId];
          const pvMax = pvMaxPerso(p); // équipement (vita + PV plats) inclus
          const pct = Math.max(0, Math.round((p.pvActuels / pvMax) * 100));
          return `
            <div class="aside-perso ${p.flashNiveau ? "flash-niv" : ""}">
              ${p.flashNiveau ? `<span class="niv-flash">⬆ Niveau ${p.progression.niveau} !</span>` : ""}
              <img class="aside-sym" src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
              <div class="aside-info">
                <div class="aside-nom">${escapeHtml(classe.nom)}<span class="aside-niv">Niv.${p.progression.niveau}</span>${pastillesElements(p)}</div>
                <div class="barre-pv mini">
                  <div class="barre-pv-rempli" style="transform:scaleX(${pct / 100})"></div>
                  <span class="pv-txt">${Math.max(0, Math.round(p.pvActuels))} / ${pvMax}</span>
                </div>
              </div>
            </div>`;
        })
        .join("");
      persos.forEach((p) => { p.flashNiveau = false; }); // le flash ne joue qu'une fois

      root.innerHTML = `
        <div class="carte-ecran map-layout">
          <header class="map-topbar">
            <h2 class="zone-titre">${escapeHtml(zoneNom)}</h2>
            <div class="topbar-actions">
              <button id="carte-persos" class="aside-icone" title="Caractéristiques${points ? ` · ${points} pts à dépenser` : ""}"><img src="${MENU_PERSOS}" alt="Caractéristiques" onerror="this.remove()" />${points ? `<span class="aside-compte">${points}</span>` : ""}</button>
              <button id="carte-formation" class="aside-icone" title="Formation"><img src="${MENU_FORMATION}" alt="Formation" onerror="this.remove()" /></button>
              <button id="carte-equip" class="aside-icone" title="Équipement${inventaire.length ? ` · ${inventaire.length} objet(s)` : ""}"><img src="${MENU_INVENTAIRE}" alt="Équipement" onerror="this.remove()" />${inventaire.length ? `<span class="aside-compte">${inventaire.length}</span>` : ""}</button>
              <button id="carte-bestiaire" class="aside-icone" title="Bestiaire"><img src="${MENU_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /></button>
              <button id="carte-armurerie" class="aside-icone" title="Armurerie"><img src="${MENU_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /></button>
              <button id="carte-dofus" class="aside-icone" title="Dofus"><img src="${MENU_DOFUS}" alt="Dofus" onerror="this.remove()" /></button>
              <span class="topbar-sep"></span>
              <button id="carte-accueil" class="aside-icone" title="Retour à l'accueil (la run reste sauvegardée)"><img src="${MENU_ACCUEIL}" alt="Accueil" onerror="this.remove()" /></button>
              <button id="carte-restart" class="aside-icone" title="Recommencer avec les mêmes héros (abandonne la run en cours)"><img src="${MENU_RESTART}" alt="Recommencer" onerror="this.remove()" /></button>
              <button id="carte-restart-choix" class="aside-icone" title="Recommencer en choisissant d'autres héros (abandonne la run en cours)"><img src="${MENU_RESTART_PERSO}" alt="Recommencer (autres héros)" onerror="this.remove()" /></button>
            </div>
          </header>
          <div class="map-scroll"><div class="map-zone" style="width:${W}px;height:${HAUTEUR_CARTE}px">
            <svg class="map-svg" width="${W}" height="${HAUTEUR_CARTE}">${departSvg}${lignesSvg}</svg>
            ${boutons}
            <div class="map-depart" style="left:${departPos.x}px;top:${departPos.y}px">
              <span class="case-art">
                <img class="case-img" src="${CASE_DEPART}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />
                <span class="depart-art" style="display:none">🚩</span>
              </span>
              <span class="mn-lbl">Départ</span>
            </div>
          </div></div>
          <footer class="map-equipe-bar">
            <div class="equipe-bar">${asideEquipe}</div>
            <div class="aside-kamas" title="Kamas de la run (perdus à la mort)">${kamasHtml(kamas)}</div>
          </footer>
        </div>`;

      root
        .querySelectorAll<HTMLButtonElement>(".map-node.atteignable")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const n = noeud(carte, btn.dataset.id!);
            if (n) res(n);
          });
        });
      document
        .getElementById("carte-persos")
        ?.addEventListener("click", async () => {
          await showStatPanel(persos, undefined, undefined, true, meta);
          draw();
        });
      document
        .getElementById("carte-formation")
        ?.addEventListener("click", async () => {
          await showFormation(persos);
          draw();
        });
      document
        .getElementById("carte-equip")
        ?.addEventListener("click", async () => {
          await showInventaire(persos, inventaire);
          draw();
        });
      document
        .getElementById("carte-bestiaire")
        ?.addEventListener("click", async () => {
          await showBestiaire(meta);
          draw();
        });
      document
        .getElementById("carte-armurerie")
        ?.addEventListener("click", async () => {
          await showArmurerie(meta);
          draw();
        });
      document
        .getElementById("carte-dofus")
        ?.addEventListener("click", async () => {
          await showCollectionDofus(meta);
          draw();
        });
      document
        .getElementById("carte-accueil")
        ?.addEventListener("click", () => res("accueil"));
      document
        .getElementById("carte-restart")
        ?.addEventListener("click", () => res("recommencer-memes"));
      document
        .getElementById("carte-restart-choix")
        ?.addEventListener("click", () => res("recommencer-choix"));
    };
    draw();
  });
}
