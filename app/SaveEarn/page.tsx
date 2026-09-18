"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiActivity,
  FiArrowRight,
  FiLogIn,
  FiLogOut,
} from "react-icons/fi";
import AppHeader from "../Components/AppHeader";
import BottomNavbar from "../Components/BottomNavbar";
import MoonwellInfoButton from "../Components/MoonwellInfoButton";
import {
  getMoonwellUsdcSnapshot,
  type MoonwellUsdcSnapshot,
} from "@/lib/moonwellService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useFormattedBalance } from "@/lib/useFormattedBalance";

export default function SaveEarnPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { isAuthenticated, isGuest, isLoading: authLoading } =
    useSessionAddress();
  const { formatBalance } = useFormattedBalance();
  const [activeSection, setActiveSection] = useState("SaveEarn");
  const [snapshot, setSnapshot] = useState<MoonwellUsdcSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (authLoading || !isAuthenticated) return;
    const address =
      (user?.smartAddress as string) || (user?.address as string) || "";
    if (!address || isGuest || token === "guest") {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getMoonwellUsdcSnapshot(address, 0, token);
      setSnapshot(snap);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user, token, isGuest]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-downy-50 flex flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-downy-800">Loading…</p>
      </div>
    );
  }

  const apy =
    snapshot?.supplyApy != null ? `${snapshot.supplyApy.toFixed(2)}%` : "—";
  const invested = formatBalance(snapshot?.principalUsdc ?? 0);
  const earned = formatBalance(snapshot?.earnedUsdc ?? 0);
  const liquidity = snapshot?.liquidityUsd;
  const needed = snapshot?.totalBalanceUsdc ?? 0;
  const canWithdraw =
    liquidity == null || needed <= 0 || liquidity >= needed;

  return (
    <div className="min-h-[100dvh] bg-downy-50 pb-nav">
      <AppHeader pageTitle="Save & Earn" />

      <div className="px-4 pt-3 pb-6">
        <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
          Supply idle USDC to earn variable interest. Withdraw when the pool has
          free cash.
        </p>

        <h2 className="text-[13px] font-bold text-gray-900 mb-0.5">
          Available pools
        </h2>
        <p className="text-[11px] text-gray-500 mb-3">
          Earn interest on your money
        </p>

        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-downy-100/70">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center flex-1 min-w-0 gap-2.5">
              <Link href="/SaveEarn/moonwell" className="shrink-0">
                <Image
                  src="/brand/moonwell_logo.png"
                  alt="Moonwell"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link
                    href="/SaveEarn/moonwell"
                    className="text-[13px] font-bold text-gray-900"
                  >
                    Moonwell
                  </Link>
                  <MoonwellInfoButton
                    size={15}
                    currentApy={snapshot?.supplyApy}
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">USDC  pool</p>
              </div>
            </div>
            <Link
              href="/SaveEarn/moonwell"
              className="bg-downy-50 px-2.5 py-1.5 rounded-xl text-right shrink-0"
            >
              {loading ? (
                <div className="h-4 w-10 bg-downy-200/50 rounded mb-0.5" />
              ) : (
                <p className="text-[13px] font-bold text-downy-700 font-mono">
                  {apy}
                </p>
              )}
              <p className="text-[9px] font-bold text-downy-600 tracking-wide">
                APY
              </p>
            </Link>
          </div>

          <Link href="/SaveEarn/moonwell" className="block">
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[
                { icon: FiLogIn, color: "text-emerald-500", label: "Deposit anytime" },
                { icon: FiActivity, color: "text-blue-500", label: "Earn every block" },
                { icon: FiLogOut, color: "text-amber-500", label: "Withdraw when available" },
              ].map(({ icon: Icon, color, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center bg-gray-50 py-2 rounded-xl border border-gray-100 px-1"
                >
                  <Icon className={`${color} mb-1`} size={14} />
                  <p className="text-[10px] font-semibold text-gray-600 text-center leading-tight">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div
              className={`mb-3 rounded-xl px-2.5 py-2 text-[11px] font-semibold ${
                canWithdraw
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                  : "bg-amber-50 text-amber-800 border border-amber-100"
              }`}
            >
              {loading
                ? "Checking pool liquidity…"
                : canWithdraw
                  ? "Withdrawals available — pool has free cash"
                  : "Withdrawals paused until pool liquidity returns"}
            </div>

            <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5 font-medium">
                  Invested
                </p>
                {loading ? (
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                ) : (
                  <p className="text-[12px] font-bold text-gray-900 font-mono">
                    {invested}
                  </p>
                )}
              </div>
              <div className="w-px h-7 bg-gray-200" />
              <div className="text-right">
                <p className="text-[10px] text-gray-500 mb-0.5 font-medium">
                  Earned
                </p>
                {loading ? (
                  <div className="h-4 w-14 bg-gray-200 rounded ml-auto" />
                ) : (
                  <p className="text-[12px] font-bold text-emerald-600 font-mono">
                    +{earned}
                  </p>
                )}
              </div>
              <FiArrowRight className="text-gray-300 ml-1.5" size={14} />
            </div>
          </Link>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed text-center px-1 mt-3">
          Rates change with demand and are not guaranteed. You can only withdraw
          when the pool has free cash again.
        </p>
      </div>

      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
    </div>
  );
}
