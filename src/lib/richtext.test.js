import { describe, it, expect } from 'vitest'
import { richText } from './richtext.js'

describe('richText', () => {
  it('**gras**', () => {
    expect(richText('un mot **important** ici')).toBe('un mot <strong>important</strong> ici')
  })

  it('==surligné==', () => {
    expect(richText('==à retenir==')).toBe('<mark class="rt-highlight">à retenir</mark>')
  })

  it('!!important!!', () => {
    expect(richText('!!attention!!')).toBe('<span class="rt-important">attention</span>')
  })

  it('échappe le HTML brut avant transformation', () => {
    expect(richText('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it("[[img:...]] avec un guillemet dans l'URL : l'attribut ne peut pas être fermé prématurément", () => {
    const out = richText('[[img:x.jpg" onerror="alert(1)]]')
    expect(out).not.toContain('onerror="alert(1)"')
    expect(out).toContain('data-img-url="x.jpg&quot; onerror=&quot;alert(1)"')
    expect(out).toContain('src="x.jpg&quot; onerror=&quot;alert(1)"')
  })

  it("[[img:...]] avec une apostrophe dans l'URL reste dans l'attribut", () => {
    const out = richText("[[img:x'y.jpg]]")
    expect(out).toContain('data-img-url="x&#39;y.jpg"')
  })
})
