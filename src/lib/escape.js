// Échappement HTML minimal pour toute chaîne dérivée du contenu (titres, questions, noms de
// matière/cours...) avant de l'interpoler dans un template literal assigné à innerHTML — évite
// qu'un contenu contenant des caractères HTML (accidentel, ou injecté si l'accès aux données
// venait à être élargi) ne soit interprété comme du balisage actif.
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
