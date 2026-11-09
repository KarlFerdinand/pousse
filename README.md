# Pousse

Suivi des repas très simple pour iPhone : une photo, quelques mots, et une plante qui gagne une feuille à chaque moment noté.
Application web installable (PWA), sans compte, sans serveur, sans dépendance. Licence MIT.

## Ce que fait l'appli

- **Aujourd'hui** : 5 moments par jour, chrono de repas, moments hors repas, eau, plante du jour.
- **Noter** : photo, heure, durée, description, quantité, type de produit, ressenti, note libre.
- **Frigo** : photo et état de chaque produit (j'en ai, presque fini, à acheter), repas possibles.
- **Courses** : liste construite à partir du frigo et des repas notés.
- **Progrès** : niveaux, série, horaires et durées sur 7 jours, ressentis, récompenses, journal.

Les points récompensent le fait de noter. La quantité, la durée et les produits consommés n'en retirent jamais.

## Installer sur iPhone

1. Crée un compte gratuit sur github.com, puis un dépôt public nommé `pousse`.
2. Touche **Add file**, **Upload files**, ajoute tous les fichiers de ce dossier, puis **Commit changes**.
3. Va dans **Settings**, **Pages**, choisis **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
4. Après une à deux minutes, ouvre `https://TON-PSEUDO.github.io/pousse/` dans **Safari**.
5. Touche **Partager**, puis **Sur l'écran d'accueil**.

Tout hébergement statique en HTTPS convient également.

## Rappels

iOS ne permet pas à une appli web sans serveur d'envoyer des notifications programmées. Le bouton des réglages importe `rappels.ics`
dans le Calendrier de l'iPhone, qui déclenche les alertes. Pour changer les horaires, modifie `data.js` puis lance `node build-ics.js`.

## Données

Tout reste sur l'appareil (IndexedDB). Exporte une sauvegarde depuis les réglages.
Seule exception, facultative : avec une clé API Anthropic personnelle, la photo du frigo est envoyée à Anthropic pour cocher les produits visibles.

## Adapter

`data.js` contient les moments, aliments, quantités, produits à éviter et niveaux. `logic.js` contient les règles, testées par `node test-logic.js`.
Après une modification, change `VERSION` dans `sw.js` pour que l'appli se mette à jour.

Pousse est un outil de suivi personnel. Il ne remplace pas un avis médical.
