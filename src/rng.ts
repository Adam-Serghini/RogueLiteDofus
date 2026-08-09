// =============================================================================
//  rng.ts — générateur pseudo-aléatoire reproductible, PUR et sans dépendance.
//
//  Source UNIQUE des deux outils de mesure du projet (`npm run sim` et le banc
//  d'essai de l'éditeur) : deux générateurs différents, c'est deux qualités de
//  tirage différentes pour deux chiffres censés se comparer. Le banc portait
//  auparavant un LCG recopié dont la multiplication (`g * 1103515245`) dépassait
//  2^53 et perdait donc des bits de poids faible en flottant : cycle mesuré à
//  10466 tirages seulement, si bien qu'une mesure à 500 répétitions rejouait les
//  mêmes tirages passé la ~300ᵉ, avec un biais mesuré d'environ 0,5 %.
// =============================================================================

/** mulberry32 : période 2^32, aucune perte de bits (tout passe par `Math.imul`
 *  et des opérations 32 bits), qualité de distribution suffisante pour une
 *  moyenne sur quelques centaines de tirages. */
export function mulberry32(graine: number): () => number {
  let a = graine | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
