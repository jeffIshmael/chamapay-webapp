"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FiDownload, FiX } from "react-icons/fi";
import { useSessionAddress } from "@/lib/useSessionAddress";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Session-only dismiss — shows again on the next visit. */
const DISMISS_KEY = "chamapay-a2hs-dismissed-session";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isHomePath(pathname: string | null) {
  if (!pathname) return false;
  return pathname === "/MyChamas" || pathname.startsWith("/MyChamas/");
}

export default function AddToHomeScreen() {
  const pathname = usePathname();
  const { isAuthenticated, isGuest, isLoading } = useSessionAddress();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    setDismissed(Boolean(sessionStorage.getItem(DISMISS_KEY)));
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    if (isIos()) {
      setIosHint(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const canShow =
    !isLoading &&
    isAuthenticated &&
    !isGuest &&
    isHomePath(pathname) &&
    !dismissed &&
    !isStandalone() &&
    (Boolean(deferred) || iosHint);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (iosHint) {
      dismiss();
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  };

  if (!canShow) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[120] flex justify-center px-5"
      style={{
        bottom:
          "max(0.75rem, calc(env(safe-area-inset-bottom) + 4.75rem))",
      }}
    >
      <div
        className="pointer-events-auto inline-flex w-auto max-w-[min(88vw,22rem)] items-center gap-2.5 rounded-2xl border border-white/10 pl-2 pr-2 py-2.5 shadow-lg shadow-black/30"
        style={{ backgroundColor: "rgba(28, 32, 40, 0.94)" }}
        role="dialog"
        aria-label="Add Chamapay to Home Screen"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt=""
          className="h-9 w-9 shrink-0 rounded-xl object-cover"
        />

        <p className="truncate text-[13px] font-semibold text-white leading-none pr-1">
          Add to Home Screen
        </p>

        <button
          type="button"
          onClick={install}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-downy-500 px-3.5 py-2 text-[12px] font-bold text-white"
        >
          <FiDownload size={14} />
          {iosHint ? "OK" : "Install"}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 bg-transparent p-1 text-white/50 hover:text-white"
          aria-label="Dismiss"
        >
          <FiX size={15} />
        </button>
      </div>
    </div>
  );
}
