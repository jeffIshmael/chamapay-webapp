"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiTarget } from "react-icons/fi";
import { showToast } from "./Toast";
import { createGoal, GoalType } from "@/lib/goalService";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useCurrencyStore } from "@/store/useCurrencyStore";

const GOAL_TYPES: Array<{ type: GoalType; label: string; hint: string }> = [
  {
    type: "personal",
    label: "Personal",
    hint: "Just you — share the pay link if friends want to top you up.",
  },
  {
    type: "invite",
    label: "Invite",
    hint: "Add members later and save together with a transparent ledger.",
  },
  {
    type: "public",
    label: "Public",
    hint: "Harambee-style — share the pay link widely. Yield starts off.",
  },
];

const CreateGoalForm = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("personal");
  const [target, setTarget] = useState("");
  const [endDate, setEndDate] = useState("");
  const [yieldEnabled, setYieldEnabled] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [kesMode, setKesMode] = useState(false);
  const router = useRouter();
  const { token } = useAuth();
  const { isAuthenticated } = useSessionAddress();
  const { currency, platformRate } = useCurrencyStore();

  useEffect(() => {
    if (currency === "KES") setKesMode(true);
  }, [currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setErrorText("");

    if (!isAuthenticated || !token || token === "guest") {
      showToast("Please sign in to create a goal", "warning");
      setIsPending(false);
      return;
    }

    const targetNum = parseFloat(target);
    if (!name.trim() || name.trim().length < 2) {
      setErrorText("Name must be at least 2 characters");
      setIsPending(false);
      return;
    }
    if (!description.trim()) {
      setErrorText("Description is required");
      setIsPending(false);
      return;
    }
    if (isNaN(targetNum) || targetNum <= 0) {
      setErrorText("Target amount must be greater than 0");
      setIsPending(false);
      return;
    }
    if (!endDate || new Date(`${endDate}T23:59:59`) <= new Date()) {
      setErrorText("End date must be in the future");
      setIsPending(false);
      return;
    }

    const amountUsdc =
      kesMode && platformRate > 0 ? targetNum / platformRate : targetNum;

    try {
      const result = await createGoal(token, {
        name: name.trim(),
        description: description.trim(),
        goalType,
        targetAmount: amountUsdc.toFixed(6),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
        yieldEnabled: goalType === "public" ? false : yieldEnabled,
      });
      if (!result.success || !result.goal) {
        setErrorText(result.error || "Failed to create goal");
        return;
      }
      showToast(`${result.goal.name} created successfully.`, "success");
      router.push("/MyChamas?tab=goals");
    } catch (error) {
      setErrorText("A problem occurred, try again.");
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  const selectedHint =
    GOAL_TYPES.find((g) => g.type === goalType)?.hint || "";

  return (
    <div className="relative w-full mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white p-6 rounded-3xl shadow-md w-full mt-3"
      >
        {errorText && (
          <div className="text-red-500 p-2 flex items-center border border-red-500 rounded-md mb-2">
            <FiAlertTriangle className="text-red-500 text-sm mr-2" />
            <span className="text-sm">{errorText}</span>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Goal type</p>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_TYPES.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  setGoalType(opt.type);
                  if (opt.type === "public") setYieldEnabled(false);
                }}
                className={`rounded-xl px-2 py-3 text-xs font-semibold border ${
                  goalType === opt.type
                    ? "bg-downy-600 border-downy-600 text-white"
                    : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">{selectedHint}</p>
        </div>

        <div className="flex items-center space-x-2">
          <FiTarget className="w-8 h-8 text-downy-400" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Goal name"
            className="mt-1 block w-full rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            placeholder="Why are you saving?"
            className="block w-full rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Target amount
            </label>
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
          <div className="flex items-center bg-white border border-downy-200 rounded-xl overflow-hidden">
            <span className="px-3 py-3 bg-gray-50 border-r border-gray-200 text-[12px] font-bold text-gray-600">
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
              required
              placeholder={kesMode ? "50000" : "400"}
              className="flex-1 px-3 py-3 text-sm font-semibold border-0 focus:ring-0"
            />
          </div>
          {kesMode && target && platformRate > 0 && (
            <p className="text-[11px] text-gray-500 mt-1">
              ≈ {(parseFloat(target) / platformRate || 0).toFixed(3)} USDC
            </p>
          )}
          {!kesMode && target && platformRate > 0 && (
            <p className="text-[11px] text-gray-500 mt-1">
              ≈ {(parseFloat(target) * platformRate || 0).toFixed(0)} KES
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
            required
            className="mt-1 block w-full text-gray-900 bg-white rounded-md border-downy-200 shadow-sm focus:border-downy-500 focus:ring-downy-500 sm:text-sm h-10 [color-scheme:light]"
          />
        </div>

        {goalType !== "public" && (
          <label className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 cursor-pointer">
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                Put money to work
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Idle funds can earn on Moonwell. You can turn this off later.
              </span>
            </span>
            <input
              type="checkbox"
              checked={yieldEnabled}
              onChange={(e) => setYieldEnabled(e.target.checked)}
              className="rounded border-gray-300 text-downy-600 focus:ring-downy-500 h-5 w-5"
            />
          </label>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className={`font-semibold py-2 px-4 rounded-md ${
              isPending
                ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                : "bg-downy-500 hover:bg-downy-600 text-white"
            }`}
          >
            {isPending ? "Creating..." : "Create Goal"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateGoalForm;
