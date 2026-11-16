// Mise en forme des dates. L'heure de Paris est imposée par timeZone : l'appareil du visiteur
// peut être réglé ailleurs, l'ouverture reste « 7 h à Paris ». On ne lit jamais l'horloge ici.
const FUSEAU = "Europe/Paris";

const formatJourMois = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "short",
});
const formatHeure = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

function partie(parties, type) {
  return parties.find((p) => p.type === type)?.value ?? "";
}

// « 14 déc. » ou « 1er déc. »
function jourMois(date) {
  const parties = formatJourMois.formatToParts(date);
  const jour = partie(parties, "day");
  return `${jour === "1" ? "1er" : jour}\u00a0${partie(parties, "month")}`;
}

// « 7 h » ou « 20 h 35 »
function heure(date) {
  const parties = formatHeure.formatToParts(date);
  const h = partie(parties, "hour");
  const m = partie(parties, "minute");
  // Espaces insécables : « 7 h » et « 14 déc. » ne se coupent jamais en fin de ligne.
  return m === "00" ? `${h}\u00a0h` : `${h}\u00a0h\u00a0${m}`;
}

// → « Le 14 déc. à 7 h », ou null si la date est invalide.
export function libelleOuverture(ouvertureLe) {
  const date = new Date(ouvertureLe);
  if (Number.isNaN(date.getTime())) return null;
  return `Le ${jourMois(date)} à\u00a0${heure(date)}`;
}
