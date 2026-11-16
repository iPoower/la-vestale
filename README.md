# La Vestale

Studio de travail au piano, en application web installable (PWA) : séance guidée, clavier et accords, oreille, lecture de notes, métronome, morceaux, exercices de main gauche et journal.

- Un seul fichier `index.html` en HTML, CSS et JavaScript pur, sans bibliothèque ni dépendance.
- Fonctionne hors ligne dès le premier lancement : le service worker (`sw.js`) met en cache l'app, les icônes et les polices.
- Aucun appel à un tiers : les polices sont hébergées dans `fonts/`.
- Les données restent sur l'appareil (`localStorage`). Le bouton « Exporter » du Journal produit une sauvegarde JSON, et « Importer » la restaure.
- Copies automatiques sur l'appareil : une par jour et une avant chaque suppression, import ou restauration (10 au plus), restaurables depuis le Journal. Elles réparent une erreur mais ne remplacent pas l'export.
- Mes partitions (onglet Morceaux) : tu saisis toi-même la main droite d'une feuille que tu possèdes, mesure par mesure, avec en option la main gauche d'un morceau de l'app. Ces partitions restent sur l'appareil (et dans l'export) ; elles ne sont jamais envoyées ni publiées.
- Écoute au micro (Séance › Écoute-moi) : l'app reconnaît la note jouée au piano (autocorrélation, calcul sur l'appareil) et vérifie la main choisie, note par note, et chaque note d'un accord (spectre : saillance de chaque note attendue face à ses voisines à un demi-ton, vote sur trois instants) ; réglage sur le La du piano pour un instrument désaccordé. Le son du micro n'est ni enregistré ni envoyé.
- Sauvegarde hors du téléphone (Journal › Sauvegarde) : par défaut, après chaque séance notée et pas encore sauvegardée, un bandeau propose l'export en un toucher (sur iPhone : partage, « Enregistrer dans Fichiers », iCloud Drive). Réglages : après chaque séance, chaque semaine (si le dernier export date de plus de 7 jours, report possible de 24 h) ou jamais. Le Journal indique la date de la dernière sauvegarde et le nombre de séances pas encore sauvegardées.

## iPhone

L'app est réglée pour l'iPhone (testée au format iPhone 11 Pro Max, 414 × 896) : marges de l'encoche et de la barre du bas, champs en 16 px (pas de zoom automatique de Safari), cibles tactiles d'au moins 44 px, pas de zoom sur double appui. L'onglet Astuces donne une astuce par jour, une routine de 10 minutes et des conseils par thème.

## Installer sur iPhone

Ouvrir l'adresse de l'app dans Safari, toucher **Partager**, puis **Sur l'écran d'accueil**.

## Tests

Les tests Playwright tournent sous Chromium et WebKit, en 390 × 844, sur un serveur local `http://localhost` (aucune dépendance côté app ; Playwright est en devDependency).

```sh
npm install
npx playwright install chromium webkit   # si les navigateurs ne sont pas déjà installés
npm test
```

Ils vérifient : le chargement sans erreur ni requête externe, le manifeste et les icônes, le service worker et son cache, les polices locales, le rechargement hors ligne, le cycle séance → Export → Import, et la navigation dans les onglets. `tests/regressions.spec.js` contient un test par bug corrigé.

## Mise à jour

À chaque modification de l'app, changer la constante `VERSION` de `sw.js` pour que les appareils reçoivent la nouvelle version.

## Licences des polices

Atkinson Hyperlegible, Cormorant Garamond et Noto Music sont distribuées sous SIL Open Font License 1.1 (textes dans `fonts/`). Fichiers issus des paquets Fontsource 5.3.0 (sous-ensemble latin) ; Noto Music est en plus réduite aux deux clés musicales U+1D11E et U+1D122.

## Coach

L'onglet Coach reprend « Travailler un morceau » avec l'écoute au micro : chaque mesure jouée avec une faute se rejoue jusqu'à ce qu'elle soit propre, un conseil s'affiche à chaque erreur (demi-ton, note voisine, octave, doigté, accord incomplet), et l'app retient, par morceau, les mesures difficiles, les hésitations (plus de 4 s) et les confusions fréquentes. Ce suivi reste sur l'appareil et dans l'export.

### S'enregistrer et se réécouter

Bouton « Enregistrer » sous « Écoute-moi » (Séance et Coach), en même temps que l'écoute ou seul ; 5 minutes au plus. Les enregistrements restent sur l'appareil (IndexedDB), ne sont jamais envoyés ni inclus dans l'export JSON ; les 12 derniers sont gardés, ★ pour en garder un plus longtemps, « Télécharger » pour le conserver ailleurs. Chacun se réécoute et se compare au « modèle » (la mesure jouée par l'app).

### Rythme au micro

Case « Vérifier aussi le rythme » (Séance et Coach) : un décompte d'une mesure au tempo choisi, puis une pulsation à l'écran (pas de clic pendant le jeu : le micro l'entendrait comme une note). L'app situe le début de chaque note dans le signal (blocs d'environ 5 ms) et le compare au temps attendu, en tenant compte de la latence de sortie : à l'heure (± 0,1 s, ou 1/5 de temps si plus large), un peu en avance ou en retard (jusqu'au double), sinon faute de rythme, comptée comme une faute de la mesure (le Coach la fait rejouer). Après une fausse note, le rythme n'est plus jugé jusqu'à la fin de la mesure. Les retards et avances fréquents s'affichent dans « Où tu bloques », avec un conseil.

### Solfège

Onglet Solfège : un parcours en 10 leçons (clé de sol, clé de fa, durées et silences, tons et demi-tons, altérations, tonalités et armures, intervalles, accords, termes d'interprétation, mélange final), chacune avec sa théorie et 10 questions (acquise à 9/10) ; un chrono de 1, 2 ou 5 minutes par thème ou en mélange, avec records et bilan (justes, erreurs, temps par réponse, « à retenir ») ; les points faibles reviennent plus souvent (tirage pondéré) et sont listés. Le minuteur se met en pause quand l'app passe en arrière-plan. Dans la séance du jour, un jour sur deux, le bloc de 2 minutes devient un chrono de solfège sur le point faible.

### Séance du jour et révision espacée

Séance › Séance guidée › « Du jour · 30 min » (par défaut) compose chaque jour une séance à partir du suivi : échauffement main gauche (4 min, un exercice différent chaque jour), révision espacée (5 min), mesures difficiles (6 min), déchiffrer 2 mesures (6 min), jouer ce qu'on a lu (5 min), oreille (2 min), pour le plaisir (2 min). Un bloc sans objet cède son temps à « Jouer ». Chaque bloc ouvre la bonne mesure au Coach.

Révision espacée : une mesure jouée propre au micro revient le lendemain ; propre du premier coup, elle revient à 3 jours, puis 7, 14 et 30 ; ratée, elle revient le lendemain. Seul le premier passage du jour compte.

### Déchiffrer avant de jouer

Dans le Coach, l'étape « 1. Déchiffrer » donne la carte d'identité du morceau (tonalité et armure, mesure et comptage, tempo, étendue de chaque main, position de départ, mesures identiques, pièges repérés : grands sauts, altérations hors armure, passages chargés, mesures où l'on a déjà bloqué), puis guide la lecture d'une mesure note par note : nommer la note sur la portée, la trouver sur le clavier, l'écouter. La portée affiche la tonalité à la clé, comme sur une partition (armure dessinée après les clés ; une altération écrite vaut jusqu'à la barre ; bécarre pour l'annuler), et la tonalité est rappelée au-dessus de la portée. Une mesure lue sans erreur est retenue ; après 2 à 4 mesures, l'app propose de les jouer avec « Écoute-moi ».

## Écoute réaliste

Dans Clavier › Enchaînements, une partition entière se joue par défaut au tempo de la partition (valeur indicative), avec les nuances de l'édition Mutopia quand elle en a (Burgmüller op. 100 n° 1 et 2, Liszt), la pédale de l'édition (Liszt) ou une pédale automatique, levée à chaque mesure et à chaque nouvelle basse (Debussy, Alkan : approximation), les reprises et 1re / 2e fins (Burgmüller) et un ralenti final. Décocher « Écoute réaliste » revient à la lecture métronomique.

## Son du piano

Les notes sont jouées avec des enregistrements d'un piano Steinway & Sons modèle B, réalisés par l'University of Iowa Electronic Music Studios (Musical Instrument Samples, Lawrence Fritts, 2001), mis à disposition « for any projects, without restrictions » (https://theremin.music.uiowa.edu/MIS.html). Le dossier `samples/` contient une note sur trois, du Do1 au Do8, en mono et en MP3 (environ 750 Ko) ; les notes voisines sont obtenues en variant la vitesse de lecture. Les fichiers sont servis par l'app elle-même et mis en cache pour le hors-ligne ; si un son manque, le son de synthèse prend le relais. La Vestale n'est ni affiliée à Steinway & Sons ni approuvée par cette marque.

## Sources et licences des morceaux

- Exercices de main gauche (onglet « Main gauche ») : écrits pour l’app.
- Hymne à la joie, À la claire fontaine, J’ai du bon tabac, Au clair de la lune, Frère Jacques : airs du domaine public ; accompagnements de main gauche écrits pour l’app.
- Hedwige Chrétien (1859–1944), « Bébé s’endort » (6 Petits Préludes récréatifs n° 2) : domaine public ; notes relevées pour l’app, doigtés proposés par l’app.
- Bach, Menuet en la mineur BWV Anh. 120 : domaine public, notes d’après l’édition du Mutopia Project (Bach-Gesellschaft, 1894).
- Alkan, Préludes op. 31 n° 8 « La chanson de la folle au bord de la mer » : notes d’après l’édition du Mutopia Project, licence Creative Commons Attribution-ShareAlike 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Les données de cette pièce dans `index.html` (constante `WORK.alkan8`) sont une adaptation partagée sous la même licence.
- Burgmüller, 25 Études faciles op. 100 n° 1 « La candeur » et n° 2 « L’arabesque » (Bas Wassink) ; Schumann, Scènes d’enfants op. 15 n° 1 (Ying-Chun Liu) ; Bach, Prélude BWV 846 (Tobias Erbsland) ; Debussy, Clair de lune (Keith OHara) : domaine public, notes d’après les éditions du Mutopia Project.
- Alkan, Préludes op. 31 n° 1 : édition du Mutopia Project (Karsten Hens), licence Creative Commons Attribution-ShareAlike 3.0 (https://creativecommons.org/licenses/by-sa/3.0/). Les données de cette pièce (`WORK.alkan311`) sont une adaptation partagée sous la même licence.
- Liszt, Consolation S. 172 n° 3 : édition du Mutopia Project (Ryan Prince), licence Creative Commons Attribution 3.0 (https://creativecommons.org/licenses/by/3.0/) ; données adaptées (`WORK.liszt3`).
- Les œuvres protégées (méthodes, Let It Be, Il y a ton sourire, Odysseus, Orientale) ne figurent que par leur titre, leurs consignes et leurs grilles d’accords.
