// Notation ECOS (§5.9) : grille à points, somme des items cochés sur le total des points
// possibles. Pas de "zéro éliminatoire" automatique — aucune source officielle trouvée pour cette
// règle (voir docs/externat/DECISIONS.md), donc aucun code ne l'applique ici.

export function scoreGrille(grille, cochees) {
  const items = grille?.items || []
  const score = items.reduce((acc, item) => acc + (cochees[item.id] ? item.points : 0), 0)
  const scoreMax = items.reduce((acc, item) => acc + item.points, 0)
  return { score, scoreMax }
}

// Items "critique: true" manqués (§5.9 : "met l'item en évidence au débriefing s'il est manqué").
export function itemsCritiquesManques(grille, cochees) {
  return (grille?.items || []).filter((item) => item.critique && !cochees[item.id])
}
