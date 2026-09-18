"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { contributeToGoal } from "@/lib/goalService";
import { getUserBalance } from "@/lib/walletServices";

export default function GoalDepositModal({
  isOpen,
  onClose,
  onSuccess,
  goalId,
  goalName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  goalId: number;
  goalName: string;
}) {
  const { token } = useAuth();
  const { formatBalance, platformRate } = useFormattedBalance();
  const { currency } = useCurrencyStore();
  const [amount, setAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingBal, setLoadingBal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isKES = currency === "KES" && platformRate > 0;
  const limit = isKES ? walletBalance * platformRate : walletBalance;

  useEffect(() => {
    if (!isOpen || !token || token === "guest") return;
    setLoadingBal(true);
    getUserBalance(token)
      .then((res) => {
        if (res.success && res.balance != null) {
          setWalletBalance(parseFloat(res.balance) || 0);
        }
      })
      .finally(() => setLoadingBal(false));
  }, [isOpen, token]);

  const close = () => {
    if (loading) return;
    setAmount("");
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleDeposit = async () => {
    if (!token || token === "guest") {
      showToast("Please sign in", "warning");
      return;
    }
    const entered = parseFloat(amount);
    if (!entered || entered <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (entered > limit + 0.0001) {
      setError(
        `Not enough wallet balance. Available ${formatBalance(walletBalance)}`
      );
      return;
    }

    const amountUsdc = isKES
      ? (entered / platformRate).toFixed(6)
      : entered.toFixed(6);

    setLoading(true);
    setError("");
    try {
      const res = await contributeToGoal(goalId, amountUsdc, token);
      if (!res.success) {
        throw new Error(res.error || "Deposit failed");
      }
      setSuccess(true);
      showToast("Deposited to goal", "success");
      onSuccess?.();
      setTimeout(close, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="app-modal-layer">
      <div className="app-modal-backdrop" aria-hidden="true" onClick={close} />
      <div className="app-modal-sheet bg-white p-5 pb-8 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold text-gray-900">Deposit</h2>
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
          From wallet{" "}
          <span className="font-bold text-gray-900">
            {loadingBal ? "…" : formatBalance(walletBalance)}
          </span>
        </p>

        {success ? (
          <div className="flex flex-col items-center py-6 text-emerald-600">
            <FiCheck size={36} />
            <p className="mt-2 text-[14px] font-bold">Deposited</p>
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
              onClick={() =>
                setAmount(
                  limit > 0 ? String(Number(limit.toFixed(isKES ? 2 : 3))) : ""
                )
              }
              className="text-[11px] font-bold text-downy-700 mb-3"
            >
              Use max
            </button>

            {error && (
              <p className="text-[12px] text-rose-600 mb-3">{error}</p>
            )}

            <button
              type="button"
              disabled={loading || walletBalance <= 0}
              onClick={() => void handleDeposit()}
              className="w-full py-3 rounded-xl bg-downy-600 text-white text-[13px] font-bold disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                "Deposit to goal"
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2.5 leading-relaxed">
              Guests can also use the pay link without joining as a member.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
