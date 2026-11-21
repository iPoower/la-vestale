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

## Navigation : 5 onglets

Aujourd'hui (séance du jour), Jouer (Coach), Apprendre (Solfège, Lecture, Oreille, Alkan), Morceaux, Plus (Clavier, Tempo, Main gauche, Astuces, Journal). Apprendre et Plus ont des sous-onglets et rouvrent la dernière section visitée ; les adresses (#coach, #lecture…) restent les mêmes. « Commencer ma séance » démarre la séance du jour et ouvre chaque étape ; une barre sous les onglets suit la séance partout (Ouvrir, Suivant, pause). Une visite guidée de 5 étapes s'affiche au premier lancement (Plus › Astuces › Revoir la visite).

## Sauvegarde en un toucher

Le badge en haut à droite (« à sauvegarder », « sauvegardé aujourd'hui »…) s'ouvre sur deux choix : « Sauvegarder » (fichier JSON de toute la progression ; sur iPhone, « Enregistrer dans Fichiers ») et « Importer » (reprend ce fichier, avec confirmation et copie de sécurité avant import). Les mêmes boutons restent dans Journal. Sur ordinateur, la sauvegarde se télécharge toujours directement (dossier Téléchargements) : la feuille de partage n'est utilisée que sur téléphone, et si elle échoue, le fichier se télécharge. Le fichier porte toujours le même nom, `la-vestale-sauvegarde.json` (la date est à l'intérieur) : sur iPhone, « Enregistrer dans Fichiers » dans le même dossier propose « Remplacer », et il ne reste qu'une sauvegarde. Contenu compact (sans indentation).

Importer **fusionne** : pour chaque exercice, on garde le meilleur des deux (compteurs, niveaux, records, leçons acquises, mesures déchiffrées et révisions), les listes sont réunies, rien de ce qui est sur le téléphone n'est perdu ; un bilan s'affiche ensuite. La sauvegarde contient aussi les résultats de « Do Ré Mi ⇄ C D E », les sprints de lecture et les réglages (calibrage du La, Do Ré Mi / C D E, rappel), appliqués seulement s'ils manquent sur l'appareil.

## Coach

L'onglet Coach reprend « Travailler un morceau » avec l'écoute au micro : chaque mesure jouée avec une faute se rejoue jusqu'à ce qu'elle soit propre, un conseil s'affiche à chaque erreur (demi-ton, note voisine, octave, doigté, accord incomplet), et l'app retient, par morceau, les mesures difficiles, les hésitations (plus de 4 s) et les confusions fréquentes. Ce suivi reste sur l'appareil et dans l'export.

### Depuis le début

Sous la portée, « 1 mesure / 2 mesures / Depuis le début ». « Depuis le début » garde les mesures déjà vues affichées en petit au-dessus de la mesure en cours, et « Écouter 1 → N » les joue d'un coup. « Rejouer 1 → N au micro » repart de la mesure 1 et écoute jusqu'à la mesure en cours, d'affilée : une faute ne fait pas rejouer la mesure, le bilan donne à la fin les mesures à reprendre ; tout propre, on passe à la mesure suivante. Le choix est gardé d'une séance à l'autre.

### S'enregistrer et se réécouter

Bouton « Enregistrer » sous « Écoute-moi » (Séance et Coach), en même temps que l'écoute ou seul ; 5 minutes au plus. Les enregistrements restent sur l'appareil (IndexedDB), ne sont jamais envoyés ni inclus dans l'export JSON ; les 12 derniers sont gardés, ★ pour en garder un plus longtemps, « Télécharger » pour le conserver ailleurs. Chacun se réécoute et se compare au « modèle » (la mesure jouée par l'app).

### Réglage sur le piano (La)

« Régler sur mon piano » : l'app écoute le La4 et attend dix lectures d'affilée concordantes (à 12 cents près) avant de retenir leur médiane ; les premières trames du micro ne sont pas lues (0,8 s pour le réglage, 0,4 s pour le jeu : stabilisation du système audio). On peut aussi saisir l'accord à la main (400 à 466 Hz, par exemple 438).

### Accords graves

Chaque note d'un accord est comparée à ses deux voisines à un demi-ton : le pic de chaque harmonique est cherché à ±35 cents (les cordes graves d'un piano droit ont des harmoniques plus décalées), et pour chaque voisine on écarte les harmoniques que la note ou la voisine partagent avec les autres notes de l'accord. Si le réglage du La est à plus de 50 cents de 440 Hz, l'écoute le signale. Au Coach, une mesure se rejoue 5 fois au plus ; après 3 accords ratés, « Passer la note » avance sans compter de faute.

### Rythme au micro

Case « Vérifier aussi le rythme » (Séance et Coach) : un décompte d'une mesure au tempo choisi, puis une pulsation à l'écran (pas de clic pendant le jeu : le micro l'entendrait comme une note). L'app situe le début de chaque note dans le signal (blocs d'environ 5 ms) et le compare au temps attendu, en tenant compte de la latence de sortie : à l'heure (± 0,1 s, ou 1/5 de temps si plus large), un peu en avance ou en retard (jusqu'au double), sinon faute de rythme, comptée comme une faute de la mesure (le Coach la fait rejouer). Après une fausse note, le rythme n'est plus jugé jusqu'à la fin de la mesure. Les retards et avances fréquents s'affichent dans « Où tu bloques », avec un conseil.

### Alkan à ton niveau

Apprendre › Alkan : un parcours en six niveaux vers Alkan, du plus simple au texte original (écouter le Prélude op. 31 n° 1 ; ses accords de main gauche simplifiés, deux blanches par mesure ; la main gauche originale ; le chant ; mains ensemble ; La chanson de la folle). La progression vient du jeu au micro et du parcours A à Z ; le niveau recommandé est le premier non acquis. Les accords du Prélude sont nommés mesure par mesure (C/G, G7, E, Am, E7, A/C♯, D) et s'écoutent ; la version simplifiée se joue dans « Jouer » avec des doigtés proposés par l'app. Un chapitre de culture (avec quiz) présente Alkan ; il apparaît aussi dans Solfège › Culture.

### Solfège

Trois niveaux (Débutant, Intermédiaire, Avancé) : chaque thème a son niveau, débloqué en acquérant une leçon (9/10) ou par un chrono à 90 % sur 10 questions ou plus ; les questions se durcissent avec le niveau (lignes supplémentaires, silences et valeurs pointées, armures jusqu'à 7 altérations et relatives mineures, intervalles qualifiés, accords diminués, augmentés et de septième, termes avancés). 15 leçons : 5 par niveau. Culture musicale : 8 chapitres (noms des notes, piano, baroque, classique, romantique, de Debussy à aujourd'hui, formes, orchestre et diapason), chacun avec un quiz. Avant : un parcours en 10 leçons (clé de sol, clé de fa, durées et silences, tons et demi-tons, altérations, tonalités et armures, intervalles, accords, termes d'interprétation, mélange final), chacune avec sa théorie et 10 questions (acquise à 9/10) ; un chrono de 1, 2 ou 5 minutes par thème ou en mélange, avec records et bilan (justes, erreurs, temps par réponse, « à retenir ») ; les points faibles reviennent plus souvent (tirage pondéré) et sont listés. Le minuteur se met en pause quand l'app passe en arrière-plan. Dans la séance du jour, un jour sur deux, le bloc de 2 minutes devient un chrono de solfège sur le point faible.

### Morceaux

Le Cancan (Offenbach, travail préparatoire du cours) a ses 16 mesures dans « Mesure par mesure », d’après la feuille : mélodie et doigtés imprimés, main gauche imprimée Do–Mi (C) et Si–Sol (G) ; les notes ajoutées au crayon (Sol, Fa) sont signalées.

Good King Wenceslas suit la répartition des mains de la feuille : Sol–La–Si sous le Do central et les Do des mesures 4, 8, 12 et 17 (écrits en clé de fa) à la main gauche ; mesure 14, Si3 en blanche à la main gauche. La blanche de main gauche de la mesure 16 reste à vérifier.

Les morceaux sont rangés par niveau, chaque niveau replié : seuls les niveaux où un morceau est en cours s'ouvrent (le niveau 1 si rien n'est commencé). Un champ de recherche (titre, compositeur) et un sommaire par niveau mènent au bon morceau ; l'objectif, le piège et le tempo de chaque carte sont dans « Objectif, piège, tempo… ». « Étape suivante » demande confirmation.

### Séance du jour et révision espacée

Séance › Séance guidée › « Du jour · 30 min » (par défaut) compose chaque jour une séance à partir du suivi : échauffement main gauche (4 min, un exercice différent chaque jour), révision espacée (5 min), mesures difficiles (6 min), déchiffrer 2 mesures (6 min), jouer ce qu'on a lu (5 min), oreille (2 min), pour le plaisir (2 min). Un bloc sans objet cède son temps à « Jouer ». Chaque bloc ouvre la bonne mesure au Coach.

Révision espacée : une mesure jouée propre au micro revient le lendemain ; propre du premier coup, elle revient à 3 jours, puis 7, 14 et 30 ; ratée, elle revient le lendemain. Seul le premier passage du jour compte.

En fin de séance, la note proposée reprend le temps réellement passé (au moins 1 min) et la barre de séance disparaît ; « Commencer ma séance » repart alors de zéro. « Pour le plaisir » ouvre un morceau déjà bien avancé (étape « Mémoire » ou plus), sinon le morceau en cours.

### Mon morceau, de A à Z

En tête de l'onglet Jouer, un parcours guide tout le morceau : écouter ; puis, par sections de 4 mesures : lire (déchiffrage), main droite et main gauche (au micro, chaque mesure propre), mains ensemble (jugé par l'élève, trois fois propre d'affilée), enchaîner avec la section précédente ; enfin le morceau en entier, au tempo, et s'enregistrer. Un bouton ouvre le bon outil à la bonne mesure ; l'écoute s'arrête en fin de section (acquise, ou ce qu'il reste à réussir) ; « Valider moi-même » débloque une étape si le micro n'entend pas ; « Tout le parcours » montre chaque étape et permet d'y revenir. La main affichée (droite, gauche, deux mains) suit l'étape en cours ; pendant l'écoute, un bouton ■ Stop l'arrête. La progression est gardée, exportée et fusionnée à l'import.

### Déchiffrer avant de jouer

Dans le Coach, l'étape « 1. Déchiffrer » donne la carte d'identité du morceau (tonalité et armure, mesure et comptage, tempo, étendue de chaque main, position de départ, mesures identiques, pièges repérés : grands sauts, altérations hors armure, passages chargés, mesures où l'on a déjà bloqué), puis guide la lecture d'une mesure note par note : nommer la note sur la portée, la trouver sur le clavier, l'écouter. La portée affiche la tonalité à la clé, comme sur une partition (armure dessinée après les clés ; une altération écrite vaut jusqu'à la barre ; bécarre pour l'annuler), et la tonalité est rappelée au-dessus de la portée. La page ne se déplace pas entre deux réponses. Une mesure lue sans erreur est retenue ; après 2 à 4 mesures, l'app propose de les jouer avec « Écoute-moi ».

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
- Les œuvres protégées (méthodes, Let It Be, Imagine, Il y a ton sourire, Odysseus, Orientale) ne figurent que par leur titre, leurs consignes et leurs grilles d’accords. Pour Il y a ton sourire, l’accompagnement suit la grille en accords plaqués, dans les positions de la partie piano de la feuille (Si-Mi-Sol, Do-Mi-Sol, Si-Ré-Sol, La-Ré-Fa♯ ; basse au 1er temps, silence en mesure 2), sur les 69 mesures de la feuille, en croches à partir de la mesure 58 ; la portée s’écrit sans armure, comme la feuille, le Fa♯ devant la note ; ni mélodie ni paroles.
