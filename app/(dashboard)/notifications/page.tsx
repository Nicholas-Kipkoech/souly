"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: "match" | "message";
  title: string;
  body: string;
  link_url: string;
  is_read: boolean;
  created_at: string;
};

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id,user_id,actor_id,type,title,body,link_url,is_read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, supabase, loadNotifications]);

  const markAsRead = async (notification: Notification) => {
    if (notification.is_read) return;

    // Update the database first, then reflect the change in the UI.
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id)
      .eq("user_id", userId);

    if (updateError) {
      setError("Couldn't update this notification. Please try again.");
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item,
      ),
    );
  };

  const openNotification = async (notification: Notification) => {
    await markAsRead(notification);

    // Only allow the app's own known notification destinations.
    const destination =
      notification.link_url === "/messages" ||
      /^\/messages\/[0-9a-f-]+$/i.test(notification.link_url)
        ? notification.link_url
        : "/notifications";

    router.push(destination);
  };

  const markAllAsRead = async () => {
    if (!userId || unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    setError("");

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (updateError) {
      setError("Couldn't mark notifications as read. Please try again.");
    } else {
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );
    }

    setMarkingAll(false);
  };

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#242320]">
      <div className="mx-auto min-h-screen max-w-3xl border-x border-[#EDE8E1] bg-white">
        <header className="sticky top-0 z-20 border-b border-[#EEE9E3] bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="rounded-full p-2 transition hover:bg-[#F5F1EB]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight">
                Notifications
              </h1>
              <p className="mt-0.5 text-sm text-[#888078]">
                Your latest Soully updates
              </p>
            </div>

            <div className="relative rounded-2xl bg-[#F8F0EB] p-3 text-[#B86F62]">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B86F62] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {unreadCount === 0
                  ? "You're all caught up"
                  : `${unreadCount} unread ${
                      unreadCount === 1 ? "notification" : "notifications"
                    }`}
              </p>
            </div>

            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0 || markingAll}
              className="inline-flex items-center gap-2 rounded-full border border-[#E9E1D9] px-3 py-2 text-xs font-semibold transition hover:bg-[#FAF8F5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              {markingAll ? "Updating..." : "Mark all read"}
            </button>
          </div>
        </header>

        <section className="px-4 py-5 sm:px-8">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
              <button
                onClick={() => void loadNotifications()}
                className="ml-2 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3" aria-label="Loading notifications">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="flex animate-pulse gap-4 rounded-2xl p-4"
                >
                  <div className="h-12 w-12 rounded-2xl bg-[#F1EDE8]" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-1/3 rounded bg-[#F1EDE8]" />
                    <div className="h-3 w-4/5 rounded bg-[#F1EDE8]" />
                    <div className="h-2 w-1/4 rounded bg-[#F1EDE8]" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 rounded-[28px] bg-[#F8F0EB] p-6 text-[#B86F62]">
                <Sparkles className="h-9 w-9" />
              </div>
              <h2 className="text-xl font-bold">A little quiet here</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#898178]">
                When you make a new connection or receive a message, your
                updates will appear here.
              </p>
              <Link
                href="/discover"
                className="mt-6 rounded-full bg-[#294D43] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#203D35]"
              >
                Explore Soully
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const isMatch = notification.type === "match";
                const Icon = isMatch ? Heart : MessageCircle;

                return (
                  <button
                    key={notification.id}
                    onClick={() => void openNotification(notification)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition sm:gap-4 ${
                      notification.is_read
                        ? "border-transparent bg-white hover:border-[#EEE8E0] hover:bg-[#FCFBF9]"
                        : "border-[#F0E3D9] bg-[#FBF6F1] hover:bg-[#F8F0E9]"
                    }`}
                  >
                    <span
                      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        isMatch
                          ? "bg-[#F6E6E4] text-[#B86F62]"
                          : "bg-[#E8F0EB] text-[#426A59]"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {!notification.is_read && (
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#B86F62]" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          {notification.title}
                        </span>
                        <span className="text-xs text-[#9A9289]">
                          {timeAgo(notification.created_at)}
                        </span>
                      </span>

                      <span className="mt-1 block text-sm leading-6 text-[#77716A]">
                        {notification.body}
                      </span>

                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#426A59]">
                        {isMatch ? "View connections" : "Open conversation"}
                        <ArrowLeft className="h-3 w-3 rotate-180" />
                      </span>
                    </span>

                    {!notification.is_read && (
                      <span className="hidden pt-1 text-[#B86F62] sm:block">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && notifications.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#A0988E]">
              <RefreshCw className="h-3.5 w-3.5" />
              Showing your 100 most recent notifications at most
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
