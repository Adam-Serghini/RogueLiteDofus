# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Ce fichier décrit l'**état courant** et les **règles durables**. Il ne raconte plus l'historique des
> chantiers (reworks de classes, arrivée des zones T2, relevés de banc successifs) : cette version
> narrative reste intégralement consultable dans l'historique git (`git log -p -- CLAUDE.md`).
> Quand tu ajoutes ici, écris une **règle**, pas un récit daté.

## Par où commencer

- **`src/combat.ts` est PUR** — aucun DOM, aucun `localStorage`. C'est ce qui le rend testable.
- **`src/ui/` est de la présentation** — aucune règle de jeu. Tout est câblé dans `src/main.ts`.
- **Le contenu vit dans `src/content/*.json`** — sorts, classes, monstres, combats, pools de zones,
  objets, butin. `src/data.ts` ne fait que les importer et les ré-exporter typés.
  **Ne jamais éditer ces JSON à la main** (voir *Pipeline de contenu*).
- **Tests** : `src/<sujet>.test.ts`. Une classe reworkée a deux fichiers — `<classe>.test.ts`
  (contenu/données du kit) et `<classe>-moteur.test.ts` (mécaniques moteur introduites pour elle).
- Le vocabulaire métier est **français** (PA, sorts, esquive, élément de frappe, Dofus…) et le reste
  dans les identifiants et les données. Docs de fond : `GDD-roguelite-dofus.md` (le *pourquoi*),
  `PLAN-CONTENU.md` (roadmap contenu), `CLASSES-ELEMENTS.md` (table archétype/éléments).

## Commands

- `npm run dev` — Vite dev server (hot reload) sur http://localhost:5173
- `npm run preview` — sert le bundle de `dist/`
- `npm test` — suite Vitest en une passe ; `npm run test:watch` pour le mode watch. Le glob couvre
  **aussi** `scripts/*.test.mjs` (`canonical`, `content-validate`), et `vite.config.ts` exclut
  `**/.claude/**` : les worktrees git vivent **dans** le dépôt et multipliaient le total annoncé.
- Un seul test : `npx vitest run src/combat.test.ts -t "règle de ligne"` (`-t` matche le nom du
  `describe`/`it`)
- `npm run typecheck` — `tsc --noEmit`, strict
- `npm run build` — typecheck + bundle de production dans `dist/`
- `npm run sim` — **banc d'équilibrage headless** (`src/sim.ts` via `vitest.sim.config.ts`, hors du
  glob `*.test.ts` donc ignoré par `npm test`). Rejoue N **parcours de zone** (IA des deux côtés, RNG à
  graine) pour une équipe de référence multi-éléments, en deux loadouts réalistes (**ATTENDU** = 4 pièces
  de la toile à rareté tirée / **MALCHANCE** = 2 pièces commun), et imprime `clear%` · PV à l'entrée du
  donjon · PV en fin de zone · héros KO, plus une **échelle d'Ascension** (clear% des 5 crans).
- `npm run content:import -- <fichier> [--force] [--sans-assets] [--sans-tests]` — importe un export de
  l'éditeur (voir *Pipeline de contenu*)
- `npm run editor:build` — génère `editeur.html` à la racine (gitignoré), l'éditeur de contenu
  standalone à envoyer au game designer
- `node scripts/fetch-assets.mjs` — récupère les sprites de monstres depuis DofusDB (name.fr → gfxId →
  PNG dans `public/assets/monstres/`, saute les fichiers existants)
- `node scripts/audit-icons.mjs` — audit des icônes d'objets, lit `src/content/items.json`
- `node scripts/gris-icones.mjs <dossier> [--essai] [--sauvegarde <dossier>]` — passe des PNG en
  niveaux de gris **sur place** (Node pur, coefficients Rec.709 comme le `filter: grayscale(1)` du CSS,
  idempotent, refuse bruyamment tout format autre que PNG 8 bits non entrelacé type 2 ou 6)

**Il n'y a ni linter ni formatter** dans le projet : `typecheck` + `test` sont les seules portes.

## What the game is

Un roguelite tactique au tour par tour dans l'univers Dofus, joué dans le navigateur. La boucle doit
valider : **combat tactique + une relique permanente (Dofus) qui survit à la mort et facilite la run
suivante**. Tout se juge à une question — *est-ce que le combat est amusant ?*

## Tech stack

- **TypeScript + Vite**, vanilla — **pas de React, pas de Canvas**. L'UI est du DOM brut : on teste le
  *feel*, pas le visuel.
- **Data-driven** : classes, sorts, monstres, rencontres, paramètres de génération de carte et
  constantes d'équilibrage vivent dans le contenu, jamais en dur dans la logique.
- **Vitest** pour les modules purs (`combat`, `progression`, `carte`), validés sans DOM.
- Persistance : `Meta` (Dofus possédés, `archis` capturés, compteurs, `succes`, `collection`) survit aux
  runs → `localStorage` clé `rld_meta_v0`, avec défauts de rétro-compat dans `chargerMeta`. Les
  *réglages* joueur vivent sous `rld_settings_v0` (`src/config.ts`). La **run en cours** est sauvée sous
  `rld_run_v0` (`sauverRunEnCours`/`chargerRunEnCours`/`effacerRunEnCours`) après chaque nœud résolu et
  aux transitions de zone ; **un combat en cours n'est PAS sauvé** (refresh = on refait le nœud) ;
  effacée sur wipe/victoire/abandon.
- Déploiement : un push sur `main` publie sur GitHub Pages via `.github/workflows/deploy.yml`
  (`GITHUB_ACTIONS=true` fixe la `base` Vite à `/RogueLiteDofus/`).

## Code map

- `src/types.ts` — le modèle de données : types de combat, `Progression`, équipement (`Item` à `tiers`
  de stats fixes, `ItemInstance`, `EquipSlot`), carte (`MapNode`, `GameMap`).
- `src/data.ts` — importe/ré-exporte le contenu JSON et porte les constantes d'équilibrage : `SORTS`,
  `CLASSES`, `MONSTRES`, `DOFUS`, `COMBATS`, `ZONES` (24 zones, à plat), `TRANCHES` (`niveaux:
  [start, cap]` est la source de vérité), `ARCHI`, `ERRANTS`, `ASCENSION`, `KAMAS`, `XP_PAR_TYPE`,
  `XP_PAR_TOILE`, `TAVERNE_PCT`, `GEN_CARTE`, `MODIFICATEURS_ELITE`, `SUCCES`. Résolveurs :
  `trancheDe`, `localiserZone`, `offsetToile`, `xpEffective`.
- `src/combat.ts` — **moteur pur**. `runCombat()` est la boucle de tour asynchrone, découplée de
  l'entrée par des **contrôleurs** (`Controller = (acteur, combatants) => Action | null`) : l'UI passe
  un contrôleur à promesse, `controllerIA` pilote les ennemis. RNG injecté (`hooks.rng`).
- `src/progression.ts` — **pur**. `xpRequis`, `gagnerXP`, `statsFinales`, `pvMaxFor`, `multOffensif`,
  `multSoin`, `statPourPoints`, `coutPoint`. Aucun DOM, aucun storage.
- `src/carte.ts` — **pur**. `genererCarte(rng, pools)` construit le graphe de nœuds d'une zone (treillis
  en losange, rangées alternées de 2 et 3, arêtes en diagonales exactes) ; `atteignables(carte)` /
  `noeud(carte, id)` pour la navigation.
- `src/run.ts` — `RunState`/`PersoState`, roster dynamique (`nouvelleRun`, `recruter`,
  `propositionsRecrutement`), fabriques de combattants (`combattantDepuisPerso`, `equipeCombattante`,
  `synchroniserPV`), bonus d'équipement (`bonusEquipement`, `pvMaxPerso`), persistance `Meta`, Ascension
  (`effetsAscension`, `appliquerAscensionEnnemis`), succès, héritage entre tranches.
- `src/rng.ts` — `mulberry32`, **source unique** du tirage pseudo-aléatoire des deux outils de mesure
  (voir *Outils de mesure*). Pur, sans dépendance.
- `src/config.ts` — réglages joueur (`Settings`) : touche de fin de tour, `autoFinTour`, `formation` par
  classe, `ordre` (préférence durable de rang dans la file alliée), validés au chargement.
- `src/ui/` — rendu DOM + contrôleur joueur, un fichier par écran derrière un barrel (`index.ts`).
  Couches : `assets.ts` et `dom.ts` n'importent aucun autre module ui ; `composants.ts` (helpers
  partagés, dont `sortTooltipHtml`) n'importe qu'eux ; `combat.ts` (tout l'écran de combat) et les
  écrans importent assets/dom/composants — **les écrans n'importent jamais `ui/combat.ts` et
  réciproquement**. Écrans : `accueil`, `carte`, `equipe`, `inventaire`, `boutique`, `collections`,
  `fin`.
- `src/main.ts` — orchestration : accueil → pour la tranche choisie, `jouerZone` génère le plateau de
  chaque zone et le parcourt jusqu'au donjon battu → zone suivante ; un wipe termine la run. PV et
  niveaux persistent entre zones, seul `Meta` survit à la mort.
- `src/sim.ts`, `src/banc.ts`, `src/banc-moteur.ts`, `editor/` — les trois outils **hors jeu**, décrits
  ensemble dans *Outils de mesure* ci-dessous.

**Deux coutures qui gardent tout testable :**

1. **Les combattants sont reconstruits à chaque combat** depuis `RunState` — stats finales et `pvMax`
   sont calculés dans `run.ts` et figés dans le `Combatant`, donc `combat.ts` ignore tout des niveaux.
   Les PV persistent via `PersoState.pvActuels` (réécrit par `synchroniserPV`), pas en gardant l'objet.
2. **Le contrôleur asynchrone** : `runCombat` `await` le contrôleur du camp actif, donc la même boucle
   tourne headless (IA vs IA en test) ou interactive (promesse résolue par un clic), sans branche.

## Outils de mesure

Trois outils tournent **à côté** du jeu et partagent une règle unique : **ils appellent le vrai moteur et
les vraies fabriques, jamais une copie d'une formule**. Une seconde implémentation diverge du jeu en
quelques semaines, et un chiffre faux est pire que pas de chiffre.

### Banc d'équilibrage — `npm run sim` (`src/sim.ts`)

Il mesure un **parcours de zone**, jamais une rencontre isolée : la difficulté de ce jeu est une
**attrition** (les PV persistent d'un nœud au suivant, la taverne est le seul soin), et un boss gagné à
100 % depuis des PV pleins peut être un wipe quand on y arrive à 45 %. Le parcours simulé calque
`main.ts` : 6 combats + 1 élite dans un ordre tiré, une taverne à position tirée (supprimée à l'Ultime
via `sansNoeudsDeZone`, comme en jeu), puis le donjon ; PV reportés, XP en route, rencontres et salle de
boss tirées dans les pools.

**Pas de colonne « nu »** : personne n'est nu à un boss, et elle pilotait les drapeaux. Les deux loadouts
encadrent la réalité — **ATTENDU** tire la rareté de chaque pièce aux vrais poids (60/25/12/3), donc la
moyenne intègre la chance de drop au lieu de figer tout le monde en commun.

**Caveat, et il compte** : son `controllerIA` soigne optimalement, ne joue que les sorts `type: "degats"`
(le plus cher d'abord) et ignore buffs, placements et séquences de PA — c'est-à-dire l'essentiel des onze
kits reworkés. C'est un **plancher de difficulté**, donc il n'est informatif que **dans un seul sens** :
un `clear` élevé prouve qu'une zone est facile, un `clear` bas ne prouve pas qu'elle est trop dure.
Plusieurs rencontres sont structurellement **sous-lues** par lui et ne doivent pas être nerfées pour lui
plaire : la mue du Kwakwa, les annulations par tour du Meulou, la toile du Domaine Ancestral.

**L'attrition se lit sur `PVdon`, jamais sur `PVfin`.** Les deux colonnes n'ont pas la même
conditionnelle : `pvFin` ne moyenne que les parcours **gagnés** (`clears`), alors que `pvDonjon` moyenne
ceux qui **atteignent** le donjon (`nbArrivesDonjon`). Donc `PVfin` est biaisé par la survie — durcir une
zone en retire les parcours exsangues au lieu de faire baisser la moyenne, et il *monte* : mesuré, +60 %
de PV aux escortes des Larves l'a fait passer de 84 à 93 % en faisant tomber le `clear`. **`PVdon`, lui,
est non biaisé dès que les wipes se concentrent au donjon** — ce que la colonne « ça casse à » permet de
vérifier d'un coup d'œil : si elle lit `donjon (n)`, tous les parcours ont atteint le boss et `PVdon` dit
exactement l'usure des sept nœuds d'avant-boss. C'est **la** lecture d'attrition du projet, et la cible de
conception (arriver au boss visiblement entamé) s'écrit sur elle. `PVfin` ne sert plus qu'au drapeau
d'autowin de `verdict()` (`clear ≥ 99,5 %` **et** `PVfin > 60 %`).

**Deux plafonds tiennent `PVdon` haut, et il faut les connaître avant de viser un chiffre** : la taverne
rend **50 %** des PV max (`TAVERNE_PCT`) au milieu du parcours, et le soigneur du banc est optimal — donc
allonger les combats lui donne surtout **plus de tours de soin**. Conséquence contre-intuitive et
mesurée : gonfler les PV des monstres fait *monter* `PVdon`.

**Les crans hauts se règlent par les PV des monstres, le ★1 par leurs dégâts** — et les deux tirent en
sens opposés sur `PVdon`. L'Ascension multiplie PV *et* dégâts : allonger un combat compose les deux,
donc gonfler les PV effondre Cauchemar/Ultime tout en laissant le ★1 clairable, au prix d'un `PVdon` qui
remonte. Élargir une fourchette fait surtout tomber le ★1 et bouge peu les crans hauts. **Mesuré sur la
toile 8** : PV des escortes ×2,1 → ★4 de 85 % à 20 % ; à PV de famille, +35 % de stat élémentaire → ★4
seulement de 67 % à 55 %. L'axe PV domine l'axe dégâts, parce que le facteur limitant est le **nombre de
tours** que l'ennemi survit, pas ce qu'il frappe.

**Le vrai plafond de T1 est sa courbe de stats, pas ses zones.** Médianes de stat élémentaire des
escortes relevées avant la passe des trois zones : t7 33 · t8 34 · t9 33 · t10 40 · t11 46 · t12 42 — un
plateau de t7 à t9 alors que les PV des héros, eux, montent avec le niveau. C'est la cause du
ramollissement de la seconde moitié de T1, et une zone n'y échappe pas sans sortir de sa famille : la
remise à plat de cette courbe est un chantier de **tranche**, pas de zone. **Familles à respecter**
(médianes de PV d'escorte : t7 69 · t9 81 · t10 105 · t11 116 · t12 190) — les gonfler pour faire tomber
un cran d'Ascension crée une marche que le joueur lit comme un bug de progression.

**Cible de conception** (lue par `verdict()`) : ★1 doit être **clairable simplement sans être un autowin**
— un clear parfait qui n'entame pas les PV n'offre aucune tension. Il faut de la marge au-dessus, parce
que la méta-progression à venir (reliques Dofus, parchotage) aplanira le jeu : **Cauchemar et Ultime ne
doivent pas être clairables en l'état**.

### Banc d'essai de l'éditeur — `src/banc.ts` + `editor/js/70-banc.js`

Mesure les sorts d'une classe sur des mannequins, avec le contenu **en cours d'édition** chez le game
designer.

- **`src/banc.ts` est PUR** (aucun DOM, aucun `localStorage`) et mesure en lançant **réellement**
  `lancerSort`. `PV_MANNEQUIN` est énorme à dessein : un mannequin mort sortirait de `ciblesValides` et les
  répétitions suivantes tomberaient à zéro **sans prévenir**.
- **`src/banc-moteur.ts` est une façade explicite** — le seul point d'entrée compilé en IIFE et inliné dans
  `editeur.html`. `banc-moteur.test.ts` la fige : un renommage en amont casse au `npm test`, pas à
  l'ouverture du fichier chez le designer.
- **Rien ne s'assemble champ par champ** : héros et exemplaires passent par les fabriques du jeu
  (`persoAuNiveau`, `combattantDepuisPerso`, `instanceDuTier`). Les surcharges d'équipement sont stockées
  comme de **simples ids** et l'`ItemInstance` est reconstruit à **chaque** mesure — sinon une pièce
  choisie une fois garderait des stats périmées après une édition dans l'onglet « Items ».

### Éditeur standalone — `npm run editor:build`

Génère `editeur.html` à la racine (gitignoré) : fichier **unique et auto-suffisant** — template + styles +
contenu courant + assets en data URI (`monstres`, `items`, `classes`, `spells/<classe>/<sort>`) + moteur
compilé. Le JS vient de `editor/js/`, **concaténé par ordre alphabétique de nom de fichier** (`00-etat.js`
… `70-banc.js`) : pas d'imports, donc le préfixe numérique EST l'ordre de chargement. `editor/js/` affiche,
il ne calcule pas. Mode d'emploi côté designer : `editor/README.md`.

## Pipeline de contenu

`src/content/*.json` est la **source de vérité du contenu**, en sérialisation canonique
(`scripts/canonical.mjs` : clés triées, indent 2) pour des diffs lisibles. Garde permanente
`src/content.test.ts` : le contenu doit passer `scripts/content-validate.mjs` (3 passes — schéma,
cohérence référentielle, règles métier) à chaque `npm test`.

- **`npm run content:import` est la porte du GAME DESIGNER**, pas la seule voie d'écriture : sa passe 3
  interdit délibérément d'ajouter une zone ou de créer un sort, et ne tolère que des changements
  numériques sur les sorts existants.
- Un ajout **structurel** (zone, sort, classe) se fait côté développeur par **script jetable**
  réécrivant le JSON avec `stringifyCanonique`, sous la garde des passes 1-2 rejouées par `npm test`.
  **Un script jetable doit refuser d'écraser une clé existante** (un préfixe de rencontre réutilisé a
  déjà silencieusement effacé les cinq rencontres d'une autre zone).
- **L'identifiant d'un sort DOIT être le nom de son fichier d'icône** : `sortIcon` construit
  `/assets/spells/<classe>/<id>.png`. Des tests confrontent identifiants et fichiers dans les deux sens
  (aucune icône orpheline, aucun sort sans icône).

Sources externes : sprites, stats de base et compositions de donjons viennent de **DofusDB**
(`api.dofusdb.fr/dungeons/{id}` → `monsters[]` + `bosses[]` ; images clés par **gfxId**, pas par id de
monstre) — vérifier là avant d'inventer une espèce. Les noms d'**archimonstres** (`archiNom`) viennent
de **Metamob**, plus complet que DofusDB pour les archis (voir la mémoire
`archimonstre-source-metamob`).

## Règles de combat faciles à casser

### Élément de frappe — AUTOMATIQUE, par cible

Il n'y a **pas d'élément stocké** : ni choix manuel, ni ronds à cliquer. Correspondance élément ↔ stat :
`terre→force`, `feu→intelligence`, `air→agilité`, `eau→chance`.

À **chaque coup**, `meilleurElement(lanceur, cible, base, jetTire)` (privé, appelé depuis `degatsAvec`
avec le jet DÉJÀ tiré) choisit, parmi les **éléments candidats** du lanceur, celui que la cible COURANTE
résiste le moins, avec la vraie formule de résistance — **jamais un second tirage de RNG**, égalité
départagée par l'ordre des candidats. `elementContre(lanceur, cible, sort)` est le wrapper
d'**affichage** exporté (même formule sur un jet moyen). Candidats (`elementsCandidats`) : la **paire
fixe** d'un héros (`Classe.elements`), les **2 meilleures stats** d'un monstre, ou **les 4** si le
combattant porte `elementLibre` (Kwakwaffe). `elementDeFrappe(c)` est la variante sans cible.

Conséquence : deux sorts peuvent frapper la même cible dans deux éléments différents si un debuff a
bougé ses résistances. `ResultatDegats.element` porte l'élément réellement employé, et le log le nomme à
chaque coup.

**Invariant monstre** : un monstre doit avoir **exactement une** stat élémentaire signifiante — une
seconde au-dessus de 60 % de la dominante rendrait son point faible flou. Imposé par
`src/monstres.test.ts` (`SEUIL = 0.6`) avec une liste d'exceptions **nommées** et un second test qui
vérifie que chaque exception dépasse réellement le seuil (la liste ne peut pas pourrir en silence).

### Grille et règle de ligne (SYMÉTRIQUE, 4×2 par camp)

`position` est une case **0-7** : **0-3 = ligne avant**, 4-7 = arrière (`estAvant(c) = position < 4`).
Les sorts `ennemi_ligne` ne touchent que la ligne avant vivante du camp visé ; si elle est vide,
l'arrière devient exposée (`ligneFront`). Vaut pour **les deux camps**. `ennemi_tous` ignore la règle ;
`provoque` la surcharge. Le placement est libre (tout devant, tout derrière, mono-tank…) : joueurs via
`config.formation`, ennemis via la `position` de la rencontre.

**`lancerSort` n'applique AUCUN filtre de ligne.** Toute la règle — `ennemi_ligne` vs `ennemi_tous`,
`tetanise`, `ignoreLigne` — vit **exclusivement dans `ciblesValides`**, consultée par l'IA et l'UI
**avant** l'appel. Conséquence pour les tests : **un test de CIBLAGE doit passer par `ciblesValides`**,
jamais par `lancerSort` seul, qui résout le sort sur n'importe quelle cible qu'on lui passe. Un test de
ciblage écrit via `lancerSort` continue de passer même si on saborde le `cible:` du sort — il ne prouve
rien.

### Pipeline de dégâts (l'ordre compte — `degatsCible` dans `combat.ts`)

esquive (Agilité, plafonnée) → jet (ou max si charge `maxRoll`) → **× `multStatFrappe`** (la stat de
l'élément de frappe MULTIPLIE la fourchette : `1 + DEGATS_PAR_POINT × stat`, taux unique du jeu, voir
*Dégâts : un seul taux* plus bas) → critique (Agilité, plafond 35 %, il *ajoute* des dégâts, ne double pas) → debuff
`degatsInfliges` → multiplicateur de rebond → résistances (sauf `ignoreResistances`) → bonus d'équipe
Dofus (camp joueur) / palier d'Ascension (camp ennemi) → reliques Dofus à déclenchement, DU TOUR
(`degatsPctDofus` — Nébuleux, Domakuro) puis PERMANENT (`degatsPctPermanent` — Domakuro une fois acquis)
→ `multOffensif` (Intelligence, plafonné, tous lanceurs) → `armure` (montant **plat**
retranché, `sommeEffet(cible, "armure") + (cible.armure ?? 0)`) → arrondi, plancher à 0.

### Effets, soutien, ticks

Les dégâts passent par `infligerDegats` → **le `bouclier` absorbe avant les PV**. `poison`/`hot` sont des
effets datés de `effets[]`.

**Piège de durée à connaître** : seuls les effets listés dans `EFFETS_TICK_DEBUT` (`paParTour`, `hot`,
`bonusPieges`) décrémentent dans `effetsDebutTour`, au **début du tour de leur porteur**. **Tous les
autres** décrémentent dans `decrementerEffets`, à la **fin du tour du combattant qui agit**. Un self-buff
de 1 tour posé pendant son propre tour serait donc détruit par la passe de fin de ce même tour s'il n'est
pas dans `EFFETS_TICK_DEBUT`.

**Le poison retire les PV DIRECTEMENT dans `effetsDebutTour`**, hors `infligerDegats` : ni bouclier, ni
résistances, ni armure, ni annulation de coup ne l'atténuent. C'est le seul dégât du jeu dans ce cas, et
c'est la leçon d'une zone entière.

Soins via `soigner` (dont `soinComplet`, `allie_tous`, `soinEquipeRatio`) ; `appliquerSoutien` applique
bouclier/HoT/`paGain`/`bonusProchainSortPct`. Les cooldowns vivent sur `acteur.cooldowns` et sont
appliqués **dans `ciblesValides`**. Un soin vaut `jet(baseMin, baseMax) × multSoin(stats du lanceur)` —
un soin ne passe **jamais** par `multStatFrappe` : sa puissance se règle uniquement par
`baseMin`/`baseMax`, et la caractéristique de frappe n'y entre que via `multSoin`.

### Ordre de tour (ALTERNÉ et FIGÉ)

Le combat entier joue une séquence fixe construite **une fois** depuis le roster de départ
(`ordreDuCombat`, qui alimente aussi la timeline de l'UI — source unique ; `prochainActeur` = premier
vivant non-joué). Le camp à la meilleure initiative **moyenne de base** ouvre (égalité → camp joueur), les
camps alternent, le surplus du camp le plus nombreux ferme la ronde (4v2 → A E A E A A). La moyenne porte
sur **tous** les `principaux` (morts inclus, invocations exclues) et n'est **jamais** recalculée en cours
de combat. Dans chaque camp : file joueur dans l'ordre de `run.persos`, file ennemie par initiative
décroissante.

Les morts **sautent leur créneau**, sans ré-entrelacement, et un ressuscité retrouve son créneau.
Conséquence : les effets d'`initiative` en cours de combat sont **inertes** pour l'ordre.

**Les invocations qui jouent** (`invoquePar`) sont **hors alternance** : elles agissent juste après leur
invocateur, chaque ronde, et **meurent avec lui** (`purgerInvocationsOrphelines`, en cascade). Les
invocations-**obstacles** (`estInvocation` : Poupée, Lance, Égide) n'ont jamais de créneau.

### Plafonds (obligatoires — ne pas retirer les `Math.min`)

| Grandeur | Plafond | Formule |
|---|---|---|
| taux de critique | 35 % | `min(0.35, 0.05 + agilité × 0.0025) + crit_plat` (plancher 5 % pour tous) |
| dégâts de critique | +45 % | `min(0.45, 0.25 + agilité × 0.002)` |
| dégâts finaux (`multOffensif`) | +20 % | `1 + min(0.2, intelligence × 0.001)` |
| esquive | 50 % | `chanceEsquive(c)` — **source unique**, partagée par le pipeline, Brume et les infobulles |

Seul le `crit` **plat** de l'équipement peut dépasser le plafond de 35 %, et uniquement via `critExcedent`
(le surplus devient des dégâts plats). La part dérivée de la stat ne le dépasse jamais.

### Dégâts : un seul taux, plus aucun coefficient par sort

Un sort de dégâts se règle **uniquement par sa fourchette** (`baseMin`/`baseMax`). La caractéristique de
frappe la **multiplie** au taux unique `DEGATS_PAR_POINT` (`progression.ts`, 3 % par point), via
`multStatFrappe` — **source unique** partagée par le pipeline, le classement des éléments et les
infobulles. Le champ `Spell.scaling` / `AttaqueArme.scaling` a été **retiré** : il n'existe plus de
coefficient réglable sort par sort.

Deux conséquences à garder en tête :

1. **Le bonus de stat est PROPORTIONNEL à la fourchette.** Élargir une fourchette majore aussi tout le
   scaling du sort — ce n'était pas le cas en additif. Un lanceur à grosse fourchette gagne donc
   structurellement plus qu'un lanceur à petite fourchette, à stat égale. C'est ce qui rend la lecture
   « telle fourchette one-shot telle tranche de PV » directe, et c'est aussi ce qui a fait grimper les
   signatures de monstres de T2 (fourchettes de 20-26) quand les kits de héros (8-10) n'ont pas bougé.
2. **Le choix de l'élément de frappe ne dépend plus du jet.** Le jet étant un facteur commun à tous les
   candidats, `elementsClasses` ne classe plus que sur `multStatFrappe(stat) × (1 − résistance)` — donc
   `elementContre` (affichage) est devenu **exact**, il n'approxime plus rien. Corollaire : le poids
   relatif de la stat face à une résistance a baissé, et une résistance de 50 % (les Blops Royaux en
   portent) peut légitimement faire basculer un monstre sur son second élément si son écart de
   caractéristiques est faible — `element.test.ts` nomme le cas (l'Araknotron).

### Autres invariants

- Les **PV persistent** entre combats et nœuds d'une run — la Taverne est le seul soin. Un wipe termine la
  run mais **ne doit jamais effacer `Meta.dofus`**.
- **Modèle de PV** : `pvMax = pvBase + vitalitéFinale × PV_PAR_VITA`. Les dégâts des monstres sont
  calibrés contre ces PV gonflés — les deux se retunent ensemble.

## Stats : archétypes & éléments

**Il n'y a plus d'allocation manuelle de points.** Les stats d'un héros sont une fonction **pure** de sa
classe et de son niveau (`statsFinales`) ; `Progression` se réduit à `{ niveau, xp }`.

Chaque classe porte un `archetype` (`melee` | `distance`) et **deux `elements` fixes**. La table complète
et faisant foi est **`CLASSES-ELEMENTS.md`**, vérifiée en synchro avec `src/content/classes.json` par
`src/archetypes.test.ts` — **c'est le seul endroit où la répartition est affirmée comme règle** ; ne pas
en recopier une copie dans un fichier de test de classe.

| Archétype | Par élément | Vitalité |
|---|---|---|
| `melee` | +3 dans chacun de ses 2 éléments | +2 |
| `distance` | +4 dans chacun de ses 2 éléments | +1 |

`statPourPoints` convertit points → stat au tarif croissant `coutPoint` (1/2/3 selon les seuils 200/300),
en fonction pure du niveau.

**Effet secondaire de chaque élément** (hors tarif, hors équipement, calculé dans `statsFinales`) :

| Élément | Effet |
|---|---|
| terre (force) | +vitalité passive : `Math.floor(force / 5)` |
| feu (intelligence) | dégâts finaux : `multOffensif` (plafond +20 %) |
| air (agilité) | taux **et** dégâts de critique (plafonds ci-dessus) |
| eau (chance) | +prospection passive : `Math.floor(chance / 3)` |

**L'intelligence compte double** (multiplicateur de fourchette *et* `multOffensif`, qu'elle plafonne dès 100) : à
dominante égale, un monstre feu frappe ~38 % plus fort qu'un autre. Repère mesuré : **75 en feu ≈ 105
dans un autre élément**. C'est la cause la plus fréquente d'une escorte qui dépasse son boss.

`multSoin` lit la **caractéristique de frappe du lanceur**, pas l'intelligence — un soigneur sans feu
soigne à plein régime.

## État courant

**11 classes jouables** (Iop, Cra, Eniripsa, Sram, Feca, Ecaflip, Ouginak, Roublard, Xélor, Éliotrope,
Forgelance). **La Sadida est désactivée** : conservée dans `CLASSES`/les données pour les tests et les
sauvegardes, mais filtrée hors de `classesDisponibles()` en attendant sa refonte.

**Chaque classe reworkée a exactement 6 sorts** (les anciens kits en avaient 8). Recrutement : on démarre
à 2, on recrute/soigne aux tavernes, équipe de 4 maximum.

**Tranche 1 = 12 zones** (toiles 1-12), équilibrée et pourvue en objets.
**Tranche 2 = 12 zones** (toiles 13-24), **complète en contenu mais `enChantier: true`** — donc visible,
déverrouillable et mesurée par le banc, mais **non lançable**. t3-t5 ont `zones: []` et s'affichent
« en construction ». Les donjons événementiels (Nowel, Halouine, Pwak) sont réservés et ne doivent jamais
entrer dans une liste de zones de tranche.

Chaque zone de T2 enseigne une leçon en réveillant une mécanique que le moteur savait déjà faire :
résistances élémentaires (13), formation et `ennemi_tous` (14), absorption (15), poison qui ignore
boucliers et résistances (16), riposte `contre` (17), armure plate (18), curare `friction` — soins ET
boucliers bloqués (19), désenvoûtement `dissipePositifs` (20), premier soigneur ennemi `ia: "soutien"`
(21), annulations par tour (22), toile `tetanise` (23), examen final tirant une des quatre leçons au
hasard (24).

**Trois zones de T1 portent une signature**, posée pour qu'elles cessent d'être des autowins :
Champs d'Astrub (2) « la peur déplace » (`deplaceCible`), Donjon des Scarafeuilles (8) « la poussière
aveugle » (`echecCritique`, jusque-là dormante dans le moteur), Donjon des Larves (10) « elles
drainent » (`vampirismeRatio`). Elles ne dépensent **aucune leçon de T2** : `friction`, `tetanise`,
`contre`, `armure`, `poison` et `dissipePositifs` restent la pédagogie des zones 13-24.

**Dette assumée sur `charge`** : douze espèces **hors de ces trois zones** portent encore `charge` (6 PA)
avec un budget de 5, donc un sort qu'elles ne lanceront jamais (`bandit_roublard`,
`boostache_prepubere`, `crustorail_morito`, `forgeron_sombre`, `gobaladee`, les quatre `kwakere_de_*`,
`palmifleur_morito`, `sakarien`, `tofu_ventripotent`). Les réparer déplacerait l'équilibrage de zones
qui n'était pas dans ce chantier — à traiter avec la passe de la zone concernée, pas isolément.

**Deux chantiers ouverts sur T2** : (1) la **passe d'équilibrage** — les objets des toiles 13 à 24 sont
en place, donc les chiffres du banc sont désormais exploitables, et ils disent que la tranche est un
**mur** presque partout dès ★1 ; (2) **retirer `enChantier: true`** de `TRANCHES[1]` (un test verrouille
sa présence tant que ce n'est pas décidé).

**Mécaniques qui ont quitté le camp du joueur** (elles vivent encore côté monstres, sauf mention) :
`dissipePositifs`, poison transmissible (`poison.transmet`), taunt (`provoqueTours`), riposte
(`Spell.contre`), `friction`. **`dissipe`** (la seule purge d'effets négatifs) n'a **plus aucun porteur**,
ni héros ni monstre : elle est gardée **en dormance** dans le moteur sur décision d'Adam, avec deux tests
dans `eniripsa.test.ts` — un sort synthétique qui couvre le chemin moteur, et un qui **constate l'absence
de porteur** (celui-là doit tomber le jour où une classe reprend une purge).

## Jurisprudence du projet (pièges déjà payés)

- **Un champ sans porteur se retire.** Quand un rework retire le dernier sort qui portait un champ
  `Spell`/`Combatant`, le champ ET son bloc de résolution partent aussi (`nbCibles`, `bonusDe`,
  `elementImpose`, `provoqueTours`, `executeSeulement`…). Vérifier au grep, dans le contenu **et** dans le
  code. Exception unique et documentée : `dissipe` (ci-dessus).
- **Les PA orphelins** — un monstre dont le budget de PA ne peut pas être dépensé par son kit.
  `iaAgressif` joue le sort le plus cher d'abord, sans mémoire du tour : un boss à 8 PA avec une signature
  à 6 gaspille 2 PA par tour, et un sort au même coût qu'un autre ne part jamais. **Un kit de monstre doit
  pouvoir consommer tout son budget** ; un sort à rider répétable a besoin de `maxParTour` sinon il
  s'empile.
- **Un sort à 0 PA doit déclarer `maxParTour` ou `cooldownTours`** (imposé par
  `scripts/content-validate.mjs`). `maxParCibleParTour` **ne suffit pas** : l'IA le relancerait sur une
  autre cible à chaque décision du même tour, PA jamais débités.
- **Un compteur incrémenté avant la résolution lit déjà 1 au premier lancer** (`lancersCeTour`,
  `lancersCombat`) : un multiplicateur d'escalade s'écrit `1 + valeur × Math.max(0, compteur − 1)`. Un
  test à un seul lancer ne le voit pas — en tester trois.
- **Un effet de rangée ou de portée se résout UNE fois par lancer**, jamais une fois par cible touchée
  (`effetRangeeAlliee`, `bouclierPortee`, `esquivePartageeRangee`) — donc depuis les **deux** chemins de
  `lancerSort` (dégâts et soutien).
- **Une formule copiée deux fois finit par raconter deux histoires** : `chanceEsquive` a été extraite pour
  ça. Même logique pour toute nouvelle formule lue par le moteur et par l'UI.
- **Un index qui change de sens ne change pas de type.** `palier` d'Ascension est passé de « nombre
  de crans appliqués » (0-8) à « index du cran » (0-4) : c'est un `number` dans les deux cas, donc
  **le typecheck ne voit rien**, et `ASCENSION_MAX` a changé de définition (`length` → `length - 1`)
  sous le même nom. Toute borne qui lisait la constante est restée juste par coïncidence de
  changement simultané. Quand le sens d'un nombre bouge, chercher ses lecteurs au grep — le
  compilateur ne le fera pas.
- **Un outil de mesure n'a pas droit à son propre RNG.** Le banc d'essai portait un LCG recopié dont la
  multiplication (`g * 1103515245`) dépassait 2^53 et perdait ses bits de poids faible en flottant : cycle
  réel de 10466 tirages, si bien qu'une mesure à 500 répétitions rejouait les mêmes tirages passé la
  ~300ᵉ, avec un biais d'environ 0,5 %. `src/rng.ts` (`mulberry32`) est désormais la source unique — deux
  générateurs, c'est deux qualités de tirage pour deux chiffres censés se comparer.
- **Un contre documenté mais jamais atteignable n'est pas un contre** : `ignoreLigne` face à `tetanise`
  était décrit ici pendant des mois sans exister dans le moteur, faute d'un seul porteur des deux côtés.
  Seul un test qui l'exerce le révèle.
- **Un test dont le sujet est introuvable doit ÉCHOUER**, jamais sauter en silence (des tests de zone
  cherchaient 4 espèces dans une salle qui n'en contient que 2, et passaient).
- **Une réduction ou un compteur invisible se lit comme un bug** : toute mécanique persistante (bombes,
  téléfrags, pièges, annulations par tour, armure) doit avoir son badge sur la carte de combat.
- **Trou structurel connu** : `sortTooltipHtml` (`ui/composants.ts`) ne sait formater que nom, coût, jet,
  description, cible et cooldown. **Toutes** les mécaniques introduites par les reworks récents
  n'atteignent le joueur que par le texte libre de la description. Les tests de contenu figent ces
  descriptions, mais le trou reste ouvert — c'est un chantier possible, pas un défaut d'un rework.
- **Une description est un engagement.** Le Dofus Turquoise a passé des mois avec une description
  prometteuse et aucune mécanique. Une relique, un objet ou un sort ne reçoit sa description qu'au
  moment où son effet est branché ; sinon il garde le libellé neutre « effet à venir ». Un test de
  cohérence confronte les deux listes (`dofus.test.ts`).

## Systèmes

### Équipement & raretés (toiles)

**4 emplacements** — `arme`/`coiffe`/`cape`/`anneau`. Tous les objets sont des objets de **toile**, à
**stats FIXES par tier** (`Item.tiers` : commun/rare/épique/légendaire, aucun jet). Le butin est
**per-run** (`RunState.inventaire` + `PersoState.equipement` portent des `ItemInstance`, perdus à la
mort) ; la **Prospection** augmente le taux de drop. `src/content/butin_toiles.json` porte les pools par
toile (toile = index de zone + 1 en ordre de jeu). `tirerRarete` (poids 60/25/12/3), `rollItem` fige les
stats du tier dans l'instance, `tenterButin` prend un id de ZONE. Les stats d'équipement se replient dans
le combattant via `bonusEquipement`/`pvMaxPerso`.

**Panoplies (légères)** : les 4 pièces de zone portent `Item.panoplie` ; porter les 4 donne **+1 PA**
(`PANOPLIE_BONUS_PA`). Pas de palier à 2 pièces, pas de bonus de stats par set. Les objets élite/boss
n'appartiennent à aucun set — en équiper un casse le bonus, arbitrage volontaire.

**`Item.adaptatif`** alimente **les deux** stats de `Classe.elements` du porteur : depuis le passage à
l'élément automatique, il n'y a plus de stat « choisie » à privilégier.

**Mécaniques spéciales d'objets** (premier porteur gagne, dans `combattantDepuisPerso`) : `paGamble`,
`ligneAvant` (équipable uniquement en ligne avant, imposé dans `equiper`/`peutEquiper` et bloqué par
l'écran Formation), `riposteAvant`, `esquiveArriere`, `soinDegatsRecus`, `changeLigne` (offre le sort
`changer_ligne`), `perceResistances`, `frappeDerriere`, `prospParPvManquant`, `multKamas`,
`bouclierDebut`, `poison_arme`, `soinAllieBlesseRatio`, `retraitPA`, `elementLibre` (élargit les candidats
d'élément aux 4), `renaissance` (une résurrection par combat à 30 % PV, branchée dans `infligerDegats`
**et** dans le chemin de mort par poison).

### Archimonstres, Bestiaire & Dofus Ocre

N'importe quel ennemi peut apparaître en variante **Archi** boostée (`ARCHI`, taux de base 0,8 %). Le
**nœud Otomai est l'événement philtre** : chaque visite ajoute +`ARCHI.philtre` (0,4 %) pour le reste de
la run, **plafonné à `ARCHI.philtresMax` = 4** (au-delà, le détour vers chaque Otomai remplissait le
bestiaire en quelques runs, alors que le Dofus Ocre récompense un bestiaire complet visé sur le long
terme).

Le vaincre capture l'espèce une fois (`Meta.archis` persistant), suivi dans un **Bestiaire** paginé par
tranche (seules les tranches pourvues de zones ont un onglet). Le **Dofus Ocre** n'est pas un drop de
boss : il donne +1 PA à toute l'équipe une fois **toutes** les espèces à `archiNom` capturées
(`bestiaireComplet`, lu par `bonusEquipe(meta)`) — pas de palier intermédiaire.

**Archimonstres errants** (`ERRANTS`, `appliquerErrants`) : les six Piou n'appartiennent à aucun donjon,
donc à aucun pool. Ils surgissent **en plus d'un pack de combat NORMAL** (`type === "combat"` seulement —
jamais en élite ni en donjon, ces salles sont équilibrées), **déjà mutés en archi** (soumis au tirage
habituel, capturer un Piou précis vaudrait ~0,04 % par combat). Le taux est **une** valeur sans aucun
levier — ni philtres, ni Prospection, ni Ascension. **Aucun test ne code le taux en dur** : ils lisent la
constante et vérifient un ordre de grandeur, parce que la valeur est faite pour monter.

Deux garde-fous globaux dans `zones.test.ts` : toute espèce est **placée en zone OU déclarée errante**, et
un errant n'est réellement atteignable que s'il a un taux > 0, un archi et un sort.

### Reliques Dofus

**Aucune relique ne se lâche au combat.** Les boss n'en portent plus : le champ `Monstre.dofus`,
`Combatant.dofusLache`, la table `DOFUS_DROP`, le taux `DOFUS_DROP_RATE` et l'écran « Dofus obtenu »
ont tous été retirés. Les reliques s'obtiendront **par quête** ; en attendant, la seule voie câblée
est le Dofus du Cauchemar (Cauchemar sur les cinq tranches), donc **aucune n'est atteignable
aujourd'hui** et `bonusEquipe` rend du neutre pour tout le monde. C'est assumé.

**Une relique agit UNE fois, quel que soit le nombre d'exemplaires possédés.** Le modèle « par copie
plafonné par `maxCopies` » a disparu ; le badge `×N` du rack est décoratif. `Meta.dofus` est une
liste d'**exemplaires** (`DofusInstance`) et non d'identifiants : seul le Kalyptus s'en sert, son
`jet` étant figé à l'obtention et le **meilleur** jet possédé faisant foi.

**Deux familles d'effets.** Les effets **chiffrés** vivent dans `DOFUS_EFFETS` (`data.ts`) et sont
repliés dans le combattant par `appliquerBonusEquipeCombat`. Les effets **à déclenchement** vivent
dans `src/dofus-effets.ts`, module **pur** qui ne mute presque rien : il **décrit** des intentions
(soins, boucliers), et `combat.ts` les applique. C'est ce qui évite l'import circulaire et permet de
tester un effet sans monter un combat.

**Quatre ancrages** dans la boucle de tour : début de tour (Dokoko, Nébuleux, Argenté), fin de tour
(Émeraude, Veilleurs, Domakuro), mort d'un ennemi (Dorigami), dégâts infligés (Tacheté). Le Dofus du
Cauchemar est à part : il force le camp joueur à ouvrir dans `ordreDuCombat`, contredisant la règle
d'initiative — c'est le seul effet qui touche la séquence de combat.

**Le moteur ne lit jamais `Meta`** : `main.ts` calcule `bonusEquipe(meta)` et `reliquesActives(meta)`
et les passe à `runCombat`.

Le **Dofus Ocre** n'a plus de paliers : il donne +1 PA une fois **toutes** les espèces à `archiNom`
capturées.

### Kamas, HDV & Forgemagie

- **Kamas** : monnaie per-run (`RunState.kamas`), perdue à la mort, gagnée aux victoires via `gainKamas`
  (type de nœud × toile, ±15 %) et par la vente à l'HDV. Constantes dans `KAMAS`.
- **Hôtel de vente** : boutique PREMIUM — objets de la toile courante en épique/légendaire seulement,
  objets de la toile suivante à partir de rare (le commun/rare local vient des combats). Revente 50 %.
- **Forgemagie** : monte n'importe quelle instance possédée (inventaire ou équipée, mutation en place via
  `forgerInstance`) au tier de rareté **suivant** ; coût = prix HDV du tier cible × `KAMAS.forgeCoef`. Le
  **Forgemage téméraire** coûte ×0.3 et échoue 30 % du temps (kamas perdus, objet intact).

### Mode Ascension

Une tranche battue devient rejouable à difficulté croissante : **5 crans** affichés en étoiles
(`ASCENSION`), dont le premier (★1 Normal) est le jeu de base. **Le palier est l'INDEX du cran
(0-4), pas un nombre de paliers appliqués** — `effetsAscension(n)` est une **lecture directe** de
la table, sans fusion, et chaque cran **redéclare tout son tableau en absolu**. `ASCENSION_MAX` vaut
donc `ASCENSION.length - 1`.

Effets : dégâts des monstres (`degatsMult`, via `enemyDamageBonus` — un multiplicateur de **camp**
dans le contexte de combat, miroir de `playerDamageBonus`, qui couvre donc aussi les ennemis
apparus en cours de combat), PV des monstres (`pvMult`, appliqué monstre par monstre à la
fabrication), renfort **en ligne avant** dans les combats normaux ET durs (`renfortAvant`), soin de
taverne réduit, **mort définitive** (`mortDefinitive` : à partir de Cauchemar, `soignerEquipe` ne
relève plus un héros à 0 PV — ce qui couvre d'un coup la taverne et le soin de fin de zone ; seul
le Kwakwanneau y échappe, en combat), et **tavernes coupées** à l'équipe complète
(`tavernesCoupeesAPlein`, via `sansNoeudsDeZone` — source unique lue par la génération de carte ET
par la roue du Zaap).

Record par tranche dans `Meta.ascension` (`recordAscension`/`enregistrerAscension`, **ne décroît
jamais**) — il sert aussi de **preuve de clear** pour le déverrouillage de la tranche suivante.
Les records de l'ancienne échelle (0-8) sont **remis à zéro** au chargement — tout le monde
refait l'échelle sur la nouvelle grille. La clé de tranche est **conservée à 0, jamais
supprimée** : c'est elle qui prouve le clear et déverrouille la tranche suivante. La migration
est à **passage unique**, gardée par `Meta.version` (`META_VERSION`) — sans ce garde, chaque
chargement effacerait la session précédente. Même logique pour la run en cours, gardée par
`RunSauvee.version` (`RUN_VERSION`) : une run d'avant la refonte reprend en **Normal**, pour ne
pas basculer le joueur en pleine partie sous des règles qu'il n'a pas choisies.

Le **Dofus du Cauchemar** s'obtient en cleanant Cauchemar sur **les cinq tranches déclarées** (pas
seulement les jouables) : il est donc hors de portée tant que T2-T5 ne le sont pas. Son effet force le
camp joueur à ouvrir le combat (voir *Reliques Dofus*) — hors de portée pour l'instant, mais plus
dormant.

### Multi-tranches

Une run = une tranche (`RunState.trancheId`) : cap de niveau, niveau de **départ**, liste de zones et
**toile** en découlent tous de `TRANCHES`/`trancheDe`. La numérotation des toiles est **continue** entre
tranches (`offsetToile` : t2 commence à la toile 13), donc butin, prix, kamas et XP ne se réinitialisent
jamais. `TrancheDef.xpMult` compense le fait qu'une tranche démarrant plus haut progresse mécaniquement
plus lentement (`xpRequis` croît linéairement, le multiplicateur de toile non).

**Héritage** : à la victoire, le recap propose d'archiver l'équipe (`archiverEquipe` — instantané profond,
**équipement PORTÉ uniquement** : ni inventaire ni kamas ne traversent). Au lancement d'une tranche ≠ t1,
trois départs : équipe héritée avec équipement, équipe héritée nue, ou équipe neuve — les trois naissent au
niveau de départ de la tranche via `persoAuNiveau`.

### Nœuds élite, recap, succès, Armurerie

- **Les nœuds élite (`combat_dur`) tirent leur modificateur à la GÉNÉRATION de la carte**
  (`MapNode.eliteModif`), affiché sur le nœud et son infobulle — un modificateur surprise tuait des runs au
  playtest. Récompense = taux de butin du donjon.
- **Recap de fin de run** : dégâts par héros via le hook `onDegats` du moteur, MVP, compteurs (`RunStats`,
  sérialisé avec la sauvegarde de run).
- **Succès** : catalogue `SUCCES` + `verifierSucces`, persistés dans `Meta.succes`, vérifiés en fin de run.
- **Armurerie** (miroir du Bestiaire) : `Meta.collection` associe itemId → meilleure rareté jamais obtenue,
  enregistrée au drop et à l'achat HDV ; paginée par tranche, ses totaux étant calculés **indépendamment
  du rendu** (ils s'accumulaient par effet de bord des zones affichées, ce qui, une fois la page découpée,
  faisait mentir le résumé).

## Conventions d'écran (hors combat)

Les douze écrans hors combat partagent le conteneur `.boutons-ecran`, rendu **collant en bas** — une seule
règle CSS traite les douze, sans une ligne de TypeScript. Le padding de `.ecran` vit dans
`--ecran-pad-x`/`--ecran-pad-y`, dont la barre se sert en marges négatives : **les deux doivent rester
d'accord**. `initEchapRetour` (`ui/dom.ts`) double le bouton Retour par la touche Échap ; elle est
**volontairement aveugle au jeu** (elle clique le `.btn-retour` de la barre, quel qu'il soit) et reste donc
inerte en combat, cet écran n'ayant pas de `.boutons-ecran`.

**Les titres de pages n'ont pas d'émoji** ; seuls les écrans d'**événement** en gardent un (butin, âmes
capturées, fin de run) — ce sont des moments, pas des pages qu'on parcourt.

Sprites et icônes suivent la convention `asset(categorie, id)` → `/assets/<cat>/<id>.png` avec repli
`onerror` : on dépose un fichier, il s'affiche ; absent, il est retiré et rien ne casse (les boutons de sort
retombent sur le NOM du sort via `.sort-nom-fallback`).

## Scope discipline

Chaque tranche est délibérément étroite. **Hors périmètre, différé** : nœud commerce, embranchements
multi-mondes, emplacements familier/anneaux multiples, niveaux requis sur les objets.

Les valeurs de `data.ts`/`progression.ts` sont **faites pour être ajustées** ; les règles du moteur ne le
sont pas. Consulter `GDD-roguelite-dofus.md` pour comprendre *pourquoi* un système existe — jamais pour
élargir le périmètre de la tranche en cours.
