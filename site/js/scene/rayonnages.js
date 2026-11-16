// Les rayonnages : trois niveaux de tablettes de chaque côté de la nef, la bibliothèque basse du fond,
// et tous les livres en un seul appel de dessin (InstancedMesh, une couleur par livre).
import * as THREE from "../../vendor/three.module.min.js";
import { boite, hasard } from "./geometrie.js";
import { PLAN } from "./plan.js";

const COULEURS_LIVRES = ["#2b4a6b", "#35607a", "#1f3a55", "#3f6f78", "#4b5f86", "#2a5560", "#58779a", "#33507a", "#6d8aa6", "#26465a"];
const PAS_TABLETTE = 1.05;
const LARGEUR_CASIER = 2.6;
const PROFONDEUR = PLAN.facade - PLAN.rayons;
// La bibliothèque basse du mur du fond, sous les lancettes.
const FOND_BAS = { largeur: 13, hauteur: 5.4 };

// Le bas et le haut des tablettes d'un niveau : chaque coursive pose sa dalle sur le niveau du dessous.
function etendueNiveau(plancher) {
  return { bas: plancher, haut: plancher + PLAN.hauteurNiveau - (plancher + PLAN.hauteurNiveau < PLAN.sommet ? PLAN.dalle : 0) };
}

export function boiseries() {
  const pieces = [];
  const longueur = PLAN.avant - PLAN.fond;
  const milieuZ = (PLAN.avant + PLAN.fond) / 2;
  const xRayon = PLAN.facade - PROFONDEUR / 2;
  for (const cote of [-1, 1]) {
    pieces.push(boite(0.2, PLAN.sommet, longueur, cote * PLAN.facade, PLAN.sommet / 2, milieuZ));
    for (const plancher of PLAN.niveaux) {
      const { bas, haut } = etendueNiveau(plancher);
      for (let y = bas + 0.15; y < haut - 0.3; y += PAS_TABLETTE) pieces.push(boite(PROFONDEUR, 0.09, longueur, cote * xRayon, y, milieuZ));
      for (let z = PLAN.avant; z > PLAN.fond; z -= LARGEUR_CASIER) {
        pieces.push(boite(PROFONDEUR, haut - bas, 0.12, cote * xRayon, (bas + haut) / 2, z));
      }
    }
  }
  const { largeur, hauteur } = FOND_BAS;
  for (let y = 0.15; y < hauteur; y += PAS_TABLETTE) pieces.push(boite(largeur, 0.09, 1.0, 0, y, PLAN.fond + 0.5));
  for (let x = -largeur / 2; x <= largeur / 2; x += LARGEUR_CASIER) pieces.push(boite(0.12, hauteur, 1.0, x, hauteur / 2, PLAN.fond + 0.5));
  return pieces;
}

// Les livres d'un casier, serrés, de hauteurs et d'épaisseurs variées, parfois un vide ou un livre couché.
function remplirCasier(livres, alea, { y, poser }) {
  let curseur = 0.04;
  while (curseur < LARGEUR_CASIER - 0.22) {
    if (alea() < 0.05) { curseur += 0.15 + alea() * 0.35; continue; }
    const epaisseur = 0.07 + alea() * 0.11;
    const hauteur = 0.95 * (0.6 + alea() * 0.32);
    const profondeur = 0.75 + alea() * 0.2;
    livres.push({ ...poser(curseur + epaisseur / 2, y + hauteur / 2, epaisseur, hauteur, profondeur, alea), teinte: alea() });
    curseur += epaisseur + 0.004;
  }
}

// Sur téléphone, le cadrage vertical ne voit les murs latéraux qu'au loin : on ne remplit que cette partie.
function listerLivres(reduit) {
  const livres = [];
  const alea = hasard(24);
  const zMax = reduit ? -6 : PLAN.avant;
  for (const cote of [-1, 1]) {
    for (const plancher of PLAN.niveaux) {
      const { bas, haut } = etendueNiveau(plancher);
      for (let y = bas + 0.2; y < haut - 0.9; y += PAS_TABLETTE) {
        for (let z = PLAN.avant; z > PLAN.fond + 0.2; z -= LARGEUR_CASIER) {
          if (z > zMax) continue;
          remplirCasier(livres, alea, {
            y,
            poser: (u, yy, e, h, p, a) => ({ x: cote * (PLAN.facade - 0.1 - p / 2 + a() * 0.04), y: yy, z: z - 0.06 - u, sx: p, sy: h, sz: e }),
          });
        }
      }
    }
  }
  const { largeur, hauteur } = FOND_BAS;
  for (let y = 0.2; y < hauteur - 0.8; y += PAS_TABLETTE) {
    for (let x = -largeur / 2; x < largeur / 2 - 0.1; x += LARGEUR_CASIER) {
      remplirCasier(livres, alea, {
        y,
        poser: (u, yy, e, h, p, a) => ({ x: x + 0.06 + u, y: yy, z: PLAN.fond + 0.95 - p / 2 - a() * 0.04, sx: e, sy: h, sz: p }),
      });
    }
  }
  return livres;
}

export function creerLivres(materiau, reduit) {
  const livres = listerLivres(reduit);
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
