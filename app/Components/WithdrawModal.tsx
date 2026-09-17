"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiArrowLeft, FiCheck, FiSmartphone } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import {
  disburseToMobileNumber,
  extractTransactionCode,
  getExchangeRate,
  pollPretiumPaymentStatus,
  validatePhoneNumber,
} from "@/lib/pretiumService";
import { withdrawalToMpesaFee } from "@/lib/transactionFees";
import {
  formatPhoneDisplay,
  isValidKenyaPhone,
  normalizeKenyaPhoneLocal,
} from "@/lib/phoneUtils";

type Step = "idle" | "verifying" | "processing" | "completed" | "failed";

const FALLBACK_RATE = 132;
const MIN_KES = 105;
const MAX_KES = 250000;
const NETWORK = "Safaricom";

export default function WithdrawModal({
  isOpen,
  onClose,
  balance,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onSuccess?: () => void;
}) {
  const { token, isAuthenticated } = useAuth();
  const [phone, setPhone] = useState("");
  const [usdc, setUsdc] = useState("");
  const [kes, setKes] = useState("");
  const [kesMode, setKesMode] = useState(true);
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [step, setStep] = useState<Step>("idle");
  const [showVerify, setShowVerify] = useState(false);
  const [verifiedName, setVerifiedName] = useState("");
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    getExchangeRate("KES").then((res) => {
      const r =
        Number(res?.data?.selling) ||
        Number(res?.data?.rate) ||
        Number(res?.selling) ||
        Number(res?.rate);
      if (r > 0) setRate(r);
    });
  }, [isOpen]);

  const reset = () => {
    setPhone("");
    setUsdc("");
    setKes("");
    setStep("idle");
    setShowVerify(false);
    setVerifiedName("");
    setVerifyError("");
  };

  const close = () => {
    if (step === "processing" || step === "verifying") return;
    reset();
    onClose();
  };

  const onKesChange = (v: string) => {
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    setKes(v);
    const n = parseFloat(v);
    setUsdc(n > 0 && rate > 0 ? (n / rate).toFixed(3) : "");
  };

  const onUsdcChange = (v: string) => {
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    setUsdc(v);
    const n = parseFloat(v);
    setKes(n > 0 && rate > 0 ? (n * rate).toFixed(2) : "");
  };

  const kesAmt = parseFloat(kes) || 0;
  const usdcAmt = parseFloat(usdc) || 0;
  const feeKes = kesAmt > 0 ? withdrawalToMpesaFee(kesAmt) : 0;
  const receiveKes = Math.max(0, kesAmt - feeKes);

  const startWithdraw = async () => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in", "warning");
      return;
    }
    if (usdcAmt <= 0) {
      showToast("Enter an amount", "warning");
      return;
    }
    if (usdcAmt > balance) {
      showToast("Insufficient balance", "warning");
      return;
    }
    if (kesAmt < MIN_KES) {
      showToast(`Minimum withdrawal is ~KES ${MIN_KES}`, "warning");
      return;
    }
    if (kesAmt > MAX_KES) {
      showToast(`Maximum is KES ${MAX_KES.toLocaleString()}`, "warning");
      return;
    }
    if (!isValidKenyaPhone(phone)) {
      showToast("Enter a valid M-Pesa number", "warning");
      return;
    }

    setShowVerify(true);
    setStep("verifying");
    setVerifyError("");
    setVerifiedName("");
    try {
      const local = normalizeKenyaPhoneLocal(phone);
      const result = await validatePhoneNumber(
        "KES",
        "mobile",
        NETWORK,
        `0${local}`,
        token
      );
      if (!result.success) {
        setVerifyError(result.error || "Could not verify number");
        setStep("idle");
        return;
      }
      const details = result.MobileDetails || result.details || {};
      setVerifiedName(details.public_name || details.publicName || "M-Pesa user");
      setStep("idle");
    } catch {
      setVerifyError("Verification failed");
      setStep("idle");
    }
  };

  const confirmWithdraw = async () => {
    if (!token) return;
    setShowVerify(false);
    setStep("processing");
    try {
      const local = normalizeKenyaPhoneLocal(phone);
      const offramp = await disburseToMobileNumber(
        "KES",
        NETWORK,
        `0${local}`,
        kesAmt.toFixed(2),
        usdcAmt.toFixed(3),
        rate.toString(),
        feeKes.toFixed(2),
        token
      );
      if (!offramp.success) {
        throw new Error(offramp.error || "Failed to initiate withdrawal");
      }
      const code = extractTransactionCode(offramp);
      if (!code) throw new Error("No transaction code received");

      await pollPretiumPaymentStatus(code, token, () => {}, 60, 2000);
      setStep("completed");
      showToast(`Withdrew ${usdcAmt.toFixed(3)} USDC to M-Pesa`, "success");
      onSuccess?.();
      setTimeout(() => {
        reset();
        onClose();
      }, 1200);
    } catch (e: unknown) {
      setStep("failed");
      const err = e as { message?: string; error?: string; status?: string };
      showToast(
        err?.status === "timeout"
          ? "Withdrawal timed out — check M-Pesa"
          : err?.message || err?.error || "Withdrawal failed",
        "error"
      );
      setTimeout(() => setStep("idle"), 1500);
    }
  };

  const busy = step === "processing" || step === "verifying";

  return (
    <Dialog open={isOpen} onClose={close} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center">
        <Dialog.Panel className="w-full max-w-[var(--app-max)] max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-downy-50 shadow-xl">
          <div className="sticky top-0 z-10 bg-gradient-to-br from-downy-800 to-emerald-900 text-white px-4 pt-3 pb-4 rounded-t-3xl">
            <div className="flex items-center gap-3 min-h-[40px]">
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <FiArrowLeft size={16} />
              </button>
              <Dialog.Title className="text-[15px] font-bold flex-1 text-center pr-8">
                Withdraw
              </Dialog.Title>
            </div>
            <p className="text-[11px] text-white/75 text-center mt-1">
              Cash out to M-Pesa · balance {balance.toFixed(3)} USDC
            </p>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="flex bg-white rounded-xl p-0.5 border border-downy-100">
              <button
                type="button"
                onClick={() => setKesMode(true)}
                className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold ${
                  kesMode ? "bg-downy-600 text-white" : "bg-transparent text-gray-500"
                }`}
              >
                KES
              </button>
              <button
                type="button"
                onClick={() => setKesMode(false)}
                className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold ${
                  !kesMode ? "bg-downy-600 text-white" : "bg-transparent text-gray-500"
                }`}
              >
                USDC
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                Amount ({kesMode ? "KES" : "USDC"})
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={kesMode ? kes : usdc}
                  onChange={(e) =>
                    kesMode ? onKesChange(e.target.value) : onUsdcChange(e.target.value)
                  }
                  placeholder={kesMode ? "500" : "5"}
                  disabled={busy}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-14 text-[15px] font-bold outline-none focus:ring-2 focus:ring-downy-500"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUsdcChange(balance.toFixed(3))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-downy-700 bg-transparent"
                >
                  Max
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {kesMode
                  ? `≈ ${usdc || "0.000"} USDC`
                  : `≈ ${kes || "0.00"} KES`}
              </p>
            </div>

            {kesAmt > 0 && (
              <div className="bg-white rounded-xl border border-downy-100 px-3 py-2.5 text-[11px] space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Fee</span>
                  <span className="font-semibold">KES {feeKes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold">
                  <span>You receive</span>
                  <span>KES {receiveKes.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                M-Pesa number
              </label>
              <div className="relative">
                <FiSmartphone
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={15}
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  disabled={busy}
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
                />
              </div>
            </div>

            {step === "processing" || step === "completed" ? (
              <div className="bg-white rounded-2xl border border-downy-100 p-3.5 text-center">
                {step === "completed" ? (
                  <FiCheck className="mx-auto text-emerald-500 mb-2" size={28} />
                ) : (
                  <div className="h-8 w-8 mx-auto mb-2 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
                )}
                <p className="text-[13px] font-bold text-gray-900">
                  {step === "processing"
                    ? "Sending to M-Pesa…"
                    : "Withdrawal complete"}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={startWithdraw}
                disabled={busy || !usdc || !phone}
                className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
                  busy || !usdc || !phone
                    ? "bg-gray-300"
                    : "bg-downy-600 shadow-md shadow-downy-600/25"
                }`}
              >
                Continue
              </button>
            )}
          </div>
        </Dialog.Panel>
      </div>

      <Dialog
        open={showVerify}
        onClose={() => {
          if (step === "verifying") return;
          setShowVerify(false);
        }}
        className="relative z-[60]"
      >
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-5">
            <Dialog.Title className="text-[15px] font-bold text-gray-900 mb-2">
              Confirm recipient
            </Dialog.Title>
            {step === "verifying" ? (
              <div className="py-6 flex flex-col items-center">
                <div className="h-8 w-8 rounded-full border-2 border-downy-600 border-t-transparent animate-spin mb-2" />
                <p className="text-[12px] text-gray-500">Verifying number…</p>
              </div>
            ) : verifyError ? (
              <>
                <p className="text-[12px] text-red-600 mb-4">{verifyError}</p>
                <button
                  type="button"
                  onClick={() => setShowVerify(false)}
                  className="w-full py-2.5 rounded-xl bg-gray-100 text-[13px] font-bold text-gray-700"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] text-gray-500 mb-1">
                  {formatPhoneDisplay(phone)}
                </p>
                <p className="text-[14px] font-bold text-gray-900 mb-1">
                  {verifiedName}
                </p>
                <p className="text-[12px] text-gray-600 mb-4">
                  Send{" "}
                  <span className="font-bold">{usdcAmt.toFixed(3)} USDC</span> →
                  receive{" "}
                  <span className="font-bold">KES {receiveKes.toFixed(2)}</span>{" "}
                  (fee KES {feeKes.toFixed(2)})
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVerify(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-[13px] font-bold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmWithdraw}
                    className="flex-1 py-2.5 rounded-xl bg-downy-600 text-[13px] font-bold text-white"
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </Dialog>
  );
}
