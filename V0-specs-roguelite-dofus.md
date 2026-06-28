# Specs V0 — Roguelite Dofus (tranche verticale)

Brief d'implémentation pour une **première version jouable**. Objectif unique : répondre à **« est-ce que le combat est fun ? »**. Tout ce qui ne sert pas cette question est hors scope.

> Ce document est conçu pour être passé à Claude Code comme base de départ.

---

## Objectif de la V0

Une run = une **suite linéaire de 3-4 combats + un boss**. Battre le boss donne un **Dofus** (relique permanente) ; à la run suivante, le Dofus est actif et la run est plus facile. C'est la seule boucle à valider : **combat tactique + relique qui persiste**.

## Pile technique (légère)

- Navigateur, **TypeScript**.
- **Vanilla TS + Vite**, UI en **DOM simple** — pas de React, pas de Canvas. Le combat est au tour par tour, le rendu peut être minimal. On teste le *feel*, pas le visuel.
- Logique **data-driven** : classes, sorts, monstres dans des fichiers de données.
- Persistance : un seul élément à conserver (les Dofus). **En mémoire pour la session suffit** ; `localStorage` en option pour survivre à un refresh.

## Périmètre

**Dans la V0 :**
- Moteur de combat : initiative, budget de PA, coût des sorts en PA, ligne ennemie (1-4) avec la règle « on ne tape que les 2 premiers » + sorts qui l'outrepassent, jet de dégâts (min-max), critique (Force), esquive (Agilité), soin, 1-2 buff/debuff, PV, mort.
- **2 classes jouables :** Iop et Cra. Équipe de **2 personnages** (un de chaque).
- **3 éléments :** Terre, Feu, Air. Chaque perso a des stats élémentaires fixes ; **sa plus haute définit son élément de frappe**. Les monstres ont une ligne de résistances.
- **3-4 combats + 1 boss**, en séquence linéaire. Les **PV se conservent** entre les combats.
- **1 Dofus** lâché par le boss : bonus passif permanent pour l'équipe, qui persiste d'une run à l'autre.

**Hors V0 (explicitement) :** plateau StS, carte de nœuds, 6 éléments (3 seulement), Chance / Wakfu / Stasis, niveaux & points de caractéristique, kamas & économie, boutique, Forgemagie, prospection, équipement / loot, sets de Dofus, multi-monde et fourches. **Stats des persos fixes** (pas de level-up, pas de stuff) — la seule progression est le Dofus.

---

## Modèle de données

(TypeScript, simplifié pour la V0)

```typescript
type Element = "terre" | "feu" | "air";

interface Stats {
  force: number;        // dégâts Terre + taux de crit
  intelligence: number; // dégâts Feu + puissance offensive
  agilite: number;      // dégâts Air + esquive + dégâts de crit
  vitalite: number;     // PV
}

type SpellTarget =
  | "ennemi_ligne"   // un ennemi en position 1 ou 2 uniquement
  | "ennemi_tous"    // n'importe quel ennemi (outrepasse la ligne)
  | "soi"
  | "allie";

interface Spell {
  id: string;
  nom: string;
  type: "degats" | "soin" | "buff" | "debuff";
  coutPA: number;
  cible: SpellTarget;
  baseMin: number;
  baseMax: number;
  scaling: number;          // multiplie la stat de l'élément de frappe
  // effets spéciaux (optionnels, un sort peut en cumuler) :
  rebond?: { sauts: number; bonusParSaut: number };   // touche des ennemis suivants
  siCibleMeurt?: { rebondDegatsX: number };           // Épée hostile : x2 sur un autre ennemi
  ignoreResistances?: boolean;                        // Flèche intrusive
  retraitPA?: number;                                 // Fracas : -PA à la cible au prochain tour
  passeTourSiSurvie?: boolean;                        // Colère
  effet?: { stat: keyof Stats | "degatsSubis" | "maxRoll"; valeur: number; duree: number };
}

interface Classe {
  id: string;
  nom: string;
  pvBase: number;
  stats: Stats;
  pa: number;          // budget de PA par tour
  initiative: number;
  sorts: string[];     // ids de sorts
}

interface Monstre {
  id: string;
  nom: string;
  pv: number;
  stats: Stats;
  pa: number;
  initiative: number;
  resistances: Partial<Record<Element, number>>; // fraction : 0.25 = -25% subis
  sorts: string[];
  ia: "agressif" | "soutien";
  boss?: boolean;
  dofus?: string;      // id du Dofus lâché (boss uniquement)
}

interface Combatant {
  ref: string;
  nom: string;
  pvMax: number;
  pvActuels: number;
  stats: Stats;
  paMax: number;
  paActuels: number;
  initiative: number;
  resistances: Partial<Record<Element, number>>;
  sorts: string[];
  camp: "joueur" | "ennemi";
  position: number;    // 1..4, sert surtout aux ennemis (règle de ligne)
  ia?: "agressif" | "soutien";
  effets: { stat: string; valeur: number; toursRestants: number }[];
}

// État persistant (la seule chose qui survit à la mort)
interface Meta {
  dofus: string[];     // ids des Dofus possédés (peut contenir des doublons)
}
```

### Instances de départ (exemple)

Stats calibrées pour que crit / esquive / élément de frappe soient sensibles dès la V0.

```typescript
const iop: Classe = {
  id: "iop", nom: "Iop",
  pvBase: 60,
  stats: { force: 60, intelligence: 10, agilite: 20, vitalite: 50 },
  pa: 6, initiative: 8,
  sorts: ["pression", "epee_hostile", "fracas", "colere", "vitalite"],
}; // élément de frappe = Terre (Force la plus haute) ; crit ≈ 30%

const cra: Classe = {
  id: "cra", nom: "Cra",
  pvBase: 45,
  stats: { force: 15, intelligence: 20, agilite: 55, vitalite: 40 },
  pa: 6, initiative: 12,
  sorts: ["fleche_magique", "fleche_corrosive", "fleche_percante", "fleche_intrusive", "oeil_affute"],
}; // élément de frappe = Air ; esquive ≈ 11%
```

---

## Les sorts de la V0

Kit réduit, choisi pour tester des **mécaniques différentes**. L'élément des dégâts = l'élément de frappe du lanceur (sa plus haute stat élémentaire).

**Iop — bruiser de mêlée**
- *Pression* — 3 PA, dégâts simples sur un ennemi de ligne (8-12).
- *Épée hostile* — 5 PA, dégâts (10-14) ; si la cible meurt, **rebondit sur un autre ennemi en infligeant le double**. (`siCibleMeurt`)
- *Fracas* — 5 PA, gros dégâts (14-18) **+ retire 3 PA** à la cible au prochain tour. (`retraitPA`)
- *Colère* — 6 PA, très gros dégâts (18-24) ; le Iop **passe son prochain tour si la cible survit**. (`passeTourSiSurvie`)
- *Vitalité* — 2 PA, buff : **+20 % PV max** au lanceur pendant 3 tours. (`effet`)

**Cra — tireuse à distance (atteint la ligne arrière)**
- *Flèche magique* — 3 PA, dégâts simples sur un ennemi de ligne (8-12).
- *Flèche corrosive* — 4 PA, **touche 2 ennemis** (6-9 chacun) + malus **−10 % de dégâts infligés** pour 2 tours. (`rebond` léger + `debuff`)
- *Flèche perçante* — 5 PA, touche le 1er ennemi puis **rebondit jusqu'à 2 fois**, chaque saut **+20 %** de dégâts. (`rebond`)
- *Flèche intrusive* — 3 PA, **frappe n'importe quel ennemi** (même ligne arrière), **ignore les résistances**, dégâts faibles (5-7). (`cible: ennemi_tous`, `ignoreResistances`)
- *Œil affûté* — 2 PA, buff : les **2 prochains sorts offensifs tapent au max** de leur fourchette. (`effet: maxRoll`)

> *Flèche perçante et Flèche intrusive existent spécifiquement pour tester la règle de ligne : sans elles, la ligne arrière ennemie est intouchable. C'est le cœur de la question « le placement façon Darkest Dungeon est-il intéressant ? ».*

---

## Les ennemis de la V0

- **Bouftou** — mêlée agressive, PV moyens, **faible à l'Air**. IA agressive.
- **Tofu** — rapide (haute initiative), PV bas, **faible à la Terre**. IA agressive.
- **Tofu Maléfique** — se place en **ligne arrière** (position 3-4), **soigne / buffe** ses alliés. IA soutien. *Sa raison d'être : forcer le joueur à atteindre l'arrière.*
- **Chef de Guerre Bouftou** *(boss)* — PV élevés, gros dégâts, **faible à l'Air**. **Lâche le Dofus.**

Compositions suggérées : combats 1-3 = mélanges de Bouftous / Tofus, dont **au moins un avec un Tofu Maléfique en arrière** ; combat 4 = boss (+ 1-2 sbires).

---

## Résolution du combat

> Coefficients ci-dessous = **valeurs de départ**, à ajuster au feel.

```typescript
function tour(combattants: Combatant[]) {
  const ordre = combattants
    .filter(c => c.pvActuels > 0)
    .sort((a, b) => b.initiative - a.initiative);

  for (const acteur of ordre) {
    if (acteur.pvActuels <= 0) continue;
    acteur.paActuels = acteur.paMax;            // recharge des PA
    if (appliquerEffetsDebutTour(acteur)) continue; // ex. "passe le tour"

    const { sort, cible } = acteur.camp === "joueur"
      ? actionJoueur(acteur, combattants)       // UI
      : actionIA(acteur, combattants);          // IA simple

    if (sort && acteur.paActuels >= sort.coutPA) {
      acteur.paActuels -= sort.coutPA;
      lancerSort(acteur, sort, cible, combattants);
    }
    decrementerEffets(acteur);
  }
}

// Dégâts sur une cible (le rebond rappelle ce calcul par cible touchée)
function degatsCible(lanceur: Combatant, sort: Spell, cible: Combatant): number {
  // esquive (Agilité de la cible, plafonnée)
  if (Math.random() < Math.min(0.5, cible.stats.agilite * 0.002)) return 0;

  // jet (max si buff "maxRoll" actif)
  let dmg = aMaxRoll(lanceur) ? sort.baseMax : jet(sort.baseMin, sort.baseMax);

  // stat de l'élément de frappe
  const el = elementDeFrappe(lanceur);
  dmg += statElement(lanceur.stats, el) * sort.scaling;

  // critique (Force, plafonné) → ajoute des dégâts (ne double pas)
  if (Math.random() < Math.min(0.5, lanceur.stats.force * 0.005)) {
    dmg += 5 + lanceur.stats.agilite * 0.3;     // dégâts de crit via Agilité
  }

  // résistance (sauf ignoreResistances)
  if (!sort.ignoreResistances) {
    dmg *= 1 - (cible.resistances[el] ?? 0);
  }

  dmg *= bonusDofus();                           // bonus permanent d'équipe
  return Math.max(0, Math.round(dmg));
}

// élément de frappe = la plus haute stat élémentaire du lanceur
function elementDeFrappe(c: Combatant): Element {
  const m: [Element, number][] = [
    ["terre", c.stats.force],
    ["feu", c.stats.intelligence],
    ["air", c.stats.agilite],
  ];
  return m.sort((a, b) => b[1] - a[1])[0][0];
}
```

**Règle de ligne (ciblage).** Un sort `ennemi_ligne` ne peut viser qu'un ennemi en **position 1 ou 2**. Les positions **se recalculent quand un ennemi meurt** (les survivants avancent). Un sort `ennemi_tous` ignore la contrainte. Le rebond (*Flèche perçante*) saute vers les ennemis suivants dans l'ordre des positions.

**IA.**
- *agressif* : cible le perso joueur vivant aux **PV les plus bas**, avec le sort de dégâts le plus cher qu'il peut payer.
- *soutien* : si un allié est blessé, le **soigne / buffe** ; sinon attaque.

---

## La run

```typescript
const SEQUENCE = ["combat_1", "combat_2", "combat_3", "boss"]; // données

// Boucle d'une run :
// 1. composer l'équipe (Iop + Cra), appliquer les bonus Dofus depuis Meta
// 2. pour chaque combat de SEQUENCE :
//      - instancier les ennemis
//      - jouer les tours jusqu'à victoire ou wipe
//      - wipe    -> fin de run (Meta conservé), retour à l'écran de départ
//      - victoire-> PV conservés, combat suivant
// 3. victoire sur le boss : pousser boss.dofus dans Meta.dofus
//      -> écran "Dofus obtenu", puis on peut relancer une run
```

Les **PV se conservent** entre les combats (pas de soin gratuit) : c'est ce qui crée la tension. Pas de nœud, pas de boutique — juste la séquence.

---

## Le Dofus (V0)

Un seul Dofus, le **Dofus Pourpre** (offensif), lâché par le boss.
**Effet : +15 % de dégâts pour toute l'équipe**, permanent, appliqué dès la run suivante (via `bonusDofus()`).

- Persiste dans `Meta.dofus` (mémoire de session ; `localStorage` en option).
- **Empilable (optionnel) :** chaque victoire sur le boss ajoute une copie → +15 % cumulés. Suffisant pour *sentir* la boucle « je suis plus fort qu'avant ».

C'est le seul fil qui traverse la mort. **Test clé :** après 1-2 Dofus, la run de début doit être nettement plus facile — si on ressent cette montée, la boucle méta fonctionne.

---

## Critères de validation (V0 « terminée »)

- Une run s'enchaîne du combat 1 au boss, **PV conservés** entre les combats.
- L'**ordre des tours** suit l'initiative ; les **PA** sont décomptés et limitent les actions.
- La **règle de ligne** fonctionne : impossible de toucher la ligne arrière sauf avec *Flèche intrusive* (et le rebond de *Flèche perçante* atteint plus loin).
- Dégâts, **critique**, **esquive**, **soin**, **buff** (`maxRoll`, +PV) et **debuff** (−dégâts, retrait de PA) se résolvent correctement.
- Battre le boss ajoute le **Dofus** ; à la run suivante, le bonus est actif et la run est **sensiblement plus facile**.
- Un **wipe** termine la run **sans effacer les Dofus**.

---

## Ordre de construction suggéré (pour Claude Code)

1. **Modèles + données** — les interfaces ci-dessus, plus les 2 classes, ~4 monstres, et tous les sorts en fichiers de données.
2. **Combat sans UI** — la boucle de tour + `degatsCible`, testable en console (deux équipes fixes qui se tapent dessus jusqu'à la fin). C'est le cœur : **le valider seul avant toute UI**.
3. **Règle de ligne + IA** — positions, ciblage restreint, sorts qui outrepassent, les 2 comportements d'IA.
4. **UI minimale (DOM)** — boutons « choisir un sort / une cible », affichage PV/PA de chaque combattant, journal de combat.
5. **Boucle de run** — la séquence de combats, conservation des PV, écrans de wipe / victoire.
6. **Dofus** — drop par le boss, persistance dans `Meta`, application du bonus en début de run.

À ce stade, on a une **tranche jouable de bout en bout** — de quoi répondre à la seule question qui compte : **est-ce que c'est fun ?**
