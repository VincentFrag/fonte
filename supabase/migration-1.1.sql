-- Fonte 1.1 : poids de barre propre à chaque exercice.
-- À exécuter une fois dans Supabase > SQL Editor > New query > Run,
-- AVANT d'envoyer la version 1.1 de l'app sur GitHub.
alter table public.exercises add column if not exists bar_weight numeric;
