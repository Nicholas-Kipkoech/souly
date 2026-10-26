"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Settings,
  MessageCircle,
  Compass,
  MapPin,
  Pencil,
  LogOut,
  Sparkles,
  LoaderCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  user_id: string;
  display_name: string;
  age: number;
  bio: string | null;
  dating_intention: string;
  interests: string[] | null;
  photo_url: string | null;
  city: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id,display_name,age,bio,dating_intention,interests,photo_url,city",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setError(error.message);
      } else if (!data) {
        router.replace("/profile/setup");
        return;
      } else {
        setProfile(data as Profile);
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-rose-50">
        <LoaderCircle className="animate-spin text-rose-500" size={32} />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-rose-50 p-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-red-600">
            {error || "Your profile could not be loaded."}
          </p>
          <button
            onClick={() => router.refresh()}
            className="mt-4 rounded-xl bg-rose-500 px-4 py-2 font-bold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const intentionLabels: Record<string, string> = {
    serious: "Looking for something serious",
    casual: "Open to casual dating",
    both: "Open to seeing where it goes",
  };

  return (
    <main className="min-h-screen bg-[#fff7f8] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-rose-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href="/discover"
            className="flex items-center gap-2 text-2xl font-black text-rose-500"
          >
            <Heart fill="currentColor" /> Soully
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link
              href="/discover"
              className="hidden items-center gap-1.5 text-slate-500 hover:text-rose-500 sm:flex"
            >
              <Compass size={17} /> Discover
            </Link>
            <Link
              href="/messages"
              aria-label="Messages"
              className="text-slate-500 hover:text-rose-500"
            >
              <MessageCircle size={20} />
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="text-slate-500 hover:text-rose-500"
            >
              <Settings size={20} />
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-[.2em] text-rose-500">
              YOUR SPACE
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">My profile</h1>
            <p className="mt-2 text-slate-500">Your story, your way.</p>
          </div>

          <Link
            href="/profile/setup"
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-100 transition hover:bg-rose-600"
          >
            <Pencil size={16} /> Edit profile
          </Link>
        </div>

        <article className="overflow-hidden rounded-[2rem] border border-rose-100 bg-white shadow-xl shadow-rose-100/50">
          <div className="relative h-64 bg-gradient-to-br from-rose-200 via-pink-100 to-orange-100 sm:h-80">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={`${profile.display_name}'s profile`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <div className="grid size-32 place-items-center rounded-full border-4 border-white bg-white/70 text-5xl font-black text-rose-500">
                  {profile.display_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-20 text-white sm:p-8">
              <h2 className="text-3xl font-black sm:text-4xl">
                {profile.display_name}, {profile.age}
              </h2>
              {profile.city && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-white/90">
                  <MapPin size={16} /> {profile.city}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-7 p-6 sm:p-8">
            <section>
              <h3 className="font-bold">About me</h3>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">
                {profile.bio ||
                  "Add a little about yourself to help others get to know you."}
              </p>
            </section>

            <section>
              <h3 className="font-bold">What I'm looking for</h3>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600">
                <Heart size={16} />
                {intentionLabels[profile.dating_intention] ||
                  profile.dating_intention ||
                  "Not specified"}
              </p>
            </section>

            <section>
              <h3 className="font-bold">My interests</h3>
              {profile.interests?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-medium text-slate-600"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Add some interests to your profile.
                </p>
              )}
            </section>

            <div className="rounded-2xl bg-rose-50 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 shrink-0 text-rose-500" size={20} />
                <div>
                  <h3 className="font-bold">Your story matters</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Keep your profile authentic and respectful. A few details
                    about your interests can help spark a meaningful
                    conversation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <button
          onClick={signOut}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-white hover:text-rose-500"
        >
          <LogOut size={17} /> Sign out
        </button>
      </section>
    </main>
  );
}
