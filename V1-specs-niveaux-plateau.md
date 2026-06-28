# Specs V1 — Niveaux & Plateau (tranche 2)

Suite de la V0 (combat validé). Cette tranche ajoute **deux briques, une à la fois** : la **progression intra-run** (niveaux + points de caractéristique) et le **plateau** (carte de nœuds façon Slay the Spire, qui remplace la séquence linéaire).

> Règle directrice inchangée : chaque ajout doit passer le test « est-ce que ça rend le jeu *plus* sympa ? ». Si une brique alourdit sans ajouter, on la coupe.

---

## Périmètre

**Dans cette tranche :**
- **Niveaux & points de caractéristique** : gagner de l'XP en combat, monter de niveau, dépenser 5 points/niveau dans les stats, avec une courbe de coût. Réinitialisé à la mort.
- **Plateau** : une carte de nœuds générée, à embranchements, parcourue en choisissant son chemin, et se terminant par le donjon (boss). Remplace la `SEQUENCE` linéaire de la V0.

**Hors de cette tranche (à venir avec l'économie/équipement) :**
- Nœuds économiques : **Commerce, Forgemagie, Hôtel de vente**.
- Distinction **Drop / Farming** (elles ne diffèrent que sur objets/kamas, pas encore implémentés) → collapsées en « Combat » pour l'instant.
- Récompenses en **objets et kamas** (seule l'**XP** est vivante ici).
- **Multi-monde et fourches** avec biais de loot (n'ont de sens qu'avec l'équipement).

**Note :** le build actuel n'a que **4 stats** (Force, Intelligence, Agilité, Vitalité — 3 éléments + vita). Le système de niveaux est écrit pour elles ; il s'étendra aux 6 quand Chance/Wakfu/Stasis seront ajoutées.

---

## Système 1 — Niveaux & caractéristiques

### Gagner des niveaux
- Les nœuds de **combat** octroient de l'**XP** à la victoire (montant selon le type de nœud).
- À l'XP requise, on monte de niveau et on gagne **5 points de caractéristique**.
- Les **points non dépensés** restent disponibles : on peut les attribuer à tout moment via un panneau (ou à l'écran de level-up).

### Dépenser les points
- Chaque point va dans une stat (Force / Intelligence / Agilité / Vitalité).
- **Coût croissant** dans une même stat : 1 point pour +1 tant qu'on a investi **moins de 200**, puis 2 pour +1, puis 3 pour +1. *(Seuils tunable — à placer là où une run focalisée arrive réellement, ≈ 100-200 selon la longueur des runs.)*

### Effet des stats (lien direct au combat)
Les effets progressent **par point investi**, plafonnés :
- **Force** → dégâts Terre (via scaling) **+ taux de critique** (+0,5 %/pt, cap 50 %).
- **Agilité** → dégâts Air **+ esquive** (+0,2 %/pt, cap 50 %) **+ dégâts critiques** (+0,3 %/pt).
- **Intelligence** → dégâts Feu **+ puissance offensive** (multiplicateur global, +0,5 %/pt, cap +50 %).
- **Vitalité** → **PV max** (+1 PV/pt, tunable).

> *Le critique et l'esquive existaient déjà en V0 ; cette tranche ajoute deux vrais leviers de level-up : les PV (Vitalité) et le multiplicateur offensif (Intelligence). Dépenser un point doit se **sentir** en combat.*

### Restat & reset
- **Otomai (nœud)** : rembourse tous les points investis dans le pool, pour les réattribuer. *(Le gate « à partir du monde 2 » du design complet s'appliquera quand le multi-monde existera ; pour l'instant le nœud est disponible.)*
- **À la mort** : niveau → 1, XP → 0, points → 0, stats → base de classe. **Seuls les Dofus (`Meta`) persistent.**

---

## Système 2 — Le plateau (carte de nœuds)

### Structure
Une **carte = des rangées** d'un départ jusqu'au boss (≈ 7-9 rangées). Chaque rangée a 1-4 nœuds ; chaque nœud est relié à 1-3 nœuds de la rangée suivante. Le joueur choisit un nœud de la 1re rangée, puis **suit une arête** vers la rangée suivante, etc., jusqu'au boss. **Choisir un nœud, c'est renoncer à ses voisins** : c'est tout le sel de la carte.

### Types de nœuds (cette tranche)
- **Combat** — affrontement standard, donne de l'XP.
- **Combat dur (élite)** — plus difficile, plus d'XP.
- **Taverne** — soigne l'équipe (ex. +50 % PV, ou soin complet — tunable).
- **Otomai** — écran de restat.
- **Zaap (mystère)** — se résout en un type aléatoire (combat / combat dur / taverne) à l'entrée.
- **Donjon (boss)** — **toujours le dernier nœud** ; combat de boss ; lâche le **Dofus**.

### Règles de génération
- Rangée 0 : uniquement des **Combats** (départ sûr).
- Dernière rangée : un **unique Donjon**.
- Rangées intermédiaires : majorité de combats, saupoudrées de Taverne / Otomai / Zaap / Combat dur. Garantir qu'**au moins un chemin complet** existe et que chaque nœud a au moins une arête entrante et sortante.
- **PV conservés** d'un nœud à l'autre (comme en V0) : la Taverne est le moyen de récupérer.

### UI (minimale)
Afficher le graphe (nœuds = boutons reliés par des traits, même grossiers), surligner les nœuds **atteignables**, marquer le nœud **courant** et les **visités**. Cliquer un nœud atteignable le résout.

---

## Modèle de données (ajouts)

```typescript
// --- Progression (par personnage) ---
interface Progression {
  niveau: number;
  xp: number;             // xp vers le niveau suivant
  pointsDispo: number;    // points non dépensés
  pointsInvestis: Stats;  // points dépensés par stat, au-dessus de la base de classe
}

function xpRequis(niveau: number): number {
  return 50 + (niveau - 1) * 25;     // valeurs de départ, tunable
}

function coutPoint(dejaInvesti: number): number {
  if (dejaInvesti < 200) return 1;   // seuils tunable
  if (dejaInvesti < 300) return 2;
  return 3;
}

// stat finale = base de classe + points investis
// PV max  = pvBase + vitaliteFinale * PV_PAR_VITA
const PV_PAR_VITA = 1;               // tunable

function multOffensif(stats: Stats): number {
  return 1 + Math.min(0.5, stats.intelligence * 0.005); // à appliquer dans degatsCible
}

// --- Plateau ---
type NodeType = "combat" | "combat_dur" | "taverne" | "otomai" | "zaap" | "donjon";

interface MapNode {
  id: string;
  type: NodeType;
  ligne: number;          // 0 = départ ... N = boss
  colonne: number;
  suivants: string[];     // ids atteignables à la rangée suivante
  visite?: boolean;
  combatId?: string;      // pour les nœuds de combat : quel encounter
  xp?: number;            // récompense XP (combats)
}

interface GameMap {
  noeuds: MapNode[];
  courant: string | null; // null avant le 1er choix
  depart: string[];       // ids de la 1re rangée
}
```

---

## Intégration avec l'existant

### Le multiplicateur offensif dans le combat
Dans `degatsCible` (V0), après le bonus Dofus, ajouter le multiplicateur d'Intelligence :
```typescript
dmg *= multOffensif(lanceur.stats);
```

### Level-up après un combat
```typescript
function gagnerXP(p: Progression, gain: number) {
  p.xp += gain;
  while (p.xp >= xpRequis(p.niveau)) {
    p.xp -= xpRequis(p.niveau);
    p.niveau += 1;
    p.pointsDispo += 5;
  }
}
```

### Nouvelle boucle de run (remplace la `SEQUENCE` linéaire)
```typescript
// 1. composer l'équipe (Iop + Cra), appliquer les Dofus ; Progression = niveau 1
// 2. générer une GameMap
// 3. tant que le boss n'est pas vaincu :
//      - le joueur choisit un nœud atteignable (depart, puis suivants du nœud courant)
//      - résoudre selon le type :
//          combat / combat_dur -> combat ; victoire = gagnerXP(...) ; wipe = fin de run
//          taverne             -> soigne l'équipe
//          otomai              -> écran de restat
//          zaap                -> tirer un type au hasard puis résoudre
//          donjon              -> combat de boss ; victoire = Dofus + run gagnée
//      - marquer le nœud visité, avancer `courant`
// 4. wipe ou victoire boss -> Meta conservé, Progression remise à zéro, retour au départ
```

---

## Critères de validation (tranche « terminée »)

- Une run se parcourt désormais via une **carte de nœuds à embranchements**, et le chemin **varie** d'une run à l'autre.
- Gagner un combat octroie de l'**XP** ; atteindre les seuils fait **monter de niveau** et donne **5 points**.
- On peut **dépenser les points** dans les stats ; le **coût augmente** au-delà des seuils ; la dépense **change visiblement le combat** (plus de PV, plus de crit/esquive, plus de dégâts).
- **Taverne** soigne, **Otomai** restate, **Zaap** se résout en un nœud aléatoire.
- Le **dernier nœud est toujours le boss** ; le battre octroie le **Dofus**.
- À la mort : niveau / points / stats **remis à la base**, **Dofus conservés**.

---

## Ordre de construction suggéré (pour Claude Code)

1. **Progression + XP** — modèle `Progression`, `gagnerXP`, level-up. Tester en console (simuler des gains d'XP → niveaux → points).
2. **Dépense des points** — courbe de coût, application aux stats finales, et brancher `multOffensif` + PV via Vitalité dans le combat. Vérifier que dépenser un point modifie bien les dégâts / PV / taux.
3. **Carte — données & génération** — `GameMap`, génération par rangées (règles ci-dessus). Rendu grossier (boutons + traits).
4. **Navigation** — choisir un nœud atteignable, résoudre par type, avancer ; brancher les nœuds de combat sur le moteur existant.
5. **Nœuds de service** — Taverne (soin), Otomai (restat), Zaap (aléatoire).
6. **Intégration** — remplacer la `SEQUENCE` par la carte ; écran/panneau de level-up ; s'assurer que le reset à la mort vide `Progression` mais garde `Meta.dofus`.

À ce stade : une run avec **progression et choix de chemin**, toujours nerveuse. Prochaine brique naturelle ensuite : **classes & sorts supplémentaires** (équipe de 3-4, synergies), puis l'**équipement & l'économie** (qui débloquera les nœuds Commerce/Forgemagie/HDV et les fourches de mondes).
