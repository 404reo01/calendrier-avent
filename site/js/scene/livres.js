// Les grimoires du rayonnage. Leur état vient des data-etat de la grille DOM, jamais d'une horloge :
// fermée = sceau intact + chaîne ; du-jour = dépasse du rayon et luit ; ouverte = sceau brisé.
import * as THREE from "../../vendor/three.module.min.js";
import { CUIRS, hasard, textureDeDos, textureDeTranche } from "./textures.js";

export const PROFONDEUR = 0.85;
export const AVANCEE_DU_JOUR = 0.3;
const RAYON_SCEAU = 0.085;
// Le sceau et la chaîne sont posés un peu sous le milieu du dos (origine du livre = sa base).
const HAUTEUR_SCEAU = 0.38;

// Épaisseur et hauteur varient d'un livre à l'autre, mais toujours de la même façon pour un jour donné.
export function dimensionsDuLivre(jour) {
  const alea = hasard(jour);
  return { epaisseur: 0.27 + alea() * 0.09, hauteur: 1.12 + alea() * 0.24, profondeur: PROFONDEUR };
}

export function couleurDuLivre(jour) {
  return CUIRS[(jour - 1) % CUIRS.length];
}

export function creerMateriauxCommuns() {
  return {
    cuirs: CUIRS.map((couleur) => new THREE.MeshLambertMaterial({ color: couleur })),
    tranche: new THREE.MeshLambertMaterial({ map: textureDeTranche(), color: "#efe1c2" }),
    cire: new THREE.MeshStandardMaterial({ color: "#8a2430", roughness: 0.35, metalness: 0, emissive: "#2a0508" }),
    fer: new THREE.MeshLambertMaterial({ color: "#8d8f94", emissive: "#1a1a1e" }),
    maillon: new THREE.TorusGeometry(0.04, 0.011, 6, 14),
    demiSceaux: [0, Math.PI].map((depart) => {
      const geometrie = new THREE.CylinderGeometry(RAYON_SCEAU, RAYON_SCEAU, 0.03, 20, 1, false, depart, Math.PI);
      return geometrie.rotateX(Math.PI / 2);
    }),
  };
}

// Matériaux du dos : carte de couleur + carte d'émission pour que la dorure se lise dans la pénombre.
export function materiauDeDos(jour, duJour) {
  const { carte, emission } = textureDeDos(jour, couleurDuLivre(jour), duJour);
  carte.anisotropy = 4;
  return new THREE.MeshLambertMaterial({ map: carte, emissive: "#ffffff", emissiveMap: emission, emissiveIntensity: duJour ? 0.55 : 0.3 });
}

function creerSceau(communs, hauteur, profondeur) {
  const moities = communs.demiSceaux.map((geometrie) => new THREE.Mesh(geometrie, communs.cire));
  poserSceauIntact(moities, hauteur, profondeur);
  return moities;
}

export function poserSceauIntact(moities, hauteur, profondeur) {
  for (const moitie of moities) {
    moitie.position.set(0, hauteur * HAUTEUR_SCEAU, profondeur / 2 + 0.02);
    moitie.rotation.set(0, 0, 0);
    moitie.visible = true;
  }
}

// Pose brisée : deux moitiés écartées et inclinées, lisible même en noir et blanc.
export function poserSceauBrise([droite, gauche], hauteur, profondeur) {
  const y = hauteur * HAUTEUR_SCEAU;
  droite.visible = true;
  gauche.visible = true;
  droite.position.set(0.03, y - 0.015, profondeur / 2 + 0.02);
  droite.rotation.z = -0.35;
  gauche.position.set(-0.03, y + 0.01, profondeur / 2 + 0.02);
  gauche.rotation.z = 0.3;
}

function creerChaine(communs, epaisseur, hauteur, profondeur) {
  const nombre = Math.ceil(epaisseur / 0.055) + 1;
  const chaine = new THREE.InstancedMesh(communs.maillon, communs.fer, nombre);
  const matrice = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const echelle = new THREE.Vector3(1, 0.75, 1);
  for (let i = 0; i < nombre; i += 1) {
    const x = -epaisseur / 2 + i * 0.055;
    // Un maillon sur deux est vu par la tranche, comme une vraie chaîne.
    rotation.setFromEuler(new THREE.Euler(i % 2 ? Math.PI / 2 : 0, 0, 0));
    matrice.compose(new THREE.Vector3(x, hauteur * HAUTEUR_SCEAU, profondeur / 2 + 0.01), rotation, echelle);
    chaine.setMatrixAt(i, matrice);
  }
  return chaine;
}

function creerLivre(caseEtat, communs) {
  const { jour, etat } = caseEtat;
  const { epaisseur, hauteur, profondeur } = dimensionsDuLivre(jour);
  const cuir = communs.cuirs[(jour - 1) % CUIRS.length];
  const dos = materiauDeDos(jour, etat === "du-jour");
  // Ordre des faces d'une BoxGeometry : +x, -x, +y, -y, +z (le dos, face au visiteur), -z.
  const corps = new THREE.Mesh(
    new THREE.BoxGeometry(epaisseur, hauteur, profondeur),
    [cuir, cuir, communs.tranche, communs.tranche, dos, communs.tranche],
  );
  corps.position.y = hauteur / 2;
  corps.userData.jour = jour;
  const groupe = new THREE.Group();
  groupe.add(corps);
  const sceau = creerSceau(communs, hauteur, profondeur);
  groupe.add(...sceau);
  if (etat === "ouverte") poserSceauBrise(sceau, hauteur, profondeur);
  if (etat === "fermee") groupe.add(creerChaine(communs, epaisseur, hauteur, profondeur));
  return { jour, etat, groupe, corps, sceau, dos, epaisseur, hauteur, profondeur, sceauBrise: etat === "ouverte" };
}

// Range les livres sur une ou plusieurs planches. `rangees` = [{ y, jours: [..] }].
export function creerLivres(cases, rangees, communs) {
  const groupe = new THREE.Group();
  const livres = new Map();
  const parJour = new Map(cases.map((c) => [c.jour, c]));
  for (const rangee of rangees) {
    const presents = rangee.jours.filter((jour) => parJour.has(jour)).map((jour) => creerLivre(parJour.get(jour), communs));
    const ecart = 0.018;
    const largeur = presents.reduce((somme, l) => somme + l.epaisseur, 0) + ecart * (presents.length - 1);
    let x = -largeur / 2;
    for (const livre of presents) {
      livre.base = new THREE.Vector3(x + livre.epaisseur / 2, rangee.y, livre.etat === "du-jour" ? AVANCEE_DU_JOUR : 0);
      livre.groupe.position.copy(livre.base);
      x += livre.epaisseur + ecart;
      groupe.add(livre.groupe);
      livres.set(livre.jour, livre);
    }
  }
  return { groupe, livres, cibles: [...livres.values()].map((l) => l.corps) };
}
