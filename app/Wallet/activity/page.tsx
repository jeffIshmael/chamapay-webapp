"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiArrowDownLeft,
  FiArrowLeft,
  FiArrowUpRight,
  FiExternalLink,
  FiX,
} from "react-icons/fi";
import {
  getTheUserTx,
  getMoonwellActivitySubtitle,
  getMoonwellActivityTitle,
  isMoonwellTx,
  WalletTransaction,
} from "@/lib/walletServices";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { getRelativeTime } from "@/utils/duration";

export default function AllActivityPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useSessionAddress();
  const { formatBalance, currency } = useFormattedBalance();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!token) return;
    setLoading(true);
    getTheUserTx(token, { limit: 20 }).then((data) => {
      setTransactions(data?.transactions || []);
      setCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
      setLoading(false);
    });
  }, [token, isAuthenticated, router]);

  const loadMore = async () => {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    const data = await getTheUserTx(token, { limit: 20, cursor });
    setTransactions((prev) => [...prev, ...(data?.transactions || [])]);
    setCursor(data?.nextCursor || null);
    setHasMore(Boolean(data?.hasMore));
    setLoadingMore(false);
  };

  const getIconColor = (type: WalletTransaction["type"]) => {
    switch (type) {
      case "sent":
        return "#f56c6c";
      case "received":
        return "#10b981";
      case "deposited":
        return "#3b82f6";
      case "withdrew":
        return "#f97316";
      default:
        return "#6b7280";
    }
  };

  const titleFor = (tx: WalletTransaction) =>
    isMoonwellTx(tx) ? getMoonwellActivityTitle(tx) : tx.type;

  const subtitleFor = (tx: WalletTransaction) => {
    if (isMoonwellTx(tx)) return getMoonwellActivitySubtitle(tx);
    if (tx.isPretiumTx) {
      return tx.type === "deposited"
        ? `From: ${tx.sender || "M-PESA"}`
        : `To: ${tx.recipient || "M-PESA"}`;
    }
    if (tx.type === "sent" || tx.type === "withdrew") {
      return `To: ${tx.recipient || "Unknown"}`;
    }
    return `From: ${tx.sender || "Unknown"}`;
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      <div
        className="shrink-0 px-4 pt-2 pb-3.5 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center gap-3 min-h-[32px]">
          <Link
            href="/Wallet"
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
            aria-label="Back to wallet"
          >
            <FiArrowLeft size={16} />
          </Link>
          <h1 className="text-[15px] font-bold flex-1 text-center pr-8">
            All activity
          </h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 space-y-2 [-webkit-overflow-scrolling:touch]">
        {loading ? (
          <p className="text-center text-[12px] text-gray-500 py-10">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-center text-[12px] text-gray-500 py-10">
            No transactions yet
          </p>
        ) : (
          transactions.map((tx) => {
            const color = getIconColor(tx.type);
            const isOut = tx.type === "sent" || tx.type === "withdrew";
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => setSelectedTx(tx)}
                className="w-full bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    {isOut ? (
                      <FiArrowUpRight size={18} style={{ color }} />
                    ) : (
                      <FiArrowDownLeft size={18} style={{ color }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 capitalize truncate">
                      {titleFor(tx)}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {subtitleFor(tx)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p
                    className={`text-[13px] font-bold ${
                      isOut ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {isOut ? "-" : "+"}
                    {currency === "KES" && tx.fiatAmount
                      ? ` ${tx.fiatAmount.toLocaleString("en-KE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} KES`
                      : ` ${formatBalance(tx.amount)}`}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {getRelativeTime(tx.date)}
                  </p>
                </div>
              </button>
            );
          })
        )}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-3 rounded-xl bg-white border border-downy-100 text-[12px] font-bold text-downy-700"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>

      {selectedTx && (
        <div className="app-modal-layer">
          <div className="app-modal-backdrop" />
          <div className="app-modal-sheet bg-white p-5 pb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8" />
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <FiX size={14} />
              </button>
            </div>
            <p className="text-[15px] font-bold text-center capitalize">
              {titleFor(selectedTx)}
            </p>
            <p className="text-[12px] text-gray-500 text-center mt-1">
              {subtitleFor(selectedTx)}
            </p>
            <p
              className={`text-[1.6rem] font-extrabold text-center mt-3 ${
                selectedTx.type === "sent" || selectedTx.type === "withdrew"
                  ? "text-red-500"
                  : "text-emerald-600"
              }`}
            >
              {selectedTx.type === "sent" || selectedTx.type === "withdrew"
                ? "-"
                : "+"}
              {currency === "KES" && selectedTx.fiatAmount
                ? ` ${selectedTx.fiatAmount.toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} KES`
                : ` ${formatBalance(selectedTx.amount)}`}
            </p>
            {selectedTx.hash && selectedTx.hash !== "N/A" && (
              <a
                href={`https://basescan.org/tx/${selectedTx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-downy-600 text-white text-[12px] font-bold"
              >
                View on BaseScan <FiExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
