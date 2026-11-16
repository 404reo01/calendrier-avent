# Calendrier de l'Avent « Making-of » — plan de A à Z

> Plan exécuté par un orchestrateur (Claude Code, Opus) qui répartit le travail entre des sous-agents.
> Format inspiré de SmartPlan (diroflay/SmartPlan) : parties, critères atomiques, tests d'abord, relecture par un autre modèle. Les scripts SmartPlan ne sont **pas** utilisés.
> Règles du projet : `AGENTS.md` (kit) + `CONVENTIONS.md`. Brief : `2026-11-16-calendrier-avent.md`.

## 1. But

Un calendrier de l'Avent en ligne, en 3D, pour le **grand public**. Ses 24 cases présentent les 24 skills d'agent IA qui ont **réellement servi à le construire** (le making-of). Un robot GitHub Actions ouvre la case du jour à l'heure de Paris. Le mode accéléré ouvre une case toutes les 5 min pour la démo. Une case future n'est lisible nulle part avant sa date.

**Hors périmètre** (brief) : comptes visiteurs, paiement, appli mobile, écran d'administration.

**Critères de réussite globaux** (jugés à la relecture finale) :
- [ ] G1 — Avec l'ordinateur éteint, une nouvelle case apparaît à l'adresse publique, ouverte par le robot, et le passage du robot est visible dans l'onglet Actions.
- [ ] G2 — Le voisin ne parvient pas à lire la case 24 (code source, outils du navigateur, adresses devinées, horloge de l'appareil, dépôt, historique, journal du robot).
- [ ] G3 — La grille de 24 cases se lit et s'utilise sur un téléphone de 360 px de large sans zoomer, et les 3 états se distinguent sans la couleur.
- [ ] G4 — Les cases ouvertes présentent chacune un skill réellement utilisé dans ce dépôt (traçable dans l'historique ou `JOURNAL-SKILLS.md`).
- [ ] G5 — `npm test` passe en local et dans le robot.
- [ ] G6 — L'historique compte au moins 4 points de sauvegarde, avec des légendes en français. Aucun secret, ni dans l'historique, ni dans les fichiers.

## 2. Décisions à trancher par Rayan (avant de coder les parties concernées)

| # | Question | Options | Recommandation de l'orchestrateur | Bloque |
|---|---|---|---|---|
| T1 | Thème visuel 3D | moodboard (5 directions) | — | P5 |
| T2 | Où cacher les cadeaux (palier 4) | a) dépôt privé · b) secrets GitHub · c) contenu fabriqué le jour même · **d) contenus chiffrés dans le dépôt, clé dans un secret** | **d** : le dépôt reste public et gratuit (Pages + minutes illimitées), les textes gardent leur historique (chiffré), et le robot ne déchiffre que les cases dues. Ce que ça coûte : du code de chiffrement à soigner (partie critique), et une clé à ne jamais perdre | P2, P3, P7 |
| T3 | Après le 24 décembre | tout laisser ouvert (souvenir) · mot de fin + cases relisibles · refermer | mot de fin + cases relisibles | P1, P4 |
| T4 | Après la soirée (retour au mode normal) | laisser ouvertes les cases du soir · tout refermer | tout refermer : c'est l'effet naturel du moteur (l'état ne dépend que de la date), le calendrier repart intact le 1er décembre | P1 |
| T5 | Dépôt GitHub | public · privé | public (obligatoire si T2 = d ou b, pour avoir Pages gratuit) | P8 |
| T6 | Heure d'ouverture d'une case | minuit · 7 h · autre | 7 h, heure de Paris : les enfants (et les adultes) découvrent la case au réveil, et le retard GitHub de 5 à 30 min passe inaperçu | P1, P7 |

## 3. Architecture (contrats que les parties partagent)

```
calendrier-avent/
├── contenu/
│   ├── cases.chiffrees.json   ← suivi par Git : 24 cases chiffrées (T2 = d)
│   └── cases.json             ← JAMAIS suivi (.gitignore) : texte clair, seulement en local
├── scripts/
│   ├── lib/calendrier.mjs     ← moteur PUR : (maintenant, réglages) → états des 24 cases
│   ├── lib/coffre.mjs         ← chiffrer / déchiffrer une case (AES-256-GCM, node:crypto)
│   ├── chiffrer.mjs           ← CLI locale : cases.json → cases.chiffrees.json
│   ├── construire.mjs         ← fabrique dist/ avec SEULEMENT les cases dues
│   └── verifier-fuite.mjs     ← échoue si une case non due se trouve dans dist/
├── site/                      ← source du site (HTML/CSS/JS sans build, ES modules)
│   ├── index.html · styles/ · js/ · vendor/three.module.min.js (épinglé, versionné)
├── tests/                     ← node:test, aucune dépendance
├── .github/workflows/publier.yml
├── JOURNAL-SKILLS.md          ← quel skill a servi à quoi, avec le commit (matière des cases)
└── dist/                      ← JAMAIS suivi : sortie du build, déployée par le robot
```

**Contrat C1 — Réglages** (variables du dépôt GitHub, pas des secrets) :
`MODE` = `normal` | `accelere` · `DEPART_ACCELERE` = ISO 8601 avec fuseau (`2026-11-16T20:30:00+01:00`) · `HEURE_OUVERTURE` = `07:00` (T6).
Secret : `CLE_CALENDRIER` = 32 octets en base64. C'est le seul secret du projet.

**Contrat C2 — Moteur** `etatsDesCases(maintenant: Date, reglages) → { mode, aujourdhui: n|null, cases: [{ jour: 1..24, etat: "ouverte"|"du-jour"|"fermee", ouvertureLe: ISO }] , fini: bool }`
- Normal : la case *j* est due quand `maintenant ≥ j décembre à HEURE_OUVERTURE, heure de Paris`. Les années se calculent à partir de `maintenant`.
- Accéléré : la case *j* est due quand `maintenant ≥ DEPART_ACCELERE + (j-1) × 5 min`.
- « du-jour » = la plus haute case due, si elle a été ouverte dans les dernières 24 h (normal) ou les dernières 5 min (accéléré) ; sinon aucune. Au plus une.
- Fonction pure et déterministe : même entrée, même sortie. Relancer deux fois ne change rien, et un passage sauté est rattrapé au suivant.

**Contrat C3 — Ce que reçoit le visiteur** (`dist/`) :
`dist/etat.json` = C2 **sans aucun contenu** · `dist/cases/<jeton>.json` pour chaque case due **uniquement**, où `<jeton>` = HMAC-SHA256(clé, jour) tronqué à 16 caractères hex. Une adresse devinée (`/cases/24.json`) mène donc à une 404. `etat.json` liste les jetons des seules cases ouvertes.
Format d'une case : `{ jour, titre, skill: { nom, source, lien }, accroche, exemple, essayer, avis?, illustration? }`. Tout le texte est du texte brut, jamais du HTML.

**Contrat C4 — Robot** : un seul workflow `publier.yml`, déclenché par `schedule` (quotidien + toutes les 5 min) et `workflow_dispatch`. Le passage « toutes les 5 min » s'arrête dès le premier pas si `MODE ≠ accelere`. Étapes : tests → construire → vérifier-fuite → déployer sur Pages (artefact, rien n'est commité) → journal (`$GITHUB_STEP_SUMMARY` : heure UTC/Paris, mode, numéros des cases ouvertes, jamais leur contenu).

## 4. Parties

| # | Partie | Type | Majeure | Dépend de | Parallèle avec | Poids |
|---|---|---|---|---|---|---|
| P0 | Socle : structure, conventions, outillage | other | non | — | — | 4 |
| P1 | Moteur de calendrier (C2) | backend | oui | P0, T3, T4, T6 | P4, P5, P6 | 14 |
| P2 | Coffre : chiffrement des cases | complex-backend **[critical]** | oui | P0, T2 | P4, P5, P6 | 10 |
| P3 | Construction de `dist/` + vérification de fuite | backend | oui | P1, P2 | P4, P5 | 10 |
| P4 | Site : grille accessible, 3 états, ouverture d'une case | frontend | oui | P0 | P1, P2, P5, P6 | 14 |
| P5 | Scène 3D et « moment waw » | complex-frontend | oui | T1, P4 (contrat DOM) | P1, P2, P3 | 16 |
| P6 | Contenu : 24 cases de skills (making-of) | other | non | P0 | P1–P5 | 8 |
| P7 | Robot GitHub Actions (C4) | complex-backend **[critical]** | oui | P3, T5 | — | 12 |
| P8 | Mise en ligne : dépôt, Pages, réglages, clé | other **[critical]** | non | P7 | — | 4 |
| P9 | Audit palier 4 et défi du voisin | other | non | P8 | — | 5 |
| P10 | Démo : slide, README, finitions | other | non | P9 | — | 3 |

Paliers du brief : P0, P1, P4 et P6 → palier 1 · P8 (première mise en ligne à la main) → palier 2 · P7 → palier 3 · P2, P3 et P9 → palier 4 · la vérification de fuite dans le robot → bonus « vérification avant mise en ligne ».

**Ordre de livraison pour la soirée** (chaque palier est mis en ligne avant d'embellir) :
1. P0 → P1 + P4 (grille plate, sans 3D) + P6 (4 cases) → **palier 1**, commit.
2. P8 avec un premier workflow simple → **palier 2**, adresse envoyée au voisin.
3. P7 + P3 → **palier 3**, mode accéléré activé au moins 30 min avant les démos.
4. P2 + P9 → **palier 4**.
5. P5 (3D) en parallèle dès que T1 est tranché : la 3D se branche sur la grille, elle ne la remplace pas.

### P0 — Socle
- **Objectif** : le projet a sa structure, ses conventions et sa commande de test.
- **Portée** : `package.json` (`"type": "module"`, `engines.node >= 20`, scripts `test`, `construire`, `chiffrer`, `servir`, **aucune dépendance d'exécution**) · `.gitignore` (+ `contenu/cases.json`, `dist/`, `.env*`) · `CONVENTIONS.md` · `JOURNAL-SKILLS.md`.
- **Critères** : c1 `npm test` s'exécute (0 test, code de sortie 0) · c2 `git check-ignore contenu/cases.json dist/ .env` répond pour les trois.
- **Vérifier** : `npm test && git check-ignore contenu/cases.json dist .env`

### P1 — Moteur de calendrier
- **Objectif** : C2 implémenté, pur, testé.
- **Portée** : in `scripts/lib/calendrier.mjs`, `tests/calendrier.test.mjs` · out tout le reste.
- **Points durs** : le fuseau Europe/Paris sans dépendance (`Intl.DateTimeFormat` avec `timeZone`), le passage à l'heure d'hiver.
- **Critères** :
  - c1 le 30 novembre à 23:59 (Paris), aucune case n'est due ;
  - c2 le 1er décembre à HEURE_OUVERTURE (Paris), la case 1 est « du-jour » ;
  - c3 le 12 décembre à midi, les cases 1 à 11 sont « ouverte », la 12 est « du-jour », les cases 13 à 24 sont « fermee » ;
  - c4 deux appels avec la même entrée donnent des sorties identiques ;
  - c5 en accéléré, à départ + 12 min, les cases 1 à 3 sont dues ;
  - c6 en normal, aucune case n'est due avant sa date, quel que soit le déclencheur ;
  - c7 le 25 décembre, `fini` est vrai (comportement T3) ;
  - c8 chaque case fermée porte `ouvertureLe`.
- **Tests d'abord** : c1 à c8 → `tests/calendrier.test.mjs`, écrits par un autre agent que l'implémenteur · test seul : `node --test tests/calendrier.test.mjs`.

### P2 — Coffre [lead][critical]
- **Objectif** : chiffrer et déchiffrer une case. Le texte clair ne quitte jamais le poste de Rayan ni la mémoire du robot.
- **Portée** : `scripts/lib/coffre.mjs`, `scripts/chiffrer.mjs`, `tests/coffre.test.mjs`.
- **Règles** : AES-256-GCM (`node:crypto`), un IV aléatoire de 12 octets par case, le numéro du jour en données associées (AAD) pour qu'on ne puisse pas échanger deux cases. Clé lue **uniquement** dans `process.env.CLE_CALENDRIER`, jamais en argument de commande (sinon elle finirait dans l'historique du shell). Messages d'erreur sans contenu.
- **Critères** :
  - c1 chiffrer puis déchiffrer redonne le texte d'origine ;
  - c2 une mauvaise clé fait échouer le déchiffrement ;
  - c3 un texte chiffré déplacé sur un autre jour fait échouer le déchiffrement ;
  - c4 `cases.chiffrees.json` ne contient aucun mot des titres en clair ;
  - c5 une clé absente provoque une erreur claire (`CLE_CALENDRIER manquante`).
- **Tests d'abord** : c1 à c5 → `tests/coffre.test.mjs`.
- **Relecture** : obligatoirement par un autre modèle, plus `/security-review`.

### P3 — Construction et vérification de fuite
- **Objectif** : `dist/` ne contient que ce qu'un visiteur a le droit de voir.
- **Portée** : `scripts/construire.mjs`, `scripts/verifier-fuite.mjs`, `tests/construire.test.mjs`.
- **Critères** :
  - c1 avec `--maintenant 2026-12-12T12:00:00+01:00`, `dist/cases/` contient exactement 12 fichiers ;
  - c2 aucun fichier de `dist/` ne contient le titre de la case 13 ;
  - c3 `dist/cases/24.json` n'existe pas ;
  - c4 `verifier-fuite` échoue (code ≠ 0) si on injecte le texte d'une case future dans `dist/` ;
  - c5 deux constructions successives avec la même date donnent des `dist/` identiques à l'octet près ;
  - c6 `--maintenant` est refusé quand la variable `CI` est définie : en production, seule l'horloge réelle compte.
- **Tests d'abord** : c1 à c6.

### P4 — Site (sans 3D)
- **Objectif** : palier 1 complet à l'écran, en lisant `etat.json` et `cases/<jeton>.json`.
- **Portée** : `site/**` sauf `site/js/scene/**`.
- **Contrat DOM pour P5** : une `<ol class="grille">` de 24 `<li><button data-jour="n" data-etat="…">`. La 3D écoute l'événement `case:ouverte` (`detail: { jour }`) et peut masquer la grille visuellement, mais jamais pour les lecteurs d'écran.
- **Critères** :
  - c1 24 boutons numérotés de 1 à 24 sont visibles à 360 px ;
  - c2 chaque état porte un mot et un pictogramme (« Ouverte », « Aujourd'hui », « Le 14 déc. à 7 h ») ;
  - c3 une case fermée ne s'ouvre pas et dit quand elle s'ouvrira ;
  - c4 le contenu est inséré avec `textContent`, sans `innerHTML` ;
  - c5 tout fonctionne au clavier, avec un focus visible ;
  - c6 `prefers-reduced-motion` coupe les animations ;
  - c7 une case sans contenu est signalée en mode construction ;
  - c8 le message « après le 24 » apparaît (T3).
- **Tests d'abord** : non. Ce critère est visuel : on le vérifie avec le skill browser-testing (si le MCP est configuré) ou des captures d'écran.

### P5 — 3D et moment waw [lead]
- **Objectif** : l'univers choisi (T1) en three.js, avec **un seul** moment orchestré, l'ouverture d'une case (skill frontend-design : « spend your boldness in one place »).
- **Portée** : `site/js/scene/**`, `site/vendor/three.module.min.js` (version épinglée, fichier versionné, empreinte SHA-256 notée dans `CONVENTIONS.md`).
- **Critères** :
  - c1 la page affiche la grille accessible même si WebGL est indisponible ;
  - c2 le moteur 3D ne rend qu'avec l'onglet visible ;
  - c3 `devicePixelRatio` est plafonné à 2 ;
  - c4 le temps de chargement reste sous 3 s en 4G simulée ;
  - c5 avec `prefers-reduced-motion`, la scène est fixe.
- **Tests d'abord** : non, vérification visuelle et mesure de performance.

### P6 — Contenu (making-of)
- **Objectif** : 24 cases au format C3, une par skill réellement utilisé, en langage grand public.
- **Règle d'or** : une case ne parle que d'un skill inscrit dans `JOURNAL-SKILLS.md`, avec le commit où il a servi. Tant que ce n'est pas le cas, la case est marquée « à écrire ».
- **Ordre éditorial** : case 1 = « c'est quoi un skill » + `points-de-sauvegarde` · les skills de design vers les jours 4 à 8 · le robot vers 11 à 14 · la sécurité vers 15 à 18 · case 24 (temps fort) = `skill-creator`, « fabrique ton propre skill ».
- **Sécurité** : tout skill venu de findskills est lu en entier puis présenté à Rayan avant d'être installé (mémoire `findskills-usage-encadre`).
- **Critères** : c1 24 cases, aucun jour en double, aucun jour vide · c2 `contenu/cases.json` n'est jamais suivi par Git.

### P7 — Robot [lead][critical]
- **Objectif** : C4.
- **Portée** : `.github/workflows/publier.yml`.
- **Règles** :
  - `permissions:` au minimum (`contents: read`, `pages: write`, `id-token: write`) ;
  - actions épinglées par SHA de commit ;
  - `concurrency: { group: pages, cancel-in-progress: false }` ;
  - pas de `pull_request_target` ;
  - la clé passe par `env:` uniquement dans l'étape de construction ;
  - aucune commande `echo` d'un contenu de case ;
  - cron en UTC commenté avec son équivalent à Paris, ou `timezone: Europe/Paris` si GitHub l'accepte (à vérifier dans la doc le jour même).
- **Critères** :
  - c1 un lancement manuel réussit et publie ;
  - c2 deux lancements de suite donnent le même site ;
  - c3 si un test échoue, rien n'est publié et le passage est marqué en rouge dans Actions ;
  - c4 le résumé du passage affiche l'heure, le mode et les numéros des cases ouvertes ;
  - c5 avec `MODE=normal`, le passage « toutes les 5 min » se termine en moins de 15 s sans rien publier.
- **Relecture** : un autre modèle + `/security-review`.

### P8 — Mise en ligne [critical : la clé]
- Demander à Rayan : dépôt public ou privé (T5).
- `gh repo create`, puis Pages en mode « GitHub Actions ».
- Générer la clé localement (`node -e "console.log(crypto.randomBytes(32).toString('base64'))"`) puis la passer par `gh secret set CLE_CALENDRIER`, en entrée standard, jamais en argument.
- Créer les variables `MODE`, `HEURE_OUVERTURE` et `DEPART_ACCELERE`.
- Activer la protection contre l'envoi de secrets (push protection).
- **Sauvegarde de la clé** : Rayan la range dans son gestionnaire de mots de passe. Une clé perdue rend illisibles les cases chiffrées.
- **Critère** : l'adresse s'ouvre depuis un téléphone en 4G.

### P9 — Audit palier 4
- Lancer `/security-review` sur tout le dépôt.
- Chercher des secrets dans l'historique (`git log -p` passé dans un motif de recherche) et des fuites dans `dist/`.
- Jouer soi-même le défi du voisin : code source, `/cases/24.json`, changement de date de l'appareil, artefacts et journal Actions.
- Consigner les chemins essayés dans `AUDIT.md`.

### P10 — Démo
- Slide avec le skill `presentation`.
- README : ce que c'est, l'adresse, comment basculer de mode.
- Préparer la grille de démo du § 07 du brief.

## 5. Orchestration par sous-agents

L'orchestrateur ne code pas les parties majeures : il écrit le sous-plan, lance les agents, relit, commite et tient `.to-do/calendrier-avent/journal.md`.

| Rôle | Modèle | Qui |
|---|---|---|
| Orchestrateur / arbitre | Opus | session principale |
| [lead] et [critical] (P2, P5 le cœur 3D, P7) | Opus | sous-agent |
| backend, frontend, contenu (P1, P3, P4, P6) | Sonnet | sous-agent |
| Rédacteur de tests (tests d'abord) | Haiku, puis Sonnet si nécessaire | sous-agent ≠ implémenteur |
| Éclaireur (lecture de doc, état du code) | Haiku | sous-agent en lecture seule |
| Relecteur | un modèle ≠ l'auteur, + `/code-review` · `/security-review` pour [critical] | sous-agent |

- **Lancés en parallèle seulement si leurs fichiers ne se recoupent pas** : {P1, P2, P4, P6} ensemble, puis {P3, P5}. P7 et P8 sont séquentiels.
- **Échec à la relecture** : retour à l'auteur, deux tours au plus, puis arbitrage par l'orchestrateur.
- **Un commit par partie validée**, avec une légende en français (skill points-de-sauvegarde).
- **Chaque skill utilisé est noté dans `JOURNAL-SKILLS.md`** : c'est la matière des cases.

## 6. Risques

- **GitHub en retard de 5 à 30 min ou passage sauté** : moteur pur + rattrapage, ouverture à 7 h plutôt qu'à minuit, bouton manuel prêt pour la démo.
- **Clé perdue** : contenu en clair conservé en local + clé dans le gestionnaire de mots de passe.
- **Clé fuitée** : on la change (`gh secret set`) et on rechiffre. L'ancien historique chiffré devient lisible par le détenteur de l'ancienne clé : à dire en démo s'il y a lieu.
- **Fuite par l'artefact Pages** : sur un dépôt public, n'importe quel compte GitHub connecté peut télécharger les artefacts des passages du robot. Ils ne contiennent que les cases dues, vérifié par `verifier-fuite`.
- **3D trop lourde sur mobile** : la grille DOM reste la vérité, la 3D est une couche en plus. Budget : un seul canvas, peu de polygones, pas de texture externe.
- **Temps (2 h)** : on livre palier par palier. La 3D ne bloque jamais un palier.
- **Skills tiers piégés** : audit avant installation, aucun script tiers exécuté (SmartPlan inclus).
