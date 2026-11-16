// Tests ajoutés après la relecture sécurité de P2 : clé dégénérée, base64 canonique,
// vérification Git en fail-closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lireCle, chiffrerCase, dechiffrerCase } from '../scripts/lib/coffre.mjs';
import { verifierClairHorsGit } from '../scripts/chiffrer.mjs';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Change les bits de remplissage du dernier caractère utile : même octets décodés,
// écriture différente (non canonique).
const rendreNonCanonique = (b64) => {
  const i = b64.replace(/=+$/, '').length - 1;
  const remplace = ALPHABET[ALPHABET.indexOf(b64[i]) ^ 1];
  return b64.slice(0, i) + remplace + b64.slice(i + 1);
};

const cle = randomBytes(32);

test('une clé de 32 octets identiques est refusée : « CLE_CALENDRIER trop faible »', () => {
  const faible = Buffer.alloc(32, 0x41).toString('base64');
  assert.throws(() => lireCle({ CLE_CALENDRIER: faible }), (e) =>
    /CLE_CALENDRIER trop faible : générez-la avec npm run chiffrer -- --generer-cle/.test(e.message) && !e.message.includes(faible));
});

test('une clé faite d\'un motif de 8 octets répété est refusée', () => {
  const motif = Buffer.concat(Array(4).fill(randomBytes(8))).toString('base64');
  assert.throws(() => lireCle({ CLE_CALENDRIER: motif }), /CLE_CALENDRIER trop faible/);
});

test('une clé avec exactement 16 octets distincts est acceptée', () => {
  const octets = Buffer.from([...Array(16).keys(), ...Array(16).keys()]);
  assert.ok(lireCle({ CLE_CALENDRIER: octets.toString('base64') }).equals(octets));
});

test('une clé en base64 non canonique est refusée comme invalide', () => {
  const variante = rendreNonCanonique(cle.toString('base64'));
  assert.ok(Buffer.from(variante, 'base64').equals(cle), 'la variante décode bien vers la même clé');
  assert.throws(() => lireCle({ CLE_CALENDRIER: variante }), /CLE_CALENDRIER invalide/);
});

test('un tag ou des données en base64 non canonique sont refusés', () => {
  const enveloppe = chiffrerCase(5, { titre: 'cinq!' }, cle);
  for (const champ of ['tag', 'donnees']) {
    const variante = rendreNonCanonique(enveloppe[champ]);
    assert.notEqual(variante, enveloppe[champ], `${champ} a du remplissage`);
    assert.throws(() => dechiffrerCase({ ...enveloppe, [champ]: variante }, cle), /base64 canonique/);
  }
});

test('un iv avec un retour à la ligne ou des caractères parasites est refusé', () => {
  const enveloppe = chiffrerCase(5, { titre: 'cinq' }, cle);
  for (const iv of [`${enveloppe.iv}\n`, ` ${enveloppe.iv}`, enveloppe.iv.replace(/^./, '*')]) {
    assert.throws(() => dechiffrerCase({ ...enveloppe, iv }, cle), /base64 canonique/);
  }
});

// Petit dépôt Git jetable pour la vérification « le clair n'est pas suivi ».
function depotJetable(gitignore) {
  const racine = mkdtempSync(join(tmpdir(), 'coffre-git-'));
  execFileSync('git', ['init', '-q'], { cwd: racine });
  mkdirSync(join(racine, 'contenu'));
  writeFileSync(join(racine, 'contenu', 'cases.json'), '{}');
  if (gitignore !== null) writeFileSync(join(racine, '.gitignore'), gitignore);
  return { racine, clair: join(racine, 'contenu', 'cases.json') };
}

test('verifierClairHorsGit accepte un clair ignoré par la liste blanche contenu/*', (t) => {
  const { racine, clair } = depotJetable('contenu/*\n!contenu/cases.chiffrees.json\n');
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  assert.doesNotThrow(() => verifierClairHorsGit(clair, racine));
});

test('verifierClairHorsGit refuse un clair suivi par Git', (t) => {
  const { racine, clair } = depotJetable('contenu/*\n');
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  execFileSync('git', ['add', '-f', 'contenu/cases.json'], { cwd: racine });
  assert.throws(() => verifierClairHorsGit(clair, racine), /est suivi par Git/);
});

test('verifierClairHorsGit refuse un clair non ignoré', (t) => {
  const { racine, clair } = depotJetable(null);
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  assert.throws(() => verifierClairHorsGit(clair, racine), /n'est pas ignoré/);
});

test('verifierClairHorsGit refuse hors d\'un dépôt Git (fail-closed)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'coffre-sans-git-'));
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  // Le dossier temporaire n'est dans aucun dépôt : Git répond 128, ce qui doit être un refus.
  assert.throws(() => verifierClairHorsGit(join(racine, 'cases.json'), racine), /chiffrement refusé/);
});
