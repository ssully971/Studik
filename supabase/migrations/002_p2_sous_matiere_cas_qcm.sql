-- P2 — ajoute aux cas cliniques et aux QCM la même granularité "sous-matière" que celle déjà
-- disponible pour les fiches (colonne sous_matiere sur public.fiches). Jusqu'ici, un cas/QCM ne
-- pouvait être rattaché qu'à une matière ou à un cours, jamais directement à une sous-matière
-- sans cours (ex. un sujet d'annale ou un ED qui concerne toute une sous-matière) — voir
-- docs/externat/DECISIONS.md.
--
-- Idempotent (add column if not exists), rejouable sans erreur.
--
-- À appliquer dans l'éditeur SQL Supabase. Aucune table Externat n'est concernée.

alter table public.cas_cliniques add column if not exists sous_matiere text;
alter table public.qcm add column if not exists sous_matiere text;
