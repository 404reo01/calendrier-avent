// La nef : une bibliothèque gothique à ciel ouvert. Rayonnages immenses de part et d'autre,
// colonnes et arcs brisés qui ne portent plus de voûte, mur du fond percé de lancettes,
// marches qui montent vers le pupitre. Matériaux en aplats (toon, trois paliers) : c'est la passe
// finale qui pose le trait d'encre, le lavis et le grain.
import * as THREE from "../../vendor/three.module.min.js";
import { arcEnTube, boite, contourFenetre, fusionner, hasard, pointsOgive } from "./geometrie.js";
import { textureDallage, textureVitrail } from "./textures.js";

// Plan de la nef (unités ≈ mètres). Le visiteur regarde vers -z, le pupitre est dans l'axe.
export const PLAN = {
  facade: 9.8, // dos des rayonnages (x = ±facade)
  colonne: 8.4,
  hauteurRayons: 13,
  avant: 16,
  fond: -26,
  coloZ: [10, 2, -6, -14, -22],
  pupitre: new THREE.Vector3(0, 1.3, -11),
  bougie: new THREE.Vector3(0.95, 2.78, -10.75),
};

const COULEURS_LIVRES = ["#2b4a6b", "#35607a", "#1f3a55", "#3f6f78", "#4b5f86", "#2a5560", "#58779a", "#33507a", "#6d8aa6", "#26465a"];

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
  dallage.repeat.set(10, 20);
  // Les marches reprennent les dalles, plus grandes : sans leurs joints, l'estrade se lit comme un bloc.
  const dallesMarches = textureDallage();
  dallesMarches.repeat.set(4, 3);
  return {
    gradientMap,
    pierre: toon("#4d7c86"),
    bois: toon("#2a465a"),
    livres: toon("#ffffff"),
    sol: toon("#7e9fb4", { map: dallage }),
    marches: toon("#7896a8", { map: dallesMarches }),
    pupitre: toon("#3b5a70"),
    vitrail: new THREE.MeshBasicMaterial({ map: textureVitrail(), fog: false }),
    cire: new THREE.MeshBasicMaterial({ color: "#dfe6e8" }),
    toon,
  };
}

function colonnes() {
  const pieces = [];
  for (const cote of [-1, 1]) {
    for (const z of PLAN.coloZ) {
      const x = cote * PLAN.colonne;
      pieces.push(new THREE.CylinderGeometry(0.42, 0.46, 17, 10).translate(x, 8.5, z));
      pieces.push(boite(1.2, 0.6, 1.2, x, 0.3, z), boite(1.1, 0.45, 1.1, x, 17.2, z));
      // Une colonnette engagée de chaque côté : le faisceau gothique.
      pieces.push(new THREE.CylinderGeometry(0.16, 0.16, 17, 6).translate(x - cote * 0.05, 8.5, z + 0.5));
      pieces.push(new THREE.CylinderGeometry(0.16, 0.16, 17, 6).translate(x - cote * 0.05, 8.5, z - 0.5));
    }
  }
  return pieces;
}

// Les arcs qui ne portent plus rien : deux arcs transversaux au-dessus de la nef,
// et une arcade le long de chaque rayonnage, entre les colonnes.
function arcs() {
  const pieces = [];
  for (const z of [2, -14]) {
    pieces.push(...arcEnTube(PLAN.colonne * 2, 17.4, 0.34, (x, y) => new THREE.Vector3(x, y, z)));
  }
  for (const cote of [-1, 1]) {
    for (let i = 0; i < PLAN.coloZ.length - 1; i += 1) {
      const milieu = (PLAN.coloZ[i] + PLAN.coloZ[i + 1]) / 2;
      const ecart = PLAN.coloZ[i] - PLAN.coloZ[i + 1];
      pieces.push(...arcEnTube(ecart, 17.4, 0.22, (u, y) => new THREE.Vector3(cote * PLAN.colonne, y, milieu + u)));
    }
    // La corniche qui couronne les rayonnages.
    pieces.push(boite(1.6, 0.5, PLAN.avant - PLAN.fond, cote * (PLAN.facade - 0.7), PLAN.hauteurRayons + 0.25, (PLAN.avant + PLAN.fond) / 2));
  }
  return pieces;
}

// Les lancettes du mur du fond : [centre x, bas, largeur, naissance, rayon relatif].
const FENETRES = [[0, 5.9, 3.0, 10.6, 1.2], [-4.3, 5.9, 2.0, 9.6, 1.25], [4.3, 5.9, 2.0, 9.6, 1.25]];

function murDuFond() {
  // Un mur bas couronné d'un seul pignon en ogive : au-dessus, tout le reste est ciel.
  const demi = PLAN.facade + 0.5;
  const forme = new THREE.Shape();
  forme.moveTo(-demi, 0);
  forme.lineTo(-demi, 12.4);
  for (const p of pointsOgive(9, 12.4, 1, 12)) forme.lineTo(p.x, p.y);
  forme.lineTo(demi, 12.4);
  forme.lineTo(demi, 0);
  forme.lineTo(-demi, 0);
  for (const [cx, bas, largeur, naissance, rayon] of FENETRES) {
    forme.holes.push(contourFenetre(new THREE.Path(), cx, bas, largeur, naissance, rayon));
  }
  const rosace = new THREE.Path();
  rosace.absarc(0, 15.3, 1.0, 0, Math.PI * 2, true);
  forme.holes.push(rosace);
  const mur = new THREE.ExtrudeGeometry(forme, { depth: 0.8, bevelEnabled: false, curveSegments: 16 });
  mur.translate(0, 0, PLAN.fond - 0.8);
  // Les meneaux : un montant au milieu de chaque lancette.
  const meneaux = FENETRES.map(([cx, bas, , naissance]) => boite(0.16, naissance - bas + 1.2, 0.3, cx, (bas + naissance + 1.2) / 2, PLAN.fond - 0.35));
  return [mur, ...meneaux];
}

function vitraux(materiau) {
  const plans = FENETRES.map(([cx, bas, largeur, naissance, rayon]) => {
    const fleche = Math.sqrt((largeur * rayon) ** 2 - (largeur * rayon - largeur / 2) ** 2);
    const hauteur = naissance + fleche - bas;
    return new THREE.PlaneGeometry(largeur, hauteur).translate(cx, bas + hauteur / 2, PLAN.fond - 0.5);
  });
  plans.push(new THREE.PlaneGeometry(2.1, 2.1).translate(0, 15.3, PLAN.fond - 0.5));
  return new THREE.Mesh(fusionner(plans), materiau);
}

function marchesEtEstrade() {
  // Cinq marches de 26 cm ; la dernière forme l'estrade du pupitre, jusqu'à z = -14.
  const pieces = [];
  const fin = -14;
  for (let i = 0; i < 5; i += 1) {
    const haut = 0.26 * (i + 1);
    const avant = -6.2 - 0.6 * i;
    pieces.push(boite(8 - i * 0.3, haut, avant - fin, 0, haut / 2, (avant + fin) / 2));
  }
  return pieces;
}

// Bois : dos des rayonnages, tablettes, montants, et le pupitre.
function rayonnages() {
  const pieces = [];
  const longueur = PLAN.avant - PLAN.fond;
  const milieuZ = (PLAN.avant + PLAN.fond) / 2;
  for (const cote of [-1, 1]) {
    pieces.push(boite(0.2, PLAN.hauteurRayons, longueur, cote * PLAN.facade, PLAN.hauteurRayons / 2, milieuZ));
    for (let y = 0.15; y < PLAN.hauteurRayons; y += 1.05) {
      pieces.push(boite(1.3, 0.09, longueur, cote * (PLAN.facade - 0.65), y, milieuZ));
    }
    for (let z = PLAN.avant; z > PLAN.fond; z -= 2.6) {
      pieces.push(boite(1.3, PLAN.hauteurRayons, 0.12, cote * (PLAN.facade - 0.65), PLAN.hauteurRayons / 2, z));
    }
  }
  // La bibliothèque basse du mur du fond, sous les lancettes.
  for (let y = 0.15; y < 5.4; y += 1.05) pieces.push(boite(13, 0.09, 1.0, 0, y, PLAN.fond + 0.5));
  for (let x = -6.5; x <= 6.5; x += 2.6) pieces.push(boite(0.12, 5.4, 1.0, x, 2.7, PLAN.fond + 0.5));
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

// Les livres d'un compartiment, serrés, de hauteurs et d'épaisseurs variées, parfois un vide.
function remplirCompartiment(livres, alea, { debut, fin, y, hauteurMax, poser }) {
  let curseur = debut + 0.04;
  while (curseur < fin - 0.1) {
    if (alea() < 0.05) { curseur += 0.15 + alea() * 0.35; continue; }
    const epaisseur = 0.07 + alea() * 0.11;
    const hauteur = hauteurMax * (0.6 + alea() * 0.32);
    const profondeur = 0.75 + alea() * 0.2;
    livres.push({ ...poser(curseur + epaisseur / 2, y + hauteur / 2, epaisseur, hauteur, profondeur, alea), teinte: alea() });
    curseur += epaisseur + 0.004;
  }
}

function listerLivres() {
  const livres = [];
  const alea = hasard(24);
  for (const cote of [-1, 1]) {
    for (let y = 0.2; y < PLAN.hauteurRayons - 0.9; y += 1.05) {
      for (let z = PLAN.avant; z > PLAN.fond + 0.2; z -= 2.6) {
        remplirCompartiment(livres, alea, {
          debut: 0, fin: 2.6 - 0.12, y, hauteurMax: 0.95,
          poser: (u, yy, e, h, p, a) => ({ x: cote * (PLAN.facade - 0.1 - p / 2 + a() * 0.04), y: yy, z: z - 0.06 - u, sx: p, sy: h, sz: e }),
        });
      }
    }
  }
  for (let y = 0.2; y < 4.6; y += 1.05) {
    for (let x = -6.5; x < 6.4; x += 2.6) {
      remplirCompartiment(livres, alea, {
        debut: 0, fin: 2.6 - 0.12, y, hauteurMax: 0.95,
        poser: (u, yy, e, h, p, a) => ({ x: x + 0.06 + u, y: yy, z: PLAN.fond + 0.95 - p / 2 - a() * 0.04, sx: e, sy: h, sz: p }),
      });
    }
  }
  return livres;
}

// Tous les livres en un seul appel de dessin (InstancedMesh), chacun avec sa couleur.
function creerLivres(materiau) {
  const livres = listerLivres();
  const maillage = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materiau, livres.length);
  const matrice = new THREE.Matrix4();
  const couleur = new THREE.Color();
  livres.forEach((l, i) => {
    matrice.makeScale(l.sx, l.sy, l.sz).setPosition(l.x, l.y, l.z);
    maillage.setMatrixAt(i, matrice);
    couleur.set(COULEURS_LIVRES[Math.floor(l.teinte * COULEURS_LIVRES.length) % COULEURS_LIVRES.length]);
    maillage.setColorAt(i, couleur.offsetHSL(0, 0, (l.teinte * 7 % 1 - 0.5) * 0.06));
  });
  maillage.instanceMatrix.needsUpdate = true;
  return maillage;
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

export function creerNef(materiaux) {
  const groupe = new THREE.Group();
  const pierre = fusionner([...colonnes(), ...arcs(), ...murDuFond()]);
  const bois = fusionner(rayonnages());
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(PLAN.facade * 2 + 1, PLAN.avant - PLAN.fond + 2).rotateX(-Math.PI / 2), materiaux.sol);
  sol.position.z = (PLAN.avant + PLAN.fond) / 2;
  const cierge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.32, 8), materiaux.cire);
  cierge.position.set(PLAN.bougie.x, PLAN.bougie.y - 0.3, PLAN.bougie.z);
  groupe.add(
    new THREE.Mesh(pierre, materiaux.pierre),
    new THREE.Mesh(fusionner(marchesEtEstrade()), materiaux.marches),
    new THREE.Mesh(bois, materiaux.bois),
    new THREE.Mesh(fusionner(pupitre()), materiaux.pupitre),
    sol, cierge, vitraux(materiaux.vitrail), creerLivres(materiaux.livres),
  );
  creerLumieres(groupe);
  return groupe;
}
