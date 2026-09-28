import { describe, it, expect } from 'vitest'
import {
  DUREE_STATION_S,
  DUREE_TRANSITION_S,
  REPERE_LECTURE_S,
  ALERTE_FINALE_S,
  creerChrono,
  demarrerChrono,
  terminerChrono,
  secondesEcoulees,
  secondesRestantes,
  estTermineParTemps,
  repereLectureAtteint,
  alerteFinaleAtteinte,
  formatChrono,
  creerCircuit,
  stationCouranteCircuit,
  circuitTermine,
  avancerCircuit,
} from './ecos-timer.js'

describe('constantes §5.9', () => {
  it('8 minutes par station, 2 minutes de transition', () => {
    expect(DUREE_STATION_S).toBe(480)
    expect(DUREE_TRANSITION_S).toBe(120)
  })
})

describe('cycle pret -> en_cours -> termine', () => {
  it('creerChrono démarre "pret", temps restant = durée totale', () => {
    const c = creerChrono(DUREE_STATION_S)
    expect(c.etat).toBe('pret')
    expect(secondesRestantes(c, 1_000_000)).toBe(DUREE_STATION_S)
  })

  it('demarrerChrono passe en_cours et fixe le début', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 1000)
    expect(c.etat).toBe('en_cours')
    expect(c.debut).toBe(1000)
  })

  it('demarrerChrono ignoré si déjà en_cours ou termine (pas de redémarrage accidentel)', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 1000)
    const c2 = demarrerChrono(c, 5000)
    expect(c2).toEqual(c)
    const t = terminerChrono(c)
    expect(demarrerChrono(t, 9000)).toEqual(t)
  })

  it('terminerChrono passe en "termine"', () => {
    const c = terminerChrono(demarrerChrono(creerChrono(DUREE_STATION_S), 0))
    expect(c.etat).toBe('termine')
  })
})

describe('calcul du temps sur Date.now()/performance.now(), jamais par décrément', () => {
  it('secondesEcoulees et secondesRestantes se recalculent depuis le même "debut"', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 0)
    expect(secondesEcoulees(c, 0)).toBe(0)
    expect(secondesEcoulees(c, 30_000)).toBe(30)
    expect(secondesRestantes(c, 30_000)).toBe(DUREE_STATION_S - 30)
    // Rejouer un "maintenant" antérieur donne le même résultat qu'avant — aucun état interne
    // n'a été modifié par un précédent appel (pas de décrément mutant un compteur).
    expect(secondesRestantes(c, 30_000)).toBe(DUREE_STATION_S - 30)
  })

  it('secondesRestantes ne descend jamais sous 0', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 0)
    expect(secondesRestantes(c, (DUREE_STATION_S + 500) * 1000)).toBe(0)
  })

  it('un chrono "pret" (jamais démarré) a un temps écoulé nul', () => {
    expect(secondesEcoulees(creerChrono(DUREE_STATION_S), 999_999)).toBe(0)
  })
})

describe('estTermineParTemps', () => {
  it('vrai seulement quand en_cours ET temps écoulé', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 0)
    expect(estTermineParTemps(c, (DUREE_STATION_S - 1) * 1000)).toBe(false)
    expect(estTermineParTemps(c, DUREE_STATION_S * 1000)).toBe(true)
  })

  it('faux sur un chrono "pret" ou déjà "termine", même si le temps est dépassé', () => {
    expect(estTermineParTemps(creerChrono(DUREE_STATION_S), 999_999_999)).toBe(false)
    const t = terminerChrono(demarrerChrono(creerChrono(DUREE_STATION_S), 0))
    expect(estTermineParTemps(t, 999_999_999)).toBe(false)
  })
})

describe('repère de lecture (7:00 restantes) et alerte finale (1:00 restante)', () => {
  it('repereLectureAtteint à 60s écoulées (7:00 restantes) mais pas avant', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 0)
    expect(repereLectureAtteint(c, 59_000)).toBe(false)
    expect(repereLectureAtteint(c, 60_000)).toBe(true)
    expect(REPERE_LECTURE_S).toBe(420)
  })

  it('alerteFinaleAtteinte à 1:00 restante mais pas à 0 (chrono déjà "terminé" par le temps)', () => {
    const c = demarrerChrono(creerChrono(DUREE_STATION_S), 0)
    expect(alerteFinaleAtteinte(c, (DUREE_STATION_S - ALERTE_FINALE_S - 1) * 1000)).toBe(false)
    expect(alerteFinaleAtteinte(c, (DUREE_STATION_S - ALERTE_FINALE_S) * 1000)).toBe(true)
    expect(alerteFinaleAtteinte(c, DUREE_STATION_S * 1000)).toBe(false)
  })

  it("aucun repère/alerte sur un chrono pas encore démarré", () => {
    const c = creerChrono(DUREE_STATION_S)
    expect(repereLectureAtteint(c, 1000)).toBe(false)
    expect(alerteFinaleAtteinte(c, 1000)).toBe(false)
  })
})

describe('formatChrono', () => {
  it('formate en mm:ss avec zéros de tête', () => {
    expect(formatChrono(480)).toBe('08:00')
    expect(formatChrono(65)).toBe('01:05')
    expect(formatChrono(0)).toBe('00:00')
  })
})

describe('circuit (enchaînement de stations)', () => {
  it("avance d'une station à la fois jusqu'à la fin", () => {
    let circuit = creerCircuit(['s1', 's2', 's3'])
    expect(stationCouranteCircuit(circuit)).toBe('s1')
    expect(circuitTermine(circuit)).toBe(false)

    circuit = avancerCircuit(circuit)
    expect(stationCouranteCircuit(circuit)).toBe('s2')

    circuit = avancerCircuit(circuit)
    expect(stationCouranteCircuit(circuit)).toBe('s3')

    circuit = avancerCircuit(circuit)
    expect(circuitTermine(circuit)).toBe(true)
    expect(stationCouranteCircuit(circuit)).toBeNull()
  })

  it('avancerCircuit au-delà de la fin ne fait rien (idempotent)', () => {
    let circuit = creerCircuit(['s1'])
    circuit = avancerCircuit(circuit)
    expect(circuitTermine(circuit)).toBe(true)
    const encore = avancerCircuit(circuit)
    expect(encore).toEqual(circuit)
  })
})
