// =============================================================================
//  node-fs.d.ts — Déclaration ambiante minimale pour `node:fs`, réservée aux
//  tests qui doivent lire le système de fichiers (ex. la correspondance des
//  identifiants de sort avec les fichiers d'icônes, iop.test.ts). Le projet n'a
//  volontairement pas @types/node (aucun code de src/ hors tests n'en a besoin) :
//  ce fichier n'est PAS un module (aucun import/export propre), ce qui permet à
//  `declare module` d'introduire une déclaration ambiante neuve plutôt qu'une
//  augmentation d'un module existant (la même déclaration, écrite à l'intérieur
//  d'un fichier de test qui EST un module, échoue avec « Invalid module name in
//  augmentation »).
// =============================================================================
declare module "node:fs" {
  export function readdirSync(path: string): string[];
}
