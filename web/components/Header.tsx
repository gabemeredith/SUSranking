import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
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
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-black text-white">
              S
            </span>
            <span className="text-lg font-black tracking-tight">
              SUS RANKING
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium text-neutral-500">
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              Vote
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-full px-3 py-1.5 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              Leaderboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!supabaseConfigured ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-700">
              demo
            </span>
          ) : email ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-2">
              <span className="hidden text-xs text-neutral-400 sm:inline">{email}</span>
              <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-400">
                Sign out
              </button>
            </form>
          ) : (
            <ButtonLink href="/login" size="sm">
              Sign in →
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
