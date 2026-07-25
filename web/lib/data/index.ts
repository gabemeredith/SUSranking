import { SupabaseClient } from "@supabase/supabase-js";
import { Person, VoteResult } from "../types";
import { pickMatchup } from "../matchmaking";
import { isSupabaseConfigured } from "../supabase/server";
import { demoGetLeaderboard, demoGetMatchup, demoRecordVote } from "./demo";

export const demoMode = () => !isSupabaseConfigured();

export async function getLeaderboard(
  supabase: SupabaseClient | null
): Promise<Person[]> {
  if (!supabase) return demoGetLeaderboard();
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .order("elo", { ascending: false })
    .order("vote_count", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Person[];
}

export async function getMatchup(
  supabase: SupabaseClient | null,
  voterKey: string
): Promise<[Person, Person] | null> {
  if (!supabase) return demoGetMatchup(voterKey);

  const [{ data: people, error }, { data: votes, error: votesError }] =
    await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("votes").select("pair_key").eq("voter_id", voterKey),
    ]);
  if (error) throw new Error(error.message);
  if (votesError) throw new Error(votesError.message);

  const excluded = new Set((votes ?? []).map((v) => v.pair_key as string));
  return pickMatchup((people ?? []) as Person[], excluded);
}

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
  return {
    winner_elo: row.winner_elo,
    loser_elo: row.loser_elo,
    delta: row.delta,
  };
}
