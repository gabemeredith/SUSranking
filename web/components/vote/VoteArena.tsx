"use client";

import { ButtonLink, Button } from "@/components/ui/Button";
import { PersonPublic } from "@/lib/schemas";
import { PersonCard } from "./PersonCard";
import { useVoteArena } from "./useVoteArena";

export function VoteArena() {
  const { state, loadMatchup, vote } = useVoteArena();

  switch (state.kind) {
    case "loading":
      return <CenterNote>Finding a matchup…</CenterNote>;

    case "login_required":
      return (
        <CenterBlock
          title="Sign in to vote"
          body="Voting requires an account so the Elo can't be gamed. The leaderboard is public."
        >
          <ButtonLink href="/login">Sign in</ButtonLink>
        </CenterBlock>
      );

    case "exhausted":
      return (
        <CenterBlock title="You've judged every matchup 🏁">
          <ButtonLink href="/leaderboard">See the standings</ButtonLink>
        </CenterBlock>
      );

    case "error":
      return (
        <CenterBlock title="Something broke" body={state.message}>
          <Button variant="outline" onClick={loadMatchup}>
            Retry
          </Button>
        </CenterBlock>
      );

    case "matchup": {
      const { matchup, winnerId, delta } = state;
      const resultFor = (person: PersonPublic) =>
        winnerId === null
          ? null
          : winnerId === person.id
            ? ("winner" as const)
            : ("loser" as const);

      return (
        <div>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <PersonCard
              person={matchup.a}
              side="left"
              disabled={winnerId !== null}
              result={resultFor(matchup.a)}
              delta={delta}
              onVote={() => vote(matchup.a, matchup.b)}
            />
            <div className="flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent bg-white font-mono text-xs font-extrabold text-accent shadow-sm">
                VS
              </span>
            </div>
            <PersonCard
              person={matchup.b}
              side="right"
              disabled={winnerId !== null}
              result={resultFor(matchup.b)}
              delta={delta}
              onVote={() => vote(matchup.b, matchup.a)}
            />
          </div>
          <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-400">
            {winnerId && delta ? (
              <span className="text-accent">elo updated — next matchup…</span>
            ) : (
              <>click a card — or vote with ← → keys</>
            )}
          </p>
        </div>
      );
    }
  }
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.3em] text-neutral-400">
      {children}
    </div>
  );
}

function CenterBlock({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-20 text-center">
      <p className="text-xl font-extrabold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">{body}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
