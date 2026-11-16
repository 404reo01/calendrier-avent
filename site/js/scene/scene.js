// La Nef étoilée en three.js. Un seul canvas, rendu à la demande, branché sur la grille DOM :
// l'état des étoiles vient des data-etat des boutons, et toute ouverture passe par le bouton DOM.
import * as THREE from "../../vendor/three.module.min.js";
import { creerBoucle } from "./boucle.js";
import { creerCiel } from "./ciel.js";
import { creerFlamme, creerLivre, creerLueur } from "./livre.js";
import { creerMoment } from "./moment.js";
import { creerMateriaux, creerNef } from "./nef.js";
import { creerRendu } from "./rendu.js";
import { attendrePolices } from "./textures.js";

// En dessous de ce débit, l'appareil est jugé faible : la scène devient une image fixe.
const DEBIT_MINIMUM = 24;
// Rayon de clic autour d'une étoile, en pixels CSS : une cible tactile confortable.
const RAYON_CLIC = 24;

// Deux cadrages : large (le ciel au-dessus de la nef) et vertical sur téléphone (le ciel en haut, le pupitre en bas).
const CADRAGES = {
  large: {
    fov: 50,
    base: { position: new THREE.Vector3(0, 2.0, 14), regard: new THREE.Vector3(0, 10.5, -20) },
    pres: { position: new THREE.Vector3(0, 3.3, -2.2), regard: new THREE.Vector3(0, 3.6, -11) },
    constellation: { cx: 0.05, cy: 0.5, ex: 0.6, ey: 0.34 },
  },
  vertical: {
    fov: 66,
    base: { position: new THREE.Vector3(0, 1.9, 6.5), regard: new THREE.Vector3(0, 10, -20) },
    pres: { position: new THREE.Vector3(0, 3.2, -3.2), regard: new THREE.Vector3(0, 4.2, -11) },
    constellation: { cx: 0, cy: 0.52, ex: 0.78, ey: 0.32 },
  },
};

function lireCases(grille) {
  return [...grille.querySelectorAll("button.case[data-jour]")]
    .map((bouton) => ({ jour: Number(bouton.dataset.jour), etat: bouton.dataset.etat }))
    .filter((c) => Number.isInteger(c.jour) && c.jour >= 1 && c.jour <= 24);
}

// Le livre du pupitre ouvre la case du jour, sinon la dernière ouverte.
function jourDuLivre(cases) {
  const duJour = cases.find((c) => c.etat === "du-jour");
  if (duJour) return duJour.jour;
  const ouvertes = cases.filter((c) => c.etat === "ouverte");
  return ouvertes.length ? ouvertes.at(-1).jour : null;
}

function libererTout(...racines) {
  for (const racine of racines) {
    racine.traverse((objet) => {
      objet.geometry?.dispose();
      for (const materiau of [objet.material].flat().filter(Boolean)) {
        materiau.map?.dispose();
        materiau.gradientMap?.dispose();
        materiau.dispose();
      }
      if (objet.isInstancedMesh) objet.dispose();
    });
  }
}

function construire(cases, reduit) {
  const partages = {
    uProfondeur: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uRatio: { value: 1 },
    uTemps: { value: 0.6 },
  };
  const monde = new THREE.Scene();
  monde.fog = new THREE.Fog("#1f4362", 22, 75);
  const vivant = new THREE.Scene();
  const materiaux = creerMateriaux();
  const livre = creerLivre(materiaux);
  const ciel = creerCiel({ cases, reduit, partages });
  const lueur = creerLueur(partages);
  monde.add(creerNef(materiaux), livre.groupe, ciel.dome);
  vivant.add(...ciel.vivants, creerFlamme(partages), lueur.objet);
  return { partages, monde, vivant, livre, ciel, lueur };
}

export async function creerScene({ conteneur, grille, reduit, mouvementReduit }) {
  await attendrePolices();
  const cases = lireCases(grille);
  const cadrage = reduit ? CADRAGES.vertical : CADRAGES.large;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
  // Plafond de densité : le grain et le trait d'encre n'ont pas besoin de plus, et le coût suit le carré.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduit ? 1.25 : 1.5));
  const canvas = renderer.domElement;
  canvas.className = "scene-canvas";

  const { partages, monde, vivant, livre, ciel, lueur } = construire(cases, reduit);
  const camera = new THREE.PerspectiveCamera(cadrage.fov, 2, 0.5, 200);
  camera.position.copy(cadrage.base.position);
  camera.lookAt(cadrage.base.regard);
  const rendu = creerRendu({ renderer, monde, vivant, camera, partages });
  const etat = { fixe: false, reduit: mouvementReduit, mesure: false, visibleEcran: true };

  const boucle = creerBoucle({
    rendre: () => rendu.rendre(),
    ambiance: (dt, t) => {
      partages.uTemps.value = t / 1000;
      // Pendant la mesure, on paie le prix fort (toute la nef à chaque image) pour juger l'appareil.
      if (etat.mesure) rendu.invalider();
    },
  });
  const moment = creerMoment({
    boucle, rendu, camera, poses: cadrage, livre, ciel, lueur,
    estFige: () => etat.fixe || etat.reduit,
  });
  if (mouvementReduit) boucle.definirAmbiance(false);

  const arret = new AbortController();
  const signal = { signal: arret.signal };
  const observateurs = [];

  function ajuster() {
    const { width, height } = conteneur.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    rendu.redimensionner();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!moment.estOuvert()) {
      // La constellation est posée dans le cadre de la caméra de repos.
      const pose = camera.position.clone();
      const quaternion = camera.quaternion.clone();
      camera.position.copy(cadrage.base.position);
      camera.lookAt(cadrage.base.regard);
      camera.updateMatrixWorld();
      ciel.placer(camera, cadrage.constellation);
      camera.position.copy(pose);
      camera.quaternion.copy(quaternion);
      moment.replacer();
    }
    rendu.invalider();
    boucle.demander();
  }

  function appliquerVisibilite() {
    boucle.definirVisible(etat.visibleEcran && document.visibilityState === "visible");
  }

  function boutonDuJour(jour) {
    return grille.querySelector(`button.case[data-jour="${jour}"]`);
  }

  // L'étoile la plus proche du pointeur, si elle est assez proche pour être visée.
  const ecran = new THREE.Vector3();
  function etoileSous(evenement) {
    const cadre = canvas.getBoundingClientRect();
    let meilleure = null;
    let distanceMin = RAYON_CLIC;
    ciel.positions.forEach((position, i) => {
      ecran.copy(position).project(camera);
      if (ecran.z > 1) return;
      const x = (ecran.x + 1) / 2 * cadre.width;
      const y = (1 - ecran.y) / 2 * cadre.height;
      const d = Math.hypot(x - (evenement.clientX - cadre.left), y - (evenement.clientY - cadre.top));
      if (d < distanceMin) { distanceMin = d; meilleure = i + 1; }
    });
    return meilleure;
  }

  const lanceur = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  function livreSous(evenement) {
    const cadre = canvas.getBoundingClientRect();
    pointeur.set(((evenement.clientX - cadre.left) / cadre.width) * 2 - 1, -((evenement.clientY - cadre.top) / cadre.height) * 2 + 1);
    lanceur.setFromCamera(pointeur, camera);
    return lanceur.intersectObjects(livre.cibles, false).length > 0 ? jourDuLivre(cases) : null;
  }

  function cibleSous(evenement) {
    return etoileSous(evenement) ?? livreSous(evenement);
  }

  function survoler(jour) {
    ciel.survoler(jour);
    boucle.demander();
  }

  function detruire() {
    arret.abort();
    boucle.arreter();
    for (const o of observateurs) o.disconnect();
    libererTout(monde, vivant);
    rendu.liberer();
    renderer.dispose();
    canvas.remove();
    conteneur.hidden = true;
  }

  function brancherPointeur() {
    // Un seul chemin d'ouverture : viser une étoile ou le livre clique le bouton DOM correspondant.
    canvas.addEventListener("click", (evenement) => {
      const jour = cibleSous(evenement);
      if (jour) boutonDuJour(jour)?.click();
    }, signal);
    if (!matchMedia("(hover: hover)").matches) return;
    canvas.addEventListener("pointermove", (evenement) => {
      const jour = cibleSous(evenement);
      const bouton = jour && boutonDuJour(jour);
      canvas.style.cursor = bouton ? (bouton.dataset.etat === "fermee" ? "not-allowed" : "pointer") : "";
      survoler(jour);
    }, signal);
    canvas.addEventListener("pointerleave", () => survoler(null), signal);
  }

  function brancherEvenements() {
    brancherPointeur();
    grille.addEventListener("focusin", (e) => survoler(Number(e.target.closest("button.case")?.dataset.jour) || null), signal);
    grille.addEventListener("focusout", () => survoler(null), signal);
    document.addEventListener("case:ouverte", (evenement) => {
      const jour = evenement.detail?.jour;
      if (!Number.isInteger(jour) || jour < 1 || jour > 24) return;
      const promesse = moment.ouvrir(jour);
      // Hors écran ou figée, la scène se met à jour sans faire attendre la page.
      if (!etat.fixe && !etat.reduit && etat.visibleEcran) evenement.detail.retarder?.(promesse);
    }, signal);
    document.addEventListener("visibilitychange", appliquerVisibilite, signal);
    window.addEventListener("pagehide", (e) => { if (!e.persisted) detruire(); }, signal);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
      etat.reduit = e.matches;
      boucle.definirAmbiance(!e.matches && !etat.fixe);
    }, signal);
    canvas.addEventListener("webglcontextlost", detruire, signal);
  }

  function observer() {
    const redim = new ResizeObserver(ajuster);
    redim.observe(conteneur);
    const vue = new IntersectionObserver(([entree]) => {
      etat.visibleEcran = entree.isIntersecting;
      appliquerVisibilite();
    });
    vue.observe(conteneur);
    // Pendant la lecture d'une case, le ciel cesse de scintiller ; à la fermeture, le livre se referme.
    const panneau = document.getElementById("panneau");
    const lecture = new MutationObserver(() => {
      if (!etat.fixe && !etat.reduit) boucle.definirAmbiance(!panneau.open);
      if (!panneau.open) moment.refermer();
    });
    if (panneau) lecture.observe(panneau, { attributes: true, attributeFilter: ["open"] });
    observateurs.push(redim, vue, lecture);
  }

  conteneur.append(canvas);
  ajuster();
  brancherEvenements();
  observer();
  rendu.rendre();
  conteneur.classList.add("est-prete");
  if (mouvementReduit) return;

  etat.mesure = true;
  const debit = await boucle.mesurerDebit(60);
  etat.mesure = false;
  conteneur.dataset.debit = String(Math.round(debit));
  if (debit < DEBIT_MINIMUM) {
    etat.fixe = true;
    boucle.definirAmbiance(false);
    conteneur.classList.add("est-fixe");
  }
}
