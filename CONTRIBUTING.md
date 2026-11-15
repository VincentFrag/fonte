# Contribuer à Fonte

Merci de vouloir améliorer Fonte ! Toutes les idées sont les bienvenues, même petites.

## Signaler un bug ou proposer une idée

1. Ouvre l'onglet **Issues** de ce dépôt, puis **New issue**.
2. Décris ce qui se passe (ou ce que tu aimerais), sur quel appareil et quel navigateur, et la version affichée en bas de l'écran **Plus** de l'app.
3. Une capture d'écran aide beaucoup.

Pas besoin de savoir coder pour ça.

## Proposer une modification du code

1. **Fork** ce dépôt (bouton en haut à droite).
2. Fais tes modifications dans ta copie. Pour tester en local, lance `python3 -m http.server 8000` dans le dossier et ouvre `http://localhost:8000`.
3. Si tu modifies des fichiers de l'app, augmente le numéro de version **aux deux endroits, avec la même valeur** : `VERSION` en haut de `sw.js` et `APP_VERSION` en haut de `js/app.js`.
4. Si tu ajoutes une colonne à la base, ajoute-la dans `supabase/schema.sql`, dans la liste `columns` de `js/store.js`, et crée un fichier `supabase/migration-X.Y.sql` pour les installations existantes.
5. Ouvre une **Pull request** vers ce dépôt en expliquant ce que tu as changé et pourquoi.

Chaque proposition est relue avant d'être intégrée. Elle peut être acceptée, ajustée ou refusée selon la direction du projet.

## Ce que tu acceptes en contribuant

En proposant une contribution (code, texte, image ou autre) à ce dépôt :

- tu confirmes que tu en es l'auteur, ou que tu as le droit de la proposer ;
- tu acceptes qu'elle soit publiée sous la licence du projet (voir `LICENSE`) ;
- tu autorises VincentFrag à utiliser, modifier et distribuer ta contribution, y compris sous d'autres licences, gratuites ou commerciales.

Ce dernier point permet au projet de faire évoluer sa licence plus tard sans devoir retrouver chaque contributeur. Ta contribution reste mentionnée dans l'historique du dépôt.
