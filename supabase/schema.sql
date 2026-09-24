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
alter table public.profiles add column if not exists timezone text not null default 'Москва, UTC+3';
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- =====================================================================
-- 1b. Функция-хелпер: является ли текущий пользователь администратором.
-- Используется в политиках доступа ниже. security definer + search_path,
-- чтобы работать надёжно независимо от политик select на profiles.
-- Определена до первой политики, которая её использует.
-- =====================================================================
create or replace function public.is_admin()
returns boolean as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$ language sql stable security definer set search_path = public;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles updatable by owner" on public.profiles;
drop policy if exists "profiles updatable by owner or admin" on public.profiles;
create policy "profiles updatable by owner or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- =====================================================================
-- 2. Ограничение регистрации доменом студии — отключено по просьбе:
-- теперь можно приглашать участников с любой почтой, не только @ze.studio.
-- Эти строки только снимают ограничение (для тех, у кого схема уже была
-- накатана раньше); саму функцию/триггер не пересоздаём. Если понадобится
-- вернуть домен-гейт обратно — просто восстановите старый триггер.
-- =====================================================================
drop trigger if exists enforce_org_domain_trigger on auth.users;
drop function if exists public.enforce_org_domain();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Приглашённые через Admin API (inviteUserByEmail) пользователи заводятся
  -- Supabase'ом с заполненным invited_at ещё до того, как человек установил
  -- пароль — таким профилям сразу ставим статус «invited», а не «active».
  insert into public.profiles (id, email, display_name, status)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    case when new.invited_at is not null then 'invited' else 'active' end
  )
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
  responsible_id uuid references auth.users(id) on delete set null,
  budget_used_percent integer check (budget_used_percent between 0 and 100),
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;

alter table public.projects add column if not exists responsible_id uuid references auth.users(id) on delete set null;
alter table public.projects add column if not exists budget_used_percent integer check (budget_used_percent between 0 and 100);

drop policy if exists "projects readable by authenticated" on public.projects;
create policy "projects readable by authenticated"
  on public.projects for select using (auth.role() = 'authenticated');
drop policy if exists "projects writable by authenticated" on public.projects;
drop policy if exists "projects writable by admin" on public.projects;
create policy "projects writable by admin"
  on public.projects for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 3b. Участники проекта (для карточки «Команда проекта»)
-- =====================================================================
create table if not exists public.project_members (
  project_id text not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;

drop policy if exists "project_members readable by authenticated" on public.project_members;
create policy "project_members readable by authenticated"
  on public.project_members for select using (auth.role() = 'authenticated');
drop policy if exists "project_members writable by authenticated" on public.project_members;
drop policy if exists "project_members writable by admin" on public.project_members;
create policy "project_members writable by admin"
  on public.project_members for all using (public.is_admin()) with check (public.is_admin());

create index if not exists project_members_project_idx on public.project_members (project_id);

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
drop policy if exists "stages writable by admin" on public.project_stages;
create policy "stages writable by admin"
  on public.project_stages for all using (public.is_admin()) with check (public.is_admin());

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
-- Разбито на insert/update (доступны любому участнику студии — ретро
-- коллаборативное) и delete (только автор или админ, чтобы никто не мог
-- стереть чужую ретро-сессию через прямой запрос к API).
drop policy if exists "retros insertable by authenticated" on public.retros;
create policy "retros insertable by authenticated"
  on public.retros for insert with check (auth.role() = 'authenticated');
drop policy if exists "retros updatable by authenticated" on public.retros;
create policy "retros updatable by authenticated"
  on public.retros for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "retros deletable by creator or admin" on public.retros;
create policy "retros deletable by creator or admin"
  on public.retros for delete using (created_by = auth.uid() or public.is_admin());

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
-- Присоединиться к ретро можно только от своего имени.
drop policy if exists "retro_participants insertable by self" on public.retro_participants;
create policy "retro_participants insertable by self"
  on public.retro_participants for insert with check (user_id = auth.uid());
drop policy if exists "retro_participants deletable by self or admin" on public.retro_participants;
create policy "retro_participants deletable by self or admin"
  on public.retro_participants for delete using (user_id = auth.uid() or public.is_admin());

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
-- insert — только от своего имени (author_id обязан совпадать с текущим
-- пользователем, иначе можно было бы подписать заметку чужим именем);
-- delete/update — автор заметки или админ.
drop policy if exists "retro_notes insertable by author" on public.retro_notes;
create policy "retro_notes insertable by author"
  on public.retro_notes for insert with check (author_id = auth.uid());
drop policy if exists "retro_notes updatable by author or admin" on public.retro_notes;
create policy "retro_notes updatable by author or admin"
  on public.retro_notes for update using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
drop policy if exists "retro_notes deletable by author or admin" on public.retro_notes;
create policy "retro_notes deletable by author or admin"
  on public.retro_notes for delete using (author_id = auth.uid() or public.is_admin());

create index if not exists retro_notes_retro_idx on public.retro_notes (retro_id);

create table if not exists public.retro_action_items (
  id uuid primary key default gen_random_uuid(),
  retro_id uuid not null references public.retros(id) on delete cascade,
  text text not null,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.retro_action_items enable row level security;
drop policy if exists "retro_action_items readable by authenticated" on public.retro_action_items;
create policy "retro_action_items readable by authenticated"
  on public.retro_action_items for select using (auth.role() = 'authenticated');
drop policy if exists "retro_action_items writable by authenticated" on public.retro_action_items;
create policy "retro_action_items writable by authenticated"
  on public.retro_action_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists retro_action_items_retro_idx on public.retro_action_items (retro_id);

do $$
begin
  alter publication supabase_realtime add table public.retro_action_items;
exception when duplicate_object then null;
end $$;

-- Отметки уровня энергии участников — для шаблона «Энергия команды».
create table if not exists public.retro_energy (
  retro_id uuid not null references public.retros(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('high', 'neutral', 'low')),
  updated_at timestamptz not null default now(),
  primary key (retro_id, user_id)
);
alter table public.retro_energy enable row level security;
drop policy if exists "retro_energy readable by authenticated" on public.retro_energy;
create policy "retro_energy readable by authenticated"
  on public.retro_energy for select using (auth.role() = 'authenticated');
drop policy if exists "retro_energy writable by authenticated" on public.retro_energy;
-- Свой уровень энергии можно только отмечать/менять от своего имени
-- (upsert из клиента = insert + update, поэтому нужны обе политики).
drop policy if exists "retro_energy insertable by self" on public.retro_energy;
create policy "retro_energy insertable by self"
  on public.retro_energy for insert with check (user_id = auth.uid());
drop policy if exists "retro_energy updatable by self" on public.retro_energy;
create policy "retro_energy updatable by self"
  on public.retro_energy for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "retro_energy deletable by self or admin" on public.retro_energy;
create policy "retro_energy deletable by self or admin"
  on public.retro_energy for delete using (user_id = auth.uid() or public.is_admin());

create index if not exists retro_energy_retro_idx on public.retro_energy (retro_id);

do $$
begin
  alter publication supabase_realtime add table public.retro_energy;
exception when duplicate_object then null;
end $$;

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
drop policy if exists "issues writable by admin" on public.issues;
create policy "issues writable by admin"
  on public.issues for all using (public.is_admin()) with check (public.is_admin());

create index if not exists issues_project_idx on public.issues (project_id);
create index if not exists issues_status_idx on public.issues (status);

-- =====================================================================
-- 7. Лента событий
-- =====================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete set null,
  type text not null check (type in ('retro_completed', 'issue_resolved', 'issue_created', 'project_updated', 'note')),
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
-- insert — при публикации ретро запись в ленту добавляет любой участник;
-- менять/удалять прошлые записи ленты событий может только админ.
drop policy if exists "events insertable by authenticated" on public.events;
create policy "events insertable by authenticated"
  on public.events for insert with check (auth.role() = 'authenticated');
drop policy if exists "events updatable by admin" on public.events;
create policy "events updatable by admin"
  on public.events for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "events deletable by admin" on public.events;
create policy "events deletable by admin"
  on public.events for delete using (public.is_admin());

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
-- 7b. Обновление CHECK-ограничений на уже существующих таблицах.
-- "create table if not exists" не трогает ограничения таблицы, если она
-- уже была создана раньше (например, до того как в список допустимых
-- значений добавили новый вариант) — поэтому здесь они пересоздаются
-- явно, чтобы всегда совпадать с этим файлом, а не с тем, что было
-- в базе при первом запуске схемы.
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active', 'invited'));

alter table public.projects drop constraint if exists projects_color_key_check;
alter table public.projects add constraint projects_color_key_check check (color_key in ('amber', 'violet', 'slate', 'teal', 'rose'));
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (status in ('active', 'archived'));
alter table public.projects drop constraint if exists projects_budget_used_percent_check;
alter table public.projects add constraint projects_budget_used_percent_check check (budget_used_percent between 0 and 100);

alter table public.project_stages drop constraint if exists project_stages_state_check;
alter table public.project_stages add constraint project_stages_state_check check (state in ('past', 'current', 'upcoming'));

alter table public.retros drop constraint if exists retros_template_check;
alter table public.retros add constraint retros_template_check check (template in (
  'start_stop_continue', '4l', 'mad_sad_glad', 'sailboat', 'daki', 'team_energy'
));
alter table public.retros drop constraint if exists retros_status_check;
alter table public.retros add constraint retros_status_check check (status in ('scheduled', 'in_progress', 'completed'));

alter table public.retro_energy drop constraint if exists retro_energy_level_check;
alter table public.retro_energy add constraint retro_energy_level_check check (level in ('high', 'neutral', 'low'));

alter table public.issues drop constraint if exists issues_severity_check;
alter table public.issues add constraint issues_severity_check check (severity in ('critical', 'important', 'watch'));
alter table public.issues drop constraint if exists issues_status_check;
alter table public.issues add constraint issues_status_check check (status in ('open', 'resolved'));

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in ('retro_completed', 'issue_resolved', 'issue_created', 'project_updated', 'note'));

-- =====================================================================
-- 8. Затравочные данные — можно удалить из интерфейса после того,
--    как появятся настоящие проекты.
-- =====================================================================
insert into public.projects (id, name, shortcode, client, color_key, budget_used_percent)
values
  ('avrora', 'Аврора', 'АВР', 'Внешний клиент', 'amber', 65),
  ('nova', 'Нова', 'НОВ', 'Внешний клиент', 'violet', 40),
  ('ze-studio', 'ze.studio', 'ZE', null, 'slate', null)
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
  ('avrora', 'issue_resolved', 'Проблема «Просрочены правки» помечена решённой', 'Изменил: Максим Р.', now() - interval '5 hours'),
  ('avrora', 'project_updated', 'Спринт 16 добавлен в план проекта «Аврора»', 'Изменил: Максим Р.', now() - interval '9 hours'),
  ('nova', 'issue_created', 'Не назначен ответственный за бриф «Нова»', 'Автор: Аня К.', now() - interval '1 day'),
  ('nova', 'project_updated', 'Ответственный по «Нова» изменён на Лену Б.', 'Изменил: Аня К.', now() - interval '1 day' - interval '2 hours'),
  ('nova', 'retro_completed', 'Завершено ретро «Онбординг клиента»', 'Участники: Аня К., Лена Б.', now() - interval '3 days'),
  ('avrora', 'project_updated', 'Бюджет проекта «Аврора» скорректирован', 'Изменил: Аня К.', now() - interval '3 days' - interval '4 hours'),
  ('nova', 'project_updated', 'Добавлен участник Максим Р. в проект «Нова»', 'Изменил: Лена Б.', now() - interval '5 days'),
  ('ze-studio', 'issue_resolved', 'Проблема «Счёт за сентябрь не выставлен клиенту» помечена решённой', 'Изменил: Аня К.', now() - interval '6 days'),
  ('avrora', 'retro_completed', 'Завершено ретро «Спринт 13»', 'Участники: Аня К., Максим Р., Лена Б.', now() - interval '9 days')
on conflict do nothing;

-- =====================================================================
-- 9. Первый администратор.
-- Проекты, этапы, участники проектов и проблемы теперь редактируются
-- только админами (is_admin = true) — выше это ужесточили политиками RLS.
-- Без этой строки после применения схемы управлять ими через приложение
-- не сможет никто. Замените email, если нужно назначить другого человека,
-- или выдайте флаг is_admin ещё кому-то прямо в Table Editor → profiles.
-- =====================================================================
update public.profiles set is_admin = true where email = 'n.nozhenkova@ze.studio';

-- =====================================================================
-- 10. Аватарки — файл кладём в Supabase Storage, ссылку храним в profiles.
-- =====================================================================
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Файл каждого человека лежит по пути "<его user id>/avatar.<расширение>" —
-- политики ниже используют первую часть пути, чтобы разрешить менять только
-- свой файл. Бакет публичный, поэтому читать аватарки может кто угодно
-- по прямой ссылке (это ожидаемо: это просто фото профиля).
drop policy if exists "avatars readable by anyone" on storage.objects;
create policy "avatars readable by anyone"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars writable by owner" on storage.objects;
create policy "avatars writable by owner"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars updatable by owner" on storage.objects;
create policy "avatars updatable by owner"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars deletable by owner" on storage.objects;
create policy "avatars deletable by owner"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
