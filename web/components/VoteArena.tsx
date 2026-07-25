"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Matchup, Person, VoteResult } from "@/lib/types";
import { PersonCard } from "./PersonCard";

type State =
  | { kind: "loading" }
  | { kind: "login_required" }
  | { kind: "exhausted" }
  | { kind: "error"; message: string }
  | { kind: "matchup"; matchup: Matchup; winnerId: string | null; delta: number | null };

export function VoteArena() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const loadMatchup = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/matchup", { cache: "no-store" });
      if (res.status === 401) {
        setState({ kind: "login_required" });
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to load");
      if (!data.matchup) {
        setState({ kind: "exhausted" });
        return;
      }
      setState({ kind: "matchup", matchup: data.matchup, winnerId: null, delta: null });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "failed to load",
      });
    }
  }, []);

  useEffect(() => {
    loadMatchup();
  }, [loadMatchup]);

  async function vote(winner: Person, loser: Person) {
    if (state.kind !== "matchup" || state.winnerId) return;
    setState({ ...state, winnerId: winner.id });
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId: winner.id, loserId: loser.id }),
      });
      const data: VoteResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "vote failed");
      setState((prev) =>
        prev.kind === "matchup" ? { ...prev, delta: data.delta } : prev
      );
      setTimeout(loadMatchup, 900);
    } catch {
      // e.g. already voted on this pair in another tab — just move on
      setTimeout(loadMatchup, 400);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="py-24 text-center text-sm text-neutral-400">
        Finding a matchup…
      </div>
    );
  }

  if (state.kind === "login_required") {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Sign in to vote</p>
        <p className="mt-2 text-sm text-neutral-500">
          Voting requires an account so the Elo can&apos;t be gamed. The
          leaderboard is public.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-500"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (state.kind === "exhausted") {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">You&apos;ve voted on every pair 🎉</p>
        <Link
          href="/leaderboard"
          className="mt-6 inline-block rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-500"
        >
          See the leaderboard
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">Something broke: {state.message}</p>
        <button
          onClick={loadMatchup}
          className="mt-4 rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { matchup, winnerId, delta } = state;
  const resultFor = (p: Person): "winner" | "loser" | null =>
    winnerId === null ? null : winnerId === p.id ? "winner" : "loser";

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <PersonCard
          person={matchup.a}
          disabled={winnerId !== null}
          result={resultFor(matchup.a)}
          onVote={() => vote(matchup.a, matchup.b)}
        />
        <div className="flex items-center justify-center text-sm font-black text-neutral-300 dark:text-neutral-700">
          VS
        </div>
        <PersonCard
          person={matchup.b}
          disabled={winnerId !== null}
          result={resultFor(matchup.b)}
          onVote={() => vote(matchup.b, matchup.a)}
        />
      </div>
      <p className="mt-6 text-center text-xs text-neutral-400">
        {winnerId && delta
          ? `+${delta} / −${delta} Elo — next matchup coming up…`
          : "Who's accomplished more? Click a card to vote."}
      </p>
    </div>
  );
}
