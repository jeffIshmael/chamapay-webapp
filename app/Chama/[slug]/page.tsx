"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import ChamaNavbar from "@/app/Components/ChamaNav";
import Members from "@/app/Components/Members";
import Chat from "@/app/Components/Chat";
import Schedule from "@/app/Components/Schedule";
import {
  getChamaBySlug as getChama,
  requestToJoinChama,
  addMemberToChama as addMemberToPublicChama,
  checkRequest,
} from "@/lib/chamaService";
import { duration, getPicture } from "@/utils/duration";
import Pay from "@/app/Components/Pay";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useRouter } from "next/navigation";
import { FiAlertTriangle } from "react-icons/fi";
import { showToast } from "@/app/Components/Toast";
import { HiArrowLeft } from "react-icons/hi";
import ChamaSchedule from "@/app/Components/chamaSchedule";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";

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
  amount: bigint;
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
  userBalance?: string;
  eachMemberBalance?: Record<string, string>;
}

const ChamaDetails = ({ params }: { params: { slug: string } }) => {
  const [activeSection, setActiveSection] = useState("Details");
  const [chama, setChama] = useState<Chama | null>(null);
  const [cycle, setCycle] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const { address, isAuthenticated, user } = useSessionAddress();
  const [chamaType, setChamaType] = useState("");
  const [included, setIncluded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const router = useRouter();
  const { token } = useAuth();

  const togglePayModal = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchChama = async () => {
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

        const result = await checkRequest(
          address as string,
          data.chama.id ?? 0,
          token || undefined
        );
        setHasRequest(Boolean(result));
        if ((data.chama.members?.length ?? 0) >= (data.chama.maxNo ?? 0) && data.chama.maxNo > 0) {
          setIsFull(true);
        }
      }
    };
    if (isAuthenticated) fetchChama();
  }, [address, params.slug, token, isAuthenticated]);

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

  if (!chama) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-downy-100">
        <DotLottieReact
          src="https://lottie.host/d054c6be-ba43-476e-a709-0b8c5a6eacce/9H9nV28mOT.json"
          loop
          autoplay
        />
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

  return (
    <div>
      {activeSection === "Details" && (
        <div className="bg-downy-100 min-h-screen flex flex-col items-center py-1">
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
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
                <h3 className="text-lg font-semibold mb-2">
                  Join {chama.name}?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  You will lock the required collateral via your ChamaPay
                  wallet.
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
                  <h1 className="text-xl font-bold text-gray-800">
                    {chama.name}
                  </h1>
                  <p className="text-sm text-gray-500 capitalize">
                    {chamaType} chama
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="bg-downy-50 p-3 rounded-xl">
                  <p className="text-gray-500">Contribution</p>
                  <p className="font-semibold">
                    {(Number(chama.amount) / 1e6).toFixed(2)} USDC / {cycle}
                  </p>
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

              {!included && (
                <div className="mt-4">
                  {isFull ? (
                    <p className="text-center text-gray-500">
                      This chama is full
                    </p>
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
              )}

              {included && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={togglePayModal}
                    className="flex-1 py-3 bg-downy-600 text-white rounded-xl font-semibold"
                  >
                    Pay
                  </button>
                  <button
                    onClick={() => setActiveSection("Chats")}
                    className="flex-1 py-3 bg-white border border-downy-300 text-downy-700 rounded-xl font-semibold"
                  >
                    Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === "Members" && (
        <Members
          imageSrc={`https://ipfs.io/ipfs/Qmd1VFua3zc65LT93Sv81VVu6BGa2QEuAakAFJexmRDGtX/${getPicture(
            Number(chama.id)
          ).toString()}.jpg`}
          name={chama.name}
          slug={chama.slug}
          members={chama.members as any}
          adminWallet={adminWallet || ""}
          isFarcaster={false}
          eachMemberBalance={chama.eachMemberBalance}
        />
      )}
      {activeSection === "Chats" && (
        <div className="bg-downy-100 h-[100vh] flex flex-col">
          <div className="flex items-center w-full px-4 py-2 space-x-2 shadow-md bg-downy-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 cursor-pointer"
              onClick={() => setActiveSection("Members")}
            >
              <path
                fillRule="evenodd"
                d="M11.03 3.97a.75.75 0 0 1 0 1.06l-6.22 6.22H21a.75.75 0 0 1 0 1.5H4.81l6.22 6.22a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            <Image
              src={`https://ipfs.io/ipfs/Qmd1VFua3zc65LT93Sv81VVu6BGa2QEuAakAFJexmRDGtX/${getPicture(
                Number(chama.id)
              )}.jpg`}
              alt="logo"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div className="ml-3">
              <h2 className="text-xl font-bold text-downy-600">{chama.name}</h2>
              <p className="text-gray-500">
                {chama.members.length} Member
                <span>{chama.members.length > 1 ? "s" : ""}</span>
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <Chat chamaId={Number(chama.id)} />
          </div>
        </div>
      )}

      {activeSection === "Schedule" && (
        <Schedule
          chama={chama}
          type={chamaType}
          payoutOrder={chama.payOutOrder ? chama.payOutOrder : null}
        />
      )}
      {activeSection === "chamaSchedule" && (
        <ChamaSchedule
          chama={chama as any}
          payoutOrder={chama.payOutOrder ? chama.payOutOrder : null}
          address={address as string}
        />
      )}

      {activeSection !== "Chats" && (
        <ChamaNavbar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isMember={included}
        />
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-end transition duration-300 ease-in-out"
            onClick={togglePayModal}
          ></div>
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Pay
              openModal={isOpen}
              closeModal={() => setIsOpen(false)}
              chamaId={Number(chama.id)}
              chamaName={chama.name}
              chamaBlockchainId={Number(chama.blockchainId)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ChamaDetails;
