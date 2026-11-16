# Contrats exacts (source de vérité pour tests et implémentations)

Complète le § 3 du plan. Tout changement passe par l'orchestrateur.

## `scripts/lib/calendrier.mjs`

```js
export function etatsDesCases(maintenant /* Date */, reglages /* Reglages */) /* → Etat */
export function saisonDe(maintenant) /* → année (number) */
```

- `Reglages = { mode: "normal" | "accelere", heureOuverture: "HH:MM" (défaut "07:00"), departAccelere?: string ISO 8601 avec fuseau }`
- `Etat = { mode, saison: number, aujourdhui: number | null, fini: boolean, cases: Array<{ jour: 1..24, etat: "ouverte" | "du-jour" | "fermee", ouvertureLe: string (toISOString, UTC) }> }`
- **Fuseau** : toutes les dates du calendrier sont à l'heure de Paris (`Europe/Paris`), calculées avec `Intl`, sans dépendance.
- **Saison** : l'année de `maintenant` à Paris. En janvier et février, c'est l'année précédente (le calendrier passé reste « fini »).
- **Normal** : la case j est due quand `maintenant ≥ (j décembre de la saison, heureOuverture, Paris)`.
- **Accéléré** : la case j est due quand `maintenant ≥ departAccelere + (j−1) × 5 min`. Un `departAccelere` absent ou invalide lève `Error` (message contenant `DEPART_ACCELERE`).
- **États** : une case due est `"ouverte"`, sauf la plus haute case due si son ouverture date de moins de 24 h (normal) ou de moins de 5 min (accéléré) : elle est alors `"du-jour"`. Il y a au plus une case `"du-jour"`. Une case non due est `"fermee"`. `aujourdhui` = numéro de la case du-jour, sinon `null`.
- **fini** : en normal, vrai quand `maintenant ≥ 25 décembre 00:00 Paris` de la saison. En accéléré, vrai quand `maintenant ≥ departAccelere + 24 × 5 min`. Une fois `fini`, toutes les cases sont `"ouverte"` (T3 : relisibles) et `aujourdhui` vaut `null`.
- **Pureté** : aucune lecture de l'horloge, des fichiers ou de l'environnement.

## `scripts/lib/coffre.mjs`

```js
export function lireCle(env = process.env) /* → Buffer(32) */
export function chiffrerCase(jour, contenu /* objet */, cle) /* → { jour, iv, donnees, tag } (chaînes base64 sauf jour) */
export function dechiffrerCase(enveloppe, cle) /* → objet */
export function jetonCase(jour, cle) /* → 16 caractères hex */
```

- **Clé** : `lireCle` lit `env.CLE_CALENDRIER` (base64 de 32 octets). Si elle est absente, lève une `Error` dont le message contient `CLE_CALENDRIER manquante`. Si elle ne fait pas 32 octets une fois décodée, lève une `Error` dont le message contient `CLE_CALENDRIER invalide`. Le message ne contient jamais la clé.
- **Chiffrement** : AES-256-GCM, IV aléatoire de 12 octets à chaque appel, AAD = `` `case:${jour}` ``, `contenu` sérialisé en JSON.
- **Déchiffrement** : `dechiffrerCase` utilise `enveloppe.jour` pour l'AAD. Un mauvais tag, une mauvaise clé ou un jour modifié lèvent une `Error` (message sans contenu).
- **Jeton** : `jetonCase` = HMAC-SHA256(clé, `` `jeton:${jour}` ``), en hex, 16 premiers caractères.

## Fichiers de contenu

- `contenu/cases.json` (jamais suivi par Git) : `{ "cases": [ Case × 24 ] }`.
- `contenu/cases.chiffrees.json` (suivi) : `{ "version": 1, "cases": [ Enveloppe × 24 ] }`.
- `contenu/demo.json` (suivi, sans secret) : `{ "cases": [ Case × 24 ] }`.
- `Case = { jour, titre, skill: { nom, source, lien }, accroche, exemple, essayer, avis?, illustration? }`. Tout est en texte brut. `lien` commence par `https://`.

## `scripts/construire.mjs`

```js
export async function construire({ maintenant, reglages, cle, cheminChiffre, cheminDemo, dossierSite, sortie }) /* → { etat, jetons } */
```

- Vide `sortie`, puis y copie `dossierSite` (sans `site/fixtures/`).
- Écrit `sortie/etat.json` = `Etat` + `jetons: { "<jour>": "<jeton>" }` pour les **seules** cases non fermées + `genereLe` (ISO). Aucun texte de case n'y figure.
- Pour chaque case non fermée, écrit `sortie/cases/<jeton>.json` = `Case`.
  - Mode normal : la case vient de `cheminChiffre`, déchiffrée.
  - Mode accéléré : la case vient de `cheminDemo`, sans déchiffrement.
- **Aucune autre case n'est écrite ni déchiffrée.**
- Sortie déterministe : la même entrée donne les mêmes octets. `genereLe` = `maintenant.toISOString()`, et les clés JSON sont dans un ordre stable.
- **CLI** :
  - `node scripts/construire.mjs [--maintenant ISO]` ;
  - `--maintenant` est refusé (code de sortie 1) si `process.env.CI` est défini ;
  - les réglages se lisent dans `MODE`, `HEURE_OUVERTURE`, `DEPART_ACCELERE` ;
  - la clé se lit avec `lireCle()` ;
  - les chemins par défaut sont `contenu/…`, `site/`, `dist/`.

## `scripts/verifier-fuite.mjs`

```js
export async function verifierFuite({ sortie, casesInterdites /* Case[] */ }) /* → Array<{ fichier, jour }> fuites */
```

- Une fuite = un fichier de `sortie` qui contient l'un de ces textes d'une case interdite : `titre`, `accroche`, `exemple`, `essayer`, `avis` (si présent et d'au moins 12 caractères).
- Un fichier `cases/<jeton-attendu-d'une-case-interdite>.json` présent compte aussi comme une fuite.
- **CLI** :
  - déchiffre en mémoire les cases non dues, en normal comme en accéléré (pour vérifier qu'aucune vraie case ne fuit) ;
  - en accéléré, les cases de démo non dues sont aussi interdites ;
  - n'affiche que les numéros de jour et les noms de fichier, jamais le contenu ;
  - code de sortie 1 s'il y a au moins une fuite.

## Site : contrat DOM et données

- La page lit `etat.json` puis, pour ouvrir une case, `cases/<jeton>.json`. Les chemins sont relatifs, car GitHub Pages sert le site sous `/<depot>/`.
- La grille est une `<ol class="grille">` de 24 `<li><button class="case" data-jour="n" data-etat="ouverte|du-jour|fermee">`.
- À l'ouverture d'une case, la page émet `document.dispatchEvent(new CustomEvent("case:ouverte", { detail: { jour } }))`. La 3D s'y branche.
- La page ne recalcule jamais les états avec l'horloge de l'appareil : elle affiche `etat.json`.
