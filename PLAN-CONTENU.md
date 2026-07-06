# Plan de contenu — structure en tranches, rareté, boss

> Document de travail (juillet 2026). Fixe la **cible long terme** pour ne pas coder les
> systèmes dans le vide. Les tableaux de zones sont des **brouillons à valider** — la
> structure (tranches, rareté, signatures de boss) est la partie engageante.
> Le GDD reste la vision d'ensemble ; ce plan est la feuille de route de contenu.

## 1. Structure du jeu : 5 tranches de niveau

| Tranche | Niveaux | Zones (cible) | Statut |
|---|---|---|---|
| T1 | 1–50 | 10–12 | 6 zones existantes + à compléter |
| T2 | 51–100 | 10–12 | à concevoir |
| T3 | 101–150 | 10–12 | à concevoir |
| T4 | 151–199 | 10–12 | à concevoir |
| T5 | 200 | quelques donjons « end game » | à concevoir |

**Une run = une tranche.** On débloque la tranche suivante en méta-progression
(finir la tranche N ouvre la tranche N+1, de façon permanente — stocké dans `Meta`).

### Héritage entre tranches (question ouverte)

Idée envisagée : enregistrer l'état de fin de run (persos + stuff) comme départ de la
tranche suivante → farmer la T1 pour optimiser son départ en T2.

Options sur la table :

- **(a) Kit de départ standard** : commencer la T2 au niveau 51 avec un set commun de
  fin de T1. Simple, runs auto-contenues, pas de farm obligatoire.
- **(b) Héritage limité** : on emporte 1 objet par perso (« relique de famille »).
  Récompense le farm sans le rendre obligatoire ; le choix de l'objet est une décision.
- **(c) Snapshot complet** : l'état de fin de T1 devient le départ de T2.
  Risques : le re-farm de T1 devient la stratégie dominante (corvée), et l'équilibrage
  de T2 doit viser un départ inconnu (entre « premier clear laborieux » et « full rare »).

**Reco actuelle : (a) + (b).** Décision non urgente : `PersoState` est déjà du JSON
sérialisable, l'option (c) reste techniquement ouverte quoi qu'on choisisse.

### Conséquence technique : sauvegarde de run

Une run de 10–12 zones est ~2× plus longue qu'aujourd'hui → il faudra **persister la
`RunState` en cours** (localStorage, comme `Meta`) pour reprendre une run interrompue.
À faire avant d'allonger les runs.

## 2. Rareté d'équipement

Extension naturelle du roll-au-drop existant (`Item.rolls` → `rollItem`).

| Rareté | Mécanique | Source |
|---|---|---|
| **Commun** | fourchettes actuelles | drop normal de zone |
| **Rare** | fourchette décalée vers le haut (~+25–40 % de budget de stats), possiblement une stat bonus | drop normal (faible proba, boostée par Prospection) |
| **Rare nommé** | variante d'une pièce existante, liée à un boss (ex. **Coiffe du Bouftou Royal**) | boss uniquement |
| **Légendaire** | objet unique avec **effet spécial** hors budget de stats | boss/archi, très rare |

Premier légendaire : **le Gelano (+1 PA)** — le moteur gère déjà les bonus de PA
(paliers Ocre, `paGain`), l'effet est quasi gratuit à implémenter.

- `ItemInstance` gagne un champ `rarete`, tiré au drop.
- UI : couleur de bordure/nom (blanc / bleu / orange, à ajuster).
- **Sert aussi l'équilibrage** : la courbe de puissance devient continue
  (2 pièces communes < 2 rares < 4 communes < 4 rares…) au lieu du check binaire
  NU→SET mesuré par la sim (`falaise 2→4p`).

## 3. Boss : des signatures, pas un pattern partagé

État actuel : 5 boss sur 6 ont exactement le kit `ecrasement / charge / morsure`.
Cible : chaque boss garde `ecrasement` (l'AoE de ligne comme menace commune) **+ 1
mécanique signature**, en réutilisant d'abord ce que le moteur sait déjà faire
(poison, bouclier, HoT, vol de vie `soinEquipeRatio`, debuff d'initiative, `provoque`,
cooldowns, `maxRoll`, `degatsInfliges`, `bonusOffensifProchain`).

État : **12/12 faits** (✅) — sorts signatures en tête de kit, cadencés par cooldown ;
invocations/résurrection côté monstres et passif de ligne ajoutés au moteur.

| Boss | Signature | Statut |
|---|---|---|
| Kardorim | « Étreinte glaciale » — dégâts de ligne + −initiative (2t) | ✅ |
| Tournesol Affamé | « Racines voraces » — drain rendu en PV à son camp | ✅ |
| Bouftou Royal | « Colère royale » — +25 Force cumulable (fin du stalemate) | ✅ |
| Batofu | « Piqué fulgurant » — gros coup + 25 % d'esquive (2t) | ✅ |
| Scarabosse Doré | « Carapace dorée » — bouclier = 100 % des dégâts | ✅ |
| Coffre des Forgerons | « Mâchoire du coffre » — gros coup puis +30 % résists (1t) | ✅ |
| Corailleur Magistral | « Rostre broyeur » — la cible inflige −25 % (1t) | ✅ |
| **Kwakwa** | **Mue élémentaire** (moteur) — 65 % de résist partout sauf 1 élément aléatoire par tour | ✅ |
| Directeur Grunob | « Travail d'équipe » — +15 % de dégâts par allié vivant dans sa rangée | ✅ |
| Kankreblath | « Sfvc%$*R ?! » — invoque un monstre aléatoire de la zone (2 max) | ✅ |
| Boostache | « L'Enfer des Zombies » — réinvoque un vaincu à 50 % PV | ✅ |
| Shin Larve | « Ponte larvaire » — pond une larve (2 PA : frappe le même tour) | ✅ |

Moteur ajouté : invocations génériques côté monstre (`invoqueMonstre`, elles JOUENT
leurs tours contrairement à la Poupée), résurrection (`ressuscite`), passif
`bonusParAllieLigne`, mue élémentaire. Multi-phases (< 50 % PV) : plus tard.

## 4. Brouillon des tranches (zones à valider)

Chaque zone = 1 panoplie liée (+ éventuels rares nommés du boss). Ordre inspiré des
zones/donjons emblématiques de Dofus ; **niveaux et choix à arbitrer ensemble**.

### T1 · 1–50 (liste validée ensemble, ordre par niveau officiel de donjon)

14 zones (6 existantes + 8 nouvelles). Niveaux officiels d'après
[dofuspourlesnoobs.com/donjons](https://www.dofuspourlesnoobs.com/donjons.html)
(référence pour tous les donjons, triables par niveau — à réutiliser pour les T2+).
Colonne « Mécanique boss (jeu réel) » = la mécanique officielle du donjon, à adapter
comme signature (souvent mieux que d'en inventer une).

| # | Zone (niv officiel) | Statut | Boss | Mécanique boss (jeu réel) → adaptation |
|---|---|---|---|---|
| 1 | Incarnam (10) | ✅ | Kardorim | (notre invention : debuff d'initiative) · Dofawa |
| 2 | Champs d'Astrub (20) | ✅ | Tournesol Affamé | vol de vie / racines |
| 3 | Château Ensablé (20) | ➕ | Mob l'Éponge | à creuser (absorption ?) |
| 4 | Tainéla (30) | ✅ | Bouftou Royal | montée en rage · Dofus Argenté · rare nommé : Coiffe du Bouftou Royal |
| 5 | Donjon des Tofus (40) | ✅ | Batofu | esquive + frappe garantie |
| 6 | Akadémie des Gobs (40) | ➕ | Directeur Grunob | « Travail d'équipe » : +dégâts par gob adjacent → +X % par allié vivant dans sa ligne |
| 7 | Cache de Kankreblath (40) | ➕ | Kankreblath | à creuser |
| 8 | Maison Fantôme (40) | ➕ | Boostache | à creuser (fantômes ?) |
| 9 | Donjon des Scarafeuilles (40) | ✅ | Scarabosse Doré | carapace/bouclier cyclique |
| 10 | Donjon des Forgerons (50) | ✅ | Coffre des Forgerons | alternance ouvert/fermé |
| 11 | Donjon des Larves (50) | ➕ | Shin Larve | larves multicolores → puzzle élémentaire |
| 12 | Refuge Sylvestre (50) | ➕ | Rakoopeur | boss soutien : bouclier 100 sur un allié (existe : `bouclier`) → tuer les adds d'abord |
| 13 | Grotte Hesque (50) | ➕ | Corailleur Magistral | ne frappe qu'au corps à corps → menace uniquement la ligne avant (règle de ligne !) |
| 14 | Nid du Kwakwa (50) | ➕ | **Kwakwa** | **75 % de résistance partout sauf 1 élément aléatoire** → force le changement d'élément de frappe. **Boss final idéal de la T1.** |

Si on veut redescendre à 12 : couper/déplacer 2 parmi les niveaux 50
(candidats : Grotte Hesque, Refuge Sylvestre — géographiquement Otomaï/Valonia).
Réserve du même palier si on veut remplacer : Squelettes (Chafer Rönin, 40),
Caverne des Bulbes (Bulbig Brozeur, 40), Bworks (Bworkette, 50),
Clos des Blops (Blop Royal, 50), Nowel (Sapik, 50).

### T2 · 51–100 (esquisse)

Cania, Sidimote, Donjon des Blops, **Donjon des Gelées** (→ légendaire **Gelano**),
Île de Moon, Forêt Maléfique (Chêne Mou), Donjon du Dragon Cochon, Wa Wabbit…

### T3 · 101–150 (esquisse)

Pandala, Île d'Otomaï, Kimbo, Bworker, Skeunk, Sphincter Cell…

### T4 · 151–199 (esquisse)

Frigost I–II : Korriandre, Kolosso, Tengu Givrefoux, Obsidiantre, Glourséleste…

### T5 · 200 (esquisse)

Frigost III (Sylargh, Klime, Nileza, Missiz Frizz, Comte Harebourg), l'Ombre,
dimensions divines…

## 5. Ordre d'implémentation proposé

1. **Rareté** (types + `rollItem` + tables de drop + UI) — sert contenu **et** équilibrage.
2. **Signatures de boss** des 6 boss existants (data + petits flags moteur).
3. **Rééquilibrage** avec la sim (cibles : boss précoces jouables en mi-set,
   boss tardifs mordants en full set — cf. colonne MI de `npm run sim`).
4. **Refonte des formules pour tenir 1→200** (`xpRequis`, coût des points, caps,
   scaling des monstres) — une fois, avant d'ajouter des tranches.
5. **Compléter la T1 à 10–12 zones**, puis structure `Tranche` dans `data.ts`
   (méta-déblocage, sauvegarde de run).
6. T2+ = saisie de contenu dans `data.ts` (le but de tout ce qui précède).
