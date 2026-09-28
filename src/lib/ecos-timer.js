// Chronomètre ECOS (§5.9) : petite machine à états pure, testée, réutilisée à l'identique pour
// le temps de station (8:00) ET la transition entre deux stations en mode circuit (2:00) — un
// seul état, jamais deux implémentations. Le temps restant se calcule toujours à partir d'un
// horodatage de début (Date.now()/performance.now()), jamais par décrément d'un compteur, pour
// rester juste si l'onglet passe en arrière-plan.

export const DUREE_STATION_S = 8 * 60
export const DUREE_TRANSITION_S = 2 * 60
// "repère visuel doux à 7:00 restantes" (§5.9) : le CNG calibre la lecture de la vignette à
// environ 1 minute, sans signal de fin de lecture — ce repère est donc à 7:00 restantes sur un
// chrono de 8:00 (1:00 écoulée), pas à un instant fixe indépendant de la durée totale.
export const REPERE_LECTURE_S = 7 * 60
export const ALERTE_FINALE_S = 60

export function creerChrono(dureeTotaleS) {
  return { etat: 'pret', dureeTotaleS, debut: null }
}

export function demarrerChrono(chrono, maintenant = Date.now()) {
  if (chrono.etat !== 'pret') return chrono
  return { ...chrono, etat: 'en_cours', debut: maintenant }
}

export function terminerChrono(chrono) {
  if (chrono.etat === 'termine') return chrono
  return { ...chrono, etat: 'termine' }
}

export function secondesEcoulees(chrono, maintenant = Date.now()) {
  if (chrono.debut === null) return 0
  return Math.floor((maintenant - chrono.debut) / 1000)
}

export function secondesRestantes(chrono, maintenant = Date.now()) {
  if (chrono.etat === 'pret') return chrono.dureeTotaleS
  return Math.max(0, chrono.dureeTotaleS - secondesEcoulees(chrono, maintenant))
}

// Vrai une seule fois que le temps est écoulé alors que le chrono est toujours "en_cours" — à
// l'appelant de passer alors l'état à "termine" via terminerChrono (pas fait automatiquement ici :
// fonction pure, aucun effet de bord, aucun timer interne).
export function estTermineParTemps(chrono, maintenant = Date.now()) {
  return chrono.etat === 'en_cours' && secondesRestantes(chrono, maintenant) === 0
}

// §5.9 : repère à 7:00 restantes ("fin de lecture conseillée" sur une station de 8:00).
export function repereLectureAtteint(chrono, maintenant = Date.now()) {
  if (chrono.etat !== 'en_cours') return false
  return secondesRestantes(chrono, maintenant) <= REPERE_LECTURE_S
}

export function alerteFinaleAtteinte(chrono, maintenant = Date.now()) {
  if (chrono.etat !== 'en_cours') return false
  const restant = secondesRestantes(chrono, maintenant)
  return restant <= ALERTE_FINALE_S && restant > 0
}

export function formatChrono(secondes) {
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Circuit (§5.9, option) : enchaîne N stations avec DUREE_TRANSITION_S entre deux — pure
// description de la séquence, l'appelant décide quand avancer (bouton, ou fin de transition).
export function creerCircuit(stationIds) {
  return { stationIds, index: 0 }
}

export function stationCouranteCircuit(circuit) {
  return circuit.stationIds[circuit.index] ?? null
}

export function circuitTermine(circuit) {
  return circuit.index >= circuit.stationIds.length
}

export function avancerCircuit(circuit) {
  if (circuitTermine(circuit)) return circuit
  return { ...circuit, index: circuit.index + 1 }
}
