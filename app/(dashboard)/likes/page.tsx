"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Heart, LoaderCircle, MapPin } from "lucide-react";

type Profile = {
  user_id: string;
  display_name: string;
  age: number | null;
  city: string | null;
  photo_url: string | null;
};

export default function LikesPage() {
  const [supabase] = useState(() => createClient());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadLikes() {
      try {
        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user) {
          router.replace("/auth");
          return;
        }

        const { data: likes, error: likesError } = await supabase
          .from("likes")
          .select("user_id")
          .eq("liked_user_id", authData.user.id);

        if (likesError) throw likesError;

        const ids = [...new Set((likes ?? []).map((row) => row.user_id))];

        if (!ids.length) {
          setProfiles([]);
          return;
        }

        const { data, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id,display_name,age,city,photo_url")
          .in("user_id", ids);

        if (profilesError) throw profilesError;
        setProfiles(data ?? []);
      } catch (err) {
        console.error(err);
        setError("Couldn't load likes. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadLikes();
  }, [router, supabase]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Likes</h1>
      <p className="mt-2 text-gray-500">
        People who have shown interest in your profile.
      </p>

      {loading ? (
        <LoaderCircle className="mt-8 animate-spin" />
      ) : error ? (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      ) : profiles.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-gray-200 p-8 text-center dark:border-gray-800">
          <Heart className="mx-auto mb-3 text-rose-500" size={32} />
          <h2 className="font-semibold">No likes yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Keep your profile up to date to help others get to know you.
          </p>
          <Link
            href="/profile"
            className="mt-4 inline-block font-semibold text-rose-600"
          >
            Edit profile
          </Link>
        </section>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <article
              key={profile.user_id}
              className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800"
            >
              <div className="flex items-center gap-4 p-4">
                {profile.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.photo_url}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-xl font-bold text-rose-600">
                    {profile.display_name?.charAt(0)?.toUpperCase() ?? "S"}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    {profile.display_name}
                    {profile.age != null && `, ${profile.age}`}
                  </h2>
                  {profile.city && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={14} />
                      {profile.city}
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800">
                Like them back from Discover to create a mutual match.
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
