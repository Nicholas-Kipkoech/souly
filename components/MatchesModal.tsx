"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  X,
  LoaderCircle,
  Users,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  age: number | null;
  photo_url: string | null;
};

type MatchProfile = {
  id: string;
  created_at: string;
  profile: ProfileRow;
};

type MatchesModalProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
};

export default function MatchesModal({
  open,
  onClose,
  userId,
}: MatchesModalProps) {
  const [supabase] = useState(() => createClient());
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMatches = useCallback(async () => {
    if (!userId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: matchError } = await supabase
        .from("matches")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (matchError) throw matchError;

      const rows = (data ?? []) as MatchRow[];

      if (rows.length === 0) {
        setMatches([]);
        return;
      }

      const otherIds = [
        ...new Set(
          rows.map((match) =>
            match.user_a === userId ? match.user_b : match.user_a,
          ),
        ),
      ];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, age, photo_url")
        .in("user_id", otherIds);

      if (profileError) throw profileError;

      const profileMap = new Map(
        ((profiles ?? []) as ProfileRow[]).map((profile) => [
          profile.user_id,
          profile,
        ]),
      );

      const result: MatchProfile[] = rows.flatMap((match) => {
        const otherId = match.user_a === userId ? match.user_b : match.user_a;
        const profile = profileMap.get(otherId);

        return profile
          ? [{ id: match.id, created_at: match.created_at, profile }]
          : [];
      });

      setMatches(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load matches. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  // Load when opened, then subscribe to changes while visible.
  useEffect(() => {
    if (!open || !userId) return;

    let active = true;

    const refresh = () => {
      if (active) void loadMatches();
    };

    const channel = supabase
      .channel(`soully-matches-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          // INSERT has a new row; DELETE may have an old row.
          // Refresh only when the event concerns this user.
          const row = (
            payload.eventType === "DELETE" ? payload.old : payload.new
          ) as Partial<MatchRow>;

          if (row.user_a === userId || row.user_b === userId) {
            refresh();
          } else if (
            payload.eventType === "DELETE" &&
            (!row.user_a || !row.user_b)
          ) {
            // A DELETE payload can omit non-key columns.
            // Re-query safely instead of assuming which match was removed.
            refresh();
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Reconcile with the database after connecting.
          refresh();
        }
      });

    // Fetch immediately so the modal doesn't wait for subscription setup.
    refresh();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [open, userId, supabase, loadMatches]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="soully-matches-title"
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-2xl"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 px-6 py-6 text-white sm:px-7">
          <div className="pointer-events-none absolute -right-8 -top-12 size-40 rounded-full bg-white/10" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-bold">
                <Heart size={13} fill="currentColor" />
                Mutual connections
              </span>
              <h2
                id="soully-matches-title"
                className="mt-4 text-3xl font-black tracking-tight"
              >
                Your matches
              </h2>
              <p className="mt-1.5 text-sm text-white/85">
                New connections appear here automatically.
              </p>
            </div>

            <button
              onClick={onClose}
              aria-label="Close matches"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
            >
              <X size={20} />
            </button>
          </div>

          {!loading && !error && (
            <div className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2">
              <Users size={17} />
              <span className="text-sm font-extrabold">
                {matches.length}{" "}
                {matches.length === 1 ? "connection" : "connections"}
              </span>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && matches.length === 0 ? (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <LoaderCircle
                  size={30}
                  className="mx-auto animate-spin text-rose-500"
                />
                <p className="mt-4 font-bold text-slate-800">
                  Loading your matches...
                </p>
              </div>
            </div>
          ) : error && matches.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-4 text-center">
              <p role="alert" className="text-sm leading-6 text-rose-600">
                {error}
              </p>
              <button
                onClick={() => void loadMatches()}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-bold text-white"
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="grid min-h-64 place-items-center px-5 text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-rose-50 text-rose-500">
                  <Heart size={29} />
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-slate-800">
                  Your story is still unfolding
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  When someone you like likes you back, you’ll find their
                  profile here.
                </p>
                <button
                  onClick={onClose}
                  className="mt-5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-extrabold text-white"
                >
                  Keep discovering
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <p role="status" className="text-xs text-rose-600">
                  Refresh failed. Showing your last loaded matches.
                </p>
              )}

              {matches.map(({ id, profile }) => {
                const name = profile.display_name?.trim() || "Soully member";
                const conversationUrl = `/messages/${encodeURIComponent(id)}`;

                return (
                  <article
                    key={id}
                    className="group flex items-center gap-3 rounded-2xl border border-rose-100 bg-white p-3 transition hover:border-rose-200 hover:bg-rose-50/40 sm:gap-4 sm:p-4"
                  >
                    <div className="relative size-[4.25rem] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-rose-200 to-orange-100 ring-1 ring-rose-100 sm:size-[4.75rem]">
                      {profile.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.photo_url}
                          alt={`${name}'s profile`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-2xl font-black text-rose-500">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full border-2 border-white bg-emerald-500 text-white">
                        <Heart size={9} fill="currentColor" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-extrabold text-slate-800">
                        {name}
                        {profile.age != null && (
                          <span className="ml-1.5 font-semibold text-slate-500">
                            {profile.age}
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        It’s a mutual match
                      </p>
                      <Link
                        href={conversationUrl}
                        onClick={onClose}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-rose-600"
                      >
                        <MessageCircle size={14} />
                        Message
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-slate-50/70 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
          >
            Back to Discover
          </button>
        </footer>
      </section>
    </div>
  );
}
