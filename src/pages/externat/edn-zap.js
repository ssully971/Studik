import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'

// Éditeur de zones ZAP (§5.6) — seule exception au "pas de saisie de contenu dans l'UI".
// Construit au lot 3.
export async function renderEdnZap(container, id) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('edn_questions').select('id').eq('id', id).limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Éditeur ZAP</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Éditeur ZAP</h2>
      </div>
      <p class="empty-note">L'éditeur de zones (clic sur l'image, rayon, suppression) arrive au lot 3.</p>
    </div>
  `
}
