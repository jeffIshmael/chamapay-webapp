"use client";

import { useEffect, useRef, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { DotLottie } from "@lottiefiles/dotlottie-web";
import { FiCheck } from "react-icons/fi";

export default function GoalDepositSuccess({
  open,
  onDone,
  amountLabel,
}: {
  open: boolean;
  onDone: () => void;
  amountLabel?: string;
}) {
  const [phase, setPhase] = useState<"lottie" | "check">("lottie");
  const listenerRef = useRef<((e: { type: string }) => void) | null>(null);
  const dotRef = useRef<DotLottie | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("lottie");
      return;
    }
    // Fallback if the player never emits complete (e.g. JSON quirks)
    const fallback = setTimeout(() => setPhase("check"), 4500);
    return () => clearTimeout(fallback);
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "check") return;
    const t = setTimeout(() => onDone(), 900);
    return () => clearTimeout(t);
  }, [open, phase, onDone]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 flex flex-col items-center text-center shadow-xl">
        {amountLabel ? (
          <p className="text-[17px] font-semibold text-gray-900 mb-1">
            {amountLabel}
          </p>
        ) : null}
        <p className="text-[14px] text-gray-500 mb-4">Added to your goal</p>

        {phase === "lottie" ? (
          <div className="w-[200px] h-[200px]">
            <DotLottieReact
              src="/lottie/saving_lottie.json"
              autoplay
              loop={false}
              className="w-full h-full"
              dotLottieRefCallback={(instance) => {
                if (listenerRef.current && dotRef.current) {
                  try {
                    dotRef.current.removeEventListener(
                      "complete",
                      listenerRef.current as never
                    );
                  } catch {
                    /* ignore */
                  }
                }
                dotRef.current = instance;
                if (!instance) return;
                const onComplete = () => setPhase("check");
                listenerRef.current = onComplete;
                instance.addEventListener("complete", onComplete);
              }}
            />
          </div>
        ) : (
          <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center mb-1">
            <FiCheck className="text-emerald-600" size={44} strokeWidth={3} />
          </div>
        )}
      </div>
    </div>
  );
}
