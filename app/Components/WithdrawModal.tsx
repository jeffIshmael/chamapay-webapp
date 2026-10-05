"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiX, FiCheck } from "react-icons/fi";
import Image from "next/image";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import {
  elementPayOfframp,
  getOfframpQuote,
  getOfframpRate,
  pollPretiumPaymentStatus,
  validatePhoneNumber,
  type OfframpQuote,
} from "@/lib/pretiumService";
import {
  formatPhoneDisplay,
  isValidKenyaPhone,
  normalizeKenyaPhoneLocal,
} from "@/lib/phoneUtils";
import MpesaConfirmDialog from "./MpesaConfirmDialog";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { withCommas, stripCommas } from "@/utils/amountInputUtils";
// adjust this path to wherever you put the hook
import { useOfframpQuote, isQuoteFresh } from "@/hooks/useOfframpQuote";

type Step = "idle" | "verifying" | "processing" | "completed" | "failed";

const MIN_KES = 60;
const MAX_KES = 100000; // top of the fee table
const NETWORK = "Safaricom";
const KYC_ROUTE = "/Settings/verify";

const fmtKes = (n: number) =>
  n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Pulsing placeholder used instead of "…" / "Calculating…" while something loads.
// Pass the size through className, e.g. "h-3 w-20".
const Skeleton = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`inline-block animate-pulse rounded bg-gray-200 align-middle ${className}`}
  />
);

export default function WithdrawModal({
  isOpen,
  onClose,
  balance,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  balance: number; // USDC
  onSuccess?: () => void;
}) {
  const { token, isAuthenticated } = useAuth();
  const [phone, setPhone] = useState("");
  const [kes, setKes] = useState("");
  const [rate, setRate] = useState<number | null>(null); // effective KES per 1 USDC (Element Pay)
  const [rateError, setRateError] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [phase, setPhase] = useState("Starting withdrawal…");
  const [showVerify, setShowVerify] = useState(false);
  const [verifiedName, setVerifiedName] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [receivedKes, setReceivedKes] = useState(0);
  const router = useRouter();
  const { needsKyc } = useUser();

  // live effective rate every time the modal opens
  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    setRate(null);
    setRateError(false);
    getOfframpRate(token).then((res) => {
      if (cancelled) return;
      const r = Number(res?.effectiveRate);
      if (r > 0) setRate(r);
      else setRateError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  const withdrawableKes = rate ? balance * rate : null;
  const kesAmt = parseFloat(kes) || 0;
  const phoneOk = isValidKenyaPhone(phone);
  const phoneLocal = phoneOk ? `0${normalizeKenyaPhoneLocal(phone)}` : "";

  const amountInRange =
    kesAmt >= MIN_KES &&
    kesAmt <= MAX_KES &&
    withdrawableKes !== null &&
    kesAmt <= withdrawableKes;

  // Real Element Pay quote for the typed amount (fee, KES received, USDC deducted).
  // Fires ~700ms after the user stops typing; a changed phone number re-quotes too,
  // because the server only reuses a quote that was made for the same number.
  const {
    quote,
    setQuote,
    loading: quoteLoading,
    error: quoteError,
  } = useOfframpQuote({
    token,
    enabled: isOpen && kesAmt > 0, // never gated by balance or limits: only the button is
    kesAmount: kesAmt,
    phoneLocal,
  });

  const quoteTooBig = !!quote && Number(quote.usdc.gross) > balance;

  const reset = () => {
    setPhone("");
    setKes("");
    setStep("idle");
    setPhase("Starting withdrawal…");
    setShowVerify(false);
    setVerifiedName("");
    setVerifyError("");
    setQuote(null);
    setReceivedKes(0);
  };

  const close = () => {
    if (step === "processing" || step === "verifying") return;
    reset();
    onClose();
  };

  const onKesChange = (v: string) => {
    if (v !== "" && !/^\d*\.?\d{0,2}$/.test(v)) return;
    setKes(v); // the quote hook clears and re-fetches on its own
  };

  const startWithdraw = async () => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in", "warning");
      return;
    }
    if (!rate || withdrawableKes === null) {
      showToast("Rate unavailable. Please try again.", "warning");
      return;
    }
    if (kesAmt < MIN_KES) {
      showToast(`Minimum withdrawal is KES ${MIN_KES}`, "warning");
      return;
    }
    if (kesAmt > MAX_KES) {
      showToast(`Maximum is KES ${MAX_KES.toLocaleString()}`, "warning");
      return;
    }
    if (kesAmt > withdrawableKes) {
      showToast("Insufficient balance", "warning");
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
      const local = `0${normalizeKenyaPhoneLocal(phone)}`;
      // who we are paying (Pretium lookup) + the binding Element Pay quote, in parallel.
      // If the quote already on screen still has time left, reuse it instead of re-quoting.
      const [nameRes, q] = await Promise.all([
        validatePhoneNumber(local, token),
        quote && isQuoteFresh(quote)
          ? Promise.resolve(quote)
          : getOfframpQuote(token, kesAmt.toFixed(2), local),
      ]);
      if (!nameRes.success) {
        setVerifyError(nameRes.error || "Could not verify number");
        setStep("idle");
        return;
      }
      if (!q.success) {
        setVerifyError(q.error || "Could not get a quote. Try again.");
        setStep("idle");
        return;
      }
      if (Number(q.usdc.gross) > balance) {
        setVerifyError("Insufficient balance once fees are included");
        setStep("idle");
        return;
      }
      const details = nameRes.MobileDetails || nameRes.details || {};
      setVerifiedName(details.public_name || details.publicName || "M-Pesa user");
      setQuote(q);
      setStep("idle");
    } catch {
      setVerifyError("Verification failed");
      setStep("idle");
    }
  };

  const confirmWithdraw = async () => {
    if (!token || !quote) return;
    setShowVerify(false);
    setStep("processing");
    setPhase("Starting withdrawal…");
    try {
      const local = `0${normalizeKenyaPhoneLocal(phone)}`;
      const res = await elementPayOfframp(token, {
        kesAmount: kesAmt.toFixed(2),
        phoneNo: local,
        quoteId: quote.quoteId,
        expectedUsdc: quote.usdc.gross,
      });

      if (!res.success) {
        // the quote expired and the new price is noticeably higher: let the user re-confirm
        if (res.code === "RATE_CHANGED" && res.kes && res.usdc) {
          setQuote({ ...res, success: true } as OfframpQuote);
          setStep("idle");
          setShowVerify(true);
          showToast("The rate changed. Please review the new amount.", "warning");
          return;
        }
        throw new Error(res.error || "Failed to start withdrawal");
      }

      setPhase("Sending to M-Pesa…");
      await pollPretiumPaymentStatus(
        res.transactionCode,
        token,
        (status) => {
          if (status === "processing") setPhase("Sending to M-Pesa…");
        },
        90,
        2000,
        "elementpay" // this order lives in Element Pay, whatever the on-ramp flag says
      );

      setReceivedKes(res.kes?.receive ?? quote.kes.receive);
      setStep("completed");
      onSuccess?.();
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        error?: string;
        status?: string;
        details?: { message?: string };
      };
      if (err?.status === "timeout") {
        // Not a failure: the payout is still moving and the server will finish it (webhook, polling
        // fallback, sweeper). Refresh the balance and let the user go instead of showing "failed".
        showToast(
          "Still processing. Your M-Pesa and balance will update shortly.",
          "warning"
        );
        setStep("idle");
        onSuccess?.();
        reset();
        onClose();
        return;
      }
      setStep("failed");
      showToast(
        err?.details?.message ||
          err?.message ||
          err?.error ||
          "Withdrawal failed",
        "error"
      );
      setTimeout(() => setStep("idle"), 1500);
    }
  };

  const goVerify = () => {
    reset();
    onClose();
    router.push(KYC_ROUTE);
  };

  const busy = step === "processing" || step === "verifying";
  // Continue stays disabled until the real quote has arrived and fits the balance
  const canSubmit =
    !busy && phoneOk && amountInRange && !!quote && !quoteTooBig && !quoteLoading;
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
            {step === "completed" ? (
              <div className="bg-white rounded-2xl border border-downy-100 p-5 text-center">
                <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                  <FiCheck className="text-emerald-500" size={26} />
                </div>
                <p className="text-[14px] font-bold text-gray-900">
                  Withdrawal successful
                </p>
                <p className="text-[12px] text-gray-500 mt-1">
                  KES {fmtKes(receivedKes)} sent to{" "}
                  {verifiedName || formatPhoneDisplay(phone)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  className="mt-4 w-full py-3 rounded-xl text-[13px] font-bold text-white bg-downy-600 shadow-md shadow-downy-600/25"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
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
                      {rate ? (
                        `1 USDC = ${rate.toFixed(2)} KES`
                      ) : rateError ? (
                        "Rate unavailable"
                      ) : (
                        <Skeleton className="h-3 w-16" />
                      )}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={withCommas(kes)}
                      onChange={(e) => onKesChange(stripCommas(e.target.value))}
                      placeholder="500"
                      disabled={busy}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-14 text-[15px] placeholder:text-gray-400/60 placeholder:font-normal font-bold outline-none focus:ring-2 focus:ring-downy-500"
                    />
                    <button
                      type="button"
                      disabled={busy || withdrawableKes === null}
                      onClick={() =>
                        withdrawableKes !== null &&
                        onKesChange(
                          String(Math.min(MAX_KES, Math.floor(withdrawableKes)))
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-downy-700 bg-downy-50 px-2 py-1 rounded-lg disabled:opacity-50"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 gap-2">
                    <p className="text-[11px] text-gray-500">
                      Withdrawable bal:{" "}
                      <span className="font-semibold text-gray-700">
                        {withdrawableKes !== null ? (
                          fmtKes(withdrawableKes)
                        ) : rateError ? (
                          "—"
                        ) : (
                          <Skeleton className="h-3 w-10" />
                        )}
                      </span>{" "}
                      <span className="text-[10px]">KES</span>
                    </p>
                    <p className="text-[11px] text-gray-500">Min: {MIN_KES}</p>
                  </div>
                  {kesAmt > 0 &&
                    (kesAmt < MIN_KES ||
                      kesAmt > MAX_KES ||
                      (withdrawableKes !== null && kesAmt > withdrawableKes)) && (
                      <p className="text-[11px] text-red-600 font-medium mt-1">
                        {kesAmt < MIN_KES
                          ? "Below minimum"
                          : kesAmt > MAX_KES
                            ? "Above maximum"
                            : "Exceeds your balance"}
                      </p>
                    )}
                </div>

                {kesAmt > 0 && (
                  <div className="bg-white rounded-xl border border-downy-100 px-3 py-2.5 text-[11px] space-y-1">
                    <div className="flex justify-between text-amber-600">
                      <span>Fee</span>
                      <span className="font-semibold">
                        {quote ? (
                          `KES ${fmtKes(quote.kes.fee)}`
                        ) : quoteLoading ? (
                          <Skeleton className="h-3 w-16" />
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-900 font-bold">
                      <span>You receive</span>
                      <span>
                        {quote ? (
                          `KES ${fmtKes(quote.kes.receive)}`
                        ) : quoteLoading ? (
                          <Skeleton className="h-4 w-24" />
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    {quoteError && (
                      <p className="text-[11px] text-red-600 font-medium">
                        {quoteError}
                      </p>
                    )}
                    {quoteTooBig &&
                      !(withdrawableKes !== null && kesAmt > withdrawableKes) && (
                      <p className="text-[11px] text-red-600 font-medium">
                        Insufficient balance once fees are included
                      </p>
                    )}
                  </div>
                )}

                {step === "processing" ? (
                  <div className="bg-white rounded-2xl border border-downy-100 p-5 text-center">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full border-[3px] border-downy-100 border-t-downy-600 animate-spin" />
                    <p className="text-[14px] font-bold text-gray-900">{phase}</p>
                    <p className="text-[12px] text-gray-500 mt-1.5">
                      {verifiedName
                        ? `Sending to ${verifiedName}`
                        : `Sending to ${formatPhoneDisplay(phone)}`}
                    </p>
                    {quote && (
                      <div className="mt-4 rounded-xl bg-downy-50 px-3 py-2.5">
                        <p className="text-[12px] text-gray-500">You receive</p>
                        <p className="text-[15px] font-bold text-gray-900">
                          KES {fmtKes(quote.kes.receive)}
                        </p>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-3">
                      Please keep this screen open while the transfer is
                      processed.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={needsKyc ? goVerify : startWithdraw}
                    disabled={needsKyc ? false : !canSubmit}
                    className={`w-full py-3 rounded-xl text-[13px] font-bold transition-all ${
                      needsKyc
                        ? "border border-amber-400 bg-amber-50 text-amber-600 shadow-md shadow-amber-600/10"
                        : !canSubmit
                          ? "bg-gray-300 text-white"
                          : "bg-downy-600 text-white shadow-md shadow-downy-600/25"
                    }`}
                  >
                    {needsKyc ? (
                      <span className="inline-flex items-center justify-center gap-1.5 underline underline-offset-2">
                        Verify details to withdraw
                      </span>
                    ) : (
                      "Continue"
                    )}
                  </button>
                )}
              </>
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
        rows={
          quote
            ? [
                {
                  label: "Amount in KES",
                  value: `KES ${fmtKes(quote.kes.amount)}`,
                },
                {
                  label: "Processing Fee",
                  value: `- KES ${fmtKes(quote.kes.fee)}`,
                  tone: "fee",
                },
                {
                  label: "You Receive",
                  value: `KES ${fmtKes(quote.kes.receive)}`,
                  tone: "emphasis",
                },
                {
                  label: "Rate",
                  value: `1 USDC = ${Number(quote.rate).toFixed(2)} KES`,
                  tone: "muted",
                },
                {
                  label: "Total USDC Deduction",
                  value: `${Number(quote.usdc.gross).toFixed(4)} USDC`,
                  tone: "muted",
                },
              ]
            : []
        }
        notice="The amount you receive is locked for this confirmation. You'll see a success message once M-Pesa has been paid."
        confirmLabel="Confirm Cashout"
        onConfirm={confirmWithdraw}
        confirmDisabled={!verifiedName || Boolean(verifyError) || !quote}
      />
    </Dialog>
  );
}