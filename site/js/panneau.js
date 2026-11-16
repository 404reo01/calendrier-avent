import { el } from "./dom.js";

let declencheur = null;

// Un lien n'est cliquable que s'il commence par https:// : un « javascript: » venu d'un contenu
// ne doit jamais devenir un lien.
function estLienSur(lien) {
  return typeof lien === "string" && lien.startsWith("https://");
}

function bloc(titre, texte, classe = "") {
  return el("section", { classe: `panneau-bloc ${classe}`.trim() }, [
    el("h3", { texte: titre }),
    el("p", { texte }),
  ]);
}

// Le skill est présenté comme un sort : l'« Incantation » est la phrase à dire à son assistant IA.
function blocIncantation(texte) {
  return el("section", { classe: "panneau-bloc panneau-incantation" }, [
    el("h3", { texte: "Incantation" }),
    el("p", { classe: "panneau-aide", texte: "La phrase à dire à votre assistant IA pour l'essayer :" }),
    el("p", { classe: "panneau-formule", texte }),
  ]);
}

function blocSkill(skill) {
  const lignes = [el("h3", { texte: "Le skill" })];
  lignes.push(el("p", { texte: `Nom : ${skill.nom ?? "—"}` }));
  if (skill.source) lignes.push(el("p", { texte: `Provenance : ${skill.source}` }));
  if (estLienSur(skill.lien)) {
    lignes.push(el("p", {}, [
      el("a", {
        classe: "panneau-lien",
        texte: "Voir le skill (nouvelle page)",
        attributs: { href: skill.lien, target: "_blank", rel: "noopener noreferrer" },
      }),
    ]));
  }
  return el("section", { classe: "panneau-bloc panneau-skill" }, lignes);
}

export function contenuDeLaCase(donnees, jour) {
  const enfants = [
    el("p", { classe: "panneau-jour", texte: `L'étoile du ${jour === 1 ? "1er" : jour} décembre` }),
    el("h2", { classe: "panneau-titre", texte: donnees.titre, attributs: { id: "panneau-titre" } }),
  ];
  // Lettrine seulement si le texte commence par une lettre (pas « [D » ni « « »).
  if (donnees.accroche) {
    const lettre = /^\p{L}/u.test(donnees.accroche);
    enfants.push(el("p", { classe: lettre ? "panneau-accroche" : "panneau-accroche sans-lettrine", texte: donnees.accroche }));
  }
  if (donnees.skill) enfants.push(blocSkill(donnees.skill));
  if (donnees.exemple) enfants.push(bloc("Un exemple", donnees.exemple));
  if (donnees.essayer) enfants.push(blocIncantation(donnees.essayer));
  if (donnees.avis) enfants.push(bloc("Notre avis", donnees.avis));
  return enfants;
}

export function creerPanneau(dialog, corps) {
  // Échap ferme nativement ; on rend le focus au bouton d'origine dans tous les cas de fermeture.
  dialog.addEventListener("close", () => {
    declencheur?.focus();
    declencheur = null;
  });
  // Clic sur le fond (le dialog lui-même, hors du contenu) : fermeture.
  dialog.addEventListener("click", (evenement) => {
    if (evenement.target === dialog) dialog.close();
  });

  return {
    ouvrir(donnees, jour, boutonOrigine) {
      declencheur = boutonOrigine;
      const fermer = el("button", { classe: "panneau-fermer", texte: "Fermer", attributs: { type: "button" } });
      fermer.addEventListener("click", () => dialog.close());
      corps.replaceChildren(...contenuDeLaCase(donnees, jour), fermer);
      if (!dialog.open) dialog.showModal();
    },
  };
}
