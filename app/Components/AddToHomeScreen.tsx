"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiShare2, FiX } from "react-icons/fi";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "chamapay-a2hs-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export default function AddToHomeScreen() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY))
      return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="app-modal-layer" style={{ zIndex: 120 }}>
      <div className="app-modal-backdrop" onClick={dismiss} />
      <div className="app-modal-sheet bg-white px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              className="h-11 w-11 rounded-xl shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900">
                Add Chamapay to Home Screen
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                Install for a full-screen app experience
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Dismiss"
          >
            <FiX size={14} />
          </button>
        </div>

        {iosHint ? (
          <p className="text-[12px] text-gray-600 bg-downy-50 border border-downy-100 rounded-xl px-3 py-2.5 mb-3 leading-relaxed">
            Tap <FiShare2 className="inline mx-0.5" size={13} /> Share, then{" "}
            <span className="font-semibold">Add to Home Screen</span>.
          </p>
        ) : null}

        {!iosHint && deferred ? (
          <button
            type="button"
            onClick={install}
            className="w-full py-3 rounded-xl bg-downy-600 text-white text-[13px] font-bold flex items-center justify-center gap-2"
          >
            <FiDownload size={16} />
            Install
          </button>
        ) : !iosHint ? (
          <p className="text-[11px] text-gray-500 text-center py-1">
            Use your browser menu to install this app
          </p>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-[12px] font-semibold"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
