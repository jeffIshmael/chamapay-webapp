"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiChevronDown,
  FiFileText,
  FiInfo,
  FiX,
} from "react-icons/fi";
import { HiOutlineCalculator } from "react-icons/hi";
import { showToast } from "../../Components/Toast";
import {
  computeMoonwellPrincipalUsdc,
  depositToMoonwell,
  getMoonwellUsdcSnapshot,
  getMoonwellYieldsHistory,
  withdrawFromMoonwell,
  type MoonwellUsdcSnapshot,
} from "@/lib/moonwellService";
import {
  getTheUserTx,
  isMoonwellTx,
  type WalletTransaction,
} from "@/lib/walletServices";
import { useAuth } from "../../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useFormattedBalance } from "@/lib/useFormattedBalance";

type HistoryItem =
  | {
      type: "yield";
      earned: string;
      balance: string;
      date: Date;
    }
  | {
      type: "tx";
      description?: string;
      amount: string;
      rawSender?: string;
      date: Date;
    };

const formatMarketTvl = (usd: number | null | undefined) => {
  if (usd == null) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
};

const renderPeriodText = (months: number) => {
  if (months < 12) return `${months} Month${months > 1 ? "s" : ""}`;
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  return `${months} Months (${yrs} Yr${yrs > 1 ? "s" : ""}${
    mos > 0 ? ` ${mos} Mo` : ""
  })`;
};

export default function MoonwellPoolPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { isAuthenticated, isGuest } = useSessionAddress();
  const { formatBalance, currency, platformRate } = useFormattedBalance();
  const isKES = currency === "KES";

  const [snapshot, setSnapshot] = useState<MoonwellUsdcSnapshot | null>(null);
  const [statements, setStatements] = useState<WalletTransaction[]>([]);
  const [yieldHistory, setYieldHistory] = useState<
    Array<{ earned: string; balance: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "simulator">(
    "history"
  );

  const [simAmount, setSimAmount] = useState("1000");
  const [simPeriod, setSimPeriod] = useState(12);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const [actionModal, setActionModal] = useState<"deposit" | "withdraw" | null>(
    null
  );
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  const load = useCallback(async () => {
    const address =
      (user?.smartAddress as string) || (user?.address as string) || "";
    if (!address || isGuest || token === "guest") {
      setSnapshot(null);
      setStatements([]);
      setYieldHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let principal = 0;
      let txs: WalletTransaction[] = [];
      let yields: Array<{ earned: string; balance: string; createdAt: string }> =
        [];

      if (token) {
        const [txRes, yieldRes] = await Promise.all([
          getTheUserTx(token, { limit: 100 }),
          getMoonwellYieldsHistory(token),
        ]);

        txs =
          txRes?.transactions.filter((tx) => isMoonwellTx(tx)) ?? [];
        principal = computeMoonwellPrincipalUsdc(txs);
        yields = yieldRes?.yields ?? [];
      }

      const live = await getMoonwellUsdcSnapshot(address, principal, token);
      setSnapshot(live);
      setStatements(txs);
      setYieldHistory(yields);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [user, token, isGuest]);

  useEffect(() => {
    load();
  }, [load]);

  const APY = snapshot?.supplyApy ?? 0;
  const totalBalance = snapshot?.totalBalanceUsdc ?? 0;
  const totalEarned = snapshot?.earnedUsdc ?? 0;
  const liquidity = snapshot?.liquidityUsd;
  const canWithdraw =
    liquidity == null || totalBalance <= 0 || (liquidity ?? 0) >= totalBalance;
  const snapshotLoading = loading && snapshot === null;

  const displayAmount = (usdcAmount: number) => {
    if (isKES) {
      const kes = Math.ceil(usdcAmount * platformRate * 100) / 100;
      return kes.toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return (Math.ceil(usdcAmount * 1000) / 1000).toFixed(3);
  };

  const unit = isKES ? "KES" : "USDC";

  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryItem[]> = {};

    yieldHistory.forEach((h) => {
      const d = new Date(h.createdAt);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push({
        type: "yield",
        earned: h.earned,
        balance: h.balance,
        date: d,
      });
    });

    statements.forEach((tx) => {
      const d = new Date(tx.date);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push({
        type: "tx",
        description: tx.description,
        amount: tx.amount,
        rawSender: tx.rawSender,
        date: d,
      });
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => b.date.getTime() - a.date.getTime());
    });

    return Object.keys(groups)
      .sort((a, b) => groups[b][0].date.getTime() - groups[a][0].date.getTime())
      .map((dateStr) => ({ dateStr, items: groups[dateStr] }));
  }, [statements, yieldHistory]);

  const amountNum = parseFloat(simAmount) || 0;
  const simUsdc = isKES ? amountNum / (platformRate || 1) : amountNum;
  const projectedYieldUsdc =
    simUsdc * (Math.pow(1 + APY / 100, simPeriod / 12) - 1);
  const totalProjectedUsdc = simUsdc + projectedYieldUsdc;

  const submitAction = async () => {
    if (!token || token === "guest" || isGuest) {
      showToast("Please sign in", "warning");
      return;
    }
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      showToast("Enter a valid amount", "warning");
      return;
    }
    if (actionModal === "withdraw" && !canWithdraw) {
      showToast("Pool liquidity is too low to withdraw right now", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        actionModal === "deposit"
          ? await depositToMoonwell(token, n.toString())
          : await withdrawFromMoonwell(token, n.toString());
      if (!result.success) {
        showToast(result.error || "Transaction failed", "error");
        return;
      }
      showToast(
        actionModal === "deposit"
          ? "Deposited to Moonwell"
          : "Withdrawn from Moonwell",
        "success"
      );
      setAmount("");
      setActionModal(null);
      setTimeout(() => load(), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header — solid brand teal (not forest green gradient) */}
      <div
        className="rounded-b-3xl px-5 pb-5 text-white safe-top shadow-sm"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center justify-between min-h-[40px] mb-1 pt-1">
          <button
            type="button"
            onClick={() => router.push("/SaveEarn")}
            className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center"
            aria-label="Back"
          >
            <FiArrowLeft size={18} />
          </button>
          <h1 className="text-[17px] font-bold">Pool Details</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Hero card */}
        <div className="bg-blue-50 rounded-2xl p-5 shadow-sm border border-blue-200">
          <div className="flex items-center justify-center gap-2 mb-5 pb-4 border-b border-blue-100">
            <Image
              src="/brand/moonwell_logo.png"
              alt="Moonwell"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full bg-white object-cover"
            />
            <p className="text-blue-900 text-[16px] font-bold tracking-tight">
              Moonwell Pool
            </p>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-blue-800/70 text-[10px] font-semibold uppercase tracking-wider mb-0.5">
                Total Supplied
              </p>
              {snapshotLoading ? (
                <div className="h-6 w-16 bg-blue-900/10 rounded mt-1 animate-pulse" />
              ) : (
                <p className="font-mono font-bold text-[16px] text-blue-900">
                  {formatMarketTvl(snapshot?.marketTotalSupplyUsd)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-blue-800/70 text-[10px] font-semibold uppercase tracking-wider mb-0.5">
                Current APY
              </p>
              {snapshotLoading ? (
                <div className="h-6 w-16 bg-emerald-700/20 rounded mt-1 animate-pulse ml-auto" />
              ) : (
                <p className="font-mono font-bold text-[16px] text-emerald-700">
                  {APY.toFixed(2)}%
                </p>
              )}
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-blue-800/70 text-[12px] font-medium mb-1.5">
              Total Balance (Inc. Yield)
            </p>
            {snapshotLoading ? (
              <div className="h-10 w-40 bg-blue-100/60 rounded-lg mx-auto animate-pulse" />
            ) : (
              <p className="font-mono text-blue-900 text-[2rem] font-extrabold tracking-tight leading-none">
                {displayAmount(totalBalance)}
                <span className="text-[1.1rem] text-blue-900/50 font-bold">
                  {" "}
                  {unit}
                </span>
              </p>
            )}
            <p className="text-emerald-600 font-bold text-[11px] mt-2">
              {snapshotLoading
                ? "…"
                : `+${displayAmount(totalEarned)} Total Yield`}
            </p>
          </div>

          <div
            className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold flex items-start gap-1.5 mb-4 ${
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

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAmount("");
                setActionModal("deposit");
              }}
              className="flex-1 bg-blue-600 py-3 rounded-2xl text-white text-[14px] font-bold shadow-sm"
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => {
                setAmount("");
                setActionModal("withdraw");
              }}
              disabled={totalBalance === 0}
              className={`flex-1 py-3 rounded-2xl text-[14px] font-bold border border-blue-200 shadow-sm ${
                totalBalance === 0
                  ? "bg-gray-50 text-blue-700/40 opacity-60 cursor-not-allowed"
                  : "bg-white text-blue-700"
              }`}
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* How it works */}
        <div>
          <h2 className="text-[16px] font-bold text-gray-900 mb-2.5">
            How it works
          </h2>
          <ul className="space-y-2.5 pl-1">
            {[
              `Supply from your wallet${
                isKES ? " or M-Pesa (shown in KES)" : ""
              }. Your money goes into a shared lending pool.`,
              "Others can borrow from that pool. The interest they pay is what you earn. The rate moves with demand.",
              "Withdraw only when the pool has free cash. If cash is borrowed, your balance stays yours and keeps earning.",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-[13px] text-gray-700 font-medium leading-snug">
                  {text}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-semibold ${
              activeTab === "history"
                ? "bg-white text-downy-800 shadow-sm"
                : "bg-transparent text-gray-500"
            }`}
          >
            <FiFileText size={14} />
            History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-semibold ${
              activeTab === "simulator"
                ? "bg-white text-downy-800 shadow-sm"
                : "bg-transparent text-gray-500"
            }`}
          >
            <HiOutlineCalculator size={14} />
            Yield Simulator
          </button>
        </div>

        {activeTab === "history" ? (
          <div>
            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="h-8 w-8 mx-auto rounded-full border-2 border-downy-600 border-t-transparent animate-spin mb-3" />
                <p className="text-[12px] text-gray-500 font-medium">
                  Loading history…
                </p>
              </div>
            ) : groupedHistory.length > 0 ? (
              <div className="space-y-5">
                {groupedHistory.map((group) => (
                  <div key={group.dateStr}>
                    <p className="text-gray-800 font-bold text-[15px] mb-2.5">
                      {group.dateStr}
                    </p>
                    <div className="space-y-2.5">
                      {group.items.map((item, idx) => {
                        if (item.type === "yield") {
                          return (
                            <div
                              key={`yield-${idx}`}
                              className="bg-white rounded-2xl p-3.5 shadow-sm border border-[#d1f6f1] flex justify-between items-center"
                            >
                              <div>
                                <p className="text-[#09272a] font-bold text-[13px]">
                                  Daily Yield
                                </p>
                                <p className="text-gray-500 text-[11px]">
                                  {item.date.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-[#1a6b6b] font-bold text-[13px]">
                                  +{displayAmount(parseFloat(item.earned))}{" "}
                                  {unit}
                                </p>
                                <p className="font-mono text-gray-400 text-[10px] mt-0.5">
                                  Balance:{" "}
                                  {displayAmount(parseFloat(item.balance))}{" "}
                                  {unit}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        const desc = String(item.description || "");
                        const isWithdrawal =
                          desc.toLowerCase().includes("withdraw") ||
                          item.rawSender === "Moonwell";
                        const absAmount = Math.abs(Number(item.amount) || 0);

                        return (
                          <div
                            key={`tx-${idx}`}
                            className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex justify-between items-center"
                          >
                            <div className="min-w-0 pr-3">
                              <p className="text-gray-900 font-bold text-[13px] truncate">
                                {desc ||
                                  (isWithdrawal ? "Withdrawal" : "Deposit")}
                              </p>
                              <p className="text-gray-500 text-[11px]">
                                {item.date.toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </p>
                            </div>
                            <p
                              className={`font-mono font-bold text-[13px] shrink-0 ${
                                isWithdrawal
                                  ? "text-red-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {isWithdrawal ? "-" : "+"}
                              {displayAmount(absAmount)} {unit}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <FiFileText
                  size={28}
                  className="mx-auto text-gray-300 mb-2"
                />
                <p className="text-gray-500 font-medium text-[13px]">
                  No history yet.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HiOutlineCalculator size={16} className="text-emerald-500" />
                <p className="text-[15px] font-bold text-gray-900">
                  Yield Simulator
                </p>
              </div>
              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {APY.toFixed(2)}% APY
              </span>
            </div>

            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">
              I want to save ({unit})
            </label>
            <div className="flex items-center border border-gray-200 bg-gray-50 rounded-xl px-3 mb-3.5">
              <span className="text-gray-500 font-bold text-[14px]">
                {isKES ? "KSh" : "$"}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={simAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setSimAmount(v);
                }}
                className="flex-1 px-2 py-2.5 text-[15px] font-bold text-gray-900 border-0 bg-transparent focus:ring-0"
                placeholder="1000"
              />
            </div>

            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">
              Over a period of
            </label>
            <button
              type="button"
              onClick={() => setShowPeriodPicker(true)}
              className="w-full flex items-center justify-between border border-gray-200 bg-gray-50 rounded-xl px-3.5 py-3 mb-4"
            >
              <span className="text-[14px] font-bold text-gray-900">
                {renderPeriodText(simPeriod)}
              </span>
              <FiChevronDown size={18} className="text-gray-500" />
            </button>

            <div className="bg-downy-50 rounded-2xl p-3.5 border border-downy-100">
              <div className="flex justify-between items-end mb-2.5">
                <p className="text-[12px] font-medium text-downy-900">
                  Projected Interest
                </p>
                <p className="font-mono text-[15px] font-extrabold text-emerald-600">
                  +{isKES ? "KSh " : "$"}
                  {displayAmount(projectedYieldUsdc)}
                </p>
              </div>
              <div className="flex justify-between items-end pt-2.5 border-t border-downy-200">
                <p className="text-[12px] font-bold text-downy-900">
                  Total Balance
                </p>
                <p className="font-mono text-[15px] font-extrabold text-downy-900">
                  {isKES ? "KSh " : "$"}
                  {displayAmount(totalProjectedUsdc)}
                </p>
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-[10px] text-gray-400 mt-3 leading-relaxed">
              <FiInfo size={11} className="mt-0.5 shrink-0" />
              Projections are estimates based on the current variable rate of{" "}
              {APY.toFixed(2)}% APY and are not guaranteed.
            </p>
          </div>
        )}
      </div>

      {/* Deposit / Withdraw modal */}
      {actionModal && (
        <div className="app-modal-layer">
          <div
            className="app-modal-backdrop"
            onClick={() => !submitting && setActionModal(null)}
          />
          <div className="app-modal-sheet bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-gray-900">
                {actionModal === "deposit" ? "Deposit" : "Withdraw"}
              </h3>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <FiX size={14} />
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
                placeholder={actionModal === "deposit" ? "10" : "5"}
                className="flex-1 px-3 py-2.5 text-[13px] font-semibold border-0 focus:ring-0 bg-white"
                autoFocus
              />
            </div>

            {actionModal === "withdraw" && (
              <p className="text-[11px] text-gray-500 mb-3">
                Available: {formatBalance(totalBalance)}
              </p>
            )}

            <button
              type="button"
              onClick={submitAction}
              disabled={submitting || !amount}
              className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
                submitting || !amount
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-downy-600 shadow-md shadow-downy-600/25"
              }`}
            >
              {submitting
                ? "Processing…"
                : actionModal === "deposit"
                  ? "Supply to Moonwell"
                  : "Withdraw to wallet"}
            </button>
          </div>
        </div>
      )}

      {/* Period picker */}
      {showPeriodPicker && (
        <div className="app-modal-layer">
          <div
            className="app-modal-backdrop"
            onClick={() => setShowPeriodPicker(false)}
          />
          <div className="app-modal-sheet bg-white max-h-[60dvh] flex flex-col pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-[15px] font-bold text-gray-900">
                Select Period
              </p>
              <button
                type="button"
                onClick={() => setShowPeriodPicker(false)}
                className="text-downy-700 font-bold text-[13px] bg-transparent"
              >
                Done
              </button>
            </div>
            <div className="overflow-y-auto px-3 py-2">
              {Array.from({ length: 36 }, (_, i) => i + 1).map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => {
                    setSimPeriod(months);
                    setShowPeriodPicker(false);
                  }}
                  className={`w-full flex items-center justify-between py-3.5 px-3 rounded-xl mb-0.5 text-left ${
                    simPeriod === months ? "bg-downy-50" : "bg-transparent"
                  }`}
                >
                  <span
                    className={`text-[14px] ${
                      simPeriod === months
                        ? "font-bold text-downy-800"
                        : "font-medium text-gray-700"
                    }`}
                  >
                    {renderPeriodText(months)}
                  </span>
                  {simPeriod === months && (
                    <span className="h-2.5 w-2.5 rounded-full bg-downy-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
