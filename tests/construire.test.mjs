// Tests de la construction de dist/ et de la vérification de fuite (P3).
// Écrits avant le code : les modules sont absents pour l'instant.
// Tout se passe dans un dossier temporaire avec de faux contenus et une clé aléatoire.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { construire } from '../scripts/construire.mjs';
import { verifierFuite } from '../scripts/verifier-fuite.mjs';
import { chiffrerCase, jetonCase } from '../scripts/lib/coffre.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const NORMAL = { mode: 'normal', heureOuverture: '07:00' };
const DEPART = '2026-11-16T20:30:00+01:00';
const ACCELERE = { mode: 'accelere', heureOuverture: '07:00', departAccelere: DEPART };
const DOUZE_DEC = new Date('2026-12-12T12:00:00+01:00');

const cle = randomBytes(32);
let racine;
let compteur = 0;
let vraiesCases;
let casesDemo;
let cheminChiffre;
let cheminDemo;
let dossierSite;

const fabriquerCase = (jour, prefixe) => ({
  jour,
  titre: `${prefixe} ${jour}`,
  skill: { nom: `skill-${prefixe}-${jour}`, source: 'test', lien: 'https://exemple.fr/' },
  accroche: `Accroche ${prefixe} numéro ${jour} pour les tests`,
  exemple: `Exemple ${prefixe} numéro ${jour} pour les tests`,
  essayer: `Essayer ${prefixe} numéro ${jour} pour les tests`,
  ...(jour === 13 ? { avis: `Avis ${prefixe} assez long du jour ${jour}` } : {}),
});

const sortieNeuve = () => join(racine, `sortie-${++compteur}`);

async function lister(dossier) {
  const fichiers = [];
  async function parcourir(courant) {
    for (const entree of await readdir(courant, { withFileTypes: true })) {
      const chemin = join(courant, entree.name);
      if (entree.isDirectory()) await parcourir(chemin);
      else fichiers.push(relative(dossier, chemin).split('\\').join('/'));
    }
  }
  await parcourir(dossier);
  return fichiers.sort();
}

async function listerCases(sortie) {
  try {
    return (await readdir(join(sortie, 'cases'))).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

const existe = (chemin) => stat(chemin).then(() => true, () => false);

async function toutLeTexte(sortie) {
  const parts = [];
  for (const f of await lister(sortie)) parts.push(await readFile(join(sortie, f), 'utf8'));
  return parts.join('\n');
}

const construireDans = (sortie, maintenant, reglages, options = {}) =>
  construire({ maintenant, reglages, cle, cheminChiffre, cheminDemo, dossierSite, sortie, ...options });

before(async () => {
  racine = await mkdtemp(join(tmpdir(), 'calendrier-test-'));
  vraiesCases = Array.from({ length: 24 }, (_, i) => fabriquerCase(i + 1, 'Titre secret'));
  casesDemo = Array.from({ length: 24 }, (_, i) => fabriquerCase(i + 1, 'Titre démo'));

  cheminChiffre = join(racine, 'cases.chiffrees.json');
  await writeFile(cheminChiffre, JSON.stringify({
    version: 1,
    cases: vraiesCases.map((c) => chiffrerCase(c.jour, c, cle)),
  }));

  cheminDemo = join(racine, 'demo.json');
  await writeFile(cheminDemo, JSON.stringify({ cases: casesDemo }));

  dossierSite = join(racine, 'site');
  await mkdir(join(dossierSite, 'fixtures'), { recursive: true });
  await writeFile(join(dossierSite, 'index.html'), '<!doctype html><title>Calendrier</title>');
  await writeFile(join(dossierSite, 'fixtures', 'exemple.json'), '{"fixture":true}');
});

after(async () => {
  await rm(racine, { recursive: true, force: true });
});

test('le 12 décembre à midi (Paris), dist/cases contient exactement 12 fichiers', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.equal((await listerCases(sortie)).length, 12);
});

test('les fichiers de cases sont nommés par les jetons des jours 1 à 12', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const attendus = Array.from({ length: 12 }, (_, i) => `${jetonCase(i + 1, cle)}.json`).sort();
  assert.deepEqual(await listerCases(sortie), attendus);
});

test('chaque fichier de case contient la case déchiffrée du bon jour', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  for (let j = 1; j <= 12; j++) {
    const contenu = JSON.parse(await readFile(join(sortie, 'cases', `${jetonCase(j, cle)}.json`), 'utf8'));
    assert.deepEqual(contenu, vraiesCases[j - 1], `case ${j}`);
  }
});

test('etat.json ne contient aucun titre de case', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const brut = await readFile(join(sortie, 'etat.json'), 'utf8');
  assert.ok(!/Titre secret/.test(brut));
  assert.ok(!/Titre démo/.test(brut));
});

test("etat.json décrit l'état, les jetons et la date de génération", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const etat = JSON.parse(await readFile(join(sortie, 'etat.json'), 'utf8'));
  assert.equal(etat.mode, 'normal');
  assert.equal(etat.aujourdhui, 12);
  assert.equal(etat.cases.length, 24);
  assert.equal(etat.genereLe, DOUZE_DEC.toISOString());
});

test('etat.json ne donne un jeton que pour les cases non fermées (jours 1 à 12)', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const etat = JSON.parse(await readFile(join(sortie, 'etat.json'), 'utf8'));
  assert.deepEqual(Object.keys(etat.jetons).map(Number).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
  for (let j = 1; j <= 12; j++) assert.equal(etat.jetons[String(j)], jetonCase(j, cle));
});

test('construire renvoie { etat, jetons } cohérents avec etat.json', async () => {
  const sortie = sortieNeuve();
  const resultat = await construireDans(sortie, DOUZE_DEC, NORMAL);
  const etat = JSON.parse(await readFile(join(sortie, 'etat.json'), 'utf8'));
  assert.deepEqual(resultat.jetons, etat.jetons);
  assert.equal(resultat.etat.aujourdhui, 12);
});

test('aucun fichier de dist/ ne contient le titre de la case 13', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.ok(!(await toutLeTexte(sortie)).includes('Titre secret 13'));
});

test("aucun texte d'une case fermée (13 à 24) n'apparaît dans dist/", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const texte = await toutLeTexte(sortie);
  for (let j = 13; j <= 24; j++) {
    const c = vraiesCases[j - 1];
    for (const champ of ['titre', 'accroche', 'exemple', 'essayer']) assert.ok(!texte.includes(c[champ]), `case ${j} ${champ}`);
  }
});

test("cases/24.json n'existe pas, ni le fichier du jeton de la case 24", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.equal(await existe(join(sortie, 'cases', '24.json')), false);
  assert.equal(await existe(join(sortie, 'cases', `${jetonCase(24, cle)}.json`)), false);
});

test("aucun fichier de case n'est nommé d'après un numéro de jour", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  for (const nom of await listerCases(sortie)) assert.match(nom, /^[0-9a-f]{16}\.json$/);
});

test("une case fermée n'est jamais déchiffrée : une enveloppe corrompue pour la case 20 ne gêne pas le 12 décembre", async () => {
  const corrompu = join(racine, 'chiffre-corrompu.json');
  const cases = vraiesCases.map((c) => chiffrerCase(c.jour, c, cle));
  cases[19] = { ...cases[19], tag: Buffer.alloc(16).toString('base64') };
  await writeFile(corrompu, JSON.stringify({ version: 1, cases }));
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL, { cheminChiffre: corrompu });
  assert.equal((await listerCases(sortie)).length, 12);
});

test('deux constructions avec la même date donnent des fichiers identiques à l\'octet près', async () => {
  const a = sortieNeuve();
  const b = sortieNeuve();
  await construireDans(a, DOUZE_DEC, NORMAL);
  await construireDans(b, DOUZE_DEC, NORMAL);
  const fichiersA = await lister(a);
  assert.deepEqual(fichiersA, await lister(b));
  for (const f of fichiersA) {
    assert.ok((await readFile(join(a, f))).equals(await readFile(join(b, f))), f);
  }
});

test('reconstruire dans le même dossier donne le même résultat', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const avant = await readFile(join(sortie, 'etat.json'));
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.ok(avant.equals(await readFile(join(sortie, 'etat.json'))));
});

test('construire vide la sortie avant de la remplir', async () => {
  const sortie = sortieNeuve();
  await mkdir(join(sortie, 'cases'), { recursive: true });
  await writeFile(join(sortie, 'reste-ancien.txt'), 'ancien');
  await writeFile(join(sortie, 'cases', 'ancienne-case.json'), '{}');
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.equal(await existe(join(sortie, 'reste-ancien.txt')), false);
  assert.equal(await existe(join(sortie, 'cases', 'ancienne-case.json')), false);
});

test('le contenu du dossier du site est copié dans la sortie', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.equal(await readFile(join(sortie, 'index.html'), 'utf8'), '<!doctype html><title>Calendrier</title>');
});

test('site/fixtures n\'est pas copié dans la sortie', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  assert.equal(await existe(join(sortie, 'fixtures')), false);
});

test('le 30 novembre, aucune case n\'est écrite et etat.json ne liste aucun jeton', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, new Date('2026-11-30T23:59:00+01:00'), NORMAL);
  assert.deepEqual(await listerCases(sortie), []);
  const etat = JSON.parse(await readFile(join(sortie, 'etat.json'), 'utf8'));
  assert.deepEqual(etat.jetons, {});
});

test('après le 25 décembre, les 24 cases sont publiées (relisibles)', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, new Date('2026-12-26T10:00:00+01:00'), NORMAL);
  assert.equal((await listerCases(sortie)).length, 24);
  const etat = JSON.parse(await readFile(join(sortie, 'etat.json'), 'utf8'));
  assert.equal(etat.fini, true);
});

test('mode accéléré : les cases viennent de demo.json, 3 cases à départ + 12 min', async () => {
  const sortie = sortieNeuve();
  const maintenant = new Date(new Date(DEPART).getTime() + 12 * 60 * 1000);
  await construireDans(sortie, maintenant, ACCELERE);
  assert.equal((await listerCases(sortie)).length, 3);
  for (let j = 1; j <= 3; j++) {
    const contenu = JSON.parse(await readFile(join(sortie, 'cases', `${jetonCase(j, cle)}.json`), 'utf8'));
    assert.deepEqual(contenu, casesDemo[j - 1], `case démo ${j}`);
  }
});

test('mode accéléré : aucun titre réel dans la sortie', async () => {
  const sortie = sortieNeuve();
  const maintenant = new Date(new Date(DEPART).getTime() + 12 * 60 * 1000);
  await construireDans(sortie, maintenant, ACCELERE);
  assert.ok(!/Titre secret/.test(await toutLeTexte(sortie)));
});

test('mode accéléré : etat.json indique le mode accelere', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, new Date(new Date(DEPART).getTime() + 12 * 60 * 1000), ACCELERE);
  const etat = JSON.parse(await readFile(join(sortie, 'etat.json'), 'utf8'));
  assert.equal(etat.mode, 'accelere');
});

test('la CLI refuse --maintenant quand la variable CI est définie (code de sortie 1)', () => {
  const resultat = spawnSync(
    process.execPath,
    ['scripts/construire.mjs', '--maintenant', '2026-12-12T12:00:00+01:00'],
    {
      cwd: RACINE,
      encoding: 'utf8',
      // Une clé valide est fournie pour que le refus vienne bien de CI et non d'une clé absente.
      env: { ...process.env, CI: 'true', CLE_CALENDRIER: cle.toString('base64') },
    },
  );
  assert.equal(resultat.status, 1);
});

test('verifierFuite renvoie une liste vide sur une sortie propre', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  const interdites = vraiesCases.filter((c) => c.jour >= 13);
  assert.deepEqual(await verifierFuite({ sortie, casesInterdites: interdites }), []);
});

test('verifierFuite signale une fuite si le titre de la case 13 est écrit dans un fichier', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  await writeFile(join(sortie, 'note.txt'), `Voici ${vraiesCases[12].titre} en clair`);
  const fuites = await verifierFuite({ sortie, casesInterdites: vraiesCases.filter((c) => c.jour >= 13) });
  assert.equal(fuites.length, 1);
  assert.equal(fuites[0].jour, 13);
  assert.ok(String(fuites[0].fichier).includes('note.txt'));
});

test("verifierFuite signale aussi une fuite du texte d'accroche, d'exemple ou d'essai", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  await writeFile(join(sortie, 'a.txt'), vraiesCases[14].accroche);
  await writeFile(join(sortie, 'b.txt'), vraiesCases[15].exemple);
  await writeFile(join(sortie, 'c.txt'), vraiesCases[16].essayer);
  const fuites = await verifierFuite({ sortie, casesInterdites: vraiesCases.filter((c) => c.jour >= 13) });
  assert.deepEqual(fuites.map((f) => f.jour).sort((x, y) => x - y), [15, 16, 17]);
});

test("verifierFuite signale l'avis d'une case interdite quand il fait au moins 12 caractères", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  await writeFile(join(sortie, 'avis.txt'), vraiesCases[12].avis);
  const fuites = await verifierFuite({ sortie, casesInterdites: [vraiesCases[12]] });
  assert.equal(fuites.length, 1);
  assert.equal(fuites[0].jour, 13);
});

test("verifierFuite ignore un avis de moins de 12 caractères (trop court pour être significatif)", async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  await writeFile(join(sortie, 'court.txt'), 'bref avis');
  const interdite = { ...vraiesCases[12], avis: 'bref avis' };
  assert.deepEqual(await verifierFuite({ sortie, casesInterdites: [interdite] }), []);
});

test('verifierFuite ne signale pas les cases déjà publiées (autorisées)', async () => {
  const sortie = sortieNeuve();
  await construireDans(sortie, DOUZE_DEC, NORMAL);
  // La case 5 est légitimement présente dans dist/ ; elle n'est pas dans la liste des cases interdites.
  const interdites = vraiesCases.filter((c) => c.jour >= 13);
  assert.deepEqual(await verifierFuite({ sortie, casesInterdites: interdites }), []);
  assert.ok((await toutLeTexte(sortie)).includes(vraiesCases[4].titre));
});
