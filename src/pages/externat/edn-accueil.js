import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'

// Tableau de bord externat (§7.2) — construit au lot 4 (SRS, série Flash, raccourcis).
// En attendant, dégradation propre si les migrations ne sont pas encore appliquées.
export async function renderEdnAccueil(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('edn_srs').select('cible').limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Mode Externat</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Mode Externat</h2>
      </div>
      <p class="empty-note">Le tableau de bord (révisions dues, série Flash, raccourcis) arrive au lot 4. En attendant : <a href="#edn-items">Items R2C</a> · <a href="#edn-banque">Banque</a> · <a href="#referentiel">Référentiel</a>.</p>
    </div>
  `
}
