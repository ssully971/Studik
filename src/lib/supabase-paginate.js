// PostgREST (Supabase) plafonne chaque requête à 1000 lignes par défaut, quel que soit le
// nombre de lignes qui correspondent réellement au filtre — au-delà, le reste est tronqué
// SANS message d'erreur (`data` fait simplement 1000 lignes). Ce module fournit les deux
// mécanismes génériques pour lire une table entière sans jamais dépendre de ce plafond,
// utilisés partout où une lecture pourrait un jour dépasser 1000 lignes (voir CLAUDE.md,
// section "Lectures Supabase et pagination"). Aucune logique de pagination ne doit être
// recopiée dans un fichier appelant : tout passe par `paginerTout`/`requeteParLots`.

const TAILLE_PAGE = 1000
const TAILLE_LOT_IN = 200

// Lit une table entière page par page (.range()), en s'arrêtant dès qu'une page contient
// moins de TAILLE_PAGE lignes (donc jamais plus de requêtes que nécessaire, y compris pour
// une table qui contient exactement un multiple de 1000 lignes : la page suivante, vide,
// confirme qu'il n'y a rien de plus).
//
// `fabriqueRequete` doit renvoyer, à CHAQUE appel, une requête Supabase FRAÎCHE (filtres et
// tri déjà appliqués, sans `.range()` — ce module l'ajoute) : un query builder Supabase ne se
// réutilise pas après un premier `await`, il faut donc reconstruire la requête à chaque page.
//
// IMPORTANT — tri obligatoire et déterministe : `fabriqueRequete` doit trier sur une colonne
// (ou un couple de colonnes) qui garantit un ORDRE TOTAL sur les lignes, typiquement la clé
// primaire en dernier critère de tri. Un tri sur une colonne qui peut avoir des doublons
// (ex. `ordre_affichage`, `date_creation`, un `titre`) sans clé primaire en critère de
// départage peut faire apparaître une même ligne deux fois ou en sauter une entre deux pages
// consécutives — PostgREST ne garantit un ordre stable entre deux requêtes `.range()`
// successives QUE si le tri identifie une ligne de façon unique.
export async function paginerTout(fabriqueRequete, { taillePage = TAILLE_PAGE } = {}) {
  const resultat = []
  let debut = 0
  for (;;) {
    const { data, error } = await fabriqueRequete().range(debut, debut + taillePage - 1)
    if (error) throw error
    resultat.push(...data)
    if (data.length < taillePage) return resultat
    debut += taillePage
  }
}

// Découpe un `.in(colonne, ids)` en lots de TAILLE_LOT_IN : au-delà, l'URL de la requête peut
// devenir trop longue et PostgREST/le proxy peut refuser la requête. `fabriqueRequete(lot)`
// reçoit un sous-tableau d'ids et doit renvoyer la requête déjà filtrée sur ce lot (le
// `.in(colonne, lot)`). Les lots sont indépendants les uns des autres (contrairement aux pages
// de `paginerTout`, qui dépendent de l'ordre) : ils sont donc lancés en parallèle. Ne garantit
// PAS que l'ordre des résultats corresponde à l'ordre de `ids` — `.in()` ne l'a jamais garanti,
// même sans découpage.
export async function requeteParLots(ids, fabriqueRequete, { tailleLot = TAILLE_LOT_IN } = {}) {
  if (!ids || ids.length === 0) return []
  const lots = []
  for (let i = 0; i < ids.length; i += tailleLot) lots.push(ids.slice(i, i + tailleLot))

  const reponses = await Promise.all(
    lots.map(async (lot) => {
      const { data, error } = await fabriqueRequete(lot)
      if (error) throw error
      // Un .delete()/.update() sans .select() renvoie data: null (pas de représentation
      // demandée) — utilisé pour ses seuls effets de bord (ex. deleteTentativesByMatiere),
      // jamais pour sa valeur de retour, mais `null` ferait échouer le .flat() ci-dessous.
      return data || []
    })
  )
  return reponses.flat()
}
