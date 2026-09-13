import { getFiches } from '../lib/fiches.js'
import { getStatsTentatives, deleteTentative, deleteTentativesByMatiere, deleteAllTentatives } from '../lib/cas.js'
import {
  getAllTentativesQcmStats,
  deleteTentativeQcm,
  deleteTentativesQcmByMatiere,
  deleteAllTentativesQcm,
} from '../lib/qcm.js'
import { getMatieres } from '../lib/matieres.js'

const PAGE_SIZE = 5

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

  let fiches, tentatives, tentativesQcm, matieres
  try {
    ;[fiches, tentatives, tentativesQcm, matieres] = await Promise.all([
      getFiches({}),
      getStatsTentatives(),
      getAllTentativesQcmStats(),
      getMatieres({}),
    ])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  const typeParMatiere = {}
  matieres.forEach((m) => {
    typeParMatiere[m.nom] = m.type
  })

  let limiteHistorique = PAGE_SIZE
  let limiteHistoriqueQcm = PAGE_SIZE

  renderAll(fiches, tentatives, tentativesQcm)

  function renderAll(fiches, tentatives, tentativesQcm) {
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

    // --- QCM ---
    const totalQcmTentatives = tentativesQcm.length
    const scoreTotalQcm = tentativesQcm.reduce((s, t) => s + Number(t.score), 0)
    const scoreMaxTotalQcm = tentativesQcm.reduce((s, t) => s + Number(t.score_max), 0)
    const tauxQcm = scoreMaxTotalQcm > 0 ? Math.round((scoreTotalQcm / scoreMaxTotalQcm) * 100) : 0

    const qcmParMatiere = {}
    tentativesQcm.forEach((t) => {
      const matieresQcm = t.qcm?.matieres || []
      matieresQcm.forEach((m) => {
        if (!qcmParMatiere[m]) qcmParMatiere[m] = { score: 0, scoreMax: 0, type: typeParMatiere[m] }
        qcmParMatiere[m].score += Number(t.score)
        qcmParMatiere[m].scoreMax += Number(t.score_max)
      })
    })

    const totalTentativesToutes = totalTentatives > 0 || totalQcmTentatives > 0

    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">Statistiques</h2>
          ${totalTentativesToutes ? `<button id="reset-all-btn" class="btn" style="width: auto; color: #C46A5C;">Tout réinitialiser</button>` : ''}
        </div>

        <div class="now-grid now-grid-4" style="margin-bottom: 40px;">
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
            <div class="label">QCM</div>
            <div class="value voice">${tauxQcm}% de réussite</div>
            <div class="desc">${totalQcmTentatives} QCM traité${totalQcmTentatives !== 1 ? 's' : ''}</div>
          </div>
          <div class="now-cell">
            <div class="label">7 derniers jours</div>
            <div class="value voice">${activiteRecente} cas traité${activiteRecente !== 1 ? 's' : ''}</div>
            <div class="desc">Cas cliniques uniquement.</div>
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
          <h2 class="voice">Réussite par matière (QCM)</h2>
        </div>
        <div id="qcm-stats-list" class="fiches-list" style="margin-bottom: 40px;"></div>

        <div class="section-head">
          <h2 class="voice">Historique des tentatives (cas)</h2>
          <span class="count">${totalTentatives} au total</span>
        </div>
        <div id="historique-list" class="fiches-list"></div>
        <div id="historique-voir-plus" style="margin-top: 10px; margin-bottom: 40px;"></div>

        <div class="section-head">
          <h2 class="voice">Historique des QCM</h2>
          <span class="count">${totalQcmTentatives} au total</span>
        </div>
        <div id="historique-qcm-list" class="fiches-list"></div>
        <div id="historique-qcm-voir-plus" style="margin-top: 10px;"></div>
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

    const qcmStatsEl = document.getElementById('qcm-stats-list')
    const qcmMatiereNoms = Object.keys(qcmParMatiere)

    if (qcmMatiereNoms.length === 0) {
      qcmStatsEl.innerHTML = `<p class="empty-note">Aucun QCM traité pour l'instant.</p>`
    } else {
      qcmStatsEl.innerHTML = qcmMatiereNoms
        .map((nom) => {
          const q = qcmParMatiere[nom]
          const type = q.type || 'clinique'
          const color = { clinique: 'var(--clinique)', mecanisme: 'var(--mecanisme)', structure: 'var(--structure)' }[type]
          const taux = q.scoreMax > 0 ? Math.round((q.score / q.scoreMax) * 100) : 0
          return `
          <div class="fiche-row type-${type}">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${nom}</span>
                <span class="type-label">${taux}%</span>
              </div>
              <div class="fiche-meta">${q.score} / ${q.scoreMax} points cumulés</div>
              ${bar(q.score, q.scoreMax, color)}
            </div>
            <div class="fiche-actions">
              <button class="btn" data-reset-qcm-matiere="${nom}" style="width: auto;">Réinitialiser</button>
            </div>
          </div>
        `
        })
        .join('')
    }

    const historiqueEl = document.getElementById('historique-list')
    const historiqueVoirPlusEl = document.getElementById('historique-voir-plus')
    if (tentatives.length === 0) {
      historiqueEl.innerHTML = `<p class="empty-note">Aucune tentative enregistrée.</p>`
      historiqueVoirPlusEl.innerHTML = ''
    } else {
      const visibles = tentatives.slice(0, limiteHistorique)
      historiqueEl.innerHTML = visibles
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

      historiqueVoirPlusEl.innerHTML =
        tentatives.length > visibles.length
          ? `<button id="voir-plus-historique-btn" class="btn" style="width: auto;">Voir plus (${tentatives.length - visibles.length} restant${tentatives.length - visibles.length !== 1 ? 's' : ''})</button>`
          : ''

      const voirPlusBtn = document.getElementById('voir-plus-historique-btn')
      if (voirPlusBtn) {
        voirPlusBtn.addEventListener('click', () => {
          limiteHistorique += PAGE_SIZE
          renderAll(fiches, tentatives, tentativesQcm)
        })
      }
    }

    const historiqueQcmEl = document.getElementById('historique-qcm-list')
    const historiqueQcmVoirPlusEl = document.getElementById('historique-qcm-voir-plus')
    if (tentativesQcm.length === 0) {
      historiqueQcmEl.innerHTML = `<p class="empty-note">Aucun QCM traité pour l'instant.</p>`
      historiqueQcmVoirPlusEl.innerHTML = ''
    } else {
      const visiblesQcm = tentativesQcm.slice(0, limiteHistoriqueQcm)
      historiqueQcmEl.innerHTML = visiblesQcm
        .map((t) => {
          const qcm = t.qcm
          if (!qcm) return ''
          const taux = t.score_max > 0 ? Math.round((t.score / t.score_max) * 100) : 0
          return `
          <div class="fiche-row">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${qcm.titre}</span>
                <span class="type-label">${taux}% (${t.mode})</span>
              </div>
              <div class="fiche-meta">${(qcm.matieres || []).join(', ')} · ${formatDate(t.date_tentative)} · ${t.score}/${t.score_max}</div>
            </div>
            <div class="fiche-actions">
              <button class="btn" data-delete-qcm-tentative="${t.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
            </div>
          </div>
        `
        })
        .join('')

      historiqueQcmVoirPlusEl.innerHTML =
        tentativesQcm.length > visiblesQcm.length
          ? `<button id="voir-plus-historique-qcm-btn" class="btn" style="width: auto;">Voir plus (${tentativesQcm.length - visiblesQcm.length} restant${tentativesQcm.length - visiblesQcm.length !== 1 ? 's' : ''})</button>`
          : ''

      const voirPlusQcmBtn = document.getElementById('voir-plus-historique-qcm-btn')
      if (voirPlusQcmBtn) {
        voirPlusQcmBtn.addEventListener('click', () => {
          limiteHistoriqueQcm += PAGE_SIZE
          renderAll(fiches, tentatives, tentativesQcm)
        })
      }
    }

    const resetAllBtn = document.getElementById('reset-all-btn')
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', async () => {
        if (!window.confirm('Supprimer toutes les tentatives enregistrées (cas et QCM) ? Cette action est définitive.')) return
        try {
          await Promise.all([deleteAllTentatives(), deleteAllTentativesQcm()])
          renderAll(fiches, [], [])
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    }

    document.querySelectorAll('[data-reset-matiere]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nom = btn.dataset.resetMatiere
        if (!window.confirm(`Supprimer toutes les tentatives de cas de "${nom}" ? Cette action est définitive.`)) return
        try {
          await deleteTentativesByMatiere(nom)
          const restantes = tentatives.filter((t) => t.cas_cliniques?.matiere !== nom)
          renderAll(fiches, restantes, tentativesQcm)
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    document.querySelectorAll('[data-reset-qcm-matiere]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nom = btn.dataset.resetQcmMatiere
        if (!window.confirm(`Supprimer toutes les tentatives de QCM de "${nom}" ? Cette action est définitive.`)) return
        try {
          await deleteTentativesQcmByMatiere(nom)
          const restantes = tentativesQcm.filter((t) => !(t.qcm?.matieres || []).includes(nom))
          renderAll(fiches, tentatives, restantes)
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
          renderAll(fiches, restantes, tentativesQcm)
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    document.querySelectorAll('[data-delete-qcm-tentative]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteQcmTentative
        if (!window.confirm('Supprimer cette tentative ?')) return
        try {
          await deleteTentativeQcm(id)
          const restantes = tentativesQcm.filter((t) => t.id !== id)
          renderAll(fiches, tentatives, restantes)
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }
}
