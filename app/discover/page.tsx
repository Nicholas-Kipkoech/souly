"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  X,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  LogOut,
  MessageCircle,
  RotateCcw,
  UserRound,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DatingIntention = "serious" | "casual" | "both";

type Profile = {
  user_id: string;
  display_name: string;
  age: number;
  bio: string | null;
  dating_intention: DatingIntention;
  interests: string[] | null;
  photo_url: string | null;
  city: string | null;
};

type Swipe = {
  to_user_id: string;
  decision: "like" | "pass";
};

const intentionLabel: Record<DatingIntention, string> = {
  serious: "Looking for something serious",
  casual: "Open to casual dating",
  both: "Open to seeing where it goes",
};

export default function DiscoverPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      setUserId(user.id);

      const { data: ownProfile, error: ownError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownError) throw ownError;

      if (!ownProfile) {
        router.replace("/profile/setup");
        return;
      }

      const [
        { data: people, error: peopleError },
        { data: swipes, error: swipesError },
        { data: matches, error: matchesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "user_id,display_name,age,bio,dating_intention,interests,photo_url,city",
          )
          .neq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("swipes")
          .select("to_user_id,decision")
          .eq("from_user_id", user.id),

        supabase
          .from("matches")
          .select("id")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      ]);

      if (peopleError) throw peopleError;
      if (swipesError) throw swipesError;
      if (matchesError) throw matchesError;

      const seen = new Set(
        ((swipes ?? []) as Swipe[]).map((swipe) => swipe.to_user_id),
      );

      setProfiles(
        ((people ?? []) as Profile[]).filter(
          (person) => !seen.has(person.user_id),
        ),
      );

      setIndex(0);
      setMatchCount(matches?.length ?? 0);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't load profiles. Check your Supabase setup.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function swipe(decision: "like" | "pass") {
    const person = profiles[index];

    if (!person || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();

      const { error: swipeError } = await supabase.from("swipes").upsert(
        {
          from_user_id: userId,
          to_user_id: person.user_id,
          decision,
        },
        { onConflict: "from_user_id,to_user_id" },
      );

      if (swipeError) throw swipeError;

      if (decision === "like") {
        const { data: mutual, error: matchError } = await supabase
          .from("matches")
          .select("id")
          .or(
            `and(user_a.eq.${userId},user_b.eq.${person.user_id}),and(user_a.eq.${person.user_id},user_b.eq.${userId})`,
          )
          .maybeSingle();

        if (matchError) throw matchError;

        if (mutual) {
          setNotice(
            `It's a match with ${person.display_name}! You both liked each other.`,
          );

          // Refresh the total using the database rather than incrementing
          // repeatedly if the user retries an action.
          const { count, error: countError } = await supabase
            .from("matches")
            .select("id", { count: "exact", head: true })
            .or(`user_a.eq.${userId},user_b.eq.${userId}`);

          if (!countError) setMatchCount(count ?? 0);
        } else {
          setNotice(`You liked ${person.display_name}.`);
        }
      }

      setProfiles((current) =>
        current.filter((p) => p.user_id !== person.user_id),
      );

      setIndex(0);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That action couldn't be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const person = profiles[index];

  return (
    <main className="min-h-screen bg-soully-blush">
      {/* Header navigation */}
      <header className="sticky top-0 z-10 border-b border-rose-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 text-xl font-extrabold text-soully-pink"
          >
            <Heart fill="currentColor" />
            Soully
          </Link>

          <nav
            className="flex items-center gap-1 sm:gap-3"
            aria-label="Account navigation"
          >
            <Link
              href="/profile/setup"
              className="rounded-full px-2 py-2 text-sm font-bold text-slate-600 hover:bg-rose-50 hover:text-soully-pink sm:px-3"
            >
              My profile
            </Link>

            {/* NEW: Messages link */}
            <Link
              href="/messages"
              className="inline-flex items-center gap-2 rounded-full bg-soully-pink px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-soully-pink-dark sm:px-4"
            >
              <MessageCircle size={17} />
              <span>Messages</span>
            </Link>

            <Link href="/profile" className="flex items-center gap-2">
              <UserRound size={20} />
              <span className="hidden sm:inline">My profile</span>
            </Link>

            <Link href="/settings" aria-label="Settings" title="Settings">
              <Settings size={20} />
            </Link>

            <button
              onClick={() => setShowMatches(true)}
              className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-sm font-bold text-soully-pink hover:bg-rose-100"
            >
              <Heart size={16} fill="currentColor" />
              <span className="hidden sm:inline">Matches</span>
              <span>{matchCount}</span>
            </button>

            <button
              onClick={signOut}
              aria-label="Sign out"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <LogOut size={18} />
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-12">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold tracking-[.22em] text-soully-pink">
                YOUR NEXT CHAPTER
              </p>

              <h1 className="mt-2 font-heading text-3xl font-extrabold text-soully-ink sm:text-4xl">
                Discover people
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                A good connection starts with a hello.
              </p>
            </div>

            <span className="mb-1 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white px-3 py-2 text-xs font-bold text-slate-500">
              <SlidersHorizontal size={14} />
              For you
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {notice && (
            <div
              role="status"
              className="mb-4 rounded-2xl border border-rose-200 bg-white p-4 text-sm font-semibold text-soully-pink"
            >
              <p>{notice}</p>

              {notice.startsWith("It's a match") && (
                <Link
                  href="/messages"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-soully-pink px-4 py-2 text-sm font-bold text-white hover:bg-soully-pink-dark"
                >
                  <MessageCircle size={16} />
                  Send a message
                </Link>
              )}
            </div>
          )}

          {loading ? (
            <div className="grid min-h-[420px] place-items-center rounded-3xl bg-white text-slate-500 shadow-xl shadow-rose-100/50">
              <div className="text-center">
                <Sparkles
                  className="mx-auto animate-pulse text-soully-pink"
                  size={32}
                />
                <p className="mt-3 text-sm font-semibold">
                  Finding your people…
                </p>
              </div>
            </div>
          ) : person ? (
            <article className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-rose-100/70">
              <div className="relative h-[360px] bg-gradient-to-br from-rose-100 via-orange-50 to-rose-200 sm:h-[440px]">
                {person.photo_url ? (
                  <img
                    src={person.photo_url}
                    alt={`${person.display_name}'s profile`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-rose-100 via-pink-50 to-orange-100">
                    <div className="grid size-32 place-items-center rounded-full border-4 border-white/80 bg-white/70 font-heading text-5xl font-extrabold text-soully-pink shadow-lg">
                      {person.display_name.slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent p-6 pt-24 text-white sm:p-8 sm:pt-28">
                  <h2 className="font-heading text-3xl font-extrabold">
                    {person.display_name}, {person.age}
                  </h2>

                  {person.city && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/90">
                      <MapPin size={14} />
                      {person.city}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <p className="inline-flex rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-soully-pink">
                  {intentionLabel[person.dating_intention] ??
                    intentionLabel.both}
                </p>

                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-600">
                  {person.bio?.trim() ||
                    "Still writing their story. Say hello and start a conversation."}
                </p>

                {!!person.interests?.length && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {person.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-7 flex items-center justify-center gap-5 border-t border-slate-100 pt-6">
                  <button
                    disabled={busy}
                    onClick={() => void swipe("pass")}
                    aria-label="Pass on profile"
                    className="grid size-14 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X size={24} />
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => void swipe("like")}
                    aria-label="Like profile"
                    className="grid size-[4.25rem] place-items-center rounded-full bg-soully-pink text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 hover:bg-soully-pink-dark disabled:opacity-50"
                  >
                    <Heart size={28} fill="currentColor" />
                  </button>
                </div>

                <p className="mt-4 text-center text-xs text-slate-400">
                  {busy
                    ? "Saving your choice…"
                    : "Like someone to let them know you're interested."}
                </p>
              </div>
            </article>
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xl shadow-rose-100/50">
              <div className="max-w-sm">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-soully-pink">
                  <Heart size={30} />
                </span>

                <h2 className="mt-5 font-heading text-2xl font-extrabold">
                  You’re all caught up
                </h2>

                <p className="mt-2 leading-7 text-slate-500">
                  There are no new profiles to show right now. Check back soon,
                  or update your profile to make it more you.
                </p>

                <button
                  onClick={() => void loadProfiles()}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-soully-pink px-5 py-3 font-bold text-white hover:bg-soully-pink-dark"
                >
                  <RotateCcw size={16} />
                  Refresh profiles
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5 lg:pt-20">
          <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm shadow-rose-100/60">
            <span className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-soully-pink">
              <Sparkles size={22} />
            </span>

            <h2 className="mt-4 font-heading text-xl font-extrabold">
              A little Soully advice
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Look beyond the first photo. Shared interests, values, and how
              someone communicates can make a real difference.
            </p>
          </div>

          <div className="rounded-3xl bg-soully-ink p-6 text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-rose-200">
              <MessageCircle size={22} />
            </span>

            <h2 className="mt-4 font-heading text-xl font-extrabold">
              Keep it kind
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/70">
              Respect boundaries, protect your personal information, and meet
              new people in public places.
            </p>

            <p className="mt-4 text-xs font-semibold text-rose-200">
              Blocking and reporting should be added before public launch.
            </p>
          </div>
        </aside>
      </section>

      {showMatches && (
        <div
          className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
          role="presentation"
          onClick={() => setShowMatches(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="matches-title"
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-soully-pink">
                  <Heart fill="currentColor" />
                </span>

                <h2
                  id="matches-title"
                  className="mt-4 font-heading text-2xl font-extrabold"
                >
                  Your matches
                </h2>
              </div>

              <button
                onClick={() => setShowMatches(false)}
                aria-label="Close matches"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X />
              </button>
            </div>

            <p className="mt-3 leading-7 text-slate-500">
              You have {matchCount} mutual{" "}
              {matchCount === 1 ? "match" : "matches"}.
            </p>

            <Link
              href="/messages"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-soully-pink px-5 py-3 font-bold text-white hover:bg-soully-pink-dark"
              onClick={() => setShowMatches(false)}
            >
              <MessageCircle size={18} />
              Open messages
            </Link>

            <button
              onClick={() => setShowMatches(false)}
              className="mt-2 w-full rounded-full px-5 py-3 font-bold text-slate-600 hover:bg-slate-50"
            >
              Keep discovering
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
