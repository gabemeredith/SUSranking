"use client";

import {
  MatchupResponse,
  MatchupResponseSchema,
  VoteRequest,
  VoteResult,
  VoteResultSchema,
} from "./schemas";

/**
 * Typed client for the app's API routes. Every response is zod-parsed, and
 * failures throw an ApiError carrying the server's error code so callers can
 * branch on it (`login_required`, `already_voted`, `rate_limited`, …).
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = "ApiError";
  }
}

async function request<T>(
  input: string,
  init: RequestInit,
  parse: (json: unknown) => T
): Promise<T> {
  const res = await fetch(input, init);
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code =
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error: unknown }).error)
        : "unknown_error";
    throw new ApiError(code, res.status);
  }
  return parse(json);
}

export function fetchMatchup(): Promise<MatchupResponse> {
  return request("/api/matchup", { cache: "no-store" }, (json) =>
    MatchupResponseSchema.parse(json)
  );
}

export function submitVote(vote: VoteRequest): Promise<VoteResult> {
  return request(
    "/api/vote",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vote),
    },
    (json) => VoteResultSchema.parse(json)
  );
}
