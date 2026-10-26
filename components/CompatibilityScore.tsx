"use client";

import { useState } from "react";
import {
  Heart,
  Sparkles,
  MessageCircle,
  Compass,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  calculateCompatibility,
  type CompatibilityProfile,
} from "@/lib/compatibility";

type Props = {
  currentUser: CompatibilityProfile;
  otherUser: CompatibilityProfile;
  compact?: boolean;
};

export default function CompatibilityScore({
  currentUser,
  otherUser,
  compact = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const result = calculateCompatibility(currentUser, otherUser);

  const scoreColor =
    result.score >= 75
      ? "text-pink-600"
      : result.score >= 50
        ? "text-rose-500"
        : "text-slate-600";

  const scoreBackground =
    result.score >= 75
      ? "bg-pink-50 border-pink-100"
      : result.score >= 50
        ? "bg-rose-50 border-rose-100"
        : "bg-slate-50 border-slate-100";

  return (
    <section
      aria-label="Compatibility overview"
      className={`rounded-2xl border border-rose-100 bg-white ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid shrink-0 place-items-center rounded-xl border ${scoreBackground} ${
            compact ? "size-11" : "size-14"
          }`}
        >
          <Heart
            size={compact ? 20 : 24}
            className={scoreColor}
            fill="currentColor"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Soul compatibility
          </p>

          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${scoreColor}`}>
              {result.score}%
            </span>
            <span className="text-xs text-slate-400">preference overlap</span>
          </div>
        </div>

        {!compact && <Sparkles size={20} className="shrink-0 text-pink-400" />}
      </div>

      {!compact && (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          {result.explanation}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-rose-50/70 px-3 py-2.5 text-left text-sm font-semibold text-pink-700 transition hover:bg-rose-100/70"
      >
        <span className="flex items-center gap-2">
          <Compass size={16} />
          {expanded ? "Hide shared preferences" : "See what you share"}
        </span>

        {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <SharedList
            title="Values in common"
            items={result.sharedValues}
            emptyText="No shared values selected yet."
          />

          <SharedList
            title="Interests in common"
            items={result.sharedInterests}
            emptyText="No shared interests selected yet."
          />

          <div className="grid grid-cols-2 gap-3">
            <ScoreDetail label="Values" score={result.breakdown.values} />
            <ScoreDetail label="Interests" score={result.breakdown.interests} />
            <ScoreDetail
              label="Communication"
              score={result.breakdown.communication}
            />
            <ScoreDetail
              label="Connection pace"
              score={result.breakdown.pace}
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <MessageCircle
              size={16}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <p className="text-xs leading-5 text-slate-500">
              This score reflects selected preferences, not a prediction of
              relationship success. Different preferences can also complement
              each other.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function SharedList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        {title}
      </p>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-pink-100 bg-pink-50 px-3 py-1.5 text-xs font-semibold capitalize text-pink-700"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function ScoreDetail({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl border border-rose-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-800">{score}%</p>
    </div>
  );
}
