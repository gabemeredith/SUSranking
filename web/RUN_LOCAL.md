# Run SUS Ranking on your PC — start to finish

Everything below runs from the `web/` directory on your own machine (the cloud
sandbox can't reach uncsus.com, so the data steps must happen locally).

```bash
git clone https://github.com/gabemeredith/SUSranking
cd SUSranking
git checkout claude/startup-school-leaderboard-4w8351
cd web
npm install
```

## 0. Quick sanity check (demo mode, 2 minutes)

No config needed — runs on bundled mock profiles, no login:

```bash
npm run dev
# open http://localhost:3000  → vote with ← → keys, check /leaderboard
```

## 1. Set up Supabase (the real backend)

1. Create a free project at https://supabase.com → note the **Project URL**,
   **anon key**, and **service_role key** (Settings → API).
2. SQL Editor → run these three files **in order** (paste each, hit Run):
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_scale.sql`
   - `supabase/migrations/0003_linkedin_gate.sql`
3. Authentication → Providers → enable **Email** (magic link).
   Optionally enable **Google** (needs a Google OAuth client).
4. Authentication → URL Configuration → add
   `http://localhost:3000/auth/callback` to Redirect URLs.
5. Configure env:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # scripts only, never deployed to a browser
ANTHROPIC_API_KEY=<for blurb generation>
PROXYCURL_API_KEY=<for LinkedIn enrichment, see step 4>
```

## 2. Scrape the attendee list (uncsus.com/people)

The `/people` page is behind login. **Never paste your password anywhere** —
the script only needs your browser's session cookie:

1. Log in to https://www.uncsus.com in Chrome.
2. Open DevTools (F12) → **Network** tab → reload `/people`.
3. Click the top `people` request → **Headers** → *Request Headers* → copy the
   entire value of the `cookie:` header.
4. Run:

```bash
UNCSUS_COOKIE='<paste cookie here>' npm run scrape
```

That writes `data/uncsus.json` (validated: name + whatever school/headline/
LinkedIn/photo fields the site exposes; extra fields are preserved in
`raw_profile`).

**If the script can't find the data automatically** (site fetches it at
runtime): it saves the HTML and prints instructions — in short: DevTools →
Network → **Fetch/XHR** → find the JSON response containing the attendee
array → right-click → *Copy response* → save as `data/uncsus-raw.json` → then:

```bash
npx tsx scripts/scrape-uncsus.ts data/uncsus-raw.json
```

## 3. Import into Supabase

```bash
npm run import -- data/uncsus.json          # add --dry first to preview
```

- Rows **without a LinkedIn URL are skipped automatically** (dummy accounts).
  Even if some sneak in via `--allow-no-linkedin`, the DB-level gate keeps
  them out of matchups and the leaderboard.
- Re-running is safe: existing people are matched by name, profile fields are
  refreshed, Elo/votes are never touched.

## 4. Enrich profiles from LinkedIn

Uses [Proxycurl](https://nubela.co/proxycurl) by default (sign up, grab an API
key — enrichment costs ~1 credit/profile, so test with `--limit` first):

```bash
npm run enrich -- --limit 5     # trial run on 5 people
npm run enrich                  # everyone with a LinkedIn and no enrichment yet
```

Stores the full profile response in `raw_profile.linkedin`, flattens work
history into `raw_profile.experience`, and fills in empty
`headline`/`school`/`photo_url` (never overwrites existing values).
Different provider? Add a function to `scripts/enrich-linkedin.ts` — the
`Provider` interface is one function: LinkedIn URL in, profile out.

## 5. Generate the card copy (blurb + one-liner)

```bash
npm run blurbs
```

One Claude call per person (`claude-opus-5`, structured output) produces both:

- the 1–2 sentence accomplishments **blurb**, and
- the short **one-liner** under their name (e.g. "Sports analytics founder").

The one-liner fills `headline` when it's missing or looks like a raw LinkedIn
headline ("Building X | prev @ Y"). Existing clean headlines are kept; run
`npm run blurbs -- --rewrite-headlines` to regenerate all of them. Only people
missing a blurb are processed, so re-running after new imports is cheap.

## 6. Run / deploy

```bash
npm run dev        # local, against your Supabase
```

Deploy: push the repo to Vercel, set the two `NEXT_PUBLIC_SUPABASE_*` env vars
(NOT the service key — that stays local for scripts), add your production URL
to Supabase's redirect allowlist.

## Order of operations, condensed

```bash
UNCSUS_COOKIE='...' npm run scrape        # → data/uncsus.json
npm run import -- data/uncsus.json        # → Supabase people table (LinkedIn-gated)
npm run enrich -- --limit 5               # test enrichment, then run full
npm run enrich
npm run blurbs                            # AI blurbs for the cards
npm run dev                               # vote
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run scrape` says login wall | Cookie missing/expired — re-copy it from DevTools |
| Scraper finds nothing | Use the DevTools manual fallback in step 2 |
| Import inserts 0 people | Check the JSON has `linkedin_url` fields; try `--dry` |
| `rate_limited` errors while voting | Working as intended — 30 votes/min/voter cap |
| Person shows no blurb | They were imported after the last `npm run blurbs` run — re-run it |
| Vote 401s | Not signed in; magic-link redirect URL must be allowlisted in Supabase |
