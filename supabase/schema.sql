-- =====================================================================
--  Fonte : schéma Supabase
--  À coller en entier dans Supabase > SQL Editor > New query > Run.
--  Le script ne supprime rien et peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables, avec la sécurité au niveau des lignes (RLS) activée
--    juste après chaque création.
--    user_id    : propriétaire de la ligne
--    updated_at : dernière modification côté appareil
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
alter table public.exercises enable row level security;

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
alter table public.templates enable row level security;

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
alter table public.workouts enable row level security;

create table if not exists public.bodyweights (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  weight      numeric,
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.bodyweights enable row level security;

-- Index pour la synchronisation (lecture des lignes modifiées depuis X)
create index if not exists exercises_sync_idx   on public.exercises   (user_id, synced_at);
create index if not exists templates_sync_idx   on public.templates   (user_id, synced_at);
create index if not exists workouts_sync_idx    on public.workouts    (user_id, synced_at);
create index if not exists bodyweights_sync_idx on public.bodyweights (user_id, synced_at);

-- ---------------------------------------------------------------------
-- 2. Règles d'accès : chaque utilisateur connecté ne lit et n'écrit
--    que ses propres lignes. Aucune règle pour les visiteurs non
--    connectés (rôle anon) : ils n'ont accès à rien.
--    (Postgres n'a pas de « create or replace policy » : chaque règle
--    n'est créée que si elle n'existe pas encore.)
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'exercises' and policyname = 'Mes lignes uniquement') then
    create policy "Mes lignes uniquement" on public.exercises for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'templates' and policyname = 'Mes lignes uniquement') then
    create policy "Mes lignes uniquement" on public.templates for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workouts' and policyname = 'Mes lignes uniquement') then
    create policy "Mes lignes uniquement" on public.workouts for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bodyweights' and policyname = 'Mes lignes uniquement') then
    create policy "Mes lignes uniquement" on public.bodyweights for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end;
$$;

grant select, insert, update, delete on public.exercises   to authenticated;
grant select, insert, update, delete on public.templates   to authenticated;
grant select, insert, update, delete on public.workouts    to authenticated;
grant select, insert, update, delete on public.bodyweights to authenticated;

-- ---------------------------------------------------------------------
-- 3. Trigger de synchronisation
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

create or replace trigger fonte_before_write before insert or update on public.exercises
  for each row execute function public.fonte_before_write();
create or replace trigger fonte_before_write before insert or update on public.templates
  for each row execute function public.fonte_before_write();
create or replace trigger fonte_before_write before insert or update on public.workouts
  for each row execute function public.fonte_before_write();
create or replace trigger fonte_before_write before insert or update on public.bodyweights
  for each row execute function public.fonte_before_write();

-- ---------------------------------------------------------------------
-- 4. Vérification : les 4 lignes doivent afficher rls_active = true
--    et regles = 1.
-- ---------------------------------------------------------------------

select c.relname as table_name,
       c.relrowsecurity as rls_active,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as regles
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('exercises', 'templates', 'workouts', 'bodyweights')
order by c.relname;
