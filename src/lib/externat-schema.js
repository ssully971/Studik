// Dégradation propre pour les tables externat : Sullivan n'a pas encore forcément appliqué les
// migrations (voir docs/externat/A-FAIRE-SULLIVAN.md). Un écran externat qui tape dans une table
// absente ne doit jamais planter — il affiche ce message à la place. Le mode P2 ne dépend
// d'aucune table externat et n'utilise jamais ce module.

// Codes rencontrés selon le chemin d'accès : '42P01' (Postgres direct, table absente) ou
// 'PGRST205' (PostgREST, "Could not find the table ... in the schema cache" — le cas le plus
// courant via supabase-js). On vérifie aussi le message en repli, au cas où l'un ou l'autre
// changerait de code dans une future version.
export function estTableAbsente(err) {
  if (!err) return false
  if (err.code === '42P01' || err.code === 'PGRST205') return true
  return typeof err.message === 'string' && /schema cache|relation .* does not exist/i.test(err.message)
}

export function messageMigrationManquante(numero) {
  return `Migration ${numero} non appliquée, voir docs/externat/A-FAIRE-SULLIVAN.md.`
}

// Rendu HTML prêt à poser dans un container quand une table externat manque encore.
export function htmlMigrationManquante(numero) {
  return `<p class="empty-note">${messageMigrationManquante(numero)}</p>`
}
