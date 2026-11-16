// Le décor : mur, plancher, rayonnage, haute fenêtre où tombe la neige, bougies qui vacillent.
// Géométries simples uniquement (boîtes, cylindres, plans) : rien à télécharger.
import * as THREE from "../../vendor/three.module.min.js";
import { textureDeCiel, textureDeFlamme, textureRonde, hasard } from "./textures.js";

const BOIS = "#3a2415";
const BOIS_CLAIR = "#5a3a22";

function boite(l, h, p, materiau, x, y, z) {
  const maillage = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), materiau);
  maillage.position.set(x, y, z);
  return maillage;
}

export function creerPieceEtLumieres(scene, { reduit }) {
  scene.background = new THREE.Color("#0c1222");
  scene.add(new THREE.AmbientLight("#5a6a96", 0.85));
  // La lumière froide de la fenêtre, venue de la gauche.
  const lune = new THREE.DirectionalLight("#9fb8e8", 0.9);
  lune.position.set(-4, 3, 3);
  scene.add(lune);
  const mur = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshLambertMaterial({ color: "#1d2438" }));
  mur.position.set(0, 4, -0.8);
  scene.add(mur);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshLambertMaterial({ color: "#21160e" }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.set(0, reduit ? 0 : -0.05, 3);
  scene.add(sol);
}

// Le meuble : deux planches, des montants, un fond. Les livres sont posés dessus (voir livres.js).
export function creerRayonnage({ largeur, planches }) {
  const groupe = new THREE.Group();
  const bois = new THREE.MeshLambertMaterial({ color: BOIS });
  const boisClair = new THREE.MeshLambertMaterial({ color: BOIS_CLAIR });
  const haut = planches.at(-1) + 1.55;
  groupe.add(boite(largeur + 0.3, haut + 0.1, 0.06, bois, 0, haut / 2, -0.52));
  for (const cote of [-1, 1]) groupe.add(boite(0.14, haut + 0.2, 1.08, boisClair, cote * (largeur / 2 + 0.08), haut / 2, 0));
  for (const y of planches) groupe.add(boite(largeur + 0.3, 0.1, 1.08, boisClair, 0, y - 0.05, 0));
  groupe.add(boite(largeur + 0.5, 0.14, 1.16, boisClair, 0, haut + 0.07, 0));
  return groupe;
}

// La fenêtre : un ciel d'hiver, des montants, et la neige contenue dans son cadre.
export function creerFenetre({ x, y, largeur, hauteur, nombreFlocons }) {
  const groupe = new THREE.Group();
  groupe.position.set(x, y, -0.78);
  const ciel = new THREE.Mesh(
    new THREE.PlaneGeometry(largeur, hauteur),
    new THREE.MeshBasicMaterial({ map: textureDeCiel() }),
  );
  groupe.add(ciel);
  const bois = new THREE.MeshLambertMaterial({ color: BOIS_CLAIR });
  const epaisseur = 0.1;
  groupe.add(boite(largeur + 0.2, epaisseur, 0.12, bois, 0, hauteur / 2, 0.08));
  groupe.add(boite(largeur + 0.3, epaisseur * 1.4, 0.3, bois, 0, -hauteur / 2, 0.14));
  for (const cote of [-1, 1]) groupe.add(boite(epaisseur, hauteur, 0.12, bois, cote * largeur / 2, 0, 0.08));
  groupe.add(boite(0.05, hauteur, 0.06, bois, 0, 0, 0.1));
  for (const k of [-0.2, 0.2]) groupe.add(boite(largeur, 0.05, 0.06, bois, 0, k * hauteur, 0.1));
  const neige = creerNeige({ largeur: largeur - 0.1, hauteur: hauteur - 0.1, nombre: nombreFlocons });
  neige.points.position.z = 0.04;
  groupe.add(neige.points);
  return { groupe, neige };
}

function creerNeige({ largeur, hauteur, nombre }) {
  const alea = hasard(11);
  const positions = new Float32Array(nombre * 3);
  const vitesses = new Float32Array(nombre);
  for (let i = 0; i < nombre; i += 1) {
    positions[i * 3] = (alea() - 0.5) * largeur;
    positions[i * 3 + 1] = (alea() - 0.5) * hauteur;
    vitesses[i] = 0.12 + alea() * 0.22;
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometrie, new THREE.PointsMaterial({
    size: 0.045,
    map: textureRonde("rgba(255,255,255,1)", "rgba(255,255,255,0)"),
    transparent: true,
    depthWrite: false,
    color: "#e6eeff",
  }));
  function maj(dt, maintenant) {
    const t = maintenant / 1000;
    for (let i = 0; i < nombre; i += 1) {
      let yFlocon = positions[i * 3 + 1] - vitesses[i] * dt;
      if (yFlocon < -hauteur / 2) yFlocon += hauteur;
      positions[i * 3 + 1] = yFlocon;
      // Léger balancement latéral, borné au cadre de la fenêtre.
      const xFlocon = positions[i * 3] + Math.sin(t * 0.8 + i) * 0.0025;
      positions[i * 3] = Math.max(-largeur / 2, Math.min(largeur / 2, xFlocon));
    }
    geometrie.attributes.position.needsUpdate = true;
  }
  return { points, maj };
}

// Une bougie : cire, mèche, flamme (sprite additif) ; une seule lumière ponctuelle par groupe.
function bougie(x, y, z, hauteur, flamme) {
  const groupe = new THREE.Group();
  const cire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.075, hauteur, 16),
    new THREE.MeshLambertMaterial({ color: "#efe3c8", emissive: "#3a2410" }),
  );
  cire.position.y = hauteur / 2;
  groupe.add(cire);
  const sprite = new THREE.Sprite(flamme);
  sprite.scale.set(0.11, 0.22, 1);
  sprite.position.y = hauteur + 0.1;
  groupe.add(sprite);
  groupe.position.set(x, y, z);
  return { groupe, sprite };
}

export function creerBougies(positions) {
  const groupe = new THREE.Group();
  const flamme = new THREE.SpriteMaterial({
    map: textureDeFlamme(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const flammes = positions.map(([x, y, z, h]) => {
    const { groupe: b, sprite } = bougie(x, y, z, h, flamme);
    groupe.add(b);
    return sprite;
  });
  const [cx, cy, cz, ch] = positions[0];
  const lumiere = new THREE.PointLight("#ffb35c", 12, 0, 2);
  lumiere.position.set(cx, cy + ch + 0.35, cz + 0.2);
  groupe.add(lumiere);
  const base = lumiere.intensity;
  // Vacillement doux : une somme de sinus lents, jamais un clignotement.
  function maj(maintenant) {
    const t = maintenant / 1000;
    const souffle = 1 + 0.06 * Math.sin(t * 7.1) + 0.04 * Math.sin(t * 11.3 + 1.7);
    lumiere.intensity = base * souffle;
    flammes.forEach((sprite, i) => { sprite.scale.y = 0.22 * (1 + 0.08 * Math.sin(t * 9 + i * 2.1)); });
  }
  return { groupe, maj };
}
