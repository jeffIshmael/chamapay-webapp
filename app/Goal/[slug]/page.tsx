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
      <div className="min-h-[100dvh] bg-downy-50 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-[100dvh] bg-downy-50 flex flex-col items-center justify-center px-5">
        <p className="text-[13px] text-gray-600 mb-3">Goal not found</p>
        <button
          type="button"
          onClick={handleBack}
          className="bg-downy-600 text-white px-4 py-2 rounded-xl text-[12px] font-bold"
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
    <div className="min-h-[100dvh] bg-downy-50 pb-8">
      <div className="bg-downy-800 rounded-b-3xl px-4 pb-5 pt-4 text-white safe-top shadow-md shadow-downy-900/20">
        <div className="flex items-center justify-between mb-3 min-h-[36px]">
          <button
            type="button"
            onClick={handleBack}
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <FiArrowLeft size={16} />
          </button>
          <h1 className="text-[13px] font-bold flex-1 text-center">Goal</h1>
          <div className="w-8" />
        </div>
        <h2 className="text-[1.15rem] font-bold mb-1 leading-tight">{goal.name}</h2>
        <p className="text-white/80 text-[12px] mb-2.5 line-clamp-2 leading-relaxed">
          {goal.description || "No description"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            {goalTypeLabel(goal.goalType)}
          </span>
          {goal.yieldEnabled && (
            <span className="bg-emerald-400/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
              Yield on
            </span>
          )}
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            {goal.status}
          </span>
        </div>
      </div>

      <div className="px-4 -mt-2 space-y-2.5">
        <div className="bg-white rounded-2xl shadow-sm border border-downy-100/70 p-3.5">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="text-gray-500">Progress</span>
            <span className="font-semibold text-gray-800">
              {balance.toFixed(2)} / {target.toFixed(2)} USDC
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-downy-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-downy-50 rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5">
                <FiTarget size={11} /> Target
              </div>
              <p className="font-bold text-[13px] text-gray-900">
                {target.toFixed(2)} USDC
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5">
                <FiUsers size={11} /> Members
              </div>
              <p className="font-bold text-[13px] text-gray-900">{members}</p>
            </div>
          </div>
          {goal.endDate && (
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-600">
              <FiCalendar size={12} />
              Ends {new Date(goal.endDate).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-downy-100/70 p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5 text-[13px] font-semibold text-gray-900">
            <FiLink className="text-downy-600" size={14} /> Pay link
          </div>
          <p className="text-[11px] text-gray-500 break-all mb-2.5">{payLink}</p>
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-1.5 bg-downy-600 text-white text-[13px] font-bold py-2.5 rounded-xl"
          >
            <FiCopy size={14} /> Copy pay link
          </button>
        </div>
      </div>
    </div>
  );
}
