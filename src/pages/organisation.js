import {
  getArbreMatieres,
  updateMatiere,
  insertMatieres,
  deleteMatiere,
  getAllMatiereIds,
  calculerProfondeur,
  estCoursNoeud,
  estValideNoeud,
  getTousLesEmplacements,
} from '../lib/matieres.js'
import {
  getFicheCountByMatiere,
  getAllFichesRaw,
  updateFiche,
  renommerMatiereFiches,
  renommerSousMatiereFiches,
  renommerCoursFiches,
} from '../lib/fiches.js'
import { getPeriodeActuelle } from '../lib/periode.js'
import { getAllCas, updateCas, renommerMatiereCas, renommerCoursCas } from '../lib/cas.js'
import { getAllQcmRaw, updateQcm, renommerMatiereQcm, renommerCoursQcm } from '../lib/qcm.js'
import { getTousLesAttachements, attacherContenu, detacherContenu, getCoursAttaches } from '../lib/contenuCours.js'
import { slugify } from '../lib/slug.js'
import { demanderConfirmation } from '../lib/confirmer.js'
import { escapeHtml } from '../lib/escape.js'

const TYPE_DB = { fiches: 'fiche', cas: 'cas', qcm: 'qcm' }

const OPTIONS_PROGRESSION = [0, 25, 50, 75, 100]
const TYPE_LABELS = { clinique: 'Clinique', mecanisme: 'Mécanisme', structure: 'Structure' }

function couleurPourProfondeur(base, profondeur) {
  if (profondeur === 0) return base
  if (profondeur === 1) return `color-mix(in srgb, ${base} 55%, white)`
  return `color-mix(in srgb, ${base} 30%, white)`
}

// Définitions centralisées dans lib/matieres.js (partagées avec accueil.js et les sélecteurs
// matière/cours de fiches, cas et QCM).
const estCours = estCoursNoeud
const estValide = estValideNoeud

function cleContenu(matiere, sousMatiere, cours) {
  return `${matiere} ${sousMatiere || ''} ${cours}`
}

// Construit les <option> d'un sélecteur d'emplacement en 3 groupes distincts (matières / sous-
// matières / cours) plutôt qu'une liste plate : les trois niveaux se ressemblent facilement une
// fois mélangés (ex. "UE5 Sémiologie générale" la matière vs "UE5 Sémiologie générale › Douleur
// thoracique" le cours), les séparer évite de se tromper de niveau.
function optionsEmplacementsGroupees(emplacements) {
  const groupes = [
    ['Matières', emplacements.filter((c) => c.niveau === 'matiere')],
    ['Sous-matières', emplacements.filter((c) => c.niveau === 'sous-matiere')],
    ['Cours', emplacements.filter((c) => c.niveau === 'cours')],
  ]
  return groupes
    .filter(([, liste]) => liste.length > 0)
    .map(([label, liste]) => `<optgroup label="${label}">${liste.map((c) => `<option value="${c.id}">${escapeHtml(c.chemin)}</option>`).join('')}</optgroup>`)
    .join('')
}

// Hors de renderOrganisation (et non réinitialisés à chaque appel) : sinon chaque recharger()
// après une création/modification repart d'un arbre entièrement replié et d'une recherche
// vide, ce qui donnait l'impression que "toute la page se rafraîchit".
let expandedIds = new Set()
let terme = ''

export async function renderOrganisation(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const periode = getPeriodeActuelle()

  let arbre, fiches, cas, qcm
  try {
    ;[arbre, fiches, cas, qcm] = await Promise.all([
      getArbreMatieres(periode ? { annee: periode.annee, semestre: periode.semestre } : {}),
      getAllFichesRaw(),
      getAllCas(),
      getAllQcmRaw(),
    ])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  // Rattachements multi-cours (table contenu_cours) : dégrade en douceur si la migration n'a
  // pas encore été appliquée, plutôt que de casser toute la page.
  let attachements = []
  try {
    attachements = await getTousLesAttachements()
  } catch {
    attachements = []
  }

  const ficheParId = {}
  fiches.forEach((f) => {
    ficheParId[f.id] = f
  })
  const casParId = {}
  cas.forEach((c) => {
    casParId[c.id] = c
  })
  const qcmParId = {}
  qcm.forEach((q) => {
    qcmParId[q.id] = q
  })
  function itemParId(type, id) {
    return (type === 'fiches' ? ficheParId : type === 'cas' ? casParId : qcmParId)[id]
  }

  const attachementsParCours = {}
  attachements.forEach((a) => {
    if (!attachementsParCours[a.cours_id]) attachementsParCours[a.cours_id] = []
    attachementsParCours[a.cours_id].push(a)
  })

  // Index du contenu rattaché : fiches par (matière, sous-matière, cours) — elles ont les
  // deux champs. Cas/QCM n'ont pas de sous_matiere en base : ils sont indexés par (matière du
  // premier niveau, cours) uniquement.
  const indexFiches = {}
  fiches.forEach((f) => {
    if (!f.cours) return
    const cle = cleContenu(f.matiere, f.sous_matiere, f.cours)
    if (!indexFiches[cle]) indexFiches[cle] = []
    indexFiches[cle].push(f)
  })

  const indexCas = {}
  cas.forEach((c) => {
    if (!c.cours) return
    const cle = `${c.matiere} ${c.cours}`
    if (!indexCas[cle]) indexCas[cle] = []
    indexCas[cle].push(c)
  })

  const indexQcm = {}
  qcm.forEach((q) => {
    if (!q.cours) return
    ;(q.matieres || []).forEach((m) => {
      const cle = `${m} ${q.cours}`
      if (!indexQcm[cle]) indexQcm[cle] = []
      indexQcm[cle].push(q)
    })
  })

  function contenuDuCours(racineNom, sousMatiereNom, coursNom, coursId) {
    const base = {
      fiches: [...(indexFiches[cleContenu(racineNom, sousMatiereNom, coursNom)] || [])],
      cas: [...(indexCas[`${racineNom} ${coursNom}`] || [])],
      qcm: [...(indexQcm[`${racineNom} ${coursNom}`] || [])],
    }
    ;(attachementsParCours[coursId] || []).forEach((a) => {
      const cle = a.contenu_type === 'fiche' ? 'fiches' : a.contenu_type
      const item = itemParId(cle, a.contenu_id)
      if (item && !base[cle].some((i) => i.id === item.id)) base[cle].push({ ...item, _attache: true })
    })
    return base
  }

  // Tables plates id -> noeud / id -> enfants, pour la recherche de parent, le comptage et
  // les mises à jour en mémoire sans tout recharger. Au passage : les noeuds créés avant
  // l'ajout de la colonne est_cours reçoivent une valeur explicite (ancienne heuristique),
  // persistée en tâche de fond une seule fois, sans bloquer l'affichage.
  const noeudsParId = {}
  const enfantsParParent = {}
  const backfillsEstCours = []
  function indexer(noeud, parentId, profondeur) {
    noeudsParId[noeud.id] = noeud
    if (parentId) {
      if (!enfantsParParent[parentId]) enfantsParParent[parentId] = []
      enfantsParParent[parentId].push(noeud)
    }
    if (profondeur > 0 && typeof noeud.est_cours !== 'boolean') {
      const valeur = estCoursNoeud(noeud, profondeur)
      noeud.est_cours = valeur
      backfillsEstCours.push(updateMatiere(noeud.id, { est_cours: valeur }))
    }
    noeud.enfants.forEach((e) => indexer(e, noeud.id, profondeur + 1))
  }
  arbre.forEach((r) => indexer(r, null, 0))
  if (backfillsEstCours.length > 0) Promise.all(backfillsEstCours).catch(() => {})

  // Contenu non rattaché à un cours connu (champ cours vide, ou qui ne correspond à aucun
  // cours existant dans cette matière) : regroupé au niveau de la matière (cas/QCM, qui n'ont
  // pas de sous_matiere en base) ou de la sous-matière (fiches), pour ne jamais rester invisible.
  const coursConnusParRacine = {}
  function collecterCoursConnus(noeud, profondeur, racineNom) {
    if (estCours(noeud, profondeur)) {
      if (!coursConnusParRacine[racineNom]) coursConnusParRacine[racineNom] = new Set()
      coursConnusParRacine[racineNom].add(noeud.nom)
    } else {
      noeud.enfants.forEach((e) => collecterCoursConnus(e, profondeur + 1, racineNom))
    }
  }
  arbre.forEach((r) => collecterCoursConnus(r, 0, r.nom))

  // Fusionne les rattachements secondaires (contenu_cours) d'un noeud dans un bloc {fiches,
  // cas, qcm} déjà construit — partagé par le contenu d'un cours et le contenu "non classé"
  // d'une matière/sous-matière, puisqu'un rattachement peut maintenant cibler n'importe quel
  // niveau de la hiérarchie, pas seulement un cours.
  function fusionnerAttachements(base, noeudId) {
    ;(attachementsParCours[noeudId] || []).forEach((a) => {
      const cle = a.contenu_type === 'fiche' ? 'fiches' : a.contenu_type
      const item = itemParId(cle, a.contenu_id)
      if (item && !base[cle].some((i) => i.id === item.id)) base[cle].push({ ...item, _attache: true })
    })
    return base
  }

  function contenuNonClasseRacine(racineNom, racineId) {
    const connus = coursConnusParRacine[racineNom] || new Set()
    const base = {
      fiches: fiches.filter((f) => f.matiere === racineNom && !f.sous_matiere && (!f.cours || !connus.has(f.cours))),
      cas: cas.filter((c) => c.matiere === racineNom && (!c.cours || !connus.has(c.cours))),
      qcm: qcm.filter((q) => (q.matieres || []).includes(racineNom) && (!q.cours || !connus.has(q.cours))),
    }
    return fusionnerAttachements(base, racineId)
  }

  function contenuNonClasseSousMatiere(racineNom, sousMatiereNom, sousMatiereId) {
    const connus = coursConnusParRacine[racineNom] || new Set()
    const base = {
      fiches: fiches.filter((f) => f.matiere === racineNom && f.sous_matiere === sousMatiereNom && (!f.cours || !connus.has(f.cours))),
      cas: [],
      qcm: [],
    }
    return fusionnerAttachements(base, sousMatiereId)
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Organisation</h2>
        <span class="count" id="org-count"></span>
      </div>

      <div class="import-actions" style="margin-bottom: 16px;">
        <button id="org-nouvelle-matiere-btn" class="btn primary" style="width: auto;">+ Nouvelle matière</button>
      </div>

      <div id="org-orphelins"></div>

      <input type="text" id="org-recherche" class="search-input" placeholder="Rechercher une matière, un cours, une fiche, un cas, un QCM…" />

      <div id="org-tree" class="org-tree"></div>
    </div>

    <div id="noeud-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="noeud-modal-title" class="voice"></span>
          <button id="noeud-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Nom</label>
          <input type="text" id="noeud-nom" class="search-input" style="margin-bottom: 0;" />
        </div>
        <div id="noeud-champs-type" style="margin-bottom: 14px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Type</label>
          <div style="display: flex; gap: 16px;">
            <label class="checkbox-label" style="width: auto;">
              <input type="radio" name="noeud-type-radio" id="noeud-type-sous-matiere" value="sous-matiere" checked />
              <span>Sous-matière</span>
            </label>
            <label class="checkbox-label" style="width: auto;">
              <input type="radio" name="noeud-type-radio" id="noeud-type-cours" value="cours" />
              <span>Cours</span>
            </label>
          </div>
          <p id="noeud-type-note" class="settings-desc" style="margin: 4px 0 0;"></p>
        </div>
        <div id="noeud-champs-racine">
          <div class="matiere-edit-grid">
            <label>
              Type
              <select id="noeud-type" class="periode-select">
                <option value="clinique">Clinique</option>
                <option value="mecanisme">Mécanisme</option>
                <option value="structure">Structure</option>
              </select>
            </label>
            <label>
              Couleur
              <input type="text" id="noeud-couleur" placeholder="#4EA189" />
            </label>
            <label>
              Ordre
              <input type="number" id="noeud-ordre" value="0" />
            </label>
            <label>
              Année
              <input type="text" id="noeud-annee" placeholder="P2" />
            </label>
            <label>
              Semestre
              <input type="text" id="noeud-semestre" placeholder="S1" />
            </label>
          </div>
        </div>
        <div id="noeud-fusion-zone" class="hidden" style="margin-bottom: 14px;">
          <button type="button" id="noeud-fusionner-btn" class="btn" style="width: auto;">Fusionner avec une autre matière…</button>
        </div>
        <div class="import-actions">
          <button id="noeud-save-btn" class="btn primary" style="width: auto;">Enregistrer</button>
          <span id="noeud-status" class="import-status"></span>
        </div>
      </div>
    </div>

    <div id="contenu-popup-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="contenu-popup-title" class="voice"></span>
          <button id="contenu-popup-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div id="contenu-popup-liste" class="org-content-group" style="max-height: 60vh; overflow-y: auto;"></div>
      </div>
    </div>

    <div id="assigner-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="assigner-modal-title" class="voice"></span>
          <button id="assigner-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <p id="assigner-lieu-actuel" class="settings-desc"></p>
        <div id="assigner-apercu-actuel" class="settings-card" style="margin-bottom: 14px;"></div>
        <div style="margin: 14px 0;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Nouvel emplacement (matière, sous-matière ou cours)</label>
          <select id="assigner-cours-select" class="periode-select" style="width: 100%;"></select>
        </div>
        <div class="import-actions">
          <button id="assigner-deplacer-btn" class="btn primary" style="width: auto;">Déplacer ici</button>
          <button id="assigner-attacher-btn" class="btn" style="width: auto;">Attacher aussi ici</button>
        </div>
        <span id="assigner-status" class="import-status"></span>
        <div id="assigner-attaches-existants" style="margin-top: 16px;"></div>
      </div>
    </div>

    <div id="rattacher-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span class="voice">Rattacher du contenu existant</span>
          <button id="rattacher-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div class="filters" style="margin-bottom: 10px;">
          <button type="button" class="filter-btn active" data-rattacher-type="fiches">Fiches</button>
          <button type="button" class="filter-btn" data-rattacher-type="cas">Cas</button>
          <button type="button" class="filter-btn" data-rattacher-type="qcm">QCM</button>
        </div>
        <input type="text" id="rattacher-recherche" class="search-input" placeholder="Rechercher par titre…" />
        <span id="rattacher-status" class="import-status"></span>
        <div id="rattacher-resultats" style="max-height: 50vh; overflow-y: auto; margin-top: 10px;"></div>
      </div>
    </div>

    <div id="apercu-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="apercu-modal-title" class="voice"></span>
          <button id="apercu-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div id="apercu-modal-content"></div>
      </div>
    </div>

    <div id="fusion-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="fusion-modal-title" class="voice"></span>
          <button id="fusion-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <p class="settings-desc">Déplace tout le contenu (et les sous-matières/cours de même nom fusionnent avec ceux de la matière cible) vers une autre matière, puis supprime celle-ci. Action irréversible.</p>
        <div style="margin: 14px 0;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Fusionner dans</label>
          <select id="fusion-select" class="periode-select" style="width: 100%;"></select>
        </div>
        <div class="import-actions">
          <button id="fusion-confirmer" class="btn primary" style="width: auto; color: #C46A5C;">Fusionner et supprimer</button>
          <span id="fusion-status" class="import-status"></span>
        </div>
      </div>
    </div>

    <div id="deplacer-noeud-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="deplacer-noeud-title" class="voice"></span>
          <button id="deplacer-noeud-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <p class="settings-desc">Déplace ce cours, et tout son contenu principal, vers une autre matière ou sous-matière déjà créée.</p>
        <div style="margin: 14px 0;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Nouvel emplacement</label>
          <select id="deplacer-noeud-select" class="periode-select" style="width: 100%;"></select>
        </div>
        <div class="import-actions">
          <button id="deplacer-noeud-confirmer" class="btn primary" style="width: auto;">Déplacer</button>
          <span id="deplacer-noeud-status" class="import-status"></span>
        </div>
      </div>
    </div>
  `

  let modeCourant = null
  let profondeurCourante = 0

  // --- Modale de création / édition d'un noeud ---
  const noeudOverlay = document.getElementById('noeud-modal-overlay')
  document.getElementById('noeud-modal-close').addEventListener('click', () => noeudOverlay.classList.add('hidden'))
  noeudOverlay.addEventListener('click', (e) => {
    if (e.target === noeudOverlay) noeudOverlay.classList.add('hidden')
  })

  // --- Popup "voir plus" : liste complète d'un groupe (fiches/cas/QCM) trop long pour tenir
  // dans le bloc de contenu — un seul type par ouverture, jamais mélangé.
  const contenuPopupOverlay = document.getElementById('contenu-popup-overlay')
  document.getElementById('contenu-popup-close').addEventListener('click', () => contenuPopupOverlay.classList.add('hidden'))
  contenuPopupOverlay.addEventListener('click', (e) => {
    if (e.target === contenuPopupOverlay) contenuPopupOverlay.classList.add('hidden')
  })
  let popupListes = {}

  function ouvrirPopupContenu(cle) {
    const data = popupListes[cle]
    if (!data) return
    document.getElementById('contenu-popup-title').textContent = `${data.titre} (${data.items.length})`
    document.getElementById('contenu-popup-liste').innerHTML = data.items.map(ligneItem).join('')
    contenuPopupOverlay.classList.remove('hidden')
    wirerBoutonsAssigner(document.getElementById('contenu-popup-liste'))
    wirerBoutonsApercu(document.getElementById('contenu-popup-liste'))
  }

  // --- Assigner un élément (fiche/cas/QCM) à un cours : déplacer son rattachement principal,
  // l'attacher en plus à un autre cours (multi-cours), ou détacher un rattachement existant.
  const assignerOverlay = document.getElementById('assigner-modal-overlay')
  document.getElementById('assigner-modal-close').addEventListener('click', () => assignerOverlay.classList.add('hidden'))
  assignerOverlay.addEventListener('click', (e) => {
    if (e.target === assignerOverlay) assignerOverlay.classList.add('hidden')
  })

  let assignerCourant = null
  let tousLesEmplacementsCache = null

  async function ouvrirAssignerModal(type, id) {
    const item = itemParId(type, id)
    if (!item) return
    assignerCourant = { type, id, item }

    const titre = type === 'cas' ? item.question : item.titre
    document.getElementById('assigner-modal-title').textContent = titre
    document.getElementById('assigner-apercu-actuel').innerHTML = apercuContenu(type, item)

    const lieu =
      type === 'qcm'
        ? `${(item.matieres || []).join(', ') || 'aucune matière'}${item.cours ? ' › ' + item.cours : ' (aucun cours)'}`
        : `${item.matiere}${item.sous_matiere ? ' › ' + item.sous_matiere : ''}${item.cours ? ' › ' + item.cours : ' (aucun cours)'}`
    document.getElementById('assigner-lieu-actuel').textContent = `Lieu principal actuel : ${lieu}`
    document.getElementById('assigner-status').textContent = ''

    if (!tousLesEmplacementsCache) tousLesEmplacementsCache = await getTousLesEmplacements()
    const select = document.getElementById('assigner-cours-select')
    select.innerHTML = optionsEmplacementsGroupees(tousLesEmplacementsCache)

    const zone = document.getElementById('assigner-attaches-existants')
    zone.innerHTML = ''
    try {
      const coursIds = await getCoursAttaches(TYPE_DB[type], id)
      const chemins = coursIds.map((cid) => tousLesEmplacementsCache.find((c) => c.id === cid)).filter(Boolean)
      if (chemins.length > 0) {
        zone.innerHTML =
          `<h4 style="font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px;">Aussi attaché à</h4>` +
          chemins
            .map(
              (c) =>
                `<div class="org-content-row"><span class="org-content-item">${escapeHtml(c.chemin)}</span><button type="button" class="org-action-btn org-action-danger" data-detacher-cours="${c.id}">🗑</button></div>`
            )
            .join('')
        zone.querySelectorAll('[data-detacher-cours]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const statusEl = document.getElementById('assigner-status')
            try {
              await detacherContenu(btn.dataset.detacherCours, TYPE_DB[type], id)
              assignerOverlay.classList.add('hidden')
              await recharger()
            } catch (err) {
              statusEl.textContent = 'Erreur : ' + err.message
              statusEl.className = 'import-status error'
            }
          })
        })
      }
    } catch {
      // silencieux
    }

    assignerOverlay.classList.remove('hidden')
  }

  document.getElementById('assigner-deplacer-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('assigner-status')
    if (!assignerCourant || !tousLesEmplacementsCache) return
    const emplacementId = document.getElementById('assigner-cours-select').value
    const cible = tousLesEmplacementsCache.find((c) => c.id === emplacementId)
    if (!cible) return
    const parties = cible.chemin.split(' › ')
    // Cas/QCM n'ont pas de sous_matiere en base : viser une sous-matière retombe sur sa matière,
    // sans cours précis — mieux qu'un échec, et rattrapable via "Attacher aussi ici" au niveau
    // exact voulu (contenu_cours n'a pas cette limite).
    const coursCible = cible.niveau === 'cours' ? cible.nom : null
    const sousMatiereCible = cible.niveau === 'cours' ? (parties.length === 3 ? parties[1] : null) : cible.niveau === 'sous-matiere' ? cible.nom : null

    try {
      const { type, id, item } = assignerCourant
      if (type === 'fiches') {
        await updateFiche(id, { matiere: cible.racine, sous_matiere: sousMatiereCible, cours: coursCible })
      } else if (type === 'cas') {
        await updateCas(id, { matiere: cible.racine, cours: coursCible })
      } else {
        const matieres = (item.matieres || []).includes(cible.racine) ? item.matieres : [...(item.matieres || []), cible.racine]
        await updateQcm(id, { matieres, cours: coursCible })
      }
      assignerOverlay.classList.add('hidden')
      await recharger()
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('assigner-attacher-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('assigner-status')
    if (!assignerCourant) return
    const emplacementId = document.getElementById('assigner-cours-select').value
    try {
      await attacherContenu(emplacementId, TYPE_DB[assignerCourant.type], assignerCourant.id)
      assignerOverlay.classList.add('hidden')
      await recharger()
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  function wirerBoutonsAssigner(root) {
    root.querySelectorAll('[data-assigner-type]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        ouvrirAssignerModal(btn.dataset.assignerType, btn.dataset.assignerId)
      })
    })
  }

  // --- Rattacher du contenu déjà existant à un cours donné, sans le déplacer (recherche par
  // titre parmi les fiches, cas ou QCM du site).
  const rattacherOverlay = document.getElementById('rattacher-modal-overlay')
  document.getElementById('rattacher-modal-close').addEventListener('click', () => rattacherOverlay.classList.add('hidden'))
  rattacherOverlay.addEventListener('click', (e) => {
    if (e.target === rattacherOverlay) rattacherOverlay.classList.add('hidden')
  })

  let rattacherCoursId = null
  let rattacherType = 'fiches'

  function rafraichirResultatsRattacher() {
    const terme2 = document.getElementById('rattacher-recherche').value.trim().toLowerCase()
    const source = rattacherType === 'fiches' ? fiches : rattacherType === 'cas' ? cas : qcm
    const filtres = source
      .filter((it) => {
        const texte = (rattacherType === 'cas' ? it.question : it.titre).toLowerCase()
        return !terme2 || texte.includes(terme2)
      })
      .slice(0, 30)

    const zone = document.getElementById('rattacher-resultats')
    zone.innerHTML = filtres.length
      ? filtres
          .map((it) => {
            const label = rattacherType === 'cas' ? it.question : it.titre
            return `<div class="org-content-row"><span class="org-content-item">${escapeHtml(label)}</span><button type="button" class="org-action-btn" data-apercu-type="${rattacherType}" data-apercu-id="${it.id}" title="Aperçu">👁</button><button type="button" class="btn" style="width: auto;" data-attacher-existant="${it.id}">Attacher</button></div>`
          })
          .join('')
      : `<p class="empty-note">Aucun résultat.</p>`

    zone.querySelectorAll('[data-attacher-existant]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const statusEl = document.getElementById('rattacher-status')
        try {
          await attacherContenu(rattacherCoursId, TYPE_DB[rattacherType], btn.dataset.attacherExistant)
          rattacherOverlay.classList.add('hidden')
          await recharger()
        } catch (err) {
          statusEl.textContent = 'Erreur : ' + err.message
          statusEl.className = 'import-status error'
        }
      })
    })
    wirerBoutonsApercu(zone)
  }

  function ouvrirRattacherModal(coursId) {
    rattacherCoursId = coursId
    rattacherType = 'fiches'
    document.querySelectorAll('[data-rattacher-type]').forEach((b) => b.classList.toggle('active', b.dataset.rattacherType === 'fiches'))
    document.getElementById('rattacher-recherche').value = ''
    document.getElementById('rattacher-status').textContent = ''
    rafraichirResultatsRattacher()
    rattacherOverlay.classList.remove('hidden')
  }

  document.querySelectorAll('[data-rattacher-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      rattacherType = btn.dataset.rattacherType
      document.querySelectorAll('[data-rattacher-type]').forEach((b) => b.classList.toggle('active', b === btn))
      rafraichirResultatsRattacher()
    })
  })
  document.getElementById('rattacher-recherche').addEventListener('input', rafraichirResultatsRattacher)

  // --- Déplacer un cours vers une autre matière/sous-matière déjà créée : migre à la fois le
  // noeud (parent_id) et son contenu principal (les rattachements secondaires via contenu_cours
  // survivent tels quels, puisqu'ils pointent sur l'id du cours, jamais sur son nom).
  const deplacerNoeudOverlay = document.getElementById('deplacer-noeud-modal-overlay')
  document.getElementById('deplacer-noeud-close').addEventListener('click', () => deplacerNoeudOverlay.classList.add('hidden'))
  deplacerNoeudOverlay.addEventListener('click', (e) => {
    if (e.target === deplacerNoeudOverlay) deplacerNoeudOverlay.classList.add('hidden')
  })

  let deplacerNoeudCourant = null
  let deplacerNoeudCibles = []

  function ancetres(noeud) {
    const chaine = []
    let courant = noeud
    while (courant?.parent_id) {
      courant = noeudsParId[courant.parent_id]
      if (courant) chaine.unshift(courant)
    }
    return chaine
  }

  function ciblesDeplacementPossibles(noeudId) {
    const cibles = []
    arbre.forEach((racine) => {
      if (racine.id !== noeudId) cibles.push({ id: racine.id, chemin: racine.nom, racineNom: racine.nom, sousMatiereNom: null, niveau: 'matiere' })
      racine.enfants.forEach((e) => {
        if (!estCours(e, 1) && e.id !== noeudId) {
          cibles.push({ id: e.id, chemin: `${racine.nom} › ${e.nom}`, racineNom: racine.nom, sousMatiereNom: e.nom, niveau: 'sous-matiere' })
        }
      })
    })
    return cibles
  }

  function ouvrirDeplacerNoeudModal(noeud, profondeur, racineNom, sousMatiereAncestorNom) {
    deplacerNoeudCourant = { noeud, profondeur, racineNom, sousMatiereAncestorNom }
    deplacerNoeudCibles = ciblesDeplacementPossibles(noeud.id)
    document.getElementById('deplacer-noeud-title').textContent = `Déplacer « ${noeud.nom} »`
    document.getElementById('deplacer-noeud-select').innerHTML = optionsEmplacementsGroupees(deplacerNoeudCibles)
    document.getElementById('deplacer-noeud-status').textContent = ''
    deplacerNoeudOverlay.classList.remove('hidden')
  }

  async function migrerContenuCours(noeud, profondeur, racineAncienne, sousMatiereAncienne, racineNouvelle, sousMatiereNouvelle) {
    const contenu = contenuDuCours(racineAncienne, sousMatiereAncienne, noeud.nom, noeud.id)
    await Promise.all([
      ...contenu.fiches.filter((f) => !f._attache).map((f) => updateFiche(f.id, { matiere: racineNouvelle, sous_matiere: sousMatiereNouvelle, cours: noeud.nom })),
      ...contenu.cas.filter((c) => !c._attache).map((c) => updateCas(c.id, { matiere: racineNouvelle, cours: noeud.nom })),
      ...contenu.qcm
        .filter((q) => !q._attache)
        .map((q) => {
          const matieres = (q.matieres || []).includes(racineAncienne)
            ? q.matieres.map((m) => (m === racineAncienne ? racineNouvelle : m))
            : [...(q.matieres || []), racineNouvelle]
          return updateQcm(q.id, { matieres, cours: noeud.nom })
        }),
    ])
  }

  document.getElementById('deplacer-noeud-confirmer').addEventListener('click', async () => {
    const statusEl = document.getElementById('deplacer-noeud-status')
    if (!deplacerNoeudCourant) return
    const emplacementId = document.getElementById('deplacer-noeud-select').value
    const cible = deplacerNoeudCibles.find((c) => c.id === emplacementId)
    if (!cible) return
    const { noeud, profondeur, racineNom, sousMatiereAncestorNom } = deplacerNoeudCourant
    try {
      await updateMatiere(noeud.id, { parent_id: cible.id, est_cours: true })
      await migrerContenuCours(noeud, profondeur, racineNom, sousMatiereAncestorNom, cible.racineNom, cible.sousMatiereNom)
      deplacerNoeudOverlay.classList.add('hidden')
      await recharger()
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  // --- Fusionner deux matières racines : corrige les doublons créés quand un import (ou une
  // modification) référence l'ancien nom d'une matière déjà renommée — migre tout le contenu
  // par nom, fusionne récursivement les sous-matières/cours de même nom avec ceux de la cible,
  // réattribue les rattachements secondaires, puis supprime la matière source.
  const fusionOverlay = document.getElementById('fusion-modal-overlay')
  document.getElementById('fusion-modal-close').addEventListener('click', () => fusionOverlay.classList.add('hidden'))
  fusionOverlay.addEventListener('click', (e) => {
    if (e.target === fusionOverlay) fusionOverlay.classList.add('hidden')
  })

  let fusionSource = null

  function ouvrirFusionModal(noeud) {
    fusionSource = noeud
    document.getElementById('fusion-modal-title').textContent = `Fusionner « ${noeud.nom} »`
    const cibles = arbre.filter((r) => r.id !== noeud.id)
    document.getElementById('fusion-select').innerHTML = cibles.map((r) => `<option value="${r.id}">${escapeHtml(r.nom)}</option>`).join('')
    document.getElementById('fusion-status').textContent = ''
    fusionOverlay.classList.remove('hidden')
  }

  async function fusionnerNoeud(source, cible, profondeur) {
    if (profondeur === 0) {
      await Promise.all([renommerMatiereFiches(source.nom, cible.nom), renommerMatiereCas(source.nom, cible.nom), renommerMatiereQcm(source.nom, cible.nom)])
    }
    for (const a of attachementsParCours[source.id] || []) {
      try {
        await attacherContenu(cible.id, a.contenu_type, a.contenu_id)
        await detacherContenu(source.id, a.contenu_type, a.contenu_id)
      } catch {
        // silencieux : si contenu_cours n'existe pas encore, rien à migrer ici
      }
    }
    const enfantsSource = enfantsParParent[source.id] || []
    const enfantsCible = enfantsParParent[cible.id] || []
    for (const enfant of enfantsSource) {
      const correspondant = enfantsCible.find((e) => e.nom === enfant.nom)
      if (correspondant) {
        await fusionnerNoeud(enfant, correspondant, profondeur + 1)
      } else {
        await updateMatiere(enfant.id, { parent_id: cible.id })
      }
    }
    await deleteMatiere(source.id)
  }

  document.getElementById('fusion-confirmer').addEventListener('click', async () => {
    const statusEl = document.getElementById('fusion-status')
    if (!fusionSource) return
    const cibleId = document.getElementById('fusion-select').value
    const cible = noeudsParId[cibleId]
    if (!cible) return
    if (
      !(await demanderConfirmation(
        `Fusionner « ${fusionSource.nom} » dans « ${cible.nom} » ? Tout le contenu sera déplacé, les sous-matières/cours de même nom seront fusionnés, et « ${fusionSource.nom} » sera supprimée. Cette action est définitive.`
      ))
    )
      return
    statusEl.textContent = 'Fusion en cours…'
    statusEl.className = 'import-status'
    try {
      await fusionnerNoeud(fusionSource, cible, 0)
      fusionOverlay.classList.add('hidden')
      await recharger()
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  // --- Contenu orphelin : fiches/cas/QCM dont le champ matière ne correspond à AUCUNE matière
  // existante (typiquement une matière renommée depuis, référencée par un import généré avant
  // le renommage) — invisible dans l'arbre sinon, donc signalé à part avec une réattribution
  // en un clic plutôt que de laisser un nouvel import recréer un doublon.
  function calculerOrphelins() {
    const nomsRacines = new Set(arbre.map((r) => r.nom))
    const orphelins = {}
    function add(nom, type) {
      if (!nom || nomsRacines.has(nom)) return
      if (!orphelins[nom]) orphelins[nom] = { fiches: 0, cas: 0, qcm: 0 }
      orphelins[nom][type]++
    }
    fiches.forEach((f) => add(f.matiere, 'fiches'))
    cas.forEach((c) => add(c.matiere, 'cas'))
    qcm.forEach((q) => (q.matieres || []).forEach((m) => add(m, 'qcm')))
    return orphelins
  }

  function renderOrphelins() {
    const orphelins = calculerOrphelins()
    const noms = Object.keys(orphelins)
    const zone = document.getElementById('org-orphelins')
    if (noms.length === 0) {
      zone.innerHTML = ''
      return
    }
    zone.innerHTML = `
      <div class="settings-card" style="border-color: #C46A5C; margin-bottom: 16px;">
        <h3 class="voice" style="font-size: 14px; margin-bottom: 8px;">⚠ Contenu sur un nom de matière introuvable (${noms.length})</h3>
        <p class="settings-desc">Ce contenu référence un nom de matière qui ne correspond à aucune matière existante — probablement une matière renommée depuis, ou une faute de frappe dans un import. Réattribue-le à la bonne matière.</p>
        ${noms
          .map((nom) => {
            const o = orphelins[nom]
            const total = o.fiches + o.cas + o.qcm
            const detail = [o.fiches && `${o.fiches} fiche${o.fiches !== 1 ? 's' : ''}`, o.cas && `${o.cas} cas`, o.qcm && `${o.qcm} QCM`]
              .filter(Boolean)
              .join(', ')
            return `
            <div class="org-content-row" style="margin-top: 10px;">
              <span class="org-content-item">« ${escapeHtml(nom)} » — ${total} élément${total !== 1 ? 's' : ''} (${detail})</span>
              <select class="periode-select" data-orphelin-cible="${escapeHtml(nom)}" style="width: auto;">
                <option value="">Réattribuer à…</option>
                ${arbre.map((r) => `<option value="${escapeHtml(r.nom)}">${escapeHtml(r.nom)}</option>`).join('')}
              </select>
            </div>
          `
          })
          .join('')}
      </div>
    `
    zone.querySelectorAll('[data-orphelin-cible]').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const cibleNom = e.target.value
        if (!cibleNom) return
        const sourceNom = select.dataset.orphelinCible
        if (!(await demanderConfirmation(`Réattribuer tout le contenu de « ${sourceNom} » vers « ${cibleNom} » ?`))) {
          e.target.value = ''
          return
        }
        try {
          await Promise.all([renommerMatiereFiches(sourceNom, cibleNom), renommerMatiereCas(sourceNom, cibleNom), renommerMatiereQcm(sourceNom, cibleNom)])
          await recharger()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }

  function ouvrirModalNoeud(mode) {
    modeCourant = mode
    const estRacine = mode.type === 'creer-racine' || (mode.type === 'editer' && !mode.noeud.parent_id)
    profondeurCourante =
      mode.type === 'creer-enfant'
        ? calculerProfondeur(noeudsParId[mode.parentId], noeudsParId) + 1
        : mode.type === 'editer'
          ? calculerProfondeur(mode.noeud, noeudsParId)
          : 0

    document.getElementById('noeud-modal-title').textContent =
      mode.type === 'editer' ? `Modifier « ${mode.noeud.nom} »` : mode.type === 'creer-racine' ? 'Nouvelle matière' : `Ajouter sous « ${mode.parentNom} »`
    document.getElementById('noeud-champs-racine').style.display = estRacine ? '' : 'none'
    document.getElementById('noeud-fusion-zone').classList.toggle('hidden', !(estRacine && mode.type === 'editer'))
    document.getElementById('noeud-nom').value = mode.type === 'editer' ? mode.noeud.nom : ''

    if (estRacine) {
      document.getElementById('noeud-type').value = mode.type === 'editer' ? mode.noeud.type : 'clinique'
      document.getElementById('noeud-couleur').value = mode.type === 'editer' ? mode.noeud.couleur || '' : ''
      document.getElementById('noeud-ordre').value = mode.type === 'editer' ? (mode.noeud.ordre_affichage ?? 0) : 0
      document.getElementById('noeud-annee').value = mode.type === 'editer' ? mode.noeud.annee || '' : ''
      document.getElementById('noeud-semestre').value = mode.type === 'editer' ? mode.noeud.semestre || '' : ''
    }

    const champsType = document.getElementById('noeud-champs-type')
    const radioSousMatiere = document.getElementById('noeud-type-sous-matiere')
    const radioCours = document.getElementById('noeud-type-cours')
    const note = document.getElementById('noeud-type-note')
    if (profondeurCourante === 1) {
      champsType.style.display = ''
      const estCoursActuel = mode.type === 'editer' ? estCours(mode.noeud, 1) : false
      radioSousMatiere.checked = !estCoursActuel
      radioCours.checked = estCoursActuel
      const aDesEnfants = mode.type === 'editer' && (enfantsParParent[mode.noeud.id] || []).length > 0
      radioCours.disabled = aDesEnfants
      note.textContent = aDesEnfants ? 'Ce noeud a déjà des sous-éléments, il ne peut pas devenir un cours.' : ''
    } else {
      champsType.style.display = 'none'
    }

    document.getElementById('noeud-status').textContent = ''
    noeudOverlay.classList.remove('hidden')
    document.getElementById('noeud-nom').focus()
  }

  // Le contenu (fiches/cas/QCM) référence les matières/sous-matières/cours par leur NOM, pas
  // par leur id : sans ce cascadage, renommer un noeud laisse tout son contenu accroché à
  // l'ancien nom, invisible partout dans Organisation (bug déjà rencontré : contenu "disparu"
  // après renommage, puis "dupliqué" au réimport suivant faute de correspondance de nom).
  async function cascaderRenommage(noeud, profondeur, nouveauNom) {
    const ancienNom = noeud.nom
    if (profondeur === 0) {
      await Promise.all([renommerMatiereFiches(ancienNom, nouveauNom), renommerMatiereCas(ancienNom, nouveauNom), renommerMatiereQcm(ancienNom, nouveauNom)])
      return
    }
    const parent = noeudsParId[noeud.parent_id]
    if (!parent) return
    if (!estCours(noeud, profondeur)) {
      await renommerSousMatiereFiches(parent.nom, ancienNom, nouveauNom)
      return
    }
    if (profondeur === 1) {
      await Promise.all([
        renommerCoursFiches(parent.nom, null, ancienNom, nouveauNom),
        renommerCoursCas(parent.nom, ancienNom, nouveauNom),
        renommerCoursQcm(parent.nom, ancienNom, nouveauNom),
      ])
    } else {
      const racine = noeudsParId[parent.parent_id]
      if (!racine) return
      await Promise.all([
        renommerCoursFiches(racine.nom, parent.nom, ancienNom, nouveauNom),
        renommerCoursCas(racine.nom, ancienNom, nouveauNom),
        renommerCoursQcm(racine.nom, ancienNom, nouveauNom),
      ])
    }
  }

  document.getElementById('org-nouvelle-matiere-btn').addEventListener('click', () => {
    ouvrirModalNoeud({ type: 'creer-racine' })
  })

  document.getElementById('noeud-fusionner-btn').addEventListener('click', () => {
    if (!modeCourant || modeCourant.type !== 'editer') return
    const noeud = modeCourant.noeud
    noeudOverlay.classList.add('hidden')
    ouvrirFusionModal(noeud)
  })

  document.getElementById('noeud-save-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('noeud-status')
    const nom = document.getElementById('noeud-nom').value.trim()
    if (!nom) {
      statusEl.textContent = 'Le nom est obligatoire.'
      statusEl.className = 'import-status error'
      return
    }

    try {
      if (modeCourant.type === 'editer') {
        const champs = { nom }
        if (!modeCourant.noeud.parent_id) {
          champs.type = document.getElementById('noeud-type').value
          champs.couleur = document.getElementById('noeud-couleur').value.trim() || null
          champs.ordre_affichage = parseInt(document.getElementById('noeud-ordre').value, 10) || 0
          champs.annee = document.getElementById('noeud-annee').value.trim() || null
          champs.semestre = document.getElementById('noeud-semestre').value.trim() || null
        } else if (profondeurCourante === 1) {
          champs.est_cours = document.getElementById('noeud-type-cours').checked
        }
        await updateMatiere(modeCourant.noeud.id, champs)
        if (nom !== modeCourant.noeud.nom) {
          await cascaderRenommage(modeCourant.noeud, profondeurCourante, nom)
        }
      } else {
        const id = slugify(nom)
        const idsExistants = await getAllMatiereIds()
        if (idsExistants.includes(id)) {
          statusEl.textContent = `Un élément avec l'id "${id}" existe déjà.`
          statusEl.className = 'import-status error'
          return
        }
        const estRacine = modeCourant.type === 'creer-racine'
        const champs = estRacine
          ? {
              id,
              nom,
              type: document.getElementById('noeud-type').value,
              couleur: document.getElementById('noeud-couleur').value.trim() || null,
              ordre_affichage: parseInt(document.getElementById('noeud-ordre').value, 10) || 0,
              annee: document.getElementById('noeud-annee').value.trim() || null,
              semestre: document.getElementById('noeud-semestre').value.trim() || null,
              parent_id: null,
            }
          : {
              id,
              nom,
              type: modeCourant.parentType,
              couleur: null,
              ordre_affichage: 0,
              annee: null,
              semestre: null,
              parent_id: modeCourant.parentId,
              est_cours: profondeurCourante === 2 ? true : document.getElementById('noeud-type-cours').checked,
            }
        await insertMatieres([champs])
      }
      noeudOverlay.classList.add('hidden')
      await recharger()
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  async function supprimerNoeud(noeud) {
    const enfants = enfantsParParent[noeud.id] || []
    const morceaux = []
    if (enfants.length > 0) morceaux.push(`${enfants.length} élément${enfants.length !== 1 ? 's' : ''} rattaché${enfants.length !== 1 ? 's' : ''}`)

    if (!noeud.parent_id) {
      try {
        const nbFiches = await getFicheCountByMatiere(noeud.nom)
        if (nbFiches > 0) morceaux.push(`${nbFiches} fiche${nbFiches !== 1 ? 's' : ''} encore rattachée${nbFiches !== 1 ? 's' : ''}`)
      } catch {
        // silencieux
      }
    }

    const message =
      morceaux.length > 0
        ? `${morceaux.join(' et ')} concerné${morceaux.length > 1 ? 's' : ''} par "${noeud.nom}". Supprimer quand même ?`
        : `Supprimer "${noeud.nom}" ? Cette action est définitive.`

    if (!(await demanderConfirmation(message))) return

    try {
      await deleteMatiere(noeud.id)
      await recharger()
    } catch (err) {
      alert('Erreur : ' + err.message)
    }
  }

  // --- Recherche ---
  function noeudCorrespond(noeud, racineNom, sousMatiereAncestorNom, profondeur, chemin) {
    const cheminCourant = [...chemin, noeud.id]
    let correspond = noeud.nom.toLowerCase().includes(terme)

    if (estCours(noeud, profondeur)) {
      if (!correspond) {
        const contenu = contenuDuCours(racineNom, sousMatiereAncestorNom, noeud.nom, noeud.id)
        correspond =
          contenu.fiches.some((f) => f.titre.toLowerCase().includes(terme)) ||
          contenu.cas.some((c) => c.question.toLowerCase().includes(terme)) ||
          contenu.qcm.some((q) => q.titre.toLowerCase().includes(terme))
      }
    } else if (noeud.enfants.length > 0) {
      const sousMatierePourEnfants = profondeur === 0 ? null : noeud.nom
      const unEnfantCorrespond = noeud.enfants
        .map((e) => noeudCorrespond(e, racineNom, sousMatierePourEnfants, profondeur + 1, cheminCourant))
        .some(Boolean)
      correspond = correspond || unEnfantCorrespond
    }

    if (correspond) cheminCourant.forEach((id) => expandedIds.add(id))
    return correspond
  }

  // Aperçu du contenu réel d'un élément (matière/cours + extrait) : plusieurs cas/QCM partagent
  // souvent le même titre générique ("Quels signes reconnaissez-vous…"), impossible à
  // distinguer par leur seul nom — sert dans la popup 👁 et dans l'entête de "Assigner".
  function apercuContenu(type, item) {
    if (type === 'fiches') {
      const chemin = `${item.matiere}${item.sous_matiere ? ' › ' + item.sous_matiere : ''}${item.cours ? ' › ' + item.cours : ''}`
      const valeurs = Object.values(item.contenu_structure || {}).find((v) => (Array.isArray(v) ? v.length : v))
      const extrait = Array.isArray(valeurs) ? valeurs.slice(0, 3).join(' · ') : valeurs
      return `
        <p class="settings-desc">${escapeHtml(chemin)}</p>
        ${item.tags?.length ? `<div class="tags">${item.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${extrait ? `<p style="margin-top: 10px; font-size: 13px;">${escapeHtml(String(extrait)).slice(0, 300)}</p>` : ''}
      `
    }
    if (type === 'cas') {
      const chemin = `${item.matiere}${item.cours ? ' › ' + item.cours : ''} · niveau ${item.niveau}`
      return `
        <p class="settings-desc">${escapeHtml(chemin)}</p>
        <p style="margin-top: 10px; font-size: 13px;">${escapeHtml(item.enonce?.situation || '').slice(0, 300)}</p>
      `
    }
    const chemin = `${(item.matieres || []).join(', ')}${item.cours ? ' › ' + item.cours : ''}`
    const premiereQuestion = item.questions?.[0]?.enonce
    return `
      <p class="settings-desc">${escapeHtml(chemin)} · ${item.questions?.length || 0} question${item.questions?.length !== 1 ? 's' : ''}</p>
      ${premiereQuestion ? `<p style="margin-top: 10px; font-size: 13px;">${escapeHtml(premiereQuestion).slice(0, 300)}</p>` : ''}
    `
  }

  const apercuOverlay = document.getElementById('apercu-modal-overlay')
  document.getElementById('apercu-modal-close').addEventListener('click', () => apercuOverlay.classList.add('hidden'))
  apercuOverlay.addEventListener('click', (e) => {
    if (e.target === apercuOverlay) apercuOverlay.classList.add('hidden')
  })

  function ouvrirApercu(type, item) {
    if (!item) return
    document.getElementById('apercu-modal-title').textContent = type === 'cas' ? item.question : item.titre
    document.getElementById('apercu-modal-content').innerHTML = apercuContenu(type, item)
    apercuOverlay.classList.remove('hidden')
  }

  function wirerBoutonsApercu(root) {
    root.querySelectorAll('[data-apercu-type]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        ouvrirApercu(btn.dataset.apercuType, itemParId(btn.dataset.apercuType, btn.dataset.apercuId))
      })
    })
  }

  const LIMITE_APERCU = 6
  let popupCompteur = 0

  function ligneItem(item) {
    const lien =
      item._type === 'fiches'
        ? `<a href="#fiche/${item.id}" class="org-content-item">${escapeHtml(item.titre)}${item._attache ? ' 🔗' : ''}</a>`
        : item._type === 'cas'
          ? `<a href="#entrainement/${item.id}" class="org-content-item">${escapeHtml(item.question)}${item._attache ? ' 🔗' : ''}</a>`
          : `<a href="#qcm-detail/${item.id}" class="org-content-item">${escapeHtml(item.titre)}${item._attache ? ' 🔗' : ''}</a>`
    return `<div class="org-content-row">${lien}<button type="button" class="org-action-btn" data-apercu-type="${item._type}" data-apercu-id="${item.id}" title="Aperçu">👁</button><button type="button" class="org-item-assign-btn" data-assigner-type="${item._type}" data-assigner-id="${item.id}" title="Déplacer / attacher ailleurs">⇄</button></div>`
  }

  function groupeContenu(items, type, titre) {
    if (items.length === 0) return ''
    const itemsTypes = items.map((i) => ({ ...i, _type: type }))
    const apercu = itemsTypes.slice(0, LIMITE_APERCU)
    let voirPlus = ''
    if (itemsTypes.length > LIMITE_APERCU) {
      popupCompteur += 1
      const cle = `popup-${popupCompteur}`
      popupListes[cle] = { titre, items: itemsTypes }
      voirPlus = `<button type="button" class="org-content-item org-voir-plus" data-voir-plus="${cle}">Voir les ${itemsTypes.length} ${titre.toLowerCase()} →</button>`
    }
    return `<div class="org-content-group"><h4>${titre} (${itemsTypes.length})</h4>${apercu.map(ligneItem).join('')}${voirPlus}</div>`
  }

  function blocContenu(contenu) {
    return `
      ${groupeContenu(contenu.fiches, 'fiches', 'Fiches')}
      ${groupeContenu(contenu.cas, 'cas', 'Cas')}
      ${groupeContenu(contenu.qcm, 'qcm', 'QCM')}
    `
  }

  function rendreNoeud(noeud, profondeur, racineNom, sousMatiereAncestorNom) {
    const cours = estCours(noeud, profondeur)
    const ouvert = expandedIds.has(noeud.id)
    const couleur = couleurPourProfondeur(noeud.couleurEffective, profondeur)
    const style = `margin-left: ${profondeur * 22}px;`
    const peutAvoirEnfant = !cours && profondeur < 2

    const actions = `
      <div class="org-actions">
        ${peutAvoirEnfant ? `<button type="button" class="org-action-btn" data-ajouter="${noeud.id}" title="Ajouter un élément ici">+</button>` : ''}
        <button type="button" class="org-action-btn" data-rattacher="${noeud.id}" title="Rattacher du contenu existant ici">🔗</button>
        ${cours ? `<button type="button" class="org-action-btn" data-deplacer-noeud="${noeud.id}" title="Déplacer vers une autre matière/sous-matière">↕</button>` : ''}
        <button type="button" class="org-action-btn" data-editer="${noeud.id}" title="Modifier">✎</button>
        <button type="button" class="org-action-btn org-action-danger" data-supprimer="${noeud.id}" title="Supprimer">🗑</button>
      </div>
    `

    if (cours) {
      const contenu = contenuDuCours(racineNom, sousMatiereAncestorNom, noeud.nom, noeud.id)
      const total = contenu.fiches.length + contenu.cas.length + contenu.qcm.length
      const progression = OPTIONS_PROGRESSION.includes(noeud.progression) ? noeud.progression : 0

      return `
        <div class="org-node" style="${style}">
          <div class="org-row" data-toggle="${noeud.id}">
            <button type="button" class="org-caret ${ouvert ? 'ouvert' : ''}" data-toggle-btn="${noeud.id}">▸</button>
            <span class="org-tab" style="background: ${couleur};"></span>
            <span class="org-nom">${escapeHtml(noeud.nom)}</span>
            <select class="periode-select org-progression" data-progression="${noeud.id}">
              ${OPTIONS_PROGRESSION.map((v) => `<option value="${v}" ${v === progression ? 'selected' : ''}>${v}%</option>`).join('')}
            </select>
            <div class="stat-bar" style="width: 50px; margin: 0; flex-shrink: 0;"><div class="stat-bar-fill" style="width: ${progression}%; background: ${couleur};"></div></div>
            <span class="org-count">${total} élément${total !== 1 ? 's' : ''}</span>
            ${actions}
          </div>
          <div class="org-content ${ouvert ? '' : 'hidden'}">
            ${total === 0 ? `<p class="empty-note">Rien de rattaché à ce cours pour l'instant.</p>` : blocContenu(contenu)}
          </div>
        </div>
      `
    }

    const valide = noeud.enfants.length > 0 && estValide(noeud, profondeur)
    const sousMatierePourEnfants = profondeur === 0 ? null : noeud.nom
    const nbEnfants = noeud.enfants.length

    const nonClasse = profondeur === 0 ? contenuNonClasseRacine(racineNom, noeud.id) : contenuNonClasseSousMatiere(racineNom, noeud.nom, noeud.id)
    const totalNonClasse = nonClasse.fiches.length + nonClasse.cas.length + nonClasse.qcm.length

    return `
      <div class="org-node" style="${style}">
        <div class="org-row" data-toggle="${noeud.id}">
          <button type="button" class="org-caret ${ouvert ? 'ouvert' : ''}" data-toggle-btn="${noeud.id}">▸</button>
          <span class="org-tab" style="background: ${couleur};"></span>
          <span class="org-badge ${valide ? 'valide' : ''}" title="${valide ? 'Validé' : 'Pas encore validé'}">${valide ? '✓' : ''}</span>
          <span class="org-nom">${escapeHtml(noeud.nom)}</span>
          <span class="org-count">${
            nbEnfants === 0 && totalNonClasse === 0
              ? 'vide'
              : [nbEnfants > 0 ? `${nbEnfants} sous-élément${nbEnfants !== 1 ? 's' : ''}` : '', totalNonClasse > 0 ? `${totalNonClasse} directement dedans` : '']
                  .filter(Boolean)
                  .join(' · ')
          }</span>
          ${actions}
        </div>
        <div class="org-children ${ouvert ? '' : 'hidden'}">
          ${
            totalNonClasse > 0
              ? `<div class="org-nonclasse"><span class="org-nonclasse-label">Directement dans « ${escapeHtml(noeud.nom)} » (${totalNonClasse}) — sans cours précis</span>${blocContenu(nonClasse)}</div>`
              : ''
          }
          ${noeud.enfants.map((e) => rendreNoeud(e, profondeur + 1, racineNom, sousMatierePourEnfants)).join('')}
        </div>
      </div>
    `
  }

  function render() {
    popupListes = {}
    popupCompteur = 0
    const racinesVisibles = terme ? arbre.filter((r) => noeudCorrespond(r, r.nom, null, 0, [])) : arbre

    document.getElementById('org-count').textContent = `${arbre.length} matière${arbre.length !== 1 ? 's' : ''}`

    const treeEl = document.getElementById('org-tree')
    if (racinesVisibles.length === 0) {
      treeEl.innerHTML = `<p class="empty-note">${terme ? 'Aucun résultat.' : "Aucune matière pour l'instant — crée-en une avec le bouton ci-dessus."}</p>`
    } else {
      treeEl.innerHTML = racinesVisibles.map((r) => rendreNoeud(r, 0, r.nom, null)).join('')
    }

    treeEl.querySelectorAll('[data-toggle-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = btn.dataset.toggleBtn
        if (expandedIds.has(id)) expandedIds.delete(id)
        else expandedIds.add(id)
        render()
      })
    })

    treeEl.querySelectorAll('[data-toggle]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('select') || e.target.closest('a') || e.target.closest('.org-actions')) return
        const id = row.dataset.toggle
        if (expandedIds.has(id)) expandedIds.delete(id)
        else expandedIds.add(id)
        render()
      })
    })

    treeEl.querySelectorAll('[data-progression]').forEach((select) => {
      select.addEventListener('click', (e) => e.stopPropagation())
      select.addEventListener('change', async (e) => {
        e.stopPropagation()
        const id = select.dataset.progression
        const valeur = parseInt(select.value, 10)
        try {
          await updateMatiere(id, { progression: valeur })
          if (noeudsParId[id]) noeudsParId[id].progression = valeur
          render()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    treeEl.querySelectorAll('[data-ajouter]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const parent = noeudsParId[btn.dataset.ajouter]
        if (!parent) return
        ouvrirModalNoeud({ type: 'creer-enfant', parentId: parent.id, parentNom: parent.nom, parentType: parent.type })
      })
    })

    treeEl.querySelectorAll('[data-editer]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const noeud = noeudsParId[btn.dataset.editer]
        if (!noeud) return
        ouvrirModalNoeud({ type: 'editer', noeud })
      })
    })

    treeEl.querySelectorAll('[data-supprimer]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const noeud = noeudsParId[btn.dataset.supprimer]
        if (noeud) supprimerNoeud(noeud)
      })
    })

    treeEl.querySelectorAll('[data-voir-plus]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        ouvrirPopupContenu(btn.dataset.voirPlus)
      })
    })

    treeEl.querySelectorAll('[data-rattacher]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        ouvrirRattacherModal(btn.dataset.rattacher)
      })
    })

    treeEl.querySelectorAll('[data-deplacer-noeud]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const noeud = noeudsParId[btn.dataset.deplacerNoeud]
        if (!noeud) return
        const profondeur = calculerProfondeur(noeud, noeudsParId)
        const chaine = ancetres(noeud)
        const racineNom = chaine[0]?.nom
        const sousMatiereAncestorNom = chaine.length > 1 ? chaine[1].nom : null
        ouvrirDeplacerNoeudModal(noeud, profondeur, racineNom, sousMatiereAncestorNom)
      })
    })

    wirerBoutonsAssigner(treeEl)
    wirerBoutonsApercu(treeEl)
  }

  async function recharger() {
    const scrollY = window.scrollY
    await renderOrganisation(container)
    window.scrollTo(0, scrollY)
  }

  document.getElementById('org-recherche').value = terme
  document.getElementById('org-recherche').addEventListener('input', (e) => {
    terme = e.target.value.trim().toLowerCase()
    if (terme) expandedIds = new Set()
    render()
  })

  renderOrphelins()
  render()
}
