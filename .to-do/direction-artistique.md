# Direction artistique — « Le Grimoire des skills » (T1, choisi le 2026-11-16)

Choix de Rayan : la direction 4 du moodboard (https://claude.ai/artifact/F1GTnCy96vCkRRnUEXMRK4), inspirée de son projet LifeIsARealBook (blog Sabbah de Babel). On reprend **l'esprit et les règles** de ce projet, **pas son identité** : pas de tour de Babel, pas de devise latine, pas de logo, pas de fantôme ni de chat (ce sont les mascottes de ses autrices).

## Mood
- **Une bibliothèque ancienne un soir d'hiver.** Dehors, un bleu froid avec de la neige derrière une haute fenêtre. Dedans, la lueur ambrée des bougies sur les dos des livres.
- **Trois mots** : cocon, silence feutré, émerveillement discret.
- **Un skill = un sort.** Le calendrier est un rayonnage de 24 grimoires. Le grimoire du jour se descelle, sort du rayonnage, s'ouvre et ses pages tournent.
- **Pas de clichés de Noël** : ni rouge et vert, ni sapin, ni guirlande, ni chaussette. À garder : neige, bougies, étoiles, livres, papier, dorure, sceau de cire.

## Ce qu'on reprend de LifeIsARealBook
- **Matières** : papier ancien, dorure à double filet, coins en équerre (carte ex-libris), lettrine sur la première lettre, séparateur ❅, filets dorés.
- **Le panneau d'une case est une page de grimoire** : titre en lettrine, le skill présenté comme un sort (nom, provenance = source, « Incantation » = la phrase à dire à son assistant IA).
- **Thème clair et sombre** : le clair est le jour, papier et encre ; le sombre est la nuit, bougies et neige bleue. Le sombre est le thème par défaut de la scène 3D.
- **Règles de performance, à reprendre telles quelles** :
  - pas de `backdrop-filter`, pas de flou animé ;
  - pas de calque fixe plein écran en mode de fusion ;
  - n'animer que `transform` et `opacity` ;
  - **une seule animation WebGL par page** ;
  - pas de boucle `requestAnimationFrame` permanente quand rien ne bouge ;
  - pause hors écran et quand l'onglet est caché ;
  - `prefers-reduced-motion` arrête tout ce qui bouge seul ;
  - rien ne s'active au survol sur un écran tactile.

## La 3D (P5)
- **Une scène three.js** : le rayonnage de 24 grimoires (dos numérotés), une fenêtre où tombe la neige, des bougies (lumière ponctuelle qui vacille doucement).
  - Les livres **fermés** portent un sceau de cire et une chaîne.
  - Le livre **du jour** dépasse légèrement du rayon et luit.
  - Les livres **ouverts** ont le sceau brisé.
- **Le moment waw (un seul)** : à l'ouverture d'une case, le sceau se brise, le livre glisse hors du rayon, pivote vers le visiteur, s'ouvre, les pages tournent en éventail et des runes dorées montent. Puis le panneau DOM (la page du grimoire) prend le relais.
- **La grille DOM accessible reste la vérité**, à la fois pour les lecteurs d'écran, au clavier, et en solution de repli sans WebGL. Les clics sur les livres 3D et les boutons DOM déclenchent la même action.
- **Sur téléphone**, la scène est réduite au livre du jour qui s'ouvre et à la neige, et la grille reprend en CSS l'aspect de dos de livres. Sur un appareil faible (débit d'images mesuré une fois), on passe en image fixe.
- **Les trois états se lisent sans la couleur** : sceau intact avec chaîne (fermée), livre qui dépasse avec un mot « Aujourd'hui » (du-jour), sceau brisé (ouverte). La grille DOM écrit toujours l'état en toutes lettres.

## Typographie
Choisir un duo dans le même esprit que LifeIsARealBook (une sérif ancienne pour le texte, une display gravée pour les titres et les numéros), mais **pas le même trio** (IM Fell English, Cormorant SC, EB Garamond), pour garder une identité propre. Polices via Google Fonts, autorisé par la CSP.

## À noter pour le making-of
LifeIsARealBook a utilisé le skill communautaire **Taste Skill** pour son moodboard d'hiver : c'est un candidat pour une case, s'il sert ici (à auditer avant de l'installer).

---

# Révision 2 (2026-11-16, soir) — « La Nef étoilée »

Rayan trouve la v1 trop générique (cuir, dorures, bougies, Cinzel : c'est l'imaginaire « bibliothèque » par défaut). Nouvelle référence : une illustration Pinterest (pin 681802831134084857, « Livros | Artes »), à **s'inspirer sans la copier** (c'est l'œuvre de quelqu'un : aucun de ses pixels dans le projet).

## Ce que dit la référence
- **Une nef gothique de bibliothèque À CIEL OUVERT** : la voûte n'existe plus, au-dessus des rayonnages il y a une nuit étoilée immense, avec une Voie lactée. Le ciel occupe la moitié de l'image : c'est lui le héros.
- **Un rendu illustré, pas réaliste** : trait d'encre fin sur les arêtes, lavis d'aquarelle, grain de papier, ombres posées en aplats.
- **Un camaïeu bleu nuit, bleu-vert, sarcelle** et **un seul point chaud** : la flamme d'une bougie sur un pupitre. Tout le reste est froid.
- **Une verticalité** : rayonnages immenses, hautes fenêtres en ogive, colonnes, des marches qui montent vers un pupitre, une statue dans une niche, un dallage en perspective.

## Ce que ça devient pour le calendrier
- **Le visiteur est au pied des marches.** Le livre du jour est posé sur le pupitre, éclairé par la seule bougie.
- **24 étoiles = 24 skills.** Au-dessus de la nef, une constellation se trace jour après jour : une étoile allumée par case ouverte, reliée aux précédentes par un trait.
  - Les cases fermées sont des étoiles éteintes : un simple cercle à l'encre.
  - L'étoile du jour pulse doucement.
- **Le moment waw (un seul)** : le livre s'ouvre sur le pupitre et ses pages tournent. Une lueur monte de la page vers le ciel, et la nouvelle étoile s'allume et se relie à la constellation. Puis la page du grimoire s'affiche (DOM).
- **On abandonne** l'or, le cuir, les sceaux de cire et les chaînes, Cinzel, les doubles filets dorés et le rayonnage de 24 livres numérotés.
- **L'interface DOM** est dessinée à l'encre sur un papier bleu : traits fins, sans dorure ni ombre portée. La grille accessible devient la carte du ciel, avec 24 étoiles numérotées.
