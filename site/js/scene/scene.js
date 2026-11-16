// La bibliothèque d'hiver en three.js. Un seul canvas, rendu à la demande, branché sur la grille DOM :
// l'état des livres vient des data-etat des boutons, et toute ouverture passe par le bouton DOM.
import * as THREE from "../../vendor/three.module.min.js";
import { creerBoucle } from "./boucle.js";
import { creerBougies, creerFenetre, creerPieceEtLumieres, creerRayonnage } from "./decor.js";
import { creerLivres, creerMateriauxCommuns } from "./livres.js";
import { creerMoment } from "./moment.js";
import { attendrePolices } from "./textures.js";

// En dessous de ce débit, l'appareil est jugé faible : la scène devient une image fixe.
const DEBIT_MINIMUM = 24;

function lireCases(grille) {
  return [...grille.querySelectorAll("button.case[data-jour]")]
    .map((bouton) => ({ jour: Number(bouton.dataset.jour), etat: bouton.dataset.etat }))
    .filter((c) => Number.isInteger(c.jour) && c.jour >= 1 && c.jour <= 24);
}

// Sur téléphone, un seul livre : celui du jour, sinon le dernier ouvert, sinon le premier.
function jourAffiche(cases) {
  const duJour = cases.find((c) => c.etat === "du-jour");
  if (duJour) return duJour.jour;
  const ouvertes = cases.filter((c) => c.etat === "ouverte");
  return ouvertes.length ? ouvertes.at(-1).jour : 1;
}

function amenager(scene, cases, reduit, communs) {
  creerPieceEtLumieres(scene, { reduit });
  if (reduit) {
    const jour = jourAffiche(cases);
    const tablette = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.1), new THREE.MeshLambertMaterial({ color: "#5a3a22" }));
    tablette.position.set(0, 0.6, 0);
    const fenetre = creerFenetre({ x: 0, y: 1.6, largeur: 1.5, hauteur: 1.9, nombreFlocons: 140 });
    const bougies = creerBougies([[0.62, 0.64, 0.2, 0.3], [0.78, 0.64, 0.05, 0.2]]);
    const rayon = creerLivres(cases, [{ y: 0.64, jours: [jour] }], communs);
    scene.add(tablette, fenetre.groupe, bougies.groupe, rayon.groupe);
    return {
      rayon, ambiances: [fenetre.neige.maj, (dt, t) => bougies.maj(t)],
      camera: { fov: 34, position: [0, 1.3, 3.9], regard: [0, 1.25, 0] },
      cible: { position: new THREE.Vector3(0.425, 1.25, 1.05), inclinaison: -0.12 },
    };
  }
  const jours = Array.from({ length: 24 }, (_, i) => i + 1);
  const planches = [0.3, 1.9];
  const rayonnage = creerRayonnage({ largeur: 4.3, planches });
  const rayon = creerLivres(cases, [{ y: 1.9, jours: jours.slice(0, 12) }, { y: 0.3, jours: jours.slice(12) }], communs);
  const fenetre = creerFenetre({ x: -3.12, y: 2.0, largeur: 0.95, hauteur: 2.5, nombreFlocons: 220 });
  const pied = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.7), new THREE.MeshLambertMaterial({ color: "#3a2415" }));
  pied.position.set(3.08, 0.5, 0.1);
  const bougiesBasses = creerBougies([[2.96, 1.0, 0.15, 0.42], [3.2, 1.0, 0.0, 0.3], [3.33, 1.0, 0.28, 0.2]]);
  // Deux bougies sur l'appui de la fenêtre : elles éclairent le côté gauche du rayonnage.
  const bougiesHautes = creerBougies([[-2.95, 0.82, -0.5, 0.26], [-3.25, 0.82, -0.55, 0.18]]);
  scene.add(rayonnage, rayon.groupe, fenetre.groupe, pied, bougiesBasses.groupe, bougiesHautes.groupe);
  return {
    rayon,
    ambiances: [fenetre.neige.maj, (dt, t) => bougiesBasses.maj(t), (dt, t) => bougiesHautes.maj(t + 400)],
    camera: { fov: 28, position: [0, 1.75, 7.6], regard: [0, 1.72, 0] },
    cible: { position: new THREE.Vector3(0.425, 1.72, 3.7), inclinaison: -0.15 },
  };
}

function libererTout(scene) {
  scene.traverse((objet) => {
    objet.geometry?.dispose();
    const materiaux = [objet.material].flat().filter(Boolean);
    for (const materiau of materiaux) {
      materiau.map?.dispose();
      materiau.emissiveMap?.dispose();
      materiau.dispose();
    }
    if (objet.isInstancedMesh) objet.dispose();
  });
}

export async function creerScene({ conteneur, grille, reduit }) {
  await attendrePolices();
  const cases = lireCases(grille);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  // Plafond de densité : au-delà de 2 (1,5 sur téléphone), le coût explose sans gain visible.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduit ? 1.5 : 2));
  const canvas = renderer.domElement;
  canvas.className = "scene-canvas";

  const scene = new THREE.Scene();
  const communs = creerMateriauxCommuns();
  const plan = amenager(scene, cases, reduit, communs);
  const camera = new THREE.PerspectiveCamera(plan.camera.fov, 2, 0.1, 40);
  camera.position.set(...plan.camera.position);
  camera.lookAt(...plan.camera.regard);
  const livreDuJour = [...plan.rayon.livres.values()].find((l) => l.etat === "du-jour");

  const boucle = creerBoucle({
    rendre: () => renderer.render(scene, camera),
    ambiance: (dt, t) => {
      for (const maj of plan.ambiances) maj(dt, t);
      // Le grimoire du jour respire doucement.
      if (livreDuJour) livreDuJour.dos.emissiveIntensity = 0.5 + 0.15 * Math.sin(t / 650);
    },
  });
  const moment = creerMoment({
    scene, boucle, communs, cible: plan.cible,
    livres: plan.rayon.livres, livreParDefaut: [...plan.rayon.livres.values()][0],
  });

  const etat = { fixe: false, visibleEcran: true, survol: null };
  const arret = new AbortController();
  const signal = { signal: arret.signal };
  const observateurs = [];

  function ajuster() {
    const { width, height } = conteneur.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    boucle.demander();
  }

  function appliquerVisibilite() {
    boucle.definirVisible(etat.visibleEcran && document.visibilityState === "visible");
  }

  // Soulève légèrement le livre survolé à la souris ou dont le bouton a le focus clavier.
  function surligner(jour) {
    if (etat.survol === jour) return;
    const ancien = plan.rayon.livres.get(etat.survol);
    if (ancien) ancien.groupe.position.z = ancien.base.z;
    etat.survol = jour;
    const nouveau = plan.rayon.livres.get(jour);
    if (nouveau) nouveau.groupe.position.z = nouveau.base.z + 0.08;
    boucle.demander();
  }

  const lanceur = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  function livreSous(evenement) {
    const cadre = canvas.getBoundingClientRect();
    pointeur.set(((evenement.clientX - cadre.left) / cadre.width) * 2 - 1, -((evenement.clientY - cadre.top) / cadre.height) * 2 + 1);
    lanceur.setFromCamera(pointeur, camera);
    const touche = lanceur.intersectObjects(plan.rayon.cibles, false).find((t) => t.object.parent.visible);
    return touche ? touche.object.userData.jour : null;
  }

  function boutonDuJour(jour) {
    return grille.querySelector(`button.case[data-jour="${jour}"]`);
  }

  function detruire() {
    arret.abort();
    boucle.arreter();
    for (const o of observateurs) o.disconnect();
    libererTout(scene);
    renderer.dispose();
    canvas.remove();
    conteneur.hidden = true;
  }

  function brancherEvenements() {
    // Un seul chemin d'ouverture : cliquer un livre clique le bouton DOM correspondant.
    canvas.addEventListener("click", (evenement) => {
      const jour = livreSous(evenement);
      if (jour) boutonDuJour(jour)?.click();
    }, signal);
    if (matchMedia("(hover: hover)").matches) {
      canvas.addEventListener("pointermove", (evenement) => {
        const jour = livreSous(evenement);
        const bouton = jour && boutonDuJour(jour);
        canvas.style.cursor = bouton ? (bouton.dataset.etat === "fermee" ? "not-allowed" : "pointer") : "";
        surligner(jour);
      }, signal);
      canvas.addEventListener("pointerleave", () => surligner(null), signal);
    }
    grille.addEventListener("focusin", (e) => surligner(Number(e.target.closest("button.case")?.dataset.jour) || null), signal);
    grille.addEventListener("focusout", () => surligner(null), signal);
    grille.addEventListener("click", (e) => {
      const bouton = e.target.closest('button.case[data-etat="fermee"]');
      if (bouton && !etat.fixe) moment.tressaillir(Number(bouton.dataset.jour));
    }, signal);
    document.addEventListener("case:ouverte", (evenement) => {
      if (etat.fixe || !etat.visibleEcran) return;
      evenement.detail?.retarder?.(moment.ouvrir(evenement.detail.jour));
    }, signal);
    document.addEventListener("visibilitychange", appliquerVisibilite, signal);
    window.addEventListener("pagehide", (e) => { if (!e.persisted) detruire(); }, signal);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => { if (e.matches) detruire(); }, signal);
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
    // Pendant la lecture d'une case, la neige et les bougies s'arrêtent ; à la fermeture, le livre revient.
    const panneau = document.getElementById("panneau");
    const lecture = new MutationObserver(() => {
      if (etat.fixe) return;
      boucle.definirAmbiance(!panneau.open);
      if (!panneau.open) moment.refermer();
    });
    if (panneau) lecture.observe(panneau, { attributes: true, attributeFilter: ["open"] });
    observateurs.push(redim, vue, lecture);
  }

  conteneur.append(canvas);
  ajuster();
  brancherEvenements();
  observer();
  renderer.render(scene, camera);
  conteneur.classList.add("est-prete");

  const debit = await boucle.mesurerDebit(60);
  conteneur.dataset.debit = String(Math.round(debit));
  if (debit < DEBIT_MINIMUM) {
    etat.fixe = true;
    boucle.definirAmbiance(false);
    conteneur.classList.add("est-fixe");
  }
}
