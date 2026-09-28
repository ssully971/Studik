import { getAllDossiers, getQuestionsIsolees, getDossierAvecQuestions } from '../../lib/edn-content.js'
import { getToutesLesTentativesEdn } from '../../lib/edn-tentatives.js'
import { getStations } from '../../lib/ecos.js'
import { getToutesLesTentativesEcos } from '../../lib/ecos-tentatives.js'
import { getTentativesEdnARevoir, resoudreCiblesEnDetail } from '../../lib/edn-carnet.js'
import {
  reussiteParSpecialite,
  reussiteParItem,
  reussiteParFormat,
  reussiteParRang,
  noteAAEstimee,
  SEUIL_VALIDATION_AA,
  reussiteEcosParDomaine,
  reussiteParHeure,
  reussiteParDureeSession,
  messageFatigue,
  estObsolete,
} from '../../lib/edn-stats.js'
import { correctionTexte, genererCsvAnki } from '../../lib/edn-export.js'
import { exporterErreursExternatPDF } from '../../lib/pdf.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { afficherLoader } from '../../lib/loader.js'

function bar(value, max) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return `<div class="stat-bar"><div class="stat-bar-fill" style="width: ${pct}%; background: var(--structure);"></div></div>`
}

function ligneStat(label, groupe) {
  const pct = groupe.scoreMax > 0 ? Math.round((groupe.score / groupe.scoreMax) * 100) : 0
  return `
    <div class="now-cell" style="text-align: left;">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value voice" style="font-size: 18px;">${pct}%</div>
      ${bar(groupe.score, groupe.scoreMax)}
      <div class="desc">${groupe.score.toFixed(1)} / ${groupe.scoreMax.toFixed(1)}</div>
    </div>
  `
}

function renderGroupeStats(titre, map, { triParTauxCroissant = false, limite = null } = {}) {
  let entrees = Array.from(map.entries())
  if (triParTauxCroissant) {
    entrees.sort((a, b) => a[1].score / a[1].scoreMax - b[1].score / b[1].scoreMax)
  } else {
    entrees.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  }
  if (limite) entrees = entrees.slice(0, limite)

  if (entrees.length === 0) {
    return `<div class="section-head" style="margin-top: 28px;"><h3 class="voice" style="font-size: 16px;">${escapeHtml(titre)}</h3></div><p class="empty-note">Pas encore de données.</p>`
  }

  return `
    <div class="section-head" style="margin-top: 28px;">
      <h3 class="voice" style="font-size: 16px;">${escapeHtml(titre)}</h3>
    </div>
    <div class="now-grid now-grid-4">
      ${entrees.map(([clef, g]) => ligneStat(clef, g)).join('')}
    </div>
  `
}

export async function renderEdnStats(container) {
  const arreterLoader = afficherLoader(container)

  let dossiers, questionsIsolees, tentativesEdn, stations, tentativesEcos
  try {
    ;[dossiers, questionsIsolees, tentativesEdn, stations, tentativesEcos] = await Promise.all([
      getAllDossiers(),
      getQuestionsIsolees(),
      getToutesLesTentativesEdn(),
      getStations(),
      getToutesLesTentativesEcos(),
    ])
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Statistiques</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }

  // Les tentatives de dossier n'ont que `detail` (scores par sous-question) — il faut les
  // questions du dossier (format/rang/spécialités/items) pour ventiler chaque sous-score. On ne
  // rappelle le détail QUE pour les dossiers réellement tentés, jamais tous les dossiers.
  const idsDossiersTentes = Array.from(new Set(tentativesEdn.filter((t) => t.cible.startsWith('d:')).map((t) => t.cible.slice(2))))
  let dossiersAvecQuestions = []
  try {
    dossiersAvecQuestions = await Promise.all(idsDossiersTentes.map((id) => getDossierAvecQuestions(id)))
  } catch {
    dossiersAvecQuestions = []
  }
  const dossiersDetailParId = {}
  dossiersAvecQuestions.forEach((d) => {
    dossiersDetailParId[d.id] = d
  })
  const questionsParId = {}
  questionsIsolees.forEach((q) => {
    questionsParId[q.id] = q
  })

  // Aplatit chaque tentative en "unités évaluées" (une par question réellement notée), seule
  // forme que lib/edn-stats.js sait agréger.
  const unites = []
  tentativesEdn.forEach((t) => {
    const [type, id] = t.cible.split(':')
    if (type === 'q') {
      const q = questionsParId[id]
      if (!q) return
      unites.push({ score: t.score, scoreMax: t.score_max, format: q.format, rang: q.rang, specialites: q.specialites, items: q.items, estLCA: false, dateTentative: t.date_tentative })
    } else {
      const d = dossiersDetailParId[id]
      if (!d || !Array.isArray(t.detail)) return
      const estLCA = d.type === 'LCA'
      ;(d.questions || []).forEach((q, i) => {
        if (t.detail[i] === undefined) return
        unites.push({ score: t.detail[i], scoreMax: 1, format: q.format, rang: q.rang, specialites: q.specialites, items: q.items, estLCA, dateTentative: t.date_tentative })
      })
    }
  })

  const tentativesPourFatigue = [
    ...tentativesEdn.map((t) => ({ dateTentative: t.date_tentative, score: t.score, scoreMax: t.score_max })),
    ...tentativesEcos.map((t) => ({ dateTentative: t.date_tentative, score: t.score || 0, scoreMax: t.score_max || 0 })),
  ].filter((t) => t.scoreMax > 0)

  const stationsParId = {}
  stations.forEach((s) => {
    stationsParId[s.id] = s
  })

  const noteAA = noteAAEstimee(unites)
  const parHeure = reussiteParHeure(tentativesPourFatigue)
  const messageFat = messageFatigue(parHeure)

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Statistiques</h2>
      </div>

      <div class="settings-card">
        <h3 class="voice">Note AA estimée</h3>
        <p class="settings-desc">Seules les questions « double A » (connaissance de rang A évaluée par un format de rang A) comptent, comme au seuil de validation officiel.</p>
        <div class="value voice" style="font-size: 32px;">${noteAA === null ? '—' : `${noteAA} / 20`}</div>
        <p class="desc">${noteAA === null ? 'Pas encore de question double-A tentée.' : noteAA >= SEUIL_VALIDATION_AA ? `Au-dessus du seuil de validation (${SEUIL_VALIDATION_AA}/20).` : `En dessous du seuil de validation (${SEUIL_VALIDATION_AA}/20).`}</p>
      </div>

      ${renderGroupeStats('Réussite par rang', reussiteParRang(unites))}
      ${renderGroupeStats('Réussite par format', reussiteParFormat(unites))}
      ${renderGroupeStats('Réussite par spécialité', reussiteParSpecialite(unites))}
      ${renderGroupeStats('Réussite par item (les plus faibles d’abord)', reussiteParItem(unites), { triParTauxCroissant: true, limite: 20 })}
      ${renderGroupeStats('ECOS par domaine', reussiteEcosParDomaine(tentativesEcos, stationsParId))}

      <div class="section-head" style="margin-top: 28px;">
        <h3 class="voice" style="font-size: 16px;">Réussite selon l'heure et la durée de session (fatigue)</h3>
      </div>
      ${messageFat ? `<p class="import-hint">${escapeHtml(messageFat)}</p>` : `<p class="empty-note">Pas d'écart net pour l'instant.</p>`}
      <div class="now-grid now-grid-4">
        ${Array.from(parHeure.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([heure, g]) => ligneStat(`${heure}h`, g))
          .join('')}
      </div>
      <div class="now-grid now-grid-4" style="margin-top: 12px;">
        ${Array.from(reussiteParDureeSession(tentativesPourFatigue).entries())
          .map(([tranche, g]) => ligneStat(`${tranche} min`, g))
          .join('')}
      </div>

      <div class="settings-card" style="margin-top: 28px;">
        <h3 class="voice">Filtre d'obsolescence</h3>
        <p class="settings-desc">Questions/dossiers dont la source de référence est antérieure à l'année choisie.</p>
        <input type="number" id="obsolescence-annee" class="search-input" style="max-width: 140px;" value="2020" />
        <div id="obsolescence-liste" class="fiches-list" style="margin-top: 12px;"></div>
      </div>

      <div class="settings-card" style="margin-top: 28px;">
        <h3 class="voice">Exports</h3>
        <p class="settings-desc">Portent sur les questions isolées actuellement "à revoir" (carnet d'erreurs) — les dossiers en sont exclus pour l'instant (granularité par sous-question non disponible ici).</p>
        <div class="import-actions">
          <button id="export-csv-btn" class="btn" style="width: auto;">Exporter en CSV (Anki)</button>
          <button id="export-pdf-btn" class="btn" style="width: auto;">Exporter en PDF (mes erreurs)</button>
        </div>
        <span id="export-status" class="import-status"></span>
      </div>
    </div>
  `

  arreterLoader()

  const toutesLesUnites = [...dossiers.map((d) => ({ ...d, sorte: 'dossier' })), ...questionsIsolees.map((q) => ({ ...q, sorte: 'question' }))]

  function appliquerFiltreObsolescence() {
    const annee = Number(document.getElementById('obsolescence-annee').value) || 2020
    const obsoletes = toutesLesUnites.filter((u) => estObsolete(u.date_reference, annee))
    const listeEl = document.getElementById('obsolescence-liste')
    listeEl.innerHTML = obsoletes.length
      ? obsoletes
          .map(
            (u) => `
        <div class="fiche-row">
          <div class="tab" style="background: var(--mecanisme);"></div>
          <div class="fiche-body">
            <div class="fiche-top"><span class="fiche-title voice">${escapeHtml(u.titre || u.enonce || u.id)}</span></div>
            <div class="fiche-meta">Référence : ${escapeHtml(u.date_reference)}</div>
          </div>
        </div>
      `
          )
          .join('')
      : `<p class="empty-note">Aucun élément obsolète pour ce seuil.</p>`
  }

  document.getElementById('obsolescence-annee').addEventListener('input', appliquerFiltreObsolescence)
  appliquerFiltreObsolescence()

  async function questionsEnErreurPourExport() {
    const tentativesARevoir = await getTentativesEdnARevoir()
    const detailParCible = await resoudreCiblesEnDetail(tentativesARevoir)
    return tentativesARevoir
      .filter((t) => t.cible.startsWith('q:'))
      .map((t) => detailParCible[t.cible])
      .filter(Boolean)
  }

  document.getElementById('export-csv-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('export-status')
    statusEl.textContent = 'Préparation…'
    try {
      const questions = await questionsEnErreurPourExport()
      if (questions.length === 0) {
        statusEl.textContent = 'Aucune question isolée en erreur à exporter.'
        return
      }
      const csv = genererCsvAnki(questions)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mes-erreurs-externat-anki.csv'
      a.click()
      URL.revokeObjectURL(url)
      statusEl.textContent = `${questions.length} question(s) exportée(s).`
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
    }
  })

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('export-status')
    statusEl.textContent = 'Préparation…'
    try {
      const questions = await questionsEnErreurPourExport()
      if (questions.length === 0) {
        statusEl.textContent = 'Aucune question isolée en erreur à exporter.'
        return
      }
      exporterErreursExternatPDF(
        questions.map((q) => ({ titre: q.titreAffiche, sousTitre: q.format, correction: correctionTexte(q) }))
      )
      statusEl.textContent = `${questions.length} question(s) exportée(s).`
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
    }
  })
}
