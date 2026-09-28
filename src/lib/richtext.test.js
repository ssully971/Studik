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

describe('richText — listes (§5.11)', () => {
  it('une ligne "- item" devient un <li>', () => {
    const out = richText('- Premier\n- Deuxième')
    expect(out).toBe('<ul class="rt-list"><li>Premier</li><li>Deuxième</li></ul>')
  })

  it('accepte aussi "* item"', () => {
    const out = richText('* A\n* B')
    expect(out).toContain('<li>A</li><li>B</li>')
  })

  it('la mise en forme inline fonctionne dans un item de liste', () => {
    const out = richText('- **gras** dans une liste')
    expect(out).toBe('<ul class="rt-list"><li><strong>gras</strong> dans une liste</li></ul>')
  })
})

describe('richText — tableaux (§5.11)', () => {
  it('un tableau markdown à barres verticales devient une <table>', () => {
    const out = richText('Paramètre | Valeur\n---|---\nNa+ | 138')
    expect(out).toContain('<table class="rt-table">')
    expect(out).toContain('<th>Paramètre</th><th>Valeur</th>')
    expect(out).toContain('<td>Na+</td><td>138</td>')
  })

  it('une colonne "normes" est masquée par défaut avec un bouton pour la révéler', () => {
    const out = richText('Paramètre | Valeur | Unité | Normes\n---|---|---|---\nNatrémie | 138 | mmol/L | 135-145')
    expect(out).toContain('normes-toggle-btn')
    expect(out).toContain('class="rt-table normes-masquees"')
  })

  it('une colonne dont le dernier intitulé n\'est pas "normes" reste toujours visible', () => {
    const out = richText('Paramètre | Valeur\n---|---\nNa+ | 138')
    expect(out).not.toContain('normes-toggle-btn')
    expect(out).not.toContain('normes-masquees')
  })

  it('échappe le HTML dans les cellules', () => {
    const out = richText('A | B\n---|---\n<script> | 1')
    expect(out).toContain('&lt;script&gt;')
  })
})

describe('richText — compatibilité : une ligne simple sans bloc reste inchangée', () => {
  it('un texte multi-ligne sans liste ni tableau garde ses sauts de ligne', () => {
    const out = richText('Ligne 1\nLigne 2')
    expect(out).toBe('Ligne 1\nLigne 2')
  })
})
