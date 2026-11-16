// Les étages : coursives à balustrade portées par des arcades, passerelle qui traverse la nef
// au 2e niveau, escaliers en colimaçon et échelles sur rail. Ce module ne crée aucun maillage :
// il rend des pièces par matériau (fusionnées ensuite) et des listes d'instances (balustres, marches).
import * as THREE from "../../vendor/three.module.min.js";
import { arcDalle, boite } from "./geometrie.js";
import { PLAN } from "./plan.js";

const PAS_BALUSTRE = 0.3;
const HAUTEUR_GARDE_CORPS = 0.95;
const LARGEUR_PASSERELLE = 2.2;
const MARCHE = { hauteur: 0.21, angle: 0.4, rayon: 1.15 };

// Escaliers en colimaçon : [x, z, hauteur atteinte]. L'un monte au 3e niveau, l'autre au 2e.
const COLIMACONS = [[-7.15, 5.5, PLAN.niveaux[2]], [7.15, -22.5, PLAN.niveaux[1]]];
// Échelles appuyées sur leur rail : [côté, niveau, z].
const ECHELLES = [[-1, 0, -1.2], [1, 1, 7.8], [1, 0, -28.4], [-1, 2, -20.6], [-1, 1, -34.2], [1, 2, 0.6]];

function etat() {
  return { pierre: [], bois: [], fer: [], balustres: [], marches: [] };
}

// Une balustrade droite de (x0, z0) à (x1, z1) au niveau y : balustres et main courante.
function balustrade(pieces, { x0, z0, x1, z1, y, fer = false, trous = [] }) {
  const longueur = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(2, Math.round(longueur / PAS_BALUSTRE));
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + (x1 - x0) * (i / n);
    const z = z0 + (z1 - z0) * (i / n);
    if (trous.some(([a, b]) => z > a && z < b)) continue;
    pieces.balustres.push({ x, y, z, h: HAUTEUR_GARDE_CORPS, fer });
  }
  const angle = Math.atan2(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const cible = fer ? pieces.fer : pieces.pierre;
  cible.push(boite(0.16, 0.1, longueur, cx, y + HAUTEUR_GARDE_CORPS, cz, { ry: angle }));
  cible.push(boite(0.12, 0.08, longueur, cx, y + 0.04, cz, { ry: angle }));
}

// Une coursive : la dalle, les arcades qui la portent entre les piles, la balustrade.
function coursive(pieces, cote, plancher, trous) {
  const longueur = PLAN.avant - PLAN.fond;
  const largeur = PLAN.rayons - PLAN.balcon;
  pieces.pierre.push(boite(largeur, PLAN.dalle, longueur, cote * (PLAN.balcon + largeur / 2), plancher - PLAN.dalle / 2, (PLAN.avant + PLAN.fond) / 2));
  for (let i = 0; i < PLAN.coloZ.length - 1; i += 1) {
    const milieu = (PLAN.coloZ[i] + PLAN.coloZ[i + 1]) / 2;
    const ecart = PLAN.coloZ[i] - PLAN.coloZ[i + 1];
    const sousDalle = plancher - PLAN.dalle;
    const arcade = arcDalle(ecart, sousDalle - 2.7, sousDalle, 2.2, 0.45).rotateY(Math.PI / 2);
    pieces.pierre.push(arcade.translate(cote * (PLAN.balcon + 0.25), 0, milieu));
  }
  balustrade(pieces, { x0: cote * (PLAN.balcon + 0.08), z0: PLAN.avant, x1: cote * (PLAN.balcon + 0.08), z1: PLAN.fond, y: plancher, trous });
}

function passerelle(pieces) {
  const z = PLAN.passerelleZ;
  const y = PLAN.niveaux[1];
  const portee = PLAN.balcon * 2;
  pieces.pierre.push(boite(portee, PLAN.dalle, LARGEUR_PASSERELLE, 0, y - PLAN.dalle / 2, z));
  // Un seul arc surbaissé, d'une pile à l'autre : la passerelle semble tenir par miracle.
  pieces.pierre.push(arcDalle(PLAN.colonne * 2, y - 1.9, y - PLAN.dalle, 1.25, 0.9).translate(0, 0, z));
  for (const bord of [-1, 1]) {
    const zb = z + bord * (LARGEUR_PASSERELLE / 2 - 0.08);
    balustrade(pieces, { x0: -PLAN.balcon, z0: zb, x1: PLAN.balcon, z1: zb, y });
  }
}

function colimacon(pieces, [cx, cz, haut]) {
  const nombre = Math.round(haut / MARCHE.hauteur);
  const rampe = [];
  for (let i = 0; i < nombre; i += 1) {
    const angle = i * MARCHE.angle;
    const y = (i + 1) * MARCHE.hauteur;
    pieces.marches.push({ x: cx, y, z: cz, angle });
    const bx = cx + Math.cos(angle) * (MARCHE.rayon - 0.05);
    const bz = cz - Math.sin(angle) * (MARCHE.rayon - 0.05);
    pieces.balustres.push({ x: bx, y, z: bz, h: HAUTEUR_GARDE_CORPS, fer: true });
    rampe.push(new THREE.Vector3(bx, y + HAUTEUR_GARDE_CORPS, bz));
  }
  pieces.fer.push(new THREE.CylinderGeometry(0.1, 0.12, haut + 1.2, 8).translate(cx, (haut + 1.2) / 2, cz));
  pieces.fer.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rampe), nombre * 2, 0.035, 4, false));
}

// Une échelle posée au pied du rayonnage, appuyée en haut sur le rail de son niveau.
function echelle(pieces, [cote, niveau, z]) {
  const plancher = PLAN.niveaux[niveau];
  const haut = 5.5;
  const ecart = 1.15;
  const longueur = Math.hypot(haut, ecart);
  const inclinaison = Math.atan2(ecart, haut);
  const locales = [boite(0.06, longueur, 0.06, 0, longueur / 2, -0.24), boite(0.06, longueur, 0.06, 0, longueur / 2, 0.24)];
  for (let y = 0.3; y < longueur - 0.1; y += 0.32) locales.push(boite(0.045, 0.045, 0.48, 0, y, 0));
  const pied = cote * (PLAN.rayons - 0.1 - ecart);
  for (const g of locales) pieces.bois.push(g.rotateZ(-cote * inclinaison).translate(pied, plancher, z));
}

function rails(pieces) {
  const longueur = PLAN.avant - PLAN.fond;
  for (const cote of [-1, 1]) {
    for (const plancher of PLAN.niveaux) {
      const rail = new THREE.CylinderGeometry(0.03, 0.03, longueur, 4).rotateX(Math.PI / 2);
      pieces.fer.push(rail.translate(cote * (PLAN.rayons - 0.06), plancher + 5.5, (PLAN.avant + PLAN.fond) / 2));
    }
  }
}

export function construireEtages() {
  const pieces = etat();
  const trouPasserelle = [PLAN.passerelleZ - LARGEUR_PASSERELLE / 2, PLAN.passerelleZ + LARGEUR_PASSERELLE / 2];
  for (const cote of [-1, 1]) {
    coursive(pieces, cote, PLAN.niveaux[1], [trouPasserelle]);
    coursive(pieces, cote, PLAN.niveaux[2], []);
  }
  passerelle(pieces);
  COLIMACONS.forEach((c) => colimacon(pieces, c));
  ECHELLES.forEach((e) => echelle(pieces, e));
  rails(pieces);
  return pieces;
}

// Les balustres (pierre des coursives, fer des colimaçons) en un seul appel de dessin.
export function creerBalustres(balustres, materiau, teintes) {
  const geometrie = new THREE.CylinderGeometry(0.035, 0.05, 1, 6).translate(0, 0.5, 0);
  const maillage = new THREE.InstancedMesh(geometrie, materiau, balustres.length);
  const matrice = new THREE.Matrix4();
  balustres.forEach((b, i) => {
    maillage.setMatrixAt(i, matrice.makeScale(1, b.h, 1).setPosition(b.x, b.y, b.z));
    maillage.setColorAt(i, b.fer ? teintes.fer : teintes.pierre);
  });
  return maillage;
}

// Les marches de tous les colimaçons : une même dalle tournée autour du noyau.
export function creerMarches(marches, materiau) {
  const geometrie = new THREE.BoxGeometry(MARCHE.rayon - 0.08, 0.06, 0.42).translate(0.08 + (MARCHE.rayon - 0.08) / 2, 0, 0);
  const maillage = new THREE.InstancedMesh(geometrie, materiau, marches.length);
  const matrice = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  marches.forEach((m, i) => {
    matrice.makeTranslation(m.x, m.y, m.z).multiply(rotation.makeRotationY(m.angle));
    maillage.setMatrixAt(i, matrice);
  });
  return maillage;
}
