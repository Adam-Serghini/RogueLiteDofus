# Éditeur de contenu — mode d'emploi

1. Ouvre `editeur.html` (double-clic). Tes données du jeu sont déjà dedans.
2. Édite : Items, Monstres, Rencontres, Sorts (les classes sont en lecture seule).
3. Les images : bouton « Chercher sur DofusDB… », tape le nom exact du monstre.
4. Quand tu as fini : Export / Import → « Exporter contenu.json » → envoie le fichier.
5. Si tu fermes l'onglet sans exporter, ton brouillon est proposé à la réouverture.
6. Ne modifie JAMAIS le fichier contenu.json à la main.

Côté dev : `npm run content:import -- contenu.json` puis relire le git diff ;
`npm run editor:build` pour régénérer un editeur.html à jour à renvoyer.
