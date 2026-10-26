"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  LoaderCircle,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const VALUES = [
  "Kindness",
  "Honesty",
  "Trust",
  "Respect",
  "Family",
  "Growth",
  "Humor",
  "Creativity",
  "Adventure",
  "Empathy",
  "Loyalty",
  "Curiosity",
];

const INTERESTS = [
  "Music",
  "Reading",
  "Travel",
  "Art",
  "Technology",
  "Cooking",
  "Fitness",
  "Nature",
  "Movies",
  "Gaming",
  "Photography",
  "Volunteering",
  "Fashion",
  "Sports",
  "Learning",
  "Animals",
];

const COMMUNICATION_STYLES = [
  {
    value: "thoughtful",
    title: "Thoughtful",
    description: "I enjoy meaningful conversations.",
    emoji: "💭",
  },
  {
    value: "playful",
    title: "Playful",
    description: "Humor and fun help me connect.",
    emoji: "✨",
  },
  {
    value: "direct",
    title: "Direct",
    description: "I appreciate clear communication.",
    emoji: "💬",
  },
  {
    value: "gentle",
    title: "Gentle",
    description: "I prefer a calm, considerate approach.",
    emoji: "🌷",
  },
];

const PACES = [
  {
    value: "slow",
    title: "Take it slow",
    description: "I'd like time to get comfortable.",
    emoji: "🌱",
  },
  {
    value: "balanced",
    title: "A natural pace",
    description: "Let things develop naturally.",
    emoji: "🌸",
  },
  {
    value: "spontaneous",
    title: "Go with the flow",
    description: "I enjoy discovering things as I go.",
    emoji: "🦋",
  },
];

type CompatibilityProfile = {
  compatibility_values: string[] | null;
  compatibility_interests: string[] | null;
  communication_style: string | null;
  connection_pace: string | null;
  connection_preferences_complete: boolean | null;
};

export default function CompatibilityPage() {
  const [supabase] = useState(() => createClient());

  const [values, setValues] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [communication, setCommunication] = useState("");
  const [pace, setPace] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedBefore, setSavedBefore] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Please sign in to set up your compatibility preferences.");
      setLoading(false);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select(
        "compatibility_values,compatibility_interests,communication_style,connection_pace,connection_preferences_complete",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      setError("We couldn't load your preferences. Please try again.");
      setLoading(false);
      return;
    }

    if (!data) {
      setError(
        "Your profile hasn't been created yet. Complete your profile first, then return here.",
      );
      setLoading(false);
      return;
    }

    const profile = data as CompatibilityProfile;

    setValues(profile.compatibility_values ?? []);
    setInterests(profile.compatibility_interests ?? []);
    setCommunication(profile.communication_style ?? "");
    setPace(profile.connection_pace ?? "");
    setSavedBefore(profile.connection_preferences_complete ?? false);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function toggleItem(
    item: string,
    selected: string[],
    setter: (items: string[]) => void,
    max: number,
  ) {
    setSuccess(false);
    setError("");

    if (selected.includes(item)) {
      setter(selected.filter((value) => value !== item));
      return;
    }

    if (selected.length >= max) {
      setError(`Choose up to ${max} options in this section.`);
      return;
    }

    setter([...selected, item]);
  }

  const steps = [
    {
      title: "What matters to you?",
      subtitle: "Choose the values you appreciate most in a connection.",
    },
    {
      title: "What do you enjoy?",
      subtitle: "Select the interests you'd love to share with other people.",
    },
    {
      title: "How do you communicate?",
      subtitle: "There is no right answer. Choose what feels most like you.",
    },
    {
      title: "What's your pace?",
      subtitle: "Tell us how you prefer to get to know someone.",
    },
  ];

  async function savePreferences() {
    setError("");
    setSuccess(false);

    if (values.length < 3) {
      setError("Please choose at least 3 values.");
      setStep(0);
      return;
    }

    if (interests.length < 3) {
      setError("Please choose at least 3 interests.");
      setStep(1);
      return;
    }

    if (!communication || !pace) {
      setError("Please complete both remaining sections.");
      setStep(!communication ? 2 : 3);
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Your session may have expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        compatibility_values: values,
        compatibility_interests: interests,
        communication_style: communication,
        connection_pace: pace,
        connection_preferences_complete: true,
      })
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (updateError || !data) {
      setError(
        updateError?.message ??
          "We couldn't save your preferences. Check your profile permissions and try again.",
      );
      setSaving(false);
      return;
    }

    setSavedBefore(true);
    setSuccess(true);
    setSaving(false);
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-[#FFF8F8] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/profile"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-pink-600"
        >
          <ArrowLeft size={17} />
          Back to profile
        </Link>

        <div className="overflow-hidden rounded-[2rem] border border-rose-100 bg-white shadow-xl shadow-rose-100/40">
          <div className="relative overflow-hidden bg-gradient-to-br from-pink-500 via-rose-500 to-pink-400 px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="absolute -right-10 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 left-1/3 size-48 rounded-full bg-rose-200/20 blur-2xl" />

            <div className="relative">
              <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
                <Heart size={27} fill="currentColor" />
              </div>

              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-pink-100">
                Your Soully experience
              </p>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Find what connects you.
              </h1>

              <p className="mt-3 max-w-lg text-sm leading-6 text-pink-50 sm:text-base">
                Tell us what matters to you. We'll use your answers to help
                highlight shared interests and communication preferences.
              </p>

              <div className="mt-7 flex items-center justify-between text-xs font-semibold text-pink-50">
                <span>
                  STEP {step + 1} OF {steps.length}
                </span>
                <span>{Math.round(progress)}% complete</span>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Questionnaire progress"
              >
                <div
                  className="h-full rounded-full bg-white transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            {loading ? (
              <div className="flex min-h-64 flex-col items-center justify-center">
                <LoaderCircle
                  size={30}
                  className="animate-spin text-pink-500"
                />
                <p className="mt-3 text-sm text-slate-500">
                  Loading your preferences…
                </p>
              </div>
            ) : error &&
              !values.length &&
              !interests.length &&
              !communication &&
              !pace ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
                <p className="text-sm leading-6 text-rose-700">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadProfile()}
                  className="mt-4 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-600"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div className="mb-7 flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-pink-50 text-pink-500">
                    {step === 0 && <Heart size={21} />}
                    {step === 1 && <Sparkles size={21} />}
                    {step === 2 && <MessageCircle size={21} />}
                    {step === 3 && <Users size={21} />}
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                      {steps[step].title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {steps[step].subtitle}
                    </p>
                  </div>
                </div>

                {step === 0 && (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        Your core values
                      </span>
                      <span className="text-xs font-semibold text-pink-600">
                        {values.length}/6 selected
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {VALUES.map((value) => {
                        const selected = values.includes(value);

                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              toggleItem(value, values, setValues, 6)
                            }
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${
                              selected
                                ? "border-pink-500 bg-pink-500 text-white shadow-md shadow-pink-100"
                                : "border-rose-100 bg-white text-slate-600 hover:border-pink-300 hover:bg-rose-50"
                            }`}
                          >
                            {selected && <Check size={15} />}
                            {value}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-xs text-slate-400">
                      Choose at least 3 and up to 6.
                    </p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        Your interests
                      </span>
                      <span className="text-xs font-semibold text-pink-600">
                        {interests.length}/8 selected
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {INTERESTS.map((interest) => {
                        const selected = interests.includes(interest);

                        return (
                          <button
                            key={interest}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              toggleItem(interest, interests, setInterests, 8)
                            }
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${
                              selected
                                ? "border-pink-500 bg-pink-500 text-white shadow-md shadow-pink-100"
                                : "border-rose-100 bg-white text-slate-600 hover:border-pink-300 hover:bg-rose-50"
                            }`}
                          >
                            {selected && <Check size={15} />}
                            {interest}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-xs text-slate-400">
                      Choose at least 3 and up to 8.
                    </p>
                  </>
                )}

                {step === 2 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {COMMUNICATION_STYLES.map((option) => {
                      const selected = communication === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setCommunication(option.value);
                            setSuccess(false);
                          }}
                          className={`rounded-2xl border p-5 text-left transition ${
                            selected
                              ? "border-pink-500 bg-pink-50 ring-2 ring-pink-100"
                              : "border-rose-100 hover:border-pink-200 hover:bg-rose-50/50"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-2xl">{option.emoji}</span>
                            {selected && (
                              <span className="grid size-6 place-items-center rounded-full bg-pink-500 text-white">
                                <Check size={14} />
                              </span>
                            )}
                          </div>
                          <span className="block font-bold text-slate-800">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-500">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-3">
                    {PACES.map((option) => {
                      const selected = pace === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setPace(option.value);
                            setSuccess(false);
                          }}
                          className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition ${
                            selected
                              ? "border-pink-500 bg-pink-50 ring-2 ring-pink-100"
                              : "border-rose-100 hover:border-pink-200 hover:bg-rose-50/50"
                          }`}
                        >
                          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-2xl shadow-sm">
                            {option.emoji}
                          </span>

                          <span className="flex-1">
                            <span className="block font-bold text-slate-800">
                              {option.title}
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-slate-500">
                              {option.description}
                            </span>
                          </span>

                          {selected && (
                            <span className="grid size-6 place-items-center rounded-full bg-pink-500 text-white">
                              <Check size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {error}
                  </p>
                )}

                {success && (
                  <div
                    role="status"
                    className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"
                  >
                    <Check size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Your preferences are saved!</p>
                      <p className="mt-1 leading-5">
                        Soully can now use these answers to highlight shared
                        interests and preferences.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-rose-100 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setSuccess(false);
                      setStep((current) => Math.max(0, current - 1));
                    }}
                    disabled={step === 0 || saving}
                    className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-rose-50 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>

                  {step < steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setSuccess(false);
                        setStep((current) =>
                          Math.min(steps.length - 1, current + 1),
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-pink-100 transition hover:bg-pink-600"
                    >
                      Continue
                      <ArrowRight size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={savePreferences}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-pink-100 transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <LoaderCircle size={17} className="animate-spin" />
                      ) : (
                        <Heart size={17} />
                      )}
                      {saving
                        ? "Saving…"
                        : savedBefore
                          ? "Update preferences"
                          : "Save my preferences"}
                    </button>
                  )}
                </div>

                <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                  Your answers help personalize your experience. Be thoughtful
                  about what you share, and remember that compatibility
                  indicators are suggestions—not guarantees.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
