# Game Design Document — Roguelite Dofus

*Titre provisoire : « Krosmolike »*
**Type :** roguelite tactique au tour par tour · **Plateforme :** navigateur · **Statut :** brouillon pour discussion

---

## 1. Le concept

Un roguelite **tactique** au tour par tour dans l'univers de Dofus. Le joueur compose une équipe de personnages, traverse des mondes en choisissant son chemin sur une carte, enchaîne combats et événements, affronte les boss et progresse de plus en plus loin. À chaque tentative, il rebâtit son équipe et son équipement — mais conserve les **Dofus**, des reliques permanentes qui rendent chaque run suivante un peu plus forte.

L'inspiration de structure vient de *Slay the Spire* et *Hades* (carte de nœuds, run qui se rejoue, méta-progression par reliques). L'inspiration de combat mêle le tour par tour de Dofus (points d'action, sorts à conditions, six éléments) et le placement en ligne de *Darkest Dungeon*. L'univers, le bestiaire et les classes sont ceux de Dofus.

Le jeu assume une certaine richesse de systèmes, mais reste un roguelite : les combats doivent rester **nerveux et courts**, pas des affrontements à rallonge.

## 2. Genre & inspirations

- **Genre :** roguelite tactique, combat tour par tour en équipe.
- **Structure :** *Slay the Spire*, *Hades* — carte de nœuds à embranchements, méta-progression par reliques.
- **Combat :** Dofus (PA, sorts à conditions, éléments) × *Darkest Dungeon* (placement en ligne, portée limitée).
- **Univers :** Dofus (classes, bestiaire, zones, Dofus).

## 3. La boucle de jeu

**Pendant une run :** le joueur traverse un monde via une carte de nœuds (combats, événements, services), en choisissant son chemin. Chaque monde se termine par un **donjon** et son boss. À mesure qu'il avance, il gagne de l'expérience, des kamas et de l'équipement, monte ses personnages en niveau, et s'équipe.

**À la mort :** la run s'arrête et le joueur **perd presque tout** — niveaux, équipement, kamas, objets. Seuls les **Dofus** (les reliques) sont conservés. Il repart du début, mais ses Dofus le rendent plus fort qu'à la tentative précédente.

C'est un roguelite à persistance minimale, façon Slay the Spire : tout ce qu'on construit sert la run en cours ; les Dofus sont la seule chose éternelle. Cette tension — repartir de zéro à chaque mort, mais avancer dans la collection — est le moteur du jeu.

## 4. Le combat

Un combat oppose l'équipe du joueur (jusqu'à 4 personnages) à un groupe d'ennemis **alignés** (1 à 4, en ligne). L'**ordre des tours** est déterminé par l'initiative.

**Points d'action (PA).** Chaque personnage dispose d'un budget de PA par tour, et chaque sort coûte un certain nombre de PA. C'est le cœur tactique : on choisit quoi lancer dans son budget, et certains sorts manipulent les PA de l'adversaire. Le budget reste modeste (de quoi faire une à deux actions qui comptent par tour, pas davantage) pour garder les combats courts.

**Placement en ligne.** À la Darkest Dungeon : on ne peut frapper que les **deux premiers** ennemis de la ligne, sauf sorts spécifiques (flèches qui rebondissent, attaques de zone, sorts qui outrepassent). Cela crée des décisions de ciblage et donne une vraie valeur aux sorts à longue portée ou perforants.

**Familles de sorts.** Offensifs (dégâts, avec souvent un effet additionnel) et défensifs (soin, buff, debuff, postures). Beaucoup de sorts ont des **conditions ou des effets déclenchés** (rebond si la cible meurt, riposte, brûlure, vol de vie, réduction de PA…).

**Hasard maîtrisé.** Les dégâts varient selon un **jet** (fourchette min-max). Une attaque peut être **esquivée** (lié à l'Agilité de la cible) ou faire un **coup critique** (lié à la Force du lanceur).

Les combats doivent rester rapides : peu d'ennemis, des PV bas face aux dégâts (la létalité raccourcit les échanges), un budget de PA contenu.

> *Exemple de kit (provisoire — l'ensemble des sorts sera trié plus tard) :*
> *Iop — Épée hostile (5 PA, rebondit et double les dégâts si la cible meurt), Lame vorace (4 PA, vol de vie), Purgatoire (3 PA, dégâts de zone modérés), Fracas (5 PA, gros dégâts + réduction de PA), Colère (6 PA, gros dégâts mais passe le tour suivant si la cible survit), Duel (4 PA, provoque et passe en posture de contre).*
> *Cra — Flèche corrosive (4 PA, touche 2 cibles + malus de dégâts subis), Flèche perçante (5 PA, rebondit 2 fois), Flèche intrusive (3 PA, ignore effets et résistances), Carquois (2 PA, double l'effet de la prochaine flèche), Œil affûté (maximise le jet des 2 prochains sorts).*

## 5. Les six éléments & leurs caractéristiques

Six éléments, chacun **gouverné par une caractéristique** et doté de **sa propre ligne de résistance**. Les quatre premiers reprennent les caractéristiques classiques de Dofus. Le **Wakfu** et la **Stasis** — les deux énergies cosmiques du lore (vie/création contre destruction/entropie) — deviennent des caractéristiques à part entière, gouvernant deux nouveaux éléments : **Lumière** et **Ténèbre**.

Chaque caractéristique porte **deux effets secondaires**, qui progressent **par point investi** (et non par niveau de personnage) — c'est ce qui fait que les builds récompensent les choix d'allocation.

| Caractéristique | Élément | Effets secondaires (par point) |
|---|---|---|
| **Force** | Terre | +0,5 % critique · *(2ᵉ effet à définir)* |
| **Agilité** | Air | +0,2 % esquive · +0,3 % dégâts critiques |
| **Intelligence** | Feu | +0,5 % puissance offensive · +0,5 % chance de retrait de PA |
| **Chance** | Eau | maximisation des jets · +0,5 % taux de drop |
| **Wakfu** | Lumière | soins & boucliers (appliqués / reçus) · rétention et amplification des buffs |
| **Stasis** | Ténèbre | +0,2 % conversion en dégâts bruts · +0,2 % vol de vie |

Points de design importants :

- **Plafonds obligatoires.** Les stats grimpant haut au fil d'une run, le critique, l'esquive, le retrait de PA et le taux de drop **doivent être plafonnés** (de l'ordre de 50-60 %), sinon ils cassent l'équilibrage.
- **L'Intelligence n'amplifie que l'offensif** (les sorts de dégâts), pas les soins — ceux-ci relèvent désormais du Wakfu.
- **Le vol de vie appartient à la Stasis / Ténèbre** (drainer la vie est cohérent avec les ténèbres) ; le **Wakfu / Lumière** est le pilier de soutien (soins, boucliers, buffs).

Les sorts n'ont **pas d'élément fixe** : un personnage frappe dans son **élément le plus fort**, déterminé par son équipement — n'importe quelle classe peut donc se jouer dans n'importe quel élément. Les ennemis ont chacun une **ligne de résistances** (un pourcentage par élément, comme dans Dofus), que le joueur apprend pour orienter ses builds.

> *Valeurs encore provisoires, à caler à l'équilibrage : la maximisation sur la Chance, le montant des soins/boucliers et la règle exacte de rétention de buff sur le Wakfu, et le second effet de la Force. La Force n'a aujourd'hui qu'un secondaire — Force (taux de crit) + Agilité (dégâts de crit) forment déjà un duo, mais un second effet reste à lui donner pour la symétrie. Note de lore : « Lumière » et « Ténèbre » sont une adaptation — dans Dofus, le Wakfu et la Stasis sont des énergies cosmiques, pas des éléments de combat.*

## 6. Niveaux & caractéristiques

Les personnages gagnent de l'**expérience** sur les nœuds de la carte et montent en **niveau**. Chaque niveau octroie **5 points de caractéristique** à répartir librement dans les stats.

Le coût d'un point dans une même stat augmente avec l'investissement : **1 point pour 1** tant qu'on est sous un certain seuil, puis 2 pour 1, puis 3 pour 1. Cela rend l'hyper-spécialisation possible mais coûteuse, et encourage doucement un peu d'étalement — au service de la flexibilité multi-élément.

**Les niveaux se réinitialisent à la mort** (comme l'équipement). L'XP est donc une ressource *de run* : on repart faible à chaque tentative et on monte en puissance pendant la run. C'est ce qui donne du sens à tous les systèmes liés à l'XP (les gains par nœud, l'Otomai qui permet de restater en cours de route, le Zaap qui multiplie les gains). *(Décision révisable.)*

## 7. Archétypes de build

Parce que chaque caractéristique porte des effets secondaires, les choix d'investissement créent des styles de jeu distincts :

- **Force + Agilité / critique :** taux de critique (Force) et dégâts critiques (Agilité) — le duo du build à gros pics.
- **Agilité / esquive :** éviter les coups (cumulable avec le build critique).
- **Intelligence / offensif & contrôle :** amplifie les dégâts et étouffe l'ennemi en lui retirant ses PA.
- **Chance / régularité & butin :** dégâts fiables, toujours hauts dans la fourchette, et meilleur taux de drop.
- **Wakfu / soutien :** soins, boucliers et buffs durables — le pilier qui maintient l'équipe en vie.
- **Stasis / vampirique :** vol de vie et dégâts bruts qui ignorent les résistances — un bruiser autonome.
- **Multi-élément :** on aligne des spécialistes complémentaires pour exploiter la faiblesse de chaque ennemi.

L'équilibrage veillera à ce qu'aucun archétype ne domine — et il pourra être ajusté sans toucher au fonctionnement du jeu.

## 8. L'équipe & les classes

Le joueur contrôle une **équipe de 4 personnages**, chacun incarnant une classe de Dofus. Une classe n'est **pas verrouillée sur un élément** : son identité tient à son **kit et à son rôle** (mêlée, distance, soutien…), et c'est le joueur qui choisit, via l'équipement, dans quel(s) élément(s) l'investir.

Chaque classe possède **8 sorts** : 4 à 6 offensifs, 2 à 4 défensifs, chacun avec un coût en PA et d'éventuelles conditions de lancement.

Équipe de départ proposée, par rôle :

- **Iop** — bruiser de mêlée, gros dégâts (excelle en critique).
- **Cra** — tireur à distance, frappe à couvert et touche plusieurs cibles.
- **Eniripsa** — soutien et soigneur de l'équipe.
- **Ecaflip** — joueur, mise sur le hasard et la maximisation.

De nouvelles classes pourront être **recrutées** au fil de la progression.

## 9. Équipement, prospection & artisanat

**L'équipement** tombe en combat et porte des caractéristiques aux valeurs **tirées au sort** dans une fourchette (un même objet est plus ou moins bon selon les jets). C'est par le stuff qu'on oriente l'élément et le build de chaque personnage. **Comme tout le reste sauf les Dofus, l'équipement disparaît à la mort** : on reconstruit son set à chaque run.

**La prospection** est une caractéristique d'équipement (comme dans Dofus) : plus on en porte, meilleures sont les chances de drop — mais au prix de stats offensives en moins, donc d'un risque accru de perdre contre les boss. C'est un arbitrage assumé : *cupide et fragile*, ou *puissant et moins chanceux ?* Comme le stuff se fige avant le combat, on ne peut pas tricher en swappant juste pour le coup fatal. Le taux de drop de base sera calibré en supposant qu'une partie des joueurs sacrifie de l'offensif pour de la prospection.

Le taux de drop bénéficie **aussi de la caractéristique Chance**, et les deux sources se cumulent — **mais uniquement sur l'équipement courant.** Les **Dofus ont un taux protégé**, indépendant de ces bonus (voir §10), pour qu'aucun build orienté butin ne les banalise.

**Artisanat & économie de l'objet :**
- **Forgemagie** — sacrifier 2 objets pour booster de 30 % une caractéristique d'un objet désigné.
- **Hôtel de vente** — recycler des objets en kamas.
- **Commerce** — acheter parmi une sélection d'objets contre des kamas.

## 10. Les Dofus (reliques)

Les Dofus sont des **œufs de dragon légendaires** — dans le jeu, des **reliques permanentes** qui s'appliquent à **toute l'équipe** et constituent la **seule progression qui survit à la mort**.

- **Drop ultra-rare** sur des **boss dédiés**, fidèle au lore : le Dofus Turquoise sur le Dragon Cochon, le Pourpre sur le Minotoror, etc. Chaque boss a son Dofus signature.
- **Taux protégé :** le taux de drop des Dofus est **indépendant des bonus de drop** (Chance, prospection). Sinon un build orienté butin rendrait commun ce qui doit rester ultra-rare, et toute la quête perdrait son sens.
- **Empilables :** obtenir plusieurs copies d'un même Dofus le renforce, à **rendements décroissants** (la 1re copie est déjà une vraie récompense, chaque copie suivante apporte un peu moins), ou par **paliers visibles** (ex. 3 copies = niveau max). Cela garde un intérêt à refarmer un boss tout en bornant la puissance. *Un seul frein à la fois : drop rare, mais peu de copies suffisent.*
- **Sets / panoplies :** au-delà des copies, les Dofus s'assemblent en groupes avec des bonus **progressifs** (ex. 2/6, 4/6, 6/6 ; le trio de Pandala…). On joue alors sur deux axes : **en profondeur** (empiler un Dofus) ou **en largeur** (compléter un set). On gardera un nombre réduit de sets nommés et curés plutôt que d'équilibrer chaque combinaison.
- **Quête des six :** les six Dofus primordiaux forment la **colonne vertébrale** du jeu. Les réunir (chacun gardé par un boss) est le méta-objectif principal ; les empiler ensuite au maximum est le contenu de fin de jeu.

## 11. Progression & structure des mondes

Deux couches.

**Macro — l'enchaînement des mondes.** On progresse de monde en monde. Le monde 1 (Incarnam) est imposé ; ensuite, **chaque fin de monde propose un choix entre deux mondes**, chacun avec un **biais de loot** différent. Cela laisse le joueur orienter ses runs selon ses besoins. Les éléments se regroupent en deux familles pour ce biais : **Chance / Agilité / Wakfu** d'un côté, **Intelligence / Force / Stasis** de l'autre.

| Monde | Biais de loot | Donjon final |
|---|---|---|
| **Incarnam** (M1, imposé) | introductif | Donjon d'Incarnam (Milimilou) |
| **Champs d'Astrub** | 65 % Chance/Agi/Wakfu · 35 % Intel/Force/Stasis | Donjon des Champs |
| **Tainela** | 65 % Intel/Force/Stasis · 35 % Chance/Agi/Wakfu | *(à définir)* |

*Le schéma « fourche + biais inversé » se répète à chaque fin de monde. Pour rester gérable, les mondes s'enchaînent par paliers (à chaque étape, deux options) plutôt qu'en arbre exponentiel : le monde non choisi sera vu lors d'une autre run.*

**Carte d'un monde — les nœuds (façon Slay the Spire).** À l'intérieur d'un monde, le joueur choisit son chemin sur une carte de nœuds (≈ 11 cases), **la dernière étant toujours un donjon**. Prendre un service, c'est renoncer au combat voisin : la carte force des arbitrages.

| Nœud | XP | Objets | Kamas | Effet |
|---|---|---|---|---|
| Combat dur | niv.3 | 2 | niv.1 | — |
| Drop | niv.1 | 3 | niv.2 | — |
| Farming | niv.2 | 1 | niv.3 | — |
| Quête | niv.4 | 0 | niv.2 | — |
| Donjon | niv.2 puis **niv.5** | 1 puis 3 | niv.1 puis 3 | combat normal **+ boss** ; clôt le monde |
| Zaap | variable | variable | variable | rencontre aléatoire (drop/farming/combat dur) **+1 multiplicateur** sur l'axe dominant |
| Otomai | — | — | — | restat d'un personnage *(dès le monde 2)* |
| Commerce | — | — | dépense | sélection de 8 objets achetables |
| Taverne | — | — | — | soigne l'équipe |
| Hôtel de vente | — | — | gain | recyclage d'objets en kamas |
| Forgemagie | — | — | — | sacrifie 2 objets → +30 % sur une carac |

**Les trois ressources de run** (réinitialisées à la mort) : l'**XP** (niveaux), les **kamas** (Commerce, via l'Hôtel de vente), les **objets** (équipement, Forgemagie, recyclage). Combat dur / Drop / Farming font tourner les mêmes trois valeurs (chacun fort sur un axe, faible sur les deux autres) : le chemin devient une suite d'arbitrages.

## 12. Ce qui crée la rejouabilité

- **Des builds qui divergent** (critique, régularité, soutien, esquive, vampirique, multi-élément), redéfinis à chaque run par le stuff trouvé.
- **Des chemins et des mondes différents** : la carte et les fourches de mondes varient, le biais de loot oriente la stratégie.
- **La quête des Dofus** : un fil rouge de collection rare qui sous-tend toute la progression et donne un enjeu à chaque boss.
- **La tension du roguelite** : repartir de zéro à chaque mort, mais avancer dans une collection permanente.

## 13. Points ouverts & à surveiller

- **Plafonds des stats secondaires (indispensable) :** critique, esquive, retrait de PA et taux de drop doivent être plafonnés (≈ 50-60 %), sinon les stats hautes en fin de run cassent l'équilibrage.
- **Valeurs secondaires à caler :** maximisation (Chance), montant des soins/boucliers et règle exacte de rétention de buff (Wakfu), et le **second effet de la Force** (qui n'en a qu'un pour l'instant). Le Wakfu est la caractéristique la plus chargée — candidate à un dégraissage.
- **Persistance vs punition (à surveiller) :** avec équipement + niveaux qui reset, **les Dofus sont la seule progression permanente** — et ils sont ultra-rares. Le sentiment de « progresser malgré la mort » repose entièrement sur eux. Leviers à doser : taux de drop de base, scaling de la prospection, protection anti-malchance, garantie de pouvoir router vers n'importe quel boss en quelques runs.
- **Placement côté joueur :** la ligne ennemie est actée ; reste à décider si l'équipe du joueur a aussi des rangs (front/arrière) façon Darkest Dungeon, ou seulement les ennemis.
- **Longueur des combats :** PA + lignes + jusqu'à 4v4 tirent vers le long ; garder peu d'ennemis, des PV bas et un budget de PA contenu pour rester nerveux.
- **Taille de l'équipe :** 4 par défaut, à confirmer au prototype (3 peut suffire).
- **Périmètre du premier prototype :** le doc décrit une vision large ; un premier build devra en tailler une tranche (un combat, 2-3 classes, un monde, une poignée d'éléments) plutôt que tout construire d'un coup.
