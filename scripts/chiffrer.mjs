// CLI locale : contenu/cases.json (clair, jamais suivi) → contenu/cases.chiffrees.json (suivi).
// Usage : npm run chiffrer            (la clé est lue dans .env via --env-file-if-exists)
//         npm run chiffrer -- --generer-cle   (affiche une nouvelle clé, rien d'autre)
// La clé ne se passe jamais en argument : elle finirait dans l'historique du shell.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chiffrerCase, dechiffrerCase, lireCle } from './lib/coffre.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NOMBRE_CASES = 24;
const CHAMPS_TEXTE = ['titre', 'accroche', 'exemple', 'essayer'];
const CHAMPS_OPTIONNELS = ['avis', 'illustration'];
const CHAMPS_CASE = new Set(['jour', 'skill', ...CHAMPS_TEXTE, ...CHAMPS_OPTIONNELS]);
const CHAMPS_SKILL = ['nom', 'source', 'lien'];

export function chiffrerFichier({ entree, sortie, cle }) {
  const cases = validerCases(lireJsonClair(entree));
  const enveloppes = cases.map((c) => chiffrerCase(c.jour, c, cle));
  verifierAllerRetour(cases, enveloppes, cle);
  // Écriture atomique : un fichier à moitié écrit ne doit jamais être commité.
  const temporaire = `${sortie}.tmp`;
  writeFileSync(temporaire, `${JSON.stringify({ version: 1, cases: enveloppes }, null, 2)}\n`, 'utf8');
  renameSync(temporaire, sortie);
  return enveloppes.length;
}

export function validerCases(donnees) {
  if (!estObjet(donnees) || !Array.isArray(donnees.cases)) {
    throw new Error('cases.json invalide : { "cases": [ … ] } attendu.');
  }
  if (donnees.cases.length !== NOMBRE_CASES) {
    throw new Error(`cases.json invalide : ${NOMBRE_CASES} cases attendues, ${donnees.cases.length} trouvées.`);
  }
  const vus = new Set();
  donnees.cases.forEach((c, i) => {
    validerCase(c, i);
    if (vus.has(c.jour)) throw new Error(`cases.json invalide : le jour ${c.jour} apparaît deux fois.`);
    vus.add(c.jour);
  });
  return [...donnees.cases].sort((a, b) => a.jour - b.jour);
}

// Les messages ne citent que la position, le jour et le nom du champ, jamais sa valeur.
function validerCase(c, index) {
  const ou = `case n° ${index + 1} du fichier`;
  if (!estObjet(c)) throw new Error(`cases.json invalide : ${ou} n'est pas un objet.`);
  if (!Number.isInteger(c.jour) || c.jour < 1 || c.jour > NOMBRE_CASES) {
    throw new Error(`cases.json invalide : ${ou}, « jour » doit être un entier de 1 à ${NOMBRE_CASES}.`);
  }
  const ici = `case ${c.jour}`;
  // Liste blanche des champs : écarte une faute de frappe et les clés comme __proto__.
  for (const champ of Object.keys(c)) {
    if (!CHAMPS_CASE.has(champ)) throw new Error(`cases.json invalide : ${ici}, champ inconnu « ${champ} ».`);
  }
  for (const champ of CHAMPS_TEXTE) exigerTexte(c[champ], `${ici}, « ${champ} »`);
  for (const champ of CHAMPS_OPTIONNELS) {
    if (c[champ] !== undefined) exigerTexte(c[champ], `${ici}, « ${champ} »`);
  }
  validerSkill(c.skill, ici);
}

function validerSkill(skill, ici) {
  if (!estObjet(skill)) throw new Error(`cases.json invalide : ${ici}, « skill » doit être un objet.`);
  for (const champ of Object.keys(skill)) {
    if (!CHAMPS_SKILL.includes(champ)) throw new Error(`cases.json invalide : ${ici}, champ inconnu « skill.${champ} ».`);
  }
  for (const champ of CHAMPS_SKILL) exigerTexte(skill[champ], `${ici}, « skill.${champ} »`);
  // Le site met ce lien dans un href : seul https:// est accepté (pas de javascript:).
  if (!skill.lien.startsWith('https://') || !URL.canParse(skill.lien)) {
    throw new Error(`cases.json invalide : ${ici}, « skill.lien » doit être une adresse https:// valide.`);
  }
}

function exigerTexte(valeur, ou) {
  if (typeof valeur !== 'string' || valeur.trim() === '') {
    throw new Error(`cases.json invalide : ${ou} doit être un texte non vide.`);
  }
}

function estObjet(valeur) {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
}

function lireJsonClair(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  try {
    return JSON.parse(texte);
  } catch {
    // Le message natif de JSON.parse cite un extrait du fichier : on le masque.
    throw new Error(`${chemin} n'est pas du JSON valide.`);
  }
}

// Filet de sécurité : on relit chaque enveloppe avant d'écrire, pour ne jamais
// publier une case qu'on ne saurait pas rouvrir le jour J.
function verifierAllerRetour(cases, enveloppes, cle) {
  enveloppes.forEach((enveloppe, i) => {
    if (JSON.stringify(dechiffrerCase(enveloppe, cle)) !== JSON.stringify(cases[i])) {
      throw new Error(`Vérification de la case ${enveloppe.jour} échouée : rien n'a été écrit.`);
    }
  });
}

// Refuse de travailler si le texte clair est (ou risque d'être) suivi par Git.
export function verifierClairHorsGit(cheminClair, racine) {
  const relatif = relative(racine, cheminClair).split('\\').join('/');
  // Fail-closed : seul un code de sortie attendu permet de continuer. Tout autre
  // code (128 hors dépôt, plantage, Git absent) est un refus.
  const suivi = codeGit(['ls-files', '--error-unmatch', '--', relatif], racine);
  if (suivi === 0) {
    throw new Error(`${relatif} est suivi par Git : retirez-le (git rm --cached ${relatif}) avant de chiffrer. S'il a déjà été envoyé sur GitHub, les cases sont publiques.`);
  }
  if (suivi !== 1) throw verificationImpossible(suivi);
  // 0 = ignoré (par contenu/* de la liste blanche, ou une règle explicite), 1 = non ignoré.
  const ignore = codeGit(['check-ignore', '-q', '--', relatif], racine);
  if (ignore === 1) {
    throw new Error(`${relatif} n'est pas ignoré par Git : ajoutez-le au .gitignore avant de chiffrer.`);
  }
  if (ignore !== 0) throw verificationImpossible(ignore);
}

function verificationImpossible(code) {
  return new Error(`Git a répondu de façon inattendue (code ${code}, par exemple hors d'un dépôt) : impossible de vérifier que le texte clair n'est pas suivi, chiffrement refusé.`);
}

function codeGit(args, racine) {
  try {
    execFileSync('git', args, { cwd: racine, stdio: 'ignore' });
    return 0;
  } catch (e) {
    if (typeof e.status !== 'number') throw new Error('Git est introuvable : impossible de vérifier que le texte clair n\'est pas suivi.');
    return e.status;
  }
}

function principal(argv) {
  if (argv.length === 1 && argv[0] === '--generer-cle') {
    // Seule sortie du projet autorisée à contenir une clé, et seulement à la demande.
    process.stdout.write(`${randomBytes(32).toString('base64')}\n`);
    return;
  }
  if (argv.length > 0) {
    throw new Error('Argument inconnu. Usage : npm run chiffrer  |  npm run chiffrer -- --generer-cle (la clé se lit dans .env, jamais en argument).');
  }
  const cle = lireCle(process.env);
  const entree = resolve(RACINE, 'contenu/cases.json');
  const sortie = resolve(RACINE, 'contenu/cases.chiffrees.json');
  verifierClairHorsGit(entree, RACINE);
  const nombre = chiffrerFichier({ entree, sortie, cle });
  console.log(`${nombre} cases chiffrées dans contenu/cases.chiffrees.json.`);
}

// Garde CLI : ne s'exécute que lancé directement, pas quand un test importe le module.
const lanceDirectement = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (lanceDirectement) {
  try {
    principal(process.argv.slice(2));
  } catch (e) {
    // Nos messages sont écrits pour ne rien révéler ; on n'affiche jamais la pile.
    console.error(`Erreur : ${e.message}`);
    process.exitCode = 1;
  }
}
