// Outils de géométrie procédurale : rien n'est chargé, tout est construit ici.
// Fusionner les pièces d'un même matériau en un seul maillage, c'est un seul appel de dessin.
import * as THREE from "../../vendor/three.module.min.js";

// Fusionne des géométries (positions, normales, uv) en une seule, non indexée.
export function fusionner(geometries) {
  const parties = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parties.reduce((n, g) => n + g.attributes.position.count, 0);
  const positions = new Float32Array(total * 3);
  const normales = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  let decalage = 0;
  for (const g of parties) {
    positions.set(g.attributes.position.array, decalage * 3);
    normales.set(g.attributes.normal.array, decalage * 3);
    if (g.attributes.uv) uvs.set(g.attributes.uv.array, decalage * 2);
    decalage += g.attributes.position.count;
  }
  for (const g of new Set([...geometries, ...parties])) g.dispose();
  const resultat = new THREE.BufferGeometry();
  resultat.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  resultat.setAttribute("normal", new THREE.BufferAttribute(normales, 3));
  resultat.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  resultat.computeBoundingSphere();
  return resultat;
}

// Une boîte posée à (x, y, z), éventuellement tournée autour de x puis de y.
export function boite(largeur, hauteur, profondeur, x, y, z, { rx = 0, ry = 0 } = {}) {
  const g = new THREE.BoxGeometry(largeur, hauteur, profondeur);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
}

// Les points d'une ogive (arc brisé) centrée en x = 0, dont les naissances sont à la hauteur `y`.
// `rayonRelatif` = 1 donne l'arc équilatéral ; plus grand, l'arc devient une lancette élancée.
export function pointsOgive(largeur, y, rayonRelatif = 1, pas = 10) {
  const rayon = largeur * rayonRelatif;
  const centreGauche = -largeur / 2 + rayon;
  const angleSommet = Math.acos(-centreGauche / rayon);
  const gauche = [];
  for (let i = 0; i <= pas; i += 1) {
    const angle = Math.PI + (angleSommet - Math.PI) * (i / pas);
    gauche.push(new THREE.Vector2(centreGauche + rayon * Math.cos(angle), y + rayon * Math.sin(angle)));
  }
  const droite = gauche.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  return [...gauche, ...droite];
}

// Le contour fermé d'une fenêtre en ogive : deux montants droits puis l'arc.
export function contourFenetre(chemin, cx, bas, largeur, naissance, rayonRelatif) {
  const arc = pointsOgive(largeur, naissance, rayonRelatif);
  chemin.moveTo(cx - largeur / 2, bas);
  for (const p of arc) chemin.lineTo(cx + p.x, p.y);
  chemin.lineTo(cx + largeur / 2, bas);
  chemin.lineTo(cx - largeur / 2, bas);
  return chemin;
}

// Un arc brisé en 3D (deux tubes qui se rejoignent à la clé), dans le plan donné par `poser`.
export function arcEnTube(largeur, naissance, rayonTube, poser) {
  const points = pointsOgive(largeur, naissance, 1, 14);
  const milieu = Math.floor(points.length / 2);
  const moities = [points.slice(0, milieu + 1), points.slice(milieu)];
  return moities.map((moitie) => {
    const courbe = new THREE.CatmullRomCurve3(moitie.map((p) => poser(p.x, p.y)));
    return new THREE.TubeGeometry(courbe, 16, rayonTube, 6, false);
  });
}

// Un arc brisé surbaissé taillé dans une dalle : un bandeau plein de `bas` à `haut`, évidé par
// dessous d'un intrados pointu de flèche `fleche`. Sert aux arcades sous les coursives et à la passerelle.
// Construit dans le plan xy (centré en x = 0), épais de `epaisseur` le long de z.
export function arcDalle(largeur, bas, haut, fleche, epaisseur, pas = 18) {
  const forme = new THREE.Shape();
  const demi = largeur / 2;
  forme.moveTo(-demi, haut);
  forme.lineTo(demi, haut);
  forme.lineTo(demi, bas);
  for (let i = 1; i < pas; i += 1) {
    const u = 1 - (2 * i) / pas; // de 1 à -1
    // Départ vertical aux naissances, deux courbes qui se rejoignent en pointe à la clé.
    forme.lineTo(u * demi, bas + fleche * (1 - Math.abs(u)) ** 0.6);
  }
  forme.lineTo(-demi, bas);
  forme.lineTo(-demi, haut);
  const g = new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: false });
  return g.translate(0, 0, -epaisseur / 2);
}

// Pseudo-aléatoire déterministe : la même scène à chaque visite.
export function hasard(graine) {
  let etat = (graine * 2654435761) % 4294967296;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}
