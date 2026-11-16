// Vérification de fuite : échoue si le texte (ou l'adresse) d'une case interdite
// se trouve dans dist/. N'affiche que des numéros de jour et des noms de fichier.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { etatsDesCases } from './lib/calendrier.mjs';
import { dechiffrerCase, jetonCase, lireCle } from './lib/coffre.mjs';
import { reglagesDepuisEnv } from './construire.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
// Un avis très court (« top ») apparaîtrait partout par hasard : seuil de signification.
const AVIS_MIN = 12;

async function listerFichiers(dossier) {
  const fichiers = [];
  async function parcourir(courant, prefixe) {
    for (const entree of await readdir(courant, { withFileTypes: true })) {
      const rel = prefixe ? `${prefixe}/${entree.name}` : entree.name;
      if (entree.isDirectory()) await parcourir(join(courant, entree.name), rel);
      else fichiers.push(rel);
    }
  }
  await parcourir(dossier, '');
  return fichiers.sort();
}

function textesDe(c) {
  const textes = [c.titre, c.accroche, c.exemple, c.essayer].filter((t) => typeof t === 'string' && t !== '');
  if (typeof c.avis === 'string' && c.avis.length >= AVIS_MIN) textes.push(c.avis);
  return textes;
}

export async function verifierFuite({ sortie, casesInterdites, cle }) {
  const fichiers = await listerFichiers(sortie);
  const fuites = new Map(); // une fuite par couple (fichier, jour)
  const noter = (fichier, jour) => fuites.set(`${fichier}\0${jour}`, { fichier, jour });

  for (const fichier of fichiers) {
    const contenu = await readFile(join(sortie, ...fichier.split('/')), 'utf8');
    for (const c of casesInterdites) {
      if (textesDe(c).some((t) => contenu.includes(t))) noter(fichier, c.jour);
    }
  }
  if (cle) {
    for (const c of casesInterdites) {
      const chemin = `cases/${jetonCase(c.jour, cle)}.json`;
      if (fichiers.includes(chemin)) noter(chemin, c.jour);
    }
  }
  return [...fuites.values()].sort((a, b) => (a.fichier < b.fichier ? -1 : a.fichier > b.fichier ? 1 : a.jour - b.jour));
}

const lireJson = async (chemin) => JSON.parse(await readFile(chemin, 'utf8'));

// Cases interdites : on déchiffre en mémoire les vraies cases non dues (en accéléré,
// toutes : seule la démo a le droit d'être publiée), et on ajoute la démo non due.
async function casesInterditesPourCli({ maintenant, reglages, cle }) {
  const etat = etatsDesCases(maintenant, reglages);
  const fermees = new Set(etat.cases.filter((c) => c.etat === 'fermee').map((c) => c.jour));
  const accelere = reglages.mode === 'accelere';
  const interdites = [];
  const enveloppes = (await lireJson(join(RACINE, 'contenu', 'cases.chiffrees.json'))).cases;
  for (const e of enveloppes) {
    if (accelere || fermees.has(e.jour)) interdites.push(dechiffrerCase(e, cle));
  }
  if (accelere) {
    const demo = (await lireJson(join(RACINE, 'contenu', 'demo.json'))).cases;
    interdites.push(...demo.filter((c) => fermees.has(c.jour)));
  }
  return interdites;
}

async function cli() {
  try {
    const argv = process.argv.slice(2);
    const i = argv.indexOf('--maintenant');
    if (i !== -1 && 'CI' in process.env) throw new Error('--maintenant est refusé quand la variable CI est définie.');
    const maintenant = i === -1 ? new Date() : new Date(argv[i + 1]);
    if (Number.isNaN(maintenant.getTime())) throw new Error('--maintenant invalide : donnez une date ISO 8601 avec fuseau.');
    const cle = lireCle();
    const interdites = await casesInterditesPourCli({ maintenant, reglages: reglagesDepuisEnv(), cle });
    const fuites = await verifierFuite({ sortie: join(RACINE, 'dist'), casesInterdites: interdites, cle });
    if (fuites.length === 0) {
      console.log(`Aucune fuite : ${interdites.length} case(s) interdite(s) recherchée(s) dans dist/.`);
      return;
    }
    for (const f of fuites) console.error(`FUITE : case ${f.jour} dans ${f.fichier}`);
    process.exitCode = 1;
  } catch (e) {
    console.error(`Vérification échouée : ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await cli();
