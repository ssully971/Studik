import { todayLocal, addDays } from './date-utils.js'

export function computeStreak(jours) {
  const set = new Set(jours)
  const today = todayLocal()
  const yesterday = addDays(today, -1)

  // Série actuelle : part d'aujourd'hui si déjà fait, sinon d'hier
  // (pour ne pas casser la série avant même que la journée soit finie)
  let actuelle = 0
  let curseur = set.has(today) ? today : set.has(yesterday) ? yesterday : null

  if (curseur) {
    while (set.has(curseur)) {
      actuelle++
      curseur = addDays(curseur, -1)
    }
  }

  // Meilleure série historique
  const trie = [...set].sort()
  let meilleure = 0
  let courante = 0
  let precedent = null

  trie.forEach((jour) => {
    courante = precedent && addDays(precedent, 1) === jour ? courante + 1 : 1
    meilleure = Math.max(meilleure, courante)
    precedent = jour
  })

  return { actuelle, meilleure, aCheckeAujourdhui: set.has(today) }
}
