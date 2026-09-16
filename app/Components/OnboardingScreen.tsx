"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { FiChevronRight } from "react-icons/fi";

export const ONBOARDING_KEY = "web_has_seen_onboarding";

type OnboardingSlide = {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
};

const slides: OnboardingSlide[] = [
  {
    id: "1",
    title: "Chamas & Goals",
    description:
      "Save with your circle in rotational chamas, or open a Save for Goal pot with a pay link.",
    imageSrc: "/onboarding/screen1.png",
  },
  {
    id: "2",
    title: "Grow Your Savings",
    description:
      "Put idle balance to work and earn variable interest — withdraw when the pool has free cash.",
    imageSrc: "/onboarding/screen2.png",
  },
  {
    id: "3",
    title: "Cash In & Out",
    description:
      "Move money between M-Pesa and your ChamaPay wallet in a few taps.",
    imageSrc: "/onboarding/screen3.png",
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
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  const finish = useCallback(() => {
    markOnboardingSeen();
    onComplete();
  }, [onComplete]);

  const next = () => {
    if (!isLast) setIndex((i) => i + 1);
    else finish();
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col bg-downy-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 safe-top shrink-0">
        <Image
          src="/images/logo.png"
          alt="ChamaPay"
          width={32}
          height={32}
          className="rounded-lg"
          priority
        />
        <button
          type="button"
          onClick={finish}
          className="text-[13px] font-semibold text-downy-700 px-2 py-1"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-5 pt-2 pb-4">
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Image
            src={slide.imageSrc}
            alt={slide.title}
            width={360}
            height={360}
            className="w-full max-w-[240px] h-auto max-h-[38dvh] object-contain drop-shadow-sm"
            priority
          />
        </div>

        <div className="shrink-0 pt-3">
          <div className="flex justify-center gap-1.5 mb-4">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-downy-600"
                    : "w-1.5 bg-downy-200"
                }`}
              />
            ))}
          </div>

          <h1 className="text-display text-[1.35rem] font-extrabold text-downy-950 text-center leading-snug">
            {slide.title}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-downy-800/75 text-center px-1 max-h-[4.5rem] overflow-hidden">
            {slide.description}
          </p>

          <button
            type="button"
            onClick={next}
            className="mt-5 w-full h-12 rounded-2xl bg-downy-700 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-downy-700/25 active:scale-[0.98] transition"
          >
            {isLast ? "Get started" : "Next"}
            <FiChevronRight size={18} />
          </button>

          <p className="mt-3 text-center text-[11px] text-downy-600/70 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {index + 1} of {slides.length}
          </p>
        </div>
      </div>
    </div>
  );
}
