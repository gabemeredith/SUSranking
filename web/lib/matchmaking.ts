import { Person, pairKey } from "./types";

/**
 * Smart matchmaking: prioritize people with few votes so everyone gets rated,
 * then pair within an expanding Elo window so matchups are competitive and
 * rankings converge faster than pure random pairing.
 */
export function pickMatchup(
  people: Person[],
  excludedPairs: Set<string>,
  rng: () => number = Math.random
): [Person, Person] | null {
  if (people.length < 2) return null;

  // Weighted pick: fewer votes -> more likely to be shown
  const a = weightedPick(people, (p) => 1 / (1 + p.vote_count), rng);
  if (!a) return null;

  const windows = [150, 300, 600, Infinity];
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

  // Voter has already voted on every pair involving `a`; fall back to any
  // un-voted pair at all, else null (voter has exhausted the pool).
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
