"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send");
      setStatus("error");
    }
  }

  async function signInWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (!supabaseConfigured) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-black">Demo mode</h1>
        <p className="mt-4 text-sm text-neutral-500">
          Supabase isn&apos;t configured, so the app is running with in-memory
          seed data and no login is needed. Head back and start voting.
        </p>
        <div className="mt-6">
          <ButtonLink href="/">Start voting</ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <h1 className="text-center text-2xl font-black">Sign in to vote</h1>
      <p className="mt-2 text-center text-sm text-neutral-500">
        One vote per matchup. No bots, no spam — that&apos;s the whole point.
      </p>

      {status === "sent" ? (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
          Magic link sent to <span className="font-bold">{email}</span>. Check
          your inbox.
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="mt-8 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-accent"
          />
          <Button type="submit" disabled={status === "sending"} className="w-full">
            {status === "sending" ? "Sending…" : "Email me a magic link"}
          </Button>
          {status === "error" && (
            <p className="text-center text-sm text-red-600">{errorMessage}</p>
          )}
        </form>
      )}

      <div className="mt-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        or
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="mt-6">
        <Button variant="outline" onClick={signInWithGoogle} className="w-full">
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
