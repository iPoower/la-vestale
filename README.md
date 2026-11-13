# La Vestale

Studio de travail au piano, en application web installable (PWA) : séance guidée, clavier et accords, oreille, lecture de notes, métronome, morceaux, exercices de main gauche et journal.

- Un seul fichier `index.html` en HTML, CSS et JavaScript pur, sans bibliothèque ni dépendance.
- Fonctionne hors ligne dès le premier lancement : le service worker (`sw.js`) met en cache l'app, les icônes et les polices.
- Aucun appel à un tiers : les polices sont hébergées dans `fonts/`.
- Les données restent sur l'appareil (`localStorage`). Le bouton « Exporter » du Journal produit une sauvegarde JSON, et « Importer » la restaure.
- Copies automatiques sur l'appareil : une par jour et une avant chaque suppression, import ou restauration (10 au plus), restaurables depuis le Journal. Elles réparent une erreur mais ne remplacent pas l'export.
- Mes partitions (onglet Morceaux) : tu saisis toi-même la main droite d'une feuille que tu possèdes, mesure par mesure, avec en option la main gauche d'un morceau de l'app. Ces partitions restent sur l'appareil (et dans l'export) ; elles ne sont jamais envoyées ni publiées.
- Rappel d'export : après une séance notée, si le dernier export date de plus de 7 jours, un bandeau propose de sauvegarder en un toucher (report possible de 24 h).

## Installer sur iPhone

Ouvrir l'adresse de l'app dans Safari, toucher **Partager**, puis **Sur l'écran d'accueil**.

## Tests

Les tests Playwright tournent sous Chromium et WebKit, en 390 × 844, sur un serveur local `http://localhost` (aucune dépendance côté app ; Playwright est en devDependency).

```sh
npm install
npx playwright install chromium webkit   # si les navigateurs ne sont pas déjà installés
npm test
```

Ils vérifient : le chargement sans erreur ni requête externe, le manifeste et les icônes, le service worker et son cache, les polices locales, le rechargement hors ligne, le cycle séance → Export → Import, et la navigation dans les 8 onglets. `tests/regressions.spec.js` contient un test par bug corrigé.

## Mise à jour

À chaque modification de l'app, changer la constante `VERSION` de `sw.js` pour que les appareils reçoivent la nouvelle version.

## Licences des polices

Atkinson Hyperlegible, Cormorant Garamond et Noto Music sont distribuées sous SIL Open Font License 1.1 (textes dans `fonts/`). Fichiers issus des paquets Fontsource 5.3.0 (sous-ensemble latin) ; Noto Music est en plus réduite aux deux clés musicales U+1D11E et U+1D122.

## Sources et licences des morceaux

- Exercices de main gauche (onglet « Main gauche ») : écrits pour l’app.
- Hymne à la joie, À la claire fontaine, J’ai du bon tabac, Au clair de la lune, Frère Jacques : airs du domaine public ; accompagnements de main gauche écrits pour l’app.
- Hedwige Chrétien (1859–1944), « Bébé s’endort » (6 Petits Préludes récréatifs n° 2) : domaine public ; notes relevées pour l’app, doigtés proposés par l’app.
- Bach, Menuet en la mineur BWV Anh. 120 : domaine public, notes d’après l’édition du Mutopia Project (Bach-Gesellschaft, 1894).
- Alkan, Préludes op. 31 n° 8 « La chanson de la folle au bord de la mer » : notes d’après l’édition du Mutopia Project, licence Creative Commons Attribution-ShareAlike 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Les données de cette pièce dans `index.html` (constante `WORK.alkan8`) sont une adaptation partagée sous la même licence.
- Les œuvres protégées (méthodes, Let It Be, Il y a ton sourire, Odysseus, Orientale) ne figurent que par leur titre, leurs consignes et leurs grilles d’accords.
