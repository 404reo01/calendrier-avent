import { chargerEtat, chargerCase, jetonDuJour } from "./donnees.js";
import { afficherGrille } from "./grille.js";
import { creerPanneau } from "./panneau.js";
import { libelleOuverture } from "./temps.js";

const conteneurGrille = document.getElementById("grille");
const zoneMessage = document.getElementById("message");
const bandeauDemo = document.getElementById("bandeau-demo");

// Mode construction : ?construction signale les cases ouvertes qui n'ont pas de contenu.
const construction = new URLSearchParams(location.search).has("construction");

function annoncer(texte, { erreur = false } = {}) {
  zoneMessage.textContent = texte;
  zoneMessage.classList.toggle("est-erreur", erreur);
  zoneMessage.hidden = false;
}

function effacerMessage() {
  zoneMessage.hidden = true;
  zoneMessage.textContent = "";
}

// Message d'état global, déduit uniquement de etat.json (jamais de l'horloge de l'appareil).
function messageGlobal(etat) {
  if (etat.fini) return "Le calendrier est terminé, toutes les cases restent à relire.";
  if (!etat.cases.some((c) => c.etat !== "fermee")) {
    const premiere = etat.cases.find((c) => c.jour === 1);
    const quand = premiere && libelleOuverture(premiere.ouvertureLe);
    return `Le calendrier n'a pas encore commencé. ${quand ? `La première case s'ouvre ${quand.charAt(0).toLowerCase()}${quand.slice(1)}.` : "Revenez le 1er décembre."}`;
  }
  return null;
}

function demarrerOuverture(panneau) {
  let etatCourant = null;

  async function ouvrirCase(caseEtat, bouton, libelle) {
    if (caseEtat.etat === "fermee") {
      // Pas de fetch : une case fermée n'a pas d'adresse, et on n'en devine aucune.
      annoncer(`La case ${caseEtat.jour} n'est pas encore ouverte. ${libelle}.`);
      return;
    }
    const jeton = jetonDuJour(etatCourant, caseEtat.jour);
    if (!jeton) {
      annoncer(construction
        ? `Case ${caseEtat.jour} : aucun contenu publié.`
        : `Le contenu de la case ${caseEtat.jour} n'est pas disponible pour le moment.`, { erreur: true });
      return;
    }
    try {
      const donnees = await chargerCase(jeton);
      effacerMessage();
      panneau.ouvrir(donnees, caseEtat.jour, bouton);
      document.dispatchEvent(new CustomEvent("case:ouverte", { detail: { jour: caseEtat.jour } }));
    } catch {
      annoncer(`Impossible de charger la case ${caseEtat.jour}. Réessayez dans un instant.`, { erreur: true });
    }
  }

  return {
    ouvrirCase,
    definirEtat(etat) { etatCourant = etat; },
  };
}

async function demarrer() {
  const panneau = creerPanneau(document.getElementById("panneau"), document.getElementById("panneau-corps"));
  const ouverture = demarrerOuverture(panneau);
  try {
    const etat = await chargerEtat();
    ouverture.definirEtat(etat);
    bandeauDemo.hidden = etat.mode !== "accelere";
    afficherGrille(conteneurGrille, etat, { construction, surClic: ouverture.ouvrirCase });
    const global = messageGlobal(etat);
    if (global) annoncer(global);
  } catch {
    annoncer("Le calendrier n'a pas pu être chargé. Rechargez la page dans un instant.", { erreur: true });
  }
}

demarrer();
