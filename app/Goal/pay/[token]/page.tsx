"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FiCheck,
  FiHeart,
  FiTarget,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  getGoalPayStatus,
  getPublicGoalByPayToken,
  initiateGoalPayOnramp,
  PublicGoalPreview,
  setGoalPayIdentity,
} from "@/lib/goalService";
import { getExchangeRate } from "@/lib/pretiumService";
import { isValidKenyaPhone, normalizeKenyaPhoneLocal } from "@/lib/phoneUtils";
import { showToast } from "@/app/Components/Toast";

type Step =
  | "idle"
  | "initiating"
  | "waiting_for_pin"
  | "processing"
  | "completed"
  | "failed";

type TabId = "contribute" | "supporters";

const FALLBACK_RATE = 132;
const MIN_KES = 10;
const MAX_KES = 250000;
const PRESETS = [500, 1000, 2000, 5000];
const OFFICIAL_SITE = "https://chamapay.xyz";

function toLocal07(phoneLocal9: string) {
  return `0${normalizeKenyaPhoneLocal(phoneLocal9)}`;
}

function formatAmount(n: number, currency: "KES" | "USDC") {
  if (currency === "KES") {
    return Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function GoalPayPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [goal, setGoal] = useState<PublicGoalPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("contribute");
  const [name, setName] = useState("");
  /** Digits after +254 (typically 7XXXXXXXX) */
  const [phoneLocal, setPhoneLocal] = useState("");
  const [kes, setKes] = useState("");
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [showKes, setShowKes] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [txCode, setTxCode] = useState<string | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityDone, setIdentityDone] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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

  // Kenya IP → show raised / target / supporter amounts in KES
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { country_code?: string };
        if (String(data?.country_code || "").toUpperCase() === "KE") {
          setShowKes(true);
        }
      } catch {
        /* keep USDC display */
      }
    })();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const displayCurrency: "KES" | "USDC" = showKes ? "KES" : "USDC";
  const toDisplay = (usdc: number) =>
    displayCurrency === "KES" ? usdc * rate : usdc;

  const kesAmt = parseFloat(kes) || 0;
  const phoneForValidation = `254${phoneLocal}`;
  const busy = step !== "idle" && step !== "failed" && step !== "completed";
  const canSubmit =
    !busy &&
    isValidKenyaPhone(phoneForValidation) &&
    kesAmt >= MIN_KES &&
    kesAmt <= MAX_KES;

  const contributions = useMemo(
    () => goal?.contributions ?? [],
    [goal?.contributions]
  );

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
    setIdentityDone(false);
    try {
      const res = await initiateGoalPayOnramp(token, {
        amount: Math.ceil(kesAmt),
        phoneNo: toLocal07(phoneLocal),
        guestDisplayName: "Guest",
        exchangeRate: rate,
      });
      if (!res.success || !res.transactionCode) {
        showToast(res.error || "Could not start M-Pesa", "error");
        setStep("failed");
        return;
      }
      setTxCode(res.transactionCode);
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

  const saveIdentity = async (anonymous: boolean) => {
    if (!token || !txCode || identitySaving) return;
    if (!anonymous && !name.trim()) {
      showToast("Enter a name to show, or stay anonymous", "warning");
      return;
    }
    setIdentitySaving(true);
    try {
      const res = await setGoalPayIdentity(token, {
        transactionCode: txCode,
        anonymous,
        displayName: name.trim(),
      });
      if (!res.success) {
        showToast(res.error || "Could not save", "error");
        return;
      }
      setIdentityDone(true);
      showToast(
        anonymous ? "You’ll appear as Anonymous" : `Shown as ${res.displayName}`,
        "success"
      );
      void load();
      setTab("supporters");
    } finally {
      setIdentitySaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0f3d3f] flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-[100dvh] bg-downy-50 flex flex-col items-center justify-center px-6">
        <FiTarget className="text-downy-300 mb-3" size={40} />
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
  const creatorName = goal.creator?.userName || "a Chamapay saver";
  const creatorPic = goal.creator?.profileImageUrl;

  return (
    <div className="min-h-[100dvh] bg-[#f3faf9] flex flex-col">
      {/* Hero */}
      <div className="relative h-[min(42vh,280px)] shrink-0 overflow-hidden">
        {goal.coverImageUrl ? (
          <button
            type="button"
            onClick={() => setLightboxSrc(goal.coverImageUrl!)}
            className="absolute inset-0 block w-full h-full cursor-zoom-in"
            aria-label="View cover photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={goal.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </button>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #0f4f4f 0%, #1a6b6b 45%, #26a6a2 100%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 pointer-events-none" />
        <div className="relative h-full flex flex-col justify-end px-5 pb-5 max-w-lg mx-auto w-full pointer-events-none">
          <span className="inline-flex self-start text-[10px] font-bold uppercase tracking-wider text-white/90 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full mb-2">
            Open contribution
          </span>
          <h1 className="text-[1.55rem] font-extrabold text-white leading-tight drop-shadow-md">
            {goal.name}
          </h1>
          <div className="mt-3 flex items-center gap-2.5 pointer-events-auto">
            {creatorPic ? (
              <button
                type="button"
                onClick={() => setLightboxSrc(creatorPic)}
                className="shrink-0 rounded-full ring-2 ring-white/40 overflow-hidden cursor-zoom-in"
                aria-label={`View @${creatorName}'s photo`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creatorPic}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              </button>
            ) : (
              <div className="h-9 w-9 rounded-full bg-downy-500/90 text-white text-[12px] font-bold flex items-center justify-center ring-2 ring-white/40">
                {initials(creatorName)}
              </div>
            )}
            <div>
              <p className="text-[11px] text-white/70 leading-none">
                Organized by
              </p>
              <p className="text-[13px] font-semibold text-white mt-0.5">
                @{creatorName}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 -mt-4 relative z-[1] max-w-lg mx-auto w-full pb-10 space-y-3">
        {/* Progress sticker */}
        <section
          className="bg-white rounded-2xl border border-downy-100/80 px-4 py-3.5"
          style={{
            boxShadow:
              "0 10px 18px -6px rgba(15, 23, 42, 0.18), 0 4px 8px -4px rgba(15, 23, 42, 0.1)",
          }}
        >
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Raised
              </p>
              <p className="text-[1.2rem] font-extrabold text-gray-900 tabular-nums mt-0.5">
                {formatAmount(toDisplay(balance), displayCurrency)}
                <span className="text-[12px] font-semibold text-gray-400">
                  {" "}
                  / {formatAmount(toDisplay(target), displayCurrency)}{" "}
                  {displayCurrency}
                </span>
              </p>
            </div>
            <p className="text-[1.15rem] font-extrabold text-downy-700 tabular-nums">
              {progress.toFixed(0)}%
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-downy-600 to-teal-400 transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
            <FiUsers size={12} />
            {goal.contributorCount ?? contributions.length}{" "}
            {(goal.contributorCount ?? contributions.length) === 1
              ? "supporter"
              : "supporters"}
          </p>
        </section>

        {goal.description ? (
          <div className="rounded-2xl bg-white/70 border border-downy-100/60 px-4 py-3.5">
            <p className="text-[14px] text-gray-700 leading-[1.65] tracking-[-0.01em]">
              {goal.description}
            </p>
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex rounded-xl bg-white border border-gray-100 p-0.5 shadow-sm">
          {(
            [
              { id: "contribute" as const, label: "Contribute", icon: FiHeart },
              {
                id: "supporters" as const,
                label: "Supporters",
                icon: FiUsers,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[13px] font-bold transition ${
                tab === t.id
                  ? "bg-downy-600 text-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "supporters" ? (
          <section className="bg-white rounded-2xl border border-gray-100 px-3.5 py-3.5 shadow-sm">
            {contributions.length === 0 ? (
              <div className="py-8 text-center">
                <FiHeart className="mx-auto text-downy-300 mb-2" size={28} />
                <p className="text-[13px] font-semibold text-gray-800">
                  Be the first to contribute
                </p>
                <p className="text-[12px] text-gray-500 mt-1">
                  Your support will show up here.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("contribute")}
                  className="mt-4 text-[13px] font-bold text-downy-700"
                >
                  Contribute now
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {contributions.map((c) => {
                  const amtUsdc = parseFloat(c.amount) || 0;
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      {c.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.profileImageUrl}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            c.isAnonymous
                              ? "bg-gray-100 text-gray-500"
                              : "bg-downy-100 text-downy-800"
                          }`}
                        >
                          {c.isAnonymous ? "?" : initials(c.displayName)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          {c.displayName}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <p className="text-[13px] font-extrabold text-downy-800 tabular-nums">
                        {formatAmount(toDisplay(amtUsdc), displayCurrency)}{" "}
                        <span className="text-[10px] font-semibold text-gray-400">
                          {displayCurrency}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : step === "completed" ? (
          <section className="bg-white rounded-2xl border border-emerald-100 px-4 py-6 shadow-sm space-y-4">
            <div className="text-center">
              <span className="inline-flex h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 items-center justify-center mb-3">
                <FiCheck size={24} />
              </span>
              <p className="text-[15px] font-bold text-gray-900">Thank you!</p>
              <p className="text-[12px] text-gray-500 mt-1">
                Your M-Pesa contribution is in the pot.
              </p>
            </div>

            {!identityDone ? (
              <div className="space-y-3 pt-1 border-t border-gray-50">
                <p className="text-[13px] font-bold text-gray-900 text-center">
                  How should you appear to supporters?
                </p>
                <div>
                  <label className="text-[11px] font-semibold text-gray-600">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amina"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={identitySaving}
                    onClick={() => void saveIdentity(true)}
                    className="py-3 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-700 bg-gray-50"
                  >
                    Stay anonymous
                  </button>
                  <button
                    type="button"
                    disabled={identitySaving || !name.trim()}
                    onClick={() => void saveIdentity(false)}
                    className={`py-3 rounded-xl text-[13px] font-bold text-white ${
                      !name.trim() || identitySaving
                        ? "bg-gray-300"
                        : "bg-downy-600"
                    }`}
                  >
                    Show my name
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep("idle");
                  setKes("");
                  setTxCode(null);
                  setIdentityDone(false);
                }}
                className="w-full text-[13px] font-bold text-downy-700"
              >
                Contribute again
              </button>
            )}
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-gray-900">
                Contribute with M-Pesa
              </h2>
              <Image
                src="/static/images/mpesa.png"
                alt="M-Pesa"
                width={72}
                height={28}
                className="h-7 w-auto object-contain"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600">
                M-Pesa number
              </label>
              <p className="text-[11px] text-gray-500 mt-0.5 mb-1.5">
                Enter the number to be prompted
              </p>
              <div className="flex items-stretch rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-downy-500">
                <span className="inline-flex items-center px-3 bg-gray-50 text-[13px] font-bold text-gray-700 border-r border-gray-200 select-none">
                  +254
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneLocal}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                    setPhoneLocal(v);
                  }}
                  placeholder="7XX XXX XXX"
                  className="flex-1 outline-none text-[13px] bg-white px-3 py-2.5"
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
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500 shrink-0">
                  Min: KES {MIN_KES}
                </p>
                <div className="flex flex-wrap justify-end gap-1.5">
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

        <p className="text-center text-[11px] text-gray-400 pt-3 pb-1">
          Powered by{" "}
          <Link
            href={OFFICIAL_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 decoration-gray-400 hover:text-gray-500"
          >
            Chamapay
          </Link>
        </p>
      </div>

      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <FiX size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[90dvh] max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
