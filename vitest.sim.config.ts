import { defineConfig } from "vitest/config";

// Config dédiée au harnais d'équilibrage (`npm run sim`).
// `src/sim.ts` est hors du glob par défaut (`*.test.ts`), donc `npm test` l'ignore ;
// on le cible explicitement ici. Timeout large : le sim rejoue des milliers de combats.
export default defineConfig({
  test: {
    include: ["src/sim.ts"],
    testTimeout: 600000,
    disableConsoleIntercept: true, // console.log du rapport → stdout directement
  },
});
