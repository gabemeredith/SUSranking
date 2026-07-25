"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Matchup,
  MatchupResponseSchema,
  PersonPublic,
  VoteResultSchema,
} from "@/lib/schemas";
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed to load");
      const data = MatchupResponseSchema.parse(json);
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

  const vote = useCallback(
    async (winner: PersonPublic, loser: PersonPublic) => {
      setState((prev) => {
        if (prev.kind !== "matchup" || prev.winnerId) return prev;
        return { ...prev, winnerId: winner.id };
      });
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId: winner.id, loserId: loser.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "vote failed");
        const data = VoteResultSchema.parse(json);
        setState((prev) =>
          prev.kind === "matchup" ? { ...prev, delta: data.delta } : prev
        );
        setTimeout(loadMatchup, 900);
      } catch {
        // e.g. already voted on this pair in another tab — just move on
        setTimeout(loadMatchup, 400);
      }
    },
    [loadMatchup]
  );

  // Arrow-key voting: ← picks the left card, → the right.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.kind !== "matchup" || state.winnerId) return;
      if (e.key === "ArrowLeft") vote(state.matchup.a, state.matchup.b);
      if (e.key === "ArrowRight") vote(state.matchup.b, state.matchup.a);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, vote]);

  if (state.kind === "loading") {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.3em] text-neutral-600">
        Finding a matchup…
      </div>
    );
  }

  if (state.kind === "login_required") {
    return (
      <div className="py-20 text-center">
        <p className="text-xl font-black text-white">Sign in to vote</p>
        <p className="mt-2 text-sm text-neutral-500">
          Voting requires an account so the Elo can&apos;t be gamed. The
          leaderboard is public.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-[#ff6d1b] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ff8a47]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (state.kind === "exhausted") {
    return (
      <div className="py-20 text-center">
        <p className="text-xl font-black text-white">
          You&apos;ve judged every matchup 🏁
        </p>
        <Link
          href="/leaderboard"
          className="mt-6 inline-block rounded-lg bg-[#ff6d1b] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ff8a47]"
        >
          See the damage
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-400">Something broke: {state.message}</p>
        <button
          onClick={loadMatchup}
          className="mt-4 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const { matchup, winnerId, delta } = state;
  const resultFor = (p: PersonPublic): "winner" | "loser" | null =>
    winnerId === null ? null : winnerId === p.id ? "winner" : "loser";

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <PersonCard
          person={matchup.a}
          side="left"
          disabled={winnerId !== null}
          result={resultFor(matchup.a)}
          onVote={() => vote(matchup.a, matchup.b)}
        />
        <div className="flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#ff6d1b] font-mono text-sm font-black text-[#ff6d1b] shadow-[0_0_30px_-8px_rgba(255,109,27,0.7)]">
            VS
          </span>
        </div>
        <PersonCard
          person={matchup.b}
          side="right"
          disabled={winnerId !== null}
          result={resultFor(matchup.b)}
          onVote={() => vote(matchup.b, matchup.a)}
        />
      </div>
      <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-600">
        {winnerId && delta ? (
          <span className="text-[#ff6d1b]">
            +{delta} elo — next matchup…
          </span>
        ) : (
          <>click a card — or use ← → keys</>
        )}
      </p>
    </div>
  );
}
