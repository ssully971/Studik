import { describe, it, expect } from 'vitest'
import {
  reussiteParSpecialite,
  reussiteParItem,
  reussiteParFormat,
  reussiteParRang,
  noteAAEstimee,
  reussiteEcosParDomaine,
  reussiteParHeure,
  reussiteParDureeSession,
  messageFatigue,
  estObsolete,
  SEUIL_VALIDATION_AA,
} from './edn-stats.js'

describe('reussiteParSpecialite / reussiteParItem / reussiteParFormat / reussiteParRang', () => {
  const unites = [
    { score: 1, scoreMax: 1, format: 'QRU', rang: 'A', specialites: ['Cardiologie'], items: [1, 2], estLCA: false },
    { score: 0, scoreMax: 1, format: 'QRM', rang: 'B', specialites: ['Cardiologie', 'Néphrologie'], items: [2], estLCA: false },
  ]

  it('additionne par spécialité (une unité peut compter dans plusieurs spécialités)', () => {
    const g = reussiteParSpecialite(unites)
    expect(g.get('Cardiologie')).toEqual({ score: 1, scoreMax: 2 })
    expect(g.get('Néphrologie')).toEqual({ score: 0, scoreMax: 1 })
  })

  it('additionne par item (les ids numériques deviennent des clés texte)', () => {
    const g = reussiteParItem(unites)
    expect(g.get('1')).toEqual({ score: 1, scoreMax: 1 })
    expect(g.get('2')).toEqual({ score: 1, scoreMax: 2 })
  })

  it('additionne par format', () => {
    const g = reussiteParFormat(unites)
    expect(g.get('QRU')).toEqual({ score: 1, scoreMax: 1 })
    expect(g.get('QRM')).toEqual({ score: 0, scoreMax: 1 })
  })

  it('additionne par rang', () => {
    const g = reussiteParRang(unites)
    expect(g.get('A')).toEqual({ score: 1, scoreMax: 1 })
    expect(g.get('B')).toEqual({ score: 0, scoreMax: 1 })
  })
})

describe('LCA comptée double', () => {
  it('une unité LCA pèse 2x dans chaque regroupement', () => {
    const unites = [{ score: 1, scoreMax: 1, format: 'QRU', rang: 'A', specialites: ['X'], items: [], estLCA: true }]
    expect(reussiteParSpecialite(unites).get('X')).toEqual({ score: 2, scoreMax: 2 })
    expect(reussiteParFormat(unites).get('QRU')).toEqual({ score: 2, scoreMax: 2 })
  })
})

describe('noteAAEstimee (§4.2, seuil 14/20)', () => {
  it('null si aucune unité double-A', () => {
    const unites = [{ score: 1, scoreMax: 1, format: 'QRM', rang: 'B', specialites: [], items: [] }]
    expect(noteAAEstimee(unites)).toBeNull()
  })

  it('ne compte que les unités rang A + format A', () => {
    const unites = [
      { score: 1, scoreMax: 1, format: 'QRU', rang: 'A', specialites: [], items: [] }, // double-A : compte
      { score: 0, scoreMax: 1, format: 'QRM', rang: 'B', specialites: [], items: [] }, // pas double-A : ignoré
      { score: 0, scoreMax: 1, format: 'QRU', rang: 'B', specialites: [], items: [] }, // format A mais rang B : ignoré
    ]
    expect(noteAAEstimee(unites)).toBe(20) // 1/1 double-A -> 20/20
  })

  it('ramène le score sur 20', () => {
    const unites = [
      { score: 7, scoreMax: 10, format: 'QROC', rang: 'A', specialites: [], items: [] },
    ]
    expect(noteAAEstimee(unites)).toBe(14)
  })

  it('le seuil de validation officiel est 14/20', () => {
    expect(SEUIL_VALIDATION_AA).toBe(14)
  })

  it('une unité double-A issue d\'un dossier LCA compte double', () => {
    const unites = [
      { score: 0, scoreMax: 1, format: 'QRU', rang: 'A', specialites: [], items: [], estLCA: false },
      { score: 1, scoreMax: 1, format: 'QROC', rang: 'A', specialites: [], items: [], estLCA: false },
      { score: 1, scoreMax: 1, format: 'QRU', rang: 'A', specialites: [], items: [], estLCA: true },
    ]
    // score = 0 + 1 + 1*2 = 3, scoreMax = 1 + 1 + 1*2 = 4 -> 3/4 * 20 = 15
    expect(noteAAEstimee(unites)).toBe(15)
  })
})

describe('reussiteEcosParDomaine', () => {
  it('regroupe par domaine de la station liée', () => {
    const stationsParId = {
      s1: { domaine: 'Annonce' },
      s2: { domaine: 'Examen clinique' },
    }
    const tentatives = [
      { station_id: 's1', score: 5, score_max: 8 },
      { station_id: 's1', score: 6, score_max: 8 },
      { station_id: 's2', score: 3, score_max: 8 },
    ]
    const g = reussiteEcosParDomaine(tentatives, stationsParId)
    expect(g.get('Annonce')).toEqual({ score: 11, scoreMax: 16 })
    expect(g.get('Examen clinique')).toEqual({ score: 3, scoreMax: 8 })
  })

  it('ignore une tentative dont la station a disparu', () => {
    const g = reussiteEcosParDomaine([{ station_id: 'inconnue', score: 1, score_max: 1 }], {})
    expect(g.size).toBe(0)
  })
})

describe('reussiteParHeure', () => {
  it("regroupe par heure locale de date_tentative", () => {
    const t = [
      { dateTentative: '2026-01-01T08:30:00', score: 1, scoreMax: 1 },
      { dateTentative: '2026-01-02T08:15:00', score: 0, scoreMax: 1 },
    ]
    const g = reussiteParHeure(t)
    expect(g.get(8)).toEqual({ score: 1, scoreMax: 2 })
  })
})

describe('reussiteParDureeSession', () => {
  it('regroupe par tranche de minutes depuis le début de la session reconstruite', () => {
    const base = new Date('2026-01-01T10:00:00Z').getTime()
    const t = [
      { dateTentative: new Date(base).toISOString(), score: 1, scoreMax: 1 }, // t+0 -> 0-15
      { dateTentative: new Date(base + 20 * 60000).toISOString(), score: 1, scoreMax: 1 }, // t+20 -> 15-30 (même session, écart 20 < 30)
      { dateTentative: new Date(base + 40 * 60000).toISOString(), score: 0, scoreMax: 1 }, // t+40 -> 30-60 (même session, écart 20 < 30)
    ]
    const g = reussiteParDureeSession(t)
    expect(g.get('0-15')).toEqual({ score: 1, scoreMax: 1 })
    expect(g.get('15-30')).toEqual({ score: 1, scoreMax: 1 })
    expect(g.get('30-60')).toEqual({ score: 0, scoreMax: 1 })
  })

  it('une pause de plus de 30 min redémarre une nouvelle session (retombe à la tranche 0-15)', () => {
    const base = new Date('2026-01-01T10:00:00Z').getTime()
    const t = [
      { dateTentative: new Date(base).toISOString(), score: 1, scoreMax: 1 },
      { dateTentative: new Date(base + 200 * 60000).toISOString(), score: 1, scoreMax: 1 }, // pause > 30 min
    ]
    const g = reussiteParDureeSession(t)
    // Les deux tentatives tombent dans "0-15" car chacune démarre sa propre session.
    expect(g.get('0-15')).toEqual({ score: 2, scoreMax: 2 })
    expect(g.has('60+')).toBe(false)
  })
})

describe('messageFatigue', () => {
  it('null si moins de deux heures avec un échantillon suffisant', () => {
    const m = new Map([[8, { score: 5, scoreMax: 5 }]])
    expect(messageFatigue(m)).toBeNull()
  })

  it("null si l'écart entre la meilleure et la pire heure est faible", () => {
    const m = new Map([
      [8, { score: 5, scoreMax: 5 }],
      [20, { score: 4, scoreMax: 5 }],
    ])
    expect(messageFatigue(m)).toBeNull()
  })

  it("un message factuel apparaît si l'écart dépasse 20 points", () => {
    const m = new Map([
      [8, { score: 5, scoreMax: 5 }],
      [23, { score: 1, scoreMax: 5 }],
    ])
    const msg = messageFatigue(m)
    expect(msg).toContain('8h')
    expect(msg).toContain('23h')
    expect(msg).toContain('100%')
    expect(msg).toContain('20%')
  })

  it("ignore une heure dont l'échantillon est trop faible", () => {
    const m = new Map([
      [8, { score: 1, scoreMax: 1 }], // échantillon 1 < 3, ignoré
      [20, { score: 0, scoreMax: 5 }],
    ])
    expect(messageFatigue(m)).toBeNull()
  })
})

describe('estObsolete', () => {
  it('une date_reference plus ancienne que le seuil est obsolète', () => {
    expect(estObsolete('2018-01-01', 2022)).toBe(true)
  })

  it('une date_reference égale ou plus récente ne l\'est pas', () => {
    expect(estObsolete('2022-01-01', 2022)).toBe(false)
    expect(estObsolete('2024-01-01', 2022)).toBe(false)
  })

  it('null/absent = jamais obsolète (référence inconnue)', () => {
    expect(estObsolete(null, 2022)).toBe(false)
    expect(estObsolete(undefined, 2022)).toBe(false)
  })
})
