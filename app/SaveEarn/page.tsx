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
import BottomNavbar from "../Components/BottomNavbar";
import {
  getMoonwellUsdcSnapshot,
  type MoonwellUsdcSnapshot,
} from "@/lib/moonwellService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";

export default function SaveEarnPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { isAuthenticated, isGuest } = useSessionAddress();
  const [activeSection, setActiveSection] = useState("SaveEarn");
  const [snapshot, setSnapshot] = useState<MoonwellUsdcSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

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
      const snap = await getMoonwellUsdcSnapshot(address, 0, token);
      setSnapshot(snap);
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
  const invested = (snapshot?.principalUsdc ?? 0).toFixed(3);
  const earned = (snapshot?.earnedUsdc ?? 0).toFixed(3);
  const liquidity = snapshot?.liquidityUsd;
  const needed = snapshot?.totalBalanceUsdc ?? 0;
  const canWithdraw =
    liquidity == null || needed <= 0 || liquidity >= needed;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-downy-800 rounded-b-3xl px-6 pt-8 pb-8 text-center shadow-sm">
        <h1 className="text-white text-3xl font-extrabold mb-2">Save & Earn</h1>
        <p className="text-white/90 text-[15px] font-medium leading-6 px-2">
          Supply your money to earn interest. Withdraw when the pool has free
          cash.
        </p>
      </div>

      <div className="px-5 pt-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Available Pools</h2>
        <p className="text-sm font-medium text-gray-500 mb-4">
          Earn interest on your stablecoins safely.
        </p>

        <Link
          href="/SaveEarn/moonwell"
          className="block bg-white rounded-[32px] p-5 shadow-lg mb-4 border border-gray-100 hover:border-downy-200 transition"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center flex-1 min-w-0">
              <Image
                src="/brand/moonwell_logo.png"
                alt="Moonwell"
                width={56}
                height={56}
                className="w-14 h-14 rounded-full mr-4 object-cover"
              />
              <div className="flex-1 pr-2 min-w-0">
                <p className="text-xl font-bold text-gray-900">Moonwell</p>
                <p className="text-sm text-gray-500 font-medium mt-0.5">
                  USDC Pool
                </p>
              </div>
            </div>
            <div className="items-end bg-downy-50 px-3 py-2 rounded-xl text-right">
              {loading ? (
                <div className="h-6 w-14 bg-downy-200/50 rounded-md mb-1" />
              ) : (
                <p className="text-lg font-bold text-downy-700 font-mono">
                  {apy}
                </p>
              )}
              <p className="text-[10px] font-bold text-downy-600 tracking-wide">
                APY
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col items-center justify-center bg-gray-50 py-2.5 rounded-2xl border border-gray-100">
              <FiLogIn className="text-emerald-500 mb-1.5" size={18} />
              <p className="text-[11px] font-bold text-gray-700 text-center leading-tight">
                Supply
                <br />
                anytime
              </p>
            </div>
            <div className="flex flex-col items-center justify-center bg-gray-50 py-2.5 rounded-2xl border border-gray-100">
              <FiActivity className="text-blue-500 mb-1.5" size={18} />
              <p className="text-[11px] font-bold text-gray-700 text-center leading-tight">
                Earn while
                <br />
                borrowed
              </p>
            </div>
            <div className="flex flex-col items-center justify-center bg-gray-50 py-2.5 rounded-2xl border border-gray-100">
              <FiLogOut className="text-amber-500 mb-1.5" size={18} />
              <p className="text-[11px] font-bold text-gray-700 text-center leading-tight">
                Withdraw when
                <br />
                cash is free
              </p>
            </div>
          </div>

          <div
            className={`mb-4 rounded-2xl px-3 py-2.5 text-xs font-semibold ${
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

          <div className="bg-slate-50 rounded-2xl p-4 border border-gray-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Invested</p>
              {loading ? (
                <div className="h-5 w-20 bg-gray-200 rounded-md" />
              ) : (
                <p className="text-[15px] font-bold text-gray-900 font-mono">
                  {invested} USDC
                </p>
              )}
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1 font-medium">Earned</p>
              {loading ? (
                <div className="h-5 w-16 bg-gray-200 rounded-md ml-auto" />
              ) : (
                <p className="text-[15px] font-bold text-emerald-600 font-mono">
                  +{earned} USDC
                </p>
              )}
            </div>
            <FiArrowRight className="text-gray-300 ml-2" />
          </div>
        </Link>

        <p className="text-xs text-gray-400 leading-5 text-center px-2 mt-2">
          You supply money into a lending pool. Borrowers may use that cash and
          pay interest. Rates change with demand and are not guaranteed. You can
          only withdraw when the pool has free cash again.
        </p>
      </div>

      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
    </div>
  );
}
