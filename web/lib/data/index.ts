import { SupabaseClient } from "@supabase/supabase-js";
import {
  LeaderboardPage,
  PersonPublic,
  PersonRowSchema,
  RpcMatchupSchema,
  VoteResult,
  VoteResultSchema,
  toPublicPerson,
} from "../schemas";
import { isSupabaseConfigured } from "../supabase/server";
import {
  demoGetLeaderboardPage,
  demoGetMatchup,
  demoRecordVote,
} from "./demo";

export const demoMode = () => !isSupabaseConfigured();

export const LEADERBOARD_PAGE_SIZE = 50;

/**
 * Paginated leaderboard. Never fetches the whole table — at 1k people a page
 * is 50 rows + a count, served off the (elo desc) index.
 */
export async function getLeaderboardPage(
  supabase: SupabaseClient | null,
  page: number
): Promise<LeaderboardPage> {
  const pageSize = LEADERBOARD_PAGE_SIZE;
  if (!supabase) {
    const { entries, total } = demoGetLeaderboardPage(page, pageSize);
    return { entries, total, page, pageSize };
  }

  const from = page * pageSize;
  // Only people with a LinkedIn are ranked — dummy accounts stay invisible.
  const { data, error, count } = await supabase
    .from("people")
    .select("*", { count: "exact" })
    .not("linkedin_url", "is", null)
    .order("elo", { ascending: false })
    .order("vote_count", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  return {
    entries: (data ?? []).map((row) =>
      toPublicPerson(PersonRowSchema.parse(row))
    ),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Serve a matchup. Supabase path runs matchmaking inside Postgres
 * (get_matchup RPC) — one round trip, no table scans shipped to the app
 * server, safe under concurrency.
 */
export async function getMatchup(
  supabase: SupabaseClient | null,
  voterKey: string
): Promise<[PersonPublic, PersonPublic] | null> {
  if (!supabase) return demoGetMatchup(voterKey);

  const { data, error } = await supabase.rpc("get_matchup");
  if (error) throw new Error(error.message);
  const parsed = RpcMatchupSchema.parse(data);
  if (!parsed) return null;
  return [toPublicPerson(parsed.a), toPublicPerson(parsed.b)];
}

/**
 * Record a vote. Supabase path is fully atomic in Postgres: row locks in
 * deterministic order, unique (voter, pair) constraint, per-voter rate limit.
 */
export async function recordVote(
  supabase: SupabaseClient | null,
  voterKey: string,
  winnerId: string,
  loserId: string
): Promise<VoteResult> {
  if (!supabase) return demoRecordVote(voterKey, winnerId, loserId);

  const { data, error } = await supabase.rpc("record_vote", {
    p_winner: winnerId,
    p_loser: loserId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return VoteResultSchema.parse(row);
}
