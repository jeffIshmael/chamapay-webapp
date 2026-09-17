"use client";

import React, { useMemo, useState } from "react";
import {
  FiCalendar,
  FiCheck,
  FiDollarSign,
  FiExternalLink,
  FiX,
} from "react-icons/fi";
import { JoinedChama, Transaction } from "@/utils/typesUtils";
import {
  formatDate,
  formatTimeRemaining,
  getRelativeTime,
} from "@/utils/duration";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { normalizeUsdcAmount, normalizeChamaBalance } from "@/lib/normalizeUsdc";
import ChamaWithdrawModal from "@/app/Components/ChamaWithdrawModal";
import { Member } from "@/utils/typesUtils";
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

type Props = {
  chama: JoinedChama;
  userAddress: string;
  onPay: (recipient?: { userId: number; userName: string } | null) => void;
};

export default function ChamaOverview({ chama, userAddress, onPay }: Props) {
  const { formatBalance } = useFormattedBalance();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showRecipient, setShowRecipient] = useState(false);

  const myContributions = useMemo(
    () => normalizeChamaBalance(chama.userBalance),
    [chama.userBalance]
  );
  const contribution = Number(chama.contribution) || 0;
  const remainingAmount = Math.max(0, contribution - myContributions);
  const normalizedAddress = (userAddress || "").toLowerCase();
  const hasSchedule = (chama.payoutSchedule?.length || 0) > 0;

  const startPay = () => {
    if ((chama.members?.length || 0) > 1) {
      setShowRecipient(true);
      return;
    }
    onPay(null);
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Balance card */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-3.5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-downy-100 flex items-center justify-center">
            <FiDollarSign className="text-downy-700" size={16} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">
              My Chama Balance
            </p>
            <p className="text-[11px] text-gray-500">Available funds</p>
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-[1.75rem] font-extrabold text-gray-900 tracking-tight">
            {formatBalance(myContributions)}
          </p>

          {remainingAmount > 0 ? (
            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-orange-800 font-semibold text-[12px]">
                Outstanding Payment
              </p>
              <p className="text-orange-700 text-[11px] mt-0.5">
                {formatBalance(remainingAmount)}
                {" · Due: "}
                {formatDate(chama.contributionDueDate)}
              </p>
            </div>
          ) : (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5 shrink-0">
                <FiCheck className="text-emerald-600" size={10} />
              </div>
              <div>
                <p className="text-emerald-800 font-semibold text-[12px]">
                  Up to Date
                </p>
                <p className="text-emerald-700 text-[11px] mt-0.5">
                  You have no outstanding payments for this cycle.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {remainingAmount > 0 ? (
              <>
                <button
                  type="button"
                  onClick={startPay}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-bold bg-downy-600 text-white"
                >
                  Make Payment
                </button>
                <button
                  type="button"
                  disabled={myContributions <= 0}
                  onClick={() => setShowWithdraw(true)}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border ${
                    myContributions > 0
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-gray-100 border-gray-200 text-gray-400"
                  }`}
                >
                  Withdraw
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startPay}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-700"
                >
                  Add Funds
                </button>
                <button
                  type="button"
                  disabled={myContributions <= 0}
                  onClick={() => setShowWithdraw(true)}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border ${
                    myContributions > 0
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-gray-100 border-gray-200 text-gray-400"
                  }`}
                >
                  Withdraw
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Next payout */}
      <div className="bg-white rounded-2xl border border-downy-100/70 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-downy-50 flex items-center justify-center">
            <FiCalendar className="text-downy-700" size={18} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-gray-900">
              {hasSchedule ? "Next payout" : "Schedule in"}
            </p>
            <p className="text-[11px] text-gray-500">
              {hasSchedule
                ? `Cycle ${chama.currentCycle} · Round ${chama.currentRound}`
                : `Schedule in: ${formatTimeRemaining(
                    chama.nextPayout || chama.startDate
                  )}`}
            </p>
          </div>
        </div>
        <div className="h-px bg-gray-100 mb-3" />

        {!hasSchedule ? (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 text-center">
            <p className="text-2xl mb-1">🎲</p>
            <p className="text-[14px] font-semibold text-amber-800">
              Random Selection
            </p>
            <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">
              The payout schedule will be randomly generated when the chama
              starts. All members will be notified when it&apos;s ready.
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-50 to-sky-50 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[12px] text-gray-600">Recipient</span>
              <span className="text-[13px] font-semibold text-gray-900 truncate">
                {chama.myTurn ? "# You" : chama.currentTurnMember}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-[12px] text-gray-600">Amount</span>
              <span className="text-[14px] font-bold text-emerald-600">
                {formatBalance(chama.nextPayoutAmount || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-[12px] text-gray-600">Payout date</span>
              <span className="text-[12px] font-semibold text-gray-900 text-right">
                {formatDate(chama.nextPayout)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-downy-100/70 shadow-sm p-4">
        <p className="text-[14px] font-semibold text-gray-900 mb-2">
          Recent Transactions
        </p>
        <div className="h-px bg-gray-100 mb-3" />

        {chama.recentTransactions.length === 0 ? (
          <p className="text-center text-[12px] text-gray-500 py-4">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-2">
            {chama.recentTransactions.slice(0, 5).map((tx) => {
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
                      className={`text-[12px] font-semibold truncate ${txTitleClass(
                        tx.type
                      )}`}
                    >
                      {txLabel(tx)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {isMine ? "You" : tx.user?.name || "Member"}
                      {" · "}
                      {getRelativeTime(tx.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-bold text-gray-900">
                      {tx.amount != null
                        ? formatBalance(normalizeUsdcAmount(tx.amount))
                        : "—"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showRecipient && (
        <div className="app-modal-layer">
          <div className="app-modal-backdrop" />
          <div className="app-modal-sheet bg-white p-5 pb-8 max-h-[80%] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8" />
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
              <button
                type="button"
                onClick={() => setShowRecipient(false)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <FiX size={14} />
              </button>
            </div>
            <h3 className="text-[17px] font-semibold text-gray-900 text-center mb-4">
              Who is this payment for?
            </h3>

            <button
              type="button"
              onClick={() => {
                setShowRecipient(false);
                onPay(null);
              }}
              className="w-full flex items-center justify-between gap-3 py-3.5 px-4 rounded-xl border border-gray-200 bg-gray-50 mb-1"
            >
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-downy-100 text-downy-700 flex items-center justify-center text-[13px] font-bold">
                  Me
                </span>
                <div className="text-left">
                  <p className="text-[15px] font-medium text-gray-800">For Me</p>
                  <p className="text-[11px] text-gray-500">
                    Your own contribution
                  </p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">➔</span>
            </button>

            <p className="text-[12px] font-medium text-gray-500 mt-4 mb-2 px-1">
              Or select a member to pay on their behalf:
            </p>

            <div className="overflow-y-auto flex-1 min-h-0 -mx-1">
              {(chama.members as Member[])
                .filter(
                  (m) =>
                    m.address?.toLowerCase() !== normalizedAddress &&
                    m.smartAddress?.toLowerCase() !== normalizedAddress
                )
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setShowRecipient(false);
                      onPay({ userId: m.id, userName: m.name });
                    }}
                    className="w-full flex items-center gap-3 py-3 px-3 border-b border-gray-100 bg-transparent text-left"
                  >
                    {m.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.profilePicture}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-10 w-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[13px] font-semibold">
                        {(m.name || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <p className="flex-1 text-[14px] font-medium text-gray-800 truncate">
                      {m.name}
                    </p>
                    <span className="text-gray-400 text-lg">➔</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <ChamaWithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        chamaId={chama.id}
        chamaName={chama.name}
        balance={myContributions}
      />

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
