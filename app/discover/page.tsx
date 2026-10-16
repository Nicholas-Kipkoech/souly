import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DiscoverPage() {
  let signedIn = false;
  try { const supabase = await createClient(); const { data } = await supabase.auth.getUser(); signedIn = !!data.user; } catch { /* Supabase env may not be configured yet. */ }
  return <main className="grid min-h-screen place-items-center bg-soully-blush px-5 py-12"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl shadow-rose-100 sm:p-12"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-soully-pink"><Sparkles size={30}/></span><h1 className="mt-6 font-heading text-3xl font-extrabold">Your next connection is on the way.</h1><p className="mx-auto mt-3 max-w-md leading-7 text-slate-500">This starter version includes the Soully landing page and profile setup. Discovery cards, likes, mutual matches, chat, photo uploads, reporting, and blocking still need to be implemented before launch.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href={signedIn?"/profile/setup":"/auth"} className="inline-flex items-center gap-2 rounded-full bg-soully-pink px-5 py-3 font-bold text-white hover:bg-soully-pink-dark">{signedIn?"Edit profile":"Get started"} <Heart size={16}/></Link><Link href="/" className="rounded-full border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:border-soully-pink hover:text-soully-pink">Back home</Link></div></section></main>;
}
