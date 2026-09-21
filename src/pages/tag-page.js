import { getFiches } from '../lib/fiches.js'
import { getAllCas } from '../lib/cas.js'
import { getAllQcm } from '../lib/qcm.js'
import { getMatieres, buildMatiereColorMap, getCouleurEffective } from '../lib/matieres.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

export async function renderTagPage(container, nomEncode) {
  const nom = decodeURIComponent(nomEncode || '')
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let fiches, cas, qcm
  try {
    ;[fiches, cas, qcm] = await Promise.all([getFiches({}), getAllCas(), getAllQcm({})])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  let matiereColorMap = {}
  try {
    matiereColorMap = buildMatiereColorMap(await getMatieres({}))
  } catch {
    matiereColorMap = {}
  }

  const fichesTag = fiches.filter((f) => (f.tags || []).includes(nom))
  const casTag = cas.filter((c) => (c.tags || []).includes(nom))
  const qcmTag = qcm.filter((q) => (q.tags || []).includes(nom))
  const total = fichesTag.length + casTag.length + qcmTag.length

  container.innerHTML = `
    <div class="wrap">
      <a href="#prompts" class="breadcrumb">← Tags</a>

      <div class="section-head">
        <h2 class="voice">Tag « ${nom} »</h2>
        <span class="count">${total} élément${total !== 1 ? 's' : ''}</span>
      </div>

      <div class="section-head" style="margin-top: 8px; border-bottom: none; padding-bottom: 0;">
        <h3 class="voice" style="font-size: 15px;">Fiches</h3>
      </div>
      <div id="tag-fiches-list" class="fiches-list" style="margin-bottom: 28px;"></div>

      <div class="section-head" style="border-bottom: none; padding-bottom: 0;">
        <h3 class="voice" style="font-size: 15px;">Cas cliniques</h3>
      </div>
      <div id="tag-cas-list" class="fiches-list" style="margin-bottom: 28px;"></div>

      <div class="section-head" style="border-bottom: none; padding-bottom: 0;">
        <h3 class="voice" style="font-size: 15px;">QCM</h3>
      </div>
      <div id="tag-qcm-list" class="fiches-list"></div>
    </div>
  `

  const fichesListEl = document.getElementById('tag-fiches-list')
  fichesListEl.innerHTML = fichesTag.length
    ? fichesTag
        .map(
          (f) => `
      <a href="#fiche/${f.id}" class="fiche-row type-${f.type}">
        <div class="tab" style="background: ${getCouleurEffective(f.matiere, f.sous_matiere, matiereColorMap, f.type)};"></div>
        <div class="fiche-body">
          <div class="fiche-top">
            <span class="fiche-title voice">${f.titre}</span>
            <span class="type-label">${TYPE_LABELS[f.type]}</span>
          </div>
          <div class="fiche-meta">${f.matiere}${f.sous_matiere ? ' · ' + f.sous_matiere : ''}</div>
        </div>
      </a>
    `
        )
        .join('')
    : `<p class="empty-note">Aucune fiche avec ce tag.</p>`

  const casListEl = document.getElementById('tag-cas-list')
  casListEl.innerHTML = casTag.length
    ? casTag
        .map(
          (c) => `
      <a href="#entrainement/${c.id}" class="fiche-row type-${c.type}">
        <div class="tab"></div>
        <div class="fiche-body">
          <div class="fiche-top">
            <span class="fiche-title voice">${c.question}</span>
            <span class="type-label">${TYPE_LABELS[c.type]} · niveau ${c.niveau}</span>
          </div>
          <div class="fiche-meta">${c.matiere}</div>
        </div>
      </a>
    `
        )
        .join('')
    : `<p class="empty-note">Aucun cas avec ce tag.</p>`

  const qcmListEl = document.getElementById('tag-qcm-list')
  qcmListEl.innerHTML = qcmTag.length
    ? qcmTag
        .map(
          (q) => `
      <a href="#qcm-detail/${q.id}" class="fiche-row">
        <div class="tab"></div>
        <div class="fiche-body">
          <div class="fiche-top">
            <span class="fiche-title voice">${q.titre}</span>
            <span class="type-label">${q.questions.length} question${q.questions.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="fiche-meta">${(q.matieres || []).join(', ') || 'Aucune matière'}</div>
        </div>
      </a>
    `
        )
        .join('')
    : `<p class="empty-note">Aucun QCM avec ce tag.</p>`
}
