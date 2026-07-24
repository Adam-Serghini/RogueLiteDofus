// =============================================================================
//  ui/collections.ts — Écrans de collections persistantes (Dofus, Bestiaire,
//  Armurerie), l'encyclopédie des classes + le petit écran de capture d'Archi.
// =============================================================================
import {
  DOFUS,
  ITEMS,
  MONSTRES,
  ZONES,
  TRANCHES,
  RARETE_INFO,
  SORTS,
  CLASSES,
  butinToile,
  zonesDeTranche,
  monstresDeZone,
  OCRE_PALIERS,
} from "../data";
import { A, itemImg, sortIcon, classe_img, BTN_RETOUR, BTN_CONTINUER } from "./assets";
import { ecran, escapeHtml, root } from "./dom";
import { SLOT_NOM, ROLE_CLASSE, sortTooltipHtml } from "./composants";
import { paliersOcre, classesDisponibles } from "../run";
import type { Meta } from "../types";

/** Encyclopédie des classes : les persos jouables et leurs kits, en consultation. */
export function showEncyclopedie(): Promise<void> {
  return new Promise((res) => {
    let selection = classesDisponibles()[0];

    const fiche = (classeId: string): string => {
      const c = CLASSES[classeId];
      const sorts = c.sorts
        .map((sid) => {
          const s = SORTS[sid];
          if (!s) return "";
          return `<div class="ency-sort">
            <span class="ency-sort-icone"><img src="${sortIcon(sid)}" alt="" loading="lazy" onerror="this.remove()" /></span>
            <div class="ency-sort-detail">${sortTooltipHtml(s, null)}</div>
          </div>`;
        })
        .join("");
      return `
        <div class="ency-fiche">
          <div class="ency-tete">
            <img class="ency-portrait" src="${classe_img(classeId)}" alt="" onerror="this.remove()" />
            <div>
              <h2>${escapeHtml(c.nom)}</h2>
              <p class="ency-role">${escapeHtml(ROLE_CLASSE[classeId] ?? "")}</p>
              <p class="ency-bases muet">PV ${c.pvBase} · PA ${c.pa} · Initiative ${c.initiative}</p>
            </div>
          </div>
          <div class="ency-sorts">${sorts}</div>
        </div>`;
    };

    const draw = (): void => {
      const onglets = classesDisponibles()
        .map((id) => `
          <button class="ency-onglet${id === selection ? " actif" : ""}" data-classe="${id}" title="${escapeHtml(CLASSES[id].nom)}">
            <img src="${A(`/assets/class_symbol/${id}.png`)}" alt="" onerror="this.src='${classe_img(id)}'" />
          </button>`)
        .join("");
      ecran(`
        <h1>📖 Encyclopédie des classes</h1>
        <p class="sous-titre">Les classes jouables et leurs sorts — les dégâts affichés sont les jets de base, avant caractéristiques.</p>
        <div class="ency-onglets">${onglets}</div>
        ${fiche(selection)}
        <button id="retour" class="btn-img"><img src="${BTN_RETOUR}" alt="Retour" title="Retour" /></button>
      `);
      root.querySelectorAll<HTMLButtonElement>(".ency-onglet").forEach((btn) => {
        btn.addEventListener("click", () => {
          selection = btn.dataset.classe!;
          draw();
        });
      });
      root.querySelector<HTMLButtonElement>("#retour")?.addEventListener("click", () => res());
    };
    draw();
  });
}

export function showDofus(dofusId: string, totalCopies: number): Promise<void> {
  return new Promise((res) => {
    const d = DOFUS[dofusId];
    ecran(`
      <h1 class="victoire">Dofus obtenu !</h1>
      ${d?.img ? `<img class="dofus-img" src="${A(d.img)}" alt="" onerror="this.remove()" />` : ""}
      <h2>${escapeHtml(d?.nom ?? dofusId)}</h2>
      <p class="sous-titre">${escapeHtml(d?.desc ?? "")}</p>
      <p>Copies possédées : <b>×${totalCopies}</b>. La prochaine run sera plus facile.</p>
      <div class="boutons-ecran"><button id="btn-continue" class="btn-retour" title="Retour à l'accueil"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document
      .getElementById("btn-continue")
      ?.addEventListener("click", () => res());
  });
}

/** Texte d'effet d'un palier Ocre. */
function ocreEffetTxt(paBonus: number, degats: number): string {
  if (!paBonus && !degats) return "aucun";
  const parts: string[] = [];
  if (paBonus) parts.push(`+${paBonus} PA`);
  if (degats) parts.push(`+${Math.round(degats * 100)} % dégâts`);
  return parts.join(" · ");
}

/** Bloc « monde » des écrans de collection (Bestiaire, Armurerie) : les zones
 *  d'une tranche dans l'ORDRE DE JEU, sous un bandeau titré ; les tranches
 *  encore vides s'affichent verrouillées. */
function mondeBloc(t: (typeof TRANCHES)[number], zoneHtml: (z: (typeof ZONES)[number]) => string): string {
  const corps = t.zones.length
    ? zonesDeTranche(t).map(zoneHtml).join("")
    : `<p class="muet monde-verrouille">🔒 Verrouillé — à venir</p>`;
  return `<div class="monde-bloc"><h2 class="monde-titre">${escapeHtml(t.nom)} <small>Niv. ${t.niveaux[0]}${t.niveaux[1] !== t.niveaux[0] ? `–${t.niveaux[1]}` : ""}</small></h2>${corps}</div>`;
}

/** Bestiaire par zone : toutes les espèces (boss & miniboss inclus) ;
 *  les espèces à Archimonstre (archiNom) suivent la capture (Dofus Ocre). */
export function showBestiaire(meta: Meta): Promise<void> {
  return new Promise((res) => {
    // seules les espèces ayant un Archimonstre réel (archiNom) sont capturables
    const capturables = (z: (typeof ZONES)[number]) =>
      monstresDeZone(z).filter((id) => MONSTRES[id]?.archiNom);
    const total = new Set(ZONES.flatMap(capturables)).size;
    const captures = meta.archis.length;
    const ocre = paliersOcre(meta);
    const prochain = OCRE_PALIERS.find((p) => captures < p.seuil);
    const zoneHtml = (z: (typeof ZONES)[number]): string => {
      const ids = monstresDeZone(z); // toutes les espèces de la zone (boss/miniboss inclus)
      const capturablesIds = ids.filter((id) => MONSTRES[id]?.archiNom);
      // ordre d'affichage : le boss en dernier (les autres gardent l'ordre des rencontres)
      const tri = [...ids].sort((a, b) => Number(MONSTRES[a]?.boss ?? false) - Number(MONSTRES[b]?.boss ?? false));
      const cards = tri
        .map((id) => {
          const m = MONSTRES[id]!;
          const badge = m.boss ? `<span class="bestiaire-badge">Boss</span>` : "";
          if (!m.archiNom) {
            // espèce sans Archimonstre : simple entrée d'encyclopédie
            return `<div class="archi-mon simple" title="${escapeHtml(m.nom)}${m.boss ? " — Boss de donjon" : ""} (pas d'Archimonstre connu)">
            ${m.img ? `<img src="${A(m.img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
            ${badge}
            <span>${escapeHtml(m.nom)}</span>
            <small>${m.boss ? "Boss" : "—"}</small>
          </div>`;
          }
          const capt = meta.archis.includes(id);
          return `<div class="archi-mon ${capt ? "capt" : "manquant"}" title="${escapeHtml(m.archiNom)} — Archimonstre de ${escapeHtml(m.nom)}${capt ? " (capturé)" : " (non capturé)"}">
          ${m.img ? `<img src="${A(m.img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
          ${capt ? `<img class="archi-mark" src="${A("/assets/divers/Archmonster.webp")}" alt="" onerror="this.remove()" />` : ""}
          ${badge}
          <span>${escapeHtml(m.archiNom)}</span>
          <small>${escapeHtml(m.nom)}</small>
        </div>`;
        })
        .join("");
      const compte = capturablesIds.length
        ? `<span class="archi-zone-compte">${capturablesIds.filter((id) => meta.archis.includes(id)).length}/${capturablesIds.length} archis</span>`
        : `<span class="archi-zone-compte">aucun archi</span>`;
      return `<div class="archi-zone"><h3>${escapeHtml(z.nom)} ${compte}</h3><div class="archi-grid">${cards}</div></div>`;
    };
    const zonesHtml = TRANCHES.map((t) => mondeBloc(t, zoneHtml)).join("");
    ecran(`
      <h1>📖 Bestiaire — Archimonstres</h1>
      <p class="sous-titre">Capture l'âme des Archimonstres (variantes rares, plus puissantes) en les vainquant. Chaque palier de 50 captures fait monter le Dofus Ocre.</p>
      <p class="archi-resume"><b>${captures}</b> / ${total} espèces capturées · Dofus Ocre : <b>palier ${ocre.tier}</b> (${ocreEffetTxt(ocre.paBonus, ocre.degats)})${prochain ? ` · prochain palier à ${prochain.seuil}` : " · max atteint"}</p>
      ${zonesHtml}
      <div class="boutons-ecran"><button id="best-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document
      .getElementById("best-retour")
      ?.addEventListener("click", () => res());
  });
}

/** Armurerie : la collection persistante d'équipement, zone par zone.
 *  Jamais obtenu = grisé/transparent ; obtenu = en couleurs, avec le halo de la
 *  MEILLEURE rareté jamais obtenue. */
export function showArmurerie(meta: Meta): Promise<void> {
  return new Promise((res) => {
    const coll = meta.collection ?? {};
    // catalogue d'une zone : pools à rareté (normales + exclusifs élite/boss/les-deux)
    const itemsDeZone = (zoneId: string): { id: string; badge?: "boss" | "elite" | "elite_boss" }[] => {
      const pools = butinToile(zoneId);
      if (pools) {
        // un objet « elite_boss » figure dans les DEUX pools : une seule carte, badge combiné
        const entrees = new Map<string, { id: string; badge?: "boss" | "elite" | "elite_boss" }>();
        for (const id of pools.normales) entrees.set(id, { id });
        for (const id of pools.elites) entrees.set(id, { id, badge: "elite" });
        for (const id of pools.boss) entrees.set(id, { id, badge: entrees.get(id)?.badge === "elite" ? "elite_boss" : "boss" });
        return [...entrees.values()];
      }
      return [];
    };
    let total = 0, possedes = 0;
    const zoneHtml = (z: (typeof ZONES)[number]): string => {
      const entrees = itemsDeZone(z.id).filter((e) => ITEMS[e.id]);
      if (!entrees.length) return "";
      const nb = entrees.filter((e) => coll[e.id]).length;
      total += entrees.length;
      possedes += nb;
      const cards = entrees
        .map(({ id, badge }) => {
          const it = ITEMS[id]!;
          const palier = coll[id]; // undefined = jamais obtenu
          const aHalo = !!palier;
          const rareteTxt = palier ? RARETE_INFO[palier as keyof typeof RARETE_INFO].nom : "jamais obtenu";
          const badgeNom = { boss: "Boss", elite: "Élite", elite_boss: "Élite/Boss" } as const;
          const badgeSource = { boss: "donjon", elite: "combat dur", elite_boss: "combat dur & donjon" } as const;
          const badgeHtml = badge ? `<span class="bestiaire-badge armu-badge-${badge}">${badgeNom[badge]}</span>` : "";
          return `<div class="archi-mon armu-item ${palier ? "capt" : "manquant"}${aHalo ? ` rarete-${palier}` : ""}" title="${escapeHtml(it.nom)} — ${SLOT_NOM[it.slot]}${badge ? ` (exclusif ${badgeSource[badge]})` : ""} · ${rareteTxt}">
            <img src="${itemImg(id)}" alt="" loading="lazy" onerror="this.remove()" />
            ${badgeHtml}
            <span${aHalo ? ` class="inom-${palier}"` : ""}>${escapeHtml(it.nom)}</span>
            <small>${palier ? RARETE_INFO[palier as keyof typeof RARETE_INFO].nom : SLOT_NOM[it.slot]}</small>
          </div>`;
        })
        .join("");
      return `<div class="archi-zone"><h3>${escapeHtml(z.nom)} <span class="archi-zone-compte">${nb}/${entrees.length} objets</span></h3><div class="archi-grid">${cards}</div></div>`;
    };
    const zonesHtml = TRANCHES.map((t) => mondeBloc(t, zoneHtml)).join("");
    ecran(`
      <h1>🛡️ Armurerie</h1>
      <p class="sous-titre">Chaque objet obtenu (butin ou Hôtel de vente) rejoint la collection pour toujours — le halo montre la meilleure rareté jamais obtenue.</p>
      <p class="archi-resume"><b>${possedes}</b> / ${total} objets collectionnés</p>
      ${zonesHtml}
      <div class="boutons-ecran"><button id="armu-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("armu-retour")?.addEventListener("click", () => res());
  });
}

/** Petit écran de feedback quand on capture une ou plusieurs âmes d'Archimonstre. */
export function showCapture(especes: string[]): Promise<void> {
  return new Promise((res) => {
    const s = especes.length > 1;
    ecran(`
      <h1>✨ Âme${s ? "s" : ""} d'Archimonstre capturée${s ? "s" : ""} !</h1>
      <p class="sous-titre">${especes.map(escapeHtml).join(", ")} ${s ? "rejoignent" : "rejoint"} ton bestiaire (Dofus Ocre).</p>
      <div class="boutons-ecran"><button id="capt-ok" class="btn-continuer" title="Continuer"><img src="${BTN_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("capt-ok")?.addEventListener("click", () => res());
  });
}
