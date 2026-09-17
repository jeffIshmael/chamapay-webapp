"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiLogOut, FiSettings, FiUser } from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function AppHeader({
  /** Single section title (no greeting). e.g. "Save & Earn" */
  pageTitle,
}: {
  pageTitle?: string;
}) {
  const { user, isGuest, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName =
    user?.userName?.trim() ||
    user?.email?.split("@")[0] ||
    (isGuest ? "Guest" : "there");
  const firstName = displayName.split(/\s+/)[0];
  const avatar = user?.profileImageUrl;
  const isSection = Boolean(pageTitle);
  /** Profile + settings only on home (greeting header). */
  const showProfile = !isSection;

  useEffect(() => {
    if (!showProfile) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showProfile]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.replace("/");
  };

  return (
    <header className="sticky top-0 z-30 safe-top bg-gradient-to-br from-downy-800 to-emerald-900 rounded-b-3xl px-4 pt-2 pb-5 text-white shadow-md shadow-downy-900/20">
      {isSection ? (
        <div className="flex items-center justify-center min-h-[44px]">
          <h1 className="text-display text-[15px] font-bold text-white truncate leading-tight py-1 text-center">
            {pageTitle}
          </h1>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-white/75 tracking-wide">
              {greetingForHour(new Date().getHours())}
            </p>
            <h1 className="text-display text-[1.15rem] font-bold text-white truncate leading-tight mt-0.5">
              {firstName}
              <span className="text-downy-300 font-extrabold">.</span>
            </h1>
          </div>

          {showProfile && (
            <div className="relative shrink-0 flex items-center gap-2" ref={menuRef}>
              <Link
                href="/Settings"
                aria-label="Profile settings"
                className="h-8 w-8 rounded-full bg-white/15 border border-white/30 text-white flex items-center justify-center hover:bg-white/25 transition"
              >
                <FiSettings size={15} />
              </Link>

              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Profile menu"
                className="h-8 w-8 rounded-full overflow-hidden border-2 border-white/40 bg-white/20 text-white flex items-center justify-center text-[10px] font-bold"
              >
                {avatar ? (
                  <Image
                    src={avatar}
                    alt=""
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials(displayName)
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white shadow-xl shadow-downy-950/20 border border-gray-100 py-2 z-50 text-left">
                  <div className="px-3.5 py-2 border-b border-gray-50">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      {isGuest ? "Guest session" : user?.email}
                    </p>
                  </div>
                  <Link
                    href="/Settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-downy-50"
                  >
                    <FiSettings size={15} className="text-downy-600" />
                    Profile &amp; settings
                  </Link>
                  <Link
                    href="/Wallet"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-downy-50"
                  >
                    <FiUser size={15} className="text-downy-600" />
                    Wallet &amp; account
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <FiLogOut size={15} />
                    {isGuest ? "Exit guest" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
