import { getFiches } from '../lib/fiches.js'
import { getStatsTentatives, deleteTentative, deleteTentativesByMatiere, deleteAllTentatives } from '../lib/cas.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

function bar(value, max, color) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return `<div class="stat-bar"><div class="stat-bar-fill" style="width: ${pct}%; background: ${color};"></div></div>`
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export async function renderStats(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let fiches, tentatives
  try {
    ;[fiches, tentatives] = await Promise.all([getFiches({}), getStatsTentatives()])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  renderAll(fiches, tentatives)

  function renderAll(fiches, tentatives) {
    const totalFiches = fiches.length
    const validees = fiches.filter((f) => f.statut === 'valide').length
    const aRevoir = fiches.filter((f) => f.statut === 'a_revoir').length
    const brouillons = fiches.filter((f) => f.statut === 'brouillon').length

    const parMatiere = {}
    fiches.forEach((f) => {
      if (!parMatiere[f.matiere]) parMatiere[f.matiere] = { total: 0, validees: 0, type: f.type }
      parMatiere[f.matiere].total += 1
      if (f.statut === 'valide') parMatiere[f.matiere].validees += 1
    })

    const totalTentatives = tentatives.length
    const reussies = tentatives.filter((t) => t.reussi).length
    const tauxReussite = totalTentatives > 0 ? Math.round((reussies / totalTentatives) * 100) : 0

    const tentativesParMatiere = {}
    tentatives.forEach((t) => {
      const m = t.cas_cliniques?.matiere
      if (!m) return
      if (!tentativesParMatiere[m]) tentativesParMatiere[m] = { total: 0, reussies: 0, type: t.cas_cliniques.type }
      tentativesParMatiere[m].total += 1
      if (t.reussi) tentativesParMatiere[m].reussies += 1
    })

    const septJours = new Date()
    septJours.setDate(septJours.getDate() - 7)
    const activiteRecente = tentatives.filter((t) => new Date(t.date_tentative) >= septJours).length

    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">Statistiques</h2>
          ${totalTentatives > 0 ? `<button id="reset-all-btn" class="btn" style="width: auto; color: #C46A5C;">Tout réinitialiser</button>` : ''}
        </div>

        <div class="now-grid now-grid-3" style="margin-bottom: 40px;">
          <div class="now-cell">
            <div class="label">fiches</div>
            <div class="value voice">${totalFiches} au total</div>
            <div class="desc">${validees} validées · ${aRevoir} à revoir · ${brouillons} en brouillon</div>
          </div>
          <div class="now-cell">
            <div class="label">cas d'entraînement</div>
            <div class="value voice">${tauxReussite}% de réussite</div>
            <div class="desc">${reussies} sur ${totalTentatives} tentative${totalTentatives !== 1 ? 's' : ''}</div>
          </div>
          <div class="now-cell">
            <div class="label">7 derniers jours</div>
            <div class="value voice">${activiteRecente} cas traité${activiteRecente !== 1 ? 's' : ''}</div>
            <div class="desc">Toutes matières confondues.</div>
          </div>
        </div>

        <div class="section-head">
          <h2 class="voice">Fiches par matière</h2>
        </div>
        <div id="fiches-stats-list" class="fiches-list" style="margin-bottom: 40px;"></div>

        <div class="section-head">
          <h2 class="voice">Réussite par matière (entraînement)</h2>
        </div>
        <div id="tentatives-stats-list" class="fiches-list" style="margin-bottom: 40px;"></div>

        <div class="section-head">
          <h2 class="voice">Historique des tentatives</h2>
          <span class="count">${totalTentatives} au total</span>
        </div>
        <div id="historique-list" class="fiches-list"></div>
      </div>
    `

    const fichesListEl = document.getElementById('fiches-stats-list')
    const matiereNoms = Object.keys(parMatiere)

    if (matiereNoms.length === 0) {
      fichesListEl.innerHTML = `<p class="empty-note">Aucune fiche pour l'instant.</p>`
    } else {
      fichesListEl.innerHTML = matiereNoms
        .map((nom) => {
          const m = parMatiere[nom]
          const color = { clinique: 'var(--clinique)', mecanisme: 'var(--mecanisme)', structure: 'var(--structure)' }[m.type]
          return `
          <div class="fiche-row type-${m.type}" style="grid-template-columns: 4px 1fr;">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${nom}</span>
                <span class="type-label">${TYPE_LABELS[m.type]}</span>
              </div>
              <div class="fiche-meta">${m.validees} / ${m.total} validées</div>
              ${bar(m.validees, m.total, color)}
            </div>
          </div>
        `
        })
        .join('')
    }

    const tentativesListEl = document.getElementById('tentatives-stats-list')
    const tentativesMatiereNoms = Object.keys(tentativesParMatiere)

    if (tentativesMatiereNoms.length === 0) {
      tentativesListEl.innerHTML = `<p class="empty-note">Aucun cas traité pour l'instant.</p>`
    } else {
      tentativesListEl.innerHTML = tentativesMatiereNoms
        .map((nom) => {
          const t = tentativesParMatiere[nom]
          const color = { clinique: 'var(--clinique)', mecanisme: 'var(--mecanisme)', structure: 'var(--structure)' }[t.type]
          const taux = Math.round((t.reussies / t.total) * 100)
          return `
          <div class="fiche-row type-${t.type}">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${nom}</span>
                <span class="type-label">${taux}%</span>
              </div>
              <div class="fiche-meta">${t.reussies} / ${t.total} tentatives réussies</div>
              ${bar(t.reussies, t.total, color)}
            </div>
            <div class="fiche-actions">
              <button class="btn" data-reset-matiere="${nom}" style="width: auto;">Réinitialiser</button>
            </div>
          </div>
        `
        })
        .join('')
    }

    const historiqueEl = document.getElementById('historique-list')
    if (tentatives.length === 0) {
      historiqueEl.innerHTML = `<p class="empty-note">Aucune tentative enregistrée.</p>`
    } else {
      historiqueEl.innerHTML = tentatives
        .map((t) => {
          const cas = t.cas_cliniques
          if (!cas) return ''
          return `
          <div class="fiche-row type-${cas.type}">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${cas.question}</span>
                <span class="type-label">${t.reussi ? 'réussi' : 'raté'}</span>
              </div>
              <div class="fiche-meta">${cas.matiere} · ${formatDate(t.date_tentative)}</div>
            </div>
            <div class="fiche-actions">
              <button class="btn" data-delete-tentative="${t.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
            </div>
          </div>
        `
        })
        .join('')
    }

    const resetAllBtn = document.getElementById('reset-all-btn')
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', async () => {
        if (!window.confirm('Supprimer toutes les tentatives enregistrées ? Cette action est définitive.')) return
        try {
          await deleteAllTentatives()
          renderAll(fiches, [])
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    }

    document.querySelectorAll('[data-reset-matiere]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nom = btn.dataset.resetMatiere
        if (!window.confirm(`Supprimer toutes les tentatives de "${nom}" ? Cette action est définitive.`)) return
        try {
          await deleteTentativesByMatiere(nom)
          const restantes = tentatives.filter((t) => t.cas_cliniques?.matiere !== nom)
          renderAll(fiches, restantes)
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    document.querySelectorAll('[data-delete-tentative]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteTentative
        if (!window.confirm('Supprimer cette tentative ?')) return
        try {
          await deleteTentative(id)
          const restantes = tentatives.filter((t) => t.id !== id)
          renderAll(fiches, restantes)
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }
}
