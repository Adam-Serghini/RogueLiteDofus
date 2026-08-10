// =============================================================================
//  ui/accueil.ts — écrans d'accueil : démarrage, choix d'équipe, succès, Dofus.
// =============================================================================
import { DOFUS, TRANCHES, ASCENSION, ASCENSION_MAX } from "../data";
import { escapeHtml, ecran, root } from "./dom";
import {
  LOGO,
  BTN_JOUER,
  MENU_BESTIAIRE,
  MENU_ARMURERIE,
  MENU_SUCCES,
  MENU_ENCYCLOPEDIE,
  MENU_PARAM,
  MENU_ACCUEIL,
  MENU_DOFUS,
  BTN_RETOUR,
  PA_ICON,
} from "./assets";
import { renderDofusRack, carteClasse, etoiles } from "./composants";
import { classesDisponibles, SUCCES, recordAscension, trancheDeverrouillee, trancheJouable } from "../run";
import { showSettings } from "./inventaire";
import { showBestiaire, showArmurerie, showEncyclopedie } from "./collections";
import type { Meta } from "../types";

// --- Écrans ------------------------------------------------------------------
/** Infos affichées pour proposer la reprise d'une run sauvegardée. */
export interface RepriseInfo {
  zoneNom: string;
  zoneNum: number;
  nbZones: number;
  ascension: number;
  trancheId: string;
}

export type StartAction = "nouvelle" | "reprendre" | "abandonner";

export function showStart(
  meta: Meta,
  onReset: () => void,
  reprise: RepriseInfo | null = null,
): Promise<{ action: StartAction; ascension: number; trancheId: string }> {
  return new Promise((res) => {
    const total = Object.keys(DOFUS).length;
    let trancheSel = reprise?.trancheId ?? "t1"; // tranche choisie (figée pendant une reprise)
    let sel = 0; // palier d'Ascension sélectionné (nouvelle run uniquement)

    const draw = () => {
      // lu à chaque rendu : la réinitialisation des Dofus (Paramètres) le fait tomber à 0
      const nbUniques = new Set(meta.dofus).size;
      const record = recordAscension(meta, trancheSel);
      // run en cours : Reprendre (principal) + Abandonner ; sinon : Jouer
      const boutons = reprise
        ? `<button id="btn-reprendre" class="btn-jouer btn-reprendre" title="Reprendre la run, zone ${reprise.zoneNum}/${reprise.nbZones} : ${escapeHtml(reprise.zoneNom)}"><img src="${BTN_JOUER}" alt="Reprendre" onerror="this.remove()" /></button>
           <button id="btn-abandon" class="secondaire">Abandonner la run</button>`
        : `<button id="btn-start" class="btn-jouer" title="Lancer une run"><img src="${BTN_JOUER}" alt="Jouer" onerror="this.remove()" /></button>`;

      // sélecteur d'Ascension : visible seulement si la tranche active a déjà été
      // remportée au moins une fois (record défini), et pas en reprise (palier figé)
      const ascensionHtml = (!reprise && record !== undefined) ? (() => {
        const max = Math.min(record + 1, ASCENSION_MAX);
        // Une étoile par cran, cliquable : la n-ième choisit le cran n (★1 = jeu de
        // base). Au-delà du cran suivant le record, l'étoile est verrouillée et ne
        // répond pas. Le nom et les effets affichés sont ceux du cran SÉLECTIONNÉ —
        // la table est absolue, chaque cran porte déjà tout ce que les précédents
        // portaient, donc il n'y a rien à cumuler à l'affichage.
        const etoilesHtml = ASCENSION.map((cran, n) => {
          const verrou = n > max;
          const cls = ["asc-etoile", n <= sel ? "pleine" : "", verrou ? "verrou" : ""].filter(Boolean).join(" ");
          const titre = verrou ? `Bats ${ASCENSION[max].nom} pour débloquer ${cran.nom}` : cran.nom;
          // la gemme de PA du combat sert d'étoile : même image, donc le cran de
          // difficulté est du même métal que le reste du jeu. Repli textuel si le
          // fichier manque, comme partout ailleurs (`asset` + `onerror`).
          return `<button class="${cls}" ${verrou ? "disabled" : `data-asc="${n}"`} title="${escapeHtml(titre)}" aria-label="${escapeHtml(cran.nom)}">
            <img src="${PA_ICON}" alt="" onerror="this.parentElement.textContent='★'" />
          </button>`;
        }).join("");
        return `<div class="asc-section">
          <p class="asc-titre">Difficulté</p>
          <div class="asc-rangee" id="asc-rangee">${etoilesHtml}</div>
          <p class="asc-nom" id="asc-nom">${escapeHtml(ASCENSION[sel].nom)}</p>
          <p class="asc-desc" id="asc-desc">${escapeHtml(ASCENSION[sel].desc)}</p>
          ${record >= 1 ? `<p class="asc-record">Record : ${etoiles(record)} ${escapeHtml(ASCENSION[record].nom)} ✓</p>` : ""}
        </div>`;
      })() : "";

      ecran(`
        <div class="coin-menu">
          <button id="btn-dofus" class="coin-param" title="Dofus"><img src="${MENU_DOFUS}" alt="Dofus" onerror="this.remove()" /></button>
          <button id="btn-bestiaire" class="coin-param" title="Bestiaire"><img src="${MENU_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /></button>
          <button id="btn-encyclopedie" class="coin-param" title="Encyclopédie des classes"><img src="${MENU_ENCYCLOPEDIE}" alt="Encyclopédie" onerror="this.parentElement.textContent='📖'" /></button>
          <button id="btn-armurerie" class="coin-param" title="Armurerie"><img src="${MENU_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /></button>
          <button id="btn-succes" class="coin-param" title="Succès"><img src="${MENU_SUCCES}" alt="Succès" onerror="this.remove()" /></button>
          <button id="btn-settings" class="coin-param" title="Paramètres"><img src="${MENU_PARAM}" alt="Paramètres" onerror="this.remove()" /></button>
        </div>
        <img class="logo-accueil" src="${LOGO}" alt="Roguefus Lite" onerror="this.remove()" />
        <p class="sous-titre">Choisis 2 héros, recrute aux tavernes (4 max), traverse le plateau jusqu'au boss. Les PV se conservent ; seuls les Dofus survivent à la mort.</p>
        <p class="accueil-dofus-compte">Dofus collectés : <b>${nbUniques}/${total}</b></p>
        <p class="accueil-runs-compte">Runs : <b>${meta.runs}</b> · Réussies : <b>${meta.victoires}</b></p>
        ${reprise ? `<p class="accueil-reprise">⚔ Run en cours : <b>Zone ${reprise.zoneNum}/${reprise.nbZones} : ${escapeHtml(reprise.zoneNom)}</b>${reprise.ascension >= 1 ? ` <span class="asc-badge" title="${escapeHtml(ASCENSION[reprise.ascension].desc)}">${etoiles(reprise.ascension)}</span>` : ""}</p>` : ""}
        <div class="tranches-rack">
          ${TRANCHES.map((t) => {
            const ouverte = trancheDeverrouillee(meta, t.id);
            const jouable = trancheJouable(meta, t.id);
            const cls = [
              "tranche-carte",
              t.id === trancheSel ? "active" : "",
              ouverte ? "" : "locked",
              ouverte && !jouable ? "chantier" : "",
            ].filter(Boolean).join(" ");
            const detail = !ouverte ? "🔒 Verrouillé" : jouable ? `${t.zones.length} zones` : "🚧 En construction";
            return `<div class="${cls}" ${jouable && !reprise ? `data-tranche="${t.id}"` : ""} title="${escapeHtml(detail)}">
              <span class="tranche-nom">${escapeHtml(t.nom)}</span>
              <span class="tranche-niveaux">Niv. ${t.niveaux[0]}${t.niveaux[1] !== t.niveaux[0] ? `–${t.niveaux[1]}` : ""}</span>
              <span class="tranche-detail">${detail}</span>
            </div>`;
          }).join("")}
        </div>
        ${ascensionHtml}
        <div class="boutons-ecran">
          ${boutons}
        </div>
      `, "ecran-accueil");
      document
        .getElementById("btn-settings")
        ?.addEventListener("click", async () => {
          // la réinitialisation des Dofus vit dans les Paramètres, plus sur l'accueil
          await showSettings({ nb: () => meta.dofus.length, onReset });
          draw();
        });
      document
        .getElementById("btn-succes")
        ?.addEventListener("click", async () => {
          await showSucces(meta);
          draw();
        });
      document
        .getElementById("btn-bestiaire")
        ?.addEventListener("click", async () => {
          await showBestiaire(meta);
          draw();
        });
      document
        .getElementById("btn-encyclopedie")
        ?.addEventListener("click", async () => {
          await showEncyclopedie();
          draw();
        });
      document
        .getElementById("btn-armurerie")
        ?.addEventListener("click", async () => {
          await showArmurerie(meta);
          draw();
        });
      document
        .getElementById("btn-dofus")
        ?.addEventListener("click", async () => {
          await showCollectionDofus(meta);
          draw();
        });
      // Survol : prévisualise un cran sans le choisir. On repeint les étoiles et les
      // deux lignes de texte à la main plutôt que de rappeler `draw()` — un rendu
      // complet de l'accueil à chaque passage de souris détruirait le nœud survolé
      // et le `mouseleave` ne partirait jamais.
      const etoilesBtns = [...root.querySelectorAll<HTMLButtonElement>(".asc-etoile")];
      const nomEl = document.getElementById("asc-nom");
      const descEl = document.getElementById("asc-desc");
      const peindre = (n: number): void => {
        etoilesBtns.forEach((btn, i) => {
          if (btn.disabled) return; // une étoile verrouillée garde son cadenas
          btn.classList.toggle("pleine", i <= n);
        });
        if (nomEl) nomEl.textContent = ASCENSION[n].nom;
        if (descEl) descEl.textContent = ASCENSION[n].desc;
      };
      root
        .querySelectorAll<HTMLButtonElement>(".asc-etoile[data-asc]")
        .forEach((btn) => {
          const n = Number(btn.dataset.asc);
          btn.addEventListener("click", () => {
            sel = n;
            draw();
          });
          btn.addEventListener("mouseenter", () => peindre(n));
        });
      document
        .getElementById("asc-rangee")
        ?.addEventListener("mouseleave", () => peindre(sel));
      root.querySelectorAll<HTMLElement>("[data-tranche]").forEach((el) =>
        el.addEventListener("click", () => { trancheSel = el.dataset.tranche!; sel = 0; draw(); }));
      document
        .getElementById("btn-start")
        ?.addEventListener("click", () => res({ action: "nouvelle", ascension: sel, trancheId: trancheSel }));
      document
        .getElementById("btn-reprendre")
        ?.addEventListener("click", () => res({ action: "reprendre", ascension: 0, trancheId: reprise!.trancheId }));
      document
        .getElementById("btn-abandon")
        ?.addEventListener("click", () => res({ action: "abandonner", ascension: 0, trancheId: reprise!.trancheId }));
    };
    draw();
  });
}

/** Écran de départ : choisir 2 classes parmi les classes jouables pour commencer la run. */
export function showChoixEquipe(): Promise<string[] | null> {
  return new Promise((res) => {
    const choix: string[] = [];
    const draw = () => {
      const cartes = classesDisponibles()
        .map((id) => carteClasse(id, choix.includes(id), "data-classe"))
        .join("");
      ecran(`
        <h1>Compose ton équipe de départ</h1>
        <p class="sous-titre">Choisis <b>2 classes</b> pour commencer. Tu pourras en recruter d'autres dans les tavernes (équipe de 4 max).</p>
        <div class="choix-grille">${cartes}</div>
        <div class="boutons-ecran">
          <button id="choix-retour" class="aside-icone" title="Retour à l'accueil"><img src="${MENU_ACCUEIL}" alt="Accueil" onerror="this.remove()" /></button>
          <button id="choix-go" class="btn-jouer" title="Jouer" ${choix.length === 2 ? "" : "disabled"}><img src="${BTN_JOUER}" alt="Jouer" onerror="this.remove()" /></button>
          <span class="choix-compte">${choix.length}/2</span>
        </div>
      `);
      root
        .querySelectorAll<HTMLButtonElement>(".classe-carte")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.classe!;
            const i = choix.indexOf(id);
            if (i >= 0) choix.splice(i, 1);
            else if (choix.length < 2) choix.push(id);
            draw();
          });
        });
      document.getElementById("choix-go")?.addEventListener("click", () => {
        if (choix.length === 2) res([...choix]);
      });
      document.getElementById("choix-retour")?.addEventListener("click", () => res(null));
    };
    draw();
  });
}

/** Collection de Dofus (accueil) : tout le catalogue, possédés en couleurs. */
export function showCollectionDofus(meta: Meta): Promise<void> {
  return new Promise((res) => {
    const nbUniques = new Set(meta.dofus).size;
    ecran(`
      <h1>Dofus</h1>
      <p class="sous-titre">${nbUniques} / ${Object.keys(DOFUS).length} reliques collectées. Elles survivent à la mort et se cumulent.</p>
      ${renderDofusRack(meta)}
      <div class="boutons-ecran"><button id="dofus-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("dofus-retour")?.addEventListener("click", () => res());
  });
}

/** Liste des succès (débloqués / verrouillés), depuis l'accueil. */
export function showSucces(meta: Meta): Promise<void> {
  return new Promise((res) => {
    const deja = new Set(meta.succes ?? []);
    // ne compter que les succès du catalogue courant : `meta.succes` peut porter des ids
    // orphelins (ex. les anciens paliers d'Ascension remplacés) qui gonfleraient le numérateur
    // au-delà du dénominateur sans correspondre à une carte affichée.
    const nbDebloques = SUCCES.filter((s) => deja.has(s.id)).length;
    const cartes = SUCCES.map((su) => `
      <div class="succes-carte ${deja.has(su.id) ? "ok" : "verrouille"}">
        <span class="succes-icone">${deja.has(su.id) ? "🏆" : "🔒"}</span>
        <span class="succes-nom">${escapeHtml(su.nom)}<small>${escapeHtml(su.desc)}</small></span>
      </div>`).join("");
    ecran(`
      <h1>Succès</h1>
      <p class="sous-titre">${nbDebloques} / ${SUCCES.length} débloqués. Les récompenses arriveront avec le système d'objets.</p>
      <div class="succes-grille">${cartes}</div>
      <div class="boutons-ecran"><button id="succes-retour" class="btn-retour" title="Retour"><img src="${BTN_RETOUR}" alt="Retour" onerror="this.remove()" /></button></div>
    `);
    document.getElementById("succes-retour")?.addEventListener("click", () => res());
  });
}
