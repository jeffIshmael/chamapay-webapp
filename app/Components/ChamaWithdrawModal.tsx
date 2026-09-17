"use client";

import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { serverUrl } from "@/lib/serverUrl";

export default function ChamaWithdrawModal({
  isOpen,
  onClose,
  onSuccess,
  chamaId,
  chamaName,
  balance,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  chamaId: number;
  chamaName: string;
  balance: number;
}) {
  const { token } = useAuth();
  const { formatBalance, platformRate } = useFormattedBalance();
  const { currency } = useCurrencyStore();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isKES = currency === "KES" && platformRate > 0;
  const limit = isKES ? balance * platformRate : balance;

  const close = () => {
    if (loading) return;
    setAmount("");
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleWithdraw = async () => {
    if (!token) {
      showToast("Please sign in", "warning");
      return;
    }
    const entered = parseFloat(amount);
    if (!entered || entered <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (entered > limit + 0.0001) {
      setError(`Insufficient balance. Available ${formatBalance(balance)}`);
      return;
    }

    const isWithdrawAll = entered >= limit - 0.01;
    const amountUsdc = isWithdrawAll
      ? balance.toString()
      : isKES
        ? (entered / platformRate).toFixed(6)
        : entered.toString();

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${serverUrl}/chama/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chamaId, amount: amountUsdc }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || "Withdrawal failed");
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

  if (!isOpen) return null;

  return (
    <div className="app-modal-layer">
      <div className="app-modal-backdrop" aria-hidden="true" />
      <div className="app-modal-sheet bg-white p-5 pb-8 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold text-gray-900">
            Withdraw from {chamaName}
          </h2>
          <button
            type="button"
            onClick={close}
            className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <FiCheck className="text-emerald-600" size={28} />
            </div>
            <p className="font-semibold text-gray-900">Withdrawal successful</p>
            <p className="text-[12px] text-gray-500 mt-1">
              Funds are in your wallet
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-gray-500 mb-3">
              Available:{" "}
              <span className="font-semibold text-gray-800">
                {formatBalance(balance)}
              </span>
            </p>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
              Amount ({isKES ? "KES" : "USDC"})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
              }}
              placeholder="0.00"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-[14px] font-semibold mb-2"
            />
            <button
              type="button"
              onClick={() =>
                setAmount(
                  isKES
                    ? (balance * platformRate).toFixed(2)
                    : balance.toFixed(3)
                )
              }
              className="text-[11px] font-semibold text-downy-700 mb-3"
            >
              Withdraw all
            </button>
            {error && (
              <p className="text-[12px] text-red-600 mb-2 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={loading || !amount}
              onClick={handleWithdraw}
              className="w-full py-3 rounded-xl bg-downy-600 text-white font-bold text-[13px] disabled:opacity-50"
            >
              {loading ? "Withdrawing…" : "Withdraw to wallet"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
