# Conventions — code propre et sécurité

Ce fichier s'ajoute à `AGENTS.md` (kit). Tout agent qui travaille ici le lit avant d'écrire une ligne. En cas de conflit, le brief et `AGENTS.md` l'emportent.

## 1. Langue et nommage

| Quoi | Langue | Exemple |
|---|---|---|
| Textes de l'interface, légendes de commit, docs | français | « Affiche la grille des 24 cases » |
| Noms du domaine (variables, fonctions, fichiers) | français, sans accents | `etatsDesCases`, `ouvertureLe`, `construire.mjs` |
| Mots techniques sans bon équivalent | anglais toléré | `renderer`, `scene`, `fetch` |

- `camelCase` pour les variables et fonctions, `PascalCase` pour les classes, `MAJUSCULES` pour les constantes de module et les variables d'environnement, `kebab-case` pour les fichiers.
- Un nom dit ce que la chose **est** ou **fait** : `casesDues`, pas `data2` ni `tmp`.

## 2. Code propre

- **JavaScript moderne sans build** : ES modules (`import`/`export`), `const` par défaut, `let` si nécessaire, jamais `var`. Node ≥ 20.
- **Zéro dépendance d'exécution.** `node:crypto`, `node:test`, `node:fs` et `Intl` suffisent. Une seule exception côté site : three.js, versionné dans `site/vendor/` (voir § 5).
- **Fonctions pures pour la logique** (`scripts/lib/`). Les entrées et sorties (fichiers, réseau, horloge) restent en bordure, dans les scripts CLI. L'horloge est **injectée** (`maintenant` en paramètre), jamais lue au milieu de la logique.
- **Petites unités** : une fonction fait une chose. Au-delà de 40 lignes, on découpe. Un fichier par responsabilité.
- **Erreurs** : on échoue tôt, avec un message qui dit quoi et comment corriger (`CLE_CALENDRIER manquante : définissez-la dans .env ou dans les secrets GitHub`). Pas de `catch` vide. Les scripts sortent avec un code ≠ 0 en cas d'échec.
- **Commentaires** : ils disent **pourquoi**, pas quoi. On commente chaque choix de sécurité et chaque calcul d'heure.
- **Pas de code mort**, pas de `console.log` de débogage laissé dans un commit.
- **CSS** : des tokens dans `:root` (couleurs, typographies, espacements), une spécificité basse (classes simples), `gap` plutôt que des marges entre éléments frères, du mobile d'abord.
- **Accessibilité** (ce n'est pas une option) : HTML sémantique, boutons de vrais `<button>`, focus visible, `prefers-reduced-motion` respecté, un état ne se lit jamais par la seule couleur, contraste AA.
- **Tests** : `node:test`, dans `tests/*.test.mjs`. Une partie logique n'est pas finie tant que ses critères ne sont pas couverts. On écrit le test avant le code (skill test-driven-development), et la personne qui l'écrit n'est pas celle qui implémente.

## 3. Git

Les règles du skill `points-de-sauvegarde` s'appliquent, plus :
- **Un commit = une étape qui fonctionne**, avec une légende en français au présent (≤ 70 caractères).
- **Branche `main` protégée de fait** : le robot ne tourne que depuis `main`. Une idée incertaine passe par une branche `essai/<idee>`.
- **Jamais** de `push --force`, `reset --hard` ou réécriture d'historique sans un oui explicite de Rayan, donné pour cette action précise.
- **Identité** : adresse `noreply` GitHub (déjà réglée pour ce projet).

## 4. Sécurité

### Les secrets
- **Un seul secret** : `CLE_CALENDRIER`. En local, il vit dans `.env` (ignoré par Git). Dans le robot, il vit dans les secrets GitHub. Nulle part ailleurs.
- **Jamais** une clé en argument de commande : elle finirait dans l'historique du shell et dans la liste des processus. On la lit dans l'environnement, et on l'envoie à `gh secret set` par l'entrée standard.
- **Avant chaque commit**, on relit `git diff --cached`. Au moindre doute, on s'arrête et on demande.
- **Push protection** de GitHub activée sur le dépôt.
- **Un secret envoyé est perdu** : on le révoque et on en crée un nouveau. Nettoyer l'historique ne suffit pas.

### Les cadeaux (palier 4) : rien ne se protège chez le visiteur
- **Une case future n'est jamais envoyée** au navigateur : ni dans le HTML, ni dans le JS, ni dans un JSON, ni dans une image, ni masquée par du CSS.
- **Le texte clair** (`contenu/cases.json`) n'est jamais suivi par Git. Seul `contenu/cases.chiffrees.json` l'est.
- **Les adresses des cases sont des jetons** (HMAC), pas des numéros : deviner une adresse ne donne rien.
- **L'horloge du visiteur n'a aucun pouvoir** : le site affiche ce que le robot a publié, sans recalcul côté navigateur à partir de la date de l'appareil.
- **Le robot n'affiche jamais** le contenu d'une case dans son journal, et `verifier-fuite` bloque la publication si une case non due se trouve dans `dist/`.

### Le site
- Le contenu est inséré avec `textContent` ou `createElement`, **jamais** avec `innerHTML`, `insertAdjacentHTML` ou `document.write`.
- Pas d'`eval`, ni de `new Function`, ni de `setTimeout` avec une chaîne.
- Une Content-Security-Policy en `<meta>` : `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'`.
- Les liens externes portent `rel="noopener noreferrer"` et ne pointent qu'en `https://`.
- Aucun traceur, aucune analytics, aucun cookie.

### Le robot (GitHub Actions)
- `permissions:` au strict minimum, déclarées dans le workflow.
- Actions tierces **épinglées par SHA** de commit complet, avec la version en commentaire.
- Pas de `pull_request_target`. Pas d'expression `${{ … }}` venue d'une entrée utilisateur interpolée dans un `run:` : on passe par `env:`.
- La clé n'est exposée (`env:`) qu'à l'étape qui en a besoin.
- `concurrency` pour que deux passages ne se marchent pas dessus.

### Les dépendances et les skills tiers
- three.js est versionné dans `site/vendor/`, et son empreinte SHA-256 est notée ci-dessous. Aucun CDN en production.
- Un skill tiers (findskills, GitHub) est **lu en entier** puis présenté à Rayan (source, ce qu'il fait, ce qu'il peut toucher) avant toute installation. On n'exécute aucun script tiers sans accord.

## 5. Empreintes des fichiers tiers

| Fichier | Version | SHA-256 |
|---|---|---|
| `site/vendor/three.module.min.js` | three@0.160.0 (`build/three.module.min.js`, jsDelivr) | `3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6` |

## 6. Avant de dire « fini »

- [ ] `npm test` passe.
- [ ] `node scripts/verifier-fuite.mjs` passe.
- [ ] `git diff --cached` relu : aucun secret, aucun `cases.json`.
- [ ] Vérifié à 360 px de large, au clavier, et avec le mouvement réduit.
- [ ] Le skill utilisé est noté dans `JOURNAL-SKILLS.md`, avec le commit.
