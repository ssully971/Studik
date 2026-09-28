import anecdotes from '../data/anecdotes.json'

// Anecdote du jour + salutation horaire — partagées entre l'accueil P2 (pages/accueil.js) et le
// tableau de bord Externat (pages/externat/edn-accueil.js) : même mécanique, un seul endroit qui
// la définit plutôt que deux copies qui pourraient diverger.
export function pickAnecdote() {
  const debutAnnee = new Date(new Date().getFullYear(), 0, 0)
  const diff = new Date() - debutAnnee
  const jourDeLAnnee = Math.floor(diff / (1000 * 60 * 60 * 24))
  const index = jourDeLAnnee % anecdotes.length
  return anecdotes[index]
}

export function getSalutation() {
  const heure = new Date().getHours()
  return heure >= 5 && heure < 18 ? 'Bonjour' : 'Bonsoir'
}
