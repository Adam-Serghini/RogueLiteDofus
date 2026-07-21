// =============================================================================
//  ui/boutique.ts — Écrans Hôtel de vente et Forgemagie.
// =============================================================================
import { CLASSES, ITEMS, RARETE_INFO, KAMAS } from "../data";
import { itemImg, BTN_RETOUR } from "./assets";
import { root, ecran, escapeHtml } from "./dom";
import {
  kamasHtml,
  SLOT_NOM,
  rareteCls,
  itemNomHtml,
  itemStatsHtml,
} from "./composants";
import {
  prixVente,
  vendreItem,
  vendreTout,
  acheterArticle,
  enregistrerCollection,
  rareteSuivante,
  coutForge,
  forgerInstance,
  instanceDuTier,
  type ArticleHDV,
  type RunState as RunStateT,
} from "../run";
import type {
  ItemInstance,
  Meta,
} from "../types";

/** Hôtel de vente : achat (stock de la zone + toiles traversées) et revente. */
export function showHDV(run: RunStateT, stock: ArticleHDV[], meta?: Meta): Promise<void> {
  return new Promise((res) => {
    const draw = () => {
      const rayon = stock.length
        ? stock
          .map((art, i) => {
            const abordable = run.kamas >= art.prix;
            return `<button class="item-carte hdv-achat${rareteCls(art.inst)}" data-achat="${i}" ${abordable ? "" : "disabled"}>
              <img src="${itemImg(art.inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${itemNomHtml(art.inst)}<small>${SLOT_NOM[ITEMS[art.inst.id].slot]} ${itemStatsHtml(art.inst)}</small></span>
              <span class="hdv-prix">${kamasHtml(art.prix)}</span>
            </button>`;
          })
          .join("")
        : `<p class="muet">Rayons vides — reviens à un prochain Hôtel de vente.</p>`;
      const vente = run.inventaire.length
        ? run.inventaire
          .map((inst, i) => `<button class="item-carte hdv-vente${rareteCls(inst)}" data-vente="${i}">
              <img src="${itemImg(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${itemNomHtml(inst)}<small>${SLOT_NOM[ITEMS[inst.id].slot]} ${itemStatsHtml(inst)}</small></span>
              <span class="hdv-prix vente">${kamasHtml(prixVente(inst))}</span>
            </button>`)
          .join("")
        : `<p class="muet">Rien à vendre — l'équipement non équipé de l'inventaire se revend ici.</p>`;
      ecran(`
        <h1>🪙 Hôtel de vente</h1>
        <p class="sous-titre">Tout le catalogue de la zone (exclusifs boss/élite compris) : local en épique+, zone suivante dès le rare. Revente à 50 % du prix.</p>
        <div class="hdv-solde">${kamasHtml(run.kamas)}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3>À vendre (${stock.length})</h3>
            <div class="equip-inv">${rayon}</div>
          </div>
          <div class="equip-col">
            <h3>Ton inventaire (${run.inventaire.length})
              ${run.inventaire.length ? `<button id="hdv-vendre-tout" class="secondaire hdv-tout" title="Vendre tout l'inventaire (l'équipement porté n'est pas concerné)">Vendre tout · ${kamasHtml(run.inventaire.reduce((t, i) => t + prixVente(i), 0))}</button>` : ""}
            </h3>
            <div class="equip-inv">${vente}</div>
          </div>
        </div>
        <div class="boutons-ecran"><button id="hdv-retour" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      root.querySelectorAll<HTMLButtonElement>("[data-achat]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.achat);
          const inst = stock[idx]?.inst;
          if (acheterArticle(run, stock, idx)) {
            if (meta && inst) enregistrerCollection(meta, [inst]); // l'achat compte pour l'Armurerie
            draw();
          }
        }),
      );
      root.querySelectorAll<HTMLButtonElement>("[data-vente]").forEach((btn) =>
        btn.addEventListener("click", () => {
          if (vendreItem(run, Number(btn.dataset.vente))) draw();
        }),
      );
      document.getElementById("hdv-vendre-tout")?.addEventListener("click", () => {
        if (vendreTout(run) > 0) draw();
      });
      document.getElementById("hdv-retour")?.addEventListener("click", () => res());
    };
    draw();
  });
}

/** Forgemagie : monter un objet (inventaire OU équipé) au palier de rareté
 *  suivant, contre des kamas. Le Forgemage téméraire : moins cher, 30 % d'échec. */
export function showForgemagie(run: RunStateT, meta?: Meta): Promise<void> {
  return new Promise((res) => {
    let message = ""; // résultat de la dernière forge (réussite / échec)
    const draw = () => {
      // tous les exemplaires forgeables : inventaire + équipement de chaque héros
      const entrees: { inst: ItemInstance; ou: string }[] = [
        ...run.inventaire.map((inst) => ({ inst, ou: "Inventaire" })),
        ...run.persos.flatMap((p) =>
          Object.values(p.equipement)
            .filter((i): i is ItemInstance => !!i)
            .map((inst) => ({ inst, ou: `Équipé — ${CLASSES[p.classeId].nom}` }))),
      ];
      const forgeables = entrees.filter((e) => rareteSuivante(e.inst));
      const cartes = forgeables.length
        ? forgeables
          .map(({ inst, ou }, i) => {
            const cible = rareteSuivante(inst)!;
            const apercu = instanceDuTier(inst.id, cible)!;
            const cout = coutForge(inst)!;
            const coutTem = coutForge(inst, true)!;
            return `<div class="item-carte forge-carte${rareteCls(inst)}">
              <img src="${itemImg(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${itemNomHtml(inst)}<small>${ou} ${itemStatsHtml(inst)}</small>
                <small class="forge-apercu">→ <span class="inom-${cible}">${RARETE_INFO[cible].nom}</span> ${itemStatsHtml(apercu)}</small>
              </span>
              <span class="forge-boutons">
                <button class="secondaire" data-forge="${i}" ${run.kamas < cout ? "disabled" : ""} title="Forge garantie">${kamasHtml(cout)}</button>
                <button class="secondaire forge-temeraire" data-temeraire="${i}" ${run.kamas < coutTem ? "disabled" : ""} title="Forgemage téméraire : ${Math.round(KAMAS.forgeTemeraire.pEchec * 100)} % d'échec (kamas perdus, objet intact)">🎲 ${kamasHtml(coutTem)}</button>
              </span>
            </div>`;
          })
          .join("")
        : `<p class="muet">Rien à forger — tout ton équipement à rareté est déjà au maximum.</p>`;
      ecran(`
        <h1>🔨 Forgemagie</h1>
        <p class="sous-titre">Le Forgemage monte un objet au palier de rareté supérieur — même équipé. Son apprenti téméraire fait moitié prix… mais rate ${Math.round(KAMAS.forgeTemeraire.pEchec * 100)} % de ses forges.</p>
        <div class="hdv-solde">${kamasHtml(run.kamas)}</div>
        ${message ? `<p class="forge-message">${message}</p>` : ""}
        <div class="equip-inv forge-liste">${cartes}</div>
        <div class="boutons-ecran"><button id="forge-retour" class="btn-retour" title="Retour au plateau"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
      `);
      const forger = (i: number, temeraire: boolean) => {
        const inst = forgeables[i]?.inst;
        if (!inst) return;
        const resultat = forgerInstance(run, inst, temeraire, Math.random);
        if (resultat === "forge") {
          message = `✨ ${escapeHtml(ITEMS[inst.id]?.nom ?? inst.id)} forgé en <span class="inom-${inst.rarete}">${RARETE_INFO[inst.rarete!].nom}</span> !`;
          if (meta) enregistrerCollection(meta, [inst]); // l'Armurerie enregistre le palier forgé
        } else if (resultat === "echec") {
          message = `💥 La forge téméraire échoue… l'objet est intact, les kamas sont perdus.`;
        }
        draw();
      };
      root.querySelectorAll<HTMLButtonElement>("[data-forge]").forEach((btn) =>
        btn.addEventListener("click", () => forger(Number(btn.dataset.forge), false)));
      root.querySelectorAll<HTMLButtonElement>("[data-temeraire]").forEach((btn) =>
        btn.addEventListener("click", () => forger(Number(btn.dataset.temeraire), true)));
      document.getElementById("forge-retour")?.addEventListener("click", () => res());
    };
    draw();
  });
}
