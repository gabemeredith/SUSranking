import { randomUUID } from "crypto";
import { Person, VoteResult, pairKey } from "../types";
import { applyVote } from "../elo";
import { pickMatchup } from "../matchmaking";
import seed from "../../data/seed.json";

interface DemoStore {
  people: Map<string, Person>;
  // voterKey -> set of pair keys already voted
  votedPairs: Map<string, Set<string>>;
}

// Survive Next.js dev-server HMR by stashing the store on globalThis.
const g = globalThis as unknown as { __susDemoStore?: DemoStore };

function getStore(): DemoStore {
  if (!g.__susDemoStore) {
    const people = new Map<string, Person>();
    for (const row of seed as Array<Record<string, unknown>>) {
      const id = randomUUID();
      people.set(id, {
        id,
        name: row.name as string,
        school: (row.school as string) ?? null,
        headline: (row.headline as string) ?? null,
        photo_url: (row.photo_url as string) ?? null,
        linkedin_url: (row.linkedin_url as string) ?? null,
        website_url: (row.website_url as string) ?? null,
        blurb: (row.blurb as string) ?? null,
        raw_profile: (row.raw_profile as Record<string, unknown>) ?? {},
        elo: 1000,
        wins: 0,
        losses: 0,
        vote_count: 0,
      });
    }
    g.__susDemoStore = { people, votedPairs: new Map() };
  }
  return g.__susDemoStore;
}

export function demoGetLeaderboard(): Person[] {
  return [...getStore().people.values()].sort((a, b) =>
    b.elo !== a.elo ? b.elo - a.elo : b.vote_count - a.vote_count
  );
}

export function demoGetMatchup(voterKey: string): [Person, Person] | null {
  const store = getStore();
  const excluded = store.votedPairs.get(voterKey) ?? new Set<string>();
  return pickMatchup([...store.people.values()], excluded);
}

export function demoRecordVote(
  voterKey: string,
  winnerId: string,
  loserId: string
): VoteResult {
  const store = getStore();
  const winner = store.people.get(winnerId);
  const loser = store.people.get(loserId);
  if (!winner || !loser || winnerId === loserId) {
    throw new Error("invalid matchup");
  }
  const key = pairKey(winnerId, loserId);
  let voted = store.votedPairs.get(voterKey);
  if (!voted) {
    voted = new Set();
    store.votedPairs.set(voterKey, voted);
  }
  if (voted.has(key)) throw new Error("already_voted");
  voted.add(key);

  const result = applyVote(winner.elo, loser.elo);
  winner.elo = result.winner;
  winner.wins += 1;
  winner.vote_count += 1;
  loser.elo = result.loser;
  loser.losses += 1;
  loser.vote_count += 1;
  return { winner_elo: result.winner, loser_elo: result.loser, delta: result.delta };
}
