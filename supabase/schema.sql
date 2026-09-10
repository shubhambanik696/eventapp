-- ============================================================================
--  EventApp — full database setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  Safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- organisers
-- One row per admin. Sign-in is email + password through Supabase Auth;
-- a matching row here is what grants permission to post events.

create table if not exists admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  org_name   text not null default 'Campus Events',
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------- events

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'tech'
              check (category in ('tech','music','sports','cultural','workshop','talks')),
  org         text not null default '',
  blurb       text not null default '',
  about       text not null default '',
  poster_url  text,
  event_date  date not null,
  event_time  text not null default '18:00',
  duration    text not null default '2 hours',
  venue       text not null default '',
  city        text not null default '',
  seats       integer not null default 100 check (seats > 0),
  taken       integer not null default 0 check (taken >= 0),
  fee         integer not null default 0 check (fee >= 0),
  rules       text[] not null default '{}',
  policies    text[] not null default '{}',
  contact     jsonb not null default '{}'::jsonb,
  form_fields jsonb not null default '[]'::jsonb,
  featured    boolean not null default false,
  published   boolean not null default true,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint seats_not_oversold check (taken <= seats)
);

create index if not exists events_by_date on events (event_date);

-- ------------------------------------------------------------- registrations

create table if not exists registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null,
  email      text not null,
  answers    jsonb not null default '{}'::jsonb,
  code       text not null,
  device_id  text,
  created_at timestamptz not null default now()
);

-- The duplicate guard. Everything the app does in the browser is a courtesy;
-- this index is what actually makes a second registration impossible.
create unique index if not exists one_registration_per_email
  on registrations (event_id, lower(email));

create index if not exists regs_by_event on registrations (event_id);

-- --------------------------------------------------------------------- likes
-- No student accounts, so a random id kept in the browser is the identity.

create table if not exists likes (
  event_id   uuid not null references events(id) on delete cascade,
  device_id  text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, device_id)
);

-- ------------------------------------------------- keep the seat count honest

create or replace function drop_registration_seat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update events set taken = greatest(0, taken - 1) where id = old.event_id;
  return old;
end $$;

drop trigger if exists on_registration_deleted on registrations;
create trigger on_registration_deleted
  after delete on registrations
  for each row execute function drop_registration_seat();

-- ----------------------------------------------------------------- register
-- Seat check, duplicate check and insert in one transaction, so two people
-- tapping Register on the last seat can't both get it.

create or replace function register_for_event(
  p_event   uuid,
  p_email   text,
  p_name    text,
  p_answers jsonb,
  p_device  text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_left int;
  v_code text;
begin
  select seats - taken into v_left
    from events
   where id = p_event and published
   for update;

  if v_left is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_left <= 0   then raise exception 'EVENT_FULL';      end if;

  if exists (
    select 1 from registrations
     where event_id = p_event and lower(email) = lower(p_email)
  ) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  v_code := 'EA-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 7));

  insert into registrations (event_id, name, email, answers, code, device_id)
  values (p_event, p_name, lower(p_email), coalesce(p_answers, '{}'::jsonb), v_code, p_device);

  update events set taken = taken + 1 where id = p_event;

  return v_code;
exception
  when unique_violation then
    raise exception 'ALREADY_REGISTERED';
end $$;

-- Lets the form show a friendly message before submitting.
create or replace function email_registered(p_event uuid, p_email text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from registrations
     where event_id = p_event and lower(email) = lower(p_email)
  );
$$;

grant execute on function register_for_event(uuid, text, text, jsonb, text) to anon, authenticated;
grant execute on function email_registered(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------- views

drop view if exists events_public;
create view events_public with (security_invoker = on) as
  select e.*, coalesce(l.total, 0)::int as like_count
    from events e
    left join (select event_id, count(*) as total from likes group by event_id) l
      on l.event_id = e.id;

drop view if exists registration_counts;
create view registration_counts with (security_invoker = on) as
  select event_id, count(*)::int as total
    from registrations
   group by event_id;

grant select on events_public to anon, authenticated;
grant select on registration_counts to anon, authenticated;

-- --------------------------------------------------------- row level security

alter table admins        enable row level security;
alter table events        enable row level security;
alter table registrations enable row level security;
alter table likes         enable row level security;

-- An admin is anyone with a row in admins. Nothing else can write.
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

grant execute on function is_admin() to anon, authenticated;

drop policy if exists admin_sees_self on admins;
create policy admin_sees_self on admins
  for select to authenticated using (id = auth.uid());

-- Anyone, signed in or not, can browse published events.
drop policy if exists anyone_reads_events on events;
create policy anyone_reads_events on events
  for select using (published or is_admin());

drop policy if exists admins_write_events on events;
create policy admins_write_events on events
  for all to authenticated using (is_admin()) with check (is_admin());

-- Students never touch this table directly; they go through the function above,
-- which runs as definer. Admins can read every row so the export works.
drop policy if exists admins_read_registrations on registrations;
create policy admins_read_registrations on registrations
  for select to authenticated using (is_admin());

drop policy if exists admins_delete_registrations on registrations;
create policy admins_delete_registrations on registrations
  for delete to authenticated using (is_admin());

-- Likes are anonymous and self-serve.
drop policy if exists anyone_reads_likes on likes;
create policy anyone_reads_likes on likes for select using (true);

drop policy if exists anyone_adds_likes on likes;
create policy anyone_adds_likes on likes for insert with check (true);

drop policy if exists anyone_removes_likes on likes;
create policy anyone_removes_likes on likes for delete using (true);

-- -------------------------------------------------------------------- storage
-- Public bucket for event posters: everyone can look, only admins can upload.

insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do update set public = true;

drop policy if exists posters_are_public on storage.objects;
create policy posters_are_public on storage.objects
  for select using (bucket_id = 'posters');

drop policy if exists admins_upload_posters on storage.objects;
create policy admins_upload_posters on storage.objects
  for insert to authenticated with check (bucket_id = 'posters' and is_admin());

drop policy if exists admins_replace_posters on storage.objects;
create policy admins_replace_posters on storage.objects
  for update to authenticated using (bucket_id = 'posters' and is_admin());

drop policy if exists admins_delete_posters on storage.objects;
create policy admins_delete_posters on storage.objects
  for delete to authenticated using (bucket_id = 'posters' and is_admin());

-- ============================================================================
--  LAST STEP — make yourself an organiser
--
--  1. Supabase → Authentication → Users → Add user → Create new user.
--     Use your email, set a password, tick "Auto confirm user".
--  2. Copy the new user's UID, then run this with your own values:
--
--     insert into admins (id, email, org_name)
--     values ('PASTE-UID-HERE', 'you@campus.ac.in', 'Students'' Council')
--     on conflict (id) do update set org_name = excluded.org_name;
--
--  3. Authentication → Sign In / Providers → turn OFF "Allow new users to sign
--     up", so nobody can create an organiser account by themselves.
-- ============================================================================
