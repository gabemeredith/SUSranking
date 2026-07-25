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
    <header className="border-b border-neutral-800/80 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-[#ff6d1b] font-black text-white">
            S
          </span>
          <span className="text-lg font-black tracking-tight text-white">
            SUS&nbsp;RANKING
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 sm:inline">
            Startup School &rsquo;26
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-300">
          <Link href="/" className="transition hover:text-[#ff6d1b]">
            Vote
          </Link>
          <Link href="/leaderboard" className="transition hover:text-[#ff6d1b]">
            Leaderboard
          </Link>
          {!supabaseConfigured ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-400">
              demo
            </span>
          ) : email ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-2">
              <span className="hidden text-xs text-neutral-500 sm:inline">{email}</span>
              <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white">
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[#ff6d1b] px-3.5 py-1.5 text-xs font-bold text-black transition hover:bg-[#ff8a47]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
