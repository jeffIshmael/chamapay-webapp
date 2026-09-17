"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import BottomNavbar from "../Components/BottomNavbar";
import AppHeader from "../Components/AppHeader";
import Link from "next/link";
import {
  getUserDetails,
  getUserChamas,
  transformChamaData,
} from "@/lib/chamaService";
import {
  getMyGoals,
  goalTypeLabel,
  GoalRecord,
} from "@/lib/goalService";
import { motion } from "framer-motion";
import {
  FiUsers,
  FiArrowRight,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiTarget,
  FiPlus,
} from "react-icons/fi";
import { utcToLocalTime } from "@/utils/duration";
import PayoutCongrats from "../Components/PayoutCongrats";
import { JoinedChama } from "@/utils/typesUtils";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { authDebug } from "@/lib/authDebug";
import { useRouter, useSearchParams } from "next/navigation";

type HomeTab = "chamas" | "goals";

function MyHomeContent() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState("Chamas");
  const [homeTab, setHomeTab] = useState<HomeTab>("chamas");
  const [chamas, setChamas] = useState<JoinedChama[]>([]);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showingChamas, setShowingChamas] = useState<JoinedChama[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { address, token, isAuthenticated, isGuest, isLoading: authLoading } =
    useSessionAddress();
  const router = useRouter();

  useEffect(() => {
    authDebug("MyChamas auth gate", {
      authLoading,
      isAuthenticated,
      isGuest,
      hasToken: Boolean(token),
      hasAddress: Boolean(address),
    });
    if (authLoading) return;
    if (!isAuthenticated) {
      authDebug("MyChamas unauthenticated → /");
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, isGuest, token, address, router]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "goals") setHomeTab("goals");
    else if (tab === "chamas") setHomeTab("chamas");
  }, [searchParams]);

  useEffect(() => {
    setActiveSection("Home");
  }, [homeTab]);

  const fetchChamas = useCallback(async () => {
    if (authLoading) return;
    if (!token || !isAuthenticated) {
      setLoading(false);
      return;
    }
    if (isGuest || token === "guest") {
      setChamas([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      authDebug("fetchChamas start", { address: address || null });
      const response = await getUserChamas(token);
      if (response.success && response.chamas) {
        const wallet = address || "";
        const transformed = response.chamas.map((member: any) =>
          transformChamaData(member.chama, wallet)
        );
        setChamas(transformed);
        setError(null);
        authDebug("fetchChamas ok", { count: transformed.length });
      } else {
        setChamas([]);
        setError(response.error || "No chamas found");
        authDebug("fetchChamas empty", response.error);
      }
    } catch (err) {
      authDebug("fetchChamas error", err);
      console.error(err);
      setError("Failed to fetch chamas");
      setChamas([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, token, isAuthenticated, isGuest, address]);

  const fetchGoals = useCallback(async () => {
    if (authLoading) return;
    if (!token || !isAuthenticated || isGuest || token === "guest") {
      setGoals([]);
      setGoalsLoading(false);
      return;
    }
    try {
      setGoalsLoading(true);
      const response = await getMyGoals(token);
      if (response.success && response.goals) {
        setGoals(response.goals);
      } else {
        setGoals([]);
      }
    } catch (err) {
      authDebug("fetchGoals error", err);
      setGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  }, [authLoading, token, isAuthenticated, isGuest]);

  useEffect(() => {
    fetchChamas();
    fetchGoals();
  }, [fetchChamas, fetchGoals]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (authLoading || !token || !isAuthenticated || isGuest || token === "guest")
        return;
      try {
        const userData = await getUserDetails(token);
        if (userData?.user) {
          setUserId(userData.user.id);
          const payOuts = userData.user.payOuts;
          if (Array.isArray(payOuts) && payOuts.length > 0) {
            setShowingChamas(payOuts as unknown as JoinedChama[]);
            setShowPayoutModal(true);
          }
        }
      } catch (err) {
        authDebug("fetchUserData error", err);
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, [authLoading, token, isAuthenticated, isGuest]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-downy-50 flex flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-downy-800">
          {authLoading ? "Restoring session…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-downy-50 pb-nav">
      <AppHeader />

      <div className="px-4 pt-3">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-downy-100/60">
          <button
            type="button"
            onClick={() => setHomeTab("chamas")}
            className={`flex-1 py-2 font-semibold text-[12px] flex items-center justify-center gap-1.5 rounded-xl transition ${
              homeTab === "chamas"
                ? "bg-downy-600 text-white shadow-sm"
                : "bg-transparent text-gray-500"
            }`}
          >
            <FiUsers size={14} />
            Chamas
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                homeTab === "chamas"
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {chamas.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHomeTab("goals")}
            className={`flex-1 py-2 font-semibold text-[12px] flex items-center justify-center gap-1.5 rounded-xl transition ${
              homeTab === "goals"
                ? "bg-downy-600 text-white shadow-sm"
                : "bg-transparent text-gray-500"
            }`}
          >
            <FiTarget size={14} />
            Goals
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                homeTab === "goals"
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {goals.length}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <p className="text-gray-500 text-center text-[13px] mb-4">
              Sign in with Google or email to view your chamas and goals
            </p>
            <Link
              href="/"
              className="bg-downy-600 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold"
            >
              Sign in
            </Link>
          </div>
        ) : homeTab === "chamas" ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">My Chamas</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Rotational groups you belong to
                </p>
              </div>
              <Link
                href="/Create?mode=chama"
                className="flex items-center gap-1 bg-downy-100 text-downy-800 px-2.5 py-1.5 rounded-full text-[11px] font-bold"
              >
                New <FiPlus size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-downy-500 mb-3" />
                <p className="text-gray-500 text-[12px]">Loading chamas…</p>
              </div>
            ) : chamas.length === 0 ? (
              <EmptyState
                icon={<FiUsers className="text-3xl text-downy-400" />}
                title="No chamas yet"
                description="Join or create your first chama to start saving with your circle"
                buttonText="Create Chama"
                buttonLink="/Create?mode=chama"
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2.5"
              >
                {error && (
                  <p className="text-[12px] text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">
                    {error}
                  </p>
                )}
                {chamas.map((chama) => (
                  <ChamaCard key={chama.id} chama={chama} />
                ))}
              </motion.div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">My Goals</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Save for Goal pots you created or joined
                </p>
              </div>
              <Link
                href="/Create?mode=goal"
                className="flex items-center gap-1 bg-downy-100 text-downy-800 px-2.5 py-1.5 rounded-full text-[11px] font-bold"
              >
                New goal <FiPlus size={12} />
              </Link>
            </div>
            {goalsLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-downy-500 mb-3" />
                <p className="text-gray-500 text-[12px]">Loading goals…</p>
              </div>
            ) : goals.length === 0 ? (
              <EmptyState
                icon={<FiTarget className="text-3xl text-downy-400" />}
                title="No goals yet"
                description="Create a personal, invite, or public Save for Goal pot"
                buttonText="New Goal"
                buttonLink="/Create?mode=goal"
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2.5"
              >
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      <BottomNavbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
      {showPayoutModal && (
        <PayoutCongrats
          chamas={showingChamas}
          userId={userId ?? 0}
          onClose={() => setShowPayoutModal(false)}
        />
      )}
    </div>
  );
}

const ChamaCard = ({ chama }: { chama: JoinedChama }) => (
  <Link href={`/Chama/${chama.slug}`}>
    <motion.div
      whileTap={{ scale: 0.99 }}
      className="bg-white rounded-2xl shadow-sm border border-downy-100/70 overflow-hidden"
    >
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-bold text-[13px] text-gray-900 truncate">
                {chama.name}
              </h3>
              <div className="flex items-center bg-downy-50 px-1.5 py-0.5 rounded-full shrink-0">
                <FiDollarSign className="text-downy-600 mr-0.5" size={11} />
                <span className="text-[10px] font-semibold text-downy-700">
                  {chama.contribution} {chama.currency}/{chama.frequency}
                </span>
              </div>
            </div>
            <div className="flex items-center text-gray-500 text-[11px] mt-1.5">
              <FiCalendar className="mr-1 shrink-0" size={12} />
              <span className="truncate">
                {chama.status === "active"
                  ? `Pay: ${utcToLocalTime(chama.contributionDueDate)}`
                  : `Starts: ${utcToLocalTime(chama.startDate)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1.5">
              <div className="flex items-center gap-1">
                <FiUsers className="text-gray-400" size={12} />
                <span className="text-[11px] font-medium text-gray-500">
                  {chama.members.length}{" "}
                  {chama.members.length === 1 ? "member" : "members"}
                </span>
              </div>
              <div className="flex items-center text-[11px] text-gray-500">
                <FiClock
                  size={12}
                  className={`${
                    chama.status === "active" ? "text-emerald-500" : "text-gray-400"
                  } mr-1`}
                />
                <span
                  className={
                    chama.status === "active" ? "text-emerald-600 font-semibold" : ""
                  }
                >
                  {chama.status === "active" ? "Active" : "Not started"}
                </span>
              </div>
            </div>
          </div>
          <FiArrowRight className="text-gray-300 mt-1 shrink-0" size={16} />
        </div>
      </div>
    </motion.div>
  </Link>
);

const GoalCard = ({ goal }: { goal: GoalRecord }) => {
  const members = goal._count?.members ?? goal.members?.length ?? 1;
  return (
    <Link href={`/Goal/${goal.slug}`}>
      <motion.div
        whileTap={{ scale: 0.99 }}
        className="bg-white rounded-2xl shadow-sm border border-downy-100/70 overflow-hidden"
      >
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FiTarget className="text-downy-600 shrink-0" size={14} />
                <h3 className="font-bold text-[13px] text-gray-900 truncate">
                  {goal.name}
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                  {goalTypeLabel(goal.goalType)}
                </span>
                {goal.yieldEnabled && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-800">
                    Yield
                  </span>
                )}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {goal.status}
                </span>
              </div>
              <p className="text-[12px] text-gray-500 line-clamp-2">
                {goal.description || "No description"}
              </p>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                <span className="text-[12px] font-bold text-downy-800">
                  Target {goal.targetAmount} USDC
                </span>
                <span className="text-[11px] text-gray-500">
                  {members} {members === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
            <FiArrowRight className="text-gray-300 mt-0.5 shrink-0" size={16} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

const EmptyState = ({
  icon,
  title,
  description,
  buttonText,
  buttonLink,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center py-10 px-4 text-center"
  >
    <div className="bg-white border border-downy-100 p-3.5 rounded-2xl mb-3 shadow-sm">
      {icon}
    </div>
    <h3 className="text-[15px] font-bold text-gray-900 mb-1">{title}</h3>
    <p className="text-[12px] text-gray-500 mb-5 max-w-[15rem] leading-relaxed">
      {description}
    </p>
    <Link href={buttonLink}>
      <motion.button
        whileTap={{ scale: 0.98 }}
        className="bg-downy-700 text-white font-bold text-[13px] py-2.5 pl-5 pr-2.5 rounded-full shadow-md inline-flex items-center gap-2.5"
      >
        {buttonText}
        <span className="w-8 h-8 rounded-full bg-white/20 text-white inline-flex items-center justify-center">
          <FiPlus size={14} />
        </span>
      </motion.button>
    </Link>
  </motion.div>
);

const Page = () => (
  <Suspense
    fallback={
      <div className="min-h-[100dvh] bg-downy-50 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    }
  >
    <MyHomeContent />
  </Suspense>
);

export default Page;
