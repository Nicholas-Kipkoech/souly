"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Send,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
};

type Profile = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  city: string | null;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "S"
  );
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();

  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState("");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [person, setPerson] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      const channel = typingChannelRef.current;

      if (!channel || !userId) return;

      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId,
          isTyping,
        },
      });
    },
    [userId],
  );

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

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

      if (
        !matchData ||
        (matchData.user_a !== user.id && matchData.user_b !== user.id)
      ) {
        setError(
          "This conversation doesn't exist or you don't have access to it.",
        );
        setMatch(null);
        return;
      }

      const matchRow = matchData as MatchRow;
      setMatch(matchRow);

      const otherId =
        matchRow.user_a === user.id ? matchRow.user_b : matchRow.user_a;

      const [
        { data: profile, error: profileError },
        { data: messageData, error: messageError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,photo_url,city")
          .eq("user_id", otherId)
          .maybeSingle(),

        supabase
          .from("messages")
          .select("id,match_id,sender_id,content,created_at,read_at")
          .eq("match_id", matchId)
          .order("created_at", { ascending: true })
          .limit(500),
      ]);

      if (profileError) throw profileError;
      if (messageError) throw messageError;

      const loadedMessages = (messageData ?? []) as MessageRow[];

      setPerson((profile as Profile | null) ?? null);
      setMessages(loadedMessages);

      const unreadIds = loadedMessages
        .filter((message) => message.sender_id !== user.id && !message.read_at)
        .map((message) => message.id);

      if (unreadIds.length) {
        const { error: readError } = await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);

        if (readError) {
          console.error("Could not update read receipts:", readError);
        } else {
          setMessages((current) =>
            current.map((message) =>
              unreadIds.includes(message.id)
                ? { ...message, read_at: new Date().toISOString() }
                : message,
            ),
          );
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open this conversation.",
      );
    } finally {
      setLoading(false);
    }
  }, [matchId, router, supabase]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  // Listen for new messages.
  useEffect(() => {
    if (!matchId || !userId) return;

    const channel = supabase
      .channel(`messages-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const incoming = payload.new as MessageRow;

          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming],
          );

          if (incoming.sender_id !== userId && !incoming.read_at) {
            const readAt = new Date().toISOString();

            void supabase
              .from("messages")
              .update({ read_at: readAt })
              .eq("id", incoming.id)
              .then(({ error: readError }) => {
                if (readError) {
                  console.error("Could not mark message as read:", readError);
                  return;
                }

                setMessages((current) =>
                  current.map((message) =>
                    message.id === incoming.id
                      ? { ...message, read_at: readAt }
                      : message,
                  ),
                );
              });
          }

          if (incoming.sender_id !== userId) {
            setOtherTyping(false);

            if (remoteTypingTimeoutRef.current) {
              clearTimeout(remoteTypingTimeoutRef.current);
              remoteTypingTimeoutRef.current = null;
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, supabase, userId]);

  // Listen for typing events.
  useEffect(() => {
    if (!matchId || !userId) return;

    let active = true;

    const channel = supabase.channel(`typing-${matchId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    typingChannelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!active || !payload || payload.userId === userId) return;

        const isTyping = payload.isTyping === true;

        setOtherTyping(isTyping);

        if (remoteTypingTimeoutRef.current) {
          clearTimeout(remoteTypingTimeoutRef.current);
          remoteTypingTimeoutRef.current = null;
        }

        if (isTyping) {
          remoteTypingTimeoutRef.current = setTimeout(() => {
            setOtherTyping(false);
            remoteTypingTimeoutRef.current = null;
          }, 4000);
        }
      })
      .subscribe();

    return () => {
      active = false;

      if (typingChannelRef.current === channel) {
        typingChannelRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }

      setOtherTyping(false);
      void supabase.removeChannel(channel);
    };
  }, [matchId, supabase, userId]);

  // Scroll to the latest message or typing indicator.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  function handleDraftChange(value: string) {
    setDraft(value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    broadcastTyping(value.trim().length > 0);

    if (value.trim().length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTyping(false);
        typingTimeoutRef.current = null;
      }, 1500);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || !match || sending || content.length > 5000) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    broadcastTyping(false);

    setSending(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== userId) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          match_id: match.id,
          sender_id: user.id,
          content,
        })
        .select("id,match_id,sender_id,content,created_at,read_at")
        .single();

      if (insertError) throw insertError;

      if (data) {
        setMessages((current) =>
          current.some((message) => message.id === data.id)
            ? current
            : [...current, data as MessageRow],
        );
      }

      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Message could not be sent. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  function handleBack() {
    router.push("/messages");
  }

  const lastMessageByDay = (index: number) =>
    index === 0 ||
    new Date(messages[index - 1].created_at).toDateString() !==
      new Date(messages[index].created_at).toDateString();

  return (
    <main className="h-[100dvh] overflow-hidden bg-white text-soully-ink sm:min-h-screen sm:h-auto sm:bg-soully-blush sm:px-4 sm:py-6 lg:px-6">
      <section className="mx-auto flex h-full min-h-0 max-w-5xl flex-col overflow-hidden bg-white sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:border sm:border-rose-100 sm:shadow-xl sm:shadow-rose-100/60">
        {/* Safety notice */}
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-rose-50 bg-rose-50/50 px-3 py-2.5 text-center text-[10px] text-slate-500 sm:text-xs">
          <ShieldCheck size={15} className="shrink-0 text-soully-pink" />
          <span>
            Be kind, respect boundaries, and protect your personal information.
          </span>
        </div>

        {/* Mobile header with back navigation */}
        <header className="flex shrink-0 items-center gap-3 border-b border-rose-100 bg-white px-4 py-3 sm:hidden">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to messages"
            className="grid size-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-rose-50 hover:text-soully-pink"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            {person?.photo_url ? (
              <img
                src={person.photo_url}
                alt={`${person.display_name}'s profile`}
                className="size-10 shrink-0 rounded-full border border-rose-100 object-cover"
              />
            ) : (
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 text-sm font-bold text-soully-pink">
                {initials(person?.display_name ?? "Soully")}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-soully-ink">
                {person?.display_name ??
                  (loading ? "Loading chat…" : "Your match")}
              </h1>
              <p className="truncate text-xs text-slate-400">
                {person?.city ?? "Matched on Soully"}
              </p>
            </div>
          </div>
        </header>

        {/* Messages: independently scrollable */}
        <section
          aria-label="Messages"
          aria-live="polite"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-white via-white to-rose-50/30 px-4 py-5 sm:px-8 sm:py-7"
        >
          {error && (
            <div
              role="alert"
              className="mx-auto mb-4 max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="animate-spin" size={18} />
                Loading your conversation…
              </span>
            </div>
          ) : !match ? (
            <div className="grid h-full place-items-center px-4 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-soully-pink">
                  <Heart size={25} />
                </div>

                <h2 className="mt-4 text-lg font-bold">
                  Conversation unavailable
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {error || "This conversation could not be found."}
                </p>

                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-soully-pink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-soully-pink-dark"
                >
                  <ArrowLeft size={16} />
                  Back to messages
                </button>
              </div>
            </div>
          ) : messages.length ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              {messages.map((message, index) => {
                const own = message.sender_id === userId;

                return (
                  <div key={message.id}>
                    {lastMessageByDay(index) && (
                      <div className="my-5 text-center">
                        <span className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-400">
                          {dayLabel(message.created_at)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex items-end gap-2 ${
                        own ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!own && (
                        <div className="mb-5 shrink-0">
                          {person?.photo_url ? (
                            <img
                              src={person.photo_url}
                              alt={`${person.display_name}'s profile`}
                              className="size-8 rounded-full border border-rose-100 object-cover shadow-sm"
                            />
                          ) : (
                            <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 text-xs font-bold text-soully-pink">
                              {initials(person?.display_name ?? "Soully")}
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${
                          own ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`whitespace-pre-wrap break-words px-4 py-3 text-sm leading-6 shadow-sm ${
                            own
                              ? "rounded-2xl rounded-br-md bg-soully-pink text-white"
                              : "rounded-2xl rounded-bl-md border border-rose-100 bg-white text-soully-ink"
                          }`}
                        >
                          {message.content}
                        </div>

                        <span
                          className={`mt-1 px-1 text-[10px] text-slate-400 ${
                            own ? "text-right" : ""
                          }`}
                        >
                          {timeLabel(message.created_at)}
                          {own && message.read_at ? " · Read" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {otherTyping && (
                <div className="flex items-end gap-2 self-start py-1">
                  {person?.photo_url ? (
                    <img
                      src={person.photo_url}
                      alt={`${person.display_name}'s profile`}
                      className="size-8 rounded-full border border-rose-100 object-cover"
                    />
                  ) : (
                    <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 text-xs font-bold text-soully-pink">
                      {initials(person?.display_name ?? "Soully")}
                    </div>
                  )}

                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-rose-100 bg-white px-4 py-3 shadow-sm">
                    <span
                      className="flex items-center gap-1"
                      aria-hidden="true"
                    >
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="size-1.5 animate-bounce rounded-full bg-soully-pink"
                          style={{
                            animationDelay: `${dot * 150}ms`,
                          }}
                        />
                      ))}
                    </span>

                    <span className="text-xs text-slate-500">
                      {person?.display_name ?? "Your match"} is typing…
                    </span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          ) : (
            <div className="grid min-h-full place-items-center py-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-soully-pink">
                  <Heart size={29} fill="currentColor" />
                </div>

                <h2 className="mt-5 font-heading text-2xl font-extrabold">
                  It’s a match!
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  You and {person?.display_name ?? "your match"} liked each
                  other. Start with a simple hello and see where the
                  conversation goes.
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {[
                    "Hey! 👋",
                    "How’s your week going?",
                    "What do you enjoy doing?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleDraftChange(suggestion)}
                      className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-soully-pink transition hover:bg-rose-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {/* Fixed composer at the bottom of the chat */}
        <form
          onSubmit={sendMessage}
          className="shrink-0 border-t border-rose-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.5rem] border border-rose-100 bg-slate-50 p-2 transition focus-within:border-rose-300 focus-within:bg-white focus-within:shadow-sm">
            <textarea
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={5000}
              placeholder="Write a thoughtful message…"
              aria-label="Message text"
              className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
              disabled={loading || !match || sending}
            />

            <button
              type="submit"
              disabled={!draft.trim() || sending || loading || !match}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-soully-pink text-white shadow-md shadow-rose-200 transition hover:bg-soully-pink-dark disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              {sending ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between px-2 text-[10px] text-slate-400">
            <span>Enter to send · Shift + Enter for a new line</span>
            <span>{draft.length}/5000</span>
          </div>
        </form>
      </section>
    </main>
  );
}
