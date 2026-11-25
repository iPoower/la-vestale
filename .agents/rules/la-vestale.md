---
trigger: always_on
---

# Règles permanentes — iPoower/la-vestale

Source principale : `AGENTS.md` à la racine du dépôt (en complément de `CLAUDE.md`).

- Toujours travailler sur une branche dédiée, jamais directement sur `main`.
- Toujours ouvrir une PR en brouillon (`draft`). La CI doit être verte avant toute demande de fusion.
- Ne jamais fusionner ni déployer sans validation écrite explicite de l'utilisateur.
- Tout nouveau correctif s'accompagne d'un test Playwright.
- Toujours donner le lien direct de la branche, de la PR et du run CI, avec l'heure de fin approximative.
- 2 échecs du même contrôle : arrêt immédiat et rapport.
- Rapport final obligatoire avec le statut `CONFIRMÉ` / `À VÉRIFIER` / `BLOQUÉ`.
