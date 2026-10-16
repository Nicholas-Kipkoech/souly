-- Starter profile schema for Soully. Review policies and privacy requirements before production.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  age smallint not null check (age between 18 and 120),
  bio text not null default '' check (char_length(bio) <= 500),
  dating_intention text not null default 'both' check (dating_intention in ('serious','casual','both')),
  interests text[] not null default '{}' check (cardinality(interests) <= 10),
  photo_url text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;
create policy "Signed-in users can view profiles" on public.profiles for select to authenticated using (true);
create policy "Users can create their own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own profile" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own profile" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);
-- IMPORTANT: this select policy is intentionally permissive for a local prototype. Tighten it before launch,
-- and do not expose email, precise location, moderation data, or other private fields to discovery clients.
