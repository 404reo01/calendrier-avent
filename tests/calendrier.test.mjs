// Tests du moteur de calendrier (P1). Écrits avant le code : le module est absent pour l'instant.
// Aucune lecture de l'horloge réelle : toutes les dates sont fixées dans les tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etatsDesCases, saisonDe } from '../scripts/lib/calendrier.mjs';

const NORMAL = { mode: 'normal', heureOuverture: '07:00' };
const DEPART = '2026-11-16T20:30:00+01:00';
const ACCELERE = { mode: 'accelere', heureOuverture: '07:00', departAccelere: DEPART };
const MIN = 60 * 1000;
const HEURE = 60 * MIN;

const paris = (iso) => new Date(iso);
// Ouverture attendue de la case j : j décembre 2026 à 07:00 Paris (UTC+1 en hiver) = 06:00Z.
const ouvertureNormale = (j) => new Date(Date.UTC(2026, 11, j, 6, 0, 0));
const parJour = (etat, j) => etat.cases.find((c) => c.jour === j);

test('1er décembre 07:00 à Paris vaut 06:00 UTC : la case 1 est due à cet instant', () => {
  const etat = etatsDesCases(new Date('2026-12-01T06:00:00Z'), NORMAL);
  assert.equal(parJour(etat, 1).etat, 'du-jour');
});

test('une milliseconde avant 07:00 Paris le 1er décembre, la case 1 reste fermée', () => {
  const etat = etatsDesCases(new Date('2026-12-01T05:59:59.999Z'), NORMAL);
  assert.equal(parJour(etat, 1).etat, 'fermee');
});

test("le 30 novembre à 23:59 (Paris), aucune case n'est due", () => {
  const etat = etatsDesCases(paris('2026-11-30T23:59:00+01:00'), NORMAL);
  assert.equal(etat.cases.length, 24);
  assert.ok(etat.cases.every((c) => c.etat === 'fermee'));
  assert.equal(etat.aujourdhui, null);
  assert.equal(etat.fini, false);
});

test("le 1er décembre à l'heure d'ouverture, la case 1 est « du-jour » et aujourdhui vaut 1", () => {
  const etat = etatsDesCases(paris('2026-12-01T07:00:00+01:00'), NORMAL);
  assert.equal(parJour(etat, 1).etat, 'du-jour');
  assert.equal(etat.aujourdhui, 1);
  assert.ok(etat.cases.filter((c) => c.jour > 1).every((c) => c.etat === 'fermee'));
});

test('le 12 décembre à midi, les cases 1 à 11 sont ouvertes', () => {
  const etat = etatsDesCases(paris('2026-12-12T12:00:00+01:00'), NORMAL);
  for (let j = 1; j <= 11; j++) assert.equal(parJour(etat, j).etat, 'ouverte', `case ${j}`);
});

test('le 12 décembre à midi, la case 12 est « du-jour »', () => {
  const etat = etatsDesCases(paris('2026-12-12T12:00:00+01:00'), NORMAL);
  assert.equal(parJour(etat, 12).etat, 'du-jour');
  assert.equal(etat.aujourdhui, 12);
});

test('la case 13 reste fermée le 12 décembre, ainsi que les cases 14 à 24', () => {
  const etat = etatsDesCases(paris('2026-12-12T12:00:00+01:00'), NORMAL);
  for (let j = 13; j <= 24; j++) assert.equal(parJour(etat, j).etat, 'fermee', `case ${j}`);
});

test("l'état contient les 24 cases numérotées de 1 à 24 dans l'ordre", () => {
  const etat = etatsDesCases(paris('2026-12-12T12:00:00+01:00'), NORMAL);
  assert.deepEqual(etat.cases.map((c) => c.jour), Array.from({ length: 24 }, (_, i) => i + 1));
});

test("l'état rappelle le mode et la saison", () => {
  const etat = etatsDesCases(paris('2026-12-12T12:00:00+01:00'), NORMAL);
  assert.equal(etat.mode, 'normal');
  assert.equal(etat.saison, 2026);
});

test('chaque case, même fermée, porte ouvertureLe en ISO UTC', () => {
  const etat = etatsDesCases(paris('2026-12-12T12:00:00+01:00'), NORMAL);
  for (const c of etat.cases) {
    assert.equal(typeof c.ouvertureLe, 'string', `case ${c.jour}`);
    assert.equal(c.ouvertureLe, ouvertureNormale(c.jour).toISOString(), `case ${c.jour}`);
  }
});

test("une heure d'ouverture personnalisée (08:30 Paris) place l'ouverture de la case 1 à 07:30 UTC", () => {
  const reglages = { mode: 'normal', heureOuverture: '08:30' };
  assert.equal(parJour(etatsDesCases(new Date('2026-12-01T07:29:59.999Z'), reglages), 1).etat, 'fermee');
  assert.equal(parJour(etatsDesCases(new Date('2026-12-01T07:30:00Z'), reglages), 1).etat, 'du-jour');
});

test("sans heureOuverture, l'ouverture par défaut est 07:00 Paris", () => {
  const reglages = { mode: 'normal' };
  assert.equal(parJour(etatsDesCases(new Date('2026-12-01T05:59:59.999Z'), reglages), 1).etat, 'fermee');
  assert.equal(parJour(etatsDesCases(new Date('2026-12-01T06:00:00Z'), reglages), 1).etat, 'du-jour');
});

test("la saison est l'année en cours en décembre", () => {
  assert.equal(saisonDe(paris('2026-12-12T12:00:00+01:00')), 2026);
});

test("de mars à novembre, la saison est l'année en cours (le décembre à venir)", () => {
  assert.equal(saisonDe(paris('2026-03-01T12:00:00+01:00')), 2026);
  assert.equal(saisonDe(paris('2026-11-16T12:00:00+01:00')), 2026);
});

test("en accéléré, la saison vaut saisonDe(maintenant)", () => {
  const maintenant = new Date(new Date(DEPART).getTime() + 12 * MIN);
  assert.equal(etatsDesCases(maintenant, ACCELERE).saison, saisonDe(maintenant));
});

test("en janvier, la saison est l'année précédente", () => {
  assert.equal(saisonDe(paris('2027-01-15T12:00:00+01:00')), 2026);
});

test("en février, la saison est l'année précédente", () => {
  assert.equal(saisonDe(paris('2027-02-28T23:00:00+01:00')), 2026);
});

test('le 1er janvier à 00:30 Paris (31 décembre 23:30 UTC), la saison est celle qui vient de finir', () => {
  assert.equal(saisonDe(new Date('2026-12-31T23:30:00Z')), 2026);
});

test("en janvier, l'état est celui de la saison passée : fini et toutes les cases ouvertes", () => {
  const etat = etatsDesCases(paris('2027-01-15T12:00:00+01:00'), NORMAL);
  assert.equal(etat.saison, 2026);
  assert.equal(etat.fini, true);
  assert.ok(etat.cases.every((c) => c.etat === 'ouverte'));
});

test('au plus une case est « du-jour », à tout instant échantillonné', () => {
  const instants = [
    '2026-11-30T23:59:00+01:00', '2026-12-01T07:00:00+01:00', '2026-12-05T06:59:59+01:00',
    '2026-12-12T12:00:00+01:00', '2026-12-24T07:00:00+01:00', '2026-12-24T23:59:59+01:00',
    '2026-12-25T00:00:00+01:00',
  ];
  for (const iso of instants) {
    const etat = etatsDesCases(paris(iso), NORMAL);
    assert.ok(etat.cases.filter((c) => c.etat === 'du-jour').length <= 1, iso);
  }
});

test("aujourdhui vaut le numéro de la case « du-jour », ou null s'il n'y en a pas", () => {
  for (const iso of ['2026-11-30T12:00:00+01:00', '2026-12-12T12:00:00+01:00', '2026-12-30T12:00:00+01:00']) {
    const etat = etatsDesCases(paris(iso), NORMAL);
    const duJour = etat.cases.find((c) => c.etat === 'du-jour');
    assert.equal(etat.aujourdhui, duJour ? duJour.jour : null, iso);
  }
});

test("la case 24 est « du-jour » le 24 décembre jusqu'à la fin de la journée à Paris", () => {
  const etat = etatsDesCases(paris('2026-12-24T23:59:59+01:00'), NORMAL);
  assert.equal(parJour(etat, 24).etat, 'du-jour');
  assert.equal(etat.fini, false);
});

test("23 h 59 après l'ouverture de la case 12, la 12 est encore la case du jour (la 13 n'est pas ouverte)", () => {
  const etat = etatsDesCases(new Date(ouvertureNormale(12).getTime() + 24 * HEURE - 1), NORMAL);
  assert.equal(etat.aujourdhui, 12);
});

test("24 h après l'ouverture de la case 12, la case 13 devient la case du jour et la 12 passe à ouverte", () => {
  const etat = etatsDesCases(new Date(ouvertureNormale(12).getTime() + 24 * HEURE), NORMAL);
  assert.equal(parJour(etat, 12).etat, 'ouverte');
  assert.equal(parJour(etat, 13).etat, 'du-jour');
});

test('le 25 décembre à 00:00 Paris, le calendrier est fini', () => {
  const etat = etatsDesCases(paris('2026-12-25T00:00:00+01:00'), NORMAL);
  assert.equal(etat.fini, true);
});

test("une milliseconde avant le 25 décembre 00:00 Paris, le calendrier n'est pas fini", () => {
  const etat = etatsDesCases(new Date(paris('2026-12-25T00:00:00+01:00').getTime() - 1), NORMAL);
  assert.equal(etat.fini, false);
});

test('une fois fini, toutes les cases sont ouvertes et aujourdhui est null', () => {
  const etat = etatsDesCases(paris('2026-12-26T10:00:00+01:00'), NORMAL);
  assert.ok(etat.cases.every((c) => c.etat === 'ouverte'));
  assert.equal(etat.aujourdhui, null);
  assert.equal(etat.cases.length, 24);
});

test('accéléré : à départ + 12 min, les cases 1 et 2 sont ouvertes et la 3 est « du-jour »', () => {
  const etat = etatsDesCases(new Date(new Date(DEPART).getTime() + 12 * MIN), ACCELERE);
  assert.equal(etat.mode, 'accelere');
  assert.equal(parJour(etat, 1).etat, 'ouverte');
  assert.equal(parJour(etat, 2).etat, 'ouverte');
  assert.equal(parJour(etat, 3).etat, 'du-jour');
  assert.equal(etat.aujourdhui, 3);
});

test('accéléré : à départ + 12 min, les cases 4 à 24 sont fermées', () => {
  const etat = etatsDesCases(new Date(new Date(DEPART).getTime() + 12 * MIN), ACCELERE);
  for (let j = 4; j <= 24; j++) assert.equal(parJour(etat, j).etat, 'fermee', `case ${j}`);
});

test("accéléré : une case s'ouvre toutes les 5 minutes, pile à l'heure", () => {
  const depart = new Date(DEPART).getTime();
  for (let j = 1; j <= 24; j++) {
    const ouverture = depart + (j - 1) * 5 * MIN;
    assert.equal(parJour(etatsDesCases(new Date(ouverture - 1), ACCELERE), j).etat, 'fermee', `case ${j} avant`);
    if (j < 24) {
      assert.notEqual(parJour(etatsDesCases(new Date(ouverture), ACCELERE), j).etat, 'fermee', `case ${j} à l'heure`);
    }
  }
});

test('accéléré : ouvertureLe de la case j vaut départ + (j-1) × 5 min', () => {
  const depart = new Date(DEPART).getTime();
  const etat = etatsDesCases(new Date(depart + 12 * MIN), ACCELERE);
  for (const c of etat.cases) {
    assert.equal(c.ouvertureLe, new Date(depart + (c.jour - 1) * 5 * MIN).toISOString());
  }
});

test("accéléré : une case reste « du-jour » jusqu'à l'ouverture de la suivante", () => {
  const etat = etatsDesCases(new Date(new Date(DEPART).getTime() + 5 * MIN - 1), ACCELERE);
  assert.equal(etat.aujourdhui, 1);
});

test("accéléré : avant le départ, aucune case n'est due", () => {
  const etat = etatsDesCases(new Date(new Date(DEPART).getTime() - 1), ACCELERE);
  assert.ok(etat.cases.every((c) => c.etat === 'fermee'));
  assert.equal(etat.aujourdhui, null);
  assert.equal(etat.fini, false);
});

test('accéléré : au départ exact, la case 1 est due', () => {
  const etat = etatsDesCases(new Date(DEPART), ACCELERE);
  assert.equal(parJour(etat, 1).etat, 'du-jour');
});

test('accéléré : fini à départ + 24 × 5 min, avec toutes les cases ouvertes', () => {
  const depart = new Date(DEPART).getTime();
  const avant = etatsDesCases(new Date(depart + 24 * 5 * MIN - 1), ACCELERE);
  assert.equal(avant.fini, false);
  const apres = etatsDesCases(new Date(depart + 24 * 5 * MIN), ACCELERE);
  assert.equal(apres.fini, true);
  assert.ok(apres.cases.every((c) => c.etat === 'ouverte'));
  assert.equal(apres.aujourdhui, null);
});

test('accéléré sans departAccelere : erreur qui nomme DEPART_ACCELERE', () => {
  assert.throws(
    () => etatsDesCases(new Date('2026-11-16T21:00:00+01:00'), { mode: 'accelere', heureOuverture: '07:00' }),
    (e) => e instanceof Error && /DEPART_ACCELERE/.test(e.message),
  );
});

test('accéléré avec un departAccelere invalide : erreur qui nomme DEPART_ACCELERE', () => {
  assert.throws(
    () => etatsDesCases(new Date('2026-11-16T21:00:00+01:00'), { mode: 'accelere', departAccelere: 'pas une date' }),
    (e) => e instanceof Error && /DEPART_ACCELERE/.test(e.message),
  );
});

test('pureté : les mêmes entrées donnent des sorties identiques', () => {
  const maintenant = paris('2026-12-12T12:00:00+01:00');
  assert.deepEqual(etatsDesCases(maintenant, NORMAL), etatsDesCases(new Date(maintenant), { ...NORMAL }));
});

test('pureté : le calcul ne modifie ni la date ni les réglages reçus', () => {
  const maintenant = paris('2026-12-12T12:00:00+01:00');
  const instant = maintenant.getTime();
  const reglages = Object.freeze({ ...ACCELERE });
  etatsDesCases(maintenant, NORMAL);
  etatsDesCases(maintenant, reglages);
  assert.equal(maintenant.getTime(), instant);
  assert.deepEqual(reglages, ACCELERE);
});

test("aucune case n'est due avant sa date : pour chaque jour 1 à 24, fermée 1 ms avant, due à l'heure", () => {
  for (let j = 1; j <= 24; j++) {
    const ouverture = ouvertureNormale(j).getTime();
    const avant = etatsDesCases(new Date(ouverture - 1), NORMAL);
    assert.equal(parJour(avant, j).etat, 'fermee', `case ${j} 1 ms avant`);
    const alheure = etatsDesCases(new Date(ouverture), NORMAL);
    assert.notEqual(parJour(alheure, j).etat, 'fermee', `case ${j} à l'heure`);
    assert.equal(alheure.cases.filter((c) => c.etat !== 'fermee').length, j, `nombre de cases dues le ${j}`);
  }
});
