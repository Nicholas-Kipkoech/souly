"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Search, Sparkles, ArrowUpRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  city: string | null;
};
type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at?: string;
};
type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
};
type Conversation = {
  match: MatchRow;
  person: Profile;
  lastMessage: MessageRow | null;
  unread: number;
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/auth");
        return;
      }
      setUserId(user.id);

      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (matchError) throw matchError;

      const matchRows = (matches ?? []) as MatchRow[];
      if (!matchRows.length) {
        setConversations([]);
        return;
      }

      const otherIds = [...new Set(matchRows.map((m) => m.user_a === user.id ? m.user_b : m.user_a))];
      const [{ data: profiles, error: profileError }, { data: messages, error: messagesError }] = await Promise.all([
        supabase.from("profiles").select("user_id,display_name,photo_url,city").in("user_id", otherIds),
        supabase.from("messages").select("id,match_id,sender_id,content,created_at,read_at").in("match_id", matchRows.map((m) => m.id)).order("created_at", { ascending: false }),
      ]);
      if (profileError) throw profileError;
      if (messagesError) throw messagesError;

      const profileMap = new Map(((profiles ?? []) as Profile[]).map((p) => [p.user_id, p]));
      const messageRows = (messages ?? []) as MessageRow[];
      const built: Conversation[] = matchRows.flatMap((match) => {
        const otherId = match.user_a === user.id ? match.user_b : match.user_a;
        const person = profileMap.get(otherId);
        if (!person) return [];
        const matchMessages = messageRows.filter((message) => message.match_id === match.id);
        return [{
          match,
          person,
          lastMessage: matchMessages[0] ?? null,
          unread: matchMessages.filter((message) => message.sender_id !== user.id && !message.read_at).length,
        }];
      });
      built.sort((a, b) => {
        const aTime = a.lastMessage?.created_at ?? a.match.created_at ?? "";
        const bTime = b.lastMessage?.created_at ?? b.match.created_at ?? "";
        return bTime.localeCompare(aTime);
      });
      setConversations(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your conversations.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) =>
      c.person.display_name.toLowerCase().includes(term) ||
      (c.lastMessage?.content ?? "").toLowerCase().includes(term)
    );
  }, [conversations, query]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-soully-blush text-soully-ink">
      <header className="sticky top-0 z-20 border-b border-rose-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-extrabold text-soully-pink"><Heart fill="currentColor" size={22}/> Soully</Link>
          <nav className="flex items-center gap-2">
            <Link href="/discover" className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-rose-50">Discover</Link>
            <Link href="/profile/setup" className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-rose-50">My profile</Link>
            <button onClick={signOut} aria-label="Sign out" className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><LogOut size={18}/></button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold tracking-[.22em] text-soully-pink">A LITTLE SPARK CAN GO A LONG WAY</p>
            <h1 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">Your conversations</h1>
            <p className="mt-2 text-sm text-slate-500">Good connections grow one message at a time.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm"><Heart size={16} className="text-soully-pink" fill="currentColor"/>{conversations.length} {conversations.length === 1 ? "match" : "matches"}</div>
        </div>

        {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid min-h-[620px] overflow-hidden rounded-[2rem] border border-rose-100 bg-white shadow-xl shadow-rose-100/60 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-rose-100 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-extrabold">Messages</h2>
                <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-soully-pink"><MessageCircle size={18}/></span>
              </div>
              <label className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 focus-within:border-rose-300 focus-within:bg-white">
                <Search size={17} className="shrink-0 text-slate-400"/>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"/>
              </label>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-2">
              {loading ? (
                <div className="space-y-3 p-3">{[1,2,3,4].map((n) => <div key={n} className="flex animate-pulse gap-3 rounded-2xl p-3"><div className="size-12 rounded-full bg-rose-100"/><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-1/2 rounded bg-slate-100"/><div className="h-3 w-4/5 rounded bg-slate-100"/></div></div>)}</div>
              ) : filtered.length ? filtered.map((conversation) => (
                <Link key={conversation.match.id} href={`/messages/${conversation.match.id}`} className="group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-rose-50/80">
                  <div className="relative shrink-0">
                    {conversation.person.photo_url ? <img src={conversation.person.photo_url} alt="" className="size-12 rounded-full object-cover ring-2 ring-white"/> : <div className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 font-bold text-soully-pink">{initials(conversation.person.display_name)}</div>}
                    {conversation.unread > 0 && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-soully-pink"/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-extrabold">{conversation.person.display_name}</p><span className="shrink-0 text-[11px] text-slate-400">{formatTime(conversation.lastMessage?.created_at ?? conversation.match.created_at)}</span></div>
                    <p className={`mt-1 truncate text-xs ${conversation.unread ? "font-bold text-soully-ink" : "text-slate-500"}`}>{conversation.lastMessage?.content ?? "You matched! Say hello ✨"}</p>
                  </div>
                  {conversation.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-soully-pink px-1.5 py-1 text-[10px] font-extrabold text-white">{conversation.unread}</span>}
                </Link>
              )) : (
                <div className="px-5 py-12 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-soully-pink"><Heart size={25}/></span>
                  <h3 className="mt-4 font-heading text-lg font-extrabold">{query ? "No conversations found" : "Your story starts here"}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">{query ? "Try another name or message." : "When you and someone like each other, your match will appear here."}</p>
                  {!query && <Link href="/discover" className="mt-5 inline-flex items-center gap-2 rounded-full bg-soully-pink px-5 py-3 text-sm font-bold text-white hover:bg-soully-pink-dark">Discover people <ArrowUpRight size={16}/></Link>}
                </div>
              )}
            </div>
          </aside>

          <div className="hidden items-center justify-center bg-gradient-to-br from-white via-rose-50/40 to-orange-50/50 p-10 text-center lg:flex">
            <div className="max-w-md">
              <div className="relative mx-auto grid size-28 place-items-center rounded-[2rem] bg-white shadow-xl shadow-rose-100">
                <div className="absolute -right-2 -top-2 grid size-10 place-items-center rounded-2xl bg-soully-pink text-white"><Sparkles size={19}/></div>
                <MessageCircle size={45} className="text-soully-pink"/>
              </div>
              <h2 className="mt-7 font-heading text-2xl font-extrabold">Make the first move</h2>
              <p className="mt-3 leading-7 text-slate-500">Choose a conversation to pick up where you left off, or say hello to someone new you’ve matched with.</p>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400"><Heart size={14} className="text-soully-pink" fill="currentColor"/> Kindness looks good on everyone</div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Only people you have mutually matched with can appear in your inbox.</p>
      </section>
    </main>
  );
}
