"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  ArrowLeft,
  Bell,
  LockKeyhole,
  ShieldCheck,
  LogOut,
  Mail,
  Save,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [matchNotifications, setMatchNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/auth");
        return;
      }

      setEmail(user.email || "");

      try {
        const saved = localStorage.getItem(`soully-settings-${user.id}`);
        if (saved) {
          const preferences = JSON.parse(saved);
          setEmailNotifications(preferences.emailNotifications ?? true);
          setMatchNotifications(preferences.matchNotifications ?? true);
          setMessageNotifications(preferences.messageNotifications ?? true);
        }
      } catch {
        // Use default preferences if local settings are unavailable.
      }

      setLoading(false);
    }

    void loadSettings();
  }, [router]);

  function savePreferences() {
    setError("");
    setNotice("");

    try {
      localStorage.setItem(
        `soully-settings-${email}`,
        JSON.stringify({
          emailNotifications,
          matchNotifications,
          messageNotifications,
        }),
      );
      setNotice("Your preferences have been saved on this device.");
    } catch {
      setError("Unable to save preferences in this browser.");
    }
  }

  async function updatePassword() {
    setError("");
    setNotice("");

    if (password.length < 6) {
      setError("Your new password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setPassword("");
      setConfirmPassword("");
      setNotice("Your password has been updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return;
    }

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

  return (
    <main className="min-h-screen bg-[#fff7f8] text-slate-800">
      <section className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-extrabold tracking-[.2em] text-rose-500">
          YOUR ACCOUNT
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Settings</h1>
        <p className="mt-2 text-slate-500">
          Manage your account and how you use Soully.
        </p>

        {(notice || error) && (
          <div
            role="status"
            className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ? null : <CheckCircle2 size={18} />}
            <p>{error || notice}</p>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                <Mail size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold">Account information</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your account is registered with this email address.
                </p>
                <p className="mt-4 break-all rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold">
                  {email}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                <Bell size={21} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-extrabold">
                  Notification preferences
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose which notifications you would like to receive.
                </p>

                <div className="mt-5 space-y-5">
                  {[
                    {
                      label: "Email notifications",
                      description: "Updates about your Soully account.",
                      value: emailNotifications,
                      set: setEmailNotifications,
                    },
                    {
                      label: "New matches",
                      description:
                        "Stay informed when a mutual match is found.",
                      value: matchNotifications,
                      set: setMatchNotifications,
                    },
                    {
                      label: "New messages",
                      description: "Keep up with conversations.",
                      value: messageNotifications,
                      set: setMessageNotifications,
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex cursor-pointer items-center justify-between gap-4"
                    >
                      <span>
                        <span className="block text-sm font-bold">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item.description}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={item.value}
                        onChange={(e) => item.set(e.target.checked)}
                        className="size-5 accent-rose-500"
                      />
                    </label>
                  ))}
                </div>

                <button
                  onClick={savePreferences}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600"
                >
                  <Save size={16} /> Save preferences
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                <LockKeyhole size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold">Change password</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a strong password you do not use elsewhere.
                </p>

                <form
                  className="mt-5 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void updatePassword();
                  }}
                >
                  <label className="block text-sm font-bold">
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                    />
                  </label>

                  <label className="block text-sm font-bold">
                    Confirm new password
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Enter your new password again"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busy ? "Updating..." : "Update password"}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                <ShieldCheck size={21} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">Privacy and safety</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Keep your passwords private and avoid sharing sensitive
                  personal or financial information with people you have just
                  met.
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Account deletion and data export are not available on this
                  page yet.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-red-100 bg-white p-6 sm:p-8">
            <h2 className="font-extrabold">Sign out</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign out of your Soully account on this device.
            </p>
            <button
              onClick={() => void signOut()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              <LogOut size={17} /> Sign out
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
