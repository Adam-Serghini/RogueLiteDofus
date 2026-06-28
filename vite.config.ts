import { defineConfig } from "vite";

// Déploiement GitHub Pages (project page) : https://adam-serghini.github.io/RogueLiteDofus/
// La base doit correspondre au nom du dépôt ; en dev/local elle vaut "/".
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/RogueLiteDofus/" : "/",
});
