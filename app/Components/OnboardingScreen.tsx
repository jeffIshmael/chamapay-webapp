"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronRight } from "react-icons/fi";

/** Bump when slides change so returning users see the new flow once. */
export const ONBOARDING_KEY = "web_has_seen_onboarding_v2";

/** Header teal (downy-700) — blends into near-black at the foot of the dome */
const CARD_TOP = "#1a6b6b";
const CARD_BOTTOM = "#050808";
const CARD_ACCENT = "#1a6b6b";

type OnboardingSlide = {
  id: string;
  title: string;
  description: string;
  features: string[];
  imageSrc: string;
};

const slides: OnboardingSlide[] = [
  {
    id: "chama",
    title: "Create or join chama",
    description:
      "Bring the trusted tradition of chamas into the digital age.",
    features: [
      "Private invite-only groups",
      "Automatic payouts",
      "Transparent records",
    ],
    imageSrc: "/onboarding/screen1.png",
  },
  {
    id: "goal",
    title: "Save for a goal",
    description:
      "Open a pot for something real and share a pay link so anyone can chip in.",
    features: [
      "Personal, invite, or public pots",
      "Share an encrypted pay link",
      "Track progress with supporters",
    ],
    imageSrc: "/onboarding/screen-goal.png",
  },
  {
    id: "earn",
    title: "Save & earn",
    description:
      "Supply idle money to earn variable interest. Withdraw when the pool has free cash.",
    features: [
      "Earn variable APY from borrowers",
      "Withdraw when the pool has free cash",
      "Your balance stays yours while earning",
    ],
    imageSrc: "/onboarding/screen2.png",
  },
];

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    /* ignore */
  }
}

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Lock parent shell scroll so nothing can scroll vertically behind this screen
  useEffect(() => {
    const shell = document.querySelector(
      ".app-shell-scroll"
    ) as HTMLElement | null;
    const prev = shell?.style.overflowY;
    if (shell) shell.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (shell) shell.style.overflowY = prev || "";
      document.body.style.overflow = "";
    };
  }, []);

  const finish = useCallback(() => {
    markOnboardingSeen();
    onComplete();
  }, [onComplete]);

  const syncIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    setIndex(Math.round(el.scrollLeft / w));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncIndex, { passive: true });
    return () => el.removeEventListener("scroll", syncIndex);
  }, [syncIndex]);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(slides.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  const next = () => {
    if (index < slides.length - 1) goTo(index + 1);
    else finish();
  };

  return (
    <div
      ref={scrollerRef}
      className="absolute inset-0 z-20 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory bg-white overscroll-x-contain"
      style={{
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        touchAction: "pan-x",
      }}
    >
      <style>{`
        .onb-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {slides.map((slide) => (
        <section
          key={slide.id}
          className="w-full min-w-full h-full flex flex-col snap-center snap-always shrink-0 bg-white overflow-hidden"
        >
          {/* Image — capped so the dome always fits */}
          <div className="relative h-[38%] min-h-0 shrink-0 bg-white flex items-center justify-center px-3 pt-7 pb-0">
            <button
              type="button"
              onClick={finish}
              className="absolute top-3 right-4 z-10 text-[14px] font-semibold text-gray-500"
            >
              Skip
            </button>
            <Image
              src={slide.imageSrc}
              alt={slide.title}
              width={400}
              height={400}
              className="w-[88%] max-w-[260px] h-auto max-h-full object-contain"
              priority
              draggable={false}
            />
          </div>

          {/* Dome — low-key gradient: header teal at top → black at bottom */}
          <div
            className="flex-1 min-h-0 flex flex-col rounded-t-[36px] px-6 pt-6 pb-[max(0.85rem,env(safe-area-inset-bottom))] overflow-hidden"
            style={{
              background: `linear-gradient(180deg, ${CARD_TOP} 0%, #0f3535 42%, ${CARD_BOTTOM} 100%)`,
            }}
          >
            <h1 className="text-[1.45rem] font-extrabold text-white leading-tight shrink-0">
              {slide.title}
            </h1>
            <p className="mt-2 text-[13px] leading-snug text-white/85 shrink-0 line-clamp-2">
              {slide.description}
            </p>

            <ul className="mt-3.5 space-y-2.5 shrink-0">
              {slide.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-white/15 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                    ✓
                  </span>
                  <span className="text-[13px] font-semibold text-white leading-snug">
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex-1 min-h-2" />

            <div className="flex justify-center items-center gap-1.5 mb-3.5 shrink-0">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => goTo(i)}
                  className="h-2 rounded-full bg-white transition-all"
                  style={{
                    width: i === index ? 22 : 8,
                    opacity: i === index ? 1 : 0.35,
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={next}
              className="w-full h-12 rounded-full bg-white text-[15px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition shrink-0"
              style={{ color: CARD_ACCENT }}
            >
              {index === slides.length - 1 ? "Get Started" : "Next"}
              <FiChevronRight size={18} color={CARD_ACCENT} />
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
