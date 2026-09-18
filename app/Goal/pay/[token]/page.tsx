"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FiCheck, FiSmartphone, FiTarget } from "react-icons/fi";
import {
  getGoalPayStatus,
  getPublicGoalByPayToken,
  initiateGoalPayOnramp,
  PublicGoalPreview,
  goalTypeLabel,
} from "@/lib/goalService";
import {
  getExchangeRate,
} from "@/lib/pretiumService";
import { isValidKenyaPhone, normalizeKenyaPhoneLocal } from "@/lib/phoneUtils";
import { showToast } from "@/app/Components/Toast";

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
const PRESETS = [500, 1000, 2000, 5000];

function toLocal07(phone: string) {
  return `0${normalizeKenyaPhoneLocal(phone)}`;
}

export default function GoalPayPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [goal, setGoal] = useState<PublicGoalPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kes, setKes] = useState("");
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [step, setStep] = useState<Step>("idle");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getPublicGoalByPayToken(token);
      if (res.success && res.goal) setGoal(res.goal);
      else setGoal(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    getExchangeRate("KES").then((res) => {
      const r =
        Number(res?.data?.buying) ||
        Number(res?.data?.rate) ||
        Number(res?.buying) ||
        Number(res?.rate);
      if (r > 0) setRate(r);
    });
  }, [load]);

  const kesAmt = parseFloat(kes) || 0;
  const usdcAmt = kesAmt > 0 && rate > 0 ? kesAmt / rate : 0;
  const busy = step !== "idle" && step !== "failed" && step !== "completed";
  const canSubmit =
    !busy &&
    isValidKenyaPhone(phone) &&
    kesAmt >= MIN_KES &&
    kesAmt <= MAX_KES;

  const pollUntilDone = async (code: string) => {
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await getGoalPayStatus(code);
      if (st.complete) return true;
      if (st.status && /FAIL|CANCEL/i.test(st.status)) return false;
    }
    return false;
  };

  const handleContribute = async () => {
    if (!token || !canSubmit) return;
    setStep("initiating");
    try {
      const res = await initiateGoalPayOnramp(token, {
        amount: Math.ceil(kesAmt),
        phoneNo: toLocal07(phone),
        guestDisplayName: name.trim() || "Guest",
        exchangeRate: rate,
      });
      if (!res.success || !res.transactionCode) {
        showToast(res.error || "Could not start M-Pesa", "error");
        setStep("failed");
        return;
      }
      setStep("waiting_for_pin");
      showToast("Check your phone for the M-Pesa prompt", "success");
      setStep("processing");
      const ok = await pollUntilDone(res.transactionCode);
      if (ok) {
        setStep("completed");
        showToast("Contribution received — thank you!", "success");
        void load();
      } else {
        setStep("failed");
        showToast("Payment not confirmed yet. Try again if needed.", "warning");
      }
    } catch {
      setStep("failed");
      showToast("Payment failed", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-6">
        <FiTarget className="text-gray-300 mb-3" size={40} />
        <p className="text-[15px] font-bold text-gray-800">Goal not found</p>
        <p className="text-[12px] text-gray-500 mt-1 text-center">
          This pay link may be invalid or the goal is closed.
        </p>
      </div>
    );
  }

  const target = parseFloat(goal.targetAmount || "0") || 0;
  const balance = parseFloat(goal.totalBalance || "0") || 0;
  const progress =
    goal.progress ??
    (target > 0 ? Math.min(100, (balance / target) * 100) : 0);

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <div className="relative h-40 shrink-0 overflow-hidden">
        {goal.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={goal.coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #0f4f4f 0%, #1a6b6b 50%, #2a9a8a 100%)",
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative h-full flex flex-col justify-end px-5 pb-4">
          <span className="text-[10px] font-semibold text-white/80 mb-1">
            {goalTypeLabel(goal.goalType)} · Contribute
          </span>
          <h1 className="text-[1.35rem] font-extrabold text-white leading-tight">
            {goal.name}
          </h1>
          {goal.creator?.userName && (
            <p className="text-[12px] text-white/85 mt-1">
              Created by @{goal.creator.userName}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 max-w-lg mx-auto w-full pb-10">
        {goal.description && (
          <p className="text-[13px] text-gray-600 leading-relaxed">
            {goal.description}
          </p>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 shadow-sm">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Progress
              </p>
              <p className="text-[1.1rem] font-extrabold text-gray-900 tabular-nums mt-0.5">
                {balance.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-[12px] font-semibold text-gray-400">
                  / {target.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                  USDC
                </span>
              </p>
            </div>
            <p className="text-[1.05rem] font-extrabold text-downy-700 tabular-nums">
              {progress.toFixed(0)}%
            </p>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-downy-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {step === "completed" ? (
          <section className="bg-white rounded-2xl border border-emerald-100 px-4 py-8 text-center">
            <span className="inline-flex h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 items-center justify-center mb-3">
              <FiCheck size={24} />
            </span>
            <p className="text-[15px] font-bold text-gray-900">Thank you!</p>
            <p className="text-[12px] text-gray-500 mt-1">
              Your contribution is in the goal pot.
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setKes("");
              }}
              className="mt-4 text-[13px] font-bold text-downy-700"
            >
              Contribute again
            </button>
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4 shadow-sm space-y-3">
            <div>
              <h2 className="text-[14px] font-bold text-gray-900">
                Contribute with M-Pesa
              </h2>
              <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                You don’t need a Chamapay account. Enter your details, approve
                the STK push, and it credits this goal.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">
                Your name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="So they know who helped"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">
                M-Pesa number
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-gray-200 px-3 py-2.5 gap-2">
                <FiSmartphone className="text-gray-400 shrink-0" size={16} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="flex-1 outline-none text-[13px] bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">
                Amount (KES)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={kes}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*$/.test(v)) setKes(v);
                }}
                placeholder="1000"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] font-bold outline-none focus:ring-2 focus:ring-downy-500"
              />
              {usdcAmt > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  ≈ {usdcAmt.toFixed(3)} USDC at ~{rate} KES/USDC
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setKes(String(p))}
                    className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-700"
                  >
                    {p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleContribute()}
              className={`w-full py-3.5 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 ${
                !canSubmit
                  ? "bg-gray-300"
                  : "bg-downy-600 shadow-md shadow-downy-600/25"
              }`}
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {step === "waiting_for_pin"
                    ? "Approve on phone…"
                    : step === "processing"
                      ? "Confirming…"
                      : "Starting…"}
                </>
              ) : (
                "Contribute with M-Pesa"
              )}
            </button>

            {step === "failed" && (
              <p className="text-[11px] text-rose-600 text-center">
                Something went wrong. You can try again.
              </p>
            )}
          </section>
        )}

        <p className="text-center text-[10px] text-gray-400 pt-2">
          Powered by Chamapay · USDC on Base
        </p>
      </div>
    </div>
  );
}
