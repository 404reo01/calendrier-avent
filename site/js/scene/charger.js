// Point d'entrée léger de la 3D : il décide s'il faut la charger, sans jamais importer three.js
// tant que ce n'est pas utile. Sans WebGL ou en économie de données, rien ne se charge et la carte
// du ciel en CSS suffit. Avec le mouvement réduit, la scène se charge mais reste figée.

function webglDisponible() {
  try {
    const essai = document.createElement("canvas");
    const contexte = essai.getContext("webgl2") ?? essai.getContext("webgl");
    if (!contexte) return false;
    // On rend tout de suite ce contexte d'essai : les navigateurs en limitent le nombre.
    contexte.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function sceneAutorisee() {
  if (navigator.connection?.saveData) return false;
  return webglDisponible();
}

// Petit écran ou écran tactile étroit : cadrage vertical (le ciel en haut, le pupitre en bas), coût réduit.
function modeReduit() {
  return matchMedia("(max-width: 40rem)").matches
    || matchMedia("(pointer: coarse) and (max-width: 64rem)").matches;
}

export async function chargerScene({ conteneur, grille }) {
  if (!conteneur || !grille || !grille.querySelector("button.case")) return;
  if (!sceneAutorisee()) return;
  const reduit = modeReduit();
  conteneur.classList.toggle("est-reduite", reduit);
  conteneur.hidden = false;
  try {
    const { creerScene } = await import("./scene.js");
    const mouvementReduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
    await creerScene({ conteneur, grille, reduit, mouvementReduit });
  } catch (erreur) {
    // La 3D est un bonus : en cas d'échec, on la retire proprement et on le dit dans la console.
    conteneur.replaceChildren();
    conteneur.hidden = true;
    console.warn("Scène 3D indisponible, la grille reste utilisable :", erreur?.message ?? erreur);
  }
}
