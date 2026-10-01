"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiX, FiCheck, FiSmartphone } from "react-icons/fi";
import Image from "next/image";
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
import MpesaConfirmDialog from "./MpesaConfirmDialog";

type Step = "idle" | "verifying" | "processing" | "completed" | "failed";

const FALLBACK_RATE = 132;
const MIN_KES = 150;
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
  const phoneOk = isValidKenyaPhone(phone);
  const amountOk = kesAmt >= MIN_KES && kesAmt <= MAX_KES;
  const canSubmit = !busy && phoneOk && amountOk && Boolean(usdc);
  const blockDismiss = () => {};

  return (
    <Dialog open={isOpen} onClose={blockDismiss} className="relative z-[100]">
      <div className="app-modal-layer !pointer-events-auto">
        <div className="app-modal-backdrop" aria-hidden="true" />
        <Dialog.Panel className="app-modal-sheet bg-downy-50 max-h-[92%] flex flex-col overflow-hidden">
          <div
            className="shrink-0 text-white px-4 pt-3 pb-4 rounded-t-3xl"
            style={{ backgroundColor: "#1a6b6b" }}
          >
            <div className="flex items-center justify-between min-h-[40px]">
              <div className="w-8" />
              <Dialog.Title className="text-[15px] font-bold flex items-center gap-2">
                Withdraw to 
                <Image
                  src="/static/images/mpesa.png"
                  alt="M-Pesa"
                  width={55}
                  height={55}
                  className="rounded-md bg-white px-1"
                />
              </Dialog.Title>
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <p className="text-[12px] text-white/85 font-medium">
                Cash out to your M-Pesa
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
            {/* <p className="text-[12px] text-gray-600 text-center">
              Wallet balance:{" "}
              <span className="font-bold text-gray-900">
                {(balance * rate).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                KES
              </span>
            </p> */}

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                M-Pesa number
              </label>
              <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-downy-500">
                <span className="flex items-center px-3 bg-gray-50 border-r border-gray-200 text-[13px] font-bold text-gray-600">
                  +254
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                  }
                  placeholder="7XX XXX XXX"
                  disabled={busy}
                  className="flex-1 min-w-0 px-3 py-2.5 text-[13px] outline-none"
                />
              </div>
              {phone.length > 0 && !phoneOk && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">
                  Enter a complete M-Pesa number
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-gray-600">
                  Amount (KES)
                </label>
                <span className="text-[10px] font-semibold text-gray-400">
                  1 USDC = {rate.toFixed(2)} KES
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={kes}
                  onChange={(e) => onKesChange(e.target.value)}
                  placeholder="500"
                  disabled={busy}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-14 text-[15px] font-bold outline-none focus:ring-2 focus:ring-downy-500"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onKesChange((balance * rate).toFixed(2))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-downy-700 bg-downy-50 px-2 py-1 rounded-lg"
                >
                  MAX
                </button>
              </div>
              <div className="flex justify-between items-center mt-1.5 gap-2">
                <p className="text-[11px] text-gray-500">
                  Withdrawable bal:   <span className="font-semibold text-gray-700 ">
                    {(balance * rate).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                                    })}{" "}
                  </span> <span className="text-[10px]">KES</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Min: {MIN_KES}
                </p>
                {kesAmt > 0 && (kesAmt < MIN_KES || kesAmt > MAX_KES) && (
                  <p className="text-[11px] text-red-600 font-medium shrink-0">
                    {kesAmt < MIN_KES ? "Below minimum" : "Above maximum"}
                  </p>
                )}
              </div>
            </div>

            {kesAmt > 0 && (
              <div className="bg-white rounded-xl border border-downy-100 px-3 py-2.5 text-[11px] space-y-1">
                <div className="flex justify-between text-amber-600">
                  <span>Fee</span>
                  <span className="font-semibold">KES {feeKes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold">
                  <span>You receive</span>
                  <span>KES {receiveKes.toFixed(2)}</span>
                </div>
              </div>
            )}

            {step === "processing" || step === "completed" ? (
              <div className="bg-white rounded-2xl border border-downy-100 p-5 text-center">
                {step === "completed" ? (
                  <>
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                      <FiCheck className="text-emerald-500" size={26} />
                    </div>
                    <p className="text-[14px] font-bold text-gray-900">
                      Transfer complete
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1">
                      {usdcAmt.toFixed(3)} USDC sent to {verifiedName || formatPhoneDisplay(phone)}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full border-[3px] border-downy-100 border-t-downy-600 animate-spin" />
                    <p className="text-[14px] font-bold text-gray-900">
                      Sending USDC…
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1.5">
                      {verifiedName
                        ? `Sending to ${verifiedName}`
                        : `Sending to ${formatPhoneDisplay(phone)}`}
                    </p>
                    <div className="mt-4 rounded-xl bg-downy-50 px-3 py-2.5">
                      <p className="text-[12px] text-gray-500">Amount</p>
                      <p className="text-[15px] font-bold text-gray-900">
                        {usdcAmt.toFixed(3)} USDC
                      </p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">
                      Please keep this screen open while the transfer is processed.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={startWithdraw}
                disabled={!canSubmit}
                className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
                  !canSubmit
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

      <MpesaConfirmDialog
        open={showVerify}
        onClose={() => {
          if (step === "verifying") return;
          setShowVerify(false);
        }}
        verifying={step === "verifying"}
        error={verifyError || undefined}
        title="Confirm Details"
        subtitle="M-Pesa Cashout Verification"
        recipientName={verifiedName}
        phoneDisplay={formatPhoneDisplay(phone)}
        rows={[
          {
            label: "Amount in KES",
            value: `KES ${kesAmt.toLocaleString("en-KE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          },
          {
            label: "Processing Fee",
            value: `- KES ${feeKes.toFixed(2)}`,
            tone: "fee",
          },
          {
            label: "You Receive",
            value: `KES ${receiveKes.toLocaleString("en-KE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            tone: "emphasis",
          },
          {
            label: "Total USDC Deduction",
            value: `${usdcAmt.toFixed(4)} USDC`,
            tone: "muted",
          },
        ]}
        notice="Funds will be disbursed instantly to the registered mobile line verified above."
        confirmLabel="Confirm Cashout"
        onConfirm={confirmWithdraw}
        confirmDisabled={!verifiedName || Boolean(verifyError)}
      />
    </Dialog>
  );
}
