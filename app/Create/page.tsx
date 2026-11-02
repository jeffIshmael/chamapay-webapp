"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiGlobe,
  FiInfo,
  FiTarget,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiX,
  FiZap,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import BottomNavbar from "../Components/BottomNavbar";
import AppHeader from "../Components/AppHeader";
import CycleSelector, {
  CycleValue,
  nextMonthlyOccurrence,
  ordinal,
  toYMD,
} from "../Components/CycleSelector";
import { showToast } from "../Components/Toast";
import { registerChamaToDatabase } from "@/lib/chamaService";
import { createGoal, GoalType, goalTypeLabel } from "@/lib/goalService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { withCommas, stripCommas } from "@/utils/amountInputUtils";

type CreateMode = "chama" | "goal";

const GOAL_TYPE_OPTIONS: Array<{
  type: GoalType;
  label: string;
  description: string;
  Icon: IconType;
  iconWrap: string;
}> = [
  {
    type: "personal",
    label: "Personal",
    description: "Just you",
    Icon: FiUser,
    iconWrap: "bg-sky-50 text-sky-600",
  },
  {
    type: "invite",
    label: "Invite circle",
    description: "Add members later and save together transparently.",
    Icon: FiUsers,
    iconWrap: "bg-violet-50 text-violet-600",
  },
  {
    type: "public",
    label: "Public / Harambee",
    description: "Share the pay link widely for open contributions.",
    Icon: FiGlobe,
    iconWrap: "bg-amber-50 text-amber-600",
  },
];

function SectionHeader({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="bg-downy-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-downy-800">
          {step}
        </span>
        <h3 className="text-[14px] font-bold text-gray-900">{title}</h3>
      </div>
      {subtitle ? (
        <p className="text-[11px] text-gray-500 leading-relaxed">{subtitle}</p>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 tracking-wide">
      {children}
    </label>
  );
}

/** Withdrawal fee a goal can opt into. The goal target is raised by this much to cover it. */
const GOAL_WITHDRAWAL_FEE_PERCENT = 2.5;

/** target + 2.5%, to 2 decimals (KES) or 6 decimals (USDC) */
const withGoalFee = (amount: number, kes: boolean) => {
  const raw = amount * (1 + GOAL_WITHDRAWAL_FEE_PERCENT / 100);
  const m = kes ? 100 : 1e6;
  return Math.round(raw * m) / m;
};

/** Horizontal on/off switch (replaces the old checkbox). */
function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-downy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 placeholder:text-gray-400/60 placeholder:font-normal text-gray-900 text-[13px] focus:border-downy-500 focus:ring-downy-500";

function CreateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const { isAuthenticated } = useSessionAddress();

  const [mode, setMode] = useState<CreateMode>("chama");
  const [activeSection, setActiveSection] = useState("Create");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Synchronous submit lock. State (`loading`) updates on the next render, so
  // two rapid submits can both read loading === false. A ref flips immediately.
  const submittingRef = useRef(false);
  const releaseSubmitLock = () => {
    submittingRef.current = false;
    setLoading(false);
  };

  // Chama
  const [chamaName, setChamaName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [cycleMode, setCycleMode] = useState<"days" | "monthly-date">("days");
  const [monthlyDay, setMonthlyDay] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [contribution, setContribution] = useState("");
  const [kesMode, setKesMode] = useState(false);
  const { currency, platformRate } = useCurrencyStore();

  // Goal
  const [goalName, setGoalName] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("personal");
  const [showGoalTypePicker, setShowGoalTypePicker] = useState(false);
  const [target, setTarget] = useState("");
  const [endDate, setEndDate] = useState("");
  const [yieldEnabled, setYieldEnabled] = useState(false);
  const [withdrawalFeeEnabled, setWithdrawalFeeEnabled] = useState(false);
  const [showYieldInfoModal, setShowYieldInfoModal] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState("");

  useEffect(() => {
    if (currency === "KES") setKesMode(true);
  }, [currency]);

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "goal") setMode("goal");
    else if (m === "chama") setMode("chama");
  }, [searchParams]);

  const resetForms = () => {
    setChamaName("");
    setFrequency("");
    setCycleMode("days");
    setMonthlyDay(null);
    setStartDate("");
    setStartTime("");
    setContribution("");
    setGoalName("");
    setGoalDescription("");
    setGoalType("personal");
    setTarget("");
    setEndDate("");
    setYieldEnabled(false);
    setWithdrawalFeeEnabled(false);
    setShowYieldInfoModal(false);
    setNotifyPhone("");
    setErrorText("");
  };

  const selectedGoalType =
    GOAL_TYPE_OPTIONS.find((o) => o.type === goalType) || GOAL_TYPE_OPTIONS[0];
  const SelectedGoalIcon = selectedGoalType.Icon;

  const isStartInFuture = () => {
    if (!startDate || !startTime) return true;
    return new Date(`${startDate}T${startTime}:00`) > new Date();
  };

  // Fixed day-of-month mode: the first payout must land on the chosen day.
  const startDayOfMonth = startDate
    ? parseInt(startDate.split("-")[2], 10)
    : null;
  // The contract checks the pay day in UTC, so the chosen date + time must land
  // on that day in UTC as well, not just in the device's timezone.
  const startUtcDay =
    startDate && startTime
      ? new Date(`${startDate}T${startTime}:00`).getUTCDate()
      : null;
  const monthlyDateOk =
    cycleMode !== "monthly-date" ||
    (monthlyDay !== null &&
      startDayOfMonth === monthlyDay &&
      (startUtcDay === null || startUtcDay === monthlyDay));

  const handleCycleChange = (next: CycleValue) => {
    // Picking a day moves the first payout date to that day's next occurrence.
    if (
      next.mode === "monthly-date" &&
      next.day &&
      (next.day !== monthlyDay || cycleMode !== "monthly-date")
    ) {
      setStartDate(
        toYMD(nextMonthlyOccurrence(next.day, startTime || "00:00")),
      );
    }
    setCycleMode(next.mode);
    setFrequency(next.days);
    setMonthlyDay(next.day);
  };

  const chamaValid =
    chamaName.trim().length >= 3 &&
    frequency.trim() !== "" &&
    parseInt(frequency, 10) > 0 &&
    monthlyDateOk &&
    startDate &&
    startTime &&
    isStartInFuture() &&
    contribution.trim() !== "" &&
    parseFloat(contribution) > 0;

  const goalValid =
    goalName.trim().length >= 2 &&
    goalDescription.trim() !== "" &&
    target.trim() !== "" &&
    parseFloat(target) > 0 &&
    endDate &&
    new Date(`${endDate}T23:59:59`) > new Date();

  // Goal target with the optional 2.5% withdrawal fee added on top
  const baseTargetNum = parseFloat(target) || 0;
  const feeAmountNum =
    Math.round(
      (withGoalFee(baseTargetNum, kesMode) - baseTargetNum) *
        (kesMode ? 100 : 1e6),
    ) / (kesMode ? 100 : 1e6);
  const goalTargetNum = withdrawalFeeEnabled
    ? withGoalFee(baseTargetNum, kesMode)
    : baseTargetNum;
  const fmtGoal = (n: number) =>
    n.toLocaleString(kesMode ? "en-KE" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: kesMode ? 2 : 3,
    });

  const createChama = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamaValid || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setErrorText("");

    if (!isAuthenticated || !token || token === "guest") {
      showToast("Please sign in to create a chama", "warning");
      releaseSubmitLock();
      return;
    }

    try {
      const contribNum = parseFloat(contribution);
      const amountUsdc =
        kesMode && platformRate > 0 ? contribNum / platformRate : contribNum;

      const resultOutcome = await registerChamaToDatabase(
        {
          name: chamaName.trim(),
          description: "",
          type: "Private",
          adminTerms: "[]",
          amount: amountUsdc.toString(),
          cycleTime: parseInt(frequency, 10),
          ...(cycleMode === "monthly-date" && monthlyDay
            ? { payoutDayOfMonth: monthlyDay }
            : {}),
          maxNo: 0,
          startDate: new Date(`${startDate}T${startTime}:00`),
          collateralRequired: false,
        },
        token,
      );
      if (!resultOutcome.success) {
        setErrorText(resultOutcome.error || "Failed to create chama");
        releaseSubmitLock();
        return;
      }

      showToast(`${chamaName.trim()} created successfully.`, "success");
      resetForms();
      router.push("/MyChamas");
    } catch (err) {
      console.error(err);
      setErrorText("A problem occurred, try again.");
      releaseSubmitLock();
    }
  };

  const createGoalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalValid || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setErrorText("");

    if (!isAuthenticated || !token || token === "guest") {
      showToast("Please sign in to create a goal", "warning");
      releaseSubmitLock();
      return;
    }

    try {
      // with the withdrawal fee on, the goal the user saves toward is target + 2.5%
      const targetNum = goalTargetNum;
      const targetUsdc =
        kesMode && platformRate > 0 ? targetNum / platformRate : targetNum;

      const result = await createGoal(token, {
        name: goalName.trim(),
        description: goalDescription.trim(),
        goalType,
        targetAmount: targetUsdc.toString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
        yieldEnabled: goalType === "public" ? false : yieldEnabled,
        withdrawalFeeEnabled,
        withdrawalFeePercent: withdrawalFeeEnabled
          ? GOAL_WITHDRAWAL_FEE_PERCENT
          : 0,
        notifyPhone: notifyPhone.trim() || undefined,
      });

      if (!result.success || !result.goal) {
        setErrorText(result.error || "Failed to create goal");
        releaseSubmitLock();
        return;
      }
      showToast(`${result.goal.name} created successfully.`, "success");
      resetForms();
      router.push("/MyChamas?tab=goals");
    } catch (err) {
      console.error(err);
      setErrorText("A problem occurred, try again.");
      releaseSubmitLock();
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-downy-50 flex flex-col overflow-hidden">
      <AppHeader pageTitle="Create" />

      <div className="shrink-0 px-4 pt-3 pb-2 bg-downy-50 border-b border-downy-100/50 z-20">
        <p className="text-[12px] text-gray-500 leading-relaxed mb-3">
          Start a rotational chama or a Save for Goal.
        </p>
        <div className="flex bg-white border border-downy-100/70 rounded-2xl p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setMode("chama");
              setErrorText("");
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-semibold text-[12px] transition ${
              mode === "chama"
                ? "bg-downy-600 text-white"
                : "bg-transparent text-gray-500"
            }`}
          >
            <FiUsers size={14} /> Chama
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("goal");
              setErrorText("");
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-semibold text-[12px] transition ${
              mode === "goal"
                ? "bg-downy-600 text-white"
                : "bg-transparent text-gray-500"
            }`}
          >
            <FiTarget size={14} /> Goal
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 space-y-3 pb-nav-create">
        {errorText && (
          <div className="text-red-500 p-2.5 flex items-center border border-red-200 rounded-xl bg-red-50">
            <FiAlertTriangle className="mr-2 shrink-0" size={14} />
            <span className="text-[12px]">{errorText}</span>
          </div>
        )}

        {mode === "chama" ? (
          <form onSubmit={createChama} className="space-y-3">
            {/* <div className="px-0.5">
              <p className="text-[13px] font-bold text-gray-900">
                Rotational savings
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                Members contribute on a schedule — each round, one person gets
                the pot.
              </p>
            </div> */}

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader step="01" title="About your chama" />
              <FieldLabel>
                Chama name <span className="text-red-500">*</span>
              </FieldLabel>
              <input
                type="text"
                value={chamaName}
                onChange={(e) => setChamaName(e.target.value)}
                placeholder="e.g., Tech Professionals Savings"
                className={inputClass}
              />
            </div>

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader
                step="02"
                title="Money & schedule"
                subtitle="How often and how much each member puts in"
              />

              <FieldLabel>
                Contribution cycle <span className="text-red-500">*</span>
              </FieldLabel>
              <div className="mb-3">
                <CycleSelector
                  value={{ mode: cycleMode, days: frequency, day: monthlyDay }}
                  onChange={handleCycleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <FieldLabel>
                    First payout date <span className="text-red-500">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className={`${inputClass} [color-scheme:light] pr-10`}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>
                    Payout time <span className="text-red-500">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={`${inputClass} [color-scheme:light] pr-10`}
                    />
                  </div>
                </div>
              </div>

              {cycleMode === "monthly-date" && monthlyDay !== null && (
                <p
                  className={`text-[11px] -mt-1.5 mb-3 ${
                    monthlyDateOk ? "text-downy-700" : "text-red-500"
                  }`}
                >
                  {monthlyDateOk
                    ? `Payouts happen on the ${ordinal(monthlyDay)} of every month.`
                    : startDayOfMonth === monthlyDay
                      ? `Try a different payout time — at this hour the payout would land on another day (UTC).`
                      : `First payout date must fall on the ${ordinal(monthlyDay)}.`}
                </p>
              )}

              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>
                  Contribution <span className="text-red-500">*</span>
                </FieldLabel>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setKesMode(true)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                    }`}
                  >
                    KES
                  </button>
                  <button
                    type="button"
                    onClick={() => setKesMode(false)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      !kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                    }`}
                  >
                    USDC
                  </button>
                </div>
              </div>
              <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                <span className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 text-[12px] font-bold text-gray-600">
                  {kesMode ? "KES" : "USDC"}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={withCommas(contribution)}
                  onChange={(e) => {
                    const v = stripCommas(e.target.value);
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setContribution(v);
                  }}
                  placeholder={kesMode ? "500" : "5"}
                  className="flex-1 px-3 py-2.5 text-gray-900 text-[13px] placeholder:text-gray-400/60 placeholder:font-normal font-semibold border-0 focus:ring-0"
                />
              </div>
              {/* {kesMode && contribution && platformRate > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  ≈ {(parseFloat(contribution) / platformRate || 0).toFixed(3)}{" "}
                  USDC
                </p>
              )}
              {!kesMode && contribution && platformRate > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  ≈ {(parseFloat(contribution) * platformRate || 0).toFixed(0)}{" "}
                  KES
                </p>
              )} */}
            </div>

            <button
              type="submit"
              disabled={!chamaValid || loading}
              className={`w-full py-3 rounded-xl font-bold text-[13px] text-white flex items-center justify-center gap-2 ${
                chamaValid && !loading
                  ? "bg-downy-600 shadow-md shadow-downy-600/25"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <FiUsers />
              {loading ? "Creating..." : "Create Chama"}
            </button>
          </form>
        ) : (
          <form onSubmit={createGoalAction} className="space-y-3">
            {/* <div className="px-1">
              <p className="text-[13px] font-bold text-gray-900">
                Save toward a target
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                Personal, invite friends, or go public. Optional yield on
                Moonwell.
              </p>
            </div> */}

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader step="01" title="Goal type" />
              <button
                type="button"
                onClick={() => setShowGoalTypePicker((v) => !v)}
                className="w-full bg-downy-50/80 border border-downy-100 rounded-xl px-3 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                  <span
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${selectedGoalType.iconWrap}`}
                  >
                    <SelectedGoalIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-downy-700 uppercase tracking-wider mb-0.5">
                      Selected
                    </p>
                    <p className="text-[13px] font-bold text-gray-900">
                      {selectedGoalType.label}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-4">
                      {selectedGoalType.description}
                    </p>
                  </div>
                </div>
                <span className="w-8 h-8 rounded-full bg-white border border-downy-100 flex items-center justify-center text-downy-700 shrink-0">
                  <FiChevronDown />
                </span>
              </button>
              {showGoalTypePicker && (
                <div className="mt-3 space-y-2">
                  {GOAL_TYPE_OPTIONS.map((opt) => {
                    const OptIcon = opt.Icon;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => {
                          setGoalType(opt.type);
                          if (opt.type === "public") setYieldEnabled(false);
                          setShowGoalTypePicker(false);
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-start gap-3 ${
                          goalType === opt.type
                            ? "border-downy-400 bg-downy-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <span
                          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${opt.iconWrap}`}
                        >
                          <OptIcon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-gray-900 text-[12px]">
                              {opt.label}
                            </p>
                            {goalType === opt.type ? (
                              <FiCheck
                                className="text-downy-600 shrink-0"
                                size={14}
                              />
                            ) : null}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader
                step="02"
                title="The story"
                subtitle="Name it and say what you’re saving for"
              />
              <div className="space-y-4">
                <div>
                  <FieldLabel>
                    Goal name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <input
                    type="text"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="e.g., Laptop fund"
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel>
                    Description <span className="text-red-500">*</span>
                  </FieldLabel>
                  <textarea
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    placeholder="Why are you saving?"
                    rows={4}
                    className={`${inputClass} min-h-[7rem]`}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader
                step="03"
                title="Target & extras"
                subtitle="How much, by when, and optional alerts"
              />
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel>
                      Target amount <span className="text-red-500">*</span>
                    </FieldLabel>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setKesMode(true)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                        }`}
                      >
                        KES
                      </button>
                      <button
                        type="button"
                        onClick={() => setKesMode(false)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          !kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                        }`}
                      >
                        USDC
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <span className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 text-[12px] font-bold text-gray-600">
                      {kesMode ? "KES" : "USDC"}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={withCommas(target)}
                      onChange={(e) => {
                        const v = stripCommas(e.target.value);
                        if (v === "" || /^\d*\.?\d*$/.test(v)) setTarget(v);
                      }}
                      placeholder={kesMode ? "50,000" : "400"}
                      className="flex-1 px-3 py-2.5 text-gray-900 text-[13px] placeholder:text-gray-400 placeholder:font-normal font-semibold border-0 focus:ring-0"
                    />
                  </div>
                  {kesMode && target && platformRate > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      ≈ {(parseFloat(target) / platformRate || 0).toFixed(3)}{" "}
                      USDC
                    </p>
                  )}

                  {/* Optional 2.5% withdrawal fee: ticked = goal target is raised to cover it */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={withdrawalFeeEnabled}
                    onClick={() => setWithdrawalFeeEnabled((v) => !v)}
                    className={`mt-3 w-full flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      withdrawalFeeEnabled
                        ? "bg-downy-50 border-downy-300"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                        withdrawalFeeEnabled
                          ? "bg-downy-600 border-downy-600 text-white"
                          : "bg-white border-gray-300 text-transparent"
                      }`}
                    >
                      <FiCheck size={14} strokeWidth={3} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[12px] font-bold text-gray-900">
                        Add {GOAL_WITHDRAWAL_FEE_PERCENT}% withdrawal fee
                      </span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 leading-4">
                        Raise the goal by {GOAL_WITHDRAWAL_FEE_PERCENT}% so the
                        fee is covered when you withdraw.
                      </span>
                    </span>
                  </button>

                  {withdrawalFeeEnabled && baseTargetNum > 0 && (
                    <div className="mt-2 rounded-xl border border-downy-100 bg-white px-3 py-2.5 text-[11px] space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Your target</span>
                        <span className="font-semibold">
                          {fmtGoal(baseTargetNum)} {kesMode ? "KES" : "USDC"}
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-600">
                        <span>Withdrawal fee ({GOAL_WITHDRAWAL_FEE_PERCENT}%)</span>
                        <span className="font-semibold">
                          + {fmtGoal(feeAmountNum)} {kesMode ? "KES" : "USDC"}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-900 font-bold border-t border-gray-100 pt-1">
                        <span>Goal to reach</span>
                        <span>
                          {fmtGoal(goalTargetNum)} {kesMode ? "KES" : "USDC"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <FieldLabel>
                    End date <span className="text-red-500">*</span>
                  </FieldLabel>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={
                      new Date(Date.now() + 86400000)
                        .toISOString()
                        .split("T")[0]
                    }
                    className={`${inputClass} [color-scheme:light]`}
                  />
                </div>

                {goalType !== "public" && (
                  <div
                    className={`flex items-center justify-between rounded-xl px-3 py-3 border ${
                      yieldEnabled
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setShowYieldInfoModal(true)}
                      className="flex-1 pr-3 text-left bg-transparent"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-bold text-gray-900">
                          Put your savings to work
                        </p>
                        <FiInfo className="text-emerald-600 text-sm" />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-4">
                        Idle funds earn on Moonwell. Tap for details.
                      </p>
                    </button>
                    <Toggle
                      checked={yieldEnabled}
                      label="Put your savings to work"
                      onChange={(on) => {
                        if (on) {
                          // stay OFF until the user taps "Got it" in the popup
                          setShowYieldInfoModal(true);
                        } else {
                          setYieldEnabled(false);
                        }
                      }}
                    />
                  </div>
                )}

                {(goalType === "public" || goalType === "invite") && (
                  <div>
                    <FieldLabel>WhatsApp for updates</FieldLabel>
                    <input
                      type="tel"
                      value={notifyPhone}
                      onChange={(e) =>
                        setNotifyPhone(e.target.value.replace(/[^\d+]/g, ""))
                      }
                      placeholder="e.g. 2547XX XXX XXX"
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-400 mt-2 leading-4">
                      Optional — contribution alerts you can forward to a group.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!goalValid || loading}
              className={`w-full py-3 rounded-xl font-bold text-[13px] text-white flex items-center justify-center gap-2 ${
                goalValid && !loading
                  ? "bg-downy-600 shadow-md shadow-downy-600/25"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <FiTarget />
              {loading
                ? "Creating..."
                : `Create ${goalTypeLabel(goalType)} goal`}
            </button>
          </form>
        )}
      </div>

      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {showYieldInfoModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55">
          <div
            className="absolute inset-0"
            onClick={() => setShowYieldInfoModal(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-xl max-h-[min(92dvh,92%)] flex flex-col overflow-hidden">
            <div className="shrink-0 px-5 pt-4">
              <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
              <div className="flex items-center gap-3 mb-2">
                <span className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <FiZap size={18} />
                </span>
                <h2 className="text-[1.15rem] font-extrabold text-gray-900 leading-tight flex-1">
                  Put your savings to work
                </h2>
                <button
                  type="button"
                  onClick={() => setShowYieldInfoModal(false)}
                  className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                  aria-label="Close"
                >
                  <FiX size={16} />
                </button>
              </div>
              <p className="text-[13px] text-gray-500 mb-3 leading-relaxed">
                Here’s what happens when you turn this on for your goal.
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 [-webkit-overflow-scrolling:touch]">
              <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 flex items-start gap-3">
                <span className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-teal-700 shrink-0 mt-0.5">
                  <FiUsers size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 mb-0.5">
                    Supplied to Moonwell
                  </p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">
                    Your goal funds are supplied to a Moonwell pool (a
                    third-party DeFi pool) to provide liquidity. ChamaPay does
                    not hold this yield pool itself.
                  </p>
                </div>
              </div>

              <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 flex items-start gap-3">
                <span className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-teal-700 shrink-0 mt-0.5">
                  <FiTrendingUp size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 mb-0.5">
                    APY is relative
                  </p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">
                    The APY you see can go up or down over time — it depends on
                    borrowing demand in the pool and is not guaranteed.
                  </p>
                </div>
              </div>

              <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 flex items-start gap-3">
                <span className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <FiAlertTriangle size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-amber-900 mb-0.5">
                    Withdrawal risk
                  </p>
                  <p className="text-[12px] text-amber-800/80 leading-relaxed">
                    You can withdraw only when the money is not borrowed yet. If
                    the pool’s cash is currently borrowed, your balance is still
                    yours and keeps earning — try again when free cash returns.
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => {
                  setYieldEnabled(true);
                  setShowYieldInfoModal(false);
                }}
                className="w-full py-3.5 rounded-2xl bg-downy-600 text-white text-[15px] font-bold"
              >
                Got it
              </button>
              <button
                type="button"
                onClick={() => {
                  setYieldEnabled(false);
                  setShowYieldInfoModal(false);
                }}
                className="w-full py-3 mt-0.5 text-[13px] font-medium text-gray-500"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-downy-50 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CreateContent />
    </Suspense>
  );
}