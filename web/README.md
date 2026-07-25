# SUS Ranking — web app

Next.js (App Router) + Supabase. Head-to-head voting on Startup School 2026 attendees, Elo ratings, public leaderboard.

## How it works

- **Vote page (`/`)** — serves a matchup of two attendees; click a card to vote. Voting requires login (magic link or Google) so the Elo can't be gamed; one vote per person-pair per voter, enforced by a DB unique constraint.
- **Leaderboard (`/leaderboard`)** — public, no login. Elo (K=32, start 1000), W–L record.
- **Matchmaking** — people with the fewest votes are prioritized, paired within an expanding Elo window (±150 → ±300 → ±600 → any) so rankings converge fast. Pairs the voter has already judged are excluded.
- **Elo updates** — computed atomically in Postgres (`record_vote` function, `SECURITY DEFINER`, row locks in deterministic order), so concurrent votes can't corrupt ratings.
- **Demo mode** — if Supabase env vars are absent, the app runs entirely in memory on `data/seed.json` (24 mock profiles) with no login. State resets on server restart. Great for local dev and demos.

## Setup

### 1. Demo mode (no config)

```bash
npm install
npm run dev
```

### 2. Real stack (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (creates `people`, `votes`, RLS policies, and the `record_vote` Elo function).
3. Auth → enable **Email (magic link)**; optionally enable **Google** OAuth. Add `http://localhost:3000/auth/callback` (and your prod URL) to the redirect allowlist.
4. `cp .env.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for scripts) `SUPABASE_SERVICE_ROLE_KEY`.
5. `npm run dev`.

Deploy: push to Vercel, set the same env vars.

## Data pipeline

All scripts run with `npx tsx scripts/<name>.ts` from `web/`. They read `.env.local`.

| Step | Script | Notes |
|---|---|---|
| 1. Scrape the attendee list | `scripts/scrape-uncsus.ts` | Pulls https://www.uncsus.com/ (the community-built ~300-person list) into `data/uncsus.json`. **Run on your own machine** — some sandboxes block the domain. If the list is loaded client-side, the script tells you how to grab the JSON from DevTools instead. |
| 2. Import | `scripts/import.ts data/uncsus.json` | Upserts into Supabase `people` (matches on name; never touches Elo). Also accepts CSV: columns `name, school, headline, linkedin_url, photo_url, website_url`, extra columns go into `raw_profile`. `--dry` to preview. |
| 3. Generate blurbs | `scripts/generate-blurbs.ts` | Uses Claude (`claude-opus-5`) to compile each person's `raw_profile` into the short accomplishments blurb shown on vote cards. Needs `ANTHROPIC_API_KEY`. Ships with Anthropic's server-side refusal fallback enabled (`fallbacks: "default"`); delete those two lines in the script if you don't want it. Pass a JSON file path to enrich a local file instead of Supabase. |
| (alt) Seed mocks into Supabase | `scripts/seed-demo.ts` | Pushes the bundled fake profiles into your real DB for testing. |

## A note on the humans involved

This ranks real people by name. Before going live: only include people from a source they opted into, honor removal requests immediately (delete the `people` row; votes cascade), and keep blurbs strictly factual — the blurb prompt already forbids invented claims.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind 4)
- Supabase (Postgres + Auth via `@supabase/ssr`)
- Elo math in `lib/elo.ts`, matchmaking in `lib/matchmaking.ts` (both pure and unit-testable)
- Anthropic SDK for blurb generation (scripts only, no runtime dependency)
