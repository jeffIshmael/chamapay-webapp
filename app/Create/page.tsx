"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiInfo,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiZap,
} from "react-icons/fi";
import BottomNavbar from "../Components/BottomNavbar";
import AppHeader from "../Components/AppHeader";
import { showToast } from "../Components/Toast";
import { checkChama } from "@/lib/chama";
import { registerChamaToDatabase } from "@/lib/chamaService";
import { createGoal, GoalType, goalTypeLabel } from "@/lib/goalService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useCurrencyStore } from "@/store/useCurrencyStore";

type CreateMode = "chama" | "goal";

const GOAL_TYPE_OPTIONS: Array<{
  type: GoalType;
  label: string;
  description: string;
}> = [
  {
    type: "personal",
    label: "Personal",
    description: "Just you — share the pay link if friends want to top you up.",
  },
  {
    type: "invite",
    label: "Invite circle",
    description: "Add members later and save together transparently.",
  },
  {
    type: "public",
    label: "Public / Harambee",
    description: "Share the pay link widely for open contributions.",
  },
];

const CYCLE_PRESETS = [
  { days: "7", label: "Weekly" },
  { days: "14", label: "Biweekly" },
  { days: "30", label: "Monthly" },
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

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-[13px] focus:border-downy-500 focus:ring-downy-500";

function CreateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const { isAuthenticated } = useSessionAddress();

  const [mode, setMode] = useState<CreateMode>("chama");
  const [activeSection, setActiveSection] = useState("Create");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Chama
  const [chamaName, setChamaName] = useState("");
  const [frequency, setFrequency] = useState("");
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
    setStartDate("");
    setStartTime("");
    setContribution("");
    setGoalName("");
    setGoalDescription("");
    setGoalType("personal");
    setTarget("");
    setEndDate("");
    setYieldEnabled(false);
    setShowYieldInfoModal(false);
    setNotifyPhone("");
    setErrorText("");
    setLoading(false);
  };

  const selectedGoalType =
    GOAL_TYPE_OPTIONS.find((o) => o.type === goalType) || GOAL_TYPE_OPTIONS[0];

  const isStartInFuture = () => {
    if (!startDate || !startTime) return true;
    return new Date(`${startDate}T${startTime}:00`) > new Date();
  };

  const chamaValid =
    chamaName.trim().length >= 3 &&
    frequency.trim() !== "" &&
    parseInt(frequency, 10) > 0 &&
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

  const createChama = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamaValid || loading) return;
    setLoading(true);
    setErrorText("");

    if (!isAuthenticated || !token || token === "guest") {
      showToast("Please sign in to create a chama", "warning");
      setLoading(false);
      return;
    }

    try {
      const exists = await checkChama(chamaName.trim());
      if (exists) {
        setErrorText("Chama with this name already exists");
        setLoading(false);
        return;
      }

      const contribNum = parseFloat(contribution);
      const amountUsdc =
        kesMode && platformRate > 0
          ? contribNum / platformRate
          : contribNum;

      const result = await registerChamaToDatabase(
        {
          name: chamaName.trim(),
          description: "",
          type: "Private",
          adminTerms: "[]",
          amount: amountUsdc.toString(),
          cycleTime: parseInt(frequency, 10),
          maxNo: 0,
          startDate: new Date(`${startDate}T${startTime}:00`),
          collateralRequired: false,
        },
        token
      );

      if (!result.success) {
        setErrorText(result.error || "Failed to create chama");
        setLoading(false);
        return;
      }

      showToast(`${chamaName.trim()} created successfully.`, "success");
      resetForms();
      router.push("/MyChamas?tab=chamas");
    } catch (err) {
      console.error(err);
      setErrorText("A problem occurred, try again.");
      setLoading(false);
    }
  };

  const createGoalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalValid || loading) return;
    setLoading(true);
    setErrorText("");

    if (!isAuthenticated || !token || token === "guest") {
      showToast("Please sign in to create a goal", "warning");
      setLoading(false);
      return;
    }

    try {
      const targetNum = parseFloat(target);
      const targetUsdc =
        kesMode && platformRate > 0 ? targetNum / platformRate : targetNum;

      const result = await createGoal(token, {
        name: goalName.trim(),
        description: goalDescription.trim(),
        goalType,
        targetAmount: targetUsdc.toString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
        yieldEnabled: goalType === "public" ? false : yieldEnabled,
        notifyPhone: notifyPhone.trim() || undefined,
      });

      if (!result.success || !result.goal) {
        setErrorText(result.error || "Failed to create goal");
        setLoading(false);
        return;
      }

      showToast(`${result.goal.name} created successfully.`, "success");
      resetForms();
      router.push("/MyChamas?tab=goals");
    } catch (err) {
      console.error(err);
      setErrorText("A problem occurred, try again.");
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-downy-50 flex flex-col overflow-hidden">
      <AppHeader pageTitle="Create" />

      <div className="shrink-0 px-4 pt-3 pb-2 bg-downy-50 border-b border-downy-100/50 z-20">
        <p className="text-[12px] text-gray-500 leading-relaxed mb-3">
          Start a rotational chama or a Save for Goal pot.
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
            <div className="px-0.5">
              <p className="text-[13px] font-bold text-gray-900">
                Rotational savings
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                Members contribute on a schedule — each round, one person gets
                the pot.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader
                step="01"
                title="About your chama"
                subtitle="Give it a name people will recognize"
              />
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
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {CYCLE_PRESETS.map((opt) => {
                  const active = frequency === opt.days;
                  return (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setFrequency(opt.days)}
                      className={`relative py-2.5 rounded-xl border ${
                        active
                          ? "bg-downy-50 border-downy-400"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      {active && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-downy-600 text-white flex items-center justify-center">
                          <FiCheck className="text-[10px]" strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className={`block text-xs font-bold ${
                          active ? "text-downy-800" : "text-gray-700"
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span
                        className={`block text-[10px] mt-0.5 ${
                          active ? "text-downy-600" : "text-gray-400"
                        }`}
                      >
                        {opt.days} days
                      </span>
                    </button>
                  );
                })}
              </div>
              <input
                type="number"
                min={1}
                value={frequency}
                onChange={(e) => {
                  const t = e.target.value;
                  if (t === "" || /^\d+$/.test(t)) setFrequency(t);
                }}
                placeholder="Or enter custom days"
                className={`${inputClass} mb-3`}
              />

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
                    <FiCalendar className="absolute right-4 top-1/2 -translate-y-1/2 text-downy-700 pointer-events-none" />
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
                    <FiClock className="absolute right-4 top-1/2 -translate-y-1/2 text-downy-700 pointer-events-none" />
                  </div>
                </div>
              </div>

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
                  value={contribution}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setContribution(v);
                  }}
                  placeholder={kesMode ? "500" : "5"}
                  className="flex-1 px-3 py-2.5 text-gray-900 text-[13px] font-semibold border-0 focus:ring-0"
                />
              </div>
              {kesMode && contribution && platformRate > 0 && (
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
              )}
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
            <div className="px-1">
              <p className="text-[13px] font-bold text-gray-900">
                Save toward a target
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                Personal, invite friends, or go public. Optional yield on
                Moonwell.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader
                step="01"
                title="Goal type"
                subtitle="Who can contribute to this pot"
              />
              <button
                type="button"
                onClick={() => setShowGoalTypePicker((v) => !v)}
                className="w-full bg-downy-50/80 border border-downy-100 rounded-xl px-3 py-3 flex items-center justify-between text-left"
              >
                <div className="flex-1 pr-3">
                  <p className="text-[11px] font-bold text-downy-700 uppercase tracking-wider mb-1">
                    Selected
                  </p>
                  <p className="text-[13px] font-bold text-gray-900">
                    {selectedGoalType.label}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5.5 leading-4">
                    {selectedGoalType.description}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-full bg-white border border-downy-100 flex items-center justify-center text-downy-700">
                  <FiChevronDown />
                </span>
              </button>
              {showGoalTypePicker && (
                <div className="mt-3 space-y-2">
                  {GOAL_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        setGoalType(opt.type);
                        if (opt.type === "public") setYieldEnabled(false);
                        setShowGoalTypePicker(false);
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 ${
                        goalType === opt.type
                          ? "border-downy-400 bg-downy-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <p className="font-bold text-gray-900 text-[12px]">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {opt.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-downy-100/70 p-3.5 shadow-sm">
              <SectionHeader
                step="02"
                title="The story"
                subtitle="Name it and say what you’re raising for"
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
                      value={target}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d*$/.test(v)) setTarget(v);
                      }}
                      placeholder={kesMode ? "50000" : "400"}
                      className="flex-1 px-3 py-2.5 text-gray-900 text-[13px] font-semibold border-0 focus:ring-0"
                    />
                  </div>
                  {kesMode && target && platformRate > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      ≈ {(parseFloat(target) / platformRate || 0).toFixed(3)}{" "}
                      USDC
                    </p>
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
                    <input
                      type="checkbox"
                      checked={yieldEnabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setYieldEnabled(true);
                          setShowYieldInfoModal(true);
                        } else {
                          setYieldEnabled(false);
                        }
                      }}
                      className="rounded border-gray-300 text-downy-600 focus:ring-downy-500 h-5 w-5"
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
          <div className="relative w-full max-w-md bg-white rounded-t-3xl px-5 pt-4 pb-8 shadow-xl max-h-[90%] overflow-y-auto">
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
            <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
              Here’s what happens when you turn this on for your goal.
            </p>

            <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 flex items-start gap-3">
              <span className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-teal-700 shrink-0 mt-0.5">
                <FiUsers size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 mb-0.5">
                  Supplied to Moonwell
                </p>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Your goal funds are supplied to a Moonwell pool (a third-party
                  DeFi pool) to provide liquidity. ChamaPay does not hold this
                  yield pool itself.
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

            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 flex items-start gap-3">
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

            <button
              type="button"
              onClick={() => setShowYieldInfoModal(false)}
              className="w-full py-3.5 rounded-2xl bg-downy-600 text-white text-[15px] font-bold"
            >
              Got it
            </button>
            {yieldEnabled && (
              <button
                type="button"
                onClick={() => {
                  setYieldEnabled(false);
                  setShowYieldInfoModal(false);
                }}
                className="w-full py-3 mt-1 text-[13px] font-medium text-gray-500"
              >
                Turn off instead
              </button>
            )}
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
