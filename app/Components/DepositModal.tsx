"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiArrowLeft, FiCheck, FiSmartphone } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import {
  getExchangeRate,
  pollPretiumPaymentStatus,
  pretiumOnramp,
} from "@/lib/pretiumService";
import { isValidKenyaPhone, toKenyaE164 } from "@/lib/phoneUtils";

type Step =
  | "idle"
  | "initiating"
  | "waiting_for_pin"
  | "processing"
  | "completed"
  | "failed";

const FALLBACK_RATE = 132;
const MIN_KES = 100;
const MAX_KES = 250000;
const PRESETS = [5, 10, 20, 50];

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
  const [usdc, setUsdc] = useState("");
  const [kes, setKes] = useState("");
  const [kesMode, setKesMode] = useState(true);
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [step, setStep] = useState<Step>("idle");

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
    setUsdc("");
    setKes("");
    setStep("idle");
  };

  const close = () => {
    if (step !== "idle" && step !== "completed" && step !== "failed") return;
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

  const handleDeposit = async () => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in", "warning");
      return;
    }
    const kesAmt = parseFloat(kes);
    const usdcAmt = parseFloat(usdc);
    if (!kesAmt || !usdcAmt) {
      showToast("Enter an amount", "warning");
      return;
    }
    if (!isValidKenyaPhone(phone)) {
      showToast("Enter a valid M-Pesa number", "warning");
      return;
    }
    if (kesAmt < MIN_KES) {
      showToast(`Minimum deposit is ~KES ${MIN_KES}`, "warning");
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
        Number(kesAmt.toFixed(2)),
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
      showToast(`Deposited ${usdcAmt.toFixed(3)} USDC`, "success");
      onSuccess?.();
      setTimeout(() => {
        reset();
        onClose();
      }, 1200);
    } catch (e: unknown) {
      setStep("failed");
      const err = e as { status?: string; details?: { message?: string }; message?: string; error?: string };
      const msg =
        err?.status === "cancelled"
          ? "M-Pesa payment was cancelled"
          : err?.status === "timeout"
            ? "Payment timed out — try again"
            : err?.details?.message || err?.message || err?.error || "Deposit failed";
      showToast(msg, "error");
      setTimeout(() => setStep("idle"), 1500);
    }
  };

  const busy = step !== "idle" && step !== "failed";

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
                Deposit
              </Dialog.Title>
            </div>
            <p className="text-[11px] text-white/75 text-center mt-1">
              Add USDC via M-Pesa · rate ~{rate.toFixed(2)} KES
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
              <input
                type="text"
                inputMode="decimal"
                value={kesMode ? kes : usdc}
                onChange={(e) =>
                  kesMode ? onKesChange(e.target.value) : onUsdcChange(e.target.value)
                }
                placeholder={kesMode ? "1000" : "5"}
                disabled={busy}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] font-bold outline-none focus:ring-2 focus:ring-downy-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {kesMode
                  ? `≈ ${usdc || "0.000"} USDC`
                  : `≈ ${kes || "0.00"} KES`}
              </p>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => onUsdcChange(String(p))}
                  className="px-2.5 py-1 rounded-full bg-white border border-downy-100 text-[11px] font-bold text-downy-800"
                >
                  {p} USDC
                </button>
              ))}
            </div>

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

            {step !== "idle" && step !== "failed" && (
              <div className="bg-white rounded-2xl border border-downy-100 p-3.5 text-center">
                {step === "completed" ? (
                  <FiCheck className="mx-auto text-emerald-500 mb-2" size={28} />
                ) : (
                  <div className="h-8 w-8 mx-auto mb-2 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
                )}
                <p className="text-[13px] font-bold text-gray-900">
                  {step === "initiating" && "Starting M-Pesa…"}
                  {step === "waiting_for_pin" && "Enter PIN on your phone"}
                  {step === "processing" && "Confirming payment…"}
                  {step === "completed" && "Deposit complete"}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleDeposit}
              disabled={busy || !usdc || !phone}
              className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
                busy || !usdc || !phone
                  ? "bg-gray-300"
                  : "bg-downy-600 shadow-md shadow-downy-600/25"
              }`}
            >
              {busy ? "Processing…" : "Deposit with M-Pesa"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
