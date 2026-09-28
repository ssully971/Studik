import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'

// Référentiels R2C (items + SDD) — géré au lot 2 (liste, recherche, bascule du flag prioritaire).
export async function renderEdnItems(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('r2c_items').select('numero').limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Items R2C</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Items R2C</h2>
      </div>
      <p class="empty-note">La liste des items et SDD (recherche, flag prioritaire) arrive au lot 2.</p>
    </div>
  `
}
