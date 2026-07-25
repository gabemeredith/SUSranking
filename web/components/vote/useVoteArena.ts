"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchMatchup, submitVote } from "@/lib/api";
import { Matchup, PersonPublic } from "@/lib/schemas";

const NEXT_MATCHUP_DELAY_MS = 1100;
const ERROR_RETRY_DELAY_MS = 400;

export type ArenaState =
  | { kind: "loading" }
  | { kind: "login_required" }
  | { kind: "exhausted" }
  | { kind: "error"; message: string }
  | {
      kind: "matchup";
      matchup: Matchup;
      winnerId: string | null;
      delta: number | null;
    };

/**
 * State machine for the voting arena: load matchup → vote → reveal result →
 * auto-advance. Also wires ←/→ keyboard voting.
 */
export function useVoteArena() {
  const [state, setState] = useState<ArenaState>({ kind: "loading" });

  const loadMatchup = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const { matchup } = await fetchMatchup();
      setState(
        matchup
          ? { kind: "matchup", matchup, winnerId: null, delta: null }
          : { kind: "exhausted" }
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState({ kind: "login_required" });
      } else {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "failed to load",
        });
      }
    }
  }, []);

  useEffect(() => {
    loadMatchup();
  }, [loadMatchup]);

  const vote = useCallback(
    async (winner: PersonPublic, loser: PersonPublic) => {
      let accepted = false;
      setState((prev) => {
        if (prev.kind !== "matchup" || prev.winnerId) return prev;
        accepted = true;
        return { ...prev, winnerId: winner.id };
      });
      if (!accepted) return;

      try {
        const result = await submitVote({
          winnerId: winner.id,
          loserId: loser.id,
        });
        setState((prev) =>
          prev.kind === "matchup" ? { ...prev, delta: result.delta } : prev
        );
        setTimeout(loadMatchup, NEXT_MATCHUP_DELAY_MS);
      } catch {
        // e.g. pair already voted in another tab — just serve the next one
        setTimeout(loadMatchup, ERROR_RETRY_DELAY_MS);
      }
    },
    [loadMatchup]
  );

  // ←/→ pick the left/right card.
  useEffect(() => {
    if (state.kind !== "matchup" || state.winnerId) return;
    const { a, b } = state.matchup;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") vote(a, b);
      if (event.key === "ArrowRight") vote(b, a);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, vote]);

  return { state, loadMatchup, vote };
}
