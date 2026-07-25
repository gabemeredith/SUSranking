# SUSranking

Open source project to rank the most cracked Startup School 2026 attendees.

Head-to-head voting ("who's accomplished more?") → Elo ratings (K=32, start 1000) → public leaderboard.

**The app lives in [`web/`](web/) — see [`web/README.md`](web/README.md) for setup, the data pipeline (scraper → import → AI blurbs), and deployment.**

## Quick start (demo mode, zero config)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 — runs on 24 in-memory mock profiles with no login required, so you can try voting and the leaderboard immediately. Configure Supabase (see `web/README.md`) to switch on real persistence + login-gated voting.
