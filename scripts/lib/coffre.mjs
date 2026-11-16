// Coffre : chiffre et déchiffre une case du calendrier (AES-256-GCM, node:crypto).
// Règle de sécurité commune à tout le fichier : aucun message d'erreur ne contient
// la clé, le texte clair ou les octets chiffrés. On n'y met que le numéro du jour
// et le nom du champ fautif.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHME = 'aes-256-gcm';
const OCTETS_CLE = 32;
const OCTETS_DISTINCTS_MIN = 16;
// 12 octets : la taille d'IV native de GCM (pas de dérivation interne).
const OCTETS_IV = 12;
// 16 octets : tag complet. On l'impose au déchiffrement pour refuser un tag tronqué,
// qui affaiblirait l'authentification.
const OCTETS_TAG = 16;
const CARACTERES_JETON = 16;
// Base64 standard, avec remplissage. Buffer.from(…, 'base64') ignore en silence les
// caractères invalides : on vérifie donc le format avant de décoder.
const FORMAT_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
// Clés qui pourraient polluer un prototype si l'objet était fusionné plus loin.
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

export function lireCle(env = process.env) {
  const brute = env?.CLE_CALENDRIER;
  // Arbitrage 7 : une variable vide compte comme absente.
  if (brute === undefined || brute === null || String(brute).trim() === '') {
    throw new Error('CLE_CALENDRIER manquante : définissez-la dans .env ou dans les secrets GitHub (npm run chiffrer -- --generer-cle en crée une).');
  }
  // trim : tolère le retour chariot d'un .env édité sous Windows.
  const cle = decoderBase64Canonique(String(brute).trim());
  if (!cle || cle.length !== OCTETS_CLE) {
    // Le message ne reprend jamais la valeur reçue, même invalide : une clé mal
    // copiée reste presque une clé.
    throw new Error(`CLE_CALENDRIER invalide : attendu ${OCTETS_CLE} octets encodés en base64 (npm run chiffrer -- --generer-cle en crée une).`);
  }
  // Une clé tapée à la main (32 × « A », motif répété) a 32 octets mais presque
  // pas d'entropie. 32 octets aléatoires en ont ~30 distincts ; moins de 16 trahit
  // une clé fabriquée. Le message ne dit pas combien, pour ne rien révéler d'elle.
  if (new Set(cle).size < OCTETS_DISTINCTS_MIN) {
    throw new Error('CLE_CALENDRIER trop faible : générez-la avec npm run chiffrer -- --generer-cle');
  }
  return cle;
}

export function chiffrerCase(jour, contenu, cle) {
  verifierJour(jour);
  verifierCle(cle);
  verifierContenu(contenu, jour);
  // IV neuf à chaque appel : réutiliser un IV avec la même clé casse GCM
  // (fuite du XOR des clairs et possibilité de forger des tags).
  const iv = randomBytes(OCTETS_IV);
  const chiffreur = createCipheriv(ALGORITHME, cle, iv, { authTagLength: OCTETS_TAG });
  // AAD = numéro du jour : une case chiffrée déplacée sur un autre jour ne se déchiffre pas.
  chiffreur.setAAD(aadDe(jour));
  const donnees = Buffer.concat([chiffreur.update(JSON.stringify(contenu), 'utf8'), chiffreur.final()]);
  return {
    jour,
    iv: iv.toString('base64'),
    donnees: donnees.toString('base64'),
    tag: chiffreur.getAuthTag().toString('base64'),
  };
}

export function dechiffrerCase(enveloppe, cle) {
  if (!estObjetSimple(enveloppe)) throw new Error('Enveloppe de case invalide : objet attendu.');
  const { jour } = enveloppe;
  verifierJour(jour);
  verifierCle(cle);
  const iv = decoderChamp(enveloppe, 'iv', jour, OCTETS_IV);
  const tag = decoderChamp(enveloppe, 'tag', jour, OCTETS_TAG);
  const donnees = decoderChamp(enveloppe, 'donnees', jour);
  const clair = ouvrir({ jour, iv, tag, donnees }, cle);
  const contenu = lireJson(clair, jour);
  verifierContenu(contenu, jour);
  return contenu;
}

export function jetonCase(jour, cle) {
  verifierJour(jour);
  verifierCle(cle);
  // HMAC et pas un simple hachage du jour : sans la clé, on ne peut pas calculer
  // l'adresse d'une case future. 64 bits suffisent contre la devinette en ligne.
  return createHmac('sha256', cle).update(`jeton:${jour}`).digest('hex').slice(0, CARACTERES_JETON);
}

function ouvrir({ jour, iv, tag, donnees }, cle) {
  try {
    const dechiffreur = createDecipheriv(ALGORITHME, cle, iv, { authTagLength: OCTETS_TAG });
    dechiffreur.setAAD(aadDe(jour));
    dechiffreur.setAuthTag(tag);
    // final() vérifie le tag (comparaison à temps constant faite par OpenSSL) :
    // rien n'est rendu tant que l'authenticité n'est pas prouvée.
    return Buffer.concat([dechiffreur.update(donnees), dechiffreur.final()]);
  } catch {
    // On remplace l'erreur d'OpenSSL par un message à nous, sans `cause`,
    // pour ne rien laisser passer d'autre que le numéro du jour.
    throw new Error(`Déchiffrement de la case ${jour} impossible : clé incorrecte ou données altérées.`);
  }
}

function lireJson(clair, jour) {
  try {
    // Le reviver écarte les clés dangereuses au cas où un appelant fusionnerait l'objet.
    return JSON.parse(clair.toString('utf8'), (cle, valeur) => {
      if (CLES_INTERDITES.has(cle)) throw new Error('clé interdite');
      return valeur;
    });
  } catch {
    // Les SyntaxError de JSON.parse citent un extrait du texte : on les masque.
    throw new Error(`Contenu de la case ${jour} illisible après déchiffrement.`);
  }
}

function decoderChamp(enveloppe, champ, jour, longueur) {
  const valeur = enveloppe[champ];
  const octets = typeof valeur === 'string' && valeur !== '' ? decoderBase64Canonique(valeur) : null;
  if (!octets) {
    throw new Error(`Enveloppe de la case ${jour} invalide : le champ « ${champ} » doit être du base64 canonique.`);
  }
  if (longueur !== undefined && octets.length !== longueur) {
    throw new Error(`Enveloppe de la case ${jour} invalide : le champ « ${champ} » doit faire ${longueur} octets.`);
  }
  return octets;
}

// Base64 canonique : format strict, puis ré-encodage identique. Écarte les bits
// de remplissage non nuls (« QR== » décode comme « QQ== ») : une même valeur n'a
// qu'une écriture, donc pas de variante qui passerait un filtre sur le texte.
function decoderBase64Canonique(texte) {
  if (!FORMAT_BASE64.test(texte)) return null;
  const octets = Buffer.from(texte, 'base64');
  return octets.toString('base64') === texte ? octets : null;
}

function verifierJour(jour) {
  if (!Number.isInteger(jour) || jour < 1 || jour > 24) {
    throw new Error('Numéro de jour invalide : entier de 1 à 24 attendu.');
  }
}

function verifierCle(cle) {
  if (!Buffer.isBuffer(cle) || cle.length !== OCTETS_CLE) {
    throw new Error(`Clé invalide : Buffer de ${OCTETS_CLE} octets attendu (utilisez lireCle()).`);
  }
}

function verifierContenu(contenu, jour) {
  if (!estObjetSimple(contenu)) throw new Error(`Contenu de la case ${jour} invalide : objet attendu.`);
  // Si le contenu porte son propre numéro, il doit coïncider avec celui de l'enveloppe.
  if (Object.hasOwn(contenu, 'jour') && contenu.jour !== jour) {
    throw new Error(`Contenu de la case ${jour} incohérent : son champ « jour » ne correspond pas.`);
  }
}

function estObjetSimple(valeur) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return false;
  const prototype = Object.getPrototypeOf(valeur);
  return prototype === Object.prototype || prototype === null;
}

function aadDe(jour) {
  return Buffer.from(`case:${jour}`, 'utf8');
}
