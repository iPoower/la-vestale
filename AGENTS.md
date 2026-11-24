# La Vestale — règles permanentes pour les agents

Ces règles s'appliquent à toute session de travail sur le dépôt `iPoower/la-vestale`, en complément de `CLAUDE.md` (règles musicales « La feuille du cours fait foi », absence de données personnelles, HTML/CSS/JS purs).

## Git, PR et déploiement
- **Branche dédiée obligatoire** : toujours travailler sur une branche dédiée, jamais directement sur `main`.
- **PR en brouillon et CI verte** : toujours ouvrir une PR en brouillon (`draft`). La CI doit être verte avant toute demande de fusion.
- **Validation écrite obligatoire** : ne jamais fusionner ni déployer sans validation écrite explicite de l'utilisateur.

## Qualité et tests
- **Test Playwright systématique** : tout nouveau correctif s'accompagne d'un test Playwright.
- **Règle des 2 échecs** : si un même contrôle échoue 2 fois, s'arrêter immédiatement et produire un rapport.

## Format des comptes rendus
- **Liens directs et horodatage** : toujours donner le lien direct de la branche, de la PR et du run CI, avec l'heure de fin approximative.
- **Statut final obligatoire** : conclure tout rapport final avec le statut `CONFIRMÉ`, `À VÉRIFIER` ou `BLOQUÉ`.
