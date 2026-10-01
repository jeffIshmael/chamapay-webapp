"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Step = {
  id: string;
  selector: string; // [data-tour="..."] target
  tab?: string; // tab to switch to before looking for the target
  title: string;
  body: string;
  adminOnly?: boolean;
};

const STEPS: Step[] = [
  {
    id: "add-member",
    selector: '[data-tour="add-member"]',
    title: "Add members",
    body: "As the admin, tap here to add people to your chama.",
    adminOnly: true,
  },
  {
    id: "share",
    selector: '[data-tour="share"]',
    title: "Share your chama",
    body: "Send the invite link so friends and family can join.",
  },
  {
    id: "make-payment",
    selector: '[data-tour="make-payment"]',
    tab: "overview",
    title: "Make a payment",
    body: "Pay your contribution here. You can also add extra funds anytime.",
  },
  {
    id: "withdraw",
    selector: '[data-tour="withdraw"]',
    tab: "overview",
    title: "Withdraw",
    body: "Take back the money you've contributed. It's greyed out until you have something to withdraw.",
  },
  {
    id: "recent-transactions",
    selector: '[data-tour="recent-transactions"]',
    tab: "overview",
    title: "Recent transactions",
    body: "See who paid and what moved in and out of the chama.",
  },
  {
    id: "schedule",
    selector: '[data-tour="tab-schedule"]',
    title: "Payout schedule",
    body: "Find out who gets paid and when. The order is drawn randomly, or the admin can set it manually before the chama starts.",
  },
  {
    id: "chat",
    selector: '[data-tour="tab-chat"]',
    title: "Chat",
    body: "Talk to everyone in the chama: reminders, questions and updates.",
  },
  {
    id: "members",
    selector: '[data-tour="tab-members"]',
    title: "Members",
    body: "See everyone in the chama and how much each member has contributed.",
  },
];

type Props = {
  /** Used to remember that this user has already seen the tour. */
  userId?: number | string;
  /** Only start the tour when true (e.g. the user is a chama member). */
  enabled?: boolean;
  /** Whether the admin "add member" button is visible. */
  canAddMembers?: boolean;
  onSwitchTab?: (tab: string) => void;
};

const PAD = 6;
const CARD_W = 300;

export default function ChamaTour({
  userId,
  enabled = true,
  canAddMembers = false,
  onSwitchTab,
}: Props) {
  const storageKey = `chama_tour_seen_${userId ?? "anon"}`;
  const steps = STEPS.filter((s) => !s.adminOnly || canAddMembers);

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Size of the app frame (the overlay fills it), not the browser window.
  const [frame, setFrame] = useState({ w: 360, h: 640 });
  const switchRef = useRef(onSwitchTab);
  switchRef.current = onSwitchTab;

  // Start once per user.
  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "1";
    } catch {
      /* storage unavailable: treat as not seen */
    }
    if (seen) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [enabled, storageKey]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    setRect(null);
    targetRef.current = null;
    switchRef.current?.("overview");
  }, [storageKey]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const n = idx + dir;
      if (n >= steps.length) return finish();
      if (n < 0) return;
      setIdx(n);
    },
    [idx, steps.length, finish]
  );

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (root) {
      const r = root.getBoundingClientRect();
      setFrame((f) => (f.w === r.width && f.h === r.height ? f : { w: r.width, h: r.height }));
    }
    const el = targetRef.current;
    if (el && el.isConnected && root) {
      const e = el.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      // Coordinates relative to the app frame.
      setRect(new DOMRect(e.left - r.left, e.top - r.top, e.width, e.height));
    }
  }, []);

  // Locate the target for the current step (switching tabs if needed).
  useEffect(() => {
    if (!open || !steps[idx]) return;
    const step = steps[idx];
    let tries = 0;
    setRect(null);
    targetRef.current = null;
    if (step.tab) switchRef.current?.(step.tab);

    const timer = setInterval(() => {
      tries++;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        clearInterval(timer);
        targetRef.current = el;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        measure();
        setTimeout(measure, 350);
      } else if (tries > 15) {
        clearInterval(timer);
        go(1); // target not on screen: skip this step
      }
    }, 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx]);

  // Keep the spotlight aligned on scroll / resize.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  if (!open || !steps[idx]) return null;
  const step = steps[idx];
  const isLast = idx === steps.length - 1;

  const vw = frame.w;
  const vh = frame.h;
  const cardW = Math.min(CARD_W, vw - 32);

  let cardStyle: React.CSSProperties = {
    width: cardW,
    left: (vw - cardW) / 2,
    top: vh / 2 - 80,
  };
  if (rect) {
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - cardW / 2, 16),
      vw - cardW - 16
    );
    const below = vh - rect.bottom > 200;
    cardStyle = below
      ? { width: cardW, left, top: rect.bottom + PAD + 12 }
      : { width: cardW, left, bottom: vh - rect.top + PAD + 12 };
  }

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[100] overflow-hidden"
      role="dialog"
      aria-label="Chama tour"
    >
      {/* Blocks taps on the page underneath */}
      <div className="absolute inset-0" />

      {rect ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            outline: "2px solid rgba(255,255,255,0.9)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      )}

      <div
        className="absolute bg-white rounded-2xl shadow-xl p-4"
        style={cardStyle}
      >
        <p className="text-[11px] font-semibold text-downy-600 mb-1">
          Step {idx + 1} of {steps.length}
        </p>
        <h3 className="text-[15px] font-bold text-gray-900">{step.title}</h3>
        <p className="text-[12px] text-gray-600 leading-relaxed mt-1">
          {step.body}
        </p>

        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={finish}
            className="text-[12px] font-medium text-gray-500"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-[12px] font-semibold text-gray-700"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(1)}
              className="px-4 py-2 rounded-lg bg-downy-600 text-white text-[12px] font-semibold"
            >
              {isLast ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}