"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getGoalBySlug,
  goalTypeLabel,
  GoalFinance,
  GoalRecord,
} from "@/lib/goalService";
import { useSessionAddress } from "@/lib/useSessionAddress";
import {
  FiArrowLeft,
  FiCalendar,
  FiCopy,
  FiLink,
  FiTarget,
  FiUsers,
} from "react-icons/fi";
import { showToast } from "@/app/Components/Toast";

export default function GoalDetailsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const router = useRouter();
  const { token, isAuthenticated, isGuest } = useSessionAddress();

  const [goal, setGoal] = useState<GoalRecord | null>(null);
  const [finance, setFinance] = useState<GoalFinance | null>(null);
  const [payLink, setPayLink] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug || !token || !isAuthenticated || isGuest || token === "guest") {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await getGoalBySlug(slug, token);
      if (res.success && res.goal) {
        setGoal(res.goal);
        setFinance(res.finance ?? null);
        setPayLink(res.payLink || `https://chamapay.com/goal/${res.goal.slug}`);
      } else {
        setGoal(null);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, token, isAuthenticated, isGuest]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    load();
  }, [isAuthenticated, load, router]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payLink);
      showToast("Pay link copied", "success");
    } catch {
      showToast("Could not copy link", "warning");
    }
  };

  const handleBack = () => {
    router.replace("/MyChamas?tab=goals");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-downy-100 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-downy-100 flex flex-col items-center justify-center px-6">
        <p className="text-gray-600 mb-4">Goal not found</p>
        <button
          type="button"
          onClick={handleBack}
          className="bg-downy-600 text-white px-4 py-2 rounded-xl font-semibold"
        >
          Back to My Goals
        </button>
      </div>
    );
  }

  const target = parseFloat(goal.targetAmount || "0") || 0;
  const balance = parseFloat(finance?.totalBalance || "0") || 0;
  const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
  const members = goal._count?.members ?? goal.members?.length ?? 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-downy-800 rounded-b-3xl px-5 pb-6 pt-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <FiArrowLeft />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center">Goal</h1>
          <div className="w-10" />
        </div>
        <h2 className="text-2xl font-bold mb-1">{goal.name}</h2>
        <p className="text-white/80 text-sm mb-3 line-clamp-2">
          {goal.description || "No description"}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
            {goalTypeLabel(goal.goalType)}
          </span>
          {goal.yieldEnabled && (
            <span className="bg-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold">
              Yield on
            </span>
          )}
          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
            {goal.status}
          </span>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Progress</span>
            <span className="font-semibold text-gray-800">
              {balance.toFixed(2)} / {target.toFixed(2)} USDC
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-downy-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-downy-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <FiTarget /> Target
              </div>
              <p className="font-bold text-gray-900">{target.toFixed(2)} USDC</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <FiUsers /> Members
              </div>
              <p className="font-bold text-gray-900">{members}</p>
            </div>
          </div>
          {goal.endDate && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
              <FiCalendar />
              Ends {new Date(goal.endDate).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2 font-semibold text-gray-900">
            <FiLink className="text-downy-600" /> Pay link
          </div>
          <p className="text-xs text-gray-500 break-all mb-3">{payLink}</p>
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 bg-downy-600 text-white font-semibold py-3 rounded-xl"
          >
            <FiCopy /> Copy pay link
          </button>
        </div>
      </div>
    </div>
  );
}
