import { VoteArena } from "@/components/VoteArena";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#ff6d1b]">
          The Matchup
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
          Who&apos;s more cracked?
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          Head-to-head votes on Startup School &rsquo;26 attendees. Elo settles it.
        </p>
      </div>
      <VoteArena />
    </main>
  );
}
