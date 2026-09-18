"use client";

import Link from "next/link";
import { FiSettings } from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";

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
  const { user, isGuest } = useAuth();

  const displayName =
    user?.userName?.trim() ||
    user?.email?.split("@")[0] ||
    (isGuest ? "Guest" : "there");
  const firstName = displayName.split(/\s+/)[0];
  const avatar = user?.profileImageUrl;
  const isSection = Boolean(pageTitle);
  /** Profile + settings only on home (greeting header). */
  const showProfile = !isSection;

  return (
    <header
      className={`sticky top-0 z-30 safe-top bg-downy-700 rounded-b-3xl px-4 pt-1.5 text-white ${
        isSection ? "pb-2.5" : "pb-4"
      }`}
    >
      {isSection ? (
        <div className="flex items-center justify-center min-h-[36px]">
          <h1 className="text-display text-[15px] font-bold text-white truncate leading-tight text-center">
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
            <div className="shrink-0 flex items-center gap-2">
              <Link
                href="/Settings"
                aria-label="Settings"
                className="h-8 w-8 rounded-full bg-white/15 border border-white/30 text-white flex items-center justify-center hover:bg-white/25 transition"
              >
                <FiSettings size={15} />
              </Link>

              <Link
                href="/Settings"
                aria-label="Profile"
                className="h-8 w-8 rounded-full overflow-hidden border-2 border-white/40 bg-white/20 text-white flex items-center justify-center text-[10px] font-bold"
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  initials(displayName)
                )}
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
