# Fonte : carnet de musculation

Application web installable (PWA) pour iPhone, tablette Android et ordinateur. Elle permet de :

- préparer des **programmes** (exercices, séries, fourchette de répétitions, repos) ;
- saisir ses **séances** rapidement, avec les performances de la fois précédente en regard ;
- recevoir une **proposition de charge** quand toutes les séries atteignent le haut de la fourchette (double progression) ;
- voir les **disques à charger** de chaque côté de la barre ;
- lancer un **minuteur de repos** automatique à chaque série cochée ;
- repérer les **records** (1RM estimé, formule d'Epley) ;
- suivre la **progression** par exercice et les **séries par groupe musculaire** ;
- noter son **poids de corps**, avec moyenne sur 7 jours et tendance hebdomadaire ;
- **synchroniser** ses appareils via Supabase, tout en continuant à fonctionner **hors connexion**.

Durée totale de mise en route : 20 à 30 minutes, une seule fois.

---

## Étape 1 : mettre le site en ligne sur GitHub Pages

1. Connecte-toi sur [github.com](https://github.com). Si ce n'est pas déjà fait, active la double authentification : **Settings > Password and authentication > Two-factor authentication**. C'est la protection la plus importante, puisque ton compte peut modifier le site.
2. Clique sur **+** en haut à droite, puis **New repository**.
   - Nom : `fonte`
   - Visibilité : **Public** (GitHub Pages gratuit exige un dépôt public ; le code ne contient aucun secret)
   - Clique sur **Create repository**.
3. Sur la page du dépôt vide, clique sur le lien **uploading an existing file**.
4. Décompresse `fonte.zip` sur ton ordinateur, ouvre le dossier `fonte`, sélectionne **tout son contenu** (pas le dossier lui-même) et glisse-le dans la page GitHub. Les sous-dossiers (`css`, `js`, `icons`…) sont conservés.
5. En bas, clique sur **Commit changes**.
6. Va dans **Settings > Pages** :
   - Source : **Deploy from a branch**
   - Branch : **main**, dossier **/ (root)**, puis **Save**.
7. Après une ou deux minutes, l'adresse apparaît en haut de cette page : `https://TON-PSEUDO.github.io/fonte/`. Ouvre-la : l'app fonctionne déjà, sans synchro (données sur l'appareil uniquement).

## Étape 2 : créer la base Supabase

1. Crée un compte sur [supabase.com](https://supabase.com) (connexion avec GitHub possible), puis **New project** :
   - Nom : `fonte`
   - Mot de passe de la base : génère-le et garde-le dans ton gestionnaire de mots de passe (l'app n'en a pas besoin)
   - Région : **West EU (Paris)** ou la plus proche
2. Une fois le projet prêt, ouvre **SQL Editor**, clique sur **New query**, colle le contenu du fichier `supabase/schema.sql` et clique sur **Run**.
3. Le résultat affiche un tableau de 4 lignes (`bodyweights`, `exercises`, `templates`, `workouts`). Vérifie que chacune indique `rls_active = true` et `regles = 1` : les tables sont créées et protégées.

   Si Supabase affiche un avertissement **Potential issues detected** avant l'exécution, tu peux confirmer le lancement. Le script ne supprime aucune donnée. Les seules mentions de suppression sont `on delete cascade` (tes lignes disparaissent si ton compte est supprimé) et le droit `delete` accordé à ton compte connecté. La sécurité au niveau des lignes (RLS) est activée juste après chaque création de table, et le tableau final permet de le vérifier.

## Étape 3 : créer ton compte et fermer les inscriptions

L'app se connecte par **email + mot de passe**. Tu crées ton compte toi-même dans Supabase : aucun email n'est envoyé, donc pas besoin de configurer de serveur d'envoi.

1. Dans Supabase, ouvre **Authentication > Users**, puis **Add user > Create new user**.
2. Saisis ton email et un mot de passe solide (génère-le avec ton gestionnaire de mots de passe).
3. Coche **Auto Confirm User**, puis **Create user**.
4. Ferme ensuite les inscriptions : **Authentication > Sign In / Providers**, désactive **Allow new users to sign up**, puis **Save**. L'adresse de l'app étant publique, personne d'autre ne pourra ainsi créer de compte sur ton projet. Ton compte continue de fonctionner normalement.

## Étape 4 : relier l'app à Supabase

1. Récupère dans Supabase :
   - l'**URL du projet**, de la forme `https://abcdefghijkl.supabase.co` (bouton **Connect** en haut du tableau de bord, ou **Project Settings > Data API**) ;
   - la **clé publique** : **Project Settings > API Keys**, clé **Publishable** (`sb_publishable_…`). Si ton projet n'affiche que les anciennes clés, prends la clé **anon**.

   ⚠️ Ne copie **jamais** la clé `secret` ou `service_role` : elle contourne toutes les règles de sécurité.
2. Sur GitHub, ouvre le fichier `config.js` dans ton dépôt, clique sur le crayon (**Edit this file**) et remplis :
   ```js
   window.FONTE_CONFIG = {
     supabaseUrl: 'https://abcdefghijkl.supabase.co',
     supabaseKey: 'sb_publishable_xxxxxxxxxxxx',
   };
   ```
3. **Commit changes**. Le site se met à jour en une minute environ.

## Étape 5 : installer l'app et se connecter

**iPhone** : ouvre l'adresse dans **Safari**, touche le bouton **Partager**, puis **Sur l'écran d'accueil**. Lance Fonte depuis l'icône.

**Tablette Lenovo (Android)** : ouvre l'adresse dans **Chrome**, menu **⋮**, puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).

**Ordinateur** : dans Chrome ou Edge, clique sur l'icône d'installation à droite de la barre d'adresse. Un simple favori fonctionne aussi.

Sur chaque appareil : **Plus > Compte et synchronisation**, saisis l'email et le mot de passe créés à l'étape 3. Sur iPhone, le trousseau iCloud peut les enregistrer. La connexion reste active ensuite, il n'y a pas à la refaire.

---

## Premiers pas dans l'app

1. **Plus > Exercices** : touche **Ajouter les exercices courants** (24 exercices de base), puis crée les tiens. Pour un exercice au poids du corps (tractions, dips), choisis le matériel **Poids du corps** : tu saisis le lest, et les calculs ajoutent ton dernier poids enregistré.
2. **Plus > Programmes** : crée tes séances types. Pour chaque exercice, indique les séries, la fourchette de répétitions (par exemple 8 à 12) et le repos.
3. **Séance** : touche un programme pour démarrer. Les charges de la dernière fois sont pré-remplies. Coche ✓ chaque série terminée : le minuteur de repos démarre.
4. Touche le **numéro d'une série** pour la marquer comme échauffement (exclue des statistiques et des records) ou la supprimer.
5. **Poids** : pèse-toi le matin, à jeun. Regarde la moyenne 7 jours et la tendance, pas la pesée du jour.

## Partager l'app avec un ami

- **Sans synchro** : envoie-lui simplement l'adresse. Ses données restent sur son téléphone.
- **Avec synchro** : crée-lui un utilisateur (**Authentication > Users > Add user**, avec **Auto Confirm User**) et transmets-lui le mot de passe provisoire. À sa première connexion, il le remplace dans **Plus > Compte et synchronisation > Changer le mot de passe**. Les règles RLS l'empêchent de voir tes données, et toi les siennes depuis l'app. Depuis le tableau de bord Supabase, en revanche, tu peux voir ses données : préviens-le.

## Sauvegardes

La synchro sert déjà de sauvegarde, mais l'offre gratuite de Supabase n'inclut pas de sauvegarde automatique. Une fois par mois, fais **Plus > Sauvegarde > Exporter en JSON** et range le fichier dans iCloud Drive ou Google Drive. Le même écran permet de réimporter ce fichier et d'exporter tes séries en CSV pour Excel.

## Passer à la version 1.1 (barre par exercice)

1. Dans Supabase, **SQL Editor > New query**, colle le contenu de `supabase/migration-1.1.sql` et clique sur **Run**. Ça ajoute une colonne pour le poids de barre ; aucune donnée n'est modifiée.
2. Ensuite seulement, envoie les nouveaux fichiers sur GitHub (tout sauf `config.js`).
3. Dans l'app, **Plus > Exercices**, touche un exercice à la barre, puis **Modifier** : choisis sa barre (olympique 20 kg, EZ 10 kg…) ou saisis son poids exact.

## Mettre à jour l'app

Si tu modifies un fichier (seul ou avec Claude), augmente le numéro de version en haut de `sw.js` (par exemple `fonte-v1.0.1`). L'app vérifie s'il y a une nouvelle version à chaque réouverture et s'installe toute seule si aucune séance n'est en cours ; pendant une séance, elle propose **Mettre à jour**. Le bouton **Plus > Rechercher une mise à jour** force la vérification. Sans ce changement de numéro, les appareils gardent l'ancienne version en cache. Seule exception : `config.js` est toujours relu sur le réseau.

## Problèmes fréquents

**« Email ou mot de passe incorrect ».** Vérifie l'email exact dans **Authentication > Users**. Garde ce mot de passe dans ton gestionnaire. Ne supprime pas l'utilisateur pour le changer : toutes ses données dans le cloud seraient effacées avec lui.

**« Compte non confirmé ».** La case **Auto Confirm User** n'était pas cochée. Supprime l'utilisateur et recrée-le en la cochant.

**La pastille indique « Erreur de synchro ».** Touche-la pour voir le message. Les causes habituelles : une faute dans `config.js`, le script SQL non exécuté, ou le projet Supabase en pause.

**Projet Supabase en pause.** Les projets gratuits sont mis en pause après une semaine sans activité (pendant des vacances par exemple). L'app continue de fonctionner sur tes appareils. Pour relancer le projet : tableau de bord Supabase, ouvre le projet, **Resume project**. Les modifications en attente partent ensuite automatiquement.

**Le son de fin de repos ne joue pas sur iPhone.** Le son ne joue que si l'app est au premier plan et le mode silencieux désactivé. Le décompte reste juste quand tu reviens dans l'app.

**Tester en local sur l'ordinateur.** Ouvrir `index.html` en double-cliquant ne fonctionne pas (les navigateurs bloquent les modules JavaScript en `file://`). Dans le dossier, lance `python3 -m http.server 8000` et ouvre `http://localhost:8000`.

---

## Organisation du code

```
fonte/
├── index.html              Page unique de l'app
├── config.js               URL et clé publique Supabase (à remplir)
├── manifest.webmanifest    Nom, icônes, mode plein écran
├── sw.js                   Cache hors ligne et mises à jour
├── css/app.css             Styles (clair, sombre, mobile, tablette, ordinateur)
├── js/
│   ├── app.js              Navigation, minuteur de repos, écran allumé
│   ├── store.js            Stockage local (IndexedDB)
│   ├── sync.js             Synchronisation Supabase
│   ├── calc.js             1RM, records, progression, poids de corps, disques
│   ├── charts.js           Graphiques SVG
│   ├── ui.js               Feuilles, menus, notifications
│   └── views/              Un fichier par écran
├── supabase/schema.sql     Tables, synchro et règles de sécurité
├── vendor/supabase.js      Bibliothèque Supabase (v2.119, copiée localement)
├── fonts/                  Police Archivo (licence OFL)
└── icons/                  Icônes de l'app
```

### Fonctionnement de la synchro

Chaque appareil enregistre d'abord tout en local, puis envoie ses modifications et récupère celles des autres : à l'ouverture, au retour au premier plan, quelques secondes après chaque modification et au retour du réseau. Si deux appareils modifient le même élément hors connexion, la modification la plus récente l'emporte, côté appareil comme côté serveur. Les suppressions sont propagées. Côté Supabase, la règle RLS `user_id = auth.uid()` garantit que chaque compte ne lit et n'écrit que ses propres lignes.
