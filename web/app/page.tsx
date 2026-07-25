import { VoteArena } from "@/components/vote/VoteArena";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Who&apos;s more
          <br />
          <span className="text-accent">cracked?</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md font-mono text-sm text-neutral-500">
          Compare two Startup School &rsquo;26 builders. Vote your gut.
        </p>
      </div>
      <VoteArena />
    </main>
  );
}
