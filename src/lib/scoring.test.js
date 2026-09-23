import { describe, it, expect } from 'vitest'
import { scoreQuestion, scoreQcm, questionsRateesDeLaTentative } from './scoring.js'

function items(corrects) {
  return corrects.map((correct) => ({ correct }))
}

describe('scoreQuestion', () => {
  it('0 erreur -> 1 point', () => {
    expect(scoreQuestion(items([true, false, true]), [true, false, true])).toBe(1)
  })

  it('1 erreur (case cochée à tort) -> 0,5 point', () => {
    expect(scoreQuestion(items([true, false, true]), [true, true, true])).toBe(0.5)
  })

  it('1 erreur (case non cochée à tort) -> 0,5 point', () => {
    expect(scoreQuestion(items([true, false, true]), [true, false, false])).toBe(0.5)
  })

  it('2 erreurs -> 0 point', () => {
    expect(scoreQuestion(items([true, false, true]), [false, true, true])).toBe(0)
  })

  it('3 erreurs -> 0 point (même palier que 2+)', () => {
    expect(scoreQuestion(items([true, false, true]), [false, true, false])).toBe(0)
  })

  it('aucune case cochée alors que des réponses sont correctes -> erreurs comptées', () => {
    expect(scoreQuestion(items([true]), [])).toBe(0.5)
  })

  it('question sans items -> comportement actuel : 1 point (aucune erreur possible sur 0 item)', () => {
    // Signalé : un item vide donne le score maximal plutôt qu'un score neutre/nul.
    expect(scoreQuestion([], [])).toBe(1)
  })

  it('reponsesItem undefined -> comportement actuel : lève une exception (non modifié)', () => {
    expect(() => scoreQuestion(items([true, false]), undefined)).toThrow(TypeError)
  })
})

describe('scoreQcm', () => {
  it('QCM sans questions -> {score: 0, scoreMax: 0}', () => {
    expect(scoreQcm([], [])).toEqual({ score: 0, scoreMax: 0 })
  })

  it('QCM de 20 questions : 8 sans erreur, 6 à une erreur, 6 à 2+ erreurs = 11 / 20', () => {
    const questions = [
      ...Array.from({ length: 8 }, () => ({ items: items([true, false]) })),
      ...Array.from({ length: 6 }, () => ({ items: items([true, false]) })),
      ...Array.from({ length: 6 }, () => ({ items: items([true, false]) })),
    ]
    const reponses = [
      ...Array.from({ length: 8 }, () => [true, false]), // 0 erreur -> 1 pt
      ...Array.from({ length: 6 }, () => [false, false]), // 1 erreur -> 0.5 pt
      ...Array.from({ length: 6 }, () => [false, true]), // 2 erreurs -> 0 pt
    ]
    expect(scoreQcm(questions, reponses)).toEqual({ score: 11, scoreMax: 20 })
  })
})

describe('cohérence scoreQcm / questionsRateesDeLaTentative / a_revoir', () => {
  it('toute question à 0,5 ou 0 apparaît dans questionsRateesDeLaTentative, et a_revoir est cohérent', () => {
    const questions = [
      { items: items([true, false]) }, // sera répondue sans erreur
      { items: items([true, false]) }, // sera répondue avec 1 erreur
      { items: items([true, false]) }, // sera répondue avec 2 erreurs
    ]
    const reponses = [
      [true, false],
      [false, false],
      [false, true],
    ]

    const { score, scoreMax } = scoreQcm(questions, reponses)
    const aRevoir = score < scoreMax

    const scoresParQuestion = questions.map((q, i) => scoreQuestion(q.items, reponses[i]))
    const indicesRates = questionsRateesDeLaTentative({ questions }, { reponses })

    scoresParQuestion.forEach((s, i) => {
      if (s < 1) expect(indicesRates).toContain(i)
      else expect(indicesRates).not.toContain(i)
    })

    expect(aRevoir).toBe(indicesRates.length > 0)
  })
})
