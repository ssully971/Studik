import { describe, it, expect } from 'vitest'
import { FORMATS_RANG_A, FORMATS_RANG_B, rangFormat, estDoubleA } from './edn-format.js'

describe('rangFormat', () => {
  it.each(FORMATS_RANG_A)('%s est de rang A', (format) => {
    expect(rangFormat(format)).toBe('A')
  })

  it.each(FORMATS_RANG_B)('%s est de rang B', (format) => {
    expect(rangFormat(format)).toBe('B')
  })

  it('format inconnu renvoie null', () => {
    expect(rangFormat('INCONNU')).toBeNull()
  })
})

describe('estDoubleA', () => {
  it('rang A + format A = double A', () => {
    expect(estDoubleA({ rang: 'A', format: 'QRU' })).toBe(true)
  })

  it('rang B + format A = pas double A', () => {
    expect(estDoubleA({ rang: 'B', format: 'QRU' })).toBe(false)
  })

  it('rang A + format B (QRM) = pas double A', () => {
    expect(estDoubleA({ rang: 'A', format: 'QRM' })).toBe(false)
  })
})
