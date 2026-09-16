"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiBell,
  FiHome,
  FiPlus,
  FiTrendingUp,
  FiCreditCard,
} from "react-icons/fi";

const tabs = [
  { href: "/MyChamas", label: "Home", icon: FiHome, match: ["Home", "Chamas"] },
  {
    href: "/SaveEarn",
    label: "Save & Earn",
    icon: FiTrendingUp,
    match: ["SaveEarn"],
  },
  { href: "/Create", label: "Create", icon: FiPlus, match: ["Create"], center: true },
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
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
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
