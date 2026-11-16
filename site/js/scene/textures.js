// Les rares images de la scène sont dessinées ici, sur des <canvas> : aucun fichier externe.
// Le grain de papier et le lavis ne sont pas ici : ils sont posés en une passe finale (rendu.js).
import * as THREE from "../../vendor/three.module.min.js";
import { hasard } from "./geometrie.js";

const POLICE_TITRE = "'Grenze Gotisch', 'Times New Roman', serif";
const POLICE_TEXTE = "Vollkorn, Georgia, serif";
const ENCRE = "#1c2554";

// La page du livre reprend les polices du site : on les attend, une seconde et demie au plus,
// sinon le canvas prendrait la police de secours.
export async function attendrePolices() {
  if (!document.fonts?.load) return;
  const chargement = Promise.all([
    document.fonts.load(`700 64px ${POLICE_TITRE}`),
    document.fonts.load(`italic 400 20px ${POLICE_TEXTE}`),
  ]).catch(() => undefined);
  await Promise.race([chargement, new Promise((resoudre) => setTimeout(resoudre, 1500))]);
}

function toile(largeur, hauteur) {
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  return { canvas, ctx: canvas.getContext("2d") };
}

function enTexture(canvas, { repeter = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeter) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// Le dallage : quatre dalles claires de valeurs voisines, joints à l'encre. La couleur vient du matériau.
export function textureDallage() {
  const { canvas, ctx } = toile(256, 256);
  const alea = hasard(7);
  for (let i = 0; i < 4; i += 1) {
    const ton = 205 + Math.round(alea() * 40);
    ctx.fillStyle = `rgb(${ton},${ton + 4},${ton + 8})`;
    ctx.fillRect((i % 2) * 128, Math.floor(i / 2) * 128, 128, 128);
  }
  // Taches de lavis : la dalle n'est jamais d'un ton uni.
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(40,70,100,${0.04 + alea() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(alea() * 256, alea() * 256, 10 + alea() * 40, 6 + alea() * 24, alea() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(20,30,60,0.85)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 125, 125);
  ctx.strokeRect(129.5, 1.5, 125, 125);
  ctx.strokeRect(1.5, 129.5, 125, 125);
  ctx.strokeRect(129.5, 129.5, 125, 125);
  return enTexture(canvas, { repeter: true });
}

// Une lancette de vitrail : la nuit vue à travers un verre bleu, un réseau de plombs en losanges.
export function textureVitrail() {
  const { canvas, ctx } = toile(128, 512);
  const degrade = ctx.createLinearGradient(0, 0, 0, 512);
  degrade.addColorStop(0, "#8fb4e4");
  degrade.addColorStop(0.55, "#4f78c0");
  degrade.addColorStop(1, "#2c4f93");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 128, 512);
  const alea = hasard(3);
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + alea() * 0.5})`;
    ctx.fillRect(alea() * 128, alea() * 512, 2, 2);
  }
  ctx.strokeStyle = "rgba(12,20,48,0.75)";
  ctx.lineWidth = 2;
  for (let k = -512; k < 640; k += 40) {
    ctx.beginPath();
    ctx.moveTo(0, k);
    ctx.lineTo(128, k + 64);
    ctx.moveTo(0, k + 64);
    ctx.lineTo(128, k);
    ctx.stroke();
  }
  return enTexture(canvas);
}

// Une page manuscrite : des lignes d'écriture à l'encre, une petite étoile et le numéro du jour.
export function texturePage(jour) {
  const { canvas, ctx } = toile(256, 320);
  ctx.fillStyle = "#eef3f5";
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = ENCRE;
  ctx.textAlign = "center";
  ctx.font = `700 58px ${POLICE_TITRE}`;
  ctx.fillText(String(jour), 128, 92);
  dessinerEtoile(ctx, 128, 130, 14);
  const alea = hasard(jour + 11);
  ctx.strokeStyle = "rgba(28,37,84,0.55)";
  ctx.lineWidth = 2;
  for (let y = 168; y < 300; y += 16) {
    const fin = 40 + 176 * (0.55 + alea() * 0.45);
    ctx.beginPath();
    ctx.moveTo(40, y);
    for (let x = 40; x < fin; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.7 + y) * 1.4);
    ctx.stroke();
  }
  return enTexture(canvas);
}

// La couverture : une toile indigo, une étoile tracée à l'encre pâle.
export function textureCouverture() {
  const { canvas, ctx } = toile(256, 320);
  ctx.fillStyle = "#26356a";
  ctx.fillRect(0, 0, 256, 320);
  ctx.strokeStyle = "rgba(200,220,240,0.7)";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, 212, 276);
  ctx.fillStyle = "rgba(220,232,245,0.9)";
  dessinerEtoile(ctx, 128, 160, 40);
  return enTexture(canvas);
}

function dessinerEtoile(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const rayon = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(x + Math.cos(angle) * rayon, y + Math.sin(angle) * rayon);
  }
  ctx.closePath();
  ctx.fill();
}
