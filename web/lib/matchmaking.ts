import { pairKey } from "./schemas";

/** The minimal shape matchmaking needs — keeps queries light at scale. */
export interface MatchCandidate {
  id: string;
  elo: number;
  vote_count: number;
}

/**
 * Smart matchmaking: prioritize people with few votes so everyone gets rated,
 * then pair within an expanding Elo window so matchups are competitive and
 * rankings converge faster than pure random pairing.
 *
 * Used directly by demo mode; the Supabase path runs the same algorithm
 * server-side in Postgres (supabase/migrations/0002_scale.sql: get_matchup).
 */
export function pickMatchup<T extends MatchCandidate>(
  people: T[],
  excludedPairs: Set<string>,
  rng: () => number = Math.random
): [T, T] | null {
  if (people.length < 2) return null;

  const windows = [150, 300, 600, Infinity];

  // A few attempts at picking a fresh `a` before the exhaustive fallback.
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = weightedPick(people, (p) => 1 / (1 + p.vote_count), rng);
    if (!a) return null;

    for (const window of windows) {
      const candidates = people.filter(
        (p) =>
          p.id !== a.id &&
          Math.abs(p.elo - a.elo) <= window &&
          !excludedPairs.has(pairKey(a.id, p.id))
      );
      if (candidates.length > 0) {
        const b = weightedPick(candidates, (p) => 1 / (1 + p.vote_count), rng);
        if (b) return rng() < 0.5 ? [a, b] : [b, a];
      }
    }
  }

  // Voter has judged every pair involving the sampled people; scan for any
  // remaining un-voted pair at all, else null (pool exhausted).
  for (const p of people) {
    for (const q of people) {
      if (p.id !== q.id && !excludedPairs.has(pairKey(p.id, q.id))) {
        return rng() < 0.5 ? [p, q] : [q, p];
      }
    }
  }
  return null;
}

function weightedPick<T>(
  items: T[],
  weight: (item: T) => number,
  rng: () => number
): T | null {
  if (items.length === 0) return null;
  const weights = items.map(weight);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
