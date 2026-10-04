"use client";

import React, { useEffect, useState } from "react";
import { FiRotateCcw, FiX } from "react-icons/fi";
import { Member } from "@/utils/typesUtils";

const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const memberLabel = (m: Member) =>
  m.name || truncateAddress(m.smartAddress || m.address || "");

interface Props {
  open: boolean;
  members: Member[];
  onClose: () => void;
  /** Receives member ids in payout order (index 0 = paid first). */
  onConfirm: (orderedUserIds: number[]) => void;
}

/**
 * Same "tap members in the order they should be paid" sheet as the one in
 * ScheduleTab, but it only returns the order. Saving happens in the caller.
 * The overlay is `absolute` so it stays inside the mobile container.
 */
export default function PayoutOrderPicker({ open, members, onClose, onConfirm }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (open) setSelectedIds([]);
  }, [open]);

  if (!open) return null;

  const allPicked = members.length > 0 && selectedIds.length === members.length;

  const toggle = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div
      className="absolute inset-0 z-[110] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Set payout order"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white rounded-t-2xl flex flex-col text-left"
        style={{ maxHeight: "88%" }}
      >
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-2 shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Set payout order</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Tap members in the order they should be paid.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
          {members.map((m) => {
            const pos = selectedIds.indexOf(m.id) + 1;
            const picked = pos > 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={`w-full flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition ${
                  picked ? "border-downy-400 bg-downy-50/40" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold ${
                      picked ? "bg-downy-600 text-white" : "bg-gray-100 text-gray-400"
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

        <div
          className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 pt-3 rounded-b-none"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">
            Payout order · {selectedIds.length}/{members.length}
          </p>
          {selectedIds.length === 0 ? (
            <p className="text-[12px] text-gray-400 mb-3">Nobody selected yet.</p>
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
                    <span className="truncate">{m ? memberLabel(m) : ""}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-[13px] font-semibold text-gray-700 disabled:opacity-40"
            >
              <FiRotateCcw size={13} /> Reset
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedIds)}
              disabled={!allPicked}
              className="flex-1 px-4 py-2.5 rounded-xl bg-downy-600 text-white text-[13px] font-semibold disabled:opacity-40"
            >
              Confirm order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}