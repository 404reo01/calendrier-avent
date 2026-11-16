// Les numéros des 24 étoiles, écrits à la plume à côté de chacune. Un atlas dessiné sur un canvas
// (les 24 nombres, avec un halo d'encre sombre pour rester lisibles sur la Voie lactée), un seul appel
// de dessin (Points). La place de chaque numéro est choisie une fois par cadrage, en pixels :
// le premier emplacement autour de l'étoile qui ne touche ni une autre étoile ni un autre numéro.
import * as THREE from "../../vendor/three.module.min.js";

const POLICE = "'Grenze Gotisch', 'Times New Roman', serif";
const CELLULE = 64;
const COLONNES = 8;
const LIGNES = 3;
const MARGE = 3; // px CSS entre deux éléments

function dessinerAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = CELLULE * COLONNES;
  canvas.height = CELLULE * LIGNES;
  const ctx = canvas.getContext("2d");
  ctx.font = `700 40px ${POLICE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // Deux canaux : le vert porte le halo, le rouge la lettre. Le shader choisit les couleurs.
  ctx.globalCompositeOperation = "lighter";
  const largeurs = [];
  for (let i = 0; i < 24; i += 1) {
    const x = (i % COLONNES) * CELLULE + CELLULE / 2;
    const y = Math.floor(i / COLONNES) * CELLULE + CELLULE / 2 + 2;
    const texte = String(i + 1);
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 9;
    ctx.strokeText(texte, x, y);
    ctx.fillStyle = "#ff0000";
    ctx.fillText(texte, x, y);
    largeurs.push(ctx.measureText(texte).width / CELLULE);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return { texture, largeurs, hauteur: 30 / CELLULE };
}

function creerMateriau(partages, atlas, taille) {
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { ...partages, uAtlas: { value: atlas }, uTaille: { value: taille } },
    vertexShader: /* glsl */ `
      attribute float aJour, aEtat, aAllumage; attribute vec2 aDecalage;
      uniform float uRatio, uTaille; uniform vec2 uResolution;
      varying vec2 vCellule; varying float vEtat, vAllumage;
      void main() {
        vEtat = aEtat; vAllumage = aAllumage;
        vCellule = vec2(mod(aJour, ${COLONNES}.0), floor(aJour / ${COLONNES}.0));
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Le décalage est en pixels CSS, à côté de l'étoile, quel que soit l'éloignement.
        p.xy += aDecalage * uRatio * 2.0 / uResolution * p.w;
        gl_Position = p;
        gl_PointSize = uTaille * uRatio;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; varying vec2 vCellule; varying float vEtat, vAllumage;
      void main() {
        vec2 uv = vec2((vCellule.x + gl_PointCoord.x) / ${COLONNES}.0, 1.0 - (vCellule.y + gl_PointCoord.y) / ${LIGNES}.0);
        vec4 t = texture2D(uAtlas, uv);
        float allume = clamp(vAllumage, 0.0, 1.0);
        float duJour = step(1.5, vEtat) * (1.0 - allume);
        // Fermée : encre pâle et discrète. Ouverte : presque blanc. Du jour : la couleur de la flamme.
        vec3 teinte = mix(vec3(0.6, 0.7, 0.86), vec3(0.93, 0.96, 1.0), allume);
        teinte = mix(teinte, vec3(1.0, 0.7, 0.38), duJour);
        float force = mix(0.6, 1.0, max(allume, duJour));
        float a = max(t.r, t.g * 0.6) * force;
        if (a < 0.02) discard;
        gl_FragColor = vec4(mix(vec3(0.02, 0.04, 0.12), teinte, t.r), a);
        #include <colorspace_fragment>
      }`,
  });
}

function chevauche(a, b) {
  return a.x0 < b.x1 + MARGE && b.x0 < a.x1 + MARGE && a.y0 < b.y1 + MARGE && b.y0 < a.y1 + MARGE;
}

// Choisit, pour chaque étoile, où poser son numéro (décalage en px CSS, y vers le haut).
function disposer(ecrans, mesures, rayonEtoile, cadre) {
  const disques = ecrans.map((p) => ({ x0: p.x - rayonEtoile, x1: p.x + rayonEtoile, y0: p.y - rayonEtoile, y1: p.y + rayonEtoile }));
  const centre = ecrans.reduce((s, p) => ({ x: s.x + p.x / ecrans.length, y: s.y + p.y / ecrans.length }), { x: 0, y: 0 });
  const poses = [];
  return ecrans.map((p, i) => {
    const { l, h } = mesures[i];
    const dehors = Math.atan2(p.y - centre.y, p.x - centre.x);
    const essais = Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4)
      .sort((a, b) => Math.abs(Math.atan2(Math.sin(a - dehors), Math.cos(a - dehors))) - Math.abs(Math.atan2(Math.sin(b - dehors), Math.cos(b - dehors))));
    let meilleur = null;
    for (const angle of essais) {
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      const d = rayonEtoile + MARGE + Math.abs(cx) * l / 2 + Math.abs(cy) * h / 2;
      const r = { x0: p.x + cx * d - l / 2, x1: p.x + cx * d + l / 2, y0: p.y + cy * d - h / 2, y1: p.y + cy * d + h / 2 };
      const conflits = disques.filter((q, j) => j !== i && chevauche(r, q)).length + poses.filter((q) => chevauche(r, q)).length
        + (r.x0 < 0 || r.y0 < 0 || r.x1 > cadre.x || r.y1 > cadre.y ? 1 : 0);
      if (!meilleur || conflits < meilleur.conflits) meilleur = { r, conflits, dx: cx * d, dy: cy * d };
      if (conflits === 0) break;
    }
    poses.push(meilleur.r);
    return [meilleur.dx, -meilleur.dy];
  });
}

export function creerNumeros({ partages, etats, allumages, taille, tailleEtoile }) {
  const atlas = dessinerAtlas();
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(new Float32Array(72), 3));
  geometrie.setAttribute("aJour", new THREE.BufferAttribute(Float32Array.from({ length: 24 }, (_, i) => i), 1));
  // Les mêmes attributs que les étoiles : un numéro change d'aspect au moment où son étoile s'allume.
  geometrie.setAttribute("aEtat", etats);
  geometrie.setAttribute("aAllumage", allumages);
  geometrie.setAttribute("aDecalage", new THREE.BufferAttribute(new Float32Array(48), 2));
  const points = new THREE.Points(geometrie, creerMateriau(partages, atlas.texture, taille));
  points.frustumCulled = false;
  points.renderOrder = 3;
  const mesures = atlas.largeurs.map((l) => ({ l: l * taille, h: atlas.hauteur * taille }));
  // Le cœur visible d'une étoile, avec son anneau du jour : c'est la zone que les numéros évitent.
  const rayonEtoile = tailleEtoile * 0.3;

  return {
    objet: points,
    // Appelée quand les étoiles ont été placées, avec la caméra de repos.
    placer(positions, camera) {
      const cadre = { x: partages.uResolution.value.x / partages.uRatio.value, y: partages.uResolution.value.y / partages.uRatio.value };
      const ndc = new THREE.Vector3();
      const ecrans = positions.map((p) => {
        ndc.copy(p).project(camera);
        return { x: (ndc.x + 1) / 2 * cadre.x, y: (1 - ndc.y) / 2 * cadre.y };
      });
      const tampon = geometrie.attributes.position;
      positions.forEach((p, i) => p.toArray(tampon.array, i * 3));
      tampon.needsUpdate = true;
      const decalages = geometrie.attributes.aDecalage;
      disposer(ecrans, mesures, rayonEtoile, cadre).forEach(([dx, dy], i) => decalages.setXY(i, dx, dy));
      decalages.needsUpdate = true;
    },
  };
}
