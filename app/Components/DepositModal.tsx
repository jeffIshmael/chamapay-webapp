"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiX, FiCheck } from "react-icons/fi";
import Image from "next/image";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import {
  getExchangeRate,
  pollPretiumPaymentStatus,
  pretiumOnramp,
} from "@/lib/pretiumService";
import {
  isValidKenyaPhone,
  toKenyaE164,
} from "@/lib/phoneUtils";
import { useCurrencyStore } from "@/store/useCurrencyStore";

type Step =
  | "idle"
  | "verifying"
  | "initiating"
  | "waiting_for_pin"
  | "processing"
  | "completed"
  | "failed";

const FALLBACK_RATE = 132;
const MIN_KES = 150;
const MAX_KES = 250000;
const PRESETS_KES = [150, 500, 1000, 2000, 5000];
const NETWORK = "Safaricom";

export default function DepositModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { token, isAuthenticated } = useAuth();
  const [phone, setPhone] = useState("");
  const [kes, setKes] = useState("");
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [step, setStep] = useState<Step>("idle");
  const {currency} = useCurrencyStore();

  useEffect(() => {
    if (!isOpen) return;
    getExchangeRate("KES").then((res) => {
      const r =
        Number(res?.data?.buying) ||
        Number(res?.data?.rate) ||
        Number(res?.buying) ||
        Number(res?.rate);
      if (r > 0) setRate(r);
    });
  }, [isOpen]);

  const reset = () => {
    setPhone("");
    setKes("");
    setStep("idle");
  };

  const onKesChange = (v: string): void => {
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    setKes(v);
  };

  const kesAmt = parseFloat(kes) || 0;
  const usdcAmt = kesAmt > 0 && rate > 0 ? kesAmt / rate : 0;
  const processing =
    step === "initiating" ||
    step === "waiting_for_pin" ||
    step === "processing";
  const busy = processing || step === "verifying" || step === "completed";
  const phoneOk = isValidKenyaPhone(phone);
  const amountOk = kesAmt >= MIN_KES && kesAmt <= MAX_KES;
  const canSubmit = !busy && phoneOk && amountOk;

  const startDeposit = async () => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in", "warning");
      return;
    }
    if (!kesAmt || !usdcAmt) {
      showToast("Enter an amount", "warning");
      return;
    }
    if (!isValidKenyaPhone(phone)) {
      showToast("Enter a valid M-Pesa number", "warning");
      return;
    }
    if (kesAmt < MIN_KES) {
      showToast(`Minimum deposit is KES ${MIN_KES}`, "warning");
      return;
    }
    if (kesAmt > MAX_KES) {
      showToast(`Maximum deposit is KES ${MAX_KES.toLocaleString()}`, "warning");
      return;
    }

    setStep("initiating");
    try {
      const result = await pretiumOnramp(
        toKenyaE164(phone),
        Math.ceil(kesAmt),
        rate,
        usdcAmt,
        true,
        token
      );

      if (!result.success) {
        if (result.code === "KYC_REQUIRED") {
          setStep("idle");
          showToast(
            result.error || "Verify your identity to increase deposit limits",
            "warning"
          );
          return;
        }
        throw new Error(result.error || "Failed to initiate M-Pesa payment");
      }

      setStep("waiting_for_pin");
      await pollPretiumPaymentStatus(
        result.transactionCode,
        token,
        (status) => {
          if (status === "pending") setStep("waiting_for_pin");
          else if (["pending_transfer", "processing"].includes(status))
            setStep("processing");
          else if (["completed", "complete"].includes(status))
            setStep("completed");
        }
      );
      setStep("completed");
      showToast(`Deposited KES ${kesAmt.toLocaleString()}`, "success");
      onSuccess?.();
      setTimeout(() => {
        reset();
        onClose();
      }, 1200);
    } catch (e: unknown) {
      setStep("failed");
      const err = e as {
        status?: string;
        details?: { message?: string };
        message?: string;
        error?: string;
      };
      const msg =
        err?.status === "cancelled"
          ? "M-Pesa payment was cancelled"
          : err?.status === "timeout"
            ? "Payment timed out — try again"
            : err?.details?.message ||
              err?.message ||
              err?.error ||
              "Deposit failed";
      showToast(msg, "error");
      setTimeout(() => setStep("idle"), 1500);
    }
  };

  const close = () =>{
    if (processing) {
      showToast("Please wait for the deposit to complete", "warning");
      return;
    }
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-[100]">
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
                Deposit via 
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
                Top up your wallet via M-Pesa
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
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

              <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                <span className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 text-[12px] font-bold text-gray-600">
                  KES
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kes}
                  onChange={(e) => onKesChange(e.target.value)}
                  placeholder="1,000"
                  disabled={busy}
                  className="flex-1 px-3 py-2.5 text-[15px] font-bold outline-none border-0"
                />
              </div>

              <div className="flex justify-between items-center mt-1.5">
                <p className="text-[11px] text-gray-500">
                  Min: {MIN_KES.toLocaleString()} KES
                </p>
                <p className="text-[11px] text-gray-500">
                Max: {MAX_KES.toLocaleString()} KES
                </p>
              </div>

              {kesAmt > 0 && (kesAmt < MIN_KES || kesAmt > MAX_KES) && (
                <p className="text-[11px] text-red-600 font-medium mt-1">
                  {kesAmt < MIN_KES ? "Below minimum" : "Above maximum"}
                </p>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap justify-end">
              {PRESETS_KES.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => onKesChange(String(p))}
                  className="px-2.5 py-1 rounded-full bg-white border border-downy-100 text-[11px] font-bold text-downy-800"
                >
                  {p.toLocaleString()} KES
                </button>
              ))}
            </div>

            {kesAmt > 0 && amountOk && (
              <div className="bg-white rounded-xl border border-downy-100 px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-gray-900">
                  <span className="font-bold text-[13px]" >Total deposit</span>
                  <div className="flex flex-col items-end gap-1">
                  <span className="font-bold">
                    KES{" "}
                    {kesAmt.toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="font-small text-gray-500 text-[10px]">
                    = {" "}
                    {usdcAmt.toFixed(3)}
                    <span className="text-gray-500"> USDC</span>
                  </span>
                  </div>
                 
                </div>
                {/* <div className="flex justify-between text-gray-900 font-bold">
                  <span>You receive</span>
                  <span>{usdcAmt.toFixed(3)} USDC</span>
                </div> */}
              </div>
            )}

            {processing || step === "completed" ? (
              <div className="bg-white rounded-2xl border border-downy-100 p-5 text-center">
                {step === "completed" ? (
                  <>
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                      <FiCheck className="text-emerald-500" size={26} />
                    </div>
                    <p className="text-[14px] font-bold text-gray-900">
                      Deposit complete
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1">
                      {
                        currency === "KES" ? + kesAmt + "Kes" : + usdcAmt.toFixed(3) + "USDC"
                      }
                       added to your wallet
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 mx-auto mb-2 rounded-full border-[3px] border-downy-100 border-t-downy-600 animate-spin" />
                    <p className="text-[14px] font-bold text-gray-900">
                      {step === "initiating" && "Sending M-Pesa prompt…"}
                      {step === "waiting_for_pin" && "Check your phone"}
                      {step === "processing" && "Confirming payment…"}
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1.5">
                      {step === "initiating" &&
                        `Sending a payment request to +254 ${phone}`}
                      {step === "waiting_for_pin" &&
                        "An M-Pesa prompt has been sent. Enter your PIN to approve the payment."}
                      {step === "processing" &&
                        "Your payment was received. We're crediting your balance."}
                    </p>
                    <div className="mt-4 rounded-xl bg-downy-50 px-3 py-2.5">
                      <p className="text-[12px] text-gray-500">Amount</p>
                      <p className="text-[15px] font-bold text-gray-900">
                        {kesAmt.toLocaleString("en-KE")} <span className="text-[12px] font-semibold text-gray-600">KES</span> 
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={startDeposit}
                disabled={!canSubmit}
                className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
                  !canSubmit
                    ? "bg-gray-300"
                    : "bg-downy-600 shadow-md shadow-downy-600/25"
                }`}
              >
                Deposit
              </button>
            )}
          </div>
        </Dialog.Panel>
      </div>

    </Dialog>
  );
}
