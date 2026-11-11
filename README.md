# La Vestale

Studio de travail au piano, en application web installable (PWA) : séance guidée, clavier et accords, oreille, lecture de notes, métronome, morceaux et journal.

- Un seul fichier `index.html` en HTML, CSS et JavaScript pur, sans bibliothèque ni dépendance.
- Fonctionne hors ligne dès le premier lancement : le service worker (`sw.js`) met en cache l'app, les icônes et les polices.
- Aucun appel à un tiers : les polices sont hébergées dans `fonts/`.
- Les données restent sur l'appareil (`localStorage`). Le bouton « Exporter » du Journal produit une sauvegarde JSON, et « Importer » la restaure.

## Installer sur iPhone

Ouvrir l'adresse de l'app dans Safari, toucher **Partager**, puis **Sur l'écran d'accueil**.

## Tests

Les tests Playwright tournent sous Chromium et WebKit, en 390 × 844, sur un serveur local `http://localhost` (aucune dépendance côté app ; Playwright est en devDependency).

```sh
npm install
npx playwright install chromium webkit   # si les navigateurs ne sont pas déjà installés
npm test
```

Ils vérifient : le chargement sans erreur ni requête externe, le manifeste et les icônes, le service worker et son cache, les polices locales, le rechargement hors ligne, le cycle séance → Export → Import, et la navigation dans les 7 onglets.

## Mise à jour

À chaque modification de l'app, changer la constante `VERSION` de `sw.js` pour que les appareils reçoivent la nouvelle version.

## Licences des polices

Atkinson Hyperlegible, Cormorant Garamond et Noto Music sont distribuées sous SIL Open Font License 1.1 (textes dans `fonts/`). Fichiers issus des paquets Fontsource 5.3.0 (sous-ensemble latin) ; Noto Music est en plus réduite aux deux clés musicales U+1D11E et U+1D122.
