import { lirePreference, ecrirePreference } from './preferences.js'

// Qualification des erreurs (§7.4) — liste par défaut, modifiable dans Paramètres et stockée en
// préférence (synchronisée entre appareils, comme le reste de lib/preferences.js).
export const TAGS_ERREUR_DEFAUT = [
  'Biais de lecture',
  'Oubli de cours',
  'Confusion',
  'Méconnaissance (jamais appris)',
  'Précipitation',
  'Rang B',
]

export async function getTagsErreur() {
  try {
    const valeur = await lirePreference('edn_tags_erreur')
    return Array.isArray(valeur) && valeur.length > 0 ? valeur : TAGS_ERREUR_DEFAUT
  } catch {
    return TAGS_ERREUR_DEFAUT
  }
}

export async function setTagsErreur(tags) {
  await ecrirePreference('edn_tags_erreur', tags)
}
