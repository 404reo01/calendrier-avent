// Le ciel, héros de la scène : un dôme de nuit avec sa Voie lactée (calculé dans le shader,
// aucune image), des milliers d'étoiles qui scintillent, et la constellation des 24 skills.
import * as THREE from "../../vendor/three.module.min.js";
import { hasard } from "./geometrie.js";

const BRUIT_GLSL = /* glsl */ `
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bruit3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * bruit3(p); p *= 2.03; a *= 0.5; } return s; }
`;

// Le plan de la Voie lactée : un grand cercle incliné qui traverse la nef en diagonale.
const AXE_VOIE = new THREE.Vector3(0.8, 0.52, 0.3).normalize();

function creerDome() {
  const materiau = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color("#060f2c") },
      uMilieu: { value: new THREE.Color("#0f2a5e") },
      uHorizon: { value: new THREE.Color("#1d4c66") },
      uVoie: { value: new THREE.Color("#2c5aa6") },
      uVoieClaire: { value: new THREE.Color("#7da3dc") },
      uPoussiere: { value: new THREE.Color("#050b22") },
      uAxe: { value: AXE_VOIE },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uMilieu, uHorizon, uVoie, uVoieClaire, uPoussiere, uAxe;
      varying vec3 vDir;
      ${BRUIT_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(uHorizon, uMilieu, smoothstep(-0.05, 0.4, d.y));
        c = mix(c, uZenith, smoothstep(0.45, 1.0, d.y));
        float nuage = fbm3(d * 3.2 + 1.7);
        float distance = dot(d, uAxe) + (nuage - 0.5) * 0.22;
        float bande = exp(-pow(distance / 0.26, 2.0));
        float coeur = exp(-pow(distance / 0.1, 2.0));
        c = mix(c, uVoie, bande * smoothstep(0.2, 0.7, nuage));
        c = mix(c, uVoieClaire, (coeur * 0.9 + bande * 0.25) * smoothstep(0.4, 0.8, fbm3(d * 7.0 + 3.0)));
        // Les bancs de poussière sombre qui déchirent la bande.
        c = mix(c, uPoussiere, bande * smoothstep(0.52, 0.72, fbm3(d * 5.0 + 8.3)) * 0.85);
        // Une poussière d'étoiles minuscules, plus dense dans la bande.
        float semis = step(0.9975 - bande * 0.006, hash3(floor(d * 420.0)));
        c += semis * vec3(0.55, 0.65, 0.85) * (0.3 + 0.7 * bande);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), materiau);
  dome.position.z = -6;
  return dome;
}

// Le masque de profondeur : une étoile n'apparaît que là où la scène laisse voir le ciel.
const MASQUE_GLSL = /* glsl */ `
  uniform sampler2D uProfondeur; uniform vec2 uResolution;
  bool cacheParLaNef() { return texture2D(uProfondeur, gl_FragCoord.xy / uResolution).r < 0.99999; }
`;

function directionEtoile(alea) {
  // Plus d'étoiles près de la Voie lactée, comme dans un vrai ciel.
  for (;;) {
    const d = new THREE.Vector3(alea() * 2 - 1, alea() * 1.05 - 0.05, alea() * 2 - 1);
    if (d.lengthSq() > 1 || d.lengthSq() < 0.01) continue;
    d.normalize();
    const proche = Math.exp(-((d.dot(AXE_VOIE) / 0.3) ** 2));
    if (alea() < 0.3 + 0.7 * proche) return d;
  }
}

function creerEtoilesFond(nombre, partages) {
  const alea = hasard(5);
  const positions = new Float32Array(nombre * 3);
  const details = new Float32Array(nombre * 3);
  for (let i = 0; i < nombre; i += 1) {
    directionEtoile(alea).multiplyScalar(85).toArray(positions, i * 3);
    const eclat = alea() ** 4;
    details.set([1.6 + eclat * 8, 0.45 + eclat * 0.55, alea() * 6.28], i * 3);
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometrie.setAttribute("aDetails", new THREE.BufferAttribute(details, 3));
  geometrie.translate(0, 0, -6);
  const materiau = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: partages,
    vertexShader: /* glsl */ `
      attribute vec3 aDetails; uniform float uRatio, uTemps; varying float vEclat, vTaille;
      void main() {
        vTaille = aDetails.x;
        // Scintillement : chaque étoile a sa phase, rien n'est synchronisé.
        vEclat = aDetails.y * (0.72 + 0.28 * sin(uTemps * (1.1 + aDetails.z * 0.35) + aDetails.z * 9.0));
        gl_PointSize = aDetails.x * uRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${MASQUE_GLSL}
      varying float vEclat, vTaille;
      void main() {
        if (cacheParLaNef()) discard;
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        float a = exp(-r * r * 9.0);
        // Les plus grosses ont quatre branches fines, comme dessinées à la plume.
        float branches = step(4.5, vTaille) * (exp(-abs(p.x) * 26.0) + exp(-abs(p.y) * 26.0)) * (1.0 - r);
        a = (a + branches * 0.8) * vEclat;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) * a, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometrie, materiau);
  points.frustumCulled = false;
  return points;
}

// La constellation trace une spirale qui s'enroule vers la 24e étoile, légèrement irrégulière
// pour ne pas paraître tracée au compas. Coordonnées en écran normalisé (-1 à 1).
function formeConstellation(cadre) {
  const alea = hasard(12);
  return Array.from({ length: 24 }, (_, i) => {
    const k = i / 23;
    const angle = 0.2 + k * Math.PI * 2.75;
    const rayon = 1 - 0.72 * k;
    return new THREE.Vector2(
      cadre.cx + Math.cos(angle) * rayon * cadre.ex + (alea() - 0.5) * 0.06,
      cadre.cy + Math.sin(angle) * rayon * cadre.ey + (alea() - 0.5) * 0.05,
    );
  });
}

const VALEUR_ETAT = { fermee: 0, ouverte: 1, "du-jour": 2 };

function creerPointsConstellation(cases, partages, taille) {
  const geometrie = new THREE.BufferGeometry();
  const etats = new Float32Array(24);
  const allumages = new Float32Array(24);
  for (const c of cases) {
    etats[c.jour - 1] = VALEUR_ETAT[c.etat] ?? 0;
    allumages[c.jour - 1] = c.etat === "ouverte" ? 1 : 0;
  }
  geometrie.setAttribute("position", new THREE.BufferAttribute(new Float32Array(72), 3));
  geometrie.setAttribute("aEtat", new THREE.BufferAttribute(etats, 1));
  geometrie.setAttribute("aAllumage", new THREE.BufferAttribute(allumages, 1));
  geometrie.setAttribute("aSurvol", new THREE.BufferAttribute(new Float32Array(24), 1));
  const materiau = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...partages, uTaille: { value: taille } },
    vertexShader: /* glsl */ `
      attribute float aEtat, aAllumage, aSurvol; uniform float uRatio, uTemps, uTaille;
      varying float vEtat, vAllumage, vSurvol, vPouls;
      void main() {
        vEtat = aEtat; vAllumage = aAllumage; vSurvol = aSurvol;
        vPouls = 0.5 + 0.5 * sin(uTemps * 2.2);
        // L'éclat d'allumage : l'étoile grossit un instant puis se pose.
        float eclat = 1.0 + 0.9 * sin(3.14159 * clamp(aAllumage, 0.0, 1.0)) * step(aAllumage, 0.999);
        gl_PointSize = uTaille * uRatio * eclat;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vEtat, vAllumage, vSurvol, vPouls;
      float trait(float r, float rayon, float epaisseur) { return smoothstep(epaisseur, 0.0, abs(r - rayon)); }
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        // Éteinte : un simple cercle, tracé à l'encre pâle.
        float eteinte = trait(r, 0.22, 0.045) * 0.6;
        // Allumée : un cœur, quatre branches et un halo.
        float coeur = exp(-r * r * 40.0);
        float branches = (exp(-abs(p.x) * 34.0) + exp(-abs(p.y) * 34.0)) * pow(max(1.0 - r, 0.0), 1.6);
        float allumee = coeur * 1.4 + branches * 0.9 + exp(-r * r * 7.0) * 0.28;
        float a = mix(eteinte, allumee, clamp(vAllumage, 0.0, 1.0));
        // Du jour (pas encore ouverte) : l'étoile respire, un anneau s'élargit doucement.
        float duJour = step(1.5, vEtat) * (1.0 - clamp(vAllumage, 0.0, 1.0));
        a += duJour * (coeur * (0.5 + 0.5 * vPouls) + trait(r, 0.3 + 0.22 * vPouls, 0.05) * (0.9 - 0.6 * vPouls));
        a += vSurvol * trait(r, 0.62, 0.05) * 0.8;
        if (a < 0.01) discard;
        vec3 teinte = mix(vec3(0.62, 0.74, 0.9), vec3(1.0, 0.99, 0.95), clamp(vAllumage + duJour * 0.6, 0.0, 1.0));
        gl_FragColor = vec4(teinte * a, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometrie, materiau);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return points;
}

function creerTraits() {
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(new Float32Array(23 * 6), 3));
  const traits = new THREE.LineSegments(geometrie, new THREE.LineBasicMaterial({
    color: "#b9cdeb", transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, fog: false,
  }));
  traits.frustumCulled = false;
  traits.renderOrder = 2;
  return traits;
}

export function creerCiel({ cases, reduit, partages }) {
  const dome = creerDome();
  const fond = creerEtoilesFond(reduit ? 2200 : 4500, partages);
  // Sur téléphone, les étoiles rapetissent : la spirale tient dans un cadre étroit.
  const etoiles = creerPointsConstellation(cases, partages, reduit ? 30 : 40);
  const traits = creerTraits();
  const positions = Array.from({ length: 24 }, () => new THREE.Vector3());
  const traces = new Float32Array(23); // avancement du trait i → i+1 (0 à 1)
  const allumage = etoiles.geometry.attributes.aAllumage;
  for (let i = 0; i < 23; i += 1) traces[i] = allumage.array[i] >= 1 && allumage.array[i + 1] >= 1 ? 1 : 0;

  function majTraits() {
    const tampon = traits.geometry.attributes.position;
    const fin = new THREE.Vector3();
    for (let i = 0; i < 23; i += 1) {
      fin.lerpVectors(positions[i], positions[i + 1], traces[i]);
      positions[i].toArray(tampon.array, i * 6);
      fin.toArray(tampon.array, i * 6 + 3);
    }
    tampon.needsUpdate = true;
  }

  return {
    dome,
    vivants: [fond, traits, etoiles],
    positions,
    // Place la constellation dans le cadre de la caméra de repos, à 48 m : toujours dans le ciel visible.
    placer(camera, cadre) {
      const tampon = etoiles.geometry.attributes.position;
      formeConstellation(cadre).forEach((ndc, i) => {
        const direction = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
        positions[i].copy(camera.position).addScaledVector(direction, 48);
        positions[i].toArray(tampon.array, i * 3);
      });
      tampon.needsUpdate = true;
      majTraits();
    },
    allumage: (jour) => allumage.array[jour - 1],
    definirAllumage(jour, valeur) { allumage.array[jour - 1] = valeur; allumage.needsUpdate = true; },
    // Les voisins déjà allumés auxquels la nouvelle étoile se relie.
    tracerVers(jour, k) {
      const i = jour - 1;
      if (i > 0 && allumage.array[i - 1] >= 1) traces[i - 1] = Math.max(traces[i - 1], k);
      if (i < 23 && allumage.array[i + 1] >= 1) traces[i] = Math.max(traces[i], k);
      majTraits();
    },
    survoler(jour) {
      const survol = etoiles.geometry.attributes.aSurvol;
      survol.array.fill(0);
      if (jour) survol.array[jour - 1] = 1;
      survol.needsUpdate = true;
    },
  };
}
