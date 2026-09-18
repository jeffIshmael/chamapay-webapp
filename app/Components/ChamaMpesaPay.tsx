"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiCheck, FiSmartphone } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import {
  getExchangeRate,
  pollPretiumPaymentStatus,
  pretiumOnramp,
  extractTransactionCode,
} from "@/lib/pretiumService";
import { isValidKenyaPhone, toKenyaE164 } from "@/lib/phoneUtils";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { useFormattedBalance } from "@/lib/useFormattedBalance";

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

export default function ChamaMpesaPay({
  chamaId,
  chamaName,
  remainingAmount = 0,
  contributionAmount = 0,
  memberForId,
  recipientName,
  onBack,
  onClose,
  isLoading,
  setIsLoading,
  isMoonwellDeposit = false,
  goalId,
}: {
  chamaId: number;
  chamaName: string;
  remainingAmount?: number;
  contributionAmount?: number;
  memberForId?: number;
  recipientName?: string;
  onBack: () => void;
  onClose: () => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  isMoonwellDeposit?: boolean;
  /** When set, Pretium credits this Save-for-Goal pool after release */
  goalId?: number;
}) {
  const { token, isAuthenticated } = useAuth();
  const { currency, platformRate: storeRate } = useCurrencyStore();
  const { formatBalance } = useFormattedBalance();
  const [phone, setPhone] = useState("");
  const [kes, setKes] = useState("");
  const [usdc, setUsdc] = useState("");
  const [kesMode, setKesMode] = useState(currency === "KES");
  const [rate, setRate] = useState(storeRate > 0 ? storeRate : FALLBACK_RATE);
  const [step, setStep] = useState<Step>("idle");

  useEffect(() => {
    getExchangeRate("KES").then((res) => {
      const r =
        Number(res?.data?.buying) ||
        Number(res?.data?.rate) ||
        Number(res?.buying) ||
        Number(res?.rate) ||
        storeRate;
      if (r > 0) setRate(r);
    });
  }, [storeRate]);

  useEffect(() => {
    setKesMode(currency === "KES");
  }, [currency]);

  // Do not auto-fill remaining / contribution — only Pay Full fills the amount.

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
    // M-Pesa KES is always whole shillings
    setKes(n > 0 && rate > 0 ? String(Math.ceil(n * rate)) : "");
  };

  const kesAmt = parseFloat(kes) || 0;
  const usdcAmt = parseFloat(usdc) || 0;
  const busy = step !== "idle" && step !== "failed" && step !== "completed";
  const phoneOk = isValidKenyaPhone(phone);
  const amountOk = kesAmt >= MIN_KES && kesAmt <= MAX_KES;
  const canPay = phoneOk && amountOk && !busy && !isLoading;

  const handlePay = async () => {
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
      showToast(`Minimum is KES ${MIN_KES}`, "warning");
      return;
    }
    if (kesAmt > MAX_KES) {
      showToast(`Maximum is KES ${MAX_KES.toLocaleString()}`, "warning");
      return;
    }

    setIsLoading(true);
    setStep("initiating");
    try {
      const kesWhole = Math.ceil(kesAmt);
      const result = await pretiumOnramp(
        toKenyaE164(phone),
        kesWhole,
        rate,
        usdcAmt,
        isMoonwellDeposit || Boolean(goalId) ? true : false,
        token,
        isMoonwellDeposit || goalId ? undefined : chamaId,
        memberForId,
        isMoonwellDeposit,
        goalId
      );
      if (!result.success) {
        if (result.code === "KYC_REQUIRED") {
          setStep("idle");
          showToast(
            result.error || "Verify your identity to increase limits",
            "warning"
          );
          return;
        }
        throw new Error(result.error || "Failed to start M-Pesa payment");
      }

      setStep("waiting_for_pin");
      const code = extractTransactionCode(result);
      if (!code) throw new Error("No transaction code received");
      await pollPretiumPaymentStatus(
        code,
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
      showToast(
        `${formatBalance(usdcAmt)} paid to ${chamaName}${
          recipientName ? ` for ${recipientName}` : ""
        }`,
        "success"
      );
      setTimeout(() => onClose(), 1000);
    } catch (e: unknown) {
      setStep("failed");
      const err = e as { status?: string; message?: string; error?: string };
      showToast(
        err?.status === "cancelled"
          ? "M-Pesa payment was cancelled"
          : err?.status === "timeout"
            ? "Payment timed out — try again"
            : err?.message || err?.error || "Payment failed",
        "error"
      );
      setTimeout(() => setStep("idle"), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={onBack}
          disabled={busy || isLoading}
          className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
          aria-label="Back"
        >
          <FiArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image
            src="/static/images/mpesa.png"
            alt="M-Pesa"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-gray-800">
              Pay with M-Pesa
            </h3>
            <p className="text-[11px] text-gray-500 truncate">
              {recipientName ? `For ${recipientName}` : chamaName}
            </p>
          </div>
        </div>
      </div>

      {remainingAmount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-800 mb-0.5">
              Contribution Due
            </p>
            <p className="text-[13px] font-bold text-amber-900">
              {currency === "KES"
                ? `${Math.ceil(remainingAmount * rate).toLocaleString()} KES remaining`
                : `${remainingAmount.toFixed(3)} USDC remaining`}
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              ≈{" "}
              {currency === "KES"
                ? `${remainingAmount.toFixed(3)} USDC`
                : `${Math.ceil(remainingAmount * rate).toLocaleString()} KES`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              // M-Pesa KES must be whole shillings (no decimals)
              const kesFull = Math.ceil(remainingAmount * rate);
              setKes(String(kesFull));
              setUsdc(remainingAmount.toFixed(3));
            }}
            className="shrink-0 bg-amber-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg"
          >
            Pay Full
          </button>
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
            disabled={busy || isLoading}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
          />
        </div>
        {phone.length > 0 && !phoneOk && (
          <p className="text-[11px] text-red-600 mt-1 font-medium">
            Enter a complete M-Pesa number (e.g. 0712 345 678)
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-gray-600">
            Amount ({kesMode ? "KES" : "USDC"})
          </label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setKesMode(true)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                kesMode ? "bg-downy-600 text-white" : "text-gray-500"
              }`}
            >
              KES
            </button>
            <button
              type="button"
              onClick={() => setKesMode(false)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                !kesMode ? "bg-downy-600 text-white" : "text-gray-500"
              }`}
            >
              USDC
            </button>
          </div>
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={kesMode ? kes : usdc}
          onChange={(e) =>
            kesMode ? onKesChange(e.target.value) : onUsdcChange(e.target.value)
          }
          placeholder={kesMode ? "1000" : "5"}
          disabled={busy || isLoading}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] font-bold outline-none focus:ring-2 focus:ring-downy-500"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          {kesMode
            ? `≈ ${usdc || "0.000"} USDC`
            : `≈ ${kes || "0.00"} KES`}
          {" · "}1 USDC = {rate} KES
        </p>
        <div className="flex justify-between items-center mt-1 gap-2">
          <p className="text-[11px] text-gray-500">
            Min{" "}
            {kesMode
              ? `${MIN_KES.toLocaleString()} KES`
              : `${(Math.ceil((MIN_KES / rate) * 100) / 100).toFixed(2)} USDC`}
            {" · "}Max{" "}
            {kesMode
              ? `${MAX_KES.toLocaleString()} KES`
              : `${(Math.floor((MAX_KES / rate) * 1000) / 1000).toFixed(3)} USDC`}
          </p>
          {kesAmt > 0 && (kesAmt < MIN_KES || kesAmt > MAX_KES) && (
            <p className="text-[11px] text-red-600 font-medium shrink-0">
              {kesAmt < MIN_KES ? "Below minimum" : "Above maximum"}
            </p>
          )}
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
            {step === "completed" && "Payment complete"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={!canPay}
        className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
          !canPay
            ? "bg-gray-300"
            : "bg-downy-600 shadow-md shadow-downy-600/25"
        }`}
      >
        {busy || isLoading ? "Processing…" : "Pay with M-Pesa"}
      </button>
    </div>
  );
}
