"use client";

import React from "react";
import { FiCheck, FiClock } from "react-icons/fi";
import { Member, PayoutScheduleItem } from "@/utils/typesUtils";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { formatDate } from "@/utils/duration";

type PayoutStatus = "completed" | "next" | "upcoming" | "pending";

type Props = {
  payoutSchedule: PayoutScheduleItem[];
  currentUserAddress?: string;
  chamaStatus: string;
  members: Member[];
  contributionAmount: number;
  totalPayout: number;
  currentCycle?: number;
  currentRound?: number;
  currentUserName?: string;
};

const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

export default function ScheduleTab({
  payoutSchedule,
  currentUserAddress,
  chamaStatus,
  members,
  contributionAmount,
  totalPayout,
  currentCycle,
  currentRound,
  currentUserName,
}: Props) {
  const { formatBalance } = useFormattedBalance();

  const getMemberByAddress = (address: string): Member | undefined =>
    members.find(
      (m) =>
        m.smartAddress?.toLowerCase() === address.toLowerCase() ||
        m.address?.toLowerCase() === address.toLowerCase()
    );

  const getPayoutStatus = (
    payout: PayoutScheduleItem,
    index: number
  ): PayoutStatus => {
    if (payout.paid) return "completed";
    const now = new Date();
    const payoutDate = new Date(payout.payDate);
    const firstUnpaidIndex = payoutSchedule.findIndex((p) => !p.paid);
    if (firstUnpaidIndex === index) return "next";
    if (payoutDate > now) return "upcoming";
    return "pending";
  };

  const estimatedPayoutAmount =
    contributionAmount && members.length > 0
      ? contributionAmount * members.length
      : totalPayout || 0;

  if (
    chamaStatus === "not started" ||
    !payoutSchedule ||
    payoutSchedule.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-3xl mb-2">🎲</p>
        <div className="w-8 h-1 bg-amber-300/50 rounded-full mb-4" />
        <h3 className="text-[15px] font-bold text-gray-900 mb-2">
          Random Selection
        </h3>
        <p className="text-[12px] text-gray-500 leading-relaxed max-w-xs">
          The payout schedule will be randomly generated when the chama starts.
          All members will be notified when it&apos;s ready.
        </p>
      </div>
    );
  }

  const statusStyles = (status: PayoutStatus) => {
    switch (status) {
      case "completed":
        return {
          chip: "bg-green-100 text-green-700",
          badge: "bg-green-200 text-green-800",
          label: "Paid",
        };
      case "next":
        return {
          chip: "bg-amber-100 text-amber-700",
          badge: "bg-amber-200 text-amber-800",
          label: "Next",
        };
      case "upcoming":
        return {
          chip: "bg-blue-100 text-blue-700",
          badge: "bg-blue-200 text-blue-800",
          label: "Upcoming",
        };
      default:
        return {
          chip: "bg-gray-100 text-gray-700",
          badge: "bg-gray-200 text-gray-700",
          label: "Pending",
        };
    }
  };

  return (
    <div className="space-y-2.5 pb-6">
      {(currentCycle !== undefined || currentRound !== undefined) && (
        <div className="flex justify-center mb-1">
          <span className="border border-downy-500 text-downy-600 font-bold text-[12px] px-3 py-1.5 rounded-lg">
            Cycle {currentCycle || 1} · Round {currentRound || 1}
          </span>
        </div>
      )}

      {payoutSchedule.map((payout, index) => {
        const status = getPayoutStatus(payout, index);
        const styles = statusStyles(status);
        const member = getMemberByAddress(payout.userAddress);
        const isMe =
          (currentUserName && member?.name === currentUserName) ||
          (currentUserAddress &&
            (member?.smartAddress?.toLowerCase() ===
              currentUserAddress.toLowerCase() ||
              member?.address?.toLowerCase() ===
                currentUserAddress.toLowerCase() ||
              payout.userAddress?.toLowerCase() ===
                currentUserAddress.toLowerCase()));

        return (
          <div
            key={`${payout.userAddress}-${index}`}
            className={`p-3.5 rounded-xl border bg-white ${
              isMe ? "border-downy-400" : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${styles.chip}`}
                >
                  {status === "completed" ? (
                    <FiCheck size={14} />
                  ) : status === "next" ? (
                    <FiClock size={14} />
                  ) : (
                    <span className="text-[12px] font-semibold">{index + 1}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">
                    {isMe
                      ? "# You"
                      : member?.name || truncateAddress(payout.userAddress)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {formatDate(payout.payDate)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-[12px] font-bold ${
                    payout.paid ? "text-emerald-700" : "text-gray-900"
                  }`}
                >
                  {estimatedPayoutAmount > 0
                    ? formatBalance(estimatedPayoutAmount)
                    : "—"}
                </p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles.badge}`}
                >
                  {styles.label}
                </span>
              </div>
            </div>
            {isMe && status !== "completed" && (
              <div className="mt-2.5 p-2 bg-amber-50 rounded-lg">
                <p className="text-[11px] text-amber-700">
                  {status === "next"
                    ? "Your payout is up next."
                    : "Your payout is coming up."}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
