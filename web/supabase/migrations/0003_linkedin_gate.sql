-- Gate rankings on verified identity: people without a linkedin_url are
-- excluded from matchmaking (they exist in the table but never get served or
-- ranked). Keeps dummy/placeholder accounts out of the arena.

create index if not exists people_has_linkedin_idx
  on public.people (elo desc)
  where linkedin_url is not null;

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
    where p.linkedin_url is not null
    order by p.vote_count + floor(random() * 5)::int, random()
    limit 1;

    if a.id is null then
      return null; -- no eligible people
    end if;

    foreach v_window in array array[150, 300, 600, 2147483647] loop
      select p.* into b
      from public.people p
      where p.id <> a.id
        and p.linkedin_url is not null
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
    where p1.linkedin_url is not null
      and p2.linkedin_url is not null
      and not exists (
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
