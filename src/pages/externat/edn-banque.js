import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'

// Banque de questions/dossiers (§7.3) — construite au lot 4.
export async function renderEdnBanque(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('edn_questions').select('id').limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Banque</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Banque</h2>
      </div>
      <p class="empty-note">La banque (liste filtrable des questions et dossiers) arrive au lot 4.</p>
    </div>
  `
}
