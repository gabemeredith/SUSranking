import { randomUUID } from "crypto";
import {
  PersonInputSchema,
  PersonPublic,
  PersonRow,
  VoteResult,
  pairKey,
  toPublicPerson,
} from "../schemas";
import { applyVote, STARTING_ELO } from "../elo";
import { pickMatchup } from "../matchmaking";
import seed from "../../data/seed.json";

/**
 * In-memory backend used when Supabase isn't configured. Single-process,
 * resets on restart — for local dev/demos only. The production path is
 * Postgres (see lib/data/index.ts).
 */

interface DemoStore {
  people: Map<string, PersonRow>;
  /** voterKey -> pair keys already voted */
  votedPairs: Map<string, Set<string>>;
}

// Survive Next.js dev-server HMR by stashing the store on globalThis.
const g = globalThis as unknown as { __susDemoStore?: DemoStore };

function getStore(): DemoStore {
  if (!g.__susDemoStore) {
    const people = new Map<string, PersonRow>();
    for (const raw of seed as unknown[]) {
      const input = PersonInputSchema.parse(raw);
      const id = randomUUID();
      people.set(id, {
        id,
        ...input,
        elo: STARTING_ELO,
        wins: 0,
        losses: 0,
        vote_count: 0,
        created_at: new Date().toISOString(),
      });
    }
    g.__susDemoStore = { people, votedPairs: new Map() };
  }
  return g.__susDemoStore;
}

/** Same gate as production: only people with a LinkedIn are ranked/served. */
function eligiblePeople(): PersonRow[] {
  return [...getStore().people.values()].filter((p) => p.linkedin_url);
}

function sortedPeople(): PersonRow[] {
  return eligiblePeople().sort((a, b) =>
    b.elo !== a.elo ? b.elo - a.elo : b.vote_count - a.vote_count
  );
}

export function demoGetLeaderboardPage(
  page: number,
  pageSize: number
): { entries: PersonPublic[]; total: number } {
  const all = sortedPeople();
  return {
    entries: all.slice(page * pageSize, (page + 1) * pageSize).map(toPublicPerson),
    total: all.length,
  };
}

export function demoGetMatchup(
  voterKey: string
): [PersonPublic, PersonPublic] | null {
  const store = getStore();
  const excluded = store.votedPairs.get(voterKey) ?? new Set<string>();
  const pair = pickMatchup(eligiblePeople(), excluded);
  return pair ? [toPublicPerson(pair[0]), toPublicPerson(pair[1])] : null;
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
    throw new Error("invalid_matchup");
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
