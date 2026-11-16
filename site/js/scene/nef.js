// La nef : une bibliothèque gothique monumentale à ciel ouvert. Trois niveaux de rayonnages,
// des piles coiffées de pinacles, une travée d'arcs qui fuit vers le fond, un mur du fond percé
// de lancettes, des marches qui montent vers le pupitre. Matériaux en aplats (toon, trois paliers) :
// c'est la passe finale qui pose le trait d'encre, le lavis, la brume et le grain.
// Budget : une géométrie fusionnée par matériau, des InstancedMesh pour les livres, balustres et marches.
import * as THREE from "../../vendor/three.module.min.js";
import { creerBalustres, creerMarches, construireEtages } from "./etages.js";
import { arcEnTube, boite, contourFenetre, fusionner, pointsOgive } from "./geometrie.js";
import { lanternes, lecteur } from "./ornements.js";
import { PLAN } from "./plan.js";
import { boiseries, creerLivres } from "./rayonnages.js";
import { textureDallage, textureVitrail } from "./textures.js";

export { PLAN };

const TEINTES = { pierre: "#4d7c86", fer: "#1d3045" };

// Trois paliers de lumière, sans dégradé : l'ombre est posée en aplats, comme à la gouache.
function gradientToon() {
  const valeurs = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(valeurs, 3, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function creerMateriaux() {
  const gradientMap = gradientToon();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  const dallage = textureDallage();
  dallage.repeat.set(12, 30);
  // Les marches reprennent les dalles, plus grandes : sans leurs joints, l'estrade se lit comme un bloc.
  const dallesMarches = textureDallage();
  dallesMarches.repeat.set(4, 3);
  return {
    gradientMap,
    pierre: toon(TEINTES.pierre),
    bois: toon("#2a465a"),
    fer: toon(TEINTES.fer),
    // Le verre des lanternes éteintes : un gris-bleu froid, sans aucune émission.
    verre: toon("#3f5a72"),
    teinte: toon("#ffffff"), // couleur portée par chaque instance (livres, balustres)
    sol: toon("#7e9fb4", { map: dallage }),
    marches: toon("#7896a8", { map: dallesMarches }),
    pupitre: toon("#3b5a70"),
    vitrail: new THREE.MeshBasicMaterial({ map: textureVitrail(), fog: false }),
    cire: new THREE.MeshBasicMaterial({ color: "#dfe6e8" }),
    encre: new THREE.MeshBasicMaterial({ color: "#0b1233" }),
    toon,
  };
}

function colonnes() {
  const pieces = [];
  const h = PLAN.hautColonnes;
  for (const cote of [-1, 1]) {
    for (const z of PLAN.coloZ) {
      const x = cote * PLAN.colonne;
      pieces.push(new THREE.CylinderGeometry(0.45, 0.5, h, 10).translate(x, h / 2, z));
      pieces.push(boite(1.3, 0.6, 1.3, x, 0.3, z), boite(1.2, 0.45, 1.2, x, h + 0.2, z));
      // Une colonnette engagée de chaque côté : le faisceau gothique.
      for (const dz of [-0.55, 0.55]) pieces.push(new THREE.CylinderGeometry(0.17, 0.17, h, 6).translate(x - cote * 0.05, h / 2, z + dz));
      // Le pinacle qui coiffe la pile, découpé sur le ciel.
      pieces.push(new THREE.ConeGeometry(0.48, 3.4, 6).translate(x, h + 2.1, z));
    }
  }
  return pieces;
}

// Les arcs qui ne portent plus rien : des arcs transversaux au-dessus de la nef (la travée qui fuit),
// une arcade le long de chaque rayonnage au sommet des piles, et la corniche des rayonnages.
const ARCS_TRANSVERSAUX = [9, -12, -26, -40];

function arcs() {
  const pieces = [];
  const naissance = PLAN.hautColonnes + 0.4;
  for (const z of ARCS_TRANSVERSAUX) {
    pieces.push(...arcEnTube(PLAN.colonne * 2, naissance, 0.34, (x, y) => new THREE.Vector3(x, y, z)));
  }
  for (const cote of [-1, 1]) {
    for (let i = 0; i < PLAN.coloZ.length - 1; i += 1) {
      const milieu = (PLAN.coloZ[i] + PLAN.coloZ[i + 1]) / 2;
      const ecart = PLAN.coloZ[i] - PLAN.coloZ[i + 1];
      pieces.push(...arcEnTube(ecart, naissance, 0.22, (u, y) => new THREE.Vector3(cote * PLAN.colonne, y, milieu + u)));
    }
    pieces.push(boite(1.7, 0.5, PLAN.avant - PLAN.fond, cote * (PLAN.facade - 0.75), PLAN.sommet + 0.25, (PLAN.avant + PLAN.fond) / 2));
  }
  return pieces;
}

// Les lancettes du mur du fond : [centre x, bas, largeur, naissance, rayon relatif].
const FENETRES = [[0, 6.4, 3.8, 14.2, 1.2], [-5.2, 6.4, 2.6, 13.0, 1.25], [5.2, 6.4, 2.6, 13.0, 1.25]];
const MUR = { haut: 15.5, pignon: 15, rosace: { y: 20.6, r: 1.6 } };

function murDuFond() {
  // Un mur couronné d'un seul pignon en ogive : au-dessus, tout le reste est ciel.
  const demi = PLAN.facade + 0.5;
  const forme = new THREE.Shape();
  forme.moveTo(-demi, 0);
  forme.lineTo(-demi, MUR.haut);
  for (const p of pointsOgive(MUR.pignon, MUR.haut, 1, 12)) forme.lineTo(p.x, p.y);
  forme.lineTo(demi, MUR.haut);
  forme.lineTo(demi, 0);
  forme.lineTo(-demi, 0);
  for (const [cx, bas, largeur, naissance, rayon] of FENETRES) {
    forme.holes.push(contourFenetre(new THREE.Path(), cx, bas, largeur, naissance, rayon));
  }
  const rosace = new THREE.Path();
  rosace.absarc(0, MUR.rosace.y, MUR.rosace.r, 0, Math.PI * 2, true);
  forme.holes.push(rosace);
  const mur = new THREE.ExtrudeGeometry(forme, { depth: 0.8, bevelEnabled: false, curveSegments: 16 });
  mur.translate(0, 0, PLAN.fond - 0.8);
  // Les meneaux : un montant au milieu de chaque lancette.
  const meneaux = FENETRES.map(([cx, bas, , naissance]) => boite(0.18, naissance - bas + 1.4, 0.3, cx, (bas + naissance + 1.4) / 2, PLAN.fond - 0.35));
  return [mur, ...meneaux];
}

function vitraux(materiau) {
  const plans = FENETRES.map(([cx, bas, largeur, naissance, rayon]) => {
    const fleche = Math.sqrt((largeur * rayon) ** 2 - (largeur * rayon - largeur / 2) ** 2);
    const hauteur = naissance + fleche - bas;
    return new THREE.PlaneGeometry(largeur, hauteur).translate(cx, bas + hauteur / 2, PLAN.fond - 0.5);
  });
  const { y, r } = MUR.rosace;
  plans.push(new THREE.PlaneGeometry(r * 2.1, r * 2.1).translate(0, y, PLAN.fond - 0.5));
  return new THREE.Mesh(fusionner(plans), materiau);
}

function marchesEtEstrade() {
  // Cinq marches de 26 cm ; la dernière forme l'estrade du pupitre.
  const pieces = [];
  const fin = PLAN.pupitre.z - 3;
  const depart = PLAN.pupitre.z + 5.8;
  for (let i = 0; i < 5; i += 1) {
    const haut = 0.26 * (i + 1);
    const avant = depart - 0.6 * i;
    pieces.push(boite(9 - i * 0.3, haut, avant - fin, 0, haut / 2, (avant + fin) / 2));
  }
  return pieces;
}

function pupitre() {
  const { x, y, z } = PLAN.pupitre;
  return [
    boite(0.7, 0.12, 0.6, x, y + 0.06, z),
    new THREE.CylinderGeometry(0.14, 0.2, 0.95, 8).translate(x, y + 0.55, z),
    boite(1.4, 0.07, 1.0, x, y + 1.08, z, { rx: 0.42 }),
    // Le chandelier, à droite du pupitre.
    new THREE.CylinderGeometry(0.04, 0.05, 1.12, 6).translate(PLAN.bougie.x, y + 0.56, PLAN.bougie.z),
    new THREE.CylinderGeometry(0.16, 0.12, 0.04, 10).translate(PLAN.bougie.x, y + 1.13, PLAN.bougie.z),
  ];
}

function creerLumieres(groupe) {
  groupe.add(new THREE.HemisphereLight("#9cbbe8", "#16283a", 1.5));
  const lune = new THREE.DirectionalLight("#c4d8f6", 1.9);
  lune.position.set(-4, 20, 6);
  lune.target.position.set(0, 0, -8);
  groupe.add(lune, lune.target);
  // Le seul point chaud de toute la scène : la bougie du pupitre.
  const bougie = new THREE.PointLight("#ffb062", 18, 11, 1.4);
  bougie.position.copy(PLAN.bougie);
  groupe.add(bougie);
}

function creerSol(materiau) {
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(PLAN.facade * 2 + 1, PLAN.avant - PLAN.fond + 2).rotateX(-Math.PI / 2), materiau);
  sol.position.z = (PLAN.avant + PLAN.fond) / 2;
  return sol;
}

export function creerNef(materiaux, { reduit = false } = {}) {
  const groupe = new THREE.Group();
  const etages = construireEtages();
  const feux = lanternes();
  const teintes = { pierre: new THREE.Color(TEINTES.pierre), fer: new THREE.Color(TEINTES.fer) };
  // Le cierge monte jusque sous la flamme : de près (moment d'ouverture), un vide entre les deux se verrait.
  const cierge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.38, 8), materiaux.cire);
  cierge.position.set(PLAN.bougie.x, PLAN.bougie.y - 0.17, PLAN.bougie.z);
  groupe.add(
    new THREE.Mesh(fusionner([...colonnes(), ...arcs(), ...murDuFond(), ...etages.pierre]), materiaux.pierre),
    new THREE.Mesh(fusionner(marchesEtEstrade()), materiaux.marches),
    new THREE.Mesh(fusionner([...boiseries(), ...etages.bois]), materiaux.bois),
    new THREE.Mesh(fusionner([...etages.fer, ...feux.fer]), materiaux.fer),
    new THREE.Mesh(fusionner(feux.verre), materiaux.verre),
    new THREE.Mesh(fusionner(pupitre()), materiaux.pupitre),
    new THREE.Mesh(lecteur(), materiaux.encre),
    creerSol(materiaux.sol), cierge, vitraux(materiaux.vitrail),
    creerLivres(materiaux.teinte, reduit),
    creerBalustres(etages.balustres, materiaux.teinte, teintes),
    creerMarches(etages.marches, materiaux.fer),
  );
  creerLumieres(groupe);
  return groupe;
}
