import { describe, it, expect } from 'vitest'
import { scoreGrille, itemsCritiquesManques } from './ecos-scoring.js'

const grille = {
  items: [
    { id: 'g1', critere: 'Se présente', points: 1, critique: false },
    { id: 'g2', critere: 'Recherche le motif de consultation', points: 2, critique: true },
    { id: 'g3', critere: 'Examine correctement', points: 3, critique: false },
  ],
  global: true,
}

describe('scoreGrille', () => {
  it('additionne les points des items cochés', () => {
    expect(scoreGrille(grille, { g1: true, g2: true, g3: false })).toEqual({ score: 3, scoreMax: 6 })
  })

  it('score 0 si rien de coché, scoreMax reste la somme totale', () => {
    expect(scoreGrille(grille, {})).toEqual({ score: 0, scoreMax: 6 })
  })

  it('score plein si tout coché', () => {
    expect(scoreGrille(grille, { g1: true, g2: true, g3: true })).toEqual({ score: 6, scoreMax: 6 })
  })

  it('grille vide -> 0/0, jamais de zéro éliminatoire imposé par le code', () => {
    expect(scoreGrille({ items: [] }, {})).toEqual({ score: 0, scoreMax: 0 })
  })
})

describe('itemsCritiquesManques', () => {
  it("retient uniquement les items critique:true non cochés", () => {
    expect(itemsCritiquesManques(grille, { g1: true })).toEqual([grille.items[1]])
  })

  it('aucun manqué si tous les critiques sont cochés', () => {
    expect(itemsCritiquesManques(grille, { g2: true })).toEqual([])
  })
})
