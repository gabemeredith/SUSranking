import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = isSupabaseConfigured()
    ? await createSupabaseServerClient()
    : null;
  const people = await getLeaderboard(supabase);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-center text-3xl font-black tracking-tight">
        Leaderboard
      </h1>
      <p className="mt-2 text-center text-sm text-neutral-500">
        Elo starts at 1000, K=32. Rankings sharpen as votes come in.
      </p>

      <ol className="mt-8 space-y-2">
        {people.map((person, index) => (
          <li
            key={person.id}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <span
              className={`w-8 text-center text-sm font-black ${
                index === 0
                  ? "text-amber-500"
                  : index === 1
                    ? "text-neutral-400"
                    : index === 2
                      ? "text-orange-700"
                      : "text-neutral-300 dark:text-neutral-600"
              }`}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-semibold">{person.name}</span>
                {person.school && (
                  <span className="truncate text-xs text-neutral-400">
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
              <div className="font-mono text-sm font-bold">{person.elo}</div>
              <div className="text-xs text-neutral-400">
                {person.wins}W–{person.losses}L
              </div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
