"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NotificationBell() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId(null);
      setCount(0);
      return;
    }

    setUserId(user.id);

    const { count: unread, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (!error) setCount(unread ?? 0);
  }, [supabase]);

  useEffect(() => {
    void refreshCount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshCount();
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshCount]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notification-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void refreshCount(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refreshCount]);

  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-[#F5F1EB]"
    >
      <Bell className="h-5 w-5" />

      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B86F62] px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
