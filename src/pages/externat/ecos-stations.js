import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'

// ECOS (§5.9, §8 lot 5) — hors périmètre de la phase 1. Routée et dégradée proprement dès le
// lot 1 pour ne jamais refondre la navigation ensuite.
export async function renderEcosStations(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('ecos_stations').select('id').limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">ECOS</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">ECOS</h2>
      </div>
      <p class="empty-note">Stations, chronomètre et grilles arrivent en phase 2 (lot 5).</p>
    </div>
  `
}
