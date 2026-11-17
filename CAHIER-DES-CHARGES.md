# Pousse : cahier des charges (version 2, novembre 2026)

## 1. Objet

Pousse est une application web installable sur iPhone pour suivre ses repas et son ventre pendant une poussée de maladie de Crohn.
Elle s'adresse à une personne qui mange vite, mange parfois sous le coup des émotions, et qui est suivie par une équipe de soin.

L'objectif est de :
- noter vite, sans culpabilité
- retrouver un rythme de repas
- repérer les liens entre repas, émotions et symptômes digestifs
- arriver aux rendez-vous médicaux avec des faits

Pousse ne remplace ni le gastro-entérologue, ni le diététicien, ni l'équipe qui accompagne la relation à l'alimentation.

## 2. Référence étudiée : Foodvisor

Foodvisor est l'une des applis de nutrition les plus utilisées en France. Ses points forts :
- photo du plat analysée par IA, dictée, recherche, scan de code-barres
- favoris pour noter un repas habituel en un geste
- rapports sur les habitudes
- gamification, avec une graine qui grandit, des quêtes et des points
- hydratation, recettes, synchronisation avec Apple Santé

Son cœur est le comptage des calories et des macronutriments, avec un objectif de poids.

## 3. Ce que Pousse reprend, et ce qu'il écarte

| Fonction Foodvisor | Dans Pousse | Pourquoi |
| --- | --- | --- |
| Photo du plat analysée par IA | Repris : coche les produits reconnus et propose une description | Gain de temps. Facultatif, avec une clé personnelle |
| Favoris | Repris : « Repas habituels » en un geste | Noter en moins de 10 secondes |
| Scan de code-barres | Repris, adapté : additifs irritants, gluten, lait, ultra-transformés via Open Food Facts | Utile pour une MICI, sans aucune notion de « bon » ou « mauvais » aliment |
| Rapports | Repris, adapté : « Bilan pour mon rendez-vous » sur 14 jours | Faits à partager avec l'équipe de soin |
| Gamification (graine, points) | Conservé : la plante, les points, la journée difficile | Encourage la régularité. Les points récompensent le fait de noter, jamais ce qui est mangé |
| Hydratation | Conservé : repère de 8 verres | Important avec des selles liquides |
| Recettes | Repris : recettes simples faisables avec le frigo | Aide à cuisiner sans réfléchir |
| Calories, macronutriments, objectif de poids | Écarté | Le comptage rigidifie la relation à la nourriture chez les personnes vulnérables aux troubles alimentaires |
| Jeûne intermittent, programmes minceur | Écarté | Incompatible avec la poussée et le rythme recherché |
| Apple Santé, Apple Watch | Écarté pour l'instant | Impossible pour une appli web sans serveur |
| Communauté | Écarté | Données de santé : rien ne quitte le téléphone |

## 4. Exigences fonctionnelles

### 4.1 Aujourd'hui
- 5 moments repères (matin, 10 h, midi, 16 h, soir) avec des suggestions sans quantité
- Chrono « Je commence à manger » pour observer la durée des repas, sans durée imposée
- Moment « hors repas » noté sans feuille et sans jugement
- **Mon ventre aujourd'hui** :
  - nombre de selles
  - consistance (liquides, molles, moulées)
  - selles la nuit
  - sang, qui affiche immédiatement la conduite à tenir
  - douleur, énergie
  - une remarque pour le gastro
- Eau, journée difficile qui protège la série

### 4.2 Noter un repas
- Repas habituels en un geste
- Photo du plat, lue automatiquement si une clé est configurée
- Heure, durée, description, quantité ressentie (petite, normale, grande), produits, ressenti avant de manger, note libre
- Les aliments qui irritent souvent l'intestin sont signalés en termes neutres, sans retirer de points

### 4.3 Frigo
- Photo du frigo, état de chaque produit, repas possibles
- Recettes faisables avec ce qu'il y a

### 4.4 Courses
- Liste construite depuis le frigo et les repas notés, partageable
- **Vérifier un produit** : chiffres du code-barres ou photo, puis lecture de la fiche Open Food Facts (émulsifiants, épaississants, édulcorants polyols, gluten, lait, ultra-transformé)

### 4.5 Progrès
- Niveau, série, jardin des 7 jours
- Horaires et durées des repas, ressentis
- **Mon ventre sur 7 jours**
- **Bilan pour mon rendez-vous** : texte des 14 derniers jours à partager ou copier
- Récompenses, journal

## 5. Règles de conception (non négociables)

1. Aucun chiffre de calories, de grammes ou de portions à respecter. Aucun suivi du poids.
2. Les points récompensent le fait de noter et la régularité. Rien n'en retire.
3. Aucun aliment n'est présenté comme interdit. Le vocabulaire est neutre : « irrite souvent », « observe ».
4. Les signes d'alerte (sang, fièvre, douleurs fortes, vertiges, gonflement près de l'anus) sont toujours visibles dans les réglages, et le sang déclenche un message immédiat.
5. Le bilan ne contient que des faits notés, sans score ni appréciation.

## 6. Exigences techniques

- Application web installable (PWA), fichiers statiques, sans compte, sans serveur, sans dépendance
- Données sur l'appareil (IndexedDB), export et import d'une sauvegarde
- Fonctionne hors ligne, sauf la vérification de produit et la lecture des photos
- Seules sorties réseau, toutes facultatives :
  - Open Food Facts, pour un code-barres tapé ou photographié
  - Anthropic, avec la clé personnelle de l'utilisateur, pour lire une photo
- Accessible au doigt (cibles de 44 px), lisible en mode clair et sombre, sur un écran de 390 px de large
- Règles métier testées : `node test-logic.js`

## 7. Pistes pour la suite

- Rappels par notification si iOS le permet un jour aux applis web
- Version partageable du bilan en PDF
- Valider le vocabulaire et le bilan avec le gastro-entérologue et l'équipe qui accompagne les troubles alimentaires
