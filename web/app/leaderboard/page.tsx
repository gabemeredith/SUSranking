import Link from "next/link";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getLeaderboardPage } from "@/lib/data";
import { LeaderboardPage as LeaderboardPageData, PersonPublic } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Public data → cache pages for 15s so heavy traffic doesn't hammer Postgres.
const getCachedLeaderboardPage = unstable_cache(
  async (page: number): Promise<LeaderboardPageData> =>
    getLeaderboardPage(createAnonClient(), page),
  ["leaderboard"],
  { revalidate: 15 }
);

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);

  const { entries, total, pageSize } = isSupabaseConfigured()
    ? await getCachedLeaderboardPage(page)
    : await getLeaderboardPage(null, page);

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const firstRank = page * pageSize;

  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight">
          The <span className="text-accent">standings</span>
        </h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-neutral-400">
          elo · start 1000 · k=32 · {total} ranked
        </p>
      </div>

      <ol className="mt-10 space-y-2">
        {entries.map((person, index) => (
          <LeaderboardRow
            key={person.id}
            person={person}
            rank={firstRank + index}
          />
        ))}
      </ol>

      {total > pageSize && (
        <Pagination
          page={page}
          lastPage={lastPage}
          shown={entries.length}
          firstRank={firstRank}
          total={total}
        />
      )}
    </main>
  );
}

const MEDAL_STYLES: Record<number, string> = {
  0: "bg-accent text-white",
  1: "bg-neutral-200 text-neutral-700",
  2: "bg-amber-100 text-amber-800",
};

function LeaderboardRow({
  person,
  rank,
}: {
  person: PersonPublic;
  rank: number;
}) {
  const winRate =
    person.vote_count > 0
      ? Math.round((person.wins / person.vote_count) * 100)
      : null;

  return (
    <li
      className={`flex items-center gap-4 rounded-2xl border bg-white px-5 py-3.5 shadow-sm ${
        rank === 0 ? "border-accent/50" : "border-neutral-200"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
          MEDAL_STYLES[rank] ?? "text-neutral-400"
        }`}
      >
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-bold">{person.name}</span>
          {person.school && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
              {person.school}
            </span>
          )}
        </div>
        {person.blurb && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {person.blurb}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-mono text-sm font-bold ${rank === 0 ? "text-accent" : ""}`}>
          {person.elo}
        </div>
        <div className="font-mono text-[10px] text-neutral-400">
          {person.wins}W–{person.losses}L
          {winRate !== null && ` · ${winRate}%`}
        </div>
      </div>
    </li>
  );
}

function Pagination({
  page,
  lastPage,
  shown,
  firstRank,
  total,
}: {
  page: number;
  lastPage: number;
  shown: number;
  firstRank: number;
  total: number;
}) {
  const linkClass =
    "rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 transition hover:border-accent hover:text-accent";
  return (
    <nav className="mt-8 flex items-center justify-between">
      {page > 0 ? (
        <Link href={`/leaderboard?page=${page - 1}`} className={linkClass}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-[11px] text-neutral-400">
        {firstRank + 1}–{firstRank + shown} / {total}
      </span>
      {page < lastPage ? (
        <Link href={`/leaderboard?page=${page + 1}`} className={linkClass}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
