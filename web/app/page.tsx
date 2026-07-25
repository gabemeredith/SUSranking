import { VoteArena } from "@/components/VoteArena";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight">
          Who&apos;s cooking harder?
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Head-to-head votes on Startup School 2026 attendees. Elo does the
          rest.
        </p>
      </div>
      <VoteArena />
    </main>
  );
}
