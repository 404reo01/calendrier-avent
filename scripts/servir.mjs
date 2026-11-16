// Serveur statique de développement, sans dépendance.
// Usage : node scripts/servir.mjs [--scenario <nom>]   (PORT=4173 par défaut)
import { createServer } from "node:http";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOTE = "127.0.0.1"; // jamais exposé au réseau local
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function lireScenario(argv) {
  const i = argv.indexOf("--scenario");
  if (i === -1) return null;
  const nom = argv[i + 1];
  // Liste blanche de caractères : le nom sert à construire un chemin.
  if (!nom || !/^[a-z0-9-]+$/.test(nom)) {
    throw new Error("--scenario attend un nom (ex. 12-decembre) : voir site/fixtures/");
  }
  const dossier = join(RACINE, "site", "fixtures", nom);
  if (!existsSync(dossier)) throw new Error(`Scénario introuvable : site/fixtures/${nom}`);
  return dossier;
}

// Liste des dossiers à essayer dans l'ordre. Avec un scénario, ses données passent avant site/.
function racinesDeService(dossierScenario) {
  if (dossierScenario) return [dossierScenario, join(RACINE, "site")];
  const dist = join(RACINE, "dist");
  return [existsSync(dist) ? dist : join(RACINE, "site")];
}

// Retourne un chemin de fichier sûr sous `base`, ou null.
function cheminSous(base, urlChemin) {
  let decode;
  try {
    decode = decodeURIComponent(urlChemin);
  } catch {
    return null;
  }
  if (decode.includes("\0")) return null;
  const complet = normalize(join(base, decode));
  // Protection contre ../ : le résultat doit rester dans la base.
  if (complet !== base && !complet.startsWith(base + sep)) return null;
  return complet;
}

function fichierPour(racines, urlChemin, fixturesInterdit) {
  const relatif = urlChemin === "/" ? "/index.html" : urlChemin;
  // Hors scénario, les fixtures ne sont pas servies (elles sont exclues du build).
  if (fixturesInterdit && /^\/fixtures(\/|$)/.test(relatif)) return null;
  for (const base of racines) {
    const chemin = cheminSous(base, relatif);
    if (chemin && existsSync(chemin) && statSync(chemin).isFile()) return chemin;
  }
  return null;
}

function repondre(res, code, type, corps) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(corps);
}

function demarrer() {
  const scenario = lireScenario(process.argv.slice(2));
  const racines = racinesDeService(scenario);

  const serveur = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return repondre(res, 405, "text/plain; charset=utf-8", "Méthode non permise");
    }
    const { pathname } = new URL(req.url, `http://${HOTE}`);
    const fichier = fichierPour(racines, pathname, !scenario);
    if (!fichier) return repondre(res, 404, "text/plain; charset=utf-8", "404 : introuvable");
    try {
      const contenu = await readFile(fichier);
      const type = TYPES[extname(fichier).toLowerCase()] ?? "application/octet-stream";
      repondre(res, 200, type, req.method === "HEAD" ? undefined : contenu);
    } catch {
      repondre(res, 404, "text/plain; charset=utf-8", "404 : introuvable");
    }
  });

  serveur.listen(PORT, HOTE, () => {
    const source = scenario ? `site/ + scénario ${scenario.split(sep).pop()}` : racines[0].split(sep).pop() + "/";
    process.stdout.write(`Calendrier servi sur http://${HOTE}:${PORT}/ (${source})\n`);
  });
}

try {
  demarrer();
} catch (erreur) {
  process.stderr.write(`${erreur.message}\n`);
  process.exit(1);
}
