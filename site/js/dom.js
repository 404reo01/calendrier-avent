// Petit utilitaire : on construit le DOM avec createElement + textContent,
// jamais avec innerHTML (un texte de case ne doit jamais être interprété comme du HTML).
export function el(nom, { classe, texte, attributs } = {}, enfants = []) {
  const noeud = document.createElement(nom);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  for (const [cle, valeur] of Object.entries(attributs ?? {})) {
    noeud.setAttribute(cle, String(valeur));
  }
  noeud.append(...enfants);
  return noeud;
}
