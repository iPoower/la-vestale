# La Vestale — règles pour les sessions de travail

## La feuille du cours fait foi
Tout morceau tiré d'une feuille du cours doit être **identique à la feuille** : notes, rythmes, mains (clé de sol ou de fa,
pointillés), positions des accords, doigtés imprimés, **armure** (y compris « pas d'armure »), altérations écrites devant
la note, nombre de mesures, tempo.
- La tonalité et l'armure sont **écrites** dans la source du morceau (`src` : « Do majeur », « Mi mineur, écrite sans
  armure » + `nosig:true`) : jamais devinées par l'app. Le test `tests/feuille.spec.js` le vérifie.
- Avant de transcrire ou de corriger : agrandir la photo mesure par mesure, mesurer les lignes de portée, distinguer
  l'imprimé du crayon (le crayon du prof est signalé à part, jamais mélangé à l'imprimé).
- Ce qui ne se lit pas avec certitude n'est pas inventé : la source du morceau le signale « à vérifier » et on demande
  une photo nette.
- Après correction : comparer le rendu de l'app à la feuille, mesure par mesure, avant toute PR.
- Œuvres protégées : titre, consignes, grilles et accompagnement en accords seulement ; ni mélodie ni paroles.

## Processus
- Une PR par changement ; fusion uniquement après « GO fusion » écrit ; suite complète Chromium + WebKit
  `--repeat-each=2` verte avant fusion ; vérification du site en ligne après déploiement.
- Aucune donnée personnelle dans le dépôt (noms, dates et horaires de cours, adresses) : scan avant chaque commit.
- HTML, CSS et JS purs : aucune dépendance ajoutée à l'app ; outils de test en devDependencies.
