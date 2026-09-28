import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'

// Joueur de question isolée (§5, §8 lot 3).
export async function renderEdnQuestion(container, id) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('edn_questions').select('id').eq('id', id).limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Question</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Question</h2>
      </div>
      <p class="empty-note">Le joueur de questions (7 formats) arrive au lot 3.</p>
    </div>
  `
}
