"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiBell,
  FiPlus,
  FiTrendingUp,
  FiCreditCard,
} from "react-icons/fi";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? "w-[18px] h-[18px]"}
    >
      <path d="M19.006 3.705a.75.75 0 1 0-.512-1.41L6 6.838V3a.75.75 0 0 0-.75-.75h-1.5A.75.75 0 0 0 3 3v4.93l-1.006.365a.75.75 0 0 0 .512 1.41l16.5-6Z" />
      <path
        fillRule="evenodd"
        d="M3.019 11.114 18 5.667v3.421l4.006 1.457a.75.75 0 1 1-.512 1.41l-.494-.18v8.475h.75a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1 0-1.5H3v-9.129l.019-.007ZM18 20.25v-9.566l1.5.546v9.02H18Zm-9-6a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const tabs = [
  {
    href: "/MyChamas",
    label: "Home",
    icon: HomeIcon,
    match: ["Home", "Chamas"],
    custom: true,
  },
  {
    href: "/SaveEarn",
    label: "Save & Earn",
    icon: FiTrendingUp,
    match: ["SaveEarn"],
  },
  {
    href: "/Create",
    label: "Create",
    icon: FiPlus,
    match: ["Create"],
    center: true,
  },
  {
    href: "/Notifications",
    label: "Alerts",
    icon: FiBell,
    match: ["Notifications"],
  },
  { href: "/Wallet", label: "Wallet", icon: FiCreditCard, match: ["Wallet"] },
] as const;

export default function BottomNavbar({
  activeSection,
  setActiveSection,
}: {
  activeSection: string;
  setActiveSection: (section: string) => void;
}) {
  const pathname = usePathname();

  const isActive = (tab: (typeof tabs)[number]) => {
    if (pathname?.startsWith(tab.href)) return true;
    return tab.match.some((m) => m === activeSection);
  };

  return (
    <nav
      className="bottom-nav-dock pointer-events-none z-50 px-3"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto mx-auto mb-1 flex items-center justify-between gap-0.5 rounded-[1.35rem] bg-white/95 backdrop-blur-lg border border-downy-100/80 shadow-[0_8px_30px_rgba(15,47,50,0.12)] px-1.5 py-1.5">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          const isCustom = "custom" in tab && tab.custom;

          if ("center" in tab && tab.center) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setActiveSection("Create")}
                className="flex flex-col items-center -mt-5 px-1"
              >
                <span className="h-12 w-12 rounded-full bg-gradient-to-br from-downy-400 to-downy-700 text-white shadow-lg shadow-downy-600/35 flex items-center justify-center ring-4 ring-downy-50">
                  <Icon size={22} strokeWidth={2.5} />
                </span>
                <span
                  className={`text-[10px] mt-1 font-semibold ${
                    active ? "text-downy-700" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setActiveSection(tab.match[0])}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 rounded-xl transition ${
                active ? "text-downy-700" : "text-gray-400"
              }`}
            >
              <span
                className={`flex items-center justify-center h-8 w-8 rounded-xl ${
                  active ? "bg-downy-100 text-downy-700" : ""
                }`}
              >
                {isCustom ? (
                  <HomeIcon />
                ) : (
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                )}
              </span>
              <span
                className={`text-[9px] font-semibold leading-tight text-center px-0.5 ${
                  tab.href === "/SaveEarn" ? "max-w-[52px]" : ""
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
