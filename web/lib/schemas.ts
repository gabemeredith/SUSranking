import { z } from "zod";

/**
 * Single source of truth for every data shape in the app.
 * DB rows, API payloads, and importer inputs are all validated against these
 * at the boundary — nothing crosses a layer unparsed.
 */

// ---------------------------------------------------------------------------
// raw_profile: the structured enrichment data blurbs are generated from.
// Known fields are typed; anything else the scraper/importer finds is kept
// under its original key (catchall) so no data is silently dropped.
// ---------------------------------------------------------------------------
export const RawProfileSchema = z
  .object({
    bio: z.string().optional(),
    experience: z.array(z.string()).optional(),
    awards: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
    publications: z.array(z.string()).optional(),
    links: z.record(z.string(), z.string()).optional(),
  })
  .catchall(z.unknown());
export type RawProfile = z.infer<typeof RawProfileSchema>;

// ---------------------------------------------------------------------------
// people table row (matches supabase/migrations/0001_init.sql)
// ---------------------------------------------------------------------------
export const PersonRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  school: z.string().nullable(),
  headline: z.string().nullable(),
  photo_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  website_url: z.string().nullable(),
  blurb: z.string().nullable(),
  raw_profile: RawProfileSchema,
  elo: z.number().int(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  vote_count: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type PersonRow = z.infer<typeof PersonRowSchema>;

// What the client ever sees: no raw_profile, no timestamps.
export const PersonPublicSchema = PersonRowSchema.omit({
  raw_profile: true,
  created_at: true,
});
export type PersonPublic = z.infer<typeof PersonPublicSchema>;

export function toPublicPerson(row: PersonRow): PersonPublic {
  // .parse strips the private fields
  return PersonPublicSchema.parse(row);
}

// ---------------------------------------------------------------------------
// API contracts
// ---------------------------------------------------------------------------
export const MatchupSchema = z.object({
  a: PersonPublicSchema,
  b: PersonPublicSchema,
});
export type Matchup = z.infer<typeof MatchupSchema>;

export const MatchupResponseSchema = z.object({
  matchup: MatchupSchema.nullable(),
  demo: z.boolean(),
});
export type MatchupResponse = z.infer<typeof MatchupResponseSchema>;

export const VoteRequestSchema = z
  .object({
    winnerId: z.string().uuid(),
    loserId: z.string().uuid(),
  })
  .refine((v) => v.winnerId !== v.loserId, {
    message: "winner and loser must differ",
  });
export type VoteRequest = z.infer<typeof VoteRequestSchema>;

export const VoteResultSchema = z.object({
  winner_elo: z.number().int(),
  loser_elo: z.number().int(),
  delta: z.number().int().positive(),
});
export type VoteResult = z.infer<typeof VoteResultSchema>;

export const ApiErrorSchema = z.object({ error: z.string() });

// Shape returned by the get_matchup Postgres function (jsonb)
export const RpcMatchupSchema = z
  .object({ a: PersonRowSchema, b: PersonRowSchema })
  .nullable();

export const LeaderboardPageSchema = z.object({
  entries: z.array(PersonPublicSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
});
export type LeaderboardPage = z.infer<typeof LeaderboardPageSchema>;

// ---------------------------------------------------------------------------
// Importer input (scripts/import.ts, scripts/scrape-uncsus.ts output)
// ---------------------------------------------------------------------------
const urlOrNull = z.preprocess(
  (v) => {
    if (typeof v !== "string" || !v.trim()) return null;
    const s = v.trim();
    const candidate = /^https?:\/\//.test(s) ? s : `https://${s}`;
    return z.string().url().safeParse(candidate).success ? candidate : null;
  },
  z.string().nullable()
);

export const PersonInputSchema = z.object({
  name: z.string().trim().min(1),
  school: z.string().trim().min(1).nullish().default(null),
  headline: z.string().trim().min(1).nullish().default(null),
  photo_url: urlOrNull.default(null),
  linkedin_url: urlOrNull.default(null),
  website_url: urlOrNull.default(null),
  blurb: z.string().trim().min(1).nullish().default(null),
  raw_profile: RawProfileSchema.default({}),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Canonical undirected pair id — matches the generated pair_key column. */
export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join(":");
}
