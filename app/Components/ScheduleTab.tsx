"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiClock, FiRotateCcw, FiX } from "react-icons/fi";
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
  /** Only admins see the "Set the schedule manually" CTA. */
  isAdmin?: boolean;
  /** Chama start date; the random draw happens 2 days before it. */
  startDate?: Date | string;
  /** First payout date; used if there is no start date. */
  firstPayoutDate?: Date | string;
  /** Receives member ids in payout order (index 0 = first to be paid). */
  onSaveManualOrder?: (orderedUserIds: number[]) => Promise<void>;
};

const DRAW_LEAD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const memberLabel = (m: Member) =>
  m.name || truncateAddress(m.smartAddress || m.address || "");

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  const diff = Math.max(0, target.getTime() - now);
  return {
    done: diff === 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

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
  isAdmin = false,
  startDate,
  firstPayoutDate,
  onSaveManualOrder,
}: Props) {
  const { formatBalance } = useFormattedBalance();

  // Manual ordering state: ordered list of selected member ids.
  const [manualMode, setManualMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Random draw time = 2 days before start date (fallback: first payout date).
  const drawDate = useMemo(() => {
    const base = startDate || firstPayoutDate;
    if (!base) return null;
    const d = new Date(base);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() - DRAW_LEAD_MS);
  }, [startDate, firstPayoutDate]);

  const countdown = useCountdown(drawDate);

  const getMemberByAddress = (address: string): Member | undefined =>
    members.find(
      (m) =>
        m.smartAddress?.toLowerCase() === address.toLowerCase() ||
        m.address?.toLowerCase() === address.toLowerCase(),
    );

  const getPayoutStatus = (
    payout: PayoutScheduleItem,
    index: number,
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

  const toggleMember = (id: number) => {
    setSaveError("");
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const closeManual = () => {
    setManualMode(false);
    setSelectedIds([]);
    setSaveError("");
  };

  const saveManual = async () => {
    if (!onSaveManualOrder || selectedIds.length !== members.length) return;
    try {
      setSaving(true);
      setSaveError("");
      await onSaveManualOrder(selectedIds);
      closeManual();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the order");
    } finally {
      setSaving(false);
    }
  };

  // A schedule that exists is always shown (e.g. set manually before start).
  const noSchedule = !payoutSchedule || payoutSchedule.length === 0;

  const allPicked = members.length > 0 && selectedIds.length === members.length;

  if (noSchedule) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-3xl mb-2">🎲</p>
        <div className="w-8 h-1 bg-amber-300/50 rounded-full mb-4" />
        <h3 className="text-[15px] font-bold text-gray-900 mb-2">
          Random Selection
        </h3>
        <p className="text-[12px] text-gray-500 leading-relaxed max-w-xs">
          The payout schedule will be randomly generated or set by the admin
          before the paydate. All members will be notified when it&apos;s ready.
        </p>

        {countdown && (
          <div className="mt-5">
            {countdown.done ? (
              <p className="text-[12px] font-semibold text-amber-700">
                The payout order is being drawn…
              </p>
            ) : (
              <>
                <p className="text-[11px] text-gray-500 mb-2">
                  Payout order is drawn in
                </p>
                <div className="flex justify-center gap-2">
                  {[
                    ["Days", countdown.days],
                    ["Hrs", countdown.hours],
                    ["Min", countdown.minutes],
                    ["Sec", countdown.seconds],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="w-14 py-2 rounded-lg bg-amber-50 border border-amber-200"
                    >
                      <p className="text-[16px] font-bold text-amber-800 tabular-nums">
                        {pad(value as number)}
                      </p>
                      <p className="text-[10px] text-amber-700">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {isAdmin && onSaveManualOrder && members.length > 0 && (
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="mt-6 px-5 py-2.5 rounded-xl bg-downy-600 text-white text-[13px] font-semibold"
          >
            Set the schedule manually
          </button>
        )}

        {manualMode && (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50"
            onClick={() => !saving && closeManual()}
          >
            <div
              role="dialog"
              aria-label="Set payout order"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-t-2xl flex flex-col max-h-[88vh] text-left"
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">
                    Set payout order
                  </h3>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    Tap members in the order they should be paid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeManual}
                  disabled={saving}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <FiX size={16} />
                </button>
              </div>

              {/* Scrollable member list */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
                {members.map((m) => {
                  const pos = selectedIds.indexOf(m.id) + 1;
                  const picked = pos > 0;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`w-full flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition ${
                        picked
                          ? "border-downy-400 bg-downy-50/40"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold ${
                            picked
                              ? "bg-downy-600 text-white"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {picked ? pos : "–"}
                        </div>
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          {memberLabel(m)}
                        </p>
                      </div>
                      {picked && (
                        <span className="text-[10px] font-semibold text-downy-600 shrink-0">
                          Tap to remove
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Order summary + confirm */}
              <div
                className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 pt-3"
                style={{
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                }}
              >
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">
                  Payout order · {selectedIds.length}/{members.length}
                </p>
                {selectedIds.length === 0 ? (
                  <p className="text-[12px] text-gray-400 mb-3">
                    Nobody selected yet.
                  </p>
                ) : (
                  <ol className="max-h-24 overflow-y-auto grid grid-cols-3 gap-x-3 gap-y-1 mb-3">
                    {selectedIds.map((id, i) => {
                      const m = members.find((x) => x.id === id);
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-1 text-[12px] text-gray-800 min-w-0"
                        >
                          <span className="w-4 shrink-0 text-right font-bold text-downy-600">
                            {i + 1}.
                          </span>
                          <span className="truncate">
                            {m ? memberLabel(m) : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {saveError && (
                  <p className="text-[12px] text-red-600 mb-2">{saveError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    disabled={selectedIds.length === 0 || saving}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-[13px] font-semibold text-gray-700 disabled:opacity-40"
                  >
                    <FiRotateCcw size={13} /> Reset
                  </button>
                  <button
                    type="button"
                    onClick={saveManual}
                    disabled={!allPicked || saving}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-downy-600 text-white text-[13px] font-semibold disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Confirm order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                    <span className="text-[12px] font-semibold">
                      {index + 1}
                    </span>
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
            {/* {isMe && status !== "completed" && (
              <div className="mt-2.5 p-2 bg-amber-50 rounded-lg">
                <p className="text-[11px] text-amber-700">
                  {status === "next"
                    ? "Your payout is up next."
                    : "Your payout is coming up."}
                </p>
              </div>
            )} */}
          </div>
        );
      })}
    </div>
  );
}
