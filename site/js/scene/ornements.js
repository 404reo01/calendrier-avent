// Les lanternes éteintes (fer et verre froid : la bougie du pupitre reste le seul point chaud)
// et le lecteur debout sur la passerelle, une silhouette à l'encre qui donne l'échelle de la nef.
import * as THREE from "../../vendor/three.module.min.js";
import { boite, fusionner } from "./geometrie.js";
import { PLAN } from "./plan.js";

// Les lanternes pendent à des potences fixées aux piles, jamais au-dessus de l'allée :
// leurs chaînes ne traversent pas le ciel, où elles masqueraient la constellation.
// [côté, z de la pile, niveau sous lequel elle pend]
const POTENCES = [[-1, 9, 1], [1, 9, 1], [-1, -12, 1], [1, -12, 1], [-1, -26, 1], [1, -26, 1], [-1, 2, 2], [1, 2, 2], [-1, -19, 2], [1, -19, 2], [-1, -33, 2], [1, -33, 2]];
const SAILLIE = 1.15;

function lanterne(fer, verre, x, y, z, accroche) {
  verre.push(new THREE.CylinderGeometry(0.22, 0.17, 0.55, 6).translate(x, y, z));
  fer.push(
    new THREE.ConeGeometry(0.32, 0.34, 6).translate(x, y + 0.45, z),
    new THREE.ConeGeometry(0.2, 0.22, 6).rotateX(Math.PI).translate(x, y - 0.38, z),
    new THREE.CylinderGeometry(0.24, 0.24, 0.05, 6).translate(x, y + 0.28, z),
    new THREE.CylinderGeometry(0.018, 0.018, accroche - y - 0.6, 4).translate(x, (accroche + y + 0.6) / 2, z),
  );
}

export function lanternes() {
  const fer = [];
  const verre = [];
  for (const [cote, z, niveau] of POTENCES) {
    const haut = PLAN.niveaux[niveau] - PLAN.dalle - 0.5;
    const bout = cote * (PLAN.colonne - SAILLIE);
    // La potence : un bras horizontal et sa jambe de force, sur la face intérieure de la pile.
    fer.push(boite(SAILLIE, 0.07, 0.07, cote * (PLAN.colonne - SAILLIE / 2), haut, z));
    fer.push(new THREE.BoxGeometry(0.05, 1.1, 0.05).rotateZ(cote * 0.85).translate(cote * (PLAN.colonne - 0.38), haut - 0.36, z));
    lanterne(fer, verre, bout, haut - 1.25, z, haut);
  }
  // Deux lanternes sous la passerelle.
  for (const x of [-3.6, 3.6]) lanterne(fer, verre, x, PLAN.niveaux[1] - 2.0, PLAN.passerelleZ, PLAN.niveaux[1] - 0.75);
  return { fer, verre };
}

// Le lecteur : une robe tournée, une tête, des bras qui tiennent un livre ouvert.
// Construit face à +z, puis tourné vers la nef.
export function lecteur() {
  const profil = [[0.001, 0], [0.3, 0], [0.27, 0.5], [0.2, 1.05], [0.16, 1.32], [0.22, 1.4], [0.08, 1.5], [0.001, 1.52]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const pieces = [
    new THREE.LatheGeometry(profil, 10),
    new THREE.SphereGeometry(0.115, 10, 8).translate(0, 1.64, 0.01),
    boite(0.08, 0.36, 0.08, -0.17, 1.22, 0.12, { rx: -0.9 }),
    boite(0.08, 0.36, 0.08, 0.17, 1.22, 0.12, { rx: -0.9 }),
    boite(0.34, 0.03, 0.22, 0, 1.2, 0.3, { rx: 0.5 }),
  ];
  const g = fusionner(pieces);
  // Sur la passerelle, contre la balustrade : vu presque de face et découpé sur le mur du fond
  // pâli par la brume. (Sur une coursive latérale, la caméra basse ne verrait que sa tête.)
  g.rotateY(0.5).translate(-2.6, PLAN.niveaux[1], PLAN.passerelleZ + 0.75);
  return g;
}
