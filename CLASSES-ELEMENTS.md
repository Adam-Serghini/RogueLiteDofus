# Classes : éléments & archétype

Source de vérité : `src/content/classes.json` (champs `archetype` et `elements`).
Ce document en est le reflet lisible, et `src/archetypes.test.ts` vérifie qu'ils ne
divergent pas. Pour changer une paire, éditer le JSON **et** ce tableau.

## Les gains par niveau

| Archétype | Par élément | Vitalité |
|---|---|---|
| `melee` | +3 dans **chacun** de ses deux éléments | +2 |
| `distance` | +4 dans **chacun** de ses deux éléments | +1 |

Un seul élément frappe à la fois : le second n'est pas de la puissance en double,
c'est de la souplesse face aux résistances adverses.

## Ce que rapporte chaque élément

| Élément | Caractéristique | Effet secondaire |
|---|---|---|
| terre | force | +1 vitalité par 5 de force |
| feu | intelligence | dégâts finaux (jusqu'à +20 %) |
| air | agilité | taux **et** dégâts de coup critique |
| eau | chance | +1 prospection par 3 de chance |

## La table

| Classe | id | Archétype | Éléments |
|---|---|---|---|
| Iop | `iop` | melee | air + eau |
| Feca | `feca` | melee | terre + eau |
| Forgelance | `forgelance` | melee | terre + feu |
| Ouginak | `ouginak` | melee | terre + air |
| Sram | `sram` | melee | air + feu |
| Ecaflip | `ecaflip` | melee | air + eau |
| Sadida *(désactivée)* | `sadida` | melee | terre + eau |
| Cra | `cra` | distance | feu + air |
| Roublard | `roublard` | distance | feu + eau |
| Eniripsa | `eniripsa` | distance | feu + eau |
| Éliotrope | `eliotrope` | distance | feu + terre |
| Xélor | `xelor` | distance | eau + terre |

Répartition sur les onze jouables : terre 5, feu 6, air 5, eau 6 (rework du Sram,
terre + air → air + feu). **L'air et la terre restent minoritaires**, et c'est ce qui
justifie le plancher de 5 % de coup critique pour tout le monde : sans lui, six classes
sur onze ne critiqueraient jamais.
