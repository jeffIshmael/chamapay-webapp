"use client";

import React, { useEffect, useState } from "react";
import {
  FiExternalLink,
  FiHelpCircle,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import { HiOutlineCash, HiOutlineCurrencyDollar } from "react-icons/hi";

const MOONWELL_WEBSITE = "https://moonwell.fi";

type Props = {
  size?: number;
  className?: string;
  currentApy?: number | null;
};

export default function MoonwellInfoButton({
  size = 17,
  className = "",
  currentApy = null,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  const apyLabel =
    currentApy != null && Number.isFinite(currentApy)
      ? `${currentApy.toFixed(1)}%`
      : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVisible(true);
        }}
        className={`inline-flex items-center justify-center text-gray-500 hover:text-gray-700 ${className}`}
        aria-label="What is Moonwell?"
      >
        <FiHelpCircle size={size} />
      </button>

      {visible ? (
        <div
          className="app-modal-layer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            className="app-modal-backdrop"
            aria-label="Close"
            onClick={() => setVisible(false)}
          />
          <div className="app-modal-sheet bg-white max-h-[88%] flex flex-col shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <div className="flex items-center flex-1 pr-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3 shrink-0">
                  <FiHelpCircle size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-gray-900 truncate">
                    Moonwell, simply put
                  </p>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    How Save & Earn works
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <FiX size={16} className="text-gray-600" />
              </button>
            </div>

            <div className="px-5 pb-6 overflow-y-auto flex-1 min-h-0">
              <p className="text-gray-700 text-[14px] leading-relaxed mb-4">
                Moonwell is a supply-and-borrow pool. When you put money in
                through Chamapay, you supply it to that pool. Other people can
                borrow it. The interest borrowers pay is what you earn.
              </p>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5 mb-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <HiOutlineCash size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-[14px] mb-1">
                      When you supply
                    </p>
                    <p className="text-gray-600 text-[13px] leading-relaxed">
                      Your deposit (from M-Pesa or wallet; shown in KES if that
                      is your currency) is placed in the Moonwell pool. It stays
                      yours. Interest adds to your balance automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5 mb-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <HiOutlineCurrencyDollar
                      size={18}
                      className="text-blue-600"
                    />
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-[14px] mb-1">
                      When you withdraw
                    </p>
                    <p className="text-gray-600 text-[13px] leading-relaxed">
                      You can only take money out when the pool has free cash,
                      meaning money that is not currently borrowed. There is no
                      fixed lock-up, but if the pool is fully borrowed,
                      withdrawals pause until cash returns. Your deposit stays
                      safe and keeps earning in the meantime.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-3.5 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100/80 flex items-center justify-center shrink-0 mt-0.5">
                    <FiTrendingUp size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-[14px] mb-1">
                      Why the % rate jumps around
                    </p>
                    <p className="text-gray-600 text-[13px] leading-relaxed">
                      The APY you see
                      {apyLabel ? ` (right now about ${apyLabel})` : ""} is a
                      live market rate, not a fixed bank rate. When many people
                      want to borrow, it can climb. When demand cools, it can
                      drop. Treat it as a snapshot, not a promise.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-gray-500 text-[11px] leading-relaxed text-center px-2 mb-3">
                Earnings come from borrowers on Moonwell. Chamapay shows your
                live balance and the current rate.
              </p>

              <a
                href={MOONWELL_WEBSITE}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 mb-3 py-2 text-blue-600 font-semibold text-[13px]"
              >
                Learn more on moonwell.fi
                <FiExternalLink size={13} />
              </a>

              <button
                type="button"
                onClick={() => setVisible(false)}
                className="w-full bg-blue-600 py-3.5 rounded-2xl text-white font-bold text-[15px]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
