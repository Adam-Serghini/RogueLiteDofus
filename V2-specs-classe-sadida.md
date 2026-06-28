# Specs V2 — Classe Sadida & invocation (+ chargement d'assets)

Ajout d'une 4ᵉ classe (contrôleur / invocateur) et de la **première brique d'invocation**. La majorité tient sur le moteur actuel ; un seul ajout moteur est nécessaire (la poupée + la provocation). On en profite pour poser la structure de chargement d'assets, pour brancher les icônes au fur et à mesure.

> Assets = placeholders pour l'instant. Le but reste le gameplay, pas le visuel.

---

## Périmètre

**Dans cette tranche :**
- **Classe Sadida** : 7 sorts (6 en pur data, 1 invocation).
- **Ajout moteur — invocation minimale** : une entité alliée temporaire (la Poupée de garde) qui a des PV, ne joue pas de tour, encaisse, et **provoque** les ennemis.
- **Chargement d'assets** : structure de dossiers + convention de nommage + fallback placeholder.
- L'équipe peut désormais monter à **4** (Iop, Cra, Eni, Sadida).

**Hors de cette tranche :**
- Invocations qui **jouent leur propre tour** (poupée offensive qui attaque) → plus tard.
- **Équipement** → tranche suivante.

**Rappel de règle :** une classe n'a **pas d'élément prédéfini**. Le Sadida frappe dans son élément le plus fort (déterminé par le stuff, à venir) ; ses assets « marais » sont purement cosmétiques.

---

## La classe Sadida — contrôleur / invocateur

Comble le trou du roster : tu as du burst (Iop), du tir perforant (Cra) et du soin (Eni) ; il manquait un **contrôleur de tempo** qui protège la backline.

*Offensif & contrôle :*
- **Crachat de sève (3 PA)** — dégâts simples sur un ennemi de ligne + poison léger (2t).
- **Déferlante (4 PA)** — touche les 2 premiers ennemis (dégâts faibles) + initiative réduite (1t).
- **Lame liquide (5 PA)** — gros dégâts mono-cible.
- **Étreinte des ronces (5 PA)** — dégâts modérés à tous les ennemis de 1ʳᵉ ligne + initiative réduite (1t).

*Invocation (signature) :*
- **Poupée de garde (4 PA)** — invoque une poupée alliée (PV moyens) qui **provoque** les ennemis (ils la ciblent en priorité tant qu'elle vit). Mur défensif : elle ne joue pas de tour, elle encaisse.

*Soutien :*
- **Rosée régénérante (3 PA)** — HoT sur un allié (5 % de sa vitalité / 3t).
- **Vigueur des bois (2 PA)** — buff : +X % de dégâts au prochain sort offensif du lanceur.

Identité : il ne tue pas vite, il **étouffe** — ralentit l'initiative, empoisonne, et pose un mur qui protège ta Cra / ton Eni. Premier rôle qui fait compter le placement défensif côté joueur.

*Mécaniques réutilisées (déjà au moteur) :* le **poison** (via l'Eni), la **réduction d'initiative** (un effet que ton tri de tours lit déjà), les **HoT** et **buffs** existants. Ces 6 sorts sont du pur data.

---

## Ajout moteur — l'invocation (Poupée de garde)

La seule vraie nouveauté de code. Version **minimale** : un mur, pas une unité qui agit.

### Modèle de données (champs ajoutés à `Combatant`)
```typescript
interface Combatant {
  // ... champs existants ...
  estInvocation?: boolean;   // true pour la poupée
  joueTour?: boolean;        // false pour la poupée (sautée dans l'ordre des tours)
  provoque?: boolean;        // true : les ennemis doivent la cibler en priorité
  dureeRestante?: number;    // optionnel : disparaît après N tours
}
```

### Tri des tours
La poupée occupe une place et peut mourir, mais ne joue pas :
```typescript
// dans tour(), au début de la boucle sur chaque acteur :
if (acteur.estInvocation) continue;   // ne joue pas de tour
```

### Provocation (IA ennemie)
Tant qu'une entité alliée « provoque » est vivante, les ennemis la ciblent avant le reste :
```typescript
function ciblesJoueurValides(combattants: Combatant[]): Combatant[] {
  const vivants = combattants.filter(c => c.camp === "joueur" && c.pvActuels > 0);
  const provoc = vivants.filter(c => c.provoque);
  return provoc.length ? provoc : vivants;
}
```

### Lancer la poupée (une seule active par Sadida)
```typescript
function invoquerPoupee(lanceur: Combatant, combattants: Combatant[]) {
  const refPoupee = "poupee_" + lanceur.ref;
  if (combattants.some(c => c.ref === refPoupee && c.pvActuels > 0)) return; // déjà active
  combattants.push({
    ref: refPoupee, nom: "Poupée",
    pvMax: 40, pvActuels: 40,          // tunable
    stats: { force: 0, intelligence: 0, agilite: 0, vitalite: 40 },
    paMax: 0, paActuels: 0, initiative: 0,
    resistances: {}, sorts: [],
    camp: "joueur", position: 1,
    estInvocation: true, joueTour: false, provoque: true,
    effets: [],
  });
}
```

> Limite assumée : **une poupée à la fois**, et elle **n'attaque pas**. Une poupée offensive (qui joue son tour) sera une évolution, quand tu voudras gérer des invocations actives.

---

## Chargement d'assets (placeholders)

Convention plutôt que configuration : **le nom de fichier = l'id de l'entité**. Tu déposes une icône, elle s'affiche ; absente, le placeholder s'affiche ; aucun changement de code.

### Structure
```
assets/
  classes/    (iop.png, cra.png, eniripsa.png, sadida.png)
  monsters/   (bouftou.png, tofu.png, ...)
  spells/     (crachat_de_seve.png, lame_liquide.png, ...)
  placeholder.png
```

### Loader
```typescript
function asset(categorie: "classes" | "monsters" | "spells", id: string): string {
  return `assets/${categorie}/${id}.png`;
}
// UI : <img src={asset('spells', sort.id)}
//           onerror="this.onerror=null; this.src='assets/placeholder.png'">
```

Rien à câbler à chaque ajout : tu remplis `assets/` au fil de l'eau, le jeu prend les images dès qu'elles sont là.

---

## Critères de validation

- **Sadida jouable**, équipe jusqu'à **4 personnages**.
- **Poupée de garde** : invoquée, occupe une place, **ne joue pas de tour**, encaisse les coups, meurt à 0 PV ; une seule active.
- **Provocation** : tant que la poupée vit, les ennemis la ciblent **avant** les autres persos.
- Le **poison** du Sadida fonctionne (réutilise la mécanique existante) ; la **réduction d'initiative** change bien l'ordre des tours.
- **Assets** : une icône posée dans `assets/` s'affiche ; absente → placeholder, rien ne casse.

---

## Ordre de construction (pour Claude Code)

1. **Sadida en data** — les 6 sorts non-invocation (réutilisent poison / init / HoT / buff existants).
2. **Modèle d'invocation** — champs ajoutés à `Combatant` + skip dans le tri des tours.
3. **Provocation** — `ciblesJoueurValides` dans l'IA ennemie.
4. **Sort Poupée de garde** — `invoquerPoupee` (création + limite à une).
5. **Loader d'assets** — convention de nommage + fallback placeholder + câblage de l'UI (`<img onerror>`).

Ensuite : **équipement & économie** — la grosse brique qui rend les éléments expressifs (ré-orienter un perso via le stuff), débloque le loot, la prospection, et les nœuds Commerce / Forgemagie / Hôtel de vente.
