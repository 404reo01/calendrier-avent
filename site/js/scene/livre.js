// Le livre du pupitre, la flamme de la bougie et la lueur qui monte de la page vers le ciel.
import * as THREE from "../../vendor/three.module.min.js";
import { PLAN } from "./nef.js";
import { textureCouverture, texturePage } from "./textures.js";

const LARGEUR = 0.5; // une demi-page
const LONGUEUR = 0.7; // le long du dos
const EPAISSEUR = 0.16;
const PLAT = 0.02;
const NOMBRE_PAGES = 5;

// Repère du livre : couché dans le plan xz, dos le long de z en x = 0.
// Fermé, il occupe la moitié gauche ; la couverture et la moitié du bloc basculent autour du dos.
export function creerLivre(materiaux) {
  const page = materiaux.toon("#ffffff", { map: texturePage(1), side: THREE.DoubleSide });
  const tranche = materiaux.toon("#d9e2e6");
  const toile = materiaux.toon("#ffffff", { map: textureCouverture() });
  const toileUnie = materiaux.toon("#26356a");
  const demiBloc = new THREE.BoxGeometry(LARGEUR - 0.02, EPAISSEUR / 2 - PLAT, LONGUEUR - 0.03);
  const plat = new THREE.BoxGeometry(LARGEUR, PLAT, LONGUEUR);

  const groupe = new THREE.Group();
  const dessous = new THREE.Mesh(plat, toileUnie);
  dessous.position.set(-LARGEUR / 2, PLAT / 2, 0);
  const blocGauche = new THREE.Mesh(demiBloc, [tranche, tranche, page, tranche, tranche, tranche]);
  blocGauche.position.set(-LARGEUR / 2 + 0.01, PLAT + (EPAISSEUR / 2 - PLAT) / 2, 0);

  const charniere = new THREE.Group();
  charniere.position.y = EPAISSEUR / 2;
  const blocDroit = new THREE.Mesh(demiBloc, [tranche, tranche, tranche, page, tranche, tranche]);
  blocDroit.position.set(-LARGEUR / 2 + 0.01, (EPAISSEUR / 2 - PLAT) / 2, 0);
  // La couverture : la face du dessus porte l'étoile (face +y d'une boîte = index 2).
  const couverture = new THREE.Mesh(plat, [toileUnie, toileUnie, toile, toileUnie, toileUnie, toileUnie]);
  couverture.position.set(-LARGEUR / 2, EPAISSEUR / 2 - PLAT / 2, 0);
  charniere.add(blocDroit, couverture);

  const feuille = new THREE.PlaneGeometry(LARGEUR - 0.03, LONGUEUR - 0.05).rotateX(-Math.PI / 2).translate(-(LARGEUR - 0.03) / 2, 0, 0);
  const pages = Array.from({ length: NOMBRE_PAGES }, (_, i) => {
    const pivot = new THREE.Group();
    pivot.position.y = EPAISSEUR / 2 + 0.002 + (NOMBRE_PAGES - i) * 0.0012;
    pivot.add(new THREE.Mesh(feuille, page));
    pivot.visible = false;
    return pivot;
  });
  groupe.add(dessous, blocGauche, charniere, ...pages);
  // Posé sur le plateau incliné du pupitre, le dos dans l'axe de la nef.
  groupe.position.set(PLAN.pupitre.x, PLAN.pupitre.y + 1.13, PLAN.pupitre.z);
  groupe.rotation.x = 0.42;

  return {
    groupe,
    cibles: [dessous, blocGauche, blocDroit, couverture],
    // Le centre de la double page, en coordonnées du monde.
    centre: () => groupe.localToWorld(new THREE.Vector3(0, EPAISSEUR / 2 + 0.05, 0)),
    preparer(jour) {
      page.map.dispose();
      page.map = texturePage(jour);
      page.needsUpdate = true;
    },
    // k = 0 fermé, 1 grand ouvert.
    ouvrir(k) { charniere.rotation.z = -Math.PI * 0.985 * k; },
    tourner(i, k) {
      pages[i].visible = k > 0 && k < 1;
      pages[i].rotation.z = -Math.PI * 0.97 * k;
    },
    NOMBRE_PAGES,
  };
}

// La flamme : un seul point, dessiné en goutte dans le shader, avec son halo. Elle vacille en ambiance.
export function creerFlamme(partages) {
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PLAN.bougie.toArray()), 3));
  const flamme = new THREE.Points(geometrie, new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: partages,
    vertexShader: /* glsl */ `
      uniform float uRatio, uTemps; varying float vVacille;
      void main() {
        vVacille = 0.88 + 0.08 * sin(uTemps * 9.0) + 0.05 * sin(uTemps * 23.0 + 1.3);
        vec4 vue = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 70.0 * uRatio * 8.0 / -vue.z;
        gl_Position = projectionMatrix * vue;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uProfondeur; uniform vec2 uResolution; varying float vVacille;
      void main() {
        // La flamme est derrière le pupitre ? Elle reste cachée (test de profondeur fait à la main).
        if (texture2D(uProfondeur, gl_FragCoord.xy / uResolution).r < gl_FragCoord.z - 0.00002) discard;
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        p.y += 0.15;
        float goutte = smoothstep(0.32, 0.0, length(vec2(p.x * (1.9 + p.y * 1.2), p.y * 0.85 + 0.05)) * 1.0 / vVacille);
        // Le halo s'éteint avant le bord du point : de près, sinon, on verrait le carré du sprite.
        float halo = exp(-dot(p, p) * 3.2) * 0.6 * vVacille * smoothstep(1.0, 0.6, length(p));
        vec3 c = vec3(1.0, 0.86, 0.55) * goutte * 1.6 + vec3(1.0, 0.62, 0.25) * halo;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  flamme.frustumCulled = false;
  flamme.renderOrder = 4;
  return flamme;
}

// La lueur : un chapelet de particules froides qui monte de la page vers une étoile.
const NOMBRE_GRAINS = 90;

export function creerLueur(partages) {
  const geometrie = new THREE.BufferGeometry();
  const t = new Float32Array(NOMBRE_GRAINS);
  for (let i = 0; i < NOMBRE_GRAINS; i += 1) t[i] = i / (NOMBRE_GRAINS - 1);
  geometrie.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NOMBRE_GRAINS * 3), 3));
  geometrie.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  const uniforms = { ...partages, uProgres: { value: 0 }, uForce: { value: 0 } };
  const lueur = new THREE.Points(geometrie, new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: /* glsl */ `
      attribute float aT; uniform float uRatio, uProgres, uForce; varying float vA;
      void main() {
        // La tête du chapelet est la plus vive ; la traîne s'éteint derrière elle.
        float devant = smoothstep(uProgres, uProgres - 0.04, aT);
        float traine = smoothstep(uProgres - 0.55, uProgres, aT);
        vA = devant * (0.25 + 0.75 * traine) * uForce;
        vec4 vue = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (aT < 0.02 ? 160.0 : 26.0 * (0.6 + traine)) * uRatio * 6.0 / max(-vue.z, 2.0);
        gl_Position = projectionMatrix * vue;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float a = exp(-dot(p, p) * 5.0) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.82, 0.92, 1.0) * a, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  lueur.frustumCulled = false;
  lueur.renderOrder = 5;

  return {
    objet: lueur,
    uniforms,
    // Le chemin : une courbe qui monte d'abord droit, puis s'incline vers l'étoile.
    tracer(depart, arrivee) {
      const controle = new THREE.Vector3(depart.x, arrivee.y * 0.75 + depart.y * 0.25, depart.z * 0.6 + arrivee.z * 0.4);
      const courbe = new THREE.QuadraticBezierCurve3(depart, controle, arrivee);
      const tampon = geometrie.attributes.position;
      const point = new THREE.Vector3();
      for (let i = 0; i < NOMBRE_GRAINS; i += 1) {
        courbe.getPoint(t[i], point);
        point.x += Math.sin(i * 1.7) * 0.12 * t[i];
        point.toArray(tampon.array, i * 3);
      }
      tampon.needsUpdate = true;
    },
  };
}
