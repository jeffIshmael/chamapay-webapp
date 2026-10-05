"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
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
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { withCommas, stripCommas } from "@/utils/amountInputUtils";

type Step =
  | "idle"
  | "initiating"
  | "waiting_for_pin"
  | "processing"
  | "completed"
  | "failed";

const FALLBACK_RATE = 132;
const MIN_KES = 50;
const MAX_KES = 250000;
const KYC_ROUTE = "/Settings/verify";

/**
 * The +254 is fixed on the left, so the field only holds the 9 digits after it.
 * Accepts whatever the user types or pastes and reduces it to those 9 digits:
 *   0712 345 678      -> 712345678   (typed 0 despite the +254)
 *   +254 712 345 678  -> 712345678   (pasted full international number)
 *   254712345678      -> 712345678
 *   2540712345678     -> 712345678   (both prefixes)
 */
const sanitizePhone = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("254")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
};

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
  const router = useRouter();
  const { needsKyc } = useUser();

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
  const processing =
    step === "initiating" ||
    step === "waiting_for_pin" ||
    step === "processing";
  const busy = processing || step === "completed";
  const kesCharged = Math.ceil(kesAmt); // what M-Pesa actually charges (whole shillings)
  const phoneOk = isValidKenyaPhone(phone);
  const amountOk = kesAmt >= MIN_KES && kesAmt <= MAX_KES;
  const canPay = phoneOk && amountOk && !busy && !isLoading;

  const goVerify = () => {
    onClose();
    router.push(KYC_ROUTE);
  };

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
        goalId,
      );
      if (!result.success) {
        if (result.code === "KYC_REQUIRED") {
          setStep("idle");
          showToast(
            result.error || "Verify your identity to increase limits",
            "warning",
          );
          return;
        }
        throw new Error(result.error || "Failed to start M-Pesa payment");
      }

      setStep("waiting_for_pin");
      const code = extractTransactionCode(result);
      if (!code) throw new Error("No transaction code received");
      await pollPretiumPaymentStatus(code, token, (status) => {
        if (status === "pending") setStep("waiting_for_pin");
        else if (["pending_transfer", "processing"].includes(status))
          setStep("processing");
        else if (["completed", "complete"].includes(status))
          setStep("completed");
      });
      setStep("completed");
      showToast(
        `${formatBalance(usdcAmt)} paid to ${chamaName}${
          recipientName ? ` for ${recipientName}` : ""
        }`,
        "success",
      );
      setTimeout(() => onClose(), 1200);
    } catch (e: unknown) {
      setStep("failed");
      const err = e as {
        status?: string;
        details?: { status?: string; message?: string };
        message?: string;
        error?: string;
      };
      // the poller rejects with the server result, so the status can live in details
      const failStatus = err?.status || err?.details?.status;
      const timedOut = failStatus === "timeout";
      showToast(
        failStatus === "cancelled"
          ? "M-Pesa payment was cancelled"
          : timedOut
            ? "Still confirming. Check your balance before trying again."
            : err?.details?.message ||
              err?.message ||
              err?.error ||
              "Payment failed",
        timedOut ? "warning" : "error",
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
              Pay via M-Pesa
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
            disabled={busy || isLoading}
            onClick={() => {
              // M-Pesa KES must be whole shillings (no decimals)
              const kesFull = Math.ceil(remainingAmount * rate);
              setKes(String(kesFull));
              setUsdc(remainingAmount.toFixed(3));
            }}
            className="shrink-0 bg-amber-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            Pay Full
          </button>
        </div>
      )}

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
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(sanitizePhone(e.target.value))}
            placeholder="7XX XXX XXX"
            disabled={busy || isLoading}
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
            Amount ({kesMode ? "KES" : "USDC"})
          </label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setKesMode(true)}
              disabled={busy || isLoading}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                kesMode ? "bg-downy-600 text-white" : "text-gray-500"
              }`}
            >
              KES
            </button>
            <button
              type="button"
              onClick={() => setKesMode(false)}
              disabled={busy || isLoading}
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
          value={withCommas(kesMode ? kes : usdc)}
          onChange={(e) => {
            const raw = stripCommas(e.target.value);
            if (kesMode) onKesChange(raw);
            else onUsdcChange(raw);
          }}
          placeholder={kesMode ? "1000" : "5"}
          disabled={busy || isLoading}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] placeholder:text-gray-400/60 placeholder:font-normal font-bold outline-none focus:ring-2 focus:ring-downy-500"
        />
        <p className="text-[11px] flex justify-end text-gray-500 mt-1">
          {kesMode ? `≈ ${usdc || "0.000"} USDC` : `≈ ${kes || "0.00"} KES`}
        </p>
        <div className="flex justify-between items-center mt-1.5">
          <p className="text-[11px] text-gray-500">
            Min:{" "}
            {kesMode
              ? `${MIN_KES.toLocaleString()} KES`
              : `${(Math.ceil((MIN_KES / rate) * 100) / 100).toFixed(2)} USDC`}
          </p>
          <p className="text-[11px] text-gray-500">
            Max:{" "}
            {kesMode
              ? `${MAX_KES.toLocaleString()} KES`
              : `${(Math.floor((MAX_KES / rate) * 1000) / 1000).toFixed(3)} USDC`}
          </p>
        </div>
        {kesAmt > 0 && (kesAmt < MIN_KES || kesAmt > MAX_KES) && (
          <p className="text-[11px] text-red-600 font-medium mt-1">
            {kesAmt < MIN_KES ? "Below minimum" : "Above maximum"}
          </p>
        )}
      </div>

      {busy ? (
        <div className="bg-white rounded-2xl border border-downy-100 p-5 text-center">
          {step === "completed" ? (
            <>
              <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <FiCheck className="text-emerald-500" size={26} />
              </div>
              <p className="text-[14px] font-bold text-gray-900">
                Payment complete
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                {formatBalance(usdcAmt)} paid to {chamaName}
                {recipientName ? ` for ${recipientName}` : ""}
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
                  `Sending a payment request to ${toKenyaE164(phone)}`}
                {step === "waiting_for_pin" &&
                  "An M-Pesa prompt has been sent. Enter your PIN to approve the payment."}
                {step === "processing" &&
                  "Your payment was received. We're completing it now."}
              </p>
              <div className="mt-4 rounded-xl bg-downy-50 px-3 py-2.5">
                <p className="text-[12px] text-gray-500">Amount</p>
                <p className="text-[15px] font-bold text-gray-900">
                  {kesCharged.toLocaleString("en-KE")}{" "}
                  <span className="text-[12px] font-semibold text-gray-600">
                    KES
                  </span>
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={needsKyc ? goVerify : handlePay}
          disabled={needsKyc ? false : !canPay}
          className={`w-full py-3 rounded-xl text-[13px] font-bold transition-all ${
            needsKyc
              ? "border border-amber-400 bg-amber-50 text-amber-600 shadow-md shadow-amber-600/10"
              : !canPay
                ? "bg-gray-300 text-white"
                : "bg-downy-600 text-white shadow-md shadow-downy-600/25"
          }`}
        >
          {needsKyc ? (
            <span className="inline-flex items-center justify-center gap-1.5 underline underline-offset-2">
              Verify details to pay
            </span>
          ) : isLoading ? (
            "Processing…"
          ) : (
            "Pay with M-Pesa"
          )}
        </button>
      )}
    </div>
  );
}