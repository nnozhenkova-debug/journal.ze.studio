-- Журнал студии — схема базы данных Supabase.
-- Выполните этот файл целиком в Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Безопасно выполнять повторно на уже существующем проекте (использует
-- if not exists / on conflict do nothing везде, где это возможно).

-- =====================================================================
-- 1. Профили
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text default 'Участник команды',
  status text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

alter table public.profiles add column if not exists role text default 'Участник команды';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists notification_prefs jsonb not null default '{"retro_reminders": true, "issue_updates": true, "weekly_digest": false}'::jsonb;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles updatable by owner" on public.profiles;
create policy "profiles updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- =====================================================================
-- 2. Ограничение регистрации доменом студии.
-- Поменяйте 'ze.studio' здесь, если домен почты команды другой.
-- =====================================================================
create or replace function public.enforce_org_domain()
returns trigger as $$
begin
  if new.email is null or right(lower(new.email), length('@ze.studio')) <> '@ze.studio' then
    raise exception 'Вход доступен только с адресов @ze.studio';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_org_domain_trigger on auth.users;
create trigger enforce_org_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_org_domain();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 3. Проекты
-- =====================================================================
create table if not exists public.projects (
  id text primary key,
  name text not null,
  shortcode text,
  client text,
  color_key text not null default 'slate' check (color_key in ('amber', 'violet', 'slate', 'teal', 'rose')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;

drop policy if exists "projects readable by authenticated" on public.projects;
create policy "projects readable by authenticated"
  on public.projects for select using (auth.role() = 'authenticated');
drop policy if exists "projects writable by authenticated" on public.projects;
create policy "projects writable by authenticated"
  on public.projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =====================================================================
-- 4. Этапы проекта
-- =====================================================================
create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  state text not null default 'upcoming' check (state in ('past', 'current', 'upcoming')),
  planned_minutes integer not null default 0,
  actual_minutes integer not null default 0,
  sort_order integer not null default 0
);
alter table public.project_stages enable row level security;

drop policy if exists "stages readable by authenticated" on public.project_stages;
create policy "stages readable by authenticated"
  on public.project_stages for select using (auth.role() = 'authenticated');
drop policy if exists "stages writable by authenticated" on public.project_stages;
create policy "stages writable by authenticated"
  on public.project_stages for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists project_stages_project_idx on public.project_stages (project_id);

-- =====================================================================
-- 5. Ретро
-- =====================================================================
create table if not exists public.retros (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  stage_id uuid references public.project_stages(id) on delete set null,
  template text not null check (template in (
    'start_stop_continue', '4l', 'mad_sad_glad', 'sailboat', 'daki', 'team_energy'
  )),
  title text not null,
  scheduled_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  stage_context jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.retros enable row level security;

alter table public.retros add column if not exists published boolean not null default false;
alter table public.retros add column if not exists published_at timestamptz;

drop policy if exists "retros readable by authenticated" on public.retros;
create policy "retros readable by authenticated"
  on public.retros for select using (auth.role() = 'authenticated');
drop policy if exists "retros writable by authenticated" on public.retros;
create policy "retros writable by authenticated"
  on public.retros for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists retros_project_idx on public.retros (project_id);
create index if not exists retros_date_idx on public.retros (scheduled_date);

create table if not exists public.retro_participants (
  retro_id uuid not null references public.retros(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (retro_id, user_id)
);
alter table public.retro_participants enable row level security;
drop policy if exists "retro_participants readable by authenticated" on public.retro_participants;
create policy "retro_participants readable by authenticated"
  on public.retro_participants for select using (auth.role() = 'authenticated');
drop policy if exists "retro_participants writable by authenticated" on public.retro_participants;
create policy "retro_participants writable by authenticated"
  on public.retro_participants for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists public.retro_notes (
  id uuid primary key default gen_random_uuid(),
  retro_id uuid not null references public.retros(id) on delete cascade,
  column_key text not null,
  text text not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.retro_notes enable row level security;
drop policy if exists "retro_notes readable by authenticated" on public.retro_notes;
create policy "retro_notes readable by authenticated"
  on public.retro_notes for select using (auth.role() = 'authenticated');
drop policy if exists "retro_notes writable by authenticated" on public.retro_notes;
create policy "retro_notes writable by authenticated"
  on public.retro_notes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists retro_notes_retro_idx on public.retro_notes (retro_id);

-- =====================================================================
-- 6. Проблемы
-- =====================================================================
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'important' check (severity in ('critical', 'important', 'watch')),
  responsible_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.issues enable row level security;

drop policy if exists "issues readable by authenticated" on public.issues;
create policy "issues readable by authenticated"
  on public.issues for select using (auth.role() = 'authenticated');
drop policy if exists "issues writable by authenticated" on public.issues;
create policy "issues writable by authenticated"
  on public.issues for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists issues_project_idx on public.issues (project_id);
create index if not exists issues_status_idx on public.issues (status);

-- =====================================================================
-- 7. Лента событий
-- =====================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete set null,
  type text not null check (type in ('retro_completed', 'issue_resolved', 'issue_created', 'note')),
  title text not null,
  subtitle text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

drop policy if exists "events readable by authenticated" on public.events;
create policy "events readable by authenticated"
  on public.events for select using (auth.role() = 'authenticated');
drop policy if exists "events writable by authenticated" on public.events;
create policy "events writable by authenticated"
  on public.events for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists events_created_idx on public.events (created_at desc);

-- Realtime — чтобы изменения одного человека сразу видели остальные
-- (важно для живой ретро-сессии).
do $$
begin
  alter publication supabase_realtime add table public.retros;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.retro_notes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.issues;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- 8. Затравочные данные — можно удалить из интерфейса после того,
--    как появятся настоящие проекты.
-- =====================================================================
insert into public.projects (id, name, shortcode, client, color_key)
values
  ('avrora', 'Аврора', 'АВР', 'Внешний клиент', 'amber'),
  ('nova', 'Нова', 'НОВ', 'Внешний клиент', 'violet'),
  ('ze-studio', 'ze.studio', 'ZE', null, 'slate')
on conflict (id) do nothing;

insert into public.project_stages (project_id, name, start_date, end_date, state, planned_minutes, actual_minutes, sort_order)
values
  ('avrora', 'Концепт (исследование + UI-концепция)', '2026-09-01', '2026-09-20', 'past', 2400, 2340, 1),
  ('avrora', 'Проработка логики (UI)', '2026-09-21', '2026-10-10', 'current', 2400, 2040, 2),
  ('avrora', 'UI-kit', '2026-10-11', '2026-10-24', 'upcoming', 1440, 0, 3)
on conflict do nothing;

insert into public.issues (project_id, title, description, severity, status, created_at)
values
  ('avrora', 'Просрочены правки по проекту «Аврора»', 'Клиент не прислал комментарии по макетам уже 2 дня.', 'critical', 'open', now() - interval '2 days'),
  ('nova', 'Не назначен ответственный за бриф «Нова»', null, 'important', 'open', now() - interval '1 day'),
  ('ze-studio', 'Клиент не согласовал смету — 5 дней без ответа', null, 'important', 'open', now() - interval '5 days')
on conflict do nothing;

insert into public.events (project_id, type, title, subtitle, created_at)
values
  ('avrora', 'retro_completed', 'Завершено ретро «Спринт 14»', 'Участники: Аня К., Максим Р., Лена Б.', now() - interval '3 hours'),
  ('avrora', 'issue_resolved', 'Проблема «Просрочены правки» помечена решённой', 'Изменил: Максим Р.', now() - interval '1 day'),
  ('nova', 'retro_completed', 'Завершено ретро «Онбординг клиента»', 'Участники: Аня К., Лена Б.', now() - interval '4 days')
on conflict do nothing;
