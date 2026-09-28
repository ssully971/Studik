-- Externat V2 — lot 1 : fondations.
-- Crée tout le schéma décrit au §4 de docs/externat/SPEC-EXTERNAT-V2.md, y compris les tables
-- utilisées seulement à partir des lots suivants (§4 : "Tu crées tout le schéma dès le lot 1,
-- même pour les fonctionnalités des lots suivants, afin de ne jamais refondre le schéma en
-- cours de route.").
--
-- Idempotent : peut être rejoué sans erreur (create table if not exists, add column if not
-- exists, drop policy if exists + create policy, create index if not exists).
--
-- Aucune table P2 existante n'est modifiée. Le mode P2 ne dépend d'aucune de ces tables.
--
-- À appliquer dans l'éditeur SQL Supabase — voir docs/externat/A-FAIRE-SULLIVAN.md.

-- ============================================================================
-- 4.1 Référentiels R2C
-- ============================================================================

create table if not exists public.r2c_items (
  numero int primary key,
  intitule text not null,
  specialites text[] not null default '{}',
  prioritaire boolean not null default false,
  notes text
);

create table if not exists public.r2c_sdd (
  numero int primary key,
  intitule text not null,
  famille text
);

-- ============================================================================
-- 4.2 Questions et dossiers
-- ============================================================================

create table if not exists public.edn_dossiers (
  id text primary key,
  type text not null check (type in ('DP', 'KFP', 'TCS', 'LCA')),
  titre text not null,
  sdd int[] not null default '{}',
  items int[] not null default '{}',
  specialites text[] not null default '{}',
  vignette text,
  article_url text,
  source text not null check (source in ('annale', 'entrainement', 'genere')),
  date_reference date,
  tags text[] not null default '{}',
  statut text not null default 'brouillon',
  -- "Signaler une erreur" (même principe que fiches.a_corriger/note_correction, voir §7.3).
  -- Décision : ajoutée aussi sur edn_questions (pas seulement les dossiers), voir DECISIONS.md.
  a_corriger boolean not null default false,
  note_correction text,
  date_creation timestamptz not null default now()
);

create table if not exists public.edn_questions (
  id text primary key,
  dossier_id text references public.edn_dossiers (id) on delete cascade,
  ordre int,
  format text not null check (format in ('QRU', 'QRM', 'QRP', 'QRP_LONG', 'QROC', 'ZAP', 'TCS')),
  rang text not null check (rang in ('A', 'B')),
  items int[] not null default '{}',
  sdd int[] not null default '{}',
  specialites text[] not null default '{}',
  enonce text not null,
  image text,
  contenu jsonb not null default '{}'::jsonb,
  explication text,
  source text not null check (source in ('annale', 'entrainement', 'genere')),
  date_reference date,
  tags text[] not null default '{}',
  statut text not null default 'brouillon',
  a_corriger boolean not null default false,
  note_correction text,
  date_creation timestamptz not null default now()
);

-- ============================================================================
-- 4.3 Tentatives et répétition espacée
-- ============================================================================

create table if not exists public.edn_tentatives (
  id uuid primary key, -- généré côté client (crypto.randomUUID()), voir §8 lot 8 (idempotence hors-ligne)
  cible text not null, -- 'q:<id>' ou 'd:<id>'
  mode text not null check (mode in ('entrainement', 'examen', 'flash')),
  reponses jsonb not null default '{}'::jsonb,
  score numeric not null,
  score_max numeric not null,
  detail jsonb,
  duree_s int,
  tags_erreur text[] not null default '{}',
  date_tentative timestamptz not null
);

create table if not exists public.edn_srs (
  cible text primary key,
  etape int not null default 0,
  prochaine_revision date,
  reussites_parfaites_consecutives int not null default 0,
  derniere_revision timestamptz,
  suspendue boolean not null default false
);

-- ============================================================================
-- 4.4 ECOS et constantes
-- ============================================================================

create table if not exists public.ecos_stations (
  id text primary key,
  titre text not null,
  sdd int[] not null default '{}',
  domaine text not null,
  interlocuteur text not null check (interlocuteur in ('PS', 'PSS', 'aucun')),
  vignette text,
  consignes_examinateur text,
  script_interlocuteur text,
  documents jsonb not null default '[]'::jsonb,
  grille jsonb not null default '{}'::jsonb,
  source text not null check (source in ('annale', 'entrainement', 'genere')),
  tags text[] not null default '{}',
  statut text not null default 'brouillon',
  date_creation timestamptz not null default now()
);

create table if not exists public.ecos_tentatives (
  id uuid primary key,
  station_id text references public.ecos_stations (id) on delete cascade,
  mode text not null check (mode in ('solo', 'binome')),
  cochees jsonb not null default '{}'::jsonb,
  score numeric,
  score_max numeric,
  global int,
  duree_s int,
  notes text,
  date_tentative timestamptz not null
);

create table if not exists public.constantes_bio (
  id text primary key,
  categorie text not null,
  parametre text not null,
  valeur_normale text not null,
  unite text,
  ordre int not null default 0
);

-- ============================================================================
-- Colonnes ajoutées après une première application (idempotent sur une base déjà migrée)
-- ============================================================================

alter table public.edn_dossiers add column if not exists a_corriger boolean not null default false;
alter table public.edn_dossiers add column if not exists note_correction text;
alter table public.edn_questions add column if not exists a_corriger boolean not null default false;
alter table public.edn_questions add column if not exists note_correction text;

-- ============================================================================
-- Index
-- ============================================================================

create index if not exists idx_edn_questions_dossier_ordre on public.edn_questions (dossier_id, ordre);
create index if not exists idx_edn_srs_prochaine_revision on public.edn_srs (prochaine_revision);
create index if not exists idx_edn_tentatives_cible_date on public.edn_tentatives (cible, date_tentative);

create index if not exists idx_edn_dossiers_items on public.edn_dossiers using gin (items);
create index if not exists idx_edn_dossiers_sdd on public.edn_dossiers using gin (sdd);
create index if not exists idx_edn_dossiers_tags on public.edn_dossiers using gin (tags);
create index if not exists idx_edn_questions_items on public.edn_questions using gin (items);
create index if not exists idx_edn_questions_sdd on public.edn_questions using gin (sdd);
create index if not exists idx_edn_questions_tags on public.edn_questions using gin (tags);
create index if not exists idx_ecos_stations_sdd on public.ecos_stations using gin (sdd);
create index if not exists idx_ecos_stations_tags on public.ecos_stations using gin (tags);

-- ============================================================================
-- RLS + policies + grants (un seul utilisateur authentifié, même principe que les tables P2 :
-- accès complet pour le rôle "authenticated", refusé pour "anon" — voir scripts/audit-rls.mjs)
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'r2c_items', 'r2c_sdd', 'edn_dossiers', 'edn_questions', 'edn_tentatives', 'edn_srs',
    'ecos_stations', 'ecos_tentatives', 'constantes_bio'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format('create policy "authenticated_all" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
