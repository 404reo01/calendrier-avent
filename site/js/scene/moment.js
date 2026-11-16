// Le moment waw (le seul de la page). La caméra s'avance vers le pupitre, le livre s'ouvre et ses pages
// tournent ; une lueur monte de la page jusqu'au ciel, l'étoile du jour s'allume et se relie
// à la constellation. Puis la page DOM prend le relais (main.js attend la promesse via retarder()).
// Mouvement réduit ou appareil faible : le même état final, posé d'un coup, sans animation.
import * as THREE from "../../vendor/three.module.min.js";
import { facilite } from "./boucle.js";

const pause = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

export function creerMoment({ boucle, rendu, camera, poses, livre, ciel, lueur, estFige }) {
  let enCours = Promise.resolve();
  let ouvert = false;
  const regard = poses.base.regard.clone();

  function poserCamera(position, cible) {
    camera.position.copy(position);
    regard.copy(cible);
    camera.lookAt(regard);
    rendu.invalider();
  }

  function deplacerCamera(duree, versPosition, versRegard, options) {
    const dePosition = camera.position.clone();
    const deRegard = regard.clone();
    const position = new THREE.Vector3();
    const cible = new THREE.Vector3();
    return boucle.animer(duree, (k) => {
      const f = facilite(k);
      poserCamera(position.lerpVectors(dePosition, versPosition, f), cible.lerpVectors(deRegard, versRegard, f));
    }, options);
  }

  function ouvrirLivre(duree, options) {
    return boucle.animer(duree, (k) => { livre.ouvrir(facilite(k)); rendu.invalider(); }, options);
  }

  function tournerPages() {
    return Promise.all(Array.from({ length: livre.NOMBRE_PAGES }, (_, i) => boucle.animer(420, (k) => {
      livre.tourner(i, facilite(k));
      rendu.invalider();
    }, { delai: i * 90 })));
  }

  // L'étoile s'allume (éclat puis repos) et les traits vers ses voisines allumées se dessinent.
  function allumerEtoile(jour, duree) {
    const depart = Math.min(ciel.allumage(jour), 0.999);
    return boucle.animer(duree, (k) => {
      ciel.definirAllumage(jour, depart + (1 - depart) * k);
      ciel.tracerVers(jour, facilite(k));
    });
  }

  function poserEtatFinal(jour) {
    livre.preparer(jour);
    livre.ouvrir(1);
    ciel.definirAllumage(jour, 1);
    ciel.tracerVers(jour, 1);
    rendu.invalider();
    boucle.demander();
  }

  async function ouvrir(jour) {
    if (estFige()) { poserEtatFinal(jour); ouvert = true; return; }
    livre.preparer(jour);
    const etoile = ciel.positions[jour - 1];
    const page = livre.centre();
    lueur.tracer(page, etoile);
    ouvert = true;
    const approche = deplacerCamera(900, poses.pres.position, poses.pres.regard);
    await ouvrirLivre(550, { delai: 350 });
    await approche;
    await tournerPages();
    // La lueur monte ; la caméra lève les yeux avec elle, juste assez pour garder l'étoile dans le cadre.
    const regardCiel = poses.pres.regard.clone().lerp(etoile, 0.42);
    const leveYeux = deplacerCamera(1000, poses.pres.position, regardCiel);
    lueur.uniforms.uForce.value = 1;
    await boucle.animer(850, (k) => { lueur.uniforms.uProgres.value = k * 1.06; });
    await allumerEtoile(jour, 450);
    await leveYeux;
    await pause(150);
  }

  async function refermer() {
    if (!ouvert) return;
    ouvert = false;
    if (estFige()) {
      livre.ouvrir(0);
      poserCamera(poses.base.position, poses.base.regard);
      boucle.demander();
      return;
    }
    boucle.animer(400, (k) => { lueur.uniforms.uForce.value = 1 - k; });
    const retour = deplacerCamera(1100, poses.base.position, poses.base.regard);
    await ouvrirLivreInverse(800);
    await retour;
    lueur.uniforms.uProgres.value = 0;
  }

  function ouvrirLivreInverse(duree) {
    return boucle.animer(duree, (k) => { livre.ouvrir(1 - facilite(k)); rendu.invalider(); });
  }

  // Une seule animation à la fois : chaque demande attend la précédente.
  // `enAttente` compte les actions pas encore finies : la parallaxe ne touche pas la caméra pendant ce temps.
  let enAttente = 0;
  function enchainer(action) {
    enAttente += 1;
    const suivie = () => Promise.resolve(action()).finally(() => { enAttente -= 1; });
    enCours = enCours.then(suivie, suivie);
    return enCours;
  }

  return {
    ouvrir: (jour) => enchainer(() => ouvrir(jour)),
    refermer: () => enchainer(refermer),
    // La caméra de repos a changé (redimensionnement) : on la remet en place si rien n'est ouvert.
    replacer() { if (!ouvert) poserCamera(poses.base.position, poses.base.regard); },
    estOuvert: () => ouvert,
    estOccupe: () => enAttente > 0,
  };
}
