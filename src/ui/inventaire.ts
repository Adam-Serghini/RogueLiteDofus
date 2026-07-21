// =============================================================================
//  ui/inventaire.ts — Écrans Équipement (équiper/déséquiper), Butin (drop de
//  fin de combat) et Paramètres (touche de fin de tour, préréglages, sauvegarde).
// =============================================================================
import { ITEMS, RARETE_INFO, CLASSES } from "../data";
import { ELEMENTS } from "../combat";
import { sauverConfig, libelleTouche } from "../config";
import { elementAsset, itemImg, BTN_RETOUR, BTN_CONTINUER, ICON_VITA } from "./assets";
import { root, ecran, escapeHtml, config } from "./dom";
import {
  elNom,
  classSymbol,
  SLOTS,
  SLOT_NOM,
  itemLignes,
  rareteCls,
  itemNomHtml,
  itemStatsHtml,
} from "./composants";
import {
  classesDisponibles,
  bonusEquipement,
  pvMaxPerso,
  equiper,
  desequiper,
  exporterSauvegarde,
  importerSauvegarde,
  peutEquiper,
  toileDeItem,
  type PersoState,
} from "../run";
import type { Element, EquipSlot, ItemInstance } from "../types";

// Tri de l'inventaire (persistant sur la session) : par toile d'obtention ou par type d'objet.
let triInventaire: "toile" | "type" = "toile";

/** Ordre d'affichage de l'inventaire selon le tri actif ; chaque entrée garde
 *  son index RÉEL dans `inventaire` (le clic/drag référence data-index). */
function ordonnerInventaire(inventaire: ItemInstance[]): { inst: ItemInstance; i: number }[] {
  const nomDe = (inst: ItemInstance) => ITEMS[inst.id]?.nom ?? inst.id;
  const slotRang = (inst: ItemInstance) => SLOTS.indexOf(ITEMS[inst.id]?.slot ?? "arme");
  return inventaire
    .map((inst, i) => ({ inst, i }))
    .sort((a, b) => {
      const cles = triInventaire === "toile"
        ? [toileDeItem(a.inst.id) - toileDeItem(b.inst.id), slotRang(a.inst) - slotRang(b.inst)]
        : [slotRang(a.inst) - slotRang(b.inst), toileDeItem(a.inst.id) - toileDeItem(b.inst.id)];
      return cles.find((c) => c !== 0) ?? nomDe(a.inst).localeCompare(nomDe(b.inst));
    });
}

/** Écran Équipement : équiper/déséquiper les pièces trouvées, par personnage. */
export function showInventaire(
  persos: PersoState[],
  inventaire: ItemInstance[],
): Promise<void> {
  return new Promise((res) => {
    let sel = 0; // index du perso sélectionné
    const draw = () => {
      // le re-render reconstruit tout l'écran : on préserve les positions de
      // scroll (page + liste d'inventaire) pour ne pas remonter en haut au clic
      const scrollInv = root.querySelector<HTMLElement>(".equip-inv")?.scrollTop ?? 0;
      const scrollPage = document.scrollingElement?.scrollTop ?? 0;
      const perso = persos[sel];
      const onglets = persos
        .map(
          (
            p,
            i,
          ) => `<button class="equip-onglet ${i === sel ? "sel" : ""}" data-perso="${i}">
          <img src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />${escapeHtml(CLASSES[p.classeId].nom)}</button>`,
        )
        .join("");

      const slots = SLOTS.map((slot) => {
        const inst = perso.equipement[slot];
        const item = inst ? ITEMS[inst.id] : undefined;
        return `<div class="equip-slot ${item ? "rempli" : "vide"}${rareteCls(inst)}" data-slot="${slot}" ${item ? `data-desequip="${slot}" draggable="true"` : ""}>
          <span class="slot-nom">${SLOT_NOM[slot]}</span>
          ${
            item && inst
              ? `<img class="slot-img" src="${itemImg(item.id)}" alt="" onerror="this.remove()" /><span class="slot-item">${itemNomHtml(inst)}<small>${itemStatsHtml(inst)}</small></span>`
              : `<span class="slot-vide-txt">— vide —</span>`
          }
        </div>`;
      }).join("");

      const inv = inventaire.length
        ? ordonnerInventaire(inventaire)
            .map(({ inst, i }) => {
              const it = ITEMS[inst.id];
              const equipable = peutEquiper(perso, inst.id);
              return `<button class="item-carte${rareteCls(inst)}${equipable ? "" : " inequipable"}" data-index="${i}" draggable="true" ${equipable ? "" : `title="Équipable uniquement sur un personnage de la ligne avant"`}>
              <img src="${itemImg(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${itemNomHtml(inst)}<small>T${toileDeItem(inst.id)} · ${SLOT_NOM[it.slot]} ${itemStatsHtml(inst)}</small></span>
            </button>`;
            })
            .join("")
        : `<p class="muet">Inventaire vide — gagne des combats pour trouver de l'équipement.</p>`;

      const b = bonusEquipement(perso);
      const totalTxt = itemLignes(b.stats, b.pvBonus, b.resistances) || "aucun bonus";

      ecran(`
        <h1>Équipement</h1>
        <div class="equip-onglets">${onglets}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3>${escapeHtml(CLASSES[perso.classeId].nom)} · PV max ${pvMaxPerso(perso)}</h3>
            <div class="equip-slots">${slots}</div>
            <p class="equip-total muet">Bonus total : ${totalTxt}</p>
          </div>
          <div class="equip-col">
            <h3>Inventaire (${inventaire.length})
              <span class="equip-tri">Tri :
                <button id="tri-toile" class="tri-btn${triInventaire === "toile" ? " actif" : ""}" aria-pressed="${triInventaire === "toile"}" title="Trier par toile d'obtention">Toile</button>
                <button id="tri-type" class="tri-btn${triInventaire === "type" ? " actif" : ""}" aria-pressed="${triInventaire === "type"}" title="Trier par type d'objet">Type</button>
              </span>
            </h3>
            <div class="equip-inv">${inv}</div>
          </div>
        </div>
        <div class="boutons-ecran"><button id="equip-retour" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      // glisser-déposer : payload "inv:<index>" (exemplaire d'inventaire) ou "slot:<slot>" (pièce équipée)
      const equiperIndex = (index: number) => {
        if (index >= 0 && index < inventaire.length) {
          equiper(inventaire, perso, index);
          draw();
        }
      };
      const desequiperSlot = (slot: EquipSlot) => {
        desequiper(inventaire, perso, slot);
        draw();
      };

      root.querySelectorAll<HTMLButtonElement>(".equip-onglet").forEach((btn) =>
        btn.addEventListener("click", () => {
          sel = Number(btn.dataset.perso);
          draw();
        }),
      );

      document.getElementById("tri-toile")?.addEventListener("click", () => { triInventaire = "toile"; draw(); });
      document.getElementById("tri-type")?.addEventListener("click", () => { triInventaire = "type"; draw(); });

      root.querySelectorAll<HTMLButtonElement>(".item-carte").forEach((btn) => {
        const index = Number(btn.dataset.index);
        btn.addEventListener("click", () => equiperIndex(index)); // clic = équiper (fallback)
        btn.addEventListener("dragstart", (e) => {
          e.dataTransfer!.setData("text/plain", `inv:${index}`);
          e.dataTransfer!.effectAllowed = "move";
          btn.classList.add("drag-src");
        });
        btn.addEventListener("dragend", () => btn.classList.remove("drag-src"));
      });

      root.querySelectorAll<HTMLElement>(".equip-slot").forEach((el) => {
        const slot = el.dataset.slot as EquipSlot;
        if (el.classList.contains("rempli")) {
          el.addEventListener("click", () => desequiperSlot(slot)); // clic = déséquiper (fallback)
          el.addEventListener("dragstart", (e) => {
            e.dataTransfer!.setData("text/plain", `slot:${slot}`);
            e.dataTransfer!.effectAllowed = "move";
            el.classList.add("drag-src");
          });
          el.addEventListener("dragend", () => el.classList.remove("drag-src"));
        }
        // chaque slot accepte un objet de l'inventaire (rangé automatiquement dans le bon slot)
        el.addEventListener("dragover", (e) => {
          if (!e.dataTransfer?.types.includes("text/plain")) return;
          e.preventDefault();
          el.classList.add("drop-cible");
        });
        el.addEventListener("dragleave", () =>
          el.classList.remove("drop-cible"),
        );
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          el.classList.remove("drop-cible");
          const data = e.dataTransfer!.getData("text/plain");
          if (data.startsWith("inv:")) equiperIndex(Number(data.slice(4)));
        });
      });

      // la zone d'inventaire accepte une pièce équipée → déséquipe
      const invZone = root.querySelector<HTMLElement>(".equip-inv");
      if (invZone) {
        invZone.addEventListener("dragover", (e) => {
          if (!e.dataTransfer?.types.includes("text/plain")) return;
          e.preventDefault();
          invZone.classList.add("drop-cible");
        });
        invZone.addEventListener("dragleave", () =>
          invZone.classList.remove("drop-cible"),
        );
        invZone.addEventListener("drop", (e) => {
          e.preventDefault();
          invZone.classList.remove("drop-cible");
          const data = e.dataTransfer!.getData("text/plain");
          if (data.startsWith("slot:"))
            desequiperSlot(data.slice(5) as EquipSlot);
        });
      }

      document
        .getElementById("equip-retour")
        ?.addEventListener("click", () => res());

      // restaure les positions de scroll capturées en tête de draw()
      const nouvelleInv = root.querySelector<HTMLElement>(".equip-inv");
      if (nouvelleInv) nouvelleInv.scrollTop = scrollInv;
      if (document.scrollingElement) document.scrollingElement.scrollTop = scrollPage;
    };
    draw();
  });
}

/** Écran Butin : annonce les pièces d'équipement obtenues après un combat. */
export function showDrop(drops: ItemInstance[]): Promise<void> {
  return new Promise((res) => {
    const cartes = drops
      .map((inst) => {
        const it = ITEMS[inst.id];
        return `<div class="drop-item${rareteCls(inst)}">
        <img src="${itemImg(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
        <span class="drop-nom">${itemNomHtml(inst)}${inst.rarete ? `<span class="drop-rarete inom-${inst.rarete}">${RARETE_INFO[inst.rarete].nom}</span>` : ""}<small>${SLOT_NOM[it.slot]} ${itemStatsHtml(inst)}</small></span>
      </div>`;
      })
      .join("");
    ecran(`
      <h1>🎁 Butin !</h1>
      <p class="sous-titre">L'équipe ramasse ${drops.length} pièce${drops.length > 1 ? "s" : ""} d'équipement.</p>
      <div class="drop-liste">${cartes}</div>
      <div class="boutons-ecran"><button id="drop-ok" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("drop-ok")?.addEventListener("click", () => res());
  });
}

/** Écran Paramètres : touche de fin de tour (rebindable) + auto-passe. */
export function showSettings(): Promise<void> {
  return new Promise((res) => {
    let capture = false;
    const draw = () => {
      ecran(`
        <h1>Paramètres</h1>
        <div class="settings">
          <div class="setting-ligne">
            <span class="setting-lbl">Touche « Terminer le tour »</span>
            <button id="set-touche" class="secondaire">${capture ? "Appuie sur une touche…" : `<kbd>${escapeHtml(libelleTouche(config.toucheFinTour))}</kbd>`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Passer le tour automatiquement<br><small class="muet">quand aucune action n'est possible</small></span>
            <button id="set-auto" class="secondaire ${config.autoFinTour ? "on" : ""}">${config.autoFinTour ? "Activé" : "Désactivé"}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Sauvegarde<br><small class="muet">Dofus, succès, réglages et run en cours — pour changer de PC</small></span>
            <span class="setting-actions">
              <button id="set-export" class="secondaire">Exporter</button>
              <button id="set-import" class="secondaire">Importer…</button>
              <input id="set-import-file" type="file" accept=".json,application/json" style="display:none" />
            </span>
          </div>
          <p id="set-import-msg" class="muet settings-sous" style="display:none"></p>
        </div>
        <h2 class="settings-titre">Préréglages des héros</h2>
        <p class="muet settings-sous">Élément de frappe &amp; position par défaut, appliqués au début de chaque run. « Libre » = allocation manuelle.</p>
        <div class="presets">
          ${classesDisponibles().map((cid) => {
            const elSel = config.elements[cid];
            const rangee = config.formation[cid] === "arriere" ? "arriere" : "avant";
            return `<div class="preset-classe">
              <img class="preset-sym" src="${classSymbol(cid)}" alt="" onerror="this.remove()" />
              <span class="preset-nom">${escapeHtml(CLASSES[cid].nom)}</span>
              <div class="preset-el">
                ${ELEMENTS.map((el) => `<button class="form-el-btn elem-${el} ${elSel === el ? "sel" : ""}" data-classe="${cid}" data-el="${el}" title="${elNom[el]}"><img src="${elementAsset(el)}" alt="" onerror="this.remove()" /><span>${elNom[el]}</span></button>`).join("")}
                <button class="form-el-btn alloc-vita ${elSel === "vitalite" ? "sel" : ""}" data-classe="${cid}" data-el="vitalite" title="Points → Vitalité (PV)"><img src="${ICON_VITA}" alt="" onerror="this.remove()" /><span>Vitalité</span></button>
                <button class="form-el-btn libre ${elSel ? "" : "sel"}" data-classe="${cid}" data-el="libre" title="Allocation manuelle">Libre</button>
                <span class="preset-sep"></span>
                <span class="preset-pos">
                  <button class="form-el-btn ${rangee === "avant" ? "sel" : ""}" data-classe="${cid}" data-rangee="avant" title="Ligne avant (les héros s'y empilent)">Avant</button>
                  <button class="form-el-btn ${rangee === "arriere" ? "sel" : ""}" data-classe="${cid}" data-rangee="arriere" title="Ligne arrière (les héros s'y empilent)">Arrière</button>
                </span>
              </div>
            </div>`;
          }).join("")}
        </div>
        <div class="boutons-ecran"><button id="set-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      root.querySelectorAll<HTMLButtonElement>(".preset-el .form-el-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cid = btn.dataset.classe!;
          const el = btn.dataset.el!;
          if (el === "libre") delete config.elements[cid];
          else config.elements[cid] = el as Element | "vitalite";
          sauverConfig(config);
          draw();
        });
      });
      root.querySelectorAll<HTMLButtonElement>(".preset-pos [data-rangee]").forEach((btn) => {
        btn.addEventListener("click", () => {
          config.formation[btn.dataset.classe!] = btn.dataset.rangee as "avant" | "arriere";
          sauverConfig(config);
          draw();
        });
      });
      document.getElementById("set-touche")?.addEventListener("click", () => {
        capture = true;
        draw();
        const onKey = (e: KeyboardEvent) => {
          e.preventDefault();
          document.removeEventListener("keydown", onKey, true);
          config.toucheFinTour = e.key;
          sauverConfig(config);
          capture = false;
          draw();
        };
        document.addEventListener("keydown", onKey, true);
      });
      document.getElementById("set-auto")?.addEventListener("click", () => {
        config.autoFinTour = !config.autoFinTour;
        sauverConfig(config);
        draw();
      });
      // export : télécharge un fichier JSON daté
      document.getElementById("set-export")?.addEventListener("click", () => {
        const blob = new Blob([exporterSauvegarde()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `roguefus-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      // import : lit le fichier, remplace les données locales puis recharge le jeu
      const fichierImport = document.getElementById("set-import-file") as HTMLInputElement | null;
      document.getElementById("set-import")?.addEventListener("click", () => fichierImport?.click());
      fichierImport?.addEventListener("change", async () => {
        const f = fichierImport.files?.[0];
        if (!f) return;
        const msg = document.getElementById("set-import-msg");
        const ok = importerSauvegarde(await f.text());
        if (ok) {
          if (msg) { msg.textContent = "✓ Sauvegarde importée — rechargement…"; msg.style.display = ""; }
          setTimeout(() => location.reload(), 600); // ré-initialise Meta/config/run proprement
        } else if (msg) {
          msg.textContent = "✗ Fichier invalide : ce n'est pas une sauvegarde Roguefus Lite.";
          msg.style.display = "";
        }
      });
      document
        .getElementById("set-retour")
        ?.addEventListener("click", () => res());
    };
    draw();
  });
}
