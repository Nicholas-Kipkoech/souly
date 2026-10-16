-- Run this file in Supabase SQL Editor if you already created the starter profiles table.
-- Adds swipe decisions and automatic mutual matches.

-- Swipe decisions and mutual matches (MVP).
create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('like','pass')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swipes_no_self_like check (from_user_id <> to_user_id),
  constraint swipes_unique_pair unique (from_user_id, to_user_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_sorted_pair check (user_a < user_b),
  constraint matches_unique_pair unique (user_a, user_b)
);

alter table public.swipes enable row level security;
alter table public.matches enable row level security;
revoke all on public.swipes from anon;
revoke all on public.matches from anon;
grant select, insert, update, delete on public.swipes to authenticated;
grant select on public.matches to authenticated;

drop policy if exists "Users can read their own swipes" on public.swipes;
create policy "Users can read their own swipes" on public.swipes
  for select to authenticated using ((select auth.uid()) = from_user_id);
drop policy if exists "Users can create their own swipes" on public.swipes;
create policy "Users can create their own swipes" on public.swipes
  for insert to authenticated with check ((select auth.uid()) = from_user_id);
drop policy if exists "Users can update their own swipes" on public.swipes;
create policy "Users can update their own swipes" on public.swipes
  for update to authenticated using ((select auth.uid()) = from_user_id)
  with check ((select auth.uid()) = from_user_id);
drop policy if exists "Users can delete their own swipes" on public.swipes;
create policy "Users can delete their own swipes" on public.swipes
  for delete to authenticated using ((select auth.uid()) = from_user_id);

drop policy if exists "Users can read their own matches" on public.matches;
create policy "Users can read their own matches" on public.matches
  for select to authenticated using ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

-- Create a match after a reciprocal like. SECURITY DEFINER lets this trigger
-- insert the match without granting clients direct insert access to matches.
create or replace function public.create_match_after_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  low_user uuid;
  high_user uuid;
begin
  if new.decision <> 'like' then
    return new;
  end if;

  if exists (
    select 1 from public.swipes s
    where s.from_user_id = new.to_user_id
      and s.to_user_id = new.from_user_id
      and s.decision = 'like'
  ) then
    low_user := least(new.from_user_id, new.to_user_id);
    high_user := greatest(new.from_user_id, new.to_user_id);
    insert into public.matches (user_a, user_b)
    values (low_user, high_user)
    on conflict (user_a, user_b) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists swipes_create_match on public.swipes;
create trigger swipes_create_match
after insert or update of decision on public.swipes
for each row execute function public.create_match_after_like();
