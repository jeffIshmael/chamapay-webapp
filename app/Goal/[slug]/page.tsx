"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getGoalBySlug,
  goalTypeLabel,
  uploadGoalCover,
  setGoalYieldEnabled,
  GoalContribution,
  GoalFinance,
  GoalRecord,
  GoalWithdrawal,
} from "@/lib/goalService";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useAuth } from "@/app/context/AuthContext";
import { generateGoalPayUrl } from "@/lib/encryption";
import {
  FiArrowLeft,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiAlertTriangle,
  FiCamera,
  FiExternalLink,
  FiLink2,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
  FiX,
  FiZap,
} from "react-icons/fi";
import { showToast } from "@/app/Components/Toast";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import ProfileAvatar from "@/app/Components/ProfileAvatar";
import GoalAddMemberModal from "@/app/Components/GoalAddMemberModal";
import GoalWithdrawModal from "@/app/Components/GoalWithdrawModal";
import GoalDepositModal from "@/app/Components/GoalDepositModal";
import CoverCropModal from "@/app/Components/CoverCropModal";
import { getMoonwellUsdcSnapshot } from "@/lib/moonwellService";

type TabId = "members" | "history";

type HistoryItem =
  | {
      kind: "in";
      id: string;
      amount: number;
      label: string;
      avatar?: string | null;
      date: Date;
      txHash?: string;
    }
  | {
      kind: "out";
      id: string;
      amount: number;
      label: string;
      date: Date;
      txHash?: string;
    };

type MemberSlice = {
  key: string;
  name: string;
  avatar?: string | null;
  amount: number;
  color: string;
  /** Official goal member vs guest / stranger contributor */
  role: "member" | "guest" | "contributor";
};

const MEMBER_PALETTE = [
  "#3B82F6",
  "#6B7280",
  "#E5E7EB",
  "#F59E0B",
  "#10B981",
  "#0EA5E9",
  "#F97316",
  "#14B8A6",
  "#64748B",
  "#84CC16",
];

function relativeDay(d: Date) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (startToday.getTime() - startThen.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function GoalDetailsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const router = useRouter();
  const { token, address, isAuthenticated, isGuest, isLoading: authLoading } =
    useSessionAddress();
  const { user: authUser } = useAuth();
  const { formatBalance, formatUsdc, showUsdcPeek } = useFormattedBalance();
  const fileRef = useRef<HTMLInputElement>(null);
  const cropObjectUrlRef = useRef<string | null>(null);

  const [goal, setGoal] = useState<GoalRecord | null>(null);
  const [finance, setFinance] = useState<GoalFinance | null>(null);
  const [payLink, setPayLink] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coverUploading, setCoverUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [moonwellApy, setMoonwellApy] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("members");
  const [yieldBusy, setYieldBusy] = useState(false);
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (authLoading) return;
    if (!slug || !token || !isAuthenticated || isGuest || token === "guest") {
      setLoading(false);
      return;
    }
    try {
      if (!opts?.silent) setLoading(true);
      const res = await getGoalBySlug(slug, token);
      if (res.success && res.goal) {
        setGoal(res.goal);
        setFinance(res.finance ?? null);
        const creatorMatch =
          Boolean(res.isCreator) ||
          (authUser?.id != null &&
            Number(authUser.id) === Number(res.goal.creatorId));
        setIsCreator(creatorMatch);
        setPayLink(
          res.payLink || generateGoalPayUrl(res.goal.slug)
        );
      } else {
        setGoal(null);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [authLoading, slug, token, isAuthenticated, isGuest, authUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load, router]);

  useEffect(() => {
    if (!token || token === "guest" || isGuest) return;
    let cancelled = false;
    getMoonwellUsdcSnapshot(address || "", 0, token).then((snap) => {
      if (cancelled) return;
      if (typeof snap.supplyApy === "number" && Number.isFinite(snap.supplyApy)) {
        setMoonwellApy(snap.supplyApy);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, isGuest, address]);

  useEffect(() => {
    return () => {
      if (cropObjectUrlRef.current) {
        URL.revokeObjectURL(cropObjectUrlRef.current);
        cropObjectUrlRef.current = null;
      }
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payLink);
      showToast("Pay link copied", "success");
    } catch {
      showToast("Could not copy link", "warning");
    }
  };

  const clearCropPreview = () => {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
    setCropSrc(null);
    setShowCropModal(false);
  };

  const handleCoverFileSelected = (file: File | undefined) => {
    if (!file || !goal || !token || token === "guest") return;
    if (!isCreator) {
      showToast("Only the creator can change the photo", "warning");
      return;
    }
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    cropObjectUrlRef.current = url;
    setCropSrc(url);
    setShowCropModal(true);
  };

  const handleCroppedCover = async (file: File) => {
    if (!goal || !token || token === "guest") return;
    setCoverUploading(true);
    try {
      const res = await uploadGoalCover(goal.id, file, token);
      if (!res.success || !res.coverImageUrl) {
        showToast(res.error || "Upload failed", "error");
        return;
      }
      setGoal((g) => (g ? { ...g, coverImageUrl: res.coverImageUrl } : g));
      showToast("Cover photo updated", "success");
      clearCropPreview();
    } catch {
      showToast("Upload failed", "error");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleBack = () => {
    router.replace("/MyChamas?tab=goals");
  };

  const yieldOn = Boolean(finance?.yieldEnabled ?? goal?.yieldEnabled);

  const applyYieldToggle = async (enabled: boolean) => {
    if (!goal || !token || token === "guest" || !isCreator) return;
    setYieldBusy(true);
    try {
      const res = await setGoalYieldEnabled(goal.id, enabled, token);
      if (!res.success) {
        showToast(res.error || "Could not update yield", "error");
        return;
      }
      setFinance((f) => (f ? { ...f, yieldEnabled: enabled } : f));
      setGoal((g) => (g ? { ...g, yieldEnabled: enabled } : g));
      showToast(
        enabled ? "Money is going to work" : "Yield paused — funds stay idle",
        "success"
      );
      void load({ silent: true });
    } catch {
      showToast("Could not update yield", "error");
    } finally {
      setYieldBusy(false);
      setShowYieldModal(false);
    }
  };

  const onYieldSwitch = () => {
    if (!isCreator || yieldBusy) return;
    if (!yieldOn) {
      setShowYieldModal(true);
      return;
    }
    void applyYieldToggle(false);
  };

  const memberIds = useMemo(
    () => (goal?.members || []).map((m) => m.userId),
    [goal?.members]
  );

  const memberSlices = useMemo((): MemberSlice[] => {
    if (!goal) return [];
    const map = new Map<string, MemberSlice>();
    let colorIdx = 0;
    const memberIdSet = new Set(memberIds);

    const ensure = (
      key: string,
      name: string,
      role: MemberSlice["role"],
      avatar?: string | null
    ): MemberSlice => {
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          name,
          avatar,
          amount: 0,
          color: MEMBER_PALETTE[colorIdx % MEMBER_PALETTE.length],
          role,
        };
        colorIdx += 1;
        map.set(key, row);
      }
      return row;
    };

    for (const m of goal.members || []) {
      const isMe =
        authUser?.id != null && Number(m.userId) === Number(authUser.id);
      ensure(
        `u-${m.userId}`,
        isMe
          ? "You"
          : m.user?.userName
            ? `@${m.user.userName}`
            : "Member",
        "member",
        m.user?.profileImageUrl
      );
    }

    for (const c of goal.contributions || []) {
      const amt = parseFloat(c.amount) || 0;
      if (c.isGuest) {
        const key = `g-${(c.guestDisplayName || c.contributorAddress || "guest").toLowerCase()}`;
        const row = ensure(
          key,
          c.guestDisplayName || "Guest contributor",
          "guest"
        );
        row.amount += amt;
      } else if (c.contributorUser?.id != null) {
        const isOfficial = memberIdSet.has(c.contributorUser.id);
        const isMe =
          authUser?.id != null &&
          Number(c.contributorUser.id) === Number(authUser.id);
        const row = ensure(
          `u-${c.contributorUser.id}`,
          isMe
            ? "You"
            : c.contributorUser.userName
              ? `@${c.contributorUser.userName}`
              : "Contributor",
          isOfficial ? "member" : "contributor",
          c.contributorUser.profileImageUrl
        );
        row.amount += amt;
      } else {
        const addr = (c.contributorAddress || "unknown").toLowerCase();
        const row = ensure(
          `a-${addr}`,
          addr.length > 10
            ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
            : "Unknown",
          "contributor"
        );
        row.amount += amt;
      }
    }

    if (map.size === 0 && goal.creator) {
      const isMe =
        authUser?.id != null &&
        Number(goal.creatorId) === Number(authUser.id);
      ensure(
        `u-${goal.creatorId}`,
        isMe
          ? "You"
          : goal.creator.userName
            ? `@${goal.creator.userName}`
            : "You",
        "member",
        goal.creator.profileImageUrl
      );
    }

    return Array.from(map.values())
      .map((row) =>
        authUser?.id != null && row.key === `u-${authUser.id}`
          ? { ...row, name: "You" }
          : row
      )
      .sort((a, b) => b.amount - a.amount);
  }, [goal, memberIds, authUser?.id]);

  const history = useMemo((): HistoryItem[] => {
    if (!goal) return [];
    const ins: HistoryItem[] = (goal.contributions || []).map(
      (c: GoalContribution) => ({
        kind: "in" as const,
        id: `c-${c.id}`,
        amount: parseFloat(c.amount) || 0,
        label: c.isGuest
          ? c.guestDisplayName || "Guest"
          : c.contributorUser?.userName
            ? `@${c.contributorUser.userName}`
            : "Contribution",
        avatar: c.contributorUser?.profileImageUrl,
        date: new Date(c.createdAt),
        txHash: c.txHash,
      })
    );
    const outs: HistoryItem[] = (goal.withdrawals || []).map(
      (w: GoalWithdrawal) => ({
        kind: "out" as const,
        id: `w-${w.id}`,
        amount: parseFloat(w.amount) || 0,
        label: `Withdraw · ${w.mode}`,
        date: new Date(w.createdAt),
        txHash: w.txHash,
      })
    );
    return [...ins, ...outs].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [goal]);

  if (authLoading || loading) {
    return (
      <div className="absolute inset-0 flex flex-col bg-gray-50">
        <div className="shrink-0 relative h-[168px] overflow-hidden safe-top">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #0f4f4f 0%, #1a6b6b 45%, #2a9a8a 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/80 via-black/45 to-transparent" />
          <div className="relative h-full flex flex-col px-4 pt-1.5 pb-3">
            <div className="flex items-center justify-between min-h-[36px]">
              <button
                type="button"
                onClick={handleBack}
                className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/15"
                aria-label="Back"
              >
                <FiArrowLeft size={16} />
              </button>
              <div className="w-9" />
            </div>
            <div className="mt-auto space-y-2">
              <div className="h-4 w-16 rounded-md bg-white/25 animate-pulse" />
              <div className="h-6 w-48 max-w-[70%] rounded-md bg-white/35 animate-pulse" />
              <div className="h-3.5 w-28 rounded-md bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="px-4 -mt-3 relative z-10">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
            <div className="h-8 w-40 rounded bg-gray-100 animate-pulse" />
            <div className="h-2.5 w-full rounded-full bg-gray-100 animate-pulse" />
            <div className="flex gap-2 pt-1">
              <div className="h-10 flex-1 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-10 flex-1 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3 pb-1">
          <div className="h-10 rounded-xl bg-white border border-gray-100 animate-pulse" />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-4 pt-2 space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-gray-50 animate-pulse" />
                </div>
                <div className="h-3.5 w-14 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center px-5">
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
  const isGreen = progress >= 60;
  const yieldEarned = parseFloat(finance?.yieldEarned || "0") || 0;
  const inMw = parseFloat(finance?.moonwellUsdc || "0") || 0;
  const maxWithdrawable = parseFloat(finance?.maxWithdrawable || "0") || balance;
  const barDenom = target > 0 ? target : Math.max(balance, 1);
  const activeSlice = memberSlices.find((m) => m.key === selectedSlice);
  const canInviteMembers =
    goal.goalType === "invite" || goal.goalType === "public";
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/Goal/${goal.slug}`
      : `https://chamapay.com/goal/${goal.slug}`;

  const tabs: { id: TabId; label: string }[] = [
    { id: "members", label: "Members" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Cover photo hero — darken only near title */}
      <div className="shrink-0 relative h-[168px] overflow-hidden safe-top">
        {goal.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={goal.coverImageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, #0f4f4f 0%, #1a6b6b 45%, #2a9a8a 100%)",
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/80 via-black/45 to-transparent" />

        <div className="relative h-full flex flex-col px-4 pt-1.5 pb-3">
          <div className="flex items-center justify-between min-h-[36px]">
            <button
              type="button"
              onClick={handleBack}
              className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/15"
              aria-label="Back"
            >
              <FiArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5">
              {isCreator && canInviteMembers && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/25"
                  aria-label="Invite or add member"
                >
                  <FiUserPlus size={17} />
                </button>
              )}
              {isCreator && (
                <button
                  type="button"
                  disabled={coverUploading}
                  onClick={() => fileRef.current?.click()}
                  className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/15"
                  aria-label="Change cover"
                >
                  {coverUploading ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <FiCamera size={14} />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <div className="flex flex-wrap gap-1 mb-1.5">
              <span className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-semibold text-white border border-white/10">
                {goalTypeLabel(goal.goalType)}
              </span>
              {yieldOn && (
                <span className="bg-emerald-500/45 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-semibold text-white border border-white/10">
                  At work
                </span>
              )}
            </div>
            <h1 className="text-[1.2rem] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
              {goal.name}
            </h1>
            {goal.description && (
              <p className="text-[11px] text-white/90 mt-0.5 line-clamp-1 drop-shadow">
                {goal.description}
              </p>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            handleCoverFileSelected(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Fixed: balance + actions + yield */}
      <div className="shrink-0 px-4 -mt-3 relative z-[1] space-y-2.5">
        <section className="bg-white rounded-2xl border border-downy-100/80 shadow-md shadow-downy-900/5 px-4 py-3.5">
          <div className="flex items-end justify-between gap-3 mb-1">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Balance
              </p>
              <p className="text-[1.25rem] font-extrabold text-gray-900 tabular-nums leading-tight mt-0.5">
                {formatBalance(balance)}
                <span className="text-[12px] font-semibold text-gray-400">
                  {" "}
                  / {formatBalance(target)}
                </span>
              </p>
              {showUsdcPeek && (
                <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">
                  ≈ {formatUsdc(balance)} / {formatUsdc(target)}
                </p>
              )}
              {yieldOn && (
                <p className="text-[12px] font-semibold text-downy-600 tabular-nums mt-0.5">
                  Yield +{formatBalance(yieldEarned)}
                  {showUsdcPeek && (
                    <span className="text-gray-400 font-medium">
                      {" "}
                      (≈ {formatUsdc(yieldEarned)})
                    </span>
                  )}
                  {moonwellApy != null && (
                    <span className="text-downy-500/80 font-medium">
                      {" "}
                      · {moonwellApy.toFixed(2)}% APY
                    </span>
                  )}
                </p>
              )}
            </div>
            <p
              className={`text-[1.15rem] font-extrabold tabular-nums ${
                isGreen ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {progress.toFixed(0)}%
            </p>
          </div>
          {goal.endDate ? (
            <p className="text-[11px] text-gray-500 mb-2.5">
              Deadline{" "}
              <span className="font-semibold text-gray-700">
                {new Date(goal.endDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 mb-2.5">No deadline</p>
          )}

          <div className="relative">
            <div className="h-3.5 rounded-full bg-gray-100 overflow-hidden flex border border-gray-100">
              {memberSlices.map((m) => {
                const w = (m.amount / barDenom) * 100;
                if (w <= 0) return null;
                return (
                  <button
                    key={m.key}
                    type="button"
                    title={m.name}
                    onClick={() =>
                      setSelectedSlice((k) => (k === m.key ? null : m.key))
                    }
                    className={`h-full transition-all duration-300 first:rounded-l-full focus:outline-none focus-visible:ring-2 focus-visible:ring-downy-500 focus-visible:ring-offset-1 ${
                      selectedSlice === m.key ? "brightness-110 scale-y-110" : ""
                    }`}
                    style={{
                      width: `${Math.max(w, 1.2)}%`,
                      backgroundColor: m.color,
                      boxShadow:
                        m.color === "#E5E7EB"
                          ? "inset 0 0 0 1px #d1d5db"
                          : undefined,
                      minWidth: w > 0 ? 4 : 0,
                    }}
                  />
                );
              })}
            </div>

            {activeSlice && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-gray-900 text-white px-3 py-2 shadow-lg">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/30"
                  style={{ backgroundColor: activeSlice.color }}
                />
                <p className="text-[12px] font-bold truncate flex-1">
                  {activeSlice.name}
                </p>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-bold tabular-nums">
                    {formatBalance(activeSlice.amount)}
                  </p>
                  {showUsdcPeek && (
                    <p className="text-[10px] text-white/55 tabular-nums">
                      ≈ {formatUsdc(activeSlice.amount)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSlice(null)}
                  className="text-white/60 hover:text-white"
                  aria-label="Dismiss"
                >
                  <FiX size={14} />
                </button>
              </div>
            )}

            {!activeSlice && memberSlices.some((m) => m.amount > 0) && (
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                Tap a color to see who contributed
              </p>
            )}
            {!memberSlices.some((m) => m.amount > 0) && (
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                No contributions yet — deposit or share the pay link
              </p>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowDepositModal(true)}
            className="flex items-center justify-center gap-1.5 bg-white border border-downy-600 text-downy-700 text-[13px] font-bold py-3 rounded-xl"
          >
            <FiArrowUpCircle size={16} />
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            disabled={!isCreator || balance <= 0}
            className="flex items-center justify-center gap-1.5 border border-gray-200 bg-white text-gray-800 text-[13px] font-bold py-3 rounded-xl disabled:opacity-40"
          >
            <FiArrowDownCircle size={16} />
            Withdraw
          </button>
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-downy-700"
        >
          <FiLink2 size={14} />
          Copy pay link
          <span className="font-normal text-gray-400">
            · anyone can contribute
          </span>
        </button>

        {/* Put your savings to work — fixed above tabs */}
        <section className="bg-white rounded-2xl border border-downy-100/80 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span
                className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                  yieldOn
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                <FiZap size={15} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[13px] font-bold text-gray-900">
                  Put your savings to work
                </h2>
                <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                  {yieldOn
                    ? "Earning on Moonwell"
                    : "Earn yield while you save"}
                  {moonwellApy != null && (
                    <span className="text-downy-600 font-bold">
                      {" "}
                      · {moonwellApy.toFixed(2)}% APY
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={yieldOn}
              disabled={!isCreator || yieldBusy}
              onClick={onYieldSwitch}
              className={`relative h-7 w-12 rounded-full transition-colors shrink-0 ${
                yieldOn ? "bg-emerald-500" : "bg-gray-200"
              } ${!isCreator ? "opacity-50" : ""}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  yieldOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {yieldOn && (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-emerald-50/80 px-2.5 py-2 border border-emerald-100">
                <p className="text-[9px] font-semibold text-gray-400 uppercase">
                  In Moonwell
                </p>
                <p className="text-[13px] font-extrabold text-gray-900 tabular-nums mt-0.5">
                  {formatBalance(inMw)}
                </p>
                {showUsdcPeek && (
                  <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                    ≈ {formatUsdc(inMw)}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-emerald-50/80 px-2.5 py-2 border border-emerald-100">
                <p className="text-[9px] font-semibold text-gray-400 uppercase">
                  Yield earned
                </p>
                <p className="text-[13px] font-extrabold text-emerald-600 tabular-nums mt-0.5">
                  +{formatBalance(yieldEarned)}
                </p>
                {showUsdcPeek && (
                  <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                    ≈ {formatUsdc(yieldEarned)}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Tabs — Members & History only */}
      <div className="shrink-0 px-4 pt-2.5 pb-1">
        <div className="flex rounded-xl bg-white border border-gray-100 p-0.5 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-[10px] text-[12px] font-bold transition-colors ${
                tab === t.id
                  ? "bg-downy-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-10 space-y-3 pt-2 [-webkit-overflow-scrolling:touch]">
        {tab === "members" && (
          <section className="bg-white rounded-2xl border border-downy-100/80 shadow-sm px-4 py-3.5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-[13px] font-bold text-gray-900">
                  Contributors
                </h2>
                <p className="text-[11px] text-gray-500">
                  Colors match the balance bar
                </p>
              </div>
              {isCreator && canInviteMembers && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="h-8 px-2.5 rounded-lg bg-downy-50 text-downy-700 text-[11px] font-bold flex items-center gap-1"
                >
                  <FiUserPlus size={13} />
                  Invite
                </button>
              )}
            </div>

            <ul className="mt-2 space-y-0">
              {memberSlices.map((m, i) => {
                const pct =
                  barDenom > 0 ? (m.amount / barDenom) * 100 : 0;
                const roleLabel =
                  m.role === "guest"
                    ? "Guest"
                    : m.role === "contributor"
                      ? "Contributor"
                      : "Member";
                return (
                  <li
                    key={m.key}
                    className={`flex items-center gap-3 py-3 ${
                      i < memberSlices.length - 1
                        ? "border-b border-gray-50"
                        : ""
                    }`}
                  >
                    <div className="relative">
                      <ProfileAvatar
                        src={m.avatar}
                        name={m.name}
                        size={42}
                        className="bg-gray-100 text-gray-600"
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
                        style={{
                          backgroundColor: m.color,
                          boxShadow:
                            m.color === "#E5E7EB"
                              ? "inset 0 0 0 1px #d1d5db"
                              : undefined,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {m.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {roleLabel}
                        {" · "}
                        <span className="font-semibold text-gray-700">
                          {pct.toFixed(0)}%
                        </span>{" "}
                        of target
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-gray-900 tabular-nums">
                        {formatBalance(m.amount)}
                      </p>
                      {showUsdcPeek && (
                        <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                          ≈ {formatUsdc(m.amount)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
              {memberSlices.length === 0 && (
                <p className="text-[12px] text-gray-500 text-center py-6">
                  No contributors yet.
                </p>
              )}
            </ul>
          </section>
        )}

        {tab === "history" && (
          <section className="bg-white rounded-2xl border border-downy-100/80 shadow-sm px-4 py-3.5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <FiTrendingUp size={15} />
              </span>
              <div>
                <h2 className="text-[13px] font-bold text-gray-900">History</h2>
                <p className="text-[11px] text-gray-500">
                  Contributions & withdrawals
                </p>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] font-semibold text-gray-700">
                  No movement yet
                </p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[14rem] mx-auto leading-relaxed">
                  Share the pay link — the first deposit will show up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-0">
                {history.map((item, i) => (
                  <li
                    key={item.id}
                    className={`flex items-center gap-3 py-3 ${
                      i < history.length - 1 ? "border-b border-gray-50" : ""
                    }`}
                  >
                    {item.kind === "in" ? (
                      <ProfileAvatar
                        src={item.avatar}
                        name={item.label}
                        size={40}
                        className="bg-emerald-50 text-emerald-700"
                      />
                    ) : (
                      <span className="h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                        OUT
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {relativeDay(item.date)}
                        {" · "}
                        {item.date.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-[13px] font-bold tabular-nums ${
                          item.kind === "in"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {item.kind === "in" ? "+" : "−"}
                        {formatBalance(item.amount)}
                      </p>
                      {showUsdcPeek && (
                        <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                          ≈ {formatUsdc(item.amount)}
                        </p>
                      )}
                      {item.txHash && (
                        <a
                          href={`https://basescan.org/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Tx <FiExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {goal.creator?.userName && (
          <p className="text-center text-[11px] text-gray-400 pb-2 pt-1">
            Created by @{goal.creator.userName}
          </p>
        )}
      </div>

      {/* Yield explain modal — matches Application create-goal details */}
      {showYieldModal && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/55">
          <div
            className="absolute inset-0"
            onClick={() => !yieldBusy && setShowYieldModal(false)}
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
                  disabled={yieldBusy}
                  onClick={() => setShowYieldModal(false)}
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
                    {moonwellApy != null && (
                      <span className="text-downy-600 font-extrabold">
                        {" "}
                        · {moonwellApy.toFixed(2)}% now
                      </span>
                    )}
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
                disabled={yieldBusy}
                onClick={() => void applyYieldToggle(true)}
                className="w-full py-3.5 rounded-2xl bg-downy-600 text-white text-[15px] font-bold flex items-center justify-center shadow-md shadow-downy-600/20"
              >
                {yieldBusy ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  "Turn on"
                )}
              </button>
              <button
                type="button"
                disabled={yieldBusy}
                onClick={() => setShowYieldModal(false)}
                className="w-full py-3 mt-0.5 text-[13px] font-medium text-gray-500"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <GoalAddMemberModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => void load({ silent: true })}
        goalId={goal.id}
        goalName={goal.name}
        inviteLink={inviteLink}
        memberIds={memberIds}
      />

      <GoalWithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={() => void load({ silent: true })}
        goalId={goal.id}
        goalName={goal.name}
        balance={balance}
        maxWithdrawable={maxWithdrawable}
      />

      <GoalDepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={() => void load({ silent: true })}
        goalId={goal.id}
        goalName={goal.name}
      />

      <CoverCropModal
        open={showCropModal}
        imageSrc={cropSrc}
        onCancel={clearCropPreview}
        onConfirm={handleCroppedCover}
      />
    </div>
  );
}
