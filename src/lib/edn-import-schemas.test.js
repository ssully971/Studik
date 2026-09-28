import { describe, it, expect } from 'vitest'
import {
  r2cItemSchema,
  r2cSddSchema,
  ednQuestionSchema,
  ednDossierSchema,
  ecosStationSchema,
  constanteBioSchema,
  validerImport,
  idFieldPourCible,
} from './import-schemas.js'

describe('r2cItemSchema', () => {
  it('accepte un item valide (nouveau)', () => {
    const r = r2cItemSchema(true).safeParse({ numero: 12, intitule: 'Un item', specialites: ['Cardiologie'] })
    expect(r.success).toBe(true)
  })

  it('rejette un intitulé manquant sur un nouvel item', () => {
    const r = r2cItemSchema(true).safeParse({ numero: 12 })
    expect(r.success).toBe(false)
  })

  it('mise à jour partielle : seul numero + prioritaire', () => {
    const r = r2cItemSchema(false).safeParse({ numero: 12, prioritaire: true })
    expect(r.success).toBe(true)
  })
})

describe('r2cSddSchema', () => {
  it('accepte une SDD valide, famille nulle', () => {
    const r = r2cSddSchema(true).safeParse({ numero: 3, intitule: 'Une SDD', famille: null })
    expect(r.success).toBe(true)
  })
})

function questionValide(format, contenu, extra = {}) {
  return {
    id: `q-${format.toLowerCase()}`,
    format,
    rang: 'A',
    items: [1],
    sdd: [1],
    specialites: ['Cardiologie'],
    enonce: 'Énoncé de la question.',
    contenu,
    source: 'genere',
    tags: [],
    ...extra,
  }
}

describe('ednQuestionSchema — QRU', () => {
  const propositions = [
    { id: 'a', texte: 'A', statut: 'indispensable' },
    { id: 'b', texte: 'B', statut: 'faux' },
    { id: 'c', texte: 'C', statut: 'faux' },
    { id: 'd', texte: 'D', statut: 'faux' },
  ]

  it('accepte exactement 1 proposition vraie/indispensable', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QRU', { propositions }))
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette 2 propositions vraies pour un QRU', () => {
    const props2 = propositions.map((p, i) => (i === 1 ? { ...p, statut: 'vrai' } : p))
    const r = ednQuestionSchema(true).safeParse(questionValide('QRU', { propositions: props2 }))
    expect(r.success).toBe(false)
  })

  it('rejette moins de 4 propositions', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QRU', { propositions: propositions.slice(0, 3) }))
    expect(r.success).toBe(false)
  })
})

describe('ednQuestionSchema — QRM', () => {
  it('accepte au moins 1 proposition vraie', () => {
    const propositions = [
      { id: '1', texte: 'e', statut: 'indispensable' },
      { id: '2', texte: 'z', statut: 'inacceptable' },
      { id: '3', texte: 'y', statut: 'vrai' },
      { id: '4', texte: 'l', statut: 'faux' },
    ]
    const r = ednQuestionSchema(true).safeParse(questionValide('QRM', { propositions }))
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette 0 proposition vraie/indispensable', () => {
    const propositions = [
      { id: '1', texte: 'a', statut: 'faux' },
      { id: '2', texte: 'b', statut: 'faux' },
      { id: '3', texte: 'c', statut: 'inacceptable' },
      { id: '4', texte: 'd', statut: 'faux' },
    ]
    const r = ednQuestionSchema(true).safeParse(questionValide('QRM', { propositions }))
    expect(r.success).toBe(false)
  })
})

describe('ednQuestionSchema — QRP', () => {
  // Exemple officiel §5.4 : n=3, 1=indispensable, 2=inacceptable, 3=vrai, 4=faux, 5=vrai
  const propositions = [
    { id: '1', texte: 'p1', statut: 'indispensable' },
    { id: '2', texte: 'p2', statut: 'inacceptable' },
    { id: '3', texte: 'p3', statut: 'vrai' },
    { id: '4', texte: 'p4', statut: 'faux' },
    { id: '5', texte: 'p5', statut: 'vrai' },
  ]

  it('accepte n cohérent avec le nombre de propositions vraies/indispensables', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QRP', { propositions, n: 3 }))
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette un n incohérent', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QRP', { propositions, n: 2 }))
    expect(r.success).toBe(false)
  })
})

describe('ednQuestionSchema — QRP_LONG', () => {
  function propositions(n) {
    return Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, texte: `Prop ${i}`, statut: i < n ? 'vrai' : 'faux' }))
  }

  it('accepte 10 à 25 propositions, sans indispensable/inacceptable', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QRP_LONG', { propositions: propositions(2), n: 2 }))
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette un statut indispensable (interdit pour ce format)', () => {
    const props = propositions(2)
    props[0].statut = 'indispensable'
    const r = ednQuestionSchema(true).safeParse(questionValide('QRP_LONG', { propositions: props, n: 2 }))
    expect(r.success).toBe(false)
  })

  it('rejette moins de 10 propositions', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QRP_LONG', { propositions: propositions(2).slice(0, 5), n: 2 }))
    expect(r.success).toBe(false)
  })
})

describe('ednQuestionSchema — ZAP', () => {
  it('accepte zones vides à l’import (remplies ensuite dans l’éditeur, §5.6)', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('ZAP', { zones: [], x: 2 }))
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette x hors de 1 à 5', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('ZAP', { zones: [], x: 6 }))
    expect(r.success).toBe(false)
  })

  it('rejette une forme de zone inconnue', () => {
    const r = ednQuestionSchema(true).safeParse(
      questionValide('ZAP', { zones: [{ id: 'z1', forme: 'triangle', cx: 10, cy: 10 }], x: 1 })
    )
    expect(r.success).toBe(false)
  })
})

describe('ednQuestionSchema — QROC', () => {
  it('accepte exactes + acceptables', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QROC', { exactes: ['Réponse'], acceptables: ['Réponse acceptable'] }))
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette exactes vide', () => {
    const r = ednQuestionSchema(true).safeParse(questionValide('QROC', { exactes: [] }))
    expect(r.success).toBe(false)
  })
})

describe('ednQuestionSchema — TCS', () => {
  it('accepte les 5 clés de vote avec au moins un vote non nul', () => {
    const r = ednQuestionSchema(true).safeParse(
      questionValide('TCS', {
        hypothese: 'Vous pensez à X',
        information: 'Vous trouvez Y',
        votes: { '-2': 0, '-1': 9, '0': 7, '1': 3, '2': 0 },
        panel: 'simule',
      })
    )
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette une clé de vote manquante', () => {
    const r = ednQuestionSchema(true).safeParse(
      questionValide('TCS', { hypothese: 'X', information: 'Y', votes: { '-2': 0, '-1': 9, '0': 7, '1': 3 }, panel: 'simule' })
    )
    expect(r.success).toBe(false)
  })

  it('rejette des votes tous nuls', () => {
    const r = ednQuestionSchema(true).safeParse(
      questionValide('TCS', { hypothese: 'X', information: 'Y', votes: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 }, panel: 'simule' })
    )
    expect(r.success).toBe(false)
  })
})

describe('ednDossierSchema', () => {
  function dossierValide(extra = {}) {
    return {
      id: 'dp-test',
      type: 'DP',
      titre: 'Un dossier',
      sdd: [1],
      items: [1],
      specialites: ['Cardiologie'],
      vignette: 'Un patient se présente...',
      source: 'genere',
      tags: [],
      questions: [
        questionValide('QROC', { exactes: ['Réponse 1'] }, { id: 'q1', ordre: 0 }),
        questionValide('QRU', { propositions: [
          { id: 'a', texte: 'A', statut: 'vrai' },
          { id: 'b', texte: 'B', statut: 'faux' },
          { id: 'c', texte: 'C', statut: 'faux' },
          { id: 'd', texte: 'D', statut: 'faux' },
        ] }, { id: 'q2', ordre: 1 }),
      ],
      ...extra,
    }
  }

  it('accepte un dossier avec questions imbriquées à ordre unique', () => {
    const r = ednDossierSchema(true).safeParse(dossierValide())
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('rejette des ordres en doublon', () => {
    const item = dossierValide()
    item.questions[1].ordre = 0
    const r = ednDossierSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette un type de dossier inconnu', () => {
    const item = dossierValide({ type: 'INCONNU' })
    const r = ednDossierSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })
})

describe('ecosStationSchema', () => {
  it('accepte une station valide', () => {
    const r = ecosStationSchema(true).safeParse({
      id: 'station-1',
      titre: 'Douleur thoracique',
      domaine: 'stratégie diagnostique',
      interlocuteur: 'PS',
      grille: { items: [{ id: 'g1', critere: 'Critère', points: 1 }], global: true },
      source: 'genere',
    })
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })
})

describe('constanteBioSchema', () => {
  it('accepte une constante valide', () => {
    const r = constanteBioSchema(true).safeParse({ id: 'na', categorie: 'Ionogramme', parametre: 'Natrémie', valeur_normale: '135-145', unite: 'mmol/L', ordre: 1 })
    expect(r.success).toBe(true)
  })
})

describe('validerImport — cibles externat, clé "numero" pour les référentiels R2C', () => {
  it('idFieldPourCible("r2c_items") === "numero"', () => {
    expect(idFieldPourCible('r2c_items')).toBe('numero')
    expect(idFieldPourCible('edn_dossiers')).toBe('id')
  })

  it('un item R2C déjà existant (par numero) est traité comme une mise à jour partielle', () => {
    const erreurs = validerImport('r2c_items', [{ numero: 5, prioritaire: true }], new Set([5]))
    expect(erreurs).toEqual([])
  })

  it('un item R2C nouveau sans intitulé est rejeté', () => {
    const erreurs = validerImport('r2c_items', [{ numero: 5 }], new Set())
    expect(erreurs.length).toBeGreaterThan(0)
  })
})
