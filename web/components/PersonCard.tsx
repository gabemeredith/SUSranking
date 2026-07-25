"use client";

import { Person } from "@/lib/types";

export function PersonCard({
  person,
  onVote,
  disabled,
  result,
}: {
  person: Person;
  onVote: () => void;
  disabled: boolean;
  result: "winner" | "loser" | null;
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
      className={`group relative flex w-full flex-col rounded-2xl border bg-white p-6 text-left shadow-sm transition
        hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-md disabled:cursor-default
        dark:bg-neutral-900
        ${
          result === "winner"
            ? "border-green-500 ring-2 ring-green-500/40"
            : result === "loser"
              ? "border-neutral-200 opacity-50 dark:border-neutral-800"
              : "border-neutral-200 dark:border-neutral-800"
        }`}
    >
      <div className="flex items-center gap-4">
        {person.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photo_url}
            alt={person.name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            {initials}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold">{person.name}</h2>
          <p className="text-sm text-neutral-500">
            {[person.school, person.headline].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {person.blurb && (
        <p className="mt-4 flex-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {person.blurb}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        {person.linkedin_url ? (
          <a
            href={person.linkedin_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-neutral-400 underline-offset-2 hover:text-orange-600 hover:underline"
          >
            LinkedIn ↗
          </a>
        ) : (
          <span />
        )}
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 opacity-0 transition group-hover:opacity-100 dark:bg-neutral-800">
          Pick {person.name.split(" ")[0]}
        </span>
      </div>

      {result === "winner" && (
        <span className="absolute -top-3 right-4 rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
          +Elo
        </span>
      )}
    </button>
  );
}
