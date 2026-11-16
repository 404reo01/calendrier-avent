// Rendu à la demande : une image n'est dessinée que si quelque chose a bougé.
// - les animations ponctuelles (moment waw, livre qui tremble) tournent à plein régime ;
// - l'ambiance (neige, bougies) tourne à ~30 images/s seulement, et peut être coupée ;
// - tout s'arrête hors écran et quand l'onglet est caché (aucune boucle permanente).
const INTERVALLE_AMBIANCE_MS = 1000 / 30;

export function facilite(k) {
  // easeInOutCubic : départ et arrivée en douceur.
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}

export function creerBoucle({ rendre, ambiance }) {
  const animations = new Set();
  let idImage = 0;
  let visible = true;
  let ambianceActive = true;
  let dernierRendu = 0;
  let precedent = 0;
  let mesure = null;
  let renduDemande = false;

  function image(maintenant) {
    idImage = 0;
    const dt = precedent ? Math.min((maintenant - precedent) / 1000, 0.1) : 0;
    precedent = maintenant;
    mesure?.(maintenant);
    for (const animation of animations) {
      if (!animation(maintenant)) animations.delete(animation);
    }
    const ambianceDue = ambianceActive && maintenant - dernierRendu >= INTERVALLE_AMBIANCE_MS;
    if (renduDemande || animations.size > 0 || ambianceDue || mesure) {
      if (ambianceActive) ambiance(dt, maintenant);
      rendre();
      dernierRendu = maintenant;
      renduDemande = false;
    }
    if (animations.size > 0 || ambianceActive || mesure) planifier();
    else precedent = 0;
  }

  function planifier() {
    if (!idImage && visible) idImage = requestAnimationFrame(image);
  }

  // Demande une image (une seule) : utile après un changement ponctuel, comme un survol.
  function demander() {
    renduDemande = true;
    planifier();
  }

  function arreter() {
    if (idImage) cancelAnimationFrame(idImage);
    idImage = 0;
    precedent = 0;
  }

  return {
    demander,
    // Une animation de `duree` ms ; `etape(k)` reçoit l'avancement 0→1. Résout à la fin.
    animer(duree, etape, { delai = 0 } = {}) {
      return new Promise((resoudre) => {
        let debut = null;
        animations.add((maintenant) => {
          debut ??= maintenant + delai;
          const k = Math.min(Math.max((maintenant - debut) / duree, 0), 1);
          if (maintenant >= debut) etape(k);
          if (k >= 1) resoudre();
          return k < 1;
        });
        planifier();
      });
    },
    definirAmbiance(active) {
      ambianceActive = active;
      demander();
    },
    definirVisible(estVisible) {
      visible = estVisible;
      if (visible) demander();
      else arreter();
    },
    // Mesure le débit d'images une seule fois, sur `nombre` images après une courte chauffe.
    mesurerDebit(nombre = 60) {
      return new Promise((resoudre) => {
        const instants = [];
        mesure = (maintenant) => {
          instants.push(maintenant);
          if (instants.length < nombre + 10) return;
          mesure = null;
          const utiles = instants.slice(10);
          resoudre((utiles.length - 1) * 1000 / (utiles.at(-1) - utiles[0]));
        };
        planifier();
      });
    },
    arreter,
  };
}
