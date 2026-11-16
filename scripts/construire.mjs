// Construction de dist/ : copie le site, puis ajoute SEULEMENT les cases non fermées.
// Règle de sécurité : une case fermée n'est jamais déchiffrée ni écrite. On choisit
// chaque enveloppe par son champ `jour` (jamais par sa position dans le fichier).
// Aucune sortie console ne reprend un texte de case, une clé ou une pile d'erreur.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { etatsDesCases } from './lib/calendrier.mjs';
import { dechiffrerCase, jetonCase, lireCle } from './lib/coffre.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Vrai si `chemin` est `parent` lui-même ou se trouve dedans.
function memeOuDans(chemin, parent) {
  const rel = relative(resolve(parent), resolve(chemin));
  return rel === '' || (!rel.startsWith('..') && resolve(rel) !== rel);
}

// Garde-fou : on vide `sortie`, donc on refuse tout dossier qui est (ou contient)
// la racine du projet, site/ ou contenu/, ou qui se trouve dans site/ (copie récursive).
function verifierSortie({ sortie, dossierSite, cheminChiffre, cheminDemo }) {
  const protegees = [RACINE, dossierSite, dirname(cheminChiffre), dirname(cheminDemo)];
  if (protegees.some((p) => memeOuDans(p, sortie)) || memeOuDans(sortie, dossierSite)) {
    throw new Error('Dossier de sortie refusé : il ne doit être ni la racine du projet, ni site/, ni contenu/, ni un dossier qui les contient.');
  }
}

const lireJson = async (chemin) => JSON.parse(await readFile(chemin, 'utf8'));

// Renvoie la Case d'un jour. Normal : enveloppe déchiffrée. Accéléré : case de démo.
function chargerCase(jour, { reglages, cle, enveloppes, demo }) {
  if (reglages.mode === 'accelere') {
    const c = demo.find((x) => x?.jour === jour);
    if (!c) throw new Error(`Case ${jour} absente de contenu/demo.json.`);
    return c;
  }
  const enveloppe = enveloppes.find((e) => e?.jour === jour);
  if (!enveloppe) throw new Error(`Case ${jour} absente de contenu/cases.chiffrees.json.`);
  return dechiffrerCase(enveloppe, cle);
}

const ecrireJson = (chemin, objet) => writeFile(chemin, `${JSON.stringify(objet, null, 2)}\n`);

export async function construire({ maintenant, reglages, cle, cheminChiffre, cheminDemo, dossierSite, sortie }) {
  verifierSortie({ sortie, dossierSite, cheminChiffre, cheminDemo });
  const calendrier = etatsDesCases(maintenant, reglages);
  const ouvertes = calendrier.cases.filter((c) => c.etat !== 'fermee').map((c) => c.jour);

  // On ne lit que la source utile au mode, et on ne déchiffre que les jours non fermés.
  const sources = { reglages, cle, enveloppes: [], demo: [] };
  if (ouvertes.length > 0) {
    if (reglages.mode === 'accelere') sources.demo = (await lireJson(cheminDemo)).cases;
    else sources.enveloppes = (await lireJson(cheminChiffre)).cases;
  }
  const contenus = new Map(ouvertes.map((jour) => [jour, chargerCase(jour, sources)]));

  await rm(sortie, { recursive: true, force: true });
  const fixtures = resolve(dossierSite, 'fixtures');
  await cp(dossierSite, sortie, { recursive: true, filter: (src) => resolve(src) !== fixtures });
  await mkdir(join(sortie, 'cases'), { recursive: true });

  const jetons = {};
  for (const jour of ouvertes) {
    jetons[String(jour)] = jetonCase(jour, cle);
    await ecrireJson(join(sortie, 'cases', `${jetons[String(jour)]}.json`), contenus.get(jour));
  }
  // Ordre de clés fixe : la sortie ne dépend que de l'entrée.
  const etat = {
    mode: calendrier.mode,
    saison: calendrier.saison,
    aujourdhui: calendrier.aujourdhui,
    fini: calendrier.fini,
    cases: calendrier.cases.map(({ jour, etat: e, ouvertureLe }) => ({ jour, etat: e, ouvertureLe })),
    jetons,
    genereLe: maintenant.toISOString(),
  };
  await ecrireJson(join(sortie, 'etat.json'), etat);
  return { etat, jetons };
}

function lireMaintenant(argv) {
  const i = argv.indexOf('--maintenant');
  if (i === -1) return new Date();
  // Variable définie, même vide : en production seule l'horloge réelle compte.
  if ('CI' in process.env) throw new Error("--maintenant est refusé quand la variable CI est définie : en production, seule l'horloge réelle compte.");
  const date = new Date(argv[i + 1]);
  if (Number.isNaN(date.getTime())) throw new Error('--maintenant invalide : donnez une date ISO 8601 avec fuseau.');
  return date;
}

export function reglagesDepuisEnv(env = process.env) {
  const mode = env.MODE || 'normal';
  if (mode !== 'normal' && mode !== 'accelere') throw new Error('MODE invalide : "normal" ou "accelere".');
  const reglages = { mode, heureOuverture: env.HEURE_OUVERTURE || '07:00' };
  if (env.DEPART_ACCELERE) reglages.departAccelere = env.DEPART_ACCELERE;
  return reglages;
}

async function cli() {
  try {
    const maintenant = lireMaintenant(process.argv.slice(2));
    const resultat = await construire({
      maintenant,
      reglages: reglagesDepuisEnv(),
      cle: lireCle(),
      cheminChiffre: join(RACINE, 'contenu', 'cases.chiffrees.json'),
      cheminDemo: join(RACINE, 'contenu', 'demo.json'),
      dossierSite: join(RACINE, 'site'),
      sortie: join(RACINE, 'dist'),
    });
    const jours = Object.keys(resultat.jetons);
    console.log(`dist/ construit : ${jours.length} case(s) publiée(s)${jours.length ? ` (jours ${jours.join(', ')})` : ''}.`);
  } catch (e) {
    // Message seul : jamais de pile ni d'objet, qui pourraient citer du contenu.
    console.error(`Construction échouée : ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await cli();
