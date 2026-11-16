// Moteur de calendrier : fonction pure, sans horloge, sans fichier, sans environnement.
// Tout est calculé à partir de `maintenant` et des réglages reçus.

const FUSEAU = 'Europe/Paris';
const NB_CASES = 24;
const MINUTE = 60 * 1000;
const PAS_ACCELERE = 5 * MINUTE;
const HEURE_PAR_DEFAUT = '07:00';

// Le formateur ne dépend que du fuseau demandé, jamais de celui de la machine :
// c'est ce qui rend les résultats identiques partout (TZ=Asia/Tokyo comprise).
const FORMATEUR_PARIS = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU,
  hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

// Heure murale à Paris d'un instant, sous forme d'objet de nombres.
function partiesParis(instant) {
  const parties = {};
  for (const { type, value } of FORMATEUR_PARIS.formatToParts(instant)) {
    if (type !== 'literal') parties[type] = Number(value);
  }
  return parties;
}

// Décalage de Paris par rapport à UTC (en ms) à un instant donné : +1 h l'hiver,
// +2 h l'été. On le lit sur l'instant réel plutôt que de le fixer en dur.
function decalageParis(instant) {
  const p = partiesParis(instant);
  const murEnUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // On ignore les millisecondes : le formateur les tronque.
  return murEnUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Instant UTC correspondant à « jour/mois/année HH:MM à Paris ».
// On part de l'heure murale prise pour de l'UTC, puis on corrige avec le décalage
// de Paris ; une seconde passe règle le cas où le premier essai tombe de l'autre
// côté d'un changement d'heure.
function instantParis(annee, mois, jour, heure, minute) {
  const naif = Date.UTC(annee, mois - 1, jour, heure, minute);
  const premier = naif - decalageParis(new Date(naif));
  return new Date(naif - decalageParis(new Date(premier)));
}

function lireHeure(texte) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texte ?? HEURE_PAR_DEFAUT);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    throw new Error(`HEURE_OUVERTURE invalide ("${texte}") : utilisez le format HH:MM, par exemple 07:00`);
  }
  return { heure: Number(m[1]), minute: Number(m[2]) };
}

// Janvier et février appartiennent encore à la saison qui vient de finir,
// pour que le calendrier passé reste affiché « fini » au lieu de se refermer.
export function saisonDe(maintenant) {
  const { year, month } = partiesParis(maintenant);
  return month <= 2 ? year - 1 : year;
}

function departAccelere(reglages) {
  const depart = new Date(reglages.departAccelere);
  if (typeof reglages.departAccelere !== 'string' || Number.isNaN(depart.getTime())) {
    throw new Error('DEPART_ACCELERE manquant ou invalide : donnez une date ISO 8601 avec fuseau, par exemple 2026-11-16T20:30:00+01:00');
  }
  return depart.getTime();
}

// Instants d'ouverture des 24 cases (ms UTC) et instant de fin du calendrier.
function calendrierNormal(saison, heureOuverture) {
  const { heure, minute } = lireHeure(heureOuverture);
  const ouvertures = Array.from({ length: NB_CASES }, (_, i) => instantParis(saison, 12, i + 1, heure, minute).getTime());
  return { ouvertures, fin: instantParis(saison, 12, 25, 0, 0).getTime() };
}

function calendrierAccelere(reglages) {
  const depart = departAccelere(reglages);
  const ouvertures = Array.from({ length: NB_CASES }, (_, i) => depart + i * PAS_ACCELERE);
  return { ouvertures, fin: depart + NB_CASES * PAS_ACCELERE };
}

function etatDeLaCase(jour, instant, { ouvertures, fin }) {
  if (instant >= fin) return 'ouverte'; // calendrier fini : toutes les cases restent relisibles
  const dues = ouvertures.filter((o) => instant >= o).length;
  if (jour > dues) return 'fermee';
  return jour === dues ? 'du-jour' : 'ouverte';
}

export function etatsDesCases(maintenant, reglages) {
  const saison = saisonDe(maintenant);
  const plan = reglages.mode === 'accelere'
    ? calendrierAccelere(reglages)
    : calendrierNormal(saison, reglages.heureOuverture);
  const instant = maintenant.getTime();
  const cases = plan.ouvertures.map((ouverture, i) => ({
    jour: i + 1,
    etat: etatDeLaCase(i + 1, instant, plan),
    ouvertureLe: new Date(ouverture).toISOString(),
  }));
  const duJour = cases.find((c) => c.etat === 'du-jour');
  return {
    mode: reglages.mode,
    saison,
    aujourdhui: duJour ? duJour.jour : null,
    fini: instant >= plan.fin,
    cases,
  };
}
