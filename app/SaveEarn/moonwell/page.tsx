"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiInfo } from "react-icons/fi";
import BottomNavbar from "../../Components/BottomNavbar";
import { showToast } from "../../Components/Toast";
import {
  depositToMoonwell,
  getMoonwellUsdcSnapshot,
  withdrawFromMoonwell,
  type MoonwellUsdcSnapshot,
} from "@/lib/moonwellService";
import { useAuth } from "../../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";

export default function MoonwellPoolPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { isAuthenticated, isGuest } = useSessionAddress();
  const [activeSection, setActiveSection] = useState("SaveEarn");
  const [snapshot, setSnapshot] = useState<MoonwellUsdcSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const load = useCallback(async () => {
    const address =
      (user?.smartAddress as string) || (user?.address as string) || "";
    if (!address || isGuest || token === "guest") {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setSnapshot(await getMoonwellUsdcSnapshot(address, 0, token));
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [user, token, isGuest]);

  useEffect(() => {
    load();
  }, [load]);

  const apy =
    snapshot?.supplyApy != null ? `${snapshot.supplyApy.toFixed(2)}%` : "—";
  const total = snapshot?.totalBalanceUsdc ?? 0;
  const principal = snapshot?.principalUsdc ?? 0;
  const earned = snapshot?.earnedUsdc ?? 0;
  const liquidity = snapshot?.liquidityUsd;
  const canWithdraw =
    liquidity == null || total <= 0 || (liquidity ?? 0) >= total;

  const formatTvl = (usd: number | null | undefined) => {
    if (usd == null) return "—";
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const submit = async () => {
    if (!token || token === "guest" || isGuest) {
      showToast("Please sign in", "warning");
      return;
    }
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      showToast("Enter a valid amount", "warning");
      return;
    }
    if (mode === "withdraw" && !canWithdraw) {
      showToast("Pool liquidity is too low to withdraw right now", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "deposit"
          ? await depositToMoonwell(token, n.toString())
          : await withdrawFromMoonwell(token, n.toString());
      if (!result.success) {
        showToast(result.error || "Transaction failed", "error");
        return;
      }
      showToast(
        mode === "deposit" ? "Deposited to Moonwell" : "Withdrawn from Moonwell",
        "success"
      );
      setAmount("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-downy-50 pb-nav">
      <div className="bg-gradient-to-br from-downy-800 to-emerald-900 px-4 pt-3 pb-4 text-white safe-top">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.push("/SaveEarn")}
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <FiArrowLeft size={16} />
          </button>
          <h1 className="text-[13px] font-bold">Moonwell</h1>
          <div className="w-8" />
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <Image
            src="/brand/moonwell_logo.png"
            alt="Moonwell"
            width={40}
            height={40}
            className="w-10 h-10 rounded-full bg-white object-cover"
          />
          <div>
            <p className="text-[15px] font-bold leading-tight">USDC Pool</p>
            <p className="text-white/75 text-[11px]">Base · Moonwell</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "APY", value: loading ? "…" : apy },
            {
              label: "Your bal",
              value: loading ? "…" : total.toFixed(2),
            },
            {
              label: "TVL",
              value: loading ? "…" : formatTvl(snapshot?.marketTotalSupplyUsd),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/10 rounded-xl px-2 py-2 text-center"
            >
              <p className="text-[9px] text-white/70 uppercase font-bold mb-0.5">
                {stat.label}
              </p>
              <p className="font-mono font-bold text-[12px]">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-2 space-y-2.5 pb-4">
        <div className="bg-white rounded-2xl border border-downy-100/70 shadow-sm p-3.5">
          <div className="flex justify-between mb-2.5">
            <div>
              <p className="text-[10px] text-gray-500 font-medium">Invested</p>
              <p className="font-mono font-bold text-[13px] text-gray-900">
                {principal.toFixed(3)} USDC
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-medium">Earned</p>
              <p className="font-mono font-bold text-[13px] text-emerald-600">
                +{earned.toFixed(3)} USDC
              </p>
            </div>
          </div>
          <div
            className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold flex items-start gap-1.5 ${
              canWithdraw
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            <FiInfo className="mt-0.5 shrink-0" size={13} />
            {canWithdraw
              ? "You can withdraw when the pool has free cash (available now)."
              : "Withdrawals are limited until Moonwell liquidity returns."}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-downy-100/70 shadow-sm p-3.5">
          <div className="flex bg-gray-100 rounded-xl p-0.5 mb-3">
            <button
              type="button"
              onClick={() => setMode("deposit")}
              className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold ${
                mode === "deposit"
                  ? "bg-downy-600 text-white"
                  : "bg-transparent text-gray-500"
              }`}
            >
              Supply
            </button>
            <button
              type="button"
              onClick={() => setMode("withdraw")}
              className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold ${
                mode === "withdraw"
                  ? "bg-downy-600 text-white"
                  : "bg-transparent text-gray-500"
              }`}
            >
              Withdraw
            </button>
          </div>

          <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
            Amount (USDC)
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden mb-3">
            <span className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 text-[12px] font-bold text-gray-600">
              USDC
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
              }}
              placeholder={mode === "deposit" ? "10" : "5"}
              className="flex-1 px-3 py-2.5 text-[13px] font-semibold border-0 focus:ring-0 bg-white"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !amount}
            className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
              submitting || !amount
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-downy-600 shadow-md shadow-downy-600/25"
            }`}
          >
            {submitting
              ? "Processing…"
              : mode === "deposit"
                ? "Supply to Moonwell"
                : "Withdraw to wallet"}
          </button>
        </div>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed px-1">
          Rates are variable and not guaranteed. Powered by Moonwell on Base.
        </p>
      </div>

      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
    </div>
  );
}
