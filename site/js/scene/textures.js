// Toutes les images de la scène sont dessinées ici, sur des <canvas> : aucun fichier externe.
import * as THREE from "../../vendor/three.module.min.js";

export const CUIRS = ["#5b1f26", "#23305a", "#4a2f1d", "#43233f", "#2f3a44"];
const OR = "#e2bf6a";
const OR_SOMBRE = "#a8822f";
const PAPIER = "#efe1c2";
const POLICE_TITRE = "Cinzel, 'Times New Roman', serif";
const POLICE_TEXTE = "Alegreya, Georgia, serif";

// Les polices du site servent aussi aux dos de livres : on attend qu'elles soient prêtes, sans bloquer
// plus d'une seconde et demie (sinon le canvas prend la police de secours).
export async function attendrePolices() {
  if (!document.fonts?.load) return;
  const chargement = Promise.all([
    document.fonts.load(`700 64px ${POLICE_TITRE}`),
    document.fonts.load(`italic 400 28px ${POLICE_TEXTE}`),
  ]).catch(() => undefined);
  await Promise.race([chargement, new Promise((resoudre) => setTimeout(resoudre, 1500))]);
}

// Pseudo-aléatoire déterministe : le même livre a toujours le même grain de cuir.
export function hasard(graine) {
  let etat = graine * 2654435761 % 4294967296;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}

function toile(largeur, hauteur) {
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  return { canvas, ctx: canvas.getContext("2d") };
}

function enTexture(canvas, { srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function grainDeCuir(ctx, largeur, hauteur, couleur, alea) {
  ctx.fillStyle = couleur;
  ctx.fillRect(0, 0, largeur, hauteur);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = alea() < 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(alea() * largeur, alea() * hauteur, 1 + alea() * 2, 1 + alea() * 2);
  }
  // Bombé du dos : plus sombre sur les bords.
  const bombe = ctx.createLinearGradient(0, 0, largeur, 0);
  bombe.addColorStop(0, "rgba(0,0,0,0.45)");
  bombe.addColorStop(0.5, "rgba(255,255,255,0.06)");
  bombe.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = bombe;
  ctx.fillRect(0, 0, largeur, hauteur);
}

function doubleFilet(ctx, y, largeur, couleur) {
  ctx.fillStyle = couleur;
  ctx.fillRect(0, y, largeur, 4);
  ctx.fillRect(0, y + 9, largeur, 2);
}

// Les éléments dorés du dos, dessinés une fois sur le cuir et une fois seuls (carte d'émission) :
// l'or reste lisible et brille légèrement même dans la pénombre de la scène.
function dorureDuDos(ctx, l, h, jour, duJour, couleurOr) {
  doubleFilet(ctx, 26, l, couleurOr);
  doubleFilet(ctx, h - 40, l, couleurOr);
  ctx.strokeStyle = couleurOr;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 66, l - 28, 104);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 72, l - 40, 92);
  ctx.fillStyle = couleurOr;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${jour > 9 ? 54 : 62}px ${POLICE_TITRE}`;
  ctx.fillText(String(jour), l / 2, 121);
  ctx.font = `400 30px ${POLICE_TEXTE}`;
  ctx.fillText("❅", l / 2, 226);
  if (duJour) {
    ctx.font = `italic 400 21px ${POLICE_TEXTE}`;
    ctx.fillText("Aujourd'hui", l / 2, h - 74);
  }
}

export function textureDeDos(jour, couleur, duJour) {
  const l = 128;
  const h = 512;
  const fond = toile(l, h);
  grainDeCuir(fond.ctx, l, h, couleur, hasard(jour));
  dorureDuDos(fond.ctx, l, h, jour, duJour, OR);
  const lueur = toile(l, h);
  lueur.ctx.fillStyle = "#000";
  lueur.ctx.fillRect(0, 0, l, h);
  dorureDuDos(lueur.ctx, l, h, jour, duJour, OR_SOMBRE);
  return { carte: enTexture(fond.canvas), emission: enTexture(lueur.canvas) };
}

export function textureDeCouverture(jour, couleur) {
  const t = 512;
  const { canvas, ctx } = toile(t, t);
  grainDeCuir(ctx, t, t, couleur, hasard(jour + 100));
  ctx.strokeStyle = OR;
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, t - 56, t - 56);
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, t - 88, t - 88);
  ctx.fillStyle = OR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 150px ${POLICE_TITRE}`;
  ctx.fillText(String(jour), t / 2, t / 2);
  ctx.font = `400 46px ${POLICE_TEXTE}`;
  ctx.fillText("❅", t / 2, t / 2 - 140);
  ctx.fillText("❅", t / 2, t / 2 + 140);
  return enTexture(canvas);
}

// Une page de grimoire : lettrine et lignes d'écriture suggérées (aucun vrai texte de case).
export function textureDePage(jour, avecLettrine) {
  const l = 256;
  const h = 384;
  const { canvas, ctx } = toile(l, h);
  const alea = hasard(jour + 300);
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, l, h);
  const vieilli = ctx.createRadialGradient(l / 2, h / 2, h * 0.2, l / 2, h / 2, h * 0.7);
  vieilli.addColorStop(0, "rgba(0,0,0,0)");
  vieilli.addColorStop(1, "rgba(120,80,30,0.28)");
  ctx.fillStyle = vieilli;
  ctx.fillRect(0, 0, l, h);
  let y = 40;
  if (avecLettrine) {
    ctx.fillStyle = "#7f2330";
    ctx.font = `700 64px ${POLICE_TITRE}`;
    ctx.textBaseline = "top";
    ctx.fillText(String(jour), 26, 30);
    y = 44;
  }
  ctx.fillStyle = "rgba(58,42,26,0.32)";
  for (; y < h - 36; y += 15) {
    const debut = avecLettrine && y < 100 ? 96 : 26;
    const fin = l - 26 - alea() * (y > h - 70 ? 120 : 24);
    ctx.fillRect(debut, y, fin - debut, 2);
  }
  return enTexture(canvas);
}

export function textureDeTranche() {
  const { canvas, ctx } = toile(64, 64);
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "rgba(120,90,50,0.35)";
  for (let y = 0; y < 64; y += 3) ctx.fillRect(0, y, 64, 1);
  const texture = enTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function textureDeCiel() {
  const l = 256;
  const h = 512;
  const { canvas, ctx } = toile(l, h);
  const degrade = ctx.createLinearGradient(0, 0, 0, h);
  degrade.addColorStop(0, "#0b1430");
  degrade.addColorStop(0.65, "#1d3566");
  degrade.addColorStop(1, "#5d7fb5");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, l, h);
  const alea = hasard(7);
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = `rgba(230,236,255,${0.3 + alea() * 0.6})`;
    const r = alea() < 0.1 ? 1.6 : 0.8;
    ctx.beginPath();
    ctx.arc(alea() * l, alea() * h * 0.6, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Toits enneigés au loin, en silhouette.
  ctx.fillStyle = "#0d1630";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= l; x += 32) ctx.lineTo(x, h - 50 - alea() * 60);
  ctx.lineTo(l, h);
  ctx.fill();
  return enTexture(canvas);
}

export function textureRonde(interieur, exterieur) {
  const t = 64;
  const { canvas, ctx } = toile(t, t);
  const degrade = ctx.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  degrade.addColorStop(0, interieur);
  degrade.addColorStop(1, exterieur);
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, t, t);
  return enTexture(canvas);
}

export function textureDeFlamme() {
  const l = 64;
  const h = 128;
  const { canvas, ctx } = toile(l, h);
  const degrade = ctx.createRadialGradient(l / 2, h * 0.68, 2, l / 2, h * 0.6, h * 0.5);
  degrade.addColorStop(0, "rgba(255,250,225,1)");
  degrade.addColorStop(0.25, "rgba(255,205,110,0.95)");
  degrade.addColorStop(0.6, "rgba(230,120,40,0.35)");
  degrade.addColorStop(1, "rgba(200,80,20,0)");
  ctx.fillStyle = degrade;
  ctx.beginPath();
  ctx.moveTo(l / 2, 4);
  ctx.bezierCurveTo(l * 0.95, h * 0.55, l * 0.85, h * 0.98, l / 2, h * 0.98);
  ctx.bezierCurveTo(l * 0.15, h * 0.98, l * 0.05, h * 0.55, l / 2, 4);
  ctx.fill();
  return enTexture(canvas);
}

// Une rune dorée inventée : quelques traits droits, comme gravés au burin.
export function textureDeRune(graine) {
  const t = 64;
  const { canvas, ctx } = toile(t, t);
  const alea = hasard(graine + 500);
  ctx.strokeStyle = "rgba(255,214,130,1)";
  ctx.shadowColor = "rgba(255,190,90,1)";
  ctx.shadowBlur = 8;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(32, 54);
  for (let i = 0; i < 2; i += 1) {
    const y = 14 + alea() * 30;
    const cote = alea() < 0.5 ? -1 : 1;
    ctx.moveTo(32, y);
    ctx.lineTo(32 + cote * (10 + alea() * 10), y + (alea() < 0.5 ? -1 : 1) * (8 + alea() * 8));
  }
  ctx.stroke();
  return enTexture(canvas);
}
