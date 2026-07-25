"use client";

import { PersonPublic } from "@/lib/schemas";

export function PersonCard({
  person,
  onVote,
  disabled,
  result,
  side,
}: {
  person: PersonPublic;
  onVote: () => void;
  disabled: boolean;
  result: "winner" | "loser" | null;
  side: "left" | "right";
}) {
  const initials = person.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <button
      onClick={onVote}
      disabled={disabled}
      className={`group relative flex w-full flex-col rounded-2xl border bg-neutral-900/80 p-6 text-left transition
        hover:-translate-y-1 hover:border-[#ff6d1b] hover:shadow-[0_0_40px_-12px_rgba(255,109,27,0.5)]
        disabled:cursor-default
        ${
          result === "winner"
            ? "border-green-500 shadow-[0_0_40px_-12px_rgba(34,197,94,0.6)]"
            : result === "loser"
              ? "border-neutral-800 opacity-40"
              : "border-neutral-800"
        }`}
    >
      <div className="flex items-center gap-4">
        {person.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photo_url}
            alt={person.name}
            className="h-14 w-14 rounded-full border border-neutral-700 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6d1b] to-[#c2410c] text-lg font-black text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black tracking-tight text-white">
            {person.name}
          </h2>
          {(person.school || person.headline) && (
            <p className="mt-0.5 truncate text-sm text-neutral-400">
              {person.school && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#ff9b5e]">
                  {person.school}
                </span>
              )}
              {person.school && person.headline && (
                <span className="text-neutral-600"> · </span>
              )}
              {person.headline}
            </p>
          )}
        </div>
      </div>

      {person.blurb && (
        <p className="mt-4 flex-1 text-sm leading-relaxed text-neutral-300">
          {person.blurb}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        {person.linkedin_url ? (
          <a
            href={person.linkedin_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 transition hover:text-[#ff6d1b]"
          >
            LinkedIn ↗
          </a>
        ) : (
          <span />
        )}
        <span className="rounded border border-neutral-700 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500 transition group-hover:border-[#ff6d1b] group-hover:text-[#ff6d1b]">
          {side === "left" ? "←" : "→"} pick
        </span>
      </div>

      {result === "winner" && (
        <span className="absolute -top-3 right-4 rounded bg-green-500 px-2.5 py-1 font-mono text-xs font-black text-black">
          WINNER
        </span>
      )}
    </button>
  );
}
