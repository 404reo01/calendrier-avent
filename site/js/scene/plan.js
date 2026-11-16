// Le plan de la nef (unités ≈ mètres), partagé par tous les modules qui la construisent.
// Le visiteur regarde vers -z, le pupitre est dans l'axe. Trois niveaux de rayonnages :
// le rez-de-chaussée, puis deux coursives à balustrade ; une passerelle relie les deux côtés au 2e niveau.
import * as THREE from "../../vendor/three.module.min.js";

const HAUTEUR_NIVEAU = 6.5;

export const PLAN = {
  facade: 12, // dos des rayonnages (x = ±facade)
  rayons: 10.7, // devant des rayonnages : leur profondeur est de 1,3 m
  balcon: 8.9, // bord intérieur des coursives, où court la balustrade
  colonne: 8.4,
  niveaux: [0, HAUTEUR_NIVEAU, HAUTEUR_NIVEAU * 2], // plancher de chaque niveau
  hauteurNiveau: HAUTEUR_NIVEAU,
  dalle: 0.35, // épaisseur du plancher des coursives
  sommet: HAUTEUR_NIVEAU * 3, // haut des rayonnages
  hautColonnes: 21,
  avant: 18,
  fond: -46,
  // Une travée tous les 7 m : la répétition des piles et des arcs fait fuir la nef vers le fond.
  coloZ: [16, 9, 2, -5, -12, -19, -26, -33, -40],
  passerelleZ: -19,
  pupitre: new THREE.Vector3(0, 1.3, -16),
  bougie: new THREE.Vector3(0.95, 2.78, -15.75),
};
