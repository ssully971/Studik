// Champ servant de clé primaire selon la cible d'import — "numero" (entier) pour les
// référentiels R2C, "id" (texte slugifié) partout ailleurs (voir lib/r2c.js).
//
// Séparé de lib/import-schemas.js (qui réexporte idFieldPourCible pour ne pas casser son API)
// exprès : ce fichier ne dépend PAS de zod, pages/import.js peut donc l'importer statiquement
// sans faire basculer zod dans le bundle principal (import-schemas.js reste chargé à la demande
// au clic sur "Importer", voir CLAUDE.md § Validation à l'import).
const ID_FIELD_PAR_CIBLE = {
  r2c_items: 'numero',
  r2c_sdd: 'numero',
}

export function idFieldPourCible(target) {
  return ID_FIELD_PAR_CIBLE[target] || 'id'
}
