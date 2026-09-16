"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import BottomNavbar from "../Components/BottomNavbar";
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
import ChamaLinkSearch from "../Components/SearchModal";
import { motion } from "framer-motion";
import {
  FiUsers,
  FiArrowRight,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiSearch,
  FiTarget,
  FiPlus,
} from "react-icons/fi";
import { utcToLocalTime } from "@/utils/duration";
import PayoutCongrats from "../Components/PayoutCongrats";
import { JoinedChama } from "@/utils/typesUtils";
import { useSessionAddress } from "@/lib/useSessionAddress";
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
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showingChamas, setShowingChamas] = useState<JoinedChama[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, address, token, isAuthenticated, isGuest } =
    useSessionAddress();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "goals") setHomeTab("goals");
    else if (tab === "chamas") setHomeTab("chamas");
  }, [searchParams]);

  useEffect(() => {
    setActiveSection("Home");
  }, [homeTab]);

  const fetchChamas = useCallback(async () => {
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
      const response = await getUserChamas(token);
      if (response.success && response.chamas) {
        const transformed = response.chamas.map((member: any) =>
          transformChamaData(member.chama, address as string)
        );
        setChamas(transformed);
        setError(null);
      } else {
        setChamas([]);
        setError(response.error || "No chamas found");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch chamas");
      setChamas([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, isGuest, address]);

  const fetchGoals = useCallback(async () => {
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
    } catch {
      setGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  }, [token, isAuthenticated, isGuest]);

  useEffect(() => {
    fetchChamas();
    fetchGoals();
  }, [fetchChamas, fetchGoals]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!token || !isAuthenticated || isGuest || token === "guest") return;
      try {
        const userData = await getUserDetails(token);
        if (userData?.user) {
          setUserId(userData.user.id);
          if (userData.user.payOuts && userData.user.payOuts.length > 0) {
            setShowingChamas(userData.user.payOuts as unknown as JoinedChama[]);
            setShowPayoutModal(true);
          }
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, [token, isAuthenticated, isGuest]);

  return (
    <div className="min-h-screen bg-downy-100 pb-24">
      <div className="sticky top-0 z-10 bg-white rounded-b-lg shadow-sm px-4 pt-4 pb-2">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-downy-800">ChamaPay</h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-white p-2 rounded-full bg-downy-500"
            onClick={() => setShowLinkSearch(true)}
          >
            <FiSearch className="text-lg" />
          </motion.button>
        </div>

        <div className="flex mt-4 bg-gray-100 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setHomeTab("chamas")}
            className={`flex-1 py-2.5 font-semibold text-sm flex items-center justify-center gap-1.5 rounded-xl transition ${
              homeTab === "chamas"
                ? "bg-downy-600 text-white shadow-sm"
                : "bg-transparent text-gray-600"
            }`}
          >
            <FiUsers />
            Chamas
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                homeTab === "chamas"
                  ? "bg-white/20 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {chamas.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHomeTab("goals")}
            className={`flex-1 py-2.5 font-semibold text-sm flex items-center justify-center gap-1.5 rounded-xl transition ${
              homeTab === "goals"
                ? "bg-downy-600 text-white shadow-sm"
                : "bg-transparent text-gray-600"
            }`}
          >
            <FiTarget />
            Goals
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                homeTab === "goals"
                  ? "bg-white/20 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {goals.length}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-gray-600 text-center mb-4">
              Sign in with Google or email to view your chamas and goals
            </p>
            <Link
              href="/"
              className="bg-downy-600 text-white px-6 py-3 rounded-full font-semibold"
            >
              Sign in
            </Link>
          </div>
        ) : homeTab === "chamas" ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">My Chamas</h2>
                <p className="text-sm text-gray-500">
                  Rotational saving groups you belong to
                </p>
              </div>
              <Link
                href="/Create?mode=chama"
                className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-2 rounded-full text-sm font-semibold"
              >
                New <FiPlus />
              </Link>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-downy-500 mb-4" />
                <p className="text-gray-600">Loading your chamas...</p>
              </div>
            ) : chamas.length === 0 ? (
              <EmptyState
                icon={<FiUsers className="text-4xl text-downy-400" />}
                title="No Chamas Yet"
                description="Join or create your first chama to start saving with your community"
                buttonText="Create Chama"
                buttonLink="/Create?mode=chama"
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {error && (
                  <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">My Goals</h2>
                <p className="text-sm text-gray-500">
                  Save for Goal pots you created or joined
                </p>
              </div>
              <Link
                href="/Create?mode=goal"
                className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-2 rounded-full text-sm font-semibold"
              >
                New goal <FiPlus />
              </Link>
            </div>
            {goalsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-downy-500 mb-4" />
                <p className="text-gray-600">Loading your goals...</p>
              </div>
            ) : goals.length === 0 ? (
              <EmptyState
                icon={<FiTarget className="text-4xl text-downy-400" />}
                title="No goals yet"
                description="Create a personal, invite, or public Save for Goal pot"
                buttonText="New Goal"
                buttonLink="/Create?mode=goal"
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
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
      {showLinkSearch && (
        <ChamaLinkSearch onClose={() => setShowLinkSearch(false)} />
      )}
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
      whileHover={{ y: -2 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-2"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-800">{chama.name}</h3>
              <div className="flex items-center bg-downy-50 px-2 py-1 rounded-full">
                <FiDollarSign className="text-downy-600 mr-1 text-sm" />
                <span className="text-xs font-medium text-downy-700">
                  {chama.contribution} {chama.currency}/{chama.frequency}
                </span>
              </div>
            </div>
            <div className="flex items-center text-gray-500 text-sm mt-2">
              <FiCalendar className="mr-1" />
              <span>
                {chama.status === "active"
                  ? `Pay date: ${utcToLocalTime(chama.contributionDueDate)}`
                  : `Start date: ${utcToLocalTime(chama.startDate)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-2">
              <div className="flex items-center gap-1">
                <FiUsers className="text-gray-500" />
                <span className="text-xs font-medium text-gray-500">
                  {chama.members.length}{" "}
                  {chama.members.length === 1 ? "member" : "members"}
                </span>
              </div>
              <div className="flex items-center text-gray-500 text-sm">
                <FiClock
                  className={`${
                    chama.status === "active" ? "text-green-500" : "text-gray-500"
                  } mr-1`}
                />
                <span
                  className={`${chama.status === "active" && "text-green-500"}`}
                >
                  {chama.status === "active" ? "active" : "Not started"}
                </span>
              </div>
            </div>
          </div>
          <FiArrowRight className="text-gray-400 mt-2" />
        </div>
      </div>
    </motion.div>
  </Link>
);

const GoalCard = ({ goal }: { goal: GoalRecord }) => {
  const members =
    goal._count?.members ?? goal.members?.length ?? 1;
  return (
    <Link href={`/Goal/${goal.slug}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-2"
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <FiTarget className="text-downy-600 shrink-0" />
                <h3 className="font-bold text-gray-800 truncate">{goal.name}</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                  {goalTypeLabel(goal.goalType)}
                </span>
                {goal.yieldEnabled && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                    Yield
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {goal.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {goal.description || "No description"}
              </p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <span className="text-sm font-semibold text-blue-700">
                  Target {goal.targetAmount} USDC
                </span>
                <span className="text-xs text-gray-500">
                  {members} {members === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
            <FiArrowRight className="text-gray-400 mt-1 shrink-0" />
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
    className="flex flex-col items-center justify-center py-12 px-4 text-center"
  >
    <div className="bg-downy-50 p-4 rounded-full mb-4">{icon}</div>
    <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
    <p className="text-gray-500 mb-6 max-w-xs">{description}</p>
    <Link href={buttonLink}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white text-downy-700 font-bold py-2.5 pl-7 pr-3 rounded-full shadow-md border-[1.5px] border-downy-500 inline-flex items-center gap-3"
      >
        {buttonText}
        <span className="w-9 h-9 rounded-full bg-downy-600 text-white inline-flex items-center justify-center">
          <FiPlus />
        </span>
      </motion.button>
    </Link>
  </motion.div>
);

const Page = () => (
  <Suspense
    fallback={
      <div className="min-h-screen bg-downy-100 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    }
  >
    <MyHomeContent />
  </Suspense>
);

export default Page;
