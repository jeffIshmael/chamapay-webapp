"use client";

import { useEffect, useState } from "react";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { withdrawFromMoonwell } from "@/lib/moonwellService";
import { showToast } from "./Toast";

const DUST = 0.000001;

const round6 = (n: number) =>
  Math.floor((Number.isFinite(n) ? n : 0) * 1e6) / 1e6;

export default function MoonwellWithdrawModal({
  open,
  onClose,
  onSuccess,
  availableBalance,
  earnedUsdc = 0,
  principalUsdc = 0,
  liquidityUsd = null,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  availableBalance: number;
  earnedUsdc?: number;
  principalUsdc?: number;
  liquidityUsd?: number | null;
}) {
  const { token } = useAuth();
  const { currency, platformRate } = useCurrencyStore();
  const { formatBalance } = useFormattedBalance();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [activePreset, setActivePreset] = useState<
    "principal" | "interest" | "all" | null
  >(null);
  const [lockedUsdc, setLockedUsdc] = useState<number | null>(null);
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setError("");
      setSuccess(false);
      setActivePreset(null);
      setLockedUsdc(null);
      setIsMax(false);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const isKES = currency === "KES";
  const display = (usdc: number) =>
    isKES
      ? `KSh ${(Math.ceil(usdc * platformRate * 100) / 100).toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`
      : `${round6(usdc).toFixed(6)} USDC`;

  const toInput = (usdc: number) =>
    isKES
      ? (Math.ceil(usdc * platformRate * 100) / 100).toFixed(2)
      : String(round6(usdc));

  const entered = parseFloat(amount) || 0;
  let usdcAmount =
    lockedUsdc != null
      ? round6(lockedUsdc)
      : round6(
          isMax
            ? availableBalance
            : isKES
              ? entered / (platformRate || 1)
              : entered
        );

  const eps = isKES ? 0.05 / (platformRate || 1) : DUST;
  let tooHigh = false;
  let finalIsMax = isMax;
  if (!finalIsMax) {
    if (usdcAmount > availableBalance + eps) tooHigh = true;
    else if (usdcAmount >= availableBalance - eps) {
      usdcAmount = round6(availableBalance);
      finalIsMax = true;
    }
  } else {
    usdcAmount = round6(availableBalance);
  }

  const canSubmit =
    !loading &&
    usdcAmount > 0 &&
    !tooHigh &&
    (amount !== "" || lockedUsdc != null);

  const applyPreset = (preset: "principal" | "interest" | "all") => {
    setError("");
    setActivePreset(preset);
    if (preset === "all") {
      const u = round6(availableBalance);
      setIsMax(true);
      setLockedUsdc(u);
      setAmount(toInput(u));
      return;
    }
    const raw = preset === "principal" ? principalUsdc : earnedUsdc;
    const capped = Math.min(Math.max(0, raw), availableBalance);
    const u = round6(capped);
    if (u <= 0) {
      setIsMax(false);
      setLockedUsdc(null);
      setAmount("");
      setError(
        preset === "interest"
          ? "No yield available to withdraw yet"
          : "No principal available to withdraw"
      );
      return;
    }
    const nearAll = u >= availableBalance - DUST;
    setIsMax(nearAll);
    setLockedUsdc(nearAll ? round6(availableBalance) : u);
    setAmount(toInput(nearAll ? availableBalance : u));
  };

  const submit = async () => {
    if (!canSubmit || !token) return;
    setLoading(true);
    setError("");
    try {
      const result = await withdrawFromMoonwell(token, String(usdcAmount));
      if (!result.success) {
        setError(result.error || "Failed to withdraw");
        return;
      }
      setSuccess(true);
      showToast("Withdrawn from Moonwell", "success");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    onSuccess?.();
    onClose();
  };

  const tabClass = (p: "principal" | "interest" | "all") =>
    activePreset === p
      ? "bg-blue-600/15 border-blue-400 text-blue-700"
      : "bg-gray-100 border-gray-200 text-gray-700";

  return (
    <div className="app-modal-layer">
      <div
        className="app-modal-backdrop"
        onClick={() => !loading && onClose()}
      />
      <div className="app-modal-sheet bg-white max-h-[92%] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="p-4">
          {success ? (
            <div className="text-center py-6">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <FiCheck className="text-emerald-600" size={28} />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-1">
                Withdrawal Successful
              </h3>
              <p className="text-[13px] text-gray-500 mb-5">
                Withdrew {formatBalance(usdcAmount)} to your wallet
              </p>
              <button
                type="button"
                onClick={finish}
                className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-[14px]"
              >
                Continue
              </button>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-center mb-5 min-h-[36px]">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute left-0 h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center"
                  aria-label="Close"
                >
                  <FiArrowLeft size={18} />
                </button>
                <h2 className="text-[16px] font-semibold text-gray-900">
                  Withdraw from Moonwell
                </h2>
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] text-gray-500 font-medium">
                  Total Balance (Inc. Yield)
                </p>
                <p className="text-[13px] font-bold text-gray-900">
                  {display(availableBalance)}
                </p>
              </div>

              <div className="flex items-center justify-between mb-4 p-3 rounded-lg border border-green-200">
                <p className="text-[12px] text-green-700 font-medium">
                  Total Yield Earned
                </p>
                <p className="text-[13px] font-bold text-green-700">
                  {display(earnedUsdc)}
                </p>
              </div>

              {liquidityUsd != null && liquidityUsd <= 0 ? (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Withdrawals are paused. Borrowers are using the pool’s cash
                    right now. Your money is still safe and earning. Try again
                    when free cash returns.
                  </p>
                </div>
              ) : liquidityUsd != null &&
                availableBalance > 0 &&
                liquidityUsd + 1e-9 < availableBalance ? (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Limited free cash in the pool right now. A full withdrawal
                    may fail. Try a smaller amount, or wait until more cash is
                    free.
                  </p>
                </div>
              ) : liquidityUsd != null && liquidityUsd > 0 ? (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-emerald-800 text-[11px] leading-relaxed">
                    The pool has enough free cash for your balance right now.
                    You can withdraw to your wallet.
                  </p>
                </div>
              ) : null}

              <p className="text-[12px] text-gray-500 font-medium mb-2">
                Amount to Withdraw
              </p>
              <div
                className={`flex items-center border rounded-xl px-3 bg-gray-50 mb-3 ${
                  tooHigh ? "border-red-300 bg-red-50" : "border-gray-200"
                }`}
              >
                <span className="text-gray-500 font-bold mr-2 text-[15px]">
                  {isKES ? "KSh" : "$"}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) {
                      setAmount(v);
                      setIsMax(false);
                      setActivePreset(null);
                      setLockedUsdc(null);
                      setError("");
                    }
                  }}
                  placeholder="0.00"
                  className="flex-1 py-3.5 text-[15px] font-bold text-gray-900 border-0 bg-transparent outline-none"
                />
              </div>

              <div className="flex gap-2 mb-3">
                {(
                  [
                    ["principal", "Principal", principalUsdc <= 0],
                    ["interest", "Interest", earnedUsdc <= DUST],
                    ["all", "All", availableBalance <= 0],
                  ] as const
                ).map(([key, label, disabled]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => applyPreset(key)}
                    className={`flex-1 rounded-lg py-2 text-[11px] font-semibold border ${
                      disabled
                        ? "bg-gray-50 opacity-50 border-gray-200 text-gray-400"
                        : tabClass(key)
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(error || tooHigh) && (
                <p className="text-red-500 text-[11px] mb-3">
                  {error ||
                    `Insufficient balance. You have ${display(availableBalance)} available`}
                </p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className={`w-full py-3.5 rounded-xl text-[15px] font-bold text-white ${
                  !canSubmit ? "bg-blue-300" : "bg-blue-600"
                }`}
              >
                {loading ? "Processing…" : "Confirm Withdraw"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
