-- Scale hardening: server-side matchmaking, per-voter rate limiting, indexes.
-- Safe to run on a fresh DB right after 0001, or on an existing deployment.

-- Rate-limit lookups: (voter, recent votes)
create index if not exists votes_voter_created_idx
  on public.votes (voter_id, created_at desc);

-- Matchmaking scans people by vote_count
create index if not exists people_vote_count_idx
  on public.people (vote_count asc);

-- ---------------------------------------------------------------------------
-- get_matchup(): matchmaking inside Postgres. One round trip; nothing but the
-- two chosen rows leaves the database, so it stays O(1) network-wise at any
-- directory size. Mirrors lib/matchmaking.ts:
--   * person A sampled with bias toward the fewest votes
--   * person B within an expanding Elo window (150/300/600/unbounded)
--   * pairs this voter already judged are excluded (via votes.pair_key)
-- Returns jsonb {a: <person row>, b: <person row>} or null when the voter has
-- exhausted every pair.
-- ---------------------------------------------------------------------------
create or replace function public.get_matchup()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_voter uuid := auth.uid();
  a public.people%rowtype;
  b public.people%rowtype;
  v_window integer;
begin
  if v_voter is null then
    raise exception 'not_authenticated';
  end if;

  -- Up to 3 attempts at a fresh "A" before the exhaustive fallback.
  for attempt in 1..3 loop
    -- Sample A biased toward least-voted (jittered so it isn't deterministic).
    select p.* into a
    from public.people p
    order by p.vote_count + floor(random() * 5)::int, random()
    limit 1;

    if a.id is null then
      return null; -- empty directory
    end if;

    foreach v_window in array array[150, 300, 600, 2147483647] loop
      select p.* into b
      from public.people p
      where p.id <> a.id
        and abs(p.elo - a.elo) <= v_window
        and not exists (
          select 1
          from public.votes v
          where v.voter_id = v_voter
            and v.pair_key = least(a.id::text, p.id::text) || ':' ||
                             greatest(a.id::text, p.id::text)
        )
      order by p.vote_count + floor(random() * 5)::int, random()
      limit 1;

      if b.id is not null then
        return jsonb_build_object('a', to_jsonb(a), 'b', to_jsonb(b));
      end if;
    end loop;
  end loop;

  -- Sampled A's were all exhausted for this voter: look for any remaining
  -- un-voted pair (rare — only near-complete voters hit this path).
  declare
    v_id_a uuid;
    v_id_b uuid;
  begin
    select p1.id, p2.id into v_id_a, v_id_b
    from public.people p1
    join public.people p2 on p1.id < p2.id
    where not exists (
      select 1 from public.votes v
      where v.voter_id = v_voter
        and v.pair_key = p1.id::text || ':' || p2.id::text
    )
    order by random()
    limit 1;

    if v_id_a is null then
      return null; -- voter has judged every pair
    end if;
    select p.* into a from public.people p where p.id = v_id_a;
    select p.* into b from public.people p where p.id = v_id_b;
    return jsonb_build_object('a', to_jsonb(a), 'b', to_jsonb(b));
  end;
end;
$$;

revoke all on function public.get_matchup() from public;
grant execute on function public.get_matchup() to authenticated;

-- ---------------------------------------------------------------------------
-- record_vote(): same atomic Elo update as 0001, plus a per-voter rate limit
-- (max 30 votes per minute) so a scripted client can't flood the rankings.
-- ---------------------------------------------------------------------------
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
  recent integer;
begin
  if v_voter is null then
    raise exception 'not_authenticated';
  end if;
  if p_winner = p_loser then
    raise exception 'invalid_matchup';
  end if;

  select count(*) into recent
  from public.votes
  where voter_id = v_voter and created_at > now() - interval '1 minute';
  if recent >= 30 then
    raise exception 'rate_limited';
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
