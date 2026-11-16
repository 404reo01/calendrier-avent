// Chargement des données publiées par le robot. Chemins relatifs : GitHub Pages sert le site sous /<depot>/.
const JETON = /^[0-9a-f]{16}$/;

async function lireJson(chemin) {
  // no-store : l'état change au fil des jours, un cache périmé cacherait une case ouverte.
  const reponse = await fetch(chemin, { cache: "no-store" });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return reponse.json();
}

export async function chargerEtat() {
  const etat = await lireJson("etat.json");
  if (!etat || !Array.isArray(etat.cases)) throw new Error("etat.json invalide");
  return { ...etat, jetons: etat.jetons ?? {} };
}

// Le jeton vient d'etat.json mais on le revérifie : il finit dans une URL.
export function jetonDuJour(etat, jour) {
  const jeton = etat.jetons[String(jour)];
  return typeof jeton === "string" && JETON.test(jeton) ? jeton : null;
}

export async function chargerCase(jeton) {
  const donnees = await lireJson(`cases/${jeton}.json`);
  if (!donnees || typeof donnees.titre !== "string") throw new Error("case invalide");
  return donnees;
}
