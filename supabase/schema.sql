-- =====================================================================
--  Fonte : schéma Supabase
--  À coller en entier dans Supabase > SQL Editor > New query > Run.
--  Le script peut être relancé sans risque (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
--    Chaque ligne appartient à un utilisateur (user_id).
--    updated_at : horodatage de la dernière modification côté appareil
--    synced_at  : horodatage serveur, sert de curseur de synchronisation
--    deleted    : suppression logique, pour propager les suppressions
-- ---------------------------------------------------------------------

create table if not exists public.exercises (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  muscle      text,
  equipment   text,
  increment   numeric,
  notes       text,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now()
);

create table if not exists public.templates (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  position    integer,
  items       jsonb not null default '[]'::jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now()
);

create table if not exists public.workouts (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id  uuid,
  name         text,
  started_at   timestamptz not null,
  ended_at     timestamptz,
  notes        text,
  items        jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,
  synced_at    timestamptz not null default now()
);

create table if not exists public.bodyweights (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  weight      numeric,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (user_id, day)
);

-- Index pour la synchronisation (lecture des lignes modifiées depuis X)
create index if not exists exercises_sync_idx   on public.exercises   (user_id, synced_at);
create index if not exists templates_sync_idx   on public.templates   (user_id, synced_at);
create index if not exists workouts_sync_idx    on public.workouts    (user_id, synced_at);
create index if not exists bodyweights_sync_idx on public.bodyweights (user_id, synced_at);

-- ---------------------------------------------------------------------
-- 2. Trigger de synchronisation
--    - pose synced_at à l'heure du serveur à chaque écriture
--    - « la dernière modification gagne » : une version plus ancienne
--      envoyée par un appareil resté hors ligne n'écrase pas une version
--      plus récente déjà enregistrée
-- ---------------------------------------------------------------------

create or replace function public.fonte_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- on garde la version existante, plus récente
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['exercises', 'templates', 'workouts', 'bodyweights'] loop
    execute format('drop trigger if exists fonte_before_write on public.%I', t);
    execute format(
      'create trigger fonte_before_write before insert or update on public.%I
         for each row execute function public.fonte_before_write()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Sécurité : Row Level Security
--    Chaque utilisateur connecté ne lit et n'écrit que ses propres lignes.
--    Les visiteurs non connectés (rôle anon) n'ont accès à rien.
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['exercises', 'templates', 'workouts', 'bodyweights'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Mes lignes uniquement" on public.%I', t);
    execute format(
      'create policy "Mes lignes uniquement" on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
