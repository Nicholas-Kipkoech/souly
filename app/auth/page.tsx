"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) router.push("/profile/setup");
        else
          setMessage(
            "Check your email for a confirmation link, then come back to sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/profile/setup");
        router.refresh();
      }
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen bg-soully-blush lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#ed4266] to-[#a92b60] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-extrabold"
        >
          <Heart fill="currentColor" /> Soully
        </Link>
        <div className="relative z-10 max-w-lg">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-white/75">
            Make room for something real
          </p>
          <h1 className="mt-5 font-heading text-6xl font-extrabold leading-tight">
            Your next great story starts here.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-white/85">
            Meet people who share your values, spark your curiosity, and make
            you feel like yourself.
          </p>
        </div>
        <p className="text-sm text-white/70">
          Meaningful connections, on your terms.
        </p>
        <div className="absolute -bottom-28 -right-20 size-96 rounded-full border-[50px] border-white/10" />
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-soully-pink"
          >
            <ArrowLeft size={16} /> Back to Soully
          </Link>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-2xl font-extrabold text-soully-pink lg:hidden"
          >
            <Heart fill="currentColor" /> Soully
          </Link>
          <div className="mt-8 rounded-3xl bg-white p-7 shadow-xl shadow-rose-100/70 sm:p-9">
            <h2 className="font-heading text-3xl font-extrabold">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "signup"
                ? "Start with your email. Your story is yours to write."
                : "Sign in to continue your Soully journey."}
            </p>
            <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
                className={`rounded-lg py-2.5 text-sm font-bold ${mode === "signup" ? "bg-white text-soully-pink shadow-sm" : "text-slate-500"}`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
                className={`rounded-lg py-2.5 text-sm font-bold ${mode === "login" ? "bg-white text-soully-pink shadow-sm" : "text-slate-500"}`}
              >
                Log in
              </button>
            </div>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block text-sm font-bold">
                Password
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-soully-pink focus:ring-4 focus:ring-rose-100"
                  placeholder="At least 6 characters"
                />
              </label>
              {message && (
                <p
                  role="status"
                  className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700"
                >
                  {message}
                </p>
              )}
              <button
                disabled={busy}
                className="w-full rounded-xl bg-soully-pink px-4 py-3.5 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-soully-pink-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>
            <p className="mt-5 text-xs leading-5 text-slate-400">
              By continuing, you agree to use Soully respectfully and follow our
              community guidelines.
            </p>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            You must be 18 or older to use Soully.
          </p>
        </div>
      </section>
    </main>
  );
}
