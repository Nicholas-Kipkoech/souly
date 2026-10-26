"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Heart,
  Compass,
  MessageCircle,
  ThumbsUp,
  UserRound,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Likes", href: "/likes", icon: ThumbsUp },
  { label: "My Profile", href: "/profile", icon: UserRound },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      return;
    }

    router.replace("/auth");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/messages") {
      return pathname === "/messages" || pathname.startsWith("/messages/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[#FFF8F8] text-slate-900">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-rose-100 bg-white/95 px-4 backdrop-blur-lg lg:hidden">
        <Link href="/discover" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-pink-500 text-white shadow-sm shadow-pink-200">
            <Heart size={20} fill="currentColor" />
          </span>
          <span className="text-xl font-black tracking-tight">
            Soully<span className="text-pink-500">.</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          className="grid size-10 place-items-center rounded-xl hover:bg-rose-50"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile navigation backdrop */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-rose-100 bg-white px-5 py-6 transition-transform duration-300 lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/discover" className="flex items-center gap-3 px-2">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-200">
            <Heart size={23} fill="currentColor" />
          </span>
          <span>
            <span className="block text-2xl font-black tracking-tight">
              Soully<span className="text-pink-500">.</span>
            </span>
            <span className="block text-xs text-slate-400">
              Find your connection
            </span>
          </span>
        </Link>

        <div className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Your space
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-2">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                  active
                    ? "bg-pink-500 text-white shadow-lg shadow-pink-100"
                    : "text-slate-500 hover:bg-rose-50 hover:text-pink-600"
                }`}
              >
                <Icon size={19} />
                <span>{label}</span>
                {active && (
                  <span className="ml-auto size-1.5 rounded-full bg-white" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mb-5 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-4">
          <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-white text-pink-500 shadow-sm">
            <Heart size={18} />
          </div>
          <p className="text-sm font-bold">Meaningful connections</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Take your time, be yourself, and treat others with kindness.
          </p>
        </div>

        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <LogOut size={19} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      {/* Page content */}
      <div className="min-h-screen lg:pl-72">
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
