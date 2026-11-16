// Le rendu en deux temps, pour que l'ambiance ne coûte presque rien :
// 1. la nef (immobile) est dessinée dans une texture, seulement quand quelque chose y bouge ;
// 2. à chaque image, une seule passe plein écran pose le trait d'encre (arêtes lues dans la profondeur),
//    le lavis et le grain du papier, puis les éléments vivants (étoiles, flamme, lueur) s'ajoutent par-dessus.
// Pas de calque CSS en mode de fusion : tout se passe dans le canvas.
import * as THREE from "../../vendor/three.module.min.js";

const PASSE_FINALE = /* glsl */ `
  uniform sampler2D uCouleur, uProfondeur;
  uniform vec2 uResolution;
  uniform float uRatio, uProche, uLoin;
  uniform vec3 uEncre;
  varying vec2 vUv;

  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float bruit(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return 0.5 * bruit(p) + 0.3 * bruit(p * 2.1 + 3.7) + 0.2 * bruit(p * 4.3 + 1.1); }
  // L'inverse de la distance varie linéairement sur une surface plane, à l'écran :
  // son laplacien est nul sur les plans et fort sur les plis et les ruptures. C'est là qu'on encre.
  float inverseZ(vec2 uv) {
    float z = texture2D(uProfondeur, uv).r * 2.0 - 1.0;
    return (uLoin + uProche - z * (uLoin - uProche)) / (2.0 * uProche * uLoin);
  }

  void main() {
    vec2 pas = max(1.0, uRatio * 0.85) / uResolution;
    float c = inverseZ(vUv);
    float lx = abs(inverseZ(vUv - vec2(pas.x, 0.0)) + inverseZ(vUv + vec2(pas.x, 0.0)) - 2.0 * c);
    float ly = abs(inverseZ(vUv - vec2(0.0, pas.y)) + inverseZ(vUv + vec2(0.0, pas.y)) - 2.0 * c);
    float distance = 1.0 / max(c, 1e-4);
    float pli = (lx + ly) / max(c, 1e-4);
    float encre = smoothstep(0.004, 0.022, pli);
    // Le trait s'efface avec la distance (sinon les rayonnages lointains deviennent une hachure noire)
    // et tremble un peu, comme tiré à la plume.
    encre *= 1.0 - 0.6 * smoothstep(26.0, 60.0, distance);
    encre *= 0.65 + 0.5 * bruit(gl_FragCoord.xy * 0.45);

    vec3 col = texture2D(uCouleur, vUv).rgb;
    // Lavis : la couche d'aquarelle n'est jamais régulière, et ses bords de flaque foncent un peu.
    vec2 ecran = gl_FragCoord.xy / uRatio;
    float lavis = fbm(ecran * 0.006);
    col *= 0.8 + 0.4 * lavis;
    float flaque = fbm(ecran * 0.011 + 5.0);
    col *= 1.0 - 0.045 * smoothstep(0.03, 0.0, abs(flaque - 0.5));
    // Granulation du pigment dans les tons foncés, fibres du papier partout.
    float grain = h(floor(ecran)) - 0.5;
    float fibres = bruit(ecran * vec2(0.9, 0.12)) - 0.5;
    col *= 1.0 + grain * 0.12 + fibres * 0.08;
    col = mix(col, uEncre, clamp(encre, 0.0, 1.0) * 0.9);
    // Les bords de la planche s'assombrissent légèrement.
    vec2 v = vUv - 0.5;
    col *= 1.0 - 0.35 * dot(v, v);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <colorspace_fragment>
  }
`;

function typeCouleur(renderer) {
  // Une texture en demi-flottants évite les bandes dans les bleus très sombres ; à défaut, 8 bits.
  const ext = renderer.extensions;
  return renderer.capabilities.isWebGL2 && (ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float"))
    ? THREE.HalfFloatType
    : THREE.UnsignedByteType;
}

export function creerRendu({ renderer, monde, vivant, camera, partages }) {
  const cible = new THREE.WebGLRenderTarget(1, 1, { type: typeCouleur(renderer), depthBuffer: true });
  cible.depthTexture = new THREE.DepthTexture(1, 1);
  partages.uProfondeur.value = cible.depthTexture;

  const finale = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uCouleur: { value: cible.texture },
      uProfondeur: partages.uProfondeur,
      uResolution: partages.uResolution,
      uRatio: partages.uRatio,
      uProche: { value: camera.near },
      uLoin: { value: camera.far },
      uEncre: { value: new THREE.Color("#0b1233") },
    },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: PASSE_FINALE,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finale);
  quad.frustumCulled = false;
  const ecran = new THREE.Scene();
  ecran.add(quad);
  const cameraEcran = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer.autoClear = false;
  let sale = true;

  return {
    // La nef a changé (caméra, livre) : elle sera redessinée à la prochaine image.
    invalider() { sale = true; },
    // À appeler après renderer.setSize : la texture suit exactement la taille du tampon d'écran,
    // car les étoiles lisent la profondeur au pixel près (gl_FragCoord).
    redimensionner() {
      const taille = renderer.getDrawingBufferSize(new THREE.Vector2());
      cible.setSize(taille.x, taille.y);
      partages.uResolution.value.copy(taille);
      partages.uRatio.value = renderer.getPixelRatio();
      sale = true;
    },
    rendre() {
      if (sale) {
        renderer.setRenderTarget(cible);
        renderer.clear();
        renderer.render(monde, camera);
        renderer.setRenderTarget(null);
        sale = false;
      }
      renderer.clear();
      renderer.render(ecran, cameraEcran);
      renderer.render(vivant, camera);
    },
    liberer() {
      cible.depthTexture.dispose();
      cible.dispose();
      quad.geometry.dispose();
      finale.dispose();
    },
  };
}
