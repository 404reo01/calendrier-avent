// Le moment waw (le seul de la page) : le sceau se brise, le grimoire glisse hors du rayon,
// pivote vers le visiteur, s'ouvre, ses pages tournent en éventail et des runes dorées montent.
// Puis la page DOM prend le relais. À la fermeture du panneau, le livre retourne à sa place.
import * as THREE from "../../vendor/three.module.min.js";
import { facilite } from "./boucle.js";
import { couleurDuLivre, dimensionsDuLivre, materiauDeDos, poserSceauBrise } from "./livres.js";
import { textureDeCouverture, textureDePage, textureDeRune, textureRonde } from "./textures.js";

const NOMBRE_PAGES = 6;
const NOMBRE_RUNES = 14;
const EPAISSEUR_PLAT = 0.025;

const melanger = (a, b, k) => a + (b - a) * k;

// Le grimoire animé, construit pour l'occasion : ses textures propres sont libérées au retour.
// Repère local : couverture face à +z, dos sur le bord x = -largeur/2 (charnière).
function construireGrimoire(jour, communs) {
  const { epaisseur: e, hauteur: h, profondeur: l } = dimensionsDuLivre(jour);
  const cuir = communs.cuirs[(jour - 1) % communs.cuirs.length];
  const aLiberer = [];
  const garder = (objet) => { aLiberer.push(objet); return objet; };
  const page = garder(new THREE.MeshBasicMaterial({ map: garder(textureDePage(jour, false)), side: THREE.DoubleSide }));
  const premierePage = garder(new THREE.MeshBasicMaterial({ map: garder(textureDePage(jour, true)) }));
  const couverture = garder(new THREE.MeshLambertMaterial({ map: garder(textureDeCouverture(jour, couleurDuLivre(jour))) }));
  const dos = garder(materiauDeDos(jour, false));
  aLiberer.push(dos.map, dos.emissiveMap);
  const t = communs.tranche;

  const racine = new THREE.Group();
  const plat = garder(new THREE.BoxGeometry(l, h, EPAISSEUR_PLAT));
  const arriere = new THREE.Mesh(plat, cuir);
  arriere.position.z = -e / 2 + EPAISSEUR_PLAT / 2;
  const bloc = new THREE.Mesh(garder(new THREE.BoxGeometry(l - 0.03, h - 0.04, e - 0.07)), [t, t, t, t, premierePage, t]);
  bloc.position.x = 0.015;
  const dosMaillage = new THREE.Mesh(garder(new THREE.BoxGeometry(EPAISSEUR_PLAT, h, e)), [cuir, dos, cuir, cuir, cuir, cuir]);
  dosMaillage.position.x = -l / 2 + EPAISSEUR_PLAT / 2;
  const charniere = new THREE.Group();
  charniere.position.set(-l / 2, 0, e / 2 - EPAISSEUR_PLAT / 2);
  const avant = new THREE.Mesh(plat, [cuir, cuir, cuir, cuir, couverture, page]);
  avant.position.x = l / 2;
  charniere.add(avant);
  racine.add(arriere, bloc, dosMaillage, charniere);

  const geometriePage = garder(new THREE.PlaneGeometry(l - 0.05, h - 0.06).translate((l - 0.05) / 2, 0, 0));
  const pages = Array.from({ length: NOMBRE_PAGES }, (_, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(-l / 2 + 0.02, 0, e / 2 - 0.028 - i * 0.0015);
    pivot.add(new THREE.Mesh(geometriePage, page));
    racine.add(pivot);
    return pivot;
  });
  return { racine, charniere, pages, largeur: l, hauteur: h, aLiberer };
}

function creerRunes(scene, centre, largeur, hauteur) {
  const textures = Array.from({ length: 5 }, (_, i) => textureDeRune(i));
  const runes = Array.from({ length: NOMBRE_RUNES }, (_, i) => {
    const materiau = new THREE.SpriteMaterial({
      map: textures[i % textures.length],
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(materiau);
    const taille = 0.13 + (i % 3) * 0.04;
    sprite.scale.set(taille, taille, 1);
    sprite.userData.depart = new THREE.Vector3(
      centre.x + melanger(-largeur, largeur, (i * 7 % NOMBRE_RUNES) / NOMBRE_RUNES) * 0.9,
      centre.y + melanger(-hauteur, hauteur, (i * 5 % NOMBRE_RUNES) / NOMBRE_RUNES) * 0.3,
      centre.z + 0.3,
    );
    sprite.position.copy(sprite.userData.depart);
    scene.add(sprite);
    return sprite;
  });
  return { runes, textures };
}

export function creerMoment({ scene, boucle, livres, livreParDefaut, communs, cible }) {
  let enCours = Promise.resolve();
  let actif = null;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textureRonde("rgba(255,200,110,0.9)", "rgba(255,200,110,0)"),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  }));
  halo.scale.set(3.2, 2.4, 1);
  halo.position.copy(cible.position).add(new THREE.Vector3(-0.4, 0, -0.3));
  scene.add(halo);

  function briserSceau(livre) {
    if (livre.sceauBrise) return Promise.resolve();
    livre.sceauBrise = true;
    const [droite, gauche] = livre.sceau;
    const y0 = droite.position.y;
    return boucle.animer(400, (k) => {
      const chute = k * k;
      droite.position.set(0.04 + k * 0.35, y0 - chute * 0.7, droite.position.z);
      gauche.position.set(-0.04 - k * 0.3, y0 - chute * 0.6, gauche.position.z);
      droite.rotation.z = -k * 2.4;
      gauche.rotation.z = k * 2.1;
    });
  }

  // Position et rotation du grimoire animé quand il est encore sur le rayon (dos face au visiteur).
  function poseDeDepart(livre, grimoire) {
    const monde = new THREE.Vector3();
    livre.groupe.getWorldPosition(monde);
    monde.y += grimoire.hauteur / 2;
    return monde;
  }

  async function ouvrir(jour) {
    const livre = livres.get(jour) ?? livreParDefaut;
    if (!livre) return;
    await briserSceau(livre);
    const grimoire = construireGrimoire(jour, communs);
    const depart = poseDeDepart(livre, grimoire);
    const sorti = depart.clone().add(new THREE.Vector3(0, 0, 0.95));
    grimoire.racine.position.copy(depart);
    grimoire.racine.rotation.y = Math.PI / 2;
    scene.add(grimoire.racine);
    livre.groupe.visible = false;
    actif = { livre, grimoire, depart };

    await boucle.animer(360, (k) => grimoire.racine.position.lerpVectors(depart, sorti, facilite(k)));
    await boucle.animer(680, (k) => {
      const f = facilite(k);
      grimoire.racine.position.lerpVectors(sorti, cible.position, f);
      grimoire.racine.position.y += Math.sin(Math.PI * k) * 0.25;
      grimoire.racine.rotation.y = melanger(Math.PI / 2, 0, f);
      grimoire.racine.rotation.x = melanger(0, cible.inclinaison, f);
    });
    const ouverture = boucle.animer(560, (k) => { grimoire.charniere.rotation.y = -Math.PI * 0.985 * facilite(k); });
    const eventail = grimoire.pages.map((pivot, i) => boucle.animer(520, (k) => {
      pivot.rotation.y = -Math.PI * melanger(0, 0.97 - i * 0.055, facilite(k));
    }, { delai: 160 + i * 110 }));
    boucle.animer(700, (k) => { halo.material.opacity = 0.55 * k; }, { delai: 200 });
    lancerRunes(150);
    await ouverture;
    // La page DOM se pose quand les pages ont fini de tourner, pendant que les runes montent encore.
    await Promise.race([Promise.all(eventail), new Promise((r) => setTimeout(r, 900))]);
    await new Promise((r) => setTimeout(r, 250));
  }

  function lancerRunes(delaiInitial) {
    // Les runes montent du milieu de la double page (le dos est à gauche du centre du livre fermé).
    const milieu = cible.position.clone().add(new THREE.Vector3(-0.42, 0, 0));
    const { runes, textures } = creerRunes(scene, milieu, 0.85, 1.2);
    const fins = runes.map((rune, i) => boucle.animer(1700, (k) => {
      const depart = rune.userData.depart;
      rune.position.set(depart.x + Math.sin(k * 5 + i) * 0.05, depart.y + k * 1.1, depart.z);
      rune.material.opacity = Math.sin(Math.PI * k);
    }, { delai: delaiInitial + i * 60 }));
    Promise.all(fins).then(() => {
      for (const rune of runes) { scene.remove(rune); rune.material.dispose(); }
      for (const texture of textures) texture.dispose();
    });
  }

  async function refermer() {
    if (!actif) return;
    const { livre, grimoire, depart } = actif;
    actif = null;
    const angleCouverture = grimoire.charniere.rotation.y;
    const anglesPages = grimoire.pages.map((p) => p.rotation.y);
    const positionOuverte = grimoire.racine.position.clone();
    const inclinaison = grimoire.racine.rotation.x;
    boucle.animer(500, (k) => { halo.material.opacity = 0.55 * (1 - k); });
    await boucle.animer(800, (k) => {
      const f = facilite(k);
      grimoire.charniere.rotation.y = melanger(angleCouverture, 0, Math.min(1, f * 1.6));
      grimoire.pages.forEach((p, i) => { p.rotation.y = melanger(anglesPages[i], 0, Math.min(1, f * 1.6)); });
      grimoire.racine.position.lerpVectors(positionOuverte, depart, f);
      grimoire.racine.rotation.y = melanger(0, Math.PI / 2, f);
      grimoire.racine.rotation.x = melanger(inclinaison, 0, f);
    });
    scene.remove(grimoire.racine);
    for (const ressource of grimoire.aLiberer) ressource?.dispose();
    poserSceauBrise(livre.sceau, livre.hauteur, livre.profondeur);
    livre.groupe.visible = true;
    boucle.demander();
  }

  // Une seule animation à la fois : chaque demande attend la précédente.
  function enchainer(action) {
    enCours = enCours.then(action, action);
    return enCours;
  }

  return {
    ouvrir: (jour) => enchainer(() => ouvrir(jour)),
    refermer: () => enchainer(refermer),
    // Une case fermée qu'on essaie d'ouvrir : le livre tressaute contre sa chaîne.
    tressaillir(jour) {
      const livre = livres.get(jour);
      if (!livre) return;
      boucle.animer(380, (k) => {
        livre.groupe.position.x = livre.base.x + Math.sin(k * Math.PI * 6) * 0.02 * (1 - k);
      });
    },
  };
}
