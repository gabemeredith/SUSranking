"use client";

import { PersonPublic } from "@/lib/schemas";

export type CardResult = "winner" | "loser" | null;

export function PersonCard({
  person,
  onVote,
  disabled,
  result,
  delta,
  side,
}: {
  person: PersonPublic;
  onVote: () => void;
  disabled: boolean;
  result: CardResult;
  delta: number | null;
  side: "left" | "right";
}) {
  return (
    <button
      onClick={onVote}
      disabled={disabled}
      aria-label={`Vote for ${person.name}`}
      className={`group relative flex w-full flex-col overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition
        hover:-translate-y-1 hover:border-accent hover:shadow-lg disabled:cursor-default
        ${
          result === "winner"
            ? "border-accent shadow-[0_8px_30px_-12px_rgba(255,102,0,0.45)]"
            : result === "loser"
              ? "border-neutral-200 opacity-45"
              : "border-neutral-200"
        }`}
    >
      <div className="flex flex-1 flex-col p-6">
        <SchoolChip school={person.school} />

        <div className="mt-4 flex items-center gap-4">
          <Avatar person={person} />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight">
              {person.name}
            </h2>
            {person.headline && (
              <p className="mt-0.5 truncate text-sm text-neutral-500">
                {person.headline}
              </p>
            )}
          </div>
        </div>

        {person.blurb && (
          <p className="mt-4 text-sm leading-relaxed text-neutral-700">
            {person.blurb}
          </p>
        )}

        {person.experience.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4">
            {person.experience.map((line) => (
              <li
                key={line}
                className="flex items-baseline gap-2 text-sm text-neutral-600"
              >
                <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-accent/60" />
                <span className="truncate">{line}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-5">
          <StatsRow person={person} result={result} delta={delta} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-6 py-3">
        {person.linkedin_url ? (
          <a
            href={person.linkedin_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 transition hover:text-accent"
          >
            LinkedIn ↗
          </a>
        ) : (
          <span />
        )}
        <kbd className="rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition group-hover:border-accent group-hover:text-accent">
          {side === "left" ? "←" : "→"} pick
        </kbd>
      </div>

      {result === "winner" && (
        <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 font-mono text-xs font-bold text-white">
          WINNER
        </span>
      )}
    </button>
  );
}

function SchoolChip({ school }: { school: string | null }) {
  if (!school) return <span className="h-6" />;
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
      <span className="h-2 w-2 rounded-full bg-accent" />
      {school}
    </span>
  );
}

function Avatar({ person }: { person: PersonPublic }) {
  if (person.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.photo_url}
        alt=""
        className="h-14 w-14 rounded-full border border-neutral-200 object-cover"
      />
    );
  }
  const initials = person.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-lg font-extrabold text-accent">
      {initials}
    </div>
  );
}

/**
 * Elo / record / votes. Values stay hidden until the vote lands so numbers
 * can't bias the matchup; the winner's cell shows the fresh delta.
 */
function StatsRow({
  person,
  result,
  delta,
}: {
  person: PersonPublic;
  result: CardResult;
  delta: number | null;
}) {
  const revealed = result !== null;
  const elo =
    !revealed || delta === null
      ? person.elo
      : result === "winner"
        ? person.elo + delta
        : person.elo - delta;

  const cells: Array<{ label: string; value: string; highlight?: boolean }> = [
    {
      label: "elo",
      value: revealed ? String(elo) : "?",
      highlight: result === "winner",
    },
    {
      label: "record",
      value: revealed
        ? `${person.wins + (result === "winner" ? 1 : 0)}W–${person.losses + (result === "loser" ? 1 : 0)}L`
        : "?",
    },
    { label: "votes", value: revealed ? String(person.vote_count + 1) : "?" },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-neutral-100 rounded-xl border border-neutral-100 bg-neutral-50/60">
      {cells.map((cell) => (
        <div key={cell.label} className="px-3 py-2.5 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400">
            {cell.label}
          </div>
          <div
            className={`mt-0.5 font-mono text-sm font-bold ${
              cell.highlight ? "text-accent" : revealed ? "" : "text-neutral-300"
            }`}
          >
            {cell.value}
            {cell.highlight && delta !== null && (
              <span className="ml-1 text-[11px] font-bold text-accent">
                +{delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
