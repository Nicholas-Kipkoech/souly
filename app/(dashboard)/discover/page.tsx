"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  X,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  MessageCircle,
  RotateCcw,
  UserRound,
  Settings,
  ChevronDown,
  ShieldCheck,
  Undo2,
  Flame,
  Star,
  Check,
  LoaderCircle,
  Compass,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import CompatibilityScore from "@/components/CompatibilityScore";
import type { CompatibilityProfile } from "@/lib/compatibility";
import MatchesModal from "@/components/MatchesModal";

type DatingIntention = "serious" | "casual" | "both";
type Decision = "like" | "pass";
type FilterIntention = "all" | DatingIntention;

type Profile = CompatibilityProfile & {
  display_name: string;
  age: number;
  bio: string | null;
  dating_intention: DatingIntention;
  interests: string[] | null;
  photo_url: string | null;
  photos?: string[] | null;
  city: string | null;
  connection_preferences_complete: boolean;
  created_at?: string;
};

type LastAction = {
  profile: Profile;
  decision: Decision;
};

type SwipeResult = {
  matched?: boolean;
  match_id?: string | null;
  decision?: Decision;
};

const intentionLabel: Record<DatingIntention, string> = {
  serious: "Long-term relationship",
  casual: "Casual dating",
  both: "Open to possibilities",
};

const filterOptions: {
  value: FilterIntention;
  label: string;
}[] = [
  { value: "all", label: "Everyone" },
  { value: "serious", label: "Something serious" },
  { value: "casual", label: "Casual dating" },
  { value: "both", label: "Open to possibilities" },
];

export default function DiscoverPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myCompatibilityProfile, setMyCompatibilityProfile] =
    useState<CompatibilityProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [filterIntention, setFilterIntention] =
    useState<FilterIntention>("all");
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const swipeLock = useRef(false);
  const dragXRef = useRef(0);
  const draggingRef = useRef(false);
  const actionVersion = useRef(0);

  // Always derive the active card from the filtered deck.
  // Removing a profile naturally advances to the next eligible profile.
  const visibleProfiles = profiles.filter((profile) => {
    if (filterIntention === "all") return true;

    return (
      profile.dating_intention === filterIntention ||
      profile.dating_intention === "both"
    );
  });

  const currentPerson = visibleProfiles[0] ?? null;

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    swipeLock.current = false;
    actionVersion.current += 1;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/auth");
        return;
      }

      setUserId(user.id);

      const [
        { data: ownProfile, error: ownError },
        { data: people, error: peopleError },
        { data: swipes, error: swipesError },
        { data: matches, error: matchesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
              user_id,
              compatibility_values,
              compatibility_interests,
              communication_style,
              connection_pace,
              connection_preferences_complete
            `,
          )
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select(
            `
              user_id,
              display_name,
              age,
              bio,
              dating_intention,
              interests,
              photo_url,
              photos,
              city,
              compatibility_values,
              compatibility_interests,
              communication_style,
              connection_pace,
              connection_preferences_complete,
              created_at
            `,
          )
          .neq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("swipes")
          .select("to_user_id, decision")
          .eq("from_user_id", user.id),

        supabase
          .from("matches")
          .select("id")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      ]);

      if (ownError) throw ownError;
      if (peopleError) throw peopleError;
      if (swipesError) throw swipesError;
      if (matchesError) throw matchesError;

      if (!ownProfile) {
        router.replace("/profile/setup");
        return;
      }

      setMyCompatibilityProfile({
        user_id: ownProfile.user_id,
        compatibility_values: ownProfile.compatibility_values ?? [],
        compatibility_interests: ownProfile.compatibility_interests ?? [],
        communication_style: ownProfile.communication_style,
        connection_pace: ownProfile.connection_pace,
      });

      const { data: matchPairs, error: pairsError } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      if (pairsError) throw pairsError;

      const allPeople = ((people ?? []) as Profile[]).filter(
        (person) => person.user_id !== user.id,
      );

      const swipedIds = new Set<string>(
        (swipes ?? []).map((swipe) => swipe.to_user_id),
      );

      const matchedIds = new Set<string>();

      for (const match of matchPairs ?? []) {
        matchedIds.add(match.user_a === user.id ? match.user_b : match.user_a);
      }

      // A profile is eligible only if it has never been swiped on
      // and is not already matched with the current user.
      const eligiblePeople = allPeople.filter(
        (person) =>
          !swipedIds.has(person.user_id) && !matchedIds.has(person.user_id),
      );

      setProfiles(eligiblePeople);
      setMatchCount(matchPairs?.length ?? 0);

      setLastAction(null);
      setDragX(0);
      dragXRef.current = 0;
      setDragging(false);
      draggingRef.current = false;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't load profiles. Check your Supabase setup.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const swipe = useCallback(
    async (decision: Decision) => {
      const target = currentPerson;

      if (!target || swipeLock.current || loading || !userId) return;

      swipeLock.current = true;
      setBusy(true);
      setError("");
      setNotice("");

      const thisAction = ++actionVersion.current;

      try {
        const { data, error: swipeError } = await supabase.rpc("record_swipe", {
          target_user_id: target.user_id,
          swipe_decision: decision,
        });

        if (swipeError) throw swipeError;

        const result = (
          Array.isArray(data) ? data[0] : data
        ) as SwipeResult | null;

        setLastAction({ profile: target, decision });

        // Remove by ID instead of incrementing an index.
        // This works with every filter and prevents skipped cards.
        setProfiles((current) =>
          current.filter((profile) => profile.user_id !== target.user_id),
        );

        setDragX(0);
        dragXRef.current = 0;

        if (decision === "like") {
          setNotice(
            result?.matched
              ? `It's a match with ${target.display_name}!`
              : `You liked ${target.display_name}.`,
          );
        }

        if (result?.matched) {
          const { count, error: countError } = await supabase
            .from("matches")
            .select("id", { count: "exact", head: true })
            .or(`user_a.eq.${userId},user_b.eq.${userId}`);

          if (!countError && thisAction === actionVersion.current) {
            setMatchCount(count ?? 0);
          }
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't save your choice. Please try again.",
        );
      } finally {
        swipeLock.current = false;
        setBusy(false);
      }
    },
    [currentPerson, loading, supabase, userId],
  );

  const undoLastAction = useCallback(async () => {
    if (!lastAction || swipeLock.current || loading || !userId) return;

    swipeLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error: undoError } = await supabase.rpc("undo_swipe", {
        target_user_id: lastAction.profile.user_id,
      });

      if (undoError) throw undoError;

      // Put the restored profile at the front of the deck.
      // If it doesn't match the active filter, it stays hidden until
      // the user selects a filter that includes it.
      setProfiles((current) => [
        lastAction.profile,
        ...current.filter(
          (profile) => profile.user_id !== lastAction.profile.user_id,
        ),
      ]);

      setLastAction(null);
      setDragX(0);
      dragXRef.current = 0;

      const { count, error: countError } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .or(`user_a.eq.${userId},user_b.eq.${userId}`);

      if (!countError) setMatchCount(count ?? 0);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't undo your last action.",
      );
    } finally {
      swipeLock.current = false;
      setBusy(false);
    }
  }, [lastAction, loading, supabase, userId]);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (busy || loading || !currentPerson) return;

    // Only initiate a swipe with the primary pointer.
    if (event.pointerType === "mouse" && event.button !== 0) return;

    touchStart.current = {
      x: event.clientX,
      y: event.clientY,
    };

    draggingRef.current = true;
    setDragging(true);
    cardRef.current?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!draggingRef.current || !touchStart.current) return;

    const deltaX = event.clientX - touchStart.current.x;
    const deltaY = event.clientY - touchStart.current.y;

    // Ignore vertical gestures so scrolling remains natural.
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.25) return;

    dragXRef.current = deltaX;
    setDragX(deltaX);
  }

  function handlePointerUp(event?: ReactPointerEvent<HTMLElement>) {
    if (!draggingRef.current) return;

    draggingRef.current = false;
    setDragging(false);
    touchStart.current = null;

    try {
      if (event && cardRef.current?.hasPointerCapture?.(event.pointerId)) {
        cardRef.current.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already have been released by the browser.
    }

    const finalX = dragXRef.current;

    if (Math.abs(finalX) >= 110) {
      // Reset the visual position immediately; swipe() advances the deck.
      setDragX(0);
      dragXRef.current = 0;
      void swipe(finalX > 0 ? "like" : "pass");
    } else {
      setDragX(0);
      dragXRef.current = 0;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff9f8] pb-24 text-[#27202b] sm:pb-8">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <section className="mx-auto w-full max-w-[540px]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-rose-500">
                <Flame size={15} />
                Made for connection
              </div>
              <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Discover
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Your next favorite person might be one swipe away.
              </p>
            </div>

            <button
              onClick={() => setShowFilters((value) => !value)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                showFilters
                  ? "border-rose-300 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-500"
              }`}
            >
              <SlidersHorizontal size={16} />
              Filters
              <ChevronDown
                size={14}
                className={`transition ${showFilters ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {showFilters && (
            <div className="mb-5 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-bold">Looking for</p>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterIntention(option.value)}
                    className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${
                      filterIntention === option.value
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-rose-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Changing a filter updates the current deck without changing your
                saved swipes.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p>{error}</p>
              <button
                onClick={() => void loadProfiles()}
                className="shrink-0 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500">
                <Heart size={18} fill="currentColor" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{notice}</p>
                {notice.startsWith("It's a match") && (
                  <Link
                    href="/messages"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-rose-500 hover:text-rose-600"
                  >
                    Send a message <MessageCircle size={15} />
                  </Link>
                )}
              </div>
              <button
                onClick={() => setNotice("")}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid min-h-[560px] place-items-center rounded-[2rem] border border-rose-100 bg-white">
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-rose-50 text-rose-500">
                  <LoaderCircle size={30} className="animate-spin" />
                </span>
                <p className="mt-4 font-bold">Finding your people...</p>
                <p className="mt-1 text-sm text-slate-400">
                  Good connections take a moment.
                </p>
              </div>
            </div>
          ) : currentPerson ? (
            <div className="relative mx-auto w-full">
              <div className="absolute inset-x-5 -bottom-2 top-3 rounded-[2rem] bg-rose-200/60" />
              <div className="absolute inset-x-2 -bottom-1 top-1 rounded-[2rem] bg-rose-100" />

              <article
                ref={cardRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`relative isolate overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-rose-200/60 select-none ${
                  dragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{
                  transform: `translateX(${dragX}px) rotate(${dragX * 0.035}deg)`,
                  transition: dragging ? "none" : "transform 240ms ease",
                  touchAction: "pan-y",
                }}
              >
                {dragX > 30 && (
                  <div className="pointer-events-none absolute left-5 top-8 z-10 rotate-[-12deg] rounded-xl border-[3px] border-emerald-400 px-4 py-2 text-2xl font-black uppercase tracking-wider text-emerald-400">
                    Like
                  </div>
                )}

                {dragX < -30 && (
                  <div className="pointer-events-none absolute right-5 top-8 z-10 rotate-[12deg] rounded-xl border-[3px] border-rose-400 px-4 py-2 text-2xl font-black uppercase tracking-wider text-rose-400">
                    Nope
                  </div>
                )}

                <div className="relative h-[490px] max-h-[65svh] min-h-[390px] bg-gradient-to-br from-rose-200 via-orange-100 to-pink-200 sm:h-[590px] sm:max-h-[680px] sm:min-h-[500px]">
                  {currentPerson.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPerson.photo_url}
                      alt={`${currentPerson.display_name}'s profile`}
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-rose-200 via-pink-100 to-orange-100">
                      <div className="grid size-36 place-items-center rounded-full border-4 border-white/70 bg-white/60 font-heading text-6xl font-black text-rose-400 shadow-xl backdrop-blur">
                        {currentPerson.display_name
                          ?.slice(0, 1)
                          .toUpperCase() ?? "S"}
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/30 to-transparent p-5">
                    <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                      <Sparkles size={13} />
                      Your discovery
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Profile
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-5 pb-6 pt-32 sm:px-7 sm:pb-8">
                    <h2 className="font-heading text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                      {currentPerson.display_name}
                      {currentPerson.age != null && (
                        <span className="ml-2 font-semibold">
                          {currentPerson.age}
                        </span>
                      )}
                    </h2>

                    {currentPerson.city && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-white/90">
                        <MapPin size={16} />
                        {currentPerson.city}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
                        <Heart size={13} />
                        {intentionLabel[currentPerson.dating_intention] ??
                          intentionLabel.both}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white px-5 pb-5 pt-5 sm:px-7 sm:pb-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg font-extrabold">
                        About me
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                        {currentPerson.bio?.trim() ||
                          "Their story is just getting started. A thoughtful hello can be the beginning of a great conversation."}
                      </p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                      <UserRound size={20} />
                    </span>
                  </div>

                  {myCompatibilityProfile?.user_id &&
                    myCompatibilityProfile.compatibility_values?.length &&
                    currentPerson.connection_preferences_complete && (
                      <div className="mt-5">
                        <CompatibilityScore
                          currentUser={myCompatibilityProfile}
                          otherUser={{
                            user_id: currentPerson.user_id,
                            compatibility_values:
                              currentPerson.compatibility_values,
                            compatibility_interests:
                              currentPerson.compatibility_interests,
                            communication_style:
                              currentPerson.communication_style,
                            connection_pace: currentPerson.connection_pace,
                          }}
                          compact
                        />
                      </div>
                    )}

                  {!!currentPerson.interests?.length && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Things I enjoy
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {currentPerson.interests.map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full border border-rose-100 bg-rose-50/70 px-3 py-1.5 text-xs font-bold text-rose-600"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>

              <div className="relative z-10 mx-auto mt-6 flex items-center justify-center gap-5 sm:gap-7">
                <button
                  onClick={() => void undoLastAction()}
                  disabled={!lastAction || busy}
                  title="Undo last swipe"
                  aria-label="Undo last swipe"
                  className="grid size-11 place-items-center rounded-full border border-amber-100 bg-white text-amber-500 shadow-md transition hover:-translate-y-1 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Undo2 size={19} />
                </button>

                <button
                  onClick={() => void swipe("pass")}
                  disabled={busy}
                  aria-label="Pass on profile"
                  title="Pass"
                  className="grid size-[4.25rem] place-items-center rounded-full border border-rose-100 bg-white text-rose-500 shadow-lg transition hover:-translate-y-1 hover:scale-105 disabled:opacity-50"
                >
                  <X size={30} strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => void swipe("like")}
                  disabled={busy}
                  aria-label="Like profile"
                  title="Like"
                  className="grid size-[4.75rem] place-items-center rounded-full bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-xl shadow-rose-200 transition hover:-translate-y-1 hover:scale-105 disabled:opacity-50"
                >
                  {busy ? (
                    <LoaderCircle size={27} className="animate-spin" />
                  ) : (
                    <Heart size={29} fill="currentColor" strokeWidth={2} />
                  )}
                </button>

                <button
                  onClick={() => setShowMatches(true)}
                  title="Your matches"
                  aria-label="View matches"
                  className="grid size-11 place-items-center rounded-full border border-violet-100 bg-white text-violet-500 shadow-md transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <Star size={19} />
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-slate-400">
                {busy
                  ? "Saving your choice..."
                  : "Swipe right to like · Swipe left to pass"}
              </p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[2rem] border border-rose-100 bg-white px-6 py-16 text-center shadow-xl shadow-rose-100/50 sm:px-12">
              <div className="absolute -right-12 -top-12 size-40 rounded-full bg-rose-50" />
              <div className="absolute -bottom-16 -left-12 size-48 rounded-full bg-pink-50" />

              <div className="relative">
                <span className="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-xl shadow-rose-200">
                  <Heart size={35} />
                </span>

                <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-rose-500">
                  You are all caught up
                </p>
                <h2 className="mt-3 font-heading text-3xl font-black">
                  Good things take time.
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-500">
                  There are no new profiles in this selection right now. Try
                  another filter or refresh discovery later.
                </p>

                <button
                  onClick={() => void loadProfiles()}
                  className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5"
                >
                  <RotateCcw size={16} />
                  Refresh discovery
                </button>

                <button
                  onClick={() => setFilterIntention("all")}
                  className="ml-2 mt-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Reset filters
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={15} className="text-emerald-500" />
            Be respectful. Keep personal information private.
          </div>
        </section>

        <aside className="hidden space-y-5 lg:block lg:pt-16">
          <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 p-6 text-white shadow-xl shadow-rose-200/60">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-2xl bg-white/20">
                <Heart size={23} fill="currentColor" />
              </span>
              <Sparkles size={21} className="text-white/80" />
            </div>
            <p className="mt-5 text-sm font-semibold text-white/80">
              Your Soully journey
            </p>
            <h2 className="mt-1 font-heading text-3xl font-black">
              {matchCount} {matchCount === 1 ? "connection" : "connections"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              Every mutual like is an opportunity to get to know someone new.
            </p>
            <button
              onClick={() => setShowMatches(true)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-extrabold text-rose-600 transition hover:bg-rose-50"
            >
              View my matches <MessageCircle size={16} />
            </button>
          </div>

          <div className="rounded-[1.75rem] border border-rose-100 bg-white p-6 shadow-sm">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-500">
              <Sparkles size={22} />
            </span>
            <h3 className="mt-4 font-heading text-lg font-extrabold">
              A little reminder
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              A great connection is about more than a photo. Explore shared
              interests, communicate honestly, and respect each person's
              boundaries.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h3 className="font-bold">Your safety matters</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Take connections at your pace.
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-slate-500">
              <li className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                Keep sensitive information private.
              </li>
              <li className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                Respect boundaries and consent.
              </li>
              <li className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                Report or block inappropriate behavior.
              </li>
            </ul>
          </div>

          <div className="space-y-1 px-2 text-xs text-slate-400">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 py-2 hover:text-rose-500"
            >
              <Settings size={14} /> Settings
            </Link>
            <p>
              © {new Date().getFullYear()} Soully. Made for meaningful
              connections.
            </p>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-rose-100 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <Link
            href="/discover"
            className="flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-rose-500"
          >
            <Compass size={21} />
            <span className="text-[10px] font-extrabold">Discover</span>
          </Link>

          <button
            onClick={() => setShowMatches(true)}
            className="relative flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-slate-400"
          >
            <Heart size={21} />
            {matchCount > 0 && (
              <span className="absolute right-2 top-0 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {matchCount > 9 ? "9+" : matchCount}
              </span>
            )}
            <span className="text-[10px] font-semibold">Matches</span>
          </button>

          <Link
            href="/messages"
            className="flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-slate-400"
          >
            <MessageCircle size={21} />
            <span className="text-[10px] font-semibold">Messages</span>
          </Link>

          <Link
            href="/profile"
            className="flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-slate-400"
          >
            <UserRound size={21} />
            <span className="text-[10px] font-semibold">Profile</span>
          </Link>
        </div>
      </nav>

      {showMatches && (
        <MatchesModal
          open={showMatches}
          onClose={() => setShowMatches(false)}
          userId={userId}
        />
      )}
    </main>
  );
}
