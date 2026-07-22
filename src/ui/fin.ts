// =============================================================================
//  ui/fin.ts — écrans de fin de run : récapitulatif et défaite (wipe).
// =============================================================================
import { CLASSES } from "../data";
import { escapeHtml, ecran } from "./dom";
import { BTN_RETOUR } from "./assets";
import { classSymbol, kamasHtml } from "./composants";
import type { RunState, Succes } from "../run";

/** Récap de fin de run (victoire ou wipe) : dégâts par héros, MVP, compteurs. */
export function showRecap(run: RunState, victoire: boolean, nouveauxSucces: Succes[] = []): Promise<void> {
  return new Promise((res) => {
    const st = run.stats;
    const maxDegats = Math.max(1, ...Object.values(st.degats));
    const mvp = Object.entries(st.degats).sort((a, b) => b[1] - a[1])[0]?.[0];
    const barres = run.persos
      .map((p) => {
        const d = st.degats[p.classeId] ?? 0;
        const pct = Math.round((d / maxDegats) * 100);
        return `<div class="recap-ligne">
          <img class="recap-sym" src="${classSymbol(p.classeId)}" alt="" onerror="this.remove()" />
          <span class="recap-nom">${escapeHtml(CLASSES[p.classeId].nom)}${p.classeId === mvp ? " 👑" : ""}<small>Niv. ${p.progression.niveau}</small></span>
          <div class="recap-barre"><div class="recap-barre-rempli" style="width:${pct}%"></div><span>${d.toLocaleString("fr-FR")} dégâts</span></div>
        </div>`;
      })
      .join("");
    ecran(`
      <h1 class="${victoire ? "" : "defaite"}">${victoire ? "🏆 Krosmoz traversé !" : "Équipe anéantie"}</h1>
      ${run.ascension >= 1 ? `<p class="asc-record">Ascension <span class="asc-badge">A${run.ascension}</span></p>` : ""}
      <p class="sous-titre">${victoire ? "Toutes les zones de la tranche sont vaincues." : "La run s'arrête ici. Tes Dofus et tes captures, eux, sont conservés."}</p>
      <div class="recap-compteurs">
        <span class="recap-chip">🗺️ ${st.zones} zone${st.zones > 1 ? "s" : ""}</span>
        <span class="recap-chip">⚔️ ${st.combats} combat${st.combats > 1 ? "s" : ""} gagné${st.combats > 1 ? "s" : ""}</span>
        <span class="recap-chip">🎒 ${st.objets} objet${st.objets > 1 ? "s" : ""}</span>
        <span class="recap-chip">✨ ${st.archis} âme${st.archis > 1 ? "s" : ""} capturée${st.archis > 1 ? "s" : ""}</span>
        <span class="recap-chip">${kamasHtml(st.kamasGagnes ?? 0)} gagnés</span>
      </div>
      <div class="recap-degats">${barres}</div>
      ${nouveauxSucces.length ? `<div class="recap-succes">${nouveauxSucces.map((su) => `<span class="succes-chip nouveau" title="${escapeHtml(su.desc)}">🏆 ${escapeHtml(su.nom)}</span>`).join("")}</div>` : ""}
      <div class="boutons-ecran"><button id="recap-retour" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("recap-retour")?.addEventListener("click", () => res());
  });
}

export function showWipe(): Promise<void> {
  return new Promise((res) => {
    ecran(`
      <h1 class="defaite">Équipe anéantie</h1>
      <p class="sous-titre">La run s'arrête. Tes Dofus, eux, sont conservés.</p>
      <div class="boutons-ecran"><button id="btn-retry" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document
      .getElementById("btn-retry")
      ?.addEventListener("click", () => res());
  });
}
