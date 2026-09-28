import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { r2cItemSchema, r2cSddSchema, ednQuestionSchema, ednDossierSchema, ecosStationSchema, constanteBioSchema } from './import-schemas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = join(__dirname, '..', 'data', 'prompts', 'externat')

// Même principe que edn-import-schemas.test.js / import-schemas.test.js : extrait les blocs JSON
// ```...``` des prompts .md et les valide avec les schémas zod correspondants, pour que prompts et
// schémas ne puissent jamais diverger silencieusement (§6 : "un test vitest vérifie que l'exemple
// de chaque prompt passe le schéma zod correspondant").
function extraireBlocsJson(nomFichier) {
  const contenu = readFileSync(join(PROMPTS_DIR, nomFichier), 'utf8')
  const blocs = [...contenu.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]))
  return blocs.flat()
}

describe('synchro prompts Externat <-> schémas', () => {
  it('prompt-r2c-items.md correspond à r2cItemSchema', () => {
    const items = extraireBlocsJson('prompt-r2c-items.md')
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item) => {
      const r = r2cItemSchema(true).safeParse(item)
      expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
    })
  })

  it('prompt-r2c-sdd.md correspond à r2cSddSchema', () => {
    const items = extraireBlocsJson('prompt-r2c-sdd.md')
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item) => {
      const r = r2cSddSchema(true).safeParse(item)
      expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
    })
  })

  it('prompt-edn-qi.md : chaque exemple correspond à ednQuestionSchema (un par format)', () => {
    const items = extraireBlocsJson('prompt-edn-qi.md')
    expect(items.length).toBe(5)
    items.forEach((item) => {
      const r = ednQuestionSchema(true).safeParse(item)
      expect(r.success, `${item.format} : ${JSON.stringify(r.success ? null : r.error.issues)}`).toBe(true)
    })
  })

  it('prompt-edn-zap.md correspond à ednQuestionSchema', () => {
    const [item] = extraireBlocsJson('prompt-edn-zap.md')
    const r = ednQuestionSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-edn-dp.md correspond à ednDossierSchema', () => {
    const [item] = extraireBlocsJson('prompt-edn-dp.md')
    const r = ednDossierSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-edn-kfp.md correspond à ednDossierSchema', () => {
    const [item] = extraireBlocsJson('prompt-edn-kfp.md')
    const r = ednDossierSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-edn-tcs.md correspond à ednDossierSchema (questions au format TCS)', () => {
    const [item] = extraireBlocsJson('prompt-edn-tcs.md')
    const r = ednDossierSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-edn-lca.md correspond à ednDossierSchema (avec article_url)', () => {
    const [item] = extraireBlocsJson('prompt-edn-lca.md')
    const r = ednDossierSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-ecos-station.md correspond à ecosStationSchema', () => {
    const [item] = extraireBlocsJson('prompt-ecos-station.md')
    const r = ecosStationSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-constantes-bio.md : chaque exemple correspond à constanteBioSchema', () => {
    const items = extraireBlocsJson('prompt-constantes-bio.md')
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item) => {
      const r = constanteBioSchema(true).safeParse(item)
      expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
    })
  })
})
