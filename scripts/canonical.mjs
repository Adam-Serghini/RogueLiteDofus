// =============================================================================
//  canonical.mjs — Sérialisation JSON canonique (clés triées, indent 2) + hash.
//  Utilisée par l'extraction, l'import et le build de l'éditeur : c'est elle
//  qui rend les git diff lisibles et le hash de fraîcheur stable.
// =============================================================================
import { createHash } from "node:crypto";

function trier(v) {
  if (Array.isArray(v)) return v.map(trier);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, trier(v[k])]));
  return v;
}

export function stringifyCanonique(obj) {
  return JSON.stringify(trier(obj), null, 2) + "\n";
}

/** Hash de l'ensemble du contenu : Record<nomFichier, objet>. */
export function hashContenu(fichiers) {
  const h = createHash("sha256");
  for (const nom of Object.keys(fichiers).sort())
    h.update(nom + "\n" + stringifyCanonique(fichiers[nom]));
  return h.digest("hex");
}
