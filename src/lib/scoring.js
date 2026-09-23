// --- Notation (barème Outremed) ---
// Par question : 1 point si 0 erreur, 0,5 point si 1 erreur, 0 point si 2 erreurs ou plus.
// Une "erreur" = un item où la réponse cochée ne correspond pas à la bonne réponse.
// Fonctions pures (aucun accès réseau) — extraites de lib/qcm.js pour pouvoir les tester
// sans dépendre de lib/supabase.js. qcm.js les ré-exporte, les imports existants ne bougent pas.

export function scoreQuestion(items, reponsesItem) {
  let erreurs = 0
  items.forEach((item, i) => {
    if (Boolean(reponsesItem[i]) !== Boolean(item.correct)) erreurs++
  })
  if (erreurs === 0) return 1
  if (erreurs === 1) return 0.5
  return 0
}

export function scoreQcm(questions, reponses) {
  let total = 0
  questions.forEach((q, i) => {
    total += scoreQuestion(q.items, reponses[i] || [])
  })
  return { score: total, scoreMax: questions.length }
}

export function questionsRateesDeLaTentative(qcm, tentative) {
  const indices = []
  qcm.questions.forEach((q, i) => {
    const reponsesQuestion = (tentative.reponses && tentative.reponses[i]) || []
    const correcte = q.items.every((item, j) => Boolean(reponsesQuestion[j]) === Boolean(item.correct))
    if (!correcte) indices.push(i)
  })
  return indices
}
