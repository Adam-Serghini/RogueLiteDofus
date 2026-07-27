// =============================================================================
//  ui/fin.ts — écrans de fin de run : récapitulatif et défaite (wipe).
// =============================================================================
import { CLASSES } from "../data";
import { escapeHtml, ecran } from "./dom";
import { BTN_RETOUR } from "./assets";
import { classSymbol, kamasHtml } from "./composants";
import type { RunState, Succes } from "../run";

/** Aperçu (présentation seule) de l'archive déjà enregistrée pour cette tranche. */
export interface ApercuArchive { classeId: string; niveau: number }

/** Récap de fin de run (victoire ou wipe) : dégâts par héros, MVP, compteurs. */
export function showRecap(
  run: RunState, victoire: boolean, nouveauxSucces: Succes[] = [], onArchiver?: () => void,
  archiveExistante?: ApercuArchive[],
): Promise<void> {
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
    const peutArchiver = victoire && !!onArchiver;
    const ancienne = (archiveExistante ?? []).filter((p) => CLASSES[p.classeId]);
    const listeAncienne = ancienne
      .map((p) => `${escapeHtml(CLASSES[p.classeId].nom)} <small>Niv. ${p.niveau}</small>`)
      .join(" · ");
    const archiveHtml = peutArchiver ? `<div class="recap-archive" id="recap-archive"></div>` : "";
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
      ${archiveHtml}
      <div class="boutons-ecran"><button id="recap-retour" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    if (peutArchiver) {
      const zone = document.getElementById("recap-archive")!;
      const archive = (): void => {
        onArchiver!();
        zone.innerHTML = `<p class="recap-archive-ok">Équipe archivée ✓ — elle t'attendra au départ de la tranche suivante.</p>`;
      };
      // état « proposition » : direct s'il n'y a rien à écraser, sinon avertissement
      const proposer = (): void => {
        zone.innerHTML = ancienne.length
          ? `<p class="recap-archive-alerte">⚠️ Une équipe est déjà archivée pour cette tranche : ${listeAncienne}. L'archiver de nouveau la remplacerait définitivement.</p>
             <button id="btn-archiver" class="secondaire">Remplacer l'archive par cette équipe</button>`
          : `<p>Cette équipe peut poursuivre son voyage dans la tranche suivante — son équipement porté la suivra.</p>
             <button id="btn-archiver" class="primaire">Archiver cette équipe</button>`;
        document.getElementById("btn-archiver")?.addEventListener("click", () => {
          if (!ancienne.length) return archive();
          confirmer(); // remplacement : une confirmation explicite d'abord
        });
      };
      const confirmer = (): void => {
        zone.innerHTML = `<p class="recap-archive-alerte">Remplacer l'archive ? ${listeAncienne} sera perdue.</p>
          <div class="recap-archive-choix">
            <button id="btn-archiver-oui" class="primaire">Remplacer</button>
            <button id="btn-archiver-non" class="secondaire">Annuler</button>
          </div>`;
        document.getElementById("btn-archiver-oui")?.addEventListener("click", () => archive());
        document.getElementById("btn-archiver-non")?.addEventListener("click", () => proposer());
      };
      proposer();
    }
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
