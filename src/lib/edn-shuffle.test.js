import { describe, it, expect } from 'vitest'
import { melangerFisherYates } from './edn-shuffle.js'

describe('melangerFisherYates', () => {
  it('ne mute pas le tableau reçu', () => {
    const original = [1, 2, 3, 4]
    const copie = [...original]
    melangerFisherYates(original)
    expect(original).toEqual(copie)
  })

  it('conserve les mêmes éléments (juste réordonnés)', () => {
    const original = ['a', 'b', 'c', 'd', 'e']
    const resultat = melangerFisherYates(original)
    expect(resultat.slice().sort()).toEqual(original.slice().sort())
    expect(resultat.length).toBe(original.length)
  })

  it('déterministe avec un générateur injecté (toujours 0)', () => {
    const resultat = melangerFisherYates([1, 2, 3], () => 0)
    expect(resultat).toEqual([2, 3, 1])
  })
})
