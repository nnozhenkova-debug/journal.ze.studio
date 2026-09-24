-- Журнал студии — схема базы данных Supabase.
-- Выполните этот файл целиком в Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Безопасно запускать один раз на чистом проекте.

-- 1. Профили: публичное имя для каждого аккаунта (auth.users недоступна другим пользователям напрямую)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles updatable by owner" on public.profiles;
create policy "profiles updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Ограничение регистрации доменом студии.
-- Поменяйте 'ze.studio' здесь, если домен почты команды другой.
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

-- 3. Автоматически создаём профиль при первом входе нового пользователя.
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

-- 4. Записи журнала: встречи, заметки, ретро-проблемы/практики и т.д.
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('meeting','note','risk','agreement','decision','client_mood','retro_problem','retro_practice')),
  project text not null,
  date date not null,
  author_id uuid references auth.users(id) on delete set null,
  text text not null,
  attendees text,
  category text,
  solution text,
  owner text,
  status text check (status in ('new','proposed','in_progress','resolved','recurred')),
  stage text not null default 'formalized' check (stage in ('draft','formalized')),
  history jsonb not null default '[]'::jsonb,
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.entries enable row level security;

drop policy if exists "entries readable by authenticated" on public.entries;
create policy "entries readable by authenticated"
  on public.entries for select
  using (auth.role() = 'authenticated');

drop policy if exists "entries insertable by authenticated" on public.entries;
create policy "entries insertable by authenticated"
  on public.entries for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "entries updatable by authenticated" on public.entries;
create policy "entries updatable by authenticated"
  on public.entries for update
  using (auth.role() = 'authenticated');

drop policy if exists "entries deletable by authenticated" on public.entries;
create policy "entries deletable by authenticated"
  on public.entries for delete
  using (auth.role() = 'authenticated');

create index if not exists entries_project_idx on public.entries (project);
create index if not exists entries_type_idx on public.entries (type);
create index if not exists entries_date_idx on public.entries (date desc);

-- 5. Включаем realtime — чтобы изменения одного человека сразу видели остальные.
alter publication supabase_realtime add table public.entries;

-- 6. Несколько примеров, чтобы доска не была пустой при первом входе.
-- Можно удалить прямо из интерфейса после того, как появятся реальные записи.
insert into public.entries (type, project, date, text, attendees, category, solution, owner, status, stage, history, is_example)
values
  ('meeting', 'Сайт «Аврора»', '2026-06-02',
   'Ретро по итогам проекта. Обсудили коммуникацию с клиентом и качество ревью перед сдачей. Договорились о двух конкретных изменениях в процессе.',
   'Игорь, Света, Арт-директор', null, null, null, null, 'formalized', '[]'::jsonb, true),
  ('retro_problem', 'Сайт «Аврора»', '2026-05-14',
   'Клиент менял приоритеты по ходу проекта в личных сообщениях менеджеру, минуя ПМа — решения терялись.',
   null, 'comm', 'Все решения клиента фиксируются в одном канале с ПМом в копии.', 'Игорь', 'resolved', 'formalized',
   '[{"status":"new","date":"2026-05-14","note":"Зафиксировано на ретро"},{"status":"proposed","date":"2026-05-16","note":"Предложено единое правило"},{"status":"resolved","date":"2026-06-02","note":"Внедрено и проверено"}]'::jsonb,
   true),
  ('retro_problem', 'Бренд «Полюс»', '2026-07-20',
   'Клиент согласовывал правки устно на созвоне, потом отрицал часть договорённостей.',
   null, 'comm', 'После каждого созвона — короткое письменное резюме.', 'Марина', 'in_progress', 'formalized',
   '[{"status":"new","date":"2026-07-20","note":"Зафиксировано на ретро"},{"status":"proposed","date":"2026-07-22","note":"Предложено резюме после созвонов"},{"status":"in_progress","date":"2026-08-01","note":"Внедряется на текущих проектах"}]'::jsonb,
   true),
  ('retro_problem', 'Каталог «Нео»', '2026-09-18',
   'Та же история: устные договорённости с клиентом разошлись через неделю.',
   null, 'comm', 'Проверить, применялось ли правило из проекта «Полюс».', 'Дана', 'recurred', 'formalized',
   '[{"status":"new","date":"2026-09-18","note":"Похоже на повтор темы из «Полюса»"}]'::jsonb,
   true),
  ('retro_practice', 'Сайт «Аврора»', '2026-06-02',
   'Двухуровневое ревью перед сдачей — ни одного дефекта после сдачи.',
   null, 'quality', null, null, null, 'formalized', '[]'::jsonb, true),
  ('decision', 'Лендинг «Орбита»', '2026-04-25',
   'Решили закладывать 15% буфер на правки в оценку для всех проектов с фикс-ценой.',
   null, null, null, null, null, 'formalized', '[]'::jsonb, true)
on conflict do nothing;
