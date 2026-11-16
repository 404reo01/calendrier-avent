import { el } from "./dom.js";
import { libelleOuverture } from "./temps.js";
import { jetonDuJour } from "./donnees.js";

// Pictogrammes décoratifs (aria-hidden) : le mot, lui, est lu par les lecteurs d'écran.
const SIGNES = { ouverte: "✓", "du-jour": "★", fermee: "🔒" };

export function libelleEtat(caseEtat) {
  if (caseEtat.etat === "ouverte") return "Ouverte";
  if (caseEtat.etat === "du-jour") return "Aujourd'hui";
  return libelleOuverture(caseEtat.ouvertureLe) ?? "Pas encore ouverte";
}

function construireCase(caseEtat, etat, construction, surClic) {
  const { jour } = caseEtat;
  const sansContenu = caseEtat.etat !== "fermee" && !jetonDuJour(etat, jour);
  const libelle = libelleEtat(caseEtat);

  const bouton = el("button", {
    classe: "case",
    attributs: { type: "button", "data-jour": jour, "data-etat": caseEtat.etat },
  }, [
    el("span", { classe: "case-numero", texte: String(jour) }),
    el("span", { classe: "case-etat" }, [
      el("span", { classe: "case-signe", texte: SIGNES[caseEtat.etat] ?? "", attributs: { "aria-hidden": "true" } }),
      document.createTextNode(libelle),
    ]),
  ]);

  if (caseEtat.etat === "fermee") bouton.setAttribute("aria-disabled", "true");
  if (sansContenu && construction) {
    bouton.append(el("span", { classe: "case-construction", texte: "Sans contenu" }));
  }
  bouton.addEventListener("click", () => surClic(caseEtat, bouton, libelle));
  return el("li", {}, [bouton]);
}

export function afficherGrille(conteneur, etat, { construction, surClic }) {
  const cases = [...etat.cases].sort((a, b) => a.jour - b.jour);
  conteneur.replaceChildren(...cases.map((c) => construireCase(c, etat, construction, surClic)));
}
