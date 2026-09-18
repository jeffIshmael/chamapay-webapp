"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import ChamaOverview from "@/app/Components/ChamaOverview";
import ScheduleTab from "@/app/Components/ScheduleTab";
import MembersTab from "@/app/Components/MembersTab";
import Chat from "@/app/Components/Chat";
import {
  getChamaBySlug as getChama,
  requestToJoinChama,
  addMemberToChama as addMemberToPublicChama,
  checkRequest,
  transformChamaData,
} from "@/lib/chamaService";
import { duration, formatTimeRemaining, getPicture } from "@/utils/duration";
import Pay from "@/app/Components/Pay";
import ChamaShareModal from "@/app/Components/ChamaShareModal";
import ChamaAddMemberModal from "@/app/Components/ChamaAddMemberModal";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiShare2, FiUserPlus } from "react-icons/fi";
import { showToast } from "@/app/Components/Toast";
import { HiArrowLeft } from "react-icons/hi";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { JoinedChama } from "@/utils/typesUtils";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { normalizeUsdcAmount, normalizeChamaBalance } from "@/lib/normalizeUsdc";

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
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) refreshChama();
  }, [isAuthenticated, refreshChama]);

  const joinChama = async () => {
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
    return (
      <div className="bg-downy-100 min-h-screen flex flex-col items-center py-1">
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white p-6 rounded-xl shadow-lg w-96">
              {error && (
                <div
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                  role="alert"
                >
                  <FiAlertTriangle className="inline mr-2" />
                  {error}
                </div>
              )}
              <h3 className="text-lg font-semibold mb-2">Join {chama.name}?</h3>
              <p className="text-sm text-gray-600 mb-4">
                You will lock the required collateral via your Chamapay wallet.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-gray-200 rounded-lg"
                  disabled={loading || processing}
                >
                  Cancel
                </button>
                <button
                  onClick={joinPublicChama}
                  disabled={loading || processing}
                  className="flex-1 py-2 bg-downy-600 text-white rounded-lg"
                >
                  {loading || processing ? "Joining..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-downy-700 mb-2"
          >
            <HiArrowLeft className="mr-1" /> Back
          </button>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <Image
                src={`https://ipfs.io/ipfs/Qmd1VFua3zc65LT93Sv81VVu6BGa2QEuAakAFJexmRDGtX/${getPicture(
                  Number(chama.id)
                )}.jpg`}
                alt={chama.name}
                width={56}
                height={56}
                className="rounded-full"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-800">{chama.name}</h1>
                <p className="text-sm text-gray-500 capitalize">
                  {chamaType} chama
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="bg-downy-50 p-3 rounded-xl">
                <p className="text-gray-500">Contribution</p>
                <p className="font-semibold">{contributionLabel()}</p>
              </div>
              <div className="bg-downy-50 p-3 rounded-xl">
                <p className="text-gray-500">Members</p>
                <p className="font-semibold">
                  {chama.members?.length || 0}
                  {chama.maxNo ? ` / ${chama.maxNo}` : ""}
                </p>
              </div>
              <div className="bg-downy-50 p-3 rounded-xl col-span-2">
                <p className="text-gray-500">
                  {chama.started ? "Next payout" : "Starts"}
                </p>
                <p className="font-semibold">
                  {new Date(
                    chama.started ? chama.payDate : chama.startDate
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {isFull ? (
                <p className="text-center text-gray-500">This chama is full</p>
              ) : chamaType?.toLowerCase() === "public" ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full py-3 bg-downy-600 text-white rounded-xl font-semibold"
                >
                  Join Chama
                </button>
              ) : hasRequest ? (
                <p className="text-center text-gray-500">
                  Join request pending approval
                </p>
              ) : (
                <button
                  onClick={joinChama}
                  disabled={sendingRequest}
                  className="w-full py-3 bg-downy-600 text-white rounded-xl font-semibold"
                >
                  {sendingRequest ? "Sending..." : "Request to Join"}
                </button>
              )}
            </div>
          </div>
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
              onClick={() => router.back()}
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

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Fixed header */}
      <div className="bg-downy-700 rounded-b-2xl px-4 pt-4 pb-4 text-white shrink-0 safe-top">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.back()}
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
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="p-2 rounded-full bg-white/10 text-white"
                aria-label="Add member"
              >
                <FiUserPlus size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="p-2 rounded-full bg-white/10 text-white"
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
    </div>
  );
};

export default ChamaDetails;
