import { defineConfig, configDefaults } from "vitest/config";

// Déploiement GitHub Pages (project page) : https://adam-serghini.github.io/RogueLiteDofus/
// La base doit correspondre au nom du dépôt ; en dev/local elle vaut "/".
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/RogueLiteDofus/" : "/",
  test: {
    // Les worktrees git vivent sous `.claude/worktrees/` — donc À L'INTÉRIEUR du dépôt.
    // Sans cette exclusion, `npm test` collecte AUSSI leurs fichiers de test et annonce
    // un total multiplié par le nombre de worktrees ouverts, ce qui rend le compte
    // illisible et fait échouer la suite sur du code d'un chantier voisin.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
});
