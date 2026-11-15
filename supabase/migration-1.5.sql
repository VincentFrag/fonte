-- Fonte 1.5 : lien de vidéo de technique propre à chaque exercice.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run,
-- AVANT d'envoyer la version 1.5 de l'app sur GitHub.
-- (Inutile pour une nouvelle installation : supabase/schema.sql contient déjà cette colonne.)
alter table public.exercises add column if not exists video_url text;
