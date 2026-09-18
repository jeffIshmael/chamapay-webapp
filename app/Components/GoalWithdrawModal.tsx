"use client";

import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { withdrawFromGoal } from "@/lib/goalService";

export default function GoalWithdrawModal({
  isOpen,
  onClose,
  onSuccess,
  goalId,
  goalName,
  balance,
  maxWithdrawable,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  goalId: number;
  goalName: string;
  balance: number;
  maxWithdrawable: number;
}) {
  const { token } = useAuth();
  const { formatBalance, platformRate } = useFormattedBalance();
  const { currency } = useCurrencyStore();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const available = Math.min(balance, maxWithdrawable > 0 ? maxWithdrawable : balance);
  const isKES = currency === "KES" && platformRate > 0;
  const limit = isKES ? available * platformRate : available;

  const close = () => {
    if (loading) return;
    setAmount("");
    setError("");
    setSuccess(false);
    onClose();
  };

  const runWithdraw = async (mode: "all" | "amount", usdcAmount?: string) => {
    if (!token || token === "guest") {
      showToast("Please sign in", "warning");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await withdrawFromGoal(goalId, token, {
        mode,
        amount: usdcAmount,
      });
      if (!res.success) {
        throw new Error(res.error || "Withdrawal failed");
      }
      setSuccess(true);
      showToast("Withdrawn to your wallet", "success");
      onSuccess?.();
      setTimeout(close, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const entered = parseFloat(amount);
    if (!entered || entered <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (entered > limit + 0.0001) {
      setError(`Insufficient balance. Available ${formatBalance(available)}`);
      return;
    }

    const isWithdrawAll = entered >= limit - 0.01;
    if (isWithdrawAll) {
      await runWithdraw("all");
      return;
    }

    const amountUsdc = isKES
      ? (entered / platformRate).toFixed(6)
      : entered.toString();
    await runWithdraw("amount", amountUsdc);
  };

  if (!isOpen) return null;

  return (
    <div className="app-modal-layer">
      <div className="app-modal-backdrop" aria-hidden="true" onClick={close} />
      <div className="app-modal-sheet bg-white p-5 pb-8 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold text-gray-900">Withdraw</h2>
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <FiX size={16} className="text-gray-500" />
          </button>
        </div>

        <p className="text-[12px] text-gray-500 mb-1 truncate">{goalName}</p>
        <p className="text-[13px] text-gray-700 mb-4">
          Available{" "}
          <span className="font-bold text-gray-900">
            {formatBalance(available)}
          </span>
        </p>

        {success ? (
          <div className="flex flex-col items-center py-6 text-emerald-600">
            <FiCheck size={36} />
            <p className="mt-2 text-[14px] font-bold">Done</p>
          </div>
        ) : (
          <>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Amount
            </label>
            <div className="mt-1.5 flex items-center h-12 rounded-xl border border-gray-200 bg-gray-50 px-3 mb-2">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="0.00"
                className="flex-1 bg-transparent outline-none text-[16px] font-bold text-gray-900"
              />
              <span className="text-[12px] font-bold text-gray-400">
                {isKES ? "KES" : "USDC"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAmount(limit > 0 ? String(Number(limit.toFixed(2))) : "")}
              className="text-[11px] font-bold text-downy-700 mb-3"
            >
              Use max
            </button>

            {error && (
              <p className="text-[12px] text-rose-600 mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || available <= 0}
                onClick={() => void runWithdraw("all")}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-800 disabled:opacity-50"
              >
                Withdraw all
              </button>
              <button
                type="button"
                disabled={loading || available <= 0}
                onClick={() => void handleWithdraw()}
                className="flex-1 py-3 rounded-xl bg-downy-600 text-white text-[13px] font-bold disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  "Withdraw"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
