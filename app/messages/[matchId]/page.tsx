"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Send, MoreHorizontal, ShieldCheck, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MatchRow = { id: string; user_a: string; user_b: string };
type Profile = { user_id: string; display_name: string; photo_url: string | null; city: string | null };
type MessageRow = { id: string; match_id: string; sender_id: string; content: string; created_at: string; read_at: string | null };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}
function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function dayLabel(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [person, setPerson] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const loadChat = useCallback(async () => {
    setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/auth");
        return;
      }
      setUserId(user.id);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("id,user_a,user_b")
        .eq("id", matchId)
        .maybeSingle();
      if (matchError) throw matchError;
      if (!matchData || (matchData.user_a !== user.id && matchData.user_b !== user.id)) {
        setError("This conversation doesn't exist or you don't have access to it.");
        setMatch(null);
        return;
      }
      const matchRow = matchData as MatchRow;
      setMatch(matchRow);
      const otherId = matchRow.user_a === user.id ? matchRow.user_b : matchRow.user_a;

      const [{ data: profile, error: profileError }, { data: messageData, error: messageError }] = await Promise.all([
        supabase.from("profiles").select("user_id,display_name,photo_url,city").eq("user_id", otherId).maybeSingle(),
        supabase.from("messages").select("id,match_id,sender_id,content,created_at,read_at").eq("match_id", matchId).order("created_at", { ascending: true }).limit(500),
      ]);
      if (profileError) throw profileError;
      if (messageError) throw messageError;
      setPerson((profile as Profile | null) ?? null);
      setMessages((messageData ?? []) as MessageRow[]);

      const unreadIds = ((messageData ?? []) as MessageRow[])
        .filter((message) => message.sender_id !== user.id && !message.read_at)
        .map((message) => message.id);
      if (unreadIds.length) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this conversation.");
    } finally {
      setLoading(false);
    }
  }, [matchId, router, supabase]);

  useEffect(() => { void loadChat(); }, [loadChat]);

  useEffect(() => {
    if (!matchId || !userId) return;
    const channel = supabase
      .channel(`messages-${matchId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        const incoming = payload.new as MessageRow;
        setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.sender_id !== userId && !incoming.read_at) {
          void supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", incoming.id);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [matchId, supabase, userId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !match || sending || content.length > 5000) return;
    setSending(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) throw new Error("Your session has expired. Please sign in again.");
      const { data, error: insertError } = await supabase.from("messages").insert({
        match_id: match.id,
        sender_id: user.id,
        content,
      }).select("id,match_id,sender_id,content,created_at,read_at").single();
      if (insertError) throw insertError;
      if (data) setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data as MessageRow]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const lastMessageByDay = (index: number) => index === 0 ||
    new Date(messages[index - 1].created_at).toDateString() !== new Date(messages[index].created_at).toDateString();

  return (
    <main className="min-h-screen bg-soully-blush px-0 py-0 text-soully-ink sm:px-4 sm:py-6 lg:px-6">
      <section className="mx-auto flex h-[100dvh] max-w-5xl flex-col overflow-hidden bg-white shadow-xl shadow-rose-100/60 sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:border sm:border-rose-100">
        <header className="flex items-center gap-3 border-b border-rose-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <Link href="/messages" aria-label="Back to messages" className="grid size-10 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-rose-50"><ArrowLeft size={20}/></Link>
          {person?.photo_url ? <img src={person.photo_url} alt="" className="size-11 shrink-0 rounded-full object-cover"/> : <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 font-bold text-soully-pink">{initials(person?.display_name ?? "Soully")}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-base font-extrabold">{loading ? "Opening conversation…" : person?.display_name ?? "Conversation"}</h1>
            <p className="mt-0.5 truncate text-xs text-slate-500">{person?.city ?? "Your Soully match"}</p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-rose-50 px-3 py-2 text-xs font-bold text-soully-pink sm:flex"><Heart size={14} fill="currentColor"/> Matched on Soully</div>
          <button type="button" title="Safety reminder" onClick={() => alert("Keep your personal information private. If you feel uncomfortable, stop replying and use blocking/reporting when available.")} className="grid size-10 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><MoreHorizontal size={20}/></button>
        </header>

        <div className="flex items-center justify-center gap-2 border-b border-rose-50 bg-rose-50/50 px-4 py-2.5 text-center text-xs text-slate-500"><ShieldCheck size={15} className="text-soully-pink"/> Be kind, respect boundaries, and protect your personal information.</div>

        <section aria-label="Messages" className="flex-1 overflow-y-auto bg-gradient-to-b from-white via-white to-rose-50/30 px-4 py-5 sm:px-8 sm:py-7">
          {error && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {loading ? <div className="grid h-full place-items-center text-sm text-slate-400"><span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={18}/> Loading your conversation…</span></div>
          : messages.length ? <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {messages.map((message, index) => {
              const own = message.sender_id === userId;
              return <div key={message.id}>
                {lastMessageByDay(index) && <div className="my-5 text-center"><span className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-400">{dayLabel(message.created_at)}</span></div>}
                <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] ${own ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`whitespace-pre-wrap break-words px-4 py-3 text-sm leading-6 shadow-sm ${own ? "rounded-2xl rounded-br-md bg-soully-pink text-white" : "rounded-2xl rounded-bl-md border border-rose-100 bg-white text-soully-ink"}`}>{message.content}</div>
                    <span className={`mt-1 px-1 text-[10px] text-slate-400 ${own ? "text-right" : ""}`}>{timeLabel(message.created_at)}{own && message.read_at ? " · Read" : ""}</span>
                  </div>
                </div>
              </div>;
            })}
            <div ref={bottomRef}/>
          </div> : (
            <div className="grid h-full place-items-center py-10 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-soully-pink"><Heart size={29} fill="currentColor"/></div>
                <h2 className="mt-5 font-heading text-2xl font-extrabold">It’s a match!</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">You and {person?.display_name ?? "your match"} liked each other. Start with a simple hello and see where the conversation goes.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">{["Hey! 👋", "How’s your week going?", "What do you enjoy doing?"].map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)} className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-soully-pink transition hover:bg-rose-50">{suggestion}</button>)}</div>
              </div>
            </div>
          )}
        </section>

        <form onSubmit={sendMessage} className="border-t border-rose-100 bg-white p-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.5rem] border border-rose-100 bg-slate-50 p-2 transition focus-within:border-rose-300 focus-within:bg-white focus-within:shadow-sm">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={5000} placeholder="Write a thoughtful message…" aria-label="Message text" className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400" disabled={loading || !match || sending}/>
            <button type="submit" disabled={!draft.trim() || sending || loading || !match} className="grid size-11 shrink-0 place-items-center rounded-full bg-soully-pink text-white shadow-md shadow-rose-200 transition hover:bg-soully-pink-dark disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">{sending ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>}</button>
          </div>
          <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between px-2 text-[10px] text-slate-400"><span>Press Enter to send · Shift + Enter for a new line</span><span>{draft.length}/5000</span></div>
        </form>
      </section>
    </main>
  );
}
