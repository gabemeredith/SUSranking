import Link from "next/link";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function Header() {
  let email: string | null = null;
  const supabaseConfigured = isSupabaseConfigured();
  if (supabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-black tracking-tight text-orange-600">
            SUS
          </span>
          <span className="text-lg font-semibold tracking-tight">Ranking</span>
          <span className="hidden text-xs text-neutral-400 sm:inline">
            Startup School 2026
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-orange-600">
            Vote
          </Link>
          <Link href="/leaderboard" className="hover:text-orange-600">
            Leaderboard
          </Link>
          {!supabaseConfigured ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              demo mode
            </span>
          ) : email ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-2">
              <span className="hidden text-xs text-neutral-400 sm:inline">{email}</span>
              <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
