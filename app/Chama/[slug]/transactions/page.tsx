"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiExternalLink, FiX } from "react-icons/fi";
import { Transaction } from "@/utils/typesUtils";
import { formatDate, getRelativeTime } from "@/utils/duration";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { normalizeUsdcAmount } from "@/lib/normalizeUsdc";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useAuth } from "@/app/context/AuthContext";

function txLabel(tx: Transaction) {
  if (tx.type === "payout") return "Cycle & Round Payout";
  if (tx.type === "refund") return "Payout Refunded";
  if (tx.type === "deposit_on_behalf") return tx.description || "Paid on behalf";
  return tx.description || "Transaction";
}

function txRowClass(tx: Transaction, isMine: boolean) {
  if (tx.type === "refund") return "bg-amber-50 border-amber-200";
  if (tx.type === "payout") return "bg-indigo-50 border-indigo-100";
  if (tx.type === "deposit_on_behalf") return "bg-teal-50 border-teal-100";
  if (isMine) return "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200";
  if (tx.type === "contribution") return "bg-emerald-50 border-emerald-100";
  return "bg-orange-50 border-orange-100";
}

function txTitleClass(type: string) {
  switch (type) {
    case "payout":
      return "text-indigo-600";
    case "refund":
      return "text-amber-700";
    case "deposit_on_behalf":
      return "text-teal-700";
    case "contribution":
      return "text-gray-900";
    default:
      return "text-orange-700";
  }
}

export default function ChamaTransactionsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params?.slug || "");
  const { isAuthenticated } = useSessionAddress();
  const { user } = useAuth();
  const { formatBalance } = useFormattedBalance();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [ready, setReady] = useState(false);

  const normalizedAddress = (
    (user?.smartAddress as string) ||
    (user?.address as string) ||
    ""
  ).toLowerCase();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    try {
      const raw = sessionStorage.getItem(`chama-tx-${slug}`);
      if (raw) setTransactions(JSON.parse(raw) as Transaction[]);
    } catch {
      setTransactions([]);
    }
    setReady(true);
  }, [slug, isAuthenticated, router]);

  const sorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [transactions]
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      <div
        className="shrink-0 px-4 pt-2 pb-3.5 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center gap-3 min-h-[32px]">
          <Link
            href={`/Chama/${slug}`}
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
            aria-label="Back to chama"
          >
            <FiArrowLeft size={16} />
          </Link>
          <h1 className="text-[15px] font-bold flex-1 text-center pr-8">
            All transactions
          </h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 space-y-2 [-webkit-overflow-scrolling:touch]">
        {!ready ? (
          <p className="text-center text-[12px] text-gray-500 py-10">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-[12px] text-gray-500 py-10">
            No transactions yet
          </p>
        ) : (
          sorted.map((tx) => {
            const isMine =
              tx.type !== "refund" &&
              tx.user?.address?.toLowerCase() === normalizedAddress;
            return (
              <button
                key={String(tx.id)}
                type="button"
                onClick={() => setSelectedTx(tx)}
                className={`w-full text-left flex justify-between gap-3 py-3 px-3 rounded-xl border ${txRowClass(
                  tx,
                  isMine
                )}`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-[13px] font-semibold truncate ${txTitleClass(
                      tx.type
                    )}`}
                  >
                    {txLabel(tx)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {isMine ? "You" : tx.user?.name || "Member"}
                    {" · "}
                    {getRelativeTime(tx.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold text-gray-900">
                    {tx.amount != null
                      ? formatBalance(normalizeUsdcAmount(tx.amount))
                      : "—"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedTx && (
        <div className="app-modal-layer">
          <div className="app-modal-backdrop" />
          <div className="app-modal-sheet bg-white p-5 pb-8 shadow-xl">
            <div className="flex items-center justify-between mb-3">
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
            <div className="text-center">
              <p className="text-[15px] font-bold text-gray-900">
                {txLabel(selectedTx)}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                {formatDate(selectedTx.date)}
              </p>
              <p className="text-[1.75rem] font-extrabold text-gray-900 mt-3">
                {selectedTx.amount != null
                  ? formatBalance(normalizeUsdcAmount(selectedTx.amount))
                  : "—"}
              </p>
              <p className="text-[12px] text-gray-600 mt-2">
                {selectedTx.user?.name || "Member"}
              </p>
            </div>
            {selectedTx.txHash ? (
              <a
                href={`https://basescan.org/tx/${selectedTx.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-downy-600 text-white text-[12px] font-bold"
              >
                View on BaseScan <FiExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
