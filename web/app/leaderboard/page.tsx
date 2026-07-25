import Link from "next/link";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getLeaderboardPage } from "@/lib/data";
import { LeaderboardPage as LeaderboardPageData } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Public data → cache pages for 15s so heavy traffic doesn't hammer Postgres.
const getCachedLeaderboardPage = unstable_cache(
  async (page: number): Promise<LeaderboardPageData> =>
    getLeaderboardPage(createAnonClient(), page),
  ["leaderboard"],
  { revalidate: 15 }
);

const RANK_STYLES: Record<number, string> = {
  0: "text-amber-400",
  1: "text-neutral-300",
  2: "text-[#ff9b5e]",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);

  const data = isSupabaseConfigured()
    ? await getCachedLeaderboardPage(page)
    : await getLeaderboardPage(null, page);

  const { entries, total, pageSize } = data;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const firstRank = page * pageSize;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#ff6d1b]">
          The Standings
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
          Leaderboard
        </h1>
        <p className="mt-3 font-mono text-xs text-neutral-500">
          ELO · START 1000 · K=32 · {total} RANKED
        </p>
      </div>

      <ol className="mt-10 space-y-2">
        {entries.map((person, index) => {
          const rank = firstRank + index;
          return (
            <li
              key={person.id}
              className={`flex items-center gap-4 rounded-xl border bg-neutral-900/70 px-4 py-3 ${
                rank === 0 ? "border-[#ff6d1b]/60" : "border-neutral-800"
              }`}
            >
              <span
                className={`w-9 text-center font-mono text-sm font-black ${
                  RANK_STYLES[rank] ?? "text-neutral-600"
                }`}
              >
                {rank + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-bold text-white">
                    {person.name}
                  </span>
                  {person.school && (
                    <span className="truncate font-mono text-[10px] uppercase tracking-wider text-[#ff9b5e]">
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
              <div className="text-right">
                <div
                  className={`font-mono text-sm font-black ${
                    rank === 0 ? "text-[#ff6d1b]" : "text-white"
                  }`}
                >
                  {person.elo}
                </div>
                <div className="font-mono text-[10px] text-neutral-500">
                  {person.wins}W–{person.losses}L
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {total > pageSize && (
        <nav className="mt-8 flex items-center justify-between text-sm">
          {page > 0 ? (
            <Link
              href={`/leaderboard?page=${page - 1}`}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-neutral-300 transition hover:border-[#ff6d1b] hover:text-[#ff6d1b]"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] text-neutral-500">
            {firstRank + 1}–{Math.min(firstRank + entries.length, total)} / {total}
          </span>
          {page < lastPage ? (
            <Link
              href={`/leaderboard?page=${page + 1}`}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-neutral-300 transition hover:border-[#ff6d1b] hover:text-[#ff6d1b]"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
