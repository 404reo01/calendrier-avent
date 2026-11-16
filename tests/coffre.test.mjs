// Tests du coffre (P2). Écrits avant le code : le module est absent pour l'instant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac, createDecipheriv } from 'node:crypto';
import { lireCle, chiffrerCase, dechiffrerCase, jetonCase } from '../scripts/lib/coffre.mjs';

const cle = randomBytes(32);
const autreCle = randomBytes(32);
const contenu = {
  jour: 13,
  titre: 'Titre secret 13 : été à Noël',
  skill: { nom: 'skill-13', source: 'test', lien: 'https://exemple.fr/13' },
  accroche: 'Une accroche avec des accents et des emojis 🎄',
  exemple: 'ligne 1\nligne 2',
  essayer: 'Essayez cela',
};

const changerOctet = (b64) => {
  const octets = Buffer.from(b64, 'base64');
  octets[0] ^= 0xff;
  return octets.toString('base64');
};

test("chiffrer puis déchiffrer redonne l'objet d'origine", () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.deepEqual(dechiffrerCase(enveloppe, cle), contenu);
});

test("l'enveloppe contient jour, iv, donnees et tag, en base64 sauf le jour", () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.deepEqual(Object.keys(enveloppe).sort(), ['donnees', 'iv', 'jour', 'tag']);
  assert.equal(enveloppe.jour, 13);
  for (const champ of ['iv', 'donnees', 'tag']) {
    assert.equal(typeof enveloppe[champ], 'string', champ);
    assert.equal(Buffer.from(enveloppe[champ], 'base64').toString('base64'), enveloppe[champ], `${champ} est du base64`);
  }
});

test("l'IV fait 12 octets et le tag 16 octets", () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.equal(Buffer.from(enveloppe.iv, 'base64').length, 12);
  assert.equal(Buffer.from(enveloppe.tag, 'base64').length, 16);
});

test('deux chiffrements du même contenu donnent un IV différent', () => {
  const a = chiffrerCase(13, contenu, cle);
  const b = chiffrerCase(13, contenu, cle);
  assert.notEqual(a.iv, b.iv);
});

test('deux chiffrements du même contenu donnent des données chiffrées différentes', () => {
  const a = chiffrerCase(13, contenu, cle);
  const b = chiffrerCase(13, contenu, cle);
  assert.notEqual(a.donnees, b.donnees);
});

test('les données chiffrées ne contiennent pas le titre en clair', () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  const brut = Buffer.from(enveloppe.donnees, 'base64').toString('latin1');
  assert.ok(!brut.includes('Titre secret 13'));
  assert.ok(!JSON.stringify(enveloppe).includes('Titre secret'));
});

test('le format suit le contrat : AES-256-GCM, AAD « case:<jour> », contenu en JSON', () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  const decipher = createDecipheriv('aes-256-gcm', cle, Buffer.from(enveloppe.iv, 'base64'));
  decipher.setAAD(Buffer.from('case:13'));
  decipher.setAuthTag(Buffer.from(enveloppe.tag, 'base64'));
  const clair = Buffer.concat([decipher.update(Buffer.from(enveloppe.donnees, 'base64')), decipher.final()]);
  assert.deepEqual(JSON.parse(clair.toString('utf8')), contenu);
});

test('une mauvaise clé fait échouer le déchiffrement', () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.throws(() => dechiffrerCase(enveloppe, autreCle), Error);
});

test("un jour modifié dans l'enveloppe fait échouer le déchiffrement", () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.throws(() => dechiffrerCase({ ...enveloppe, jour: 14 }, cle), Error);
});

test("un texte chiffré déplacé d'un jour à un autre fait échouer le déchiffrement", () => {
  const case1 = chiffrerCase(1, { titre: 'un' }, cle);
  const case2 = chiffrerCase(2, { titre: 'deux' }, cle);
  assert.throws(() => dechiffrerCase({ ...case1, jour: 2 }, cle), Error);
  assert.deepEqual(dechiffrerCase(case2, cle), { titre: 'deux' });
});

test('un tag altéré fait échouer le déchiffrement', () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.throws(() => dechiffrerCase({ ...enveloppe, tag: changerOctet(enveloppe.tag) }, cle), Error);
});

test('des données altérées font échouer le déchiffrement', () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  assert.throws(() => dechiffrerCase({ ...enveloppe, donnees: changerOctet(enveloppe.donnees) }, cle), Error);
});

test("le message d'erreur du déchiffrement ne contient ni le contenu ni la clé", () => {
  const enveloppe = chiffrerCase(13, contenu, cle);
  try {
    dechiffrerCase(enveloppe, autreCle);
    assert.fail('le déchiffrement aurait dû échouer');
  } catch (e) {
    assert.ok(!e.message.includes('Titre secret'));
    assert.ok(!e.message.includes(cle.toString('base64')));
    assert.ok(!e.message.includes(autreCle.toString('base64')));
  }
});

test('lireCle renvoie un Buffer de 32 octets égal à la clé encodée en base64', () => {
  const lue = lireCle({ CLE_CALENDRIER: cle.toString('base64') });
  assert.ok(Buffer.isBuffer(lue));
  assert.equal(lue.length, 32);
  assert.ok(lue.equals(cle));
});

test('une clé absente provoque une erreur claire : « CLE_CALENDRIER manquante »', () => {
  assert.throws(() => lireCle({}), (e) => e instanceof Error && /CLE_CALENDRIER manquante/.test(e.message));
});

test('une clé de 16 octets provoque une erreur « CLE_CALENDRIER invalide »', () => {
  const courte = randomBytes(16).toString('base64');
  assert.throws(() => lireCle({ CLE_CALENDRIER: courte }), (e) => e instanceof Error && /CLE_CALENDRIER invalide/.test(e.message));
});

test("le message d'erreur d'une clé invalide ne contient pas la clé", () => {
  const courte = randomBytes(16).toString('base64');
  try {
    lireCle({ CLE_CALENDRIER: courte });
    assert.fail('lireCle aurait dû échouer');
  } catch (e) {
    assert.ok(!e.message.includes(courte));
  }
});

test('jetonCase renvoie 16 caractères hexadécimaux', () => {
  assert.match(jetonCase(13, cle), /^[0-9a-f]{16}$/);
});

test('jetonCase est stable pour un même jour et une même clé', () => {
  assert.equal(jetonCase(13, cle), jetonCase(13, cle));
});

test('jetonCase est différent pour chacun des 24 jours', () => {
  const jetons = new Set();
  for (let j = 1; j <= 24; j++) jetons.add(jetonCase(j, cle));
  assert.equal(jetons.size, 24);
});

test('jetonCase est différent avec une autre clé', () => {
  assert.notEqual(jetonCase(13, cle), jetonCase(13, autreCle));
});

test('jetonCase suit le contrat : HMAC-SHA256(clé, « jeton:<jour> »), 16 premiers caractères hex', () => {
  const attendu = createHmac('sha256', cle).update('jeton:13').digest('hex').slice(0, 16);
  assert.equal(jetonCase(13, cle), attendu);
});
