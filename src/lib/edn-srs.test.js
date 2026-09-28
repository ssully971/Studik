import { describe, it, expect } from 'vitest'
import { prochainEtatSrs, selectionnerCiblesDues, estDue, PALIERS_JOURS, rejouerHistoriqueSrs } from './edn-srs.js'

const MAINTENANT = new Date('2026-01-01T00:00:00Z')

function joursApres(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

describe('prochainEtatSrs — première rencontre', () => {
  it('un premier succès parfait (s=1) entre au premier palier (J+1)', () => {
    const r = prochainEtatSrs({ scoreNormalise: 1, maintenant: MAINTENANT })
    expect(r.etape).toBe(0)
    expect(r.prochaineRevision).toEqual(joursApres(MAINTENANT, PALIERS_JOURS[0]))
  })

  it('un premier échec (s<0,5) entre aussi au premier palier (retour au premier palier)', () => {
    const r = prochainEtatSrs({ scoreNormalise: 0, maintenant: MAINTENANT })
    expect(r.etape).toBe(0)
  })

  it('un premier succès partiel (0,5≤s<1) reste aussi au premier palier', () => {
    const r = prochainEtatSrs({ scoreNormalise: 0.5, maintenant: MAINTENANT })
    expect(r.etape).toBe(0)
  })
})

describe('prochainEtatSrs — progression normale (non prioritaire)', () => {
  it('s=1 avance au palier suivant', () => {
    const r = prochainEtatSrs({ etapeActuelle: 0, scoreNormalise: 1, maintenant: MAINTENANT })
    expect(r.etape).toBe(1)
    expect(r.prochaineRevision).toEqual(joursApres(MAINTENANT, PALIERS_JOURS[1]))
  })

  it('0,5 ≤ s < 1 reste au même palier, relancé à partir d’aujourd’hui', () => {
    const r = prochainEtatSrs({ etapeActuelle: 2, scoreNormalise: 0.5, maintenant: MAINTENANT })
    expect(r.etape).toBe(2)
    expect(r.prochaineRevision).toEqual(joursApres(MAINTENANT, PALIERS_JOURS[2]))
  })

  it('s < 0,5 retombe au premier palier', () => {
    const r = prochainEtatSrs({ etapeActuelle: 4, scoreNormalise: 0.4, maintenant: MAINTENANT })
    expect(r.etape).toBe(0)
  })

  it('ne dépasse jamais le dernier palier (J+120)', () => {
    const dernier = PALIERS_JOURS.length - 1
    const r = prochainEtatSrs({ etapeActuelle: dernier, scoreNormalise: 1, maintenant: MAINTENANT })
    expect(r.etape).toBe(dernier)
  })
})

describe('prochainEtatSrs — item prioritaire : 3 réussites parfaites consécutives requises', () => {
  it('une seule réussite parfaite ne fait pas avancer, revient à J+1', () => {
    const r = prochainEtatSrs({ etapeActuelle: 2, reussitesParfaitesConsecutives: 0, scoreNormalise: 1, prioritaire: true, maintenant: MAINTENANT })
    expect(r.etape).toBe(0)
    expect(r.reussitesParfaitesConsecutives).toBe(1)
  })

  it('une 2e réussite parfaite consécutive : toujours pas d’avancée', () => {
    const r = prochainEtatSrs({ etapeActuelle: 0, reussitesParfaitesConsecutives: 1, scoreNormalise: 1, prioritaire: true, maintenant: MAINTENANT })
    expect(r.etape).toBe(0)
    expect(r.reussitesParfaitesConsecutives).toBe(2)
  })

  it('la 3e réussite parfaite consécutive fait avancer au palier suivant et réinitialise le compteur', () => {
    const r = prochainEtatSrs({ etapeActuelle: 0, reussitesParfaitesConsecutives: 2, scoreNormalise: 1, prioritaire: true, maintenant: MAINTENANT })
    expect(r.etape).toBe(1)
    expect(r.reussitesParfaitesConsecutives).toBe(0)
  })

  it('un score non parfait casse la série de réussites (compteur remis à 0)', () => {
    const r = prochainEtatSrs({ etapeActuelle: 0, reussitesParfaitesConsecutives: 2, scoreNormalise: 0.5, prioritaire: true, maintenant: MAINTENANT })
    expect(r.reussitesParfaitesConsecutives).toBe(0)
    expect(r.etape).toBe(0) // même palier, relancé
  })
})

describe('selectionnerCiblesDues — plafond anti-surcharge', () => {
  const cibles = [
    { cible: 'q:1', prochaineRevision: joursApres(MAINTENANT, -5), prioritaire: false },
    { cible: 'q:2', prochaineRevision: joursApres(MAINTENANT, -1), prioritaire: false },
    { cible: 'q:3', prochaineRevision: joursApres(MAINTENANT, -10), prioritaire: true },
  ]

  it('les items prioritaires passent toujours en premier', () => {
    const r = selectionnerCiblesDues(cibles, 1)
    expect(r).toEqual([cibles[2]])
  })

  it('à égalité de priorité, le retard le plus ancien passe en premier', () => {
    const r = selectionnerCiblesDues(cibles, 3)
    expect(r.map((c) => c.cible)).toEqual(['q:3', 'q:1', 'q:2'])
  })

  it('le reste au-delà du plafond est reporté (pas perdu, juste absent du résultat)', () => {
    const r = selectionnerCiblesDues(cibles, 2)
    expect(r.length).toBe(2)
  })
})

describe('estDue', () => {
  it('une cible sans état SRS n’est jamais due', () => {
    expect(estDue(null)).toBe(false)
  })

  it('une cible suspendue n’est jamais due', () => {
    expect(estDue({ suspendue: true, prochaine_revision: '2020-01-01' })).toBe(false)
  })

  it('une cible dont la date est passée est due', () => {
    expect(estDue({ suspendue: false, prochaine_revision: '2020-01-01' }, MAINTENANT)).toBe(true)
  })

  it('une cible dont la date est dans le futur n’est pas due', () => {
    expect(estDue({ suspendue: false, prochaine_revision: '2030-01-01' }, MAINTENANT)).toBe(false)
  })
})

describe('rejouerHistoriqueSrs (§8 lot 8 : recalcul hors-ligne)', () => {
  it('rejouer un historique donne le même résultat que les appliquer un par un dans le même ordre', () => {
    const t1 = { score: 1, scoreMax: 1, dateTentative: '2026-01-01' }
    const t2 = { score: 1, scoreMax: 1, dateTentative: '2026-01-02' }

    const e1 = prochainEtatSrs({ scoreNormalise: 1, maintenant: new Date(t1.dateTentative) })
    const e2 = prochainEtatSrs({
      etapeActuelle: e1.etape,
      reussitesParfaitesConsecutives: e1.reussitesParfaitesConsecutives,
      scoreNormalise: 1,
      maintenant: new Date(t2.dateTentative),
    })

    const rejoue = rejouerHistoriqueSrs([t1, t2])
    expect(rejoue.etape).toBe(e2.etape)
    expect(rejoue.reussitesParfaitesConsecutives).toBe(e2.reussitesParfaitesConsecutives)
    expect(rejoue.prochaineRevision).toEqual(e2.prochaineRevision)
  })

  it('un historique vide retourne null (aucune tentative à rejouer)', () => {
    expect(rejouerHistoriqueSrs([])).toBeNull()
  })

  it('respecte la règle des 3 réussites parfaites pour un item prioritaire', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03']
    const tentatives = dates.map((d) => ({ score: 1, scoreMax: 1, dateTentative: d }))
    const rejoue = rejouerHistoriqueSrs(tentatives, true)
    // 3 réussites parfaites consécutives -> avance d'un palier (les 2 premières clampent à
    // l'étape 0 sans avancer, la 3e avance depuis cette étape 0), compteur remis à 0.
    expect(rejoue.etape).toBe(1)
    expect(rejoue.reussitesParfaitesConsecutives).toBe(0)
  })

  it('un échec au milieu de l’historique ramène au premier palier avant de reprendre', () => {
    const tentatives = [
      { score: 1, scoreMax: 1, dateTentative: '2026-01-01' },
      { score: 0, scoreMax: 1, dateTentative: '2026-01-02' },
    ]
    const rejoue = rejouerHistoriqueSrs(tentatives)
    expect(rejoue.etape).toBe(0)
  })
})
