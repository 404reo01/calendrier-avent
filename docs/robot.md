# Le robot

Le robot est une tâche **GitHub Actions** : un petit ordinateur chez GitHub qui se réveille tout seul, construit le site et le met en ligne. Son mode d'emploi est dans `.github/workflows/publier.yml`. Il ne modifie jamais le dépôt : il fabrique le site, le vérifie et l'envoie à GitHub Pages.

## Ce qu'il fait à chaque passage

1. **Aiguillage** : il décide s'il doit publier (quelques secondes, sans télécharger le code).
2. **Tests** : `npm test`. Un seul test rouge, et il s'arrête.
3. **Construction** : `scripts/construire.mjs` fabrique `dist/` avec **seulement** les cases dues.
4. **Vérification de fuite** : `scripts/verifier-fuite.mjs` cherche une case future dans `dist/`. S'il en trouve une, il s'arrête.
5. **Publication** sur GitHub Pages.
6. **Journal** : l'heure, le mode, le déclencheur et les **numéros** des cases ouvertes. Jamais leur contenu.

## Quand il passe

| Passage | Heure | À quoi il sert |
| --- | --- | --- |
| Quotidien | 7 h 00, heure de Paris | Ouvre la case du jour. |
| Rattrapage | 7 h 30, heure de Paris | Repasse au cas où GitHub aurait sauté ou trop retardé celui de 7 h. |
| Toutes les 5 min | toute la journée | Ne publie qu'en mode accéléré. En mode normal, il s'arrête au bout de quelques secondes. |
| À la main | quand vous voulez | Fait exactement la même chose qu'un passage planifié. |

## Lancer le robot à la main

- **Sur le site GitHub** : onglet **Actions** → « Publier le calendrier » à gauche → bouton **Run workflow** → branche `main` → **Run workflow**.
- **Dans le terminal** : `gh workflow run publier.yml --ref main`

Au rythme normal, le lancement à la main ne publie **jamais** une case avant sa date : le robot regarde l'heure réelle, pas le bouton.

## Passer en mode accéléré, puis revenir au normal

Le mode accéléré ouvre une **case de démo** toutes les 5 minutes, à partir d'un instant de départ. Les vraies cases restent cachées jusqu'en décembre.

```sh
# 1. Fixer le départ (date, heure et fuseau), par exemple dans 10 minutes :
gh variable set DEPART_ACCELERE --body "2026-11-16T20:30:00+01:00"
# 2. Basculer :
gh variable set MODE --body accelere
# 3. Ne pas attendre le prochain passage :
gh workflow run publier.yml --ref main
```

Retour au rythme normal (un seul réglage) :

```sh
gh variable set MODE --body normal
gh workflow run publier.yml --ref main
```

Au retour, les cases de démo disparaissent : le calendrier repart intact, avec ses cases fermées jusqu'au 1er décembre.

Les réglages se voient aussi dans **Settings → Secrets and variables → Actions → Variables** : `MODE`, `HEURE_OUVERTURE` (`07:00` par défaut) et `DEPART_ACCELERE`. La clé `CLE_CALENDRIER` est dans l'onglet **Secrets** : personne ne peut la relire, pas même vous.

> Activez le mode accéléré au moins 30 minutes avant les démos : GitHub met parfois du temps à démarrer les premiers passages.

## Lire le journal

Onglet **Actions** → cliquez sur un passage. La page **Summary** affiche le résumé :

- l'heure UTC et l'heure de Paris ;
- le mode (normal ou accéléré) ;
- le déclencheur (planifié 7 h, rattrapage, toutes les 5 min, ou à la main) ;
- les numéros des cases ouvertes et la prochaine ouverture.

Couleurs des passages :
- **vert, avec les trois étapes cochées** : publié ;
- **vert, avec « Tester, construire, vérifier » et « Publier » grisés (skipped)** : passage « toutes les 5 min » ignoré, car le mode est normal. C'est voulu, et le résumé l'écrit en une ligne ;
- **rouge** : échec, voir plus bas.

En mode normal, la liste des passages se remplit d'un passage ignoré toutes les 5 minutes. C'est sans effet sur le site. Le filtre « Event » de l'onglet Actions permet de les masquer.

## Pourquoi l'heure UTC

GitHub compte ses horaires en **UTC**, l'heure universelle, sans heure d'été. Paris est à UTC+1 en hiver et à UTC+2 en été. En décembre, 7 h 00 à Paris correspond donc à **6 h 00 UTC**.

GitHub accepte aussi qu'on indique un fuseau à côté de l'horaire. Le robot utilise `timezone: Europe/Paris` : il passe à 7 h 00 à Paris, en hiver comme en été, sans calcul à refaire. Le journal affiche les deux heures pour qu'on puisse vérifier.

Si vous changez `HEURE_OUVERTURE`, changez aussi les deux horaires dans `publier.yml`. Sinon les cases s'ouvriront quand même, mais au passage suivant.

## En cas de retard ou d'échec

- **Retard** : un retard de 5 à 30 minutes est courant chez GitHub, surtout au début de chaque heure. Ce n'est pas grave : la case s'ouvre dès que le robot passe.
- **Passage sauté** : le passage suivant ouvre **toutes** les cases dues, puisque le site ne dépend que de l'heure. C'est à ça que sert le rattrapage de 7 h 30. En dernier recours, utilisez le bouton à la main.
- **Deux passages de suite** : sans risque. Ils produisent le même site, et deux publications ne se chevauchent jamais.
- **Échec (rouge)** : rien n'est publié, et le site garde son dernier état correct. Ouvrez l'étape rouge pour lire la cause :
  - « Lancer les tests » : un test est cassé, à corriger dans le code ;
  - « Vérifier qu'aucune case future ne fuit » : le robot a bloqué une fuite, c'est son travail ;
  - `CLE_CALENDRIER manquante` ou `invalide` : le secret est absent ou faux ;
  - `DEPART_ACCELERE` : le mode accéléré est activé sans départ valide.
  GitHub envoie aussi un e-mail d'échec à la dernière personne qui a modifié les horaires du robot.

## Bon à savoir

- Le robot ne passe à l'heure que depuis la branche `main`. Lancé depuis une autre branche, il ne publie rien.
- Le dépôt est public, donc son journal et ses fichiers aussi : c'est pour ça qu'ils ne contiennent jamais le texte d'une case.
- Le site empaqueté (artefact) reste téléchargeable un jour par tout compte GitHub. Il ne contient que les cases déjà ouvertes : la vérification de fuite l'a contrôlé.
