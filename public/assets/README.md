# Assets (sprites)

Servis par Vite à `/assets/...`. Si un fichier référencé manque, la carte de
combattant affiche le badge d'élément (repli propre via `onerror`).

## Câblage actuel (`src/data.ts`)

| Entité | Fichier | Statut |
|---|---|---|
| Iop | `classes/iop.png` | ✅ |
| Cra | `classes/cra.png` | ✅ |
| Eniripsa | `classes/eniripsa.png` | ✅ |
| Sadida | `classes/sadida.png` | ✅ |
| Dofus Pourpre | `dofus/dofus_pourpre.png` | ✅ (écran de drop) |

### Monstres par zone (`monstres/`, sprites DofusDB)
- **Incarnam** : tofu, larve_bleue, arakne, moskito · boss **milimilou** + miniboss **tofu_malefique**
- **Champs d'Astrub** : bouftou, bouftou_noir, boufton_noir, prespic · boss **chef_de_guerre_bouftou** + miniboss **bouftou_royal**
- **Tainéla** : pissenlit_diabolique, boufton_blanc, arakne, moskito · boss **tournesol_affame** + miniboss **bouftou_halouine**

Dossier `monstres/` à plat (par id de monstre — un mob partagé entre zones n'existe
qu'une fois). L'appartenance aux zones vit dans `ZONES`/`COMBATS` (`data.ts`).
Bosses : chaque donjon de zone lâche un Dofus (Turquoise / Pourpre / Ocre).

## Plateau — tuiles de cases (`cases/`)
Une tuile par **type de nœud**, utilisée par `showCarte` via `caseAsset()`.

| Type de nœud | Fichier | Statut |
|---|---|---|
| combat | `cases/combat.png` | ✅ |
| combat_dur | `cases/combat_elite.png` | ✅ (le type `combat_dur` pointe sur `combat_elite`) |
| taverne | `cases/taverne.png` | ✅ |
| otomai | `cases/otomai.png` | ✅ |
| zaap | `cases/zaap.png` | ✅ |
| **donjon (boss)** | `boss/bouftou_royal.png` | ✅ (sprite de boss en guise de tuile ; `cases/donjon.png` dédié serait + propre) |

## Icônes d'éléments & PA (`elements/`)
- `elements/{terre,feu,air}.png` — affichées sur chaque carte combattant (élément de frappe).
- `elements/pa.png` (étoile) — jauge PA de la barre de sorts + pips PA des cartes.
- `elements/{eau,wakfu,stasis}.png` — prêtes pour les 3 éléments à venir (Chance/Wakfu/Stasis).

## Emblèmes de classe (`class_symbol/`)
- `class_symbol/{iop,cra,eniripsa,sadida}.png` — résumé d'équipe (sidebar du plateau).
- Les 14 autres emblèmes sont prêts pour les futures classes recrutables.

## Dofus (`dofus/`)
**Les 31 Dofus** du jeu (icônes DofusDB, `typeId 23`), affichés dans la collection
« Dofus » (accueil + sidebar du plateau) ; non possédés = en transparence. Le
catalogue + l'ordre vivent dans `CATALOGUE_DOFUS`/`DOFUS` (`data.ts`). Seul le
**Pourpre** a un effet (+15 % dégâts) ; les bosses de zone lâchent Turquoise / Pourpre / Ocre.

## Police
`fonts/nunito-{400,700,900}.woff2` (Nunito, OFL) — toute l'UI (ronde, façon Dofus 3.0).
Auto-hébergée, aucun CDN au runtime.

## Convention de chargement (icônes au fil de l'eau)
`asset(categorie, id)` → `/assets/<categorie>/<id>.png`. Le nom de fichier = l'id de
l'entité. Dépose une image, elle s'affiche ; absente, l'`onerror` la retire (rien ne casse).
- **Icônes de sorts** : `spells/<sortId>.png` — **les 25 sont présentes**, récupérées
  depuis l'API DofusDB (`api.dofusdb.fr/img/spells/sort_<iconId>.png`). Correspondances
  exactes quand le sort existe, sinon icône d'un sort proche de la même classe.
- **Poupée de garde** (invocation Sadida) : cherche `divers/poupee.png` (optionnel).

## Présents, réservés pour du contenu à venir
- `classes/sacrieur.png`, `sram.png` — futures classes.
- `monstres/bouftou_royal.png` — prévu pour un **futur boss**.
- `divers/Archmonster.webp` — pour la **quête du Dofus Ocre** (pas un combattant).
- `dofus/` : cawotte, ébène, émeraude, ivoire, ocre, turquoise — futures reliques.

Tout est en PNG RGBA transparent → rendu homogène sur les cartes.

> Assets © Ankama — usage prototype uniquement, pas de distribution.
