import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fausse base en mémoire : assez fidèle à Supabase pour exercer les vrais lib/*.js (upsertPartiel
// compris) sans jamais toucher au réseau. `__setDb`/`__getDb` permettent de faire un export puis
// une restauration vers deux bases distinctes dans le même test (un vrai aller-retour).
vi.mock('./supabase.js', () => {
  let db = {}

  function appliquerFiltres(table, filtres) {
    let lignes = [...(db[table] || [])]
    filtres.forEach((f) => {
      lignes = lignes.filter(f)
    })
    return lignes
  }

  function chain(table) {
    const filtres = []
    const q = {
      select() {
        return q
      },
      eq(col, val) {
        filtres.push((r) => r[col] === val)
        return q
      },
      neq(col, val) {
        filtres.push((r) => r[col] !== val)
        return q
      },
      is(col, val) {
        filtres.push((r) => r[col] === val)
        return q
      },
      in(col, vals) {
        const set = new Set(vals)
        filtres.push((r) => set.has(r[col]))
        return q
      },
      contains() {
        return q
      },
      overlaps() {
        return q
      },
      order() {
        return q
      },
      limit(n) {
        return q.range(0, n - 1)
      },
      async maybeSingle() {
        const lignes = appliquerFiltres(table, filtres)
        return { data: lignes[0] || null, error: null }
      },
      async single() {
        const lignes = appliquerFiltres(table, filtres)
        return lignes[0] ? { data: lignes[0], error: null } : { data: null, error: new Error('introuvable') }
      },
      range(debut, fin) {
        const lignes = appliquerFiltres(table, filtres)
        return Promise.resolve({ data: lignes.slice(debut, fin + 1), error: null })
      },
      upsert(rows, { onConflict } = {}) {
        if (!db[table]) db[table] = []
        const cle = onConflict || 'id'
        const arr = Array.isArray(rows) ? rows : [rows]
        arr.forEach((row) => {
          const idx = db[table].findIndex((r) => r[cle] === row[cle])
          if (idx === -1) db[table].push({ ...row })
          else db[table][idx] = { ...db[table][idx], ...row }
        })
        return Promise.resolve({ data: null, error: null })
      },
      insert(row) {
        if (!db[table]) db[table] = []
        const arr = Array.isArray(row) ? row : [row]
        const inseres = arr.map((r) => ({ ...r }))
        db[table].push(...inseres)
        return { select: () => Promise.resolve({ data: inseres, error: null }) }
      },
      update(champs) {
        return {
          eq(col, val) {
            const idx = (db[table] || []).findIndex((r) => r[col] === val)
            if (idx !== -1) db[table][idx] = { ...db[table][idx], ...champs }
            return { select: () => Promise.resolve({ data: idx !== -1 ? [db[table][idx]] : [], error: null }) }
          },
        }
      },
    }
    return q
  }

  return {
    supabase: { from: (table) => chain(table) },
    __setDb(nouvelleDb) {
      db = nouvelleDb
    },
    __getDb() {
      return db
    },
  }
})

vi.mock('./offline-queue.js', () => ({
  compterTentativesEnAttente: vi.fn(async () => 0),
}))

const supabaseMock = await import('./supabase.js')
const { compterTentativesEnAttente } = await import('./offline-queue.js')
const {
  exporterSauvegarde,
  preparerRestauration,
  restaurerSauvegarde,
  validerStructure,
  validerReferencesMatieres,
  validerReferencesExternat,
} = await import('./backup.js')

function dbDePart() {
  return {
    matieres: [
      { id: 'cardio', nom: 'Cardio', type: 'clinique', couleur: null, ordre_affichage: 0, annee: 'P2', semestre: null, archive: false, parent_id: null },
      { id: 'cardio-souffle', nom: 'Souffle', type: 'clinique', couleur: null, ordre_affichage: 0, annee: null, semestre: null, archive: false, parent_id: 'cardio' },
    ],
    fiches: [{ id: 'f1', matiere: 'Cardio', type: 'clinique', titre: 'Souffle systolique', statut: 'valide', tags: [] }],
    cas_cliniques: [{ id: 'c1', type: 'clinique', matiere: 'Cardio', niveau: 1, statut: 'valide', question: 'Q', enonce: {}, reponse_attendue: {} }],
    tentatives: [{ id: 't1', cas_id: 'c1', reussi: true, reponse_donnee: {}, a_revoir: false, date_tentative: '2026-01-01T00:00:00Z' }],
    qcm: [{ id: 'q1', titre: 'QCM cardio', matieres: ['Cardio'], questions: [], statut: 'valide' }],
    qcm_tentatives: [{ id: 'qt1', qcm_id: 'q1', mode: 'entrainement', score: 1, score_max: 1, reponses: {}, a_revoir: false, date_tentative: '2026-01-01T00:00:00Z' }],
    captures: [{ id: 'cap1', texte: 'note', traitee: false, date_creation: '2026-01-01T00:00:00Z' }],
    checkins: [{ jour: '2026-01-01' }],
    tags_reference: [{ nom: 'urgence', perimetre: null }],
    r2c_items: [{ numero: 1, intitule: 'Item 1', specialites: [], prioritaire: false, notes: null }],
    r2c_sdd: [{ numero: 1, intitule: 'SDD 1', famille: null }],
    constantes_bio: [{ id: 'natremie', categorie: 'Ionogramme', parametre: 'Natrémie', valeur_normale: '135-145', unite: 'mmol/L', ordre: 0 }],
    edn_dossiers: [{ id: 'd1', type: 'DP', titre: 'Dossier 1', sdd: [], items: [], specialites: [], source: 'genere', tags: [], statut: 'valide' }],
    edn_questions: [
      { id: 'q_d1_1', dossier_id: 'd1', ordre: 0, format: 'QRU', rang: 'A', items: [], sdd: [], specialites: [], enonce: 'E1', contenu: {}, source: 'genere', tags: [], statut: 'valide' },
      { id: 'q_isolee', dossier_id: null, ordre: null, format: 'QROC', rang: 'A', items: [], sdd: [], specialites: [], enonce: 'E2', contenu: {}, source: 'genere', tags: [], statut: 'valide' },
    ],
    edn_tentatives: [{ id: 'et1', cible: 'q:q_isolee', mode: 'entrainement', reponses: {}, score: 1, score_max: 1, tags_erreur: [], date_tentative: '2026-01-01T00:00:00Z' }],
    edn_srs: [{ cible: 'q:q_isolee', etape: 2, prochaine_revision: '2026-02-01', reussites_parfaites_consecutives: 1, derniere_revision: '2026-01-01T00:00:00Z', suspendue: false }],
    ecos_stations: [{ id: 's1', titre: 'Station 1', sdd: [], domaine: 'Annonce', interlocuteur: 'PS', documents: [], grille: {}, source: 'genere', tags: [], statut: 'valide' }],
    ecos_tentatives: [{ id: 'ect1', station_id: 's1', mode: 'solo', cochees: {}, score: 5, score_max: 10, date_tentative: '2026-01-01T00:00:00Z' }],
    preferences: [
      { cle: 'cycle', valeur: 'externat' },
      { cle: 'edn_plafond_revisions', valeur: 50 },
      { cle: 'edn_tags_erreur', valeur: ['Biais de lecture'] },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  compterTentativesEnAttente.mockResolvedValue(0)
})

describe('exporterSauvegarde / restaurerSauvegarde : aller-retour complet', () => {
  it('conserve les ids, les relations dossier→questions et station→tentatives, les tentatives et le SRS', async () => {
    supabaseMock.__setDb(dbDePart())
    const { backup, nombreTentativesEnAttente } = await exporterSauvegarde()

    expect(backup.version).toBe(2)
    expect(nombreTentativesEnAttente).toBe(0)
    expect(backup.externat.edn_dossiers).toHaveLength(1)
    expect(backup.externat.edn_questions).toHaveLength(2)

    // Restauration vers une base neuve, complètement vide.
    supabaseMock.__setDb({})
    const preflight = await preparerRestauration(backup)
    expect(preflight.ok).toBe(true)

    await restaurerSauvegarde(backup)
    const cible = supabaseMock.__getDb()

    expect(cible.fiches.map((f) => f.id)).toEqual(['f1'])
    expect(cible.matieres.map((m) => m.id).sort()).toEqual(['cardio', 'cardio-souffle'])

    // Relation dossier → questions : la question restaurée référence bien un dossier restauré.
    const questionDeDossier = cible.edn_questions.find((q) => q.id === 'q_d1_1')
    expect(questionDeDossier.dossier_id).toBe('d1')
    expect(cible.edn_dossiers.some((d) => d.id === 'd1')).toBe(true)

    // Relation station → tentative ECOS.
    const tentativeEcos = cible.ecos_tentatives.find((t) => t.id === 'ect1')
    expect(tentativeEcos.station_id).toBe('s1')
    expect(cible.ecos_stations.some((s) => s.id === 's1')).toBe(true)

    // Tentatives et SRS restaurés tels quels, sans recalcul.
    expect(cible.edn_tentatives[0]).toMatchObject({ id: 'et1', score: 1, score_max: 1 })
    expect(cible.edn_srs[0]).toMatchObject({ cible: 'q:q_isolee', etape: 2, reussites_parfaites_consecutives: 1 })

    // Préférences Externat restaurées.
    const prefCycle = cible.preferences.find((p) => p.cle === 'cycle')
    expect(prefCycle.valeur).toBe('externat')
    const prefPlafond = cible.preferences.find((p) => p.cle === 'edn_plafond_revisions')
    expect(prefPlafond.valeur).toBe(50)
  })

  it('avertit si des tentatives sont encore hors-ligne au moment de l\'export', async () => {
    supabaseMock.__setDb(dbDePart())
    compterTentativesEnAttente.mockResolvedValue(3)
    const { nombreTentativesEnAttente } = await exporterSauvegarde()
    expect(nombreTentativesEnAttente).toBe(3)
  })

  it('omet la section externat si la migration 001 n\'est pas appliquée (dégradation propre)', async () => {
    const db = dbDePart()
    delete db.edn_dossiers // simule une table absente : select() y échouera
    supabaseMock.__setDb(db)
    // Sans la table, le chain mocké renverrait juste [] (pas une vraie erreur PGRST205) — ce test
    // vérifie donc surtout que l'absence de données externat ne casse pas l'export P2.
    const { backup } = await exporterSauvegarde()
    expect(backup.fiches).toHaveLength(1)
  })
})

describe('restaurerSauvegarde : format historique (sans version)', () => {
  it('restaure les champs P2 malgré l\'absence de version, sans toucher à l\'externat', async () => {
    supabaseMock.__setDb({})
    const ancienneSauvegarde = {
      // Pas de `version` : c'est le point testé.
      matieres: dbDePart().matieres,
      fiches: dbDePart().fiches,
      cas: dbDePart().cas_cliniques,
      qcm: dbDePart().qcm,
      tentatives: dbDePart().tentatives,
      tentativesQcm: dbDePart().qcm_tentatives,
      captures: dbDePart().captures,
      checkins: dbDePart().checkins,
      tags: dbDePart().tags_reference,
    }

    await restaurerSauvegarde(ancienneSauvegarde)
    const cible = supabaseMock.__getDb()

    expect(cible.fiches.map((f) => f.id)).toEqual(['f1'])
    expect(cible.cas_cliniques.map((c) => c.id)).toEqual(['c1'])
    expect(cible.edn_dossiers).toBeUndefined()
  })
})

describe('préflight : structure et références', () => {
  it('validerStructure refuse un champ qui devrait être un tableau', () => {
    expect(validerStructure({ fiches: 'pas un tableau' })).toEqual(['"fiches" doit être un tableau.'])
  })

  it('validerStructure accepte un fichier minimal valide', () => {
    expect(validerStructure({ version: 2, fiches: [] })).toEqual([])
  })

  it('validerReferencesMatieres signale un parent_id introuvable', () => {
    const erreurs = validerReferencesMatieres([{ id: 'a', parent_id: 'inconnu' }])
    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]).toMatch(/parent "inconnu" introuvable/)
  })

  it('validerReferencesMatieres accepte un parent résolu en base (pas dans le fichier)', () => {
    const erreurs = validerReferencesMatieres([{ id: 'enfant', parent_id: 'deja-en-base' }], ['deja-en-base'])
    expect(erreurs).toEqual([])
  })

  it('validerReferencesExternat signale un dossier_id introuvable', () => {
    const erreurs = validerReferencesExternat({ edn_questions: [{ id: 'q1', dossier_id: 'fantome' }] })
    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]).toMatch(/dossier "fantome", introuvable/)
  })

  it('validerReferencesExternat signale un station_id introuvable', () => {
    const erreurs = validerReferencesExternat({ ecos_tentatives: [{ id: 't1', station_id: 'fantome' }] })
    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]).toMatch(/station "fantome", introuvable/)
  })

  it('preparerRestauration bloque avant toute écriture si une référence est irrésoluble', async () => {
    supabaseMock.__setDb({ edn_dossiers: [], ecos_stations: [] })
    const data = { version: 2, externat: { edn_questions: [{ id: 'q1', dossier_id: 'fantome' }] } }
    const preflight = await preparerRestauration(data)
    expect(preflight.ok).toBe(false)
    expect(preflight.erreurs[0]).toMatch(/dossier "fantome"/)
    // Rien n'a été écrit.
    expect(supabaseMock.__getDb().edn_questions).toBeUndefined()
  })
})

describe('restaurerSauvegarde : erreur nommée et relançable', () => {
  it('nomme la table en échec quand une étape échoue', async () => {
    supabaseMock.__setDb({})
    const original = supabaseMock.supabase.from
    supabaseMock.supabase.from = (table) => {
      if (table === 'ecos_stations') {
        return { upsert: () => Promise.resolve({ data: null, error: new Error('contrainte violée') }) }
      }
      return original(table)
    }

    const data = { version: 2, externat: { ecos_stations: [{ id: 's1', titre: 'Station' }] } }
    await expect(restaurerSauvegarde(data)).rejects.toThrow(/externat\.ecos_stations/)
    await expect(restaurerSauvegarde(data)).rejects.toThrow(/relance/)

    supabaseMock.supabase.from = original
  })
})
