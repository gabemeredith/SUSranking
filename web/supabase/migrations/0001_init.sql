-- SUS Ranking schema: people directory, votes, atomic Elo updates.
create extension if not exists pgcrypto;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school text,
  headline text,
  photo_url text,
  linkedin_url text,
  website_url text,
  blurb text,
  raw_profile jsonb not null default '{}',
  elo integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references auth.users (id) on delete cascade,
  winner_id uuid not null references public.people (id) on delete cascade,
  loser_id uuid not null references public.people (id) on delete cascade,
  winner_elo_before integer not null,
  loser_elo_before integer not null,
  winner_elo_after integer not null,
  loser_elo_after integer not null,
  pair_key text generated always as (
    least(winner_id::text, loser_id::text) || ':' || greatest(winner_id::text, loser_id::text)
  ) stored,
  created_at timestamptz not null default now(),
  constraint votes_distinct_people check (winner_id <> loser_id),
  constraint votes_one_per_pair unique (voter_id, pair_key)
);

create index votes_voter_idx on public.votes (voter_id);
create index people_elo_idx on public.people (elo desc);

-- RLS: leaderboard is public; votes only written via the record_vote function.
alter table public.people enable row level security;
alter table public.votes enable row level security;

create policy "people readable by everyone"
  on public.people for select
  to anon, authenticated
  using (true);

create policy "voters can read own votes"
  on public.votes for select
  to authenticated
  using (auth.uid() = voter_id);

-- Atomic Elo update (K=32). SECURITY DEFINER so it can write despite RLS;
-- requires an authenticated caller.
create or replace function public.record_vote(p_winner uuid, p_loser uuid)
returns table (winner_elo integer, loser_elo integer, delta integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter uuid := auth.uid();
  w public.people%rowtype;
  l public.people%rowtype;
  expected double precision;
  d integer;
begin
  if v_voter is null then
    raise exception 'not_authenticated';
  end if;
  if p_winner = p_loser then
    raise exception 'invalid_matchup';
  end if;

  -- Lock both rows in a deterministic order to avoid deadlocks.
  for w in
    select * from public.people
    where id in (p_winner, p_loser)
    order by id
    for update
  loop
    null;
  end loop;

  select * into w from public.people where id = p_winner;
  select * into l from public.people where id = p_loser;
  if w.id is null or l.id is null then
    raise exception 'person_not_found';
  end if;

  expected := 1.0 / (1.0 + power(10.0, (l.elo - w.elo) / 400.0));
  d := greatest(1, round(32 * (1.0 - expected))::integer);

  insert into public.votes (
    voter_id, winner_id, loser_id,
    winner_elo_before, loser_elo_before,
    winner_elo_after, loser_elo_after
  ) values (
    v_voter, p_winner, p_loser,
    w.elo, l.elo,
    w.elo + d, l.elo - d
  );

  update public.people
    set elo = elo + d, wins = wins + 1, vote_count = vote_count + 1
    where id = p_winner;
  update public.people
    set elo = elo - d, losses = losses + 1, vote_count = vote_count + 1
    where id = p_loser;

  return query select w.elo + d, l.elo - d, d;
exception
  when unique_violation then
    raise exception 'already_voted';
end;
$$;

revoke all on function public.record_vote(uuid, uuid) from public;
grant execute on function public.record_vote(uuid, uuid) to authenticated;
