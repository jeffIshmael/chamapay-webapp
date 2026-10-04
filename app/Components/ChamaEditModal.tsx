"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiEdit3, FiUsers, FiX } from "react-icons/fi";
import { Member, PayoutScheduleItem } from "@/utils/typesUtils";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import CycleSelector, {
  CycleValue,
  nextMonthlyOccurrence,
  ordinal,
} from "@/app/Components/CycleSelector";
import PayoutOrderPicker from "./PayoutOrderPicker";

export interface ChamaEditInitial {
  name: string;
  amount: number | string; // USDC
  duration: number | string; // cycle time in days
  payDate: number | string | Date; // next pay / contribution due date
  /** Set when the chama pays on a fixed day of the month (1-28). */
  monthlyDay?: number | null;
}

export interface ChamaEditValues {
  name: string;
  amount: string; // USDC as a string (matches updateChamaDetails)
  duration: number; // days ("30" when paying on a fixed day of the month)
  monthlyDay: number | null; // null unless paying on a fixed day of the month
  payDate: number; // ms timestamp
  /** True when any of name / amount / cycle / pay date changed. */
  detailsChanged: boolean;
  /** Member ids in payout order. Only present when the order was changed. */
  payoutOrder?: number[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Should throw an Error (with a readable message) on failure. */
  onSubmit: (values: ChamaEditValues) => Promise<void>;
  initial: ChamaEditInitial;
  members: Member[];
  payoutSchedule: PayoutScheduleItem[];
  /** Page decides: admin + still in the first round. */
  canEditOrder: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

const toLocalInput = (value: number | string | Date): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const DECIMAL_RE = /^\d*\.?\d*$/;

const truncateAddress = (address: string) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

const memberLabel = (m?: Member) =>
  m ? m.name || truncateAddress(m.smartAddress || m.address || "") : "";

const labelClass = "block text-[11px] font-semibold text-gray-600 mb-1.5 tracking-wide";

const fieldClass = (changed: boolean) =>
  `w-full border rounded-xl px-3 py-2.5 text-[13px] text-gray-900 outline-none transition ${
    changed
      ? "border-emerald-500 bg-emerald-50"
      : "bg-gray-50 border-gray-200 focus:border-downy-500"
  }`;

const sameOrder = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const ChamaEditModal = ({
  open,
  onClose,
  onSubmit,
  initial,
  members,
  payoutSchedule,
  canEditOrder,
}: Props) => {
  const { currency, platformRate } = useCurrencyStore();
  const canUseKES = platformRate > 0;

  const initialForm = useMemo(
    () => ({
      name: initial.name ?? "",
      amount: String(initial.amount ?? ""),
      payDate: toLocalInput(initial.payDate),
    }),
    [initial]
  );

  const initialCycle = useMemo<CycleValue>(
    () =>
      initial.monthlyDay
        ? { mode: "monthly-date", days: "30", day: initial.monthlyDay }
        : { mode: "days", days: String(initial.duration ?? ""), day: null },
    [initial]
  );

  // Current payout order, as member ids.
  const currentOrderIds = useMemo(
    () =>
      (payoutSchedule || [])
        .map(
          (p) =>
            members.find(
              (m) =>
                m.smartAddress?.toLowerCase() === p.userAddress?.toLowerCase() ||
                m.address?.toLowerCase() === p.userAddress?.toLowerCase()
            )?.id
        )
        .filter((id): id is number => id !== undefined),
    [payoutSchedule, members]
  );

  const [form, setForm] = useState(initialForm);
  const [cycle, setCycle] = useState<CycleValue>(initialCycle);
  const [kesMode, setKesMode] = useState(false);
  const [kesAmount, setKesAmount] = useState("");
  const [newOrder, setNewOrder] = useState<number[] | null>(null);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset the form every time the modal is opened.
  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setCycle(initialCycle);
    // Default to KES when the user prefers it (and we have a rate).
    const startInKES = currency === "KES" && canUseKES;
    setKesMode(startInKES);
    setKesAmount(
      canUseKES && initialForm.amount
        ? (parseFloat(initialForm.amount) * platformRate).toFixed(2)
        : ""
    );
    setNewOrder(null);
    setShowOrderPicker(false);
    setError("");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const cycleChanged =
    cycle.mode !== initialCycle.mode ||
    (cycle.mode === "days"
      ? cycle.days !== initialCycle.days
      : cycle.day !== initialCycle.day);

  const changed = {
    name: form.name !== initialForm.name,
    amount: form.amount !== initialForm.amount,
    payDate: form.payDate !== initialForm.payDate,
    cycle: cycleChanged,
  };
  const detailsChanged = Object.values(changed).some(Boolean);
  const orderChanged = newOrder !== null && !sameOrder(newOrder, currentOrderIds);
  const hasChanges = detailsChanged || orderChanged;

  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleUSDCChange = (text: string) => {
    if (!DECIMAL_RE.test(text)) return;
    setField("amount", text);
    setKesAmount(text && canUseKES ? (parseFloat(text) * platformRate).toFixed(2) : "");
  };

  const handleKESChange = (text: string) => {
    if (!DECIMAL_RE.test(text)) return;
    setKesAmount(text);
    setField(
      "amount",
      text && canUseKES
        ? Number((parseFloat(text) / platformRate).toFixed(6)).toString()
        : ""
    );
  };

  const handleCycleChange = (next: CycleValue) => {
    setCycle(next);
    // Picking a day of the month moves the pay date to its next occurrence.
    if (
      next.mode === "monthly-date" &&
      next.day &&
      (next.day !== cycle.day || cycle.mode !== "monthly-date")
    ) {
      const time = form.payDate.split("T")[1] || "00:00";
      setField("payDate", toLocalInput(nextMonthlyOccurrence(next.day, time)));
    }
  };

  const payDateDay = form.payDate ? new Date(form.payDate).getDate() : null;
  // The contract checks the pay day in UTC, so the chosen time must land on that day in UTC too.
  const payDateUtcDay = form.payDate ? new Date(form.payDate).getUTCDate() : null;
  const monthlyLocalMismatch =
    cycle.mode === "monthly-date" && cycle.day !== null && payDateDay !== cycle.day;
  const monthlyUtcMismatch =
    cycle.mode === "monthly-date" &&
    cycle.day !== null &&
    !monthlyLocalMismatch &&
    payDateUtcDay !== cycle.day;
  const monthlyMismatch = monthlyLocalMismatch || monthlyUtcMismatch;

  const handleSubmit = async () => {
    setError("");

    const amountNum = parseFloat(form.amount);
    const duration = Number(cycle.days);
    const payDateMs = new Date(form.payDate).getTime();

    if (!form.name.trim() || !form.amount || !form.payDate) {
      setError("Please fill all fields");
      return;
    }
    if (!(amountNum > 0)) {
      setError("Amount must be greater than 0");
      return;
    }
    if (cycle.mode === "monthly-date") {
      if (!cycle.day) {
        setError("Pick the day of the month for payouts");
        return;
      }
      if (monthlyMismatch) {
        setError(
          monthlyUtcMismatch
            ? "Try a different pay time. At this hour the payout would land on another day (UTC)."
            : `Pay date must fall on the ${ordinal(cycle.day)}`
        );
        return;
      }
    } else if (!Number.isInteger(duration) || duration < 1) {
      setError("Cycle time must be a whole number of days (1 or more)");
      return;
    }
    if (Number.isNaN(payDateMs)) {
      setError("Please choose a valid pay date and time");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        amount: form.amount,
        duration,
        monthlyDay: cycle.mode === "monthly-date" ? cycle.day : null,
        payDate: payDateMs,
        detailsChanged,
        payoutOrder: orderChanged ? (newOrder as number[]) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update chama");
      setSaving(false);
    }
    // On success the parent closes the modal, so no need to reset `saving`.
  };

  const orderToShow = newOrder ?? currentOrderIds;

  return (
    <>
      {/* `absolute` (not `fixed`) so the sheet stays inside the mobile container
          and sits at its bottom edge. */}
      <div
        className="absolute inset-0 z-[100] flex items-end justify-center bg-black/50"
        onClick={() => !saving && onClose()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit chama details"
      >
        <div
          className="bg-white w-full rounded-t-3xl flex flex-col"
          style={{ maxHeight: "88%" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="text-[17px] font-bold text-gray-900">Edit Details</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Update chama settings</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-700"
            >
              <FiX size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
            {error && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-3 py-2.5 rounded-xl mb-4 text-[12px]"
                role="alert"
              >
                <FiAlertTriangle className="inline mr-2" />
                {error}
              </div>
            )}

            {/* Name */}
            <label className={labelClass}>Chama name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. My Awesome Chama"
              className={`${fieldClass(changed.name)} mb-4`}
            />

            {/* Amount with KES / USDC switch */}
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-gray-600 tracking-wide">
                Contribution
              </label>
              {canUseKES && (
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setKesMode(true)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                    }`}
                  >
                    KES
                  </button>
                  <button
                    type="button"
                    onClick={() => setKesMode(false)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      !kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                    }`}
                  >
                    USDC
                  </button>
                </div>
              )}
            </div>
            <div
              className={`border rounded-xl flex items-center overflow-hidden mb-4 ${
                changed.amount
                  ? "border-emerald-500 bg-emerald-50"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <span className="px-3 py-2.5 bg-gray-100/70 border-r border-gray-200 text-[12px] font-bold text-gray-600">
                {kesMode && canUseKES ? "KES" : "USDC"}
              </span>
              <input
                inputMode="decimal"
                value={kesMode && canUseKES ? kesAmount : form.amount}
                onChange={(e) =>
                  kesMode && canUseKES
                    ? handleKESChange(e.target.value)
                    : handleUSDCChange(e.target.value)
                }
                placeholder={kesMode ? "e.g. 500" : "e.g. 5"}
                className="flex-1 bg-transparent px-3 py-2.5 text-[13px] font-semibold text-gray-900 outline-none"
              />
            </div>

            {/* Cycle time */}
            <label className={labelClass}>Cycle time</label>
            <div
              className={`rounded-xl mb-4 ${
                changed.cycle ? "ring-1 ring-emerald-500 p-1.5 bg-emerald-50/40" : ""
              }`}
            >
              <CycleSelector value={cycle} onChange={handleCycleChange} />
            </div>

            {/* Pay date */}
            <label className={labelClass}>Pay date &amp; time</label>
            <input
              type="datetime-local"
              value={form.payDate}
              onChange={(e) => setField("payDate", e.target.value)}
              className={`${fieldClass(changed.payDate)} [color-scheme:light] ${
                cycle.mode === "monthly-date" ? "mb-1.5" : "mb-4"
              }`}
            />
            {cycle.mode === "monthly-date" && cycle.day !== null && (
              <p
                className={`text-[11px] mb-4 ${
                  monthlyMismatch ? "text-red-500" : "text-downy-700"
                }`}
              >
                {monthlyUtcMismatch
                  ? "Try a different pay time. At this hour the payout would land on another day (UTC)."
                  : monthlyMismatch
                    ? `Pay date must fall on the ${ordinal(cycle.day)}.`
                    : `Payouts happen on the ${ordinal(cycle.day)} of every month.`}
              </p>
            )}

            {/* Payout order: admin + first round only */}
            {canEditOrder && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-gray-600 tracking-wide">
                    Payout order
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOrderPicker(true)}
                    className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 text-emerald-700 text-[10px] font-bold"
                  >
                    <FiUsers size={11} />
                    {orderToShow.length > 0 ? "Edit order" : "Set order"}
                  </button>
                </div>
                <div
                  className={`rounded-xl border p-2.5 ${
                    orderChanged
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  {orderToShow.length === 0 ? (
                    <p className="text-[12px] text-gray-500">
                      No order set yet. It will be drawn randomly unless you set it
                      here.
                    </p>
                  ) : (
                    <ol className="max-h-28 overflow-y-auto grid grid-cols-2 gap-x-3 gap-y-1">
                      {orderToShow.map((id, i) => (
                        <li
                          key={id}
                          className="flex items-center gap-1 text-[12px] text-gray-800 min-w-0"
                        >
                          <span className="w-4 shrink-0 text-right font-bold text-downy-600">
                            {i + 1}.
                          </span>
                          <span className="truncate">
                            {memberLabel(members.find((m) => m.id === id))}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {orderChanged && (
                    <p className="text-[10px] text-emerald-700 mt-2">
                      New order. It is saved when you tap Save Changes.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 pt-3 border-t border-gray-100 bg-white shrink-0"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasChanges || saving}
              className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[14px] transition ${
                hasChanges && !saving
                  ? "bg-downy-700 text-white"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <FiEdit3 size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <PayoutOrderPicker
        open={showOrderPicker}
        members={members}
        onClose={() => setShowOrderPicker(false)}
        onConfirm={(ids) => {
          setNewOrder(ids);
          setShowOrderPicker(false);
        }}
      />
    </>
  );
};

export default ChamaEditModal;