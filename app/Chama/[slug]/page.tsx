"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import ChamaOverview from "@/app/Components/ChamaOverview";
import ScheduleTab from "@/app/Components/ScheduleTab";
import ChamaTour from "@/app/Components/ChamaTour";
import MembersTab from "@/app/Components/MembersTab";
import Chat from "@/app/Components/Chat";
import {
  getChamaBySlug as getChama,
  requestToJoinChama,
  addMemberToChama as addMemberToPublicChama,
  checkRequest,
  transformChamaData,
  setManualPayoutOrder,
  updateChamaDetails,
  removeMemberFromChama
} from "@/lib/chamaService";
import { duration, formatTimeRemaining, getPicture } from "@/utils/duration";
import Pay from "@/app/Components/Pay";
import ChamaShareModal from "@/app/Components/ChamaShareModal";
import ChamaAddMemberModal from "@/app/Components/ChamaAddMemberModal";
import ChamaEditModal, {
  ChamaEditValues,
} from "@/app/Components/ChamaEditModal";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiEdit3, FiShare2, FiUserPlus } from "react-icons/fi";
import { showToast } from "@/app/Components/Toast";
import { HiArrowLeft } from "react-icons/hi";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { JoinedChama, Member } from "@/utils/typesUtils";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { normalizeUsdcAmount, normalizeChamaBalance } from "@/lib/normalizeUsdc";
import { setPendingChamaFromSlug, clearPendingChamaInvite } from "@/lib/pendingInvite";

type TabId = "overview" | "chat" | "schedule" | "members";

interface User {
  chamaId: number;
  id: number;
  payDate: Date;
  incognito: boolean;
  user: {
    id: number;
    address: string;
    name: string | null;
    isFarcaster: boolean;
    fid: number | null;
  };
  userId: number;
  isPaid: boolean;
}
interface Chama {
  adminId: number;
  amount: bigint | string | number;
  createdAt: Date;
  cycleTime: number;
  id: number;
  maxNo: number;
  blockchainId: string;
  members: User[];
  payOutOrder: string | null;
  name: string;
  round: number;
  cycle: number;
  canJoin: boolean;
  payDate: Date;
  slug: string;
  startDate: Date;
  started: boolean;
  type: string;
  admin: {
    id: number;
    address: string;
    name: string | null;
    isFarcaster: boolean;
    fid: number | null;
  };
  userBalance?: string | string[];
  eachMemberBalance?: Record<string, string> | [string[], string[][]];
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "Chats" },
  { id: "schedule", label: "Schedule" },
  { id: "members", label: "Members" },
];

const AVATAR_COLORS = [
  "from-downy-600 to-downy-800",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-indigo-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
];

// Shows the chama picture, but falls back to a coloured circle with the
// chama's initials if the image fails to load (IPFS gateways can be flaky).
const ChamaAvatar = ({
  id,
  name,
  size = 72,
}: {
  id: number;
  name: string;
  size?: number;
}) => {
  const [failed, setFailed] = useState(false);
  const initials = (name || "C")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={`relative rounded-full overflow-hidden ring-4 ring-white/30 shadow-lg bg-gradient-to-br ${
        AVATAR_COLORS[id % AVATAR_COLORS.length]
      } flex items-center justify-center text-white font-bold`}
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {initials}
      {!failed && (
        <Image
          src={`https://ipfs.io/ipfs/Qmd1VFua3zc65LT93Sv81VVu6BGa2QEuAakAFJexmRDGtX/${getPicture(
            id
          )}.jpg`}
          alt={name}
          width={size}
          height={size}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  children,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 ${className}`}
  >
    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">
      {label}
    </p>
    <p className="text-[15px] font-semibold text-gray-800 mt-1">{value}</p>
    {children}
  </div>
);

const ChamaDetails = ({ params }: { params: { slug: string } }) => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [chama, setChama] = useState<Chama | null>(null);
  const [joined, setJoined] = useState<JoinedChama | null>(null);
  const [cycle, setCycle] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [payRecipient, setPayRecipient] = useState<{
    userId: number;
    userName: string;
    remainingAmount?: number;
  } | null>(null);
  const [error, setError] = useState("");
  const { address, isAuthenticated, user } = useSessionAddress();
  const [chamaType, setChamaType] = useState("");
  const [included, setIncluded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fetchingChama, setFetchingChama] = useState(true);
  const [hasRequest, setHasRequest] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const router = useRouter();
  const { token, user: authUser } = useAuth();
  const { formatBalance } = useFormattedBalance();

  const openPay = (
    recipient?: {
      userId: number;
      userName: string;
      remainingAmount?: number;
    } | null
  ) => {
    setPayRecipient(recipient ?? null);
    setIsOpen(true);
  };

  const closePay = () => {
    setIsOpen(false);
    setPayRecipient(null);
  };

  const myRemaining = joined
    ? Math.max(
        0,
        (Number(joined.contribution) || 0) -
          normalizeChamaBalance(joined.userBalance)
      )
    : 0;
  const payRemainingAmount =
    payRecipient?.remainingAmount != null
      ? payRecipient.remainingAmount
      : myRemaining;

  const refreshChama = useCallback(async () => {
    if (!isAuthenticated) return;
    setFetchingChama(true);
    const data = await getChama(
      params.slug,
      token || undefined,
      address as string
    );

    if (data && data.success && data.chama) {
      setChama(data.chama as any);
      setIncluded(data.isMember ?? false);
      setAdminWallet(data.adminWallet || null);
      const time = await duration(data.chama.cycleTime || 0);
      setCycle(time);
      setChamaType(data.chama.type || "");
      setJoined(transformChamaData(data.chama, (address as string) || ""));

      const result = await checkRequest(
        address as string,
        data.chama.id ?? 0,
        token || undefined
      );
      setHasRequest(Boolean(result));
      if (
        (data.chama.members?.length ?? 0) >= (data.chama.maxNo ?? 0) &&
        data.chama.maxNo > 0
      ) {
        setIsFull(true);
      }
    }
    setFetchingChama(false);
  }, [address, params.slug, token, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Preserve invite through signup so we return to this chama after auth.
      setPendingChamaFromSlug(params.slug);
      router.replace("/");
    } else {
      clearPendingChamaInvite();
    }
  }, [isAuthenticated, router, params.slug]);

  useEffect(() => {
    if (isAuthenticated) refreshChama();
  }, [isAuthenticated, refreshChama]);

  // Saves the payout order (throws on failure). Used by the Schedule tab and
  // by the Edit modal.
  const saveOrder = async (orderedUserIds: number[]) => {
    if (!chama || !token || !joined) throw new Error("Not authenticated");
    // The server expects member smart addresses in payout order.
    const payoutOrder = orderedUserIds.map((id) => {
      const m = joined.members.find((mem) => mem.id === id);
      if (!m?.smartAddress) throw new Error("A member has no smart address");
      return m.smartAddress;
    });
    const res = await setManualPayoutOrder(chama.id, payoutOrder, token);
    if (!res?.success) throw new Error(res?.error || "Failed to save order");
  };

  const handleSaveManualOrder = async (orderedUserIds: number[]) => {
    await saveOrder(orderedUserIds);
    showToast("Payout order saved", "success");
    refreshChama();
    setActiveTab("schedule" as TabId);
  };

  const handleUpdateDetails = async (values: ChamaEditValues) => {
    if (!chama || !token || !joined) throw new Error("Please refresh the page");

    // The server expects member smart addresses in payout order (only when it changed).
    const orderAddresses = values.payoutOrder?.map((id) => {
      const m = joined.members.find((mem) => mem.id === id);
      if (!m?.smartAddress) throw new Error("A member has no smart address");
      return m.smartAddress;
    });

    // One request: the backend compares with what is stored and sends a single atomic
    // onchain transaction (details, pay day and payout order) only for what changed,
    // so there is no "details saved but order failed" half-state any more.
    const res = await updateChamaDetails(
      Number(chama.id),
      values.name,
      values.amount,
      values.duration,
      Number(joined.currentCycle), // cycle and round are no longer editable
      Number(joined.currentRound),
      values.payDate,
      token,
      values.monthlyDay, // null switches back to a days-based cycle
      orderAddresses
    );
    if (!res?.success) {
      throw new Error(res?.error || "Failed to update chama");
    }

    showToast("Chama updated successfully", "success");
    setShowEditModal(false);
    refreshChama();
  };

  const handleRemoveMember = async (member: Member) => {
    if (!token) {
      throw new Error("You need to be logged in to remove a member.");
    }

    if (!chama) {
      throw new Error("Please refresh page");
    }

    const res = await removeMemberFromChama(
      Number(chama.id),
      Number(member.id), // member.id is the user id, which the backend expects as memberUserId
      token
    );

    // Throwing makes the modal stay open and show the error message
    if (!res?.success) {
      throw new Error(res?.error || "Failed to remove member. Please try again.");
    }

    showToast(`${member.name} successfully removed.`, "success");

    // Refresh so the removed member disappears from the list
    await refreshChama();
  };

  const joinChama = async () => {
    // Joining is only allowed during round 1.
    if ((chama?.round ?? 1) > 1) {
      showToast(
        "This chama is in the middle of a cycle. You can't join right now.",
        "warning"
      );
      return;
    }

    if (!isAuthenticated || !address) {
      showToast("Please sign in to join", "warning");
      return;
    }

    try {
      setSendingRequest(true);
      if (!token) throw new Error("Not authenticated");
      const request = await requestToJoinChama(
        address as string,
        chama?.id ?? 0,
        token
      );
      if (!request) {
        showToast(
          "✅ Join request sent to admin. wait for approval.",
          "success"
        );
        setHasRequest(true);
        return;
      }
      showToast("You already sent a request.", "warning");
    } catch (error: unknown) {
      console.log(error);
      showToast("An error occurred while sending the join request.", "error");
    } finally {
      setSendingRequest(false);
    }
  };

  const joinPublicChama = async () => {
    setError("");

    // Joining is only allowed during round 1.
    if ((chama?.round ?? 1) > 1) {
      showToast(
        "This chama is in the middle of a cycle. You can't join right now.",
        "warning"
      );
      return;
    }

    if (!isAuthenticated || !address || !user?.id) {
      setError("Please sign in to join");
      return;
    }

    try {
      setProcessing(true);
      setLoading(true);
      if (!token) throw new Error("Not authenticated");

      const amountStr =
        typeof chama?.amount === "bigint"
          ? (Number(chama.amount) / 1e6).toString()
          : String(chama?.amount ?? "0");

      const result = await addMemberToPublicChama(
        chama?.id ?? 0,
        true,
        Number(user.id),
        amountStr,
        token
      );

      if (!result.success) {
        setError(result.error || "Unable to join chama");
        return;
      }

      showToast(`successfully joined ${chama?.name}`, "success");
      setShowModal(false);
      router.push("/MyChamas");
    } catch (err) {
      console.error("Error joining chama:", err);
      setError("An error occurred while joining the chama.");
    } finally {
      setProcessing(false);
      setLoading(false);
    }
  };

  const contributionLabel = () => {
    if (joined) {
      return `${formatBalance(joined.contribution, true)} / ${joined.frequency}`;
    }
    const display = normalizeUsdcAmount(chama?.amount ?? 0);
    return `${formatBalance(display, true)} / ${cycle}`;
  };

  if (fetchingChama || !chama) {
    return (
      <div className="min-h-[100dvh] bg-gray-50">
        <div className="bg-downy-700 rounded-b-2xl px-4 pt-4 pb-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
            <div className="flex-1 px-4 space-y-2">
              <div className="h-4 w-32 mx-auto rounded bg-white/25 animate-pulse" />
              <div className="h-3 w-16 mx-auto rounded-full bg-white/15 animate-pulse" />
            </div>
            <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center space-y-1.5">
                <div className="h-2.5 w-12 mx-auto rounded bg-white/20 animate-pulse" />
                <div className="h-4 w-8 mx-auto rounded bg-white/25 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pt-3">
          <div className="h-10 rounded-lg bg-gray-200 animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-40 rounded-2xl bg-white border border-gray-100 animate-pulse" />
            <div className="h-36 rounded-2xl bg-white border border-gray-100 animate-pulse" />
            <div className="h-28 rounded-2xl bg-white border border-gray-100 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-300 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-xs">
          <h3 className="font-medium text-lg mb-2">Sign in required</h3>
          <p className="text-gray-500 mb-6 text-sm">
            Sign in with Google or email to view this chama
          </p>
          <Link
            href="/"
            className="block w-full py-2 bg-downy-600 text-white rounded-lg hover:bg-downy-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Discover / join view for non-members
  if (!included) {
    const isFirstRound = (chama.round ?? 1) <= 1;
    const isPublicChama = chamaType?.toLowerCase() === "public";
    const memberCount = chama.members?.length || 0;
    const fillPct =
      chama.maxNo > 0 ? Math.min(100, (memberCount / chama.maxNo) * 100) : 0;
    const dateLabel = new Date(
      chama.started ? chama.payDate : chama.startDate
    ).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        {/* Join confirmation modal */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              {error && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl mb-4 flex items-start gap-2"
                  role="alert"
                >
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                Join {chama.name}?
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                You will lock the required collateral via your Chamapay wallet.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                  disabled={loading || processing}
                >
                  Cancel
                </button>
                <button
                  onClick={joinPublicChama}
                  disabled={loading || processing}
                  className="flex-1 py-3 bg-downy-600 text-white rounded-xl font-semibold disabled:opacity-60"
                >
                  {loading || processing ? "Joining..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero header */}
        <div className="bg-gradient-to-b from-downy-700 to-downy-600 rounded-b-3xl px-4 pt-4 pb-8 text-white safe-top">
          <button
            type="button"
            onClick={() => router.replace("/MyChamas")}
            className="p-2 rounded-full bg-white/10 text-white"
            aria-label="Back"
          >
            <HiArrowLeft size={18} />
          </button>

          <div className="flex flex-col items-center text-center mt-1">
            <ChamaAvatar id={Number(chama.id)} name={chama.name} />
            <h1 className="text-xl font-bold mt-3 px-4 break-words">
              {chama.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  isPublicChama ? "bg-emerald-500/30" : "bg-white/15"
                }`}
              >
                {isPublicChama ? "🌍 Public" : "🔒 Private"}
              </span>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15">
                {chama.started ? `Round ${chama.round}` : "Not started"}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 -mt-4 pb-32 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Contribution" value={contributionLabel()} />
            <StatCard
              label="Members"
              value={`${memberCount}${chama.maxNo ? ` / ${chama.maxNo}` : ""}`}
            >
              {chama.maxNo > 0 && (
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-downy-500 rounded-full"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              )}
            </StatCard>
            <StatCard
              label={chama.started ? "Next payout" : "Starts"}
              value={dateLabel}
              className="col-span-2"
            />
          </div>

          {/* Status notice */}
          {isFull ? (
            <div className="rounded-2xl bg-gray-100 border border-gray-200 p-3.5 text-sm text-gray-600">
              This chama is full and not accepting new members.
            </div>
          ) : !isFirstRound ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex gap-3">
              <FiAlertTriangle
                className="text-amber-600 mt-0.5 shrink-0"
                size={18}
              />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Chama is in the middle of a cycle
                </p>
                <p className="text-[13px] text-amber-700 mt-0.5">
                  New members can only join during round 1. This chama is on
                  round {chama.round}, so you can&apos;t join right now.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-downy-50 border border-downy-100 p-3.5">
              <p className="text-sm font-semibold text-downy-800">
                Open for new members
              </p>
              <p className="text-[13px] text-downy-700 mt-0.5">
                {isPublicChama
                  ? "Join instantly by locking your collateral."
                  : "Send a request and the admin will review it."}
              </p>
            </div>
          )}

          {/* How it works */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              How a chama works
            </p>
            <ul className="space-y-2.5 text-[13px] text-gray-600">
              <li className="flex gap-2.5">
                <span className="text-downy-600 font-bold">1.</span>
                Everyone contributes the same amount every cycle.
              </li>
              <li className="flex gap-2.5">
                <span className="text-downy-600 font-bold">2.</span>
                Each cycle, one member receives the full pot.
              </li>
              <li className="flex gap-2.5">
                <span className="text-downy-600 font-bold">3.</span>
                Everyone gets a turn before the round ends.
              </li>
            </ul>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-gray-100 px-4 pt-3 pb-5 safe-bottom">
          {isFull ? (
            <button
              disabled
              className="w-full py-3.5 rounded-xl font-semibold bg-gray-200 text-gray-500 cursor-not-allowed"
            >
              Chama is full
            </button>
          ) : !isFirstRound ? (
            <>
              <button
                disabled
                className="w-full py-3.5 rounded-xl font-semibold bg-gray-200 text-gray-500 cursor-not-allowed"
              >
                {isPublicChama ? "Join Chama" : "Request to Join"}
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">
                This chama is in the middle of a cycle, so you can&apos;t join
                currently.
              </p>
            </>
          ) : isPublicChama ? (
            <button
              onClick={() => {
                setError("");
                setShowModal(true);
              }}
              className="w-full py-3.5 bg-downy-600 active:bg-downy-700 text-white rounded-xl font-semibold shadow-sm"
            >
              Join Chama
            </button>
          ) : hasRequest ? (
            <button
              disabled
              className="w-full py-3.5 rounded-xl font-semibold bg-downy-100 text-downy-700 cursor-default"
            >
              ⏳ Request pending approval
            </button>
          ) : (
            <button
              onClick={joinChama}
              disabled={sendingRequest}
              className="w-full py-3.5 bg-downy-600 active:bg-downy-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-60"
            >
              {sendingRequest ? "Sending..." : "Request to Join"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-[100dvh] bg-gray-50">
        <div className="bg-downy-700 rounded-b-2xl px-4 pt-4 pb-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => router.replace("/MyChamas")}
              className="p-2 rounded-full bg-white/10 text-white"
              aria-label="Back"
            >
              <HiArrowLeft size={18} />
            </button>
            <div className="flex-1 text-center px-2">
              <h1 className="text-[16px] font-semibold truncate">
                {chama.name}
              </h1>
              <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15">
                Loading…
              </span>
            </div>
            <div className="w-9" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 w-12 mx-auto rounded bg-white/20 animate-pulse" />
                <div className="h-4 w-8 mx-auto rounded bg-white/25 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pt-3 space-y-3">
          <div className="h-10 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white border border-gray-100 animate-pulse" />
          <div className="h-36 rounded-2xl bg-white border border-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  const hasSchedule = (joined.payoutSchedule?.length || 0) > 0;
  const isActive = joined.status === "active";
  const isAdmin =
    joined.members?.some(
      (m) => m.id === authUser?.id && m.role === "Admin"
    ) ?? false;
  const canAddMembers = Boolean(isAdmin && joined.canJoin);
  // Payout order can only be changed by an admin during the first round.
  const canEditOrder = Boolean(
    canAddMembers &&
      (joined.currentRound ?? 1) <= 1 &&
      (joined.members?.length ?? 0) > 1
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      <ChamaTour
        userId={authUser?.id}
        enabled={included}
        canAddMembers={canAddMembers}
        onSwitchTab={(t) => setActiveTab(t as TabId)}
      />
      {/* Fixed header */}
      <div className="bg-downy-700 rounded-b-2xl px-4 pt-4 pb-4 text-white shrink-0 safe-top">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.replace("/MyChamas")}
            className="p-2 rounded-full bg-white/10 text-white"
            aria-label="Back"
          >
            <HiArrowLeft size={18} />
          </button>
          <div className="flex-1 text-center px-2">
            <h1 className="text-[16px] font-semibold truncate">{joined.name}</h1>
            <span
              className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                joined.isPublic ? "bg-emerald-500/30" : "bg-white/15"
              }`}
            >
              {joined.isPublic ? "🌍 Public" : "🔒 Private"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {canAddMembers && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="p-2 rounded-full bg-white/10 text-white"
                  data-tour="edit-details"
                  aria-label="Edit chama details"
                >
                  <FiEdit3 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(true)}
                  className="p-2 rounded-full bg-white/10 text-white"
                  data-tour="add-member"
                  aria-label="Add member"
                >
                  <FiUserPlus size={18} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="p-2 rounded-full bg-white/10 text-white"
              data-tour="share"
              aria-label="Share"
            >
              <FiShare2 size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-emerald-100 text-[10px]">My Position</p>
            <p className="text-[15px] font-semibold mt-0.5">
              {hasSchedule && joined.myPosition ? `#${joined.myPosition}` : "--"}
            </p>
          </div>
          <div>
            <p className="text-emerald-100 text-[10px]">Next Position</p>
            <p className="text-[15px] font-semibold mt-0.5">
              {hasSchedule ? `#${joined.currentTurnMemberPosition}` : "--"}
            </p>
          </div>
          <div>
            <p className="text-emerald-100 text-[10px]">My Turn in</p>
            <p className="text-[15px] font-semibold mt-0.5">
              {hasSchedule ? formatTimeRemaining(joined.myTurnDate) : "--"}
            </p>
          </div>
        </div>

        {!isActive && !hasSchedule && (
          <div className="mt-3 bg-amber-500/20 border border-amber-300/40 rounded-xl px-3 py-2 text-center">
            <p className="text-[12px] font-semibold text-amber-50">
              Schedule pending
            </p>
            <p className="text-[11px] text-amber-100/90 mt-0.5">
              Payout order appears when the chama begins
            </p>
          </div>
        )}
      </div>

      {/* Fixed tabs */}
      <div className="shrink-0 px-4 pt-3 bg-gray-50">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-tour={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-1 rounded-md text-[12px] font-medium transition ${
                activeTab === tab.id
                  ? "bg-downy-200 text-downy-700"
                  : "bg-transparent text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === "overview" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 [-webkit-overflow-scrolling:touch]">
            <ChamaOverview
              chama={joined}
              userAddress={(address as string) || ""}
              onPay={openPay}
            />
          </div>
        )}

        {activeTab === "chat" && (
          <div className="flex-1 min-h-0 flex flex-col mt-2">
            <Chat chamaId={Number(chama.id)} />
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 [-webkit-overflow-scrolling:touch]">
            <ScheduleTab
              payoutSchedule={joined.payoutSchedule || []}
              currentUserAddress={(address as string) || ""}
              chamaStatus={joined.status}
              members={joined.members}
              contributionAmount={joined.contribution}
              totalPayout={joined.nextPayoutAmount}
              currentCycle={joined.currentCycle}
              currentRound={joined.currentRound}
              isAdmin={isAdmin}
              startDate={chama.startDate}
              firstPayoutDate={chama.payDate}
              onSaveManualOrder={handleSaveManualOrder}
            />
          </div>
        )}

        {activeTab === "members" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 [-webkit-overflow-scrolling:touch]">
            <MembersTab
              members={joined.members}
              eachMemberBalances={joined.eachMemberBalance || null}
              isPublic={joined.isPublic}
              contributionAmount={joined.contribution}
              canRemoveMember={canAddMembers}
              onRemoveMember={handleRemoveMember}
            />
          </div>
        )}
      </div>

      {isOpen && joined && (
        <Pay
          openModal={isOpen}
          closeModal={closePay}
          chamaId={Number(chama.id)}
          chamaName={chama.name}
          chamaBlockchainId={Number(chama.blockchainId)}
          recipient={payRecipient}
          remainingAmount={payRemainingAmount}
          contributionAmount={joined.contribution}
        />
      )}

      {chama && (
        <ChamaShareModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          chamaName={chama.name}
          chamaSlug={chama.slug}
          memberIds={(joined?.members || []).map((m) => m.id)}
        />
      )}

      {joined && (
        <ChamaAddMemberModal
          open={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={() => refreshChama()}
          chamaId={Number(joined.id)}
          isPublic={joined.isPublic}
          contribution={joined.contribution}
          memberIds={(joined.members || []).map((m) => m.id)}
        />
      )}

      {joined && canAddMembers && (
        <ChamaEditModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateDetails}
          members={joined.members || []}
          payoutSchedule={joined.payoutSchedule || []}
          canEditOrder={canEditOrder}
          initial={{
            name: joined.name,
            amount: joined.contribution,
            duration: joined.duration,
            payDate: joined.contributionDueDate,
            monthlyDay: joined.payDay ?? null, // fixed pay day (1-28), null = days-based
          }}
        />
      )}
    </div>
  );
};

export default ChamaDetails;