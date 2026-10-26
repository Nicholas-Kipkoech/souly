"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  MessageCircle,
  Search,
  LoaderCircle,
  ArrowRight,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

type Profile = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  city: string | null;
};

type MessageRow = {
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

type Conversation = {
  match: MatchRow;
  profile: Profile;
  latestMessage: MessageRow | null;
  unreadCount: number;
};

export default function MessagesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
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

      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (matchesError) throw matchesError;

      const matchRows = (matches ?? []) as MatchRow[];

      if (!matchRows.length) {
        setConversations([]);
        return;
      }

      const otherIds = [
        ...new Set(
          matchRows.map((match) =>
            match.user_a === user.id ? match.user_b : match.user_a,
          ),
        ),
      ];

      const matchIds = matchRows.map((match) => match.id);

      const [
        { data: profiles, error: profilesError },
        { data: messages, error: messagesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,photo_url,city")
          .in("user_id", otherIds),

        supabase
          .from("messages")
          .select("match_id,sender_id,content,created_at,read_at")
          .in("match_id", matchIds)
          .order("created_at", { ascending: false }),
      ]);

      if (profilesError) throw profilesError;
      if (messagesError) throw messagesError;

      const profileMap = new Map(
        ((profiles ?? []) as Profile[]).map((profile) => [
          profile.user_id,
          profile,
        ]),
      );

      const messageRows = (messages ?? []) as MessageRow[];
      const conversationsWithProfiles: Conversation[] = [];

      for (const match of matchRows) {
        const otherId = match.user_a === user.id ? match.user_b : match.user_a;

        const profile = profileMap.get(otherId);

        // Do not render a conversation if the other profile is unavailable.
        if (!profile) continue;

        const matchMessages = messageRows.filter(
          (message) => message.match_id === match.id,
        );

        const latestMessage = matchMessages[0] ?? null;

        const unreadCount = matchMessages.filter(
          (message) =>
            message.sender_id !== user.id && message.read_at === null,
        ).length;

        conversationsWithProfiles.push({
          match,
          profile,
          latestMessage,
          unreadCount,
        });
      }

      setConversations(conversationsWithProfiles);
    } catch (err) {
      console.error(err);
      setError("Couldn't load your conversations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((conversation) =>
    conversation.profile.display_name
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );

  function formatMessageTime(date: string) {
    const messageDate = new Date(date);

    if (Number.isNaN(messageDate.getTime())) return "";

    const now = new Date();
    const sameDay = messageDate.toDateString() === now.toDateString();

    if (sameDay) {
      return messageDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (messageDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return messageDate.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="min-h-screen bg-[#fff9f8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/discover")}
            aria-label="Back to Discover"
            className="sm:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-rose-500">
              Your connections
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#27202b] sm:text-4xl">
              Messages
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              A little hello can go a long way.
            </p>
          </div>

          <Link
            href="/discover"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-100 transition hover:bg-rose-600"
          >
            <Heart size={16} />
            <span className="hidden sm:inline">Discover</span>
          </Link>
        </header>

        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 py-3.5 shadow-sm">
          <Search size={19} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your connections..."
            aria-label="Search conversations"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
            <button
              onClick={() => void loadConversations()}
              className="ml-2 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-[1.75rem] border border-rose-100 bg-white shadow-sm shadow-rose-100/50">
          {loading ? (
            <div className="grid min-h-64 place-items-center">
              <div className="text-center">
                <LoaderCircle
                  className="mx-auto animate-spin text-rose-500"
                  size={30}
                />
                <p className="mt-3 text-sm text-slate-500">
                  Loading conversations...
                </p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                {search ? <Search size={27} /> : <Inbox size={27} />}
              </span>

              <h2 className="mt-5 text-xl font-extrabold text-slate-800">
                {search ? "No conversations found" : "Your story starts here"}
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search
                  ? "Try another name or clear your search."
                  : "When you and another person like each other, your match will appear here."}
              </p>

              {!search && (
                <Link
                  href="/discover"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600"
                >
                  Find connections <ArrowRight size={16} />
                </Link>
              )}
            </div>
          ) : (
            <div>
              {filteredConversations.map((conversation, index) => (
                <Link
                  key={conversation.match.id}
                  href={`/messages/${conversation.match.id}`}
                  className={`flex items-center gap-4 px-4 py-4 transition hover:bg-rose-50/60 sm:px-6 ${
                    index !== filteredConversations.length - 1
                      ? "border-b border-slate-100"
                      : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    {conversation.profile.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={conversation.profile.photo_url}
                        alt=""
                        className="size-14 rounded-full border-2 border-rose-100 object-cover sm:size-16"
                      />
                    ) : (
                      <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-rose-100 to-pink-200 text-xl font-black text-rose-600 sm:size-16">
                        {conversation.profile.display_name
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                    )}

                    <span className="absolute bottom-0 right-0 grid size-5 place-items-center rounded-full border-2 border-white bg-rose-500 text-white">
                      <Heart size={10} fill="currentColor" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="truncate font-extrabold text-slate-800">
                        {conversation.profile.display_name}
                      </h2>
                      {conversation.latestMessage && (
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {formatMessageTime(
                            conversation.latestMessage.created_at,
                          )}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      {conversation.latestMessage
                        ? `${
                            conversation.latestMessage.sender_id ===
                              conversation.match.user_a ||
                            conversation.latestMessage.sender_id ===
                              conversation.match.user_b
                              ? conversation.latestMessage.sender_id ===
                                conversation.match.user_a
                                ? " "
                                : " "
                              : ""
                          }${conversation.latestMessage.content}`
                        : conversation.profile.city
                          ? `Connected · ${conversation.profile.city}`
                          : "You matched! Say hello."}
                    </p>
                  </div>

                  {conversation.unreadCount > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-rose-500 px-2 py-1 text-xs font-bold text-white">
                      {conversation.unreadCount > 99
                        ? "99+"
                        : conversation.unreadCount}
                    </span>
                  )}

                  <MessageCircle
                    size={19}
                    className="hidden shrink-0 text-rose-400 sm:block"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
