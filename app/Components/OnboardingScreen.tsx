"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { FiChevronRight } from "react-icons/fi";

export const ONBOARDING_KEY = "web_has_seen_onboarding";

type OnboardingSlide = {
  id: string;
  title: string;
  description: string;
  features: string[];
  imageSrc: string;
};

const slides: OnboardingSlide[] = [
  {
    id: "1",
    title: "Chamas & Goals",
    description:
      "Rotational chamas for your circle, plus Save for Goal pots with pay links.",
    features: [
      "Invite-only saving circles",
      "Save for Goal with friends",
      "Transparent on-chain records",
    ],
    imageSrc: "/onboarding/screen1.png",
  },
  {
    id: "2",
    title: "Grow Your Savings",
    description:
      "Supply idle money to earn variable interest. Withdraw when the pool has free cash.",
    features: [
      "Earn variable APY from borrowers",
      "Withdraw when the pool has free cash",
      "Your balance stays yours while earning",
    ],
    imageSrc: "/onboarding/screen2.png",
  },
  {
    id: "3",
    title: "Cash In & Cash Out",
    description:
      "Move money between M-Pesa and your ChamaPay wallet in just a few taps.",
    features: [
      "Instant M-Pesa deposits",
      "Fast M-Pesa withdrawals",
      "Low transaction fees",
    ],
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
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto">
      <div className="relative flex-[0.58] flex items-center justify-center px-4 pt-10 pb-2">
        <button
          type="button"
          onClick={finish}
          className="absolute top-12 right-5 text-gray-500 font-semibold text-sm z-10"
        >
          Skip
        </button>
        <Image
          src={slide.imageSrc}
          alt={slide.title}
          width={420}
          height={420}
          className="w-[94%] h-auto object-contain max-h-[52vh]"
          priority
        />
      </div>

      <div className="flex-[0.42] bg-downy-700 rounded-t-[42px] px-7 pt-8 pb-8 text-white flex flex-col">
        <h1 className="text-[28px] leading-tight font-extrabold">{slide.title}</h1>
        <p className="mt-3 text-[15px] leading-6 text-white/85">
          {slide.description}
        </p>

        <ul className="mt-5 space-y-3">
          {slide.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] rounded-full bg-white/15 flex items-center justify-center text-[11px] font-extrabold">
                ✓
              </span>
              <span className="text-[14px] font-semibold leading-5">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex-1" />

        <div className="flex justify-center items-center gap-1.5 mb-5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full bg-white transition-all ${
                i === index ? "w-6 opacity-100" : "w-2 opacity-35"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          className="h-[54px] rounded-full bg-white text-downy-700 font-bold text-[16px] flex items-center justify-center gap-2"
        >
          {isLast ? "Get Started" : "Next"}
          <FiChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
