"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Send,
  MoreHorizontal,
  ShieldCheck,
  ShieldBan,
  UserRoundX,
  Flag,
  X,
  LoaderCircle,
  Check,
  CheckCheck,
  AlertCircle,
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

type SafetyAction = "unmatch" | "block" | "report" | null;

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or scams" },
  { value: "fake_profile", label: "Fake profile or impersonation" },
  {
    value: "inappropriate_behavior",
    label: "Inappropriate behavior",
  },
  { value: "other", label: "Other" },
] as const;

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [safetyDialog, setSafetyDialog] = useState<SafetyAction>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const typingActiveRef = useRef(false);

  const otherUserId = profile && userId ? profile.user_id : null;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, []);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id, user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();

      if (matchError) throw matchError;

      if (!match || (match.user_a !== user.id && match.user_b !== user.id)) {
        setError("This conversation is unavailable.");
        setLoading(false);
        return;
      }

      const otherId = match.user_a === user.id ? match.user_b : match.user_a;

      // Do not open a conversation if either user has blocked the other.
      const { data: blocks, error: blockError } = await supabase
        .from("user_blocks")
        .select("id")
        .or(
          `and(blocker_id.eq.${user.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${user.id})`,
        )
        .limit(1);

      if (blockError) throw blockError;

      if (blocks && blocks.length > 0) {
        setError("This conversation is no longer available.");
        setLoading(false);
        return;
      }

      const [
        { data: otherProfile, error: profileError },
        { data: chatMessages, error: messagesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, photo_url, city")
          .eq("user_id", otherId)
          .maybeSingle(),

        supabase
          .from("messages")
          .select("id, match_id, sender_id, content, created_at, read_at")
          .eq("match_id", matchId)
          .order("created_at", { ascending: true }),
      ]);

      if (profileError) throw profileError;
      if (messagesError) throw messagesError;

      if (!otherProfile) {
        setError("This person's profile is unavailable.");
        setLoading(false);
        return;
      }

      setProfile(otherProfile as Profile);
      setMessages((chatMessages ?? []) as MessageRow[]);

      // Mark incoming messages as read.
      const { error: readError } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("match_id", matchId)
        .neq("sender_id", user.id)
        .is("read_at", null);

      if (readError) {
        console.error("Could not update read receipts:", readError);
      }

      setLoading(false);
    } catch (err) {
      console.error("Chat loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load this conversation.",
      );
      setLoading(false);
    }
  }, [matchId, router, supabase]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  // Subscribe to new messages and typing updates.
  useEffect(() => {
    if (!userId || !matchId) return;

    const messageChannel = supabase
      .channel(`messages-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const incoming = payload.new as MessageRow;

          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }

            return [...current, incoming].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );
          });

          if (incoming.sender_id !== userId) {
            const { error: readError } = await supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", incoming.id)
              .is("read_at", null);

            if (readError) {
              console.error("Read receipt error:", readError);
            }
          }

          scrollToBottom();
        },
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing-${matchId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === userId) return;

        setOtherTyping(Boolean(payload?.isTyping));
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingActiveRef.current = false;
      typingChannelRef.current = null;

      void supabase.removeChannel(messageChannel);
      void supabase.removeChannel(typingChannel);
    };
  }, [matchId, scrollToBottom, supabase, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherTyping, scrollToBottom]);

  async function broadcastTyping(isTyping: boolean) {
    const channel = typingChannelRef.current;
    if (!channel) return;

    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, isTyping },
    });
  }

  function handleDraftChange(value: string) {
    setDraft(value);

    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      void broadcastTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      void broadcastTyping(false);
    }, 1200);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || !userId || sending || !profile) return;

    setSending(true);
    setError(null);

    try {
      // Check that the match still exists before sending.
      const { data: activeMatch, error: matchError } = await supabase
        .from("matches")
        .select("id")
        .eq("id", matchId)
        .maybeSingle();

      if (matchError) throw matchError;

      if (!activeMatch) {
        throw new Error("This connection is no longer available.");
      }

      const { data: blocks, error: blockError } = await supabase
        .from("user_blocks")
        .select("id")
        .or(
          `and(blocker_id.eq.${userId},blocked_id.eq.${profile.user_id}),and(blocker_id.eq.${profile.user_id},blocked_id.eq.${userId})`,
        )
        .limit(1);

      if (blockError) throw blockError;

      if (blocks && blocks.length > 0) {
        throw new Error("Messaging is unavailable for this connection.");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert({
          match_id: matchId,
          sender_id: userId,
          content,
        })
        .select("id, match_id, sender_id, content, created_at, read_at")
        .single();

      if (insertError) throw insertError;

      setMessages((current) => {
        if (current.some((message) => message.id === inserted.id)) {
          return current;
        }

        return [...current, inserted as MessageRow];
      });

      setDraft("");
      typingActiveRef.current = false;
      void broadcastTyping(false);
      scrollToBottom();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  function openSafetyDialog(action: Exclude<SafetyAction, null>) {
    setMenuOpen(false);
    setSafetyError(null);
    setSafetyDialog(action);
  }

  async function handleUnmatch() {
    if (!userId || safetyBusy) return;

    setSafetyBusy(true);
    setSafetyError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("unmatch_user", {
        target_match_id: matchId,
      });

      if (rpcError) throw rpcError;

      if (data !== true) {
        throw new Error("This connection could not be found.");
      }

      router.replace("/messages");
    } catch (err) {
      setSafetyError(
        err instanceof Error ? err.message : "Could not unmatch this user.",
      );
    } finally {
      setSafetyBusy(false);
    }
  }

  async function handleBlock() {
    if (!userId || !profile || safetyBusy) return;

    setSafetyBusy(true);
    setSafetyError(null);

    try {
      const { error: blockError } = await supabase.from("user_blocks").upsert(
        {
          blocker_id: userId,
          blocked_id: profile.user_id,
        },
        { onConflict: "blocker_id,blocked_id" },
      );

      if (blockError) throw blockError;

      const { error: unmatchError } = await supabase.rpc("unmatch_user", {
        target_match_id: matchId,
      });

      if (unmatchError) {
        throw new Error(
          "The user was blocked, but the connection could not be removed. Please try again.",
        );
      }

      router.replace("/messages");
    } catch (err) {
      setSafetyError(
        err instanceof Error ? err.message : "Could not block this user.",
      );
    } finally {
      setSafetyBusy(false);
    }
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !profile || safetyBusy) return;

    setSafetyBusy(true);
    setSafetyError(null);

    try {
      const { error: reportError } = await supabase
        .from("user_reports")
        .insert({
          reporter_id: userId,
          reported_id: profile.user_id,
          reason: reportReason,
          details: reportDetails.trim() || null,
        });

      if (reportError) throw reportError;

      setSafetyDialog(null);
      setReportDetails("");
      setReportReason("harassment");
      setNotice("Your report has been submitted for review.");
    } catch (err) {
      setSafetyError(
        err instanceof Error ? err.message : "Could not submit your report.",
      );
    } finally {
      setSafetyBusy(false);
    }
  }

  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <main className="flex min-h-[70dvh] items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-gray-500">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Loading conversation...</span>
        </div>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="flex min-h-[70dvh] items-center justify-center bg-gray-50 px-5">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <h1 className="text-lg font-semibold text-gray-900">
            Conversation unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <Link
            href="/messages"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Messages
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#FAF9F7] text-gray-900">
      {/* Chat header */}
      <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/messages")}
          aria-label="Back to messages"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {profile?.photo_url ? (
          <img
            src={profile.photo_url}
            alt={profile.display_name}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-lg font-semibold text-rose-700">
            {profile?.display_name?.charAt(0)?.toUpperCase() || "S"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-semibold text-gray-900">
              {profile?.display_name || "Soully member"}
            </h1>
            <ShieldCheck className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <p className="truncate text-xs text-gray-500">
            {otherTyping ? "Typing..." : profile?.city || "Connected on Soully"}
          </p>
        </div>

        {/* Conversation safety menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close options menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white py-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => openSafetyDialog("unmatch")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  <UserRoundX className="h-4 w-4" />
                  Unmatch
                </button>

                <button
                  type="button"
                  onClick={() => openSafetyDialog("block")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 transition hover:bg-red-50"
                >
                  <ShieldBan className="h-4 w-4" />
                  Block user
                </button>

                <button
                  type="button"
                  onClick={() => openSafetyDialog("report")}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  <Flag className="h-4 w-4" />
                  Report user
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Message list */}
      <section
        aria-label="Chat messages"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="mb-3 flex flex-col items-center text-center">
            <Heart className="mb-2 h-7 w-7 fill-rose-500 text-rose-500" />
            <p className="text-sm font-semibold text-gray-800">
              You connected with {profile?.display_name}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Say hello and get the conversation started.
            </p>
          </div>

          {notice && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notice"
                className="rounded p-1 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {messages.length === 0 && (
            <div className="my-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                <Heart className="h-6 w-6 text-rose-500" />
              </div>
              <p className="font-medium text-gray-800">
                Your conversation starts here
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Send a friendly first message.
              </p>
            </div>
          )}

          {messages.map((message, index) => {
            const isMine = message.sender_id === userId;
            const previous = messages[index - 1];
            const showTime =
              !previous ||
              new Date(message.created_at).getTime() -
                new Date(previous.created_at).getTime() >
                5 * 60 * 1000;

            return (
              <div key={message.id}>
                {showTime && (
                  <p className="my-3 text-center text-[11px] text-gray-400">
                    {new Date(message.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {formatTime(message.created_at)}
                  </p>
                )}

                <div
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[75%] ${
                      isMine
                        ? "rounded-br-md bg-rose-600 text-white"
                        : "rounded-bl-md border border-gray-100 bg-white text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {isMine && (
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-rose-100">
                        <span>{formatTime(message.created_at)}</span>
                        {message.read_at ? (
                          <CheckCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {otherTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      {/* Composer */}
      <footer className="shrink-0 border-t border-gray-200 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSend} className="flex items-end gap-2">
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
              maxLength={4000}
              placeholder={`Message ${profile?.display_name || ""}...`}
              aria-label="Write a message"
              className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100"
            />

            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>

          <p className="mt-2 text-center text-[10px] text-gray-400">
            Be respectful. You can block or report someone at any time.
          </p>
        </div>
      </footer>

      {/* Safety confirmation and report dialogs */}
      {safetyDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!safetyBusy) {
              setSafetyDialog(null);
              setSafetyError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="safety-dialog-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                  Soully safety
                </p>
                <h2
                  id="safety-dialog-title"
                  className="mt-1 text-xl font-semibold text-gray-900"
                >
                  {safetyDialog === "unmatch"
                    ? "Unmatch this person?"
                    : safetyDialog === "block"
                      ? "Block this person?"
                      : "Report this person"}
                </h2>
              </div>

              <button
                type="button"
                disabled={safetyBusy}
                onClick={() => {
                  setSafetyDialog(null);
                  setSafetyError(null);
                }}
                aria-label="Close dialog"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {safetyDialog === "unmatch" && (
              <>
                <p className="text-sm leading-6 text-gray-600">
                  This removes your connection and returns you to your inbox.
                  You may not be able to reconnect later.
                </p>
                <button
                  type="button"
                  disabled={safetyBusy}
                  onClick={handleUnmatch}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {safetyBusy && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  Unmatch
                </button>
              </>
            )}

            {safetyDialog === "block" && (
              <>
                <p className="text-sm leading-6 text-gray-600">
                  Blocking removes this connection. Soully should also hide this
                  person from your Discover and Likes pages and prevent future
                  messaging.
                </p>
                <button
                  type="button"
                  disabled={safetyBusy}
                  onClick={handleBlock}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {safetyBusy && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  Block user
                </button>
              </>
            )}

            {safetyDialog === "report" && (
              <form onSubmit={handleReport} className="space-y-4">
                <p className="text-sm leading-6 text-gray-600">
                  Tell us what happened. Your report will be submitted for
                  moderation review.
                </p>

                <label className="block text-sm font-medium text-gray-700">
                  Reason for report
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-gray-700">
                  Additional details (optional)
                  <textarea
                    value={reportDetails}
                    onChange={(event) => setReportDetails(event.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Share details that may help our review..."
                    className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />
                  <span className="mt-1 block text-right text-xs text-gray-400">
                    {reportDetails.length}/1000
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={safetyBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {safetyBusy && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  Submit report
                </button>
              </form>
            )}

            {safetyError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {safetyError}
              </p>
            )}

            <button
              type="button"
              disabled={safetyBusy}
              onClick={() => {
                setSafetyDialog(null);
                setSafetyError(null);
              }}
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
