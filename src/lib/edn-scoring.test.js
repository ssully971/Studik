import { describe, it, expect } from 'vitest'
import {
  scoreQru,
  scoreQrm,
  scoreQrp,
  scoreQrpLong,
  scoreZap,
  zoneToucheeParClic,
  scoreQroc,
  normaliserReponse,
  ajusterScoreQroc,
  scoreTcs,
  scoreQuestion,
  scoreDossier,
} from './edn-scoring.js'

describe('QRU (§5.2)', () => {
  const propositions = [
    { id: 'a', statut: 'vrai' },
    { id: 'b', statut: 'faux' },
    { id: 'c', statut: 'faux' },
    { id: 'd', statut: 'faux' },
  ]

  it('1 si seule la bonne réponse est cochée', () => {
    expect(scoreQru(propositions, ['a'])).toBe(1)
  })

  it('0 si la bonne réponse ET une autre sont cochées', () => {
    expect(scoreQru(propositions, ['a', 'b'])).toBe(0)
  })

  it('0 si une mauvaise réponse seule est cochée', () => {
    expect(scoreQru(propositions, ['b'])).toBe(0)
  })

  it('0 si rien n’est coché', () => {
    expect(scoreQru(propositions, [])).toBe(0)
  })
})

describe('QRM (§5.3) — exemple officiel 1 (2 = inacceptable)', () => {
  const propositions = [
    { id: '1', statut: 'indispensable' },
    { id: '2', statut: 'inacceptable' },
    { id: '3', statut: 'vrai' },
    { id: '4', statut: 'faux' },
  ]

  it.each([
    [['1', '3'], 1],
    [['1'], 0.5],
    [['3'], 0],
    [['1', '2', '3'], 0],
    [['1', '3', '4'], 0.5],
  ])('%j → %s', (reponses, attendu) => {
    expect(scoreQrm(propositions, reponses)).toBe(attendu)
  })
})

describe('QRM (§5.3) — exemple officiel 2 (2 = faux au lieu d’inacceptable)', () => {
  const propositions = [
    { id: '1', statut: 'indispensable' },
    { id: '2', statut: 'faux' },
    { id: '3', statut: 'vrai' },
    { id: '4', statut: 'faux' },
  ]

  it.each([
    [['1', '2', '3'], 0.5],
    [['1', '2', '4'], 0],
    [['1', '2', '3', '4'], 0.2],
  ])('%j → %s', (reponses, attendu) => {
    expect(scoreQrm(propositions, reponses)).toBe(attendu)
  })
})

describe('QRP (§5.4) — exemple officiel (n=3 ; 1=indispensable, 2=inacceptable, 3=vrai, 4=faux, 5=vrai)', () => {
  const propositions = [
    { id: '1', statut: 'indispensable' },
    { id: '2', statut: 'inacceptable' },
    { id: '3', statut: 'vrai' },
    { id: '4', statut: 'faux' },
    { id: '5', statut: 'vrai' },
  ]
  const n = 3

  it('{1,3,5} → 1 (le document officiel écrit "1 pt (2/2)", une coquille : 3/3 = 1, voir DECISIONS.md)', () => {
    expect(scoreQrp(propositions, n, ['1', '3', '5'])).toBe(1)
  })

  it('{1,3,4} → 0.67 (2/3)', () => {
    expect(scoreQrp(propositions, n, ['1', '3', '4'])).toBeCloseTo(2 / 3, 10)
  })

  it('{1,2,3} → 0 (inacceptable coché)', () => {
    expect(scoreQrp(propositions, n, ['1', '2', '3'])).toBe(0)
  })

  it('{3,4,5} → 0 (indispensable non coché)', () => {
    expect(scoreQrp(propositions, n, ['3', '4', '5'])).toBe(0)
  })
})

describe('QRP_LONG (§5.5) — même formule, sans indispensable/inacceptable', () => {
  const propositions = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, statut: i < 2 ? 'vrai' : 'faux' }))

  it('score = x/n', () => {
    expect(scoreQrpLong(propositions, 2, ['p0', 'p1'])).toBe(1)
    expect(scoreQrpLong(propositions, 2, ['p0'])).toBe(0.5)
    expect(scoreQrpLong(propositions, 2, ['p5'])).toBe(0)
  })
})

describe('ZAP (§5.6) — distance euclidienne ≤ rayon, conversion selon le ratio image', () => {
  const zones = [{ id: 'z1', forme: 'cercle', cx: 50, cy: 50, r: 10 }]

  it('un clic dans le cercle (image carrée) touche la zone', () => {
    expect(zoneToucheeParClic(zones[0], { x: 55, y: 50 }, { largeur: 100, hauteur: 100 })).toBe(true)
  })

  it('un clic hors du cercle ne le touche pas', () => {
    expect(zoneToucheeParClic(zones[0], { x: 80, y: 50 }, { largeur: 100, hauteur: 100 })).toBe(false)
  })

  it('le rayon est exprimé en % de la largeur : une image très rectangulaire ne doit pas ovaliser le cercle', () => {
    // Image 200x100 : 10% de la largeur (200) = 20px de rayon réel, appliqué de façon identique
    // sur x et y une fois converti en pixels absolus (dx/dy calculés séparément puis combinés).
    const dims = { largeur: 200, hauteur: 100 }
    // Décalage de 15px en x (dans les 20px de rayon) : doit toucher.
    expect(zoneToucheeParClic(zones[0], { x: 50 + (15 / 200) * 100, y: 50 }, dims)).toBe(true)
    // Décalage de 15px en y (aussi dans les 20px de rayon car le rayon suit la largeur, pas la hauteur) : doit toucher.
    expect(zoneToucheeParClic(zones[0], { x: 50, y: 50 + (15 / 100) * 100 }, dims)).toBe(true)
  })

  it('deux clics dans la même zone ne comptent qu’une fois ; score = zones touchées / x', () => {
    const clics = [
      { x: 50, y: 50 },
      { x: 52, y: 50 },
    ]
    expect(scoreZap(zones, 2, clics)).toBe(0.5)
  })

  it('zone rect : clic dans le rectangle', () => {
    const zonesRect = [{ id: 'r1', forme: 'rect', x: 10, y: 10, w: 20, h: 20 }]
    expect(zoneToucheeParClic(zonesRect[0], { x: 15, y: 15 })).toBe(true)
    expect(zoneToucheeParClic(zonesRect[0], { x: 40, y: 40 })).toBe(false)
  })
})

describe('QROC (§5.7) — normalisation puis comparaison', () => {
  it('minuscules, accents retirés', () => {
    expect(normaliserReponse('Aorte')).toBe(normaliserReponse('aorte'))
    expect(normaliserReponse('Œsophage')).not.toBe('')
  })

  it('article initial retiré', () => {
    expect(normaliserReponse("l'aorte")).toBe('aorte')
    expect(normaliserReponse('le foie')).toBe('foie')
  })

  it('ponctuation et espaces multiples retirés', () => {
    expect(normaliserReponse('foie,   rate.')).toBe('foie rate')
  })

  it('exacte → 1, acceptable → 0.5, sinon 0', () => {
    expect(scoreQroc('aorte', ['Aorte'], [])).toBe(1)
    expect(scoreQroc("l'aorte thoracique", [], ['Aorte thoracique'])).toBe(0.5)
    expect(scoreQroc('rien à voir', ['Aorte'], [])).toBe(0)
  })

  it('ajusterScoreQroc rectifie sans jamais dégrader le score', () => {
    expect(ajusterScoreQroc(0, 'juste')).toBe(1)
    expect(ajusterScoreQroc(0, 'acceptable')).toBe(0.5)
    expect(ajusterScoreQroc(1, 'acceptable')).toBe(1)
    expect(ajusterScoreQroc(0, null)).toBe(0)
  })
})

describe('TCS (§5.8) — réponse modale = 1, autres au prorata', () => {
  it('TCS #1 : votes {-2:0,-1:9,0:7,+1:3,+2:0}', () => {
    const votes = { '-2': 0, '-1': 9, '0': 7, '1': 3, '2': 0 }
    expect(scoreTcs(votes, '-1')).toBe(1)
    expect(scoreTcs(votes, '0')).toBeCloseTo(7 / 9, 10)
    expect(scoreTcs(votes, '1')).toBeCloseTo(3 / 9, 10)
    expect(scoreTcs(votes, '-2')).toBe(0)
  })

  it('TCS #2 : votes {-2:0,-1:1,0:15,+1:4,+2:0}', () => {
    const votes = { '-2': 0, '-1': 1, '0': 15, '1': 4, '2': 0 }
    expect(scoreTcs(votes, '0')).toBe(1)
    expect(scoreTcs(votes, '-1')).toBeCloseTo(1 / 15, 10)
    expect(scoreTcs(votes, '1')).toBeCloseTo(4 / 15, 10)
  })

  it('égalité pour le mode : chaque réponse à égalité vaut 1', () => {
    const votes = { '-2': 0, '-1': 5, '0': 5, '1': 0, '2': 0 }
    expect(scoreTcs(votes, '-1')).toBe(1)
    expect(scoreTcs(votes, '0')).toBe(1)
  })
})

describe('scoreQuestion — dispatch par format', () => {
  it('QRU', () => {
    const q = { format: 'QRU', contenu: { propositions: [{ id: 'a', statut: 'vrai' }, { id: 'b', statut: 'faux' }] } }
    expect(scoreQuestion(q, ['a'])).toBe(1)
  })

  it('ZAP', () => {
    const q = { format: 'ZAP', contenu: { zones: [{ id: 'z1', forme: 'cercle', cx: 50, cy: 50, r: 10 }], x: 1 } }
    expect(scoreQuestion(q, { clics: [{ x: 50, y: 50 }] })).toBe(1)
  })

  it('QROC', () => {
    const q = { format: 'QROC', contenu: { exactes: ['aorte'], acceptables: [] } }
    expect(scoreQuestion(q, 'Aorte')).toBe(1)
  })

  it('TCS', () => {
    const q = { format: 'TCS', contenu: { votes: { '-2': 0, '-1': 9, '0': 7, '1': 3, '2': 0 } } }
    expect(scoreQuestion(q, '-1')).toBe(1)
  })

  it('format inconnu lève une exception', () => {
    expect(() => scoreQuestion({ format: 'INCONNU', contenu: {} }, [])).toThrow()
  })
})

describe('scoreDossier', () => {
  it('somme les scores de chaque question, scoreMax = nombre de questions', () => {
    const questions = [
      { format: 'QRU', contenu: { propositions: [{ id: 'a', statut: 'vrai' }, { id: 'b', statut: 'faux' }] } },
      { format: 'QROC', contenu: { exactes: ['foie'], acceptables: [] } },
    ]
    const { score, scoreMax, detail } = scoreDossier(questions, [['a'], 'autre chose'])
    expect(scoreMax).toBe(2)
    expect(score).toBe(1)
    expect(detail).toEqual([1, 0])
  })
})
