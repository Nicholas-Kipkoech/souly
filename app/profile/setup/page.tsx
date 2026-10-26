"use client";

import { FormEvent, useEffect, useState, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  LogOut,
  Camera,
  ImagePlus,
  X,
  UserRound,
  MapPin,
  LoaderCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  display_name: string;
  age: string;
  bio: string;
  dating_intention: "serious" | "casual" | "both";
  interests: string;
  city: string;
};

type GalleryItem = {
  id: string;
  url: string;
  file?: File;
};

const blank: Profile = {
  display_name: "",
  age: "",
  bio: "",
  dating_intention: "both",
  interests: "",
  city: "",
};

const BUCKET = "profile-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_PHOTOS = 5;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProfileSetupPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>(blank);
  const [userId, setUserId] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">(
    "info",
  );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          router.replace("/auth");
          return;
        }

        setUserId(user.id);

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "display_name,age,bio,dating_intention,interests,city,photo_url,photos",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error) throw error;

        if (data) {
          setProfile({
            display_name: data.display_name ?? "",
            age: String(data.age ?? ""),
            bio: data.bio ?? "",
            dating_intention: data.dating_intention ?? "both",
            interests: Array.isArray(data.interests)
              ? data.interests.join(", ")
              : "",
            city: data.city ?? "",
          });

          setPhotoUrl(data.photo_url ?? "");

          const savedPhotos: string[] = Array.isArray(data.photos)
            ? data.photos
            : [];

          setGallery(
            savedPhotos.slice(0, MAX_GALLERY_PHOTOS).map((url) => ({
              id: url,
              url,
            })),
          );
        }
      } catch (error) {
        if (!active) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load your profile.",
        );
        setMessageType("error");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateImage(file: File): boolean {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      setMessageType("error");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessage("Each image must be 5 MB or smaller.");
      setMessageType("error");
      return false;
    }

    return true;
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !validateImage(file)) return;

    setAvatarFile(file);
    setMessage("");
  }

  function handleGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;

    if (files.some((file) => !validateImage(file))) return;

    if (gallery.length + files.length > MAX_GALLERY_PHOTOS) {
      setMessage(`You can add up to ${MAX_GALLERY_PHOTOS} gallery photos.`);
      setMessageType("error");
      return;
    }

    const newItems: GalleryItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
    }));

    setGallery((current) => [...current, ...newItems]);
    setMessage("");
  }

  function removeGalleryPhoto(id: string) {
    setGallery((current) => {
      const item = current.find((photo) => photo.id === id);

      if (item?.file) {
        URL.revokeObjectURL(item.url);
      }

      return current.filter((photo) => photo.id !== id);
    });
  }

  function removeAvatarSelection() {
    setAvatarFile(null);
  }

  async function uploadPhoto(
    file: File,
    folder: "avatar" | "gallery",
  ): Promise<string> {
    const supabase = createClient();

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

    const path = `${userId}/${folder}-${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return data.publicUrl;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setMessage("Please sign in before saving your profile.");
      setMessageType("error");
      return;
    }

    const age = Number(profile.age);

    if (!Number.isInteger(age) || age < 18 || age > 120) {
      setMessage("Please enter a valid age of 18 or older.");
      setMessageType("error");
      return;
    }

    if (profile.display_name.trim().length < 2) {
      setMessage("Your display name must have at least 2 characters.");
      setMessageType("error");
      return;
    }

    if (gallery.length > MAX_GALLERY_PHOTOS) {
      setMessage("You can have up to five gallery photos.");
      setMessageType("error");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const supabase = createClient();

      let nextPhotoUrl = photoUrl;

      if (avatarFile) {
        nextPhotoUrl = await uploadPhoto(avatarFile, "avatar");
      }

      const nextGalleryUrls: string[] = [];

      for (const item of gallery) {
        if (item.file) {
          const uploadedUrl = await uploadPhoto(item.file, "gallery");

          nextGalleryUrls.push(uploadedUrl);
        } else {
          nextGalleryUrls.push(item.url);
        }
      }

      const interests = profile.interests
        .split(",")
        .map((interest) => interest.trim())
        .filter(Boolean)
        .filter(
          (interest, index, values) =>
            values.findIndex(
              (value) => value.toLowerCase() === interest.toLowerCase(),
            ) === index,
        )
        .slice(0, 10);

      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: userId,
          display_name: profile.display_name.trim(),
          age,
          bio: profile.bio.trim(),
          dating_intention: profile.dating_intention,
          interests,
          city: profile.city.trim() || null,
          photo_url: nextPhotoUrl || null,
          photos: nextGalleryUrls,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      setPhotoUrl(nextPhotoUrl);
      setAvatarFile(null);

      setGallery(
        nextGalleryUrls.map((url) => ({
          id: url,
          url,
        })),
      );

      setMessage("Your profile has been saved!");
      setMessageType("success");

      router.push("/discover");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save your profile. Please try again.",
      );
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const avatarPreview = avatarFile ? URL.createObjectURL(avatarFile) : photoUrl;

  useEffect(() => {
    if (!avatarFile) return;

    const previewUrl = URL.createObjectURL(avatarFile);

    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-soully-blush">
        <div className="flex items-center gap-3 text-soully-pink">
          <LoaderCircle className="animate-spin" size={22} />
          <span className="font-semibold">Loading your profile…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-soully-blush px-4 py-6 sm:px-8">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xl font-extrabold text-soully-pink"
        >
          <Heart fill="currentColor" />
          Soully
        </Link>

        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-soully-pink"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </header>

      <section className="mx-auto mt-8 max-w-3xl rounded-3xl bg-white p-6 shadow-xl shadow-rose-100/60 sm:mt-12 sm:p-10">
        <span className="text-xs font-extrabold tracking-[.2em] text-soully-pink">
          YOUR SOULLY PROFILE
        </span>

        <h1 className="mt-3 font-heading text-3xl font-extrabold sm:text-4xl">
          Let’s get to know you.
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Add a profile picture and a few photos, then tell people a little
          about yourself. You can update these details later.
        </p>

        <form onSubmit={save} className="mt-8 grid gap-6 sm:grid-cols-2">
          {/* Photos */}
          <div className="sm:col-span-2">
            <div className="rounded-2xl border border-rose-100 bg-linear-to-br from-rose-50 to-white p-5 sm:p-7">
              <div className="text-center">
                <h2 className="text-lg font-extrabold text-slate-800">
                  Your photos
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a main picture and up to five extra photos.
                </p>

                <div className="relative mx-auto mt-5 flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-rose-100 shadow-lg">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile picture preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={52} className="text-rose-300" />
                  )}

                  <label
                    title="Change profile picture"
                    className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-soully-pink text-white shadow-md transition hover:scale-105"
                  >
                    <Camera size={18} />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-soully-pink px-5 py-3 text-sm font-bold text-white transition hover:bg-soully-pink-dark">
                  <Camera size={17} />
                  {avatarPreview
                    ? "Choose another picture"
                    : "Upload profile picture"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>

                {avatarFile && (
                  <button
                    type="button"
                    onClick={removeAvatarSelection}
                    className="ml-3 text-sm font-semibold text-rose-600 hover:text-rose-800"
                  >
                    Cancel change
                  </button>
                )}

                <p className="mt-3 text-xs text-slate-400">
                  JPG, PNG or WebP · Maximum 5 MB per image
                </p>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800">Photo gallery</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Show more of your interests and personality.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-soully-pink">
                    {gallery.length}/5
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((item, index) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square overflow-hidden rounded-2xl bg-rose-100"
                    >
                      <img
                        src={item.url}
                        alt={`Gallery photo ${index + 1}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />

                      <button
                        type="button"
                        onClick={() => removeGalleryPhoto(item.id)}
                        aria-label={`Remove gallery photo ${index + 1}`}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-rose-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  {gallery.length < MAX_GALLERY_PHOTOS && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-200 bg-white text-soully-pink transition hover:border-rose-400 hover:bg-rose-50">
                      <ImagePlus size={30} />
                      <span className="mt-2 text-sm font-bold">Add photos</span>
                      <span className="mt-1 text-xs text-slate-400">
                        {MAX_GALLERY_PHOTOS - gallery.length} remaining
                      </span>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleGalleryChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Display name */}
          <label className="text-sm font-bold text-slate-700">
            Display name
            <input
              required
              minLength={2}
              maxLength={40}
              value={profile.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
              placeholder="What should we call you?"
            />
          </label>

          {/* Age */}
          <label className="text-sm font-bold text-slate-700">
            Age (18+)
            <input
              required
              type="number"
              min={18}
              max={120}
              step={1}
              value={profile.age}
              onChange={(e) => update("age", e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
              placeholder="Your age"
            />
          </label>

          {/* Dating intention */}
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            What are you looking for?
            <select
              value={profile.dating_intention}
              onChange={(e) =>
                update(
                  "dating_intention",
                  e.target.value as Profile["dating_intention"],
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
            >
              <option value="serious">A serious relationship</option>
              <option value="casual">Casual dating</option>
              <option value="both">Open to either — see where it goes</option>
            </select>
          </label>

          {/* Bio */}
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            A little about you
            <textarea
              maxLength={500}
              rows={4}
              value={profile.bio}
              onChange={(e) => update("bio", e.target.value)}
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
              placeholder="Your interests, your ideal Sunday, something that makes you smile…"
            />
            <span className="mt-1 block text-right text-xs font-normal text-slate-400">
              {profile.bio.length}/500
            </span>
          </label>

          {/* Interests */}
          <label className="text-sm font-bold text-slate-700">
            Interests
            <input
              value={profile.interests}
              onChange={(e) => update("interests", e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
              placeholder="Music, hiking, coffee"
            />
            <span className="mt-1 block text-xs font-normal text-slate-400">
              Separate interests with commas. Up to 10.
            </span>
          </label>

          {/* City */}
          <label className="text-sm font-bold text-slate-700">
            City (optional)
            <span className="relative mt-2 block">
              <MapPin
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                maxLength={100}
                value={profile.city}
                onChange={(e) => update("city", e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
                placeholder="Your city"
              />
            </span>
          </label>

          {/* Status and submit */}
          <div className="sm:col-span-2">
            {message && (
              <p
                role="status"
                className={`mb-4 rounded-xl p-3 text-sm leading-6 ${
                  messageType === "error"
                    ? "bg-red-50 text-red-700"
                    : messageType === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !userId}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-soully-pink px-5 py-4 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-soully-pink-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <LoaderCircle size={19} className="animate-spin" />
                  Uploading and saving…
                </>
              ) : (
                <>
                  <Heart size={18} fill="currentColor" />
                  Save profile
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-400">
              By saving your profile, you confirm that you meet the minimum age
              requirement and agree to follow Soully’s community guidelines.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
