// Une légère parallaxe : la caméra de repos glisse de quelques dizaines de centimètres en suivant
// la souris (ou l'inclinaison du téléphone, quand le navigateur la donne sans demander de permission).
// Les piles proches bougent plus que le mur du fond : la profondeur se sent. Le regard reste fixé,
// donc la constellation ne quitte pas son cadre. Rendu à la demande : une image n'est dessinée
// que tant que la caméra n'a pas rejoint sa cible.
import * as THREE from "../../vendor/three.module.min.js";

const AMPLITUDE = { x: 0.7, y: 0.3 };
// Temps de rattrapage (s) : la caméra suit avec un léger retard, comme un regard qui se pose.
const INERTIE = 0.35;
const ARRIVEE = 0.003;

export function creerParallaxe({ camera, pose, boucle, rendu, peutBouger }) {
  const cible = new THREE.Vector2();
  const actuel = new THREE.Vector2();
  let enCours = false;
  let precedent = 0;

  function appliquer() {
    camera.position.copy(pose.position);
    camera.position.x += actuel.x * AMPLITUDE.x;
    camera.position.y += actuel.y * AMPLITUDE.y;
    camera.lookAt(pose.regard);
    rendu.invalider();
  }

  function etape(maintenant) {
    if (!peutBouger()) { enCours = false; return false; }
    const dt = precedent ? Math.min((maintenant - precedent) / 1000, 0.1) : 1 / 60;
    precedent = maintenant;
    actuel.lerp(cible, 1 - Math.exp(-dt / INERTIE * 3));
    const arrive = actuel.distanceTo(cible) < ARRIVEE;
    if (arrive) actuel.copy(cible);
    appliquer();
    if (arrive) enCours = false;
    return !arrive;
  }

  return {
    // x et y entre -1 et 1 (centre = 0).
    viser(x, y) {
      cible.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
      if (enCours || !peutBouger()) return;
      // On repart de la caméra réelle : le moment d'ouverture a pu la reposer entre-temps.
      actuel.set((camera.position.x - pose.position.x) / AMPLITUDE.x, (camera.position.y - pose.position.y) / AMPLITUDE.y);
      enCours = true;
      precedent = 0;
      boucle.suivre(etape);
    },
    // La caméra de repos a été reposée ailleurs (redimensionnement, mouvement réduit) : on oublie le décalage.
    oublier() {
      cible.set(0, 0);
      actuel.set(0, 0);
    },
  };
}

// L'inclinaison du téléphone, seulement si elle ne demande aucune permission (iOS la demande : on s'abstient).
export function brancherOrientation(parallaxe, signal) {
  if (typeof DeviceOrientationEvent === "undefined" || typeof DeviceOrientationEvent.requestPermission === "function") return;
  let reference = null;
  let dernier = { x: 0, y: 0 };
  window.addEventListener("deviceorientation", (evenement) => {
    if (evenement.beta === null || evenement.gamma === null) return;
    reference ??= evenement.beta;
    const x = evenement.gamma / 20;
    const y = (reference - evenement.beta) / 20;
    // Le capteur tremble : on ignore les micro-variations pour ne pas redessiner sans raison.
    if (Math.abs(x - dernier.x) + Math.abs(y - dernier.y) < 0.03) return;
    dernier = { x, y };
    parallaxe.viser(x, y);
  }, { signal });
}
