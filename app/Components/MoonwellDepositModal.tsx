"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { depositToMoonwell } from "@/lib/moonwellService";
import { getUserBalance } from "@/lib/walletServices";
import ChamaMpesaPay from "./ChamaMpesaPay";
import { showToast } from "./Toast";

type Method = "" | "account" | "mpesa";

export default function MoonwellDepositModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { token, isGuest } = useAuth();
  const { address } = useSessionAddress();
  const { currency, platformRate } = useCurrencyStore();
  const { formatBalance } = useFormattedBalance();
  const [method, setMethod] = useState<Method>("");
  const [amount, setAmount] = useState("");
  const [walletUsdc, setWalletUsdc] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mpesaLoading, setMpesaLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setMethod("");
      setAmount("");
      setError("");
      setSuccess(false);
      setLoading(false);
      return;
    }
    if (!token || token === "guest" || isGuest) return;
    getUserBalance(token).then((r) => {
      if (r.success && r.balance != null) {
        setWalletUsdc(parseFloat(r.balance) || 0);
      }
    });
  }, [open, token, isGuest]);

  if (!open) return null;

  const entered = parseFloat(amount) || 0;
  const usdcAmount =
    currency === "KES" && platformRate > 0 ? entered / platformRate : entered;
  const tooHigh = usdcAmount > walletUsdc + 1e-9;
  const canSubmit =
    !loading && amount !== "" && entered > 0 && !tooHigh && Boolean(address);

  const displayBalance =
    currency === "KES"
      ? `KSh ${Math.floor(walletUsdc * platformRate).toLocaleString()}`
      : `${walletUsdc.toFixed(3)} USDC`;

  const submitAccount = async () => {
    if (!canSubmit || !token) return;
    setLoading(true);
    setError("");
    try {
      const result = await depositToMoonwell(token, usdcAmount.toString());
      if (!result.success) {
        setError(result.error || "Deposit failed");
        return;
      }
      setSuccess(true);
      showToast("Deposited to Moonwell", "success");
    } catch {
      setError("Failed to process deposit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    setSuccess(false);
    setMethod("");
    setAmount("");
    onSuccess?.();
    onClose();
  };

  return (
    <div className="app-modal-layer">
      <div
        className="app-modal-backdrop"
        onClick={() => !loading && !mpesaLoading && onClose()}
      />
      <div className="app-modal-sheet bg-white max-h-[92%] flex flex-col overflow-hidden pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!method ? (
          <div className="p-4">
            <div className="relative flex items-center justify-center mb-5 min-h-[36px]">
              <button
                type="button"
                onClick={onClose}
                className="absolute left-0 h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <FiArrowLeft size={18} />
              </button>
              <h2 className="text-[17px] font-semibold text-gray-900">Deposit</h2>
            </div>

            <button
              type="button"
              onClick={() => setMethod("account")}
              className="w-full flex items-center justify-between gap-3 py-3.5 px-4 bg-gray-50 rounded-xl mb-2.5 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Image
                  src="/icon.png"
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-full shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-gray-900">
                    From account
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {displayBalance} available
                  </p>
                </div>
              </div>
              <FiArrowRight className="text-gray-400 shrink-0" size={18} />
            </button>

            <button
              type="button"
              onClick={() => setMethod("mpesa")}
              className="w-full flex items-center justify-between gap-3 py-3.5 px-4 bg-gray-50 rounded-xl text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Image
                  src="/static/images/mpesa.png"
                  alt="M-Pesa"
                  width={40}
                  height={40}
                  className="rounded-lg shrink-0"
                />
                <p className="text-[15px] font-medium text-gray-900">
                  From M-Pesa
                </p>
              </div>
              <FiArrowRight className="text-gray-400 shrink-0" size={18} />
            </button>
          </div>
        ) : method === "account" ? (
          <div className="p-4">
            {success ? (
              <div className="text-center py-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-downy-100 flex items-center justify-center mb-4">
                  <FiCheck className="text-emerald-600" size={28} />
                </div>
                <h3 className="text-[18px] font-bold text-gray-900 mb-1">
                  Deposit Successful
                </h3>
                <p className="text-[13px] text-gray-500 mb-5">
                  Supplied {formatBalance(usdcAmount)} to Moonwell
                </p>
                <button
                  type="button"
                  onClick={finish}
                  className="w-full py-3 rounded-xl bg-gray-500 text-white font-bold text-[14px]"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="relative flex items-center justify-center mb-6 min-h-[36px]">
                  <button
                    type="button"
                    onClick={() => setMethod("")}
                    className="absolute left-0 h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center"
                    aria-label="Back"
                  >
                    <FiArrowLeft size={18} />
                  </button>
                  <h2 className="text-[16px] font-semibold text-gray-900">
                    Deposit from account
                  </h2>
                </div>

                <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-2xl px-4 py-4 mb-2">
                  <span className="text-[18px] font-bold text-gray-900">
                    {currency === "KES" ? "KSh" : "USDC"}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) {
                        setAmount(v);
                        setError("");
                      }
                    }}
                    placeholder="0.00"
                    className="text-[2rem] font-bold text-gray-900 bg-transparent border-0 outline-none w-full max-w-[10rem] text-center"
                    autoFocus
                  />
                </div>
                <p className="text-center text-[12px] text-gray-500 mb-2">
                  Balance: {displayBalance}
                </p>
                {(error || tooHigh) && (
                  <p className="text-center text-[12px] text-red-500 mb-3">
                    {error ||
                      `Insufficient balance. You have ${displayBalance} available`}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submitAccount}
                  disabled={!canSubmit}
                  className={`w-full py-3.5 rounded-xl text-[15px] font-bold text-white ${
                    !canSubmit ? "bg-gray-300" : "bg-downy-600"
                  }`}
                >
                  {loading ? "Processing…" : "Deposit"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto">
            <ChamaMpesaPay
              chamaId={0}
              chamaName="Moonwell Save & Earn"
              remainingAmount={0}
              contributionAmount={0}
              isMoonwellDeposit
              onBack={() => setMethod("")}
              onClose={() => {
                onSuccess?.();
                onClose();
              }}
              isLoading={mpesaLoading}
              setIsLoading={setMpesaLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
