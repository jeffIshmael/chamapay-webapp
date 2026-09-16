"use client";

import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { celo } from "viem/chains";
import { usdcContractAddress } from "@/app/ChamaPayABI/ChamaPayContract";
import erc20Abi from "@/app/ChamaPayABI/ERC20.json";
import { toast } from "sonner";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { getUser } from "@/lib/chama";
import { getRecentActivity } from "@/lib/chamaService";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import {
  FiEye,
  FiEyeOff,
  FiCopy,
  FiLogOut,
  FiSend,
  FiArrowUpRight,
  FiArrowDownLeft,
} from "react-icons/fi";
import { HiOutlineQrcode } from "react-icons/hi";
import { useRouter } from "next/navigation";
import SendModal from "./sendModal";
import QRCodeModal from "./QRCodeModal";
import Link from "next/link";

interface Payment {
  id: number;
  amount: string;
  txHash: string;
  userId: number;
  chamaId?: number;
  type: 'payment' | 'payout' | 'deposit' | 'withdrawal' | 'contribution';
  doneAt?: string;
  createdAt?: string;
  chama?: {
    id: number;
    name: string;
    slug: string;
  };
}

const Wallet = () => {
  const { address, isConnected, token, isAuthenticated, isGuest } =
    useSessionAddress();
  const { logout, user } = useAuth();
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
  const [loadingUser, setLoadingUser] = useState<boolean>(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [chamaNames, setChamaNames] = useState<{ [key: number]: string }>({});
  const router = useRouter();
  const { data: balanceData } = useReadContract({
    chainId: celo.id,
    address: usdcContractAddress,
    functionName: "balanceOf",
    abi: erc20Abi,
    args: [address],
  });

  const [activeModal, setActiveModal] = useState<
    "send" | "qr" | null
  >(null);

  // Add these handlers
  const openModal = (modal: "send" | "qr") =>
    setActiveModal(modal);
  const closeModal = () => setActiveModal(null);

  const balance = balanceData ? Number(balanceData) / 10 ** 6 : 0;
  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const copyToClipboard = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  const toggleBalanceVisibility = () => {
    setBalanceVisible(!balanceVisible);
  };

  const handleSignOut = () => {
    logout();
    toast("Signed out");
    router.replace("/");
  };

  // Fetch user ID based on address
  useEffect(() => {
    const fetchUserId = async () => {
      if (!address) return;
      setLoadingUser(true);
      try {
        const userData = await getUser(address);
        setUserId(userData?.id || null);
      } catch (error) {
        console.error("Error fetching user:", error);
        toast.error("Failed to load user data");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserId();
  }, [address]);

  // Fetch payments and chama names
  useEffect(() => {
    const fetchData = async () => {
      if (!userId || !token) return;
      setLoadingPayments(true);
      try {
        const activityData = await getRecentActivity(userId, token);
        setPayments(activityData);

        // Fetch chama names for any chamas that might not be in the activity object
        // (The new endpoint returns chama name in the object, but we keep this for safety or if the UI expects it)
        const names: { [key: number]: string } = { ...chamaNames };

        activityData.forEach((item: any) => {
          if (item.chama && item.chama.name) {
            names[item.chamaId || item.id] = item.chama.name;
          }
        });
        setChamaNames(names);
      } catch (error) {
        console.error("Error fetching activity:", error);
        toast.error("Failed to load activity history");
      } finally {
        setLoadingPayments(false);
      }
    };

    fetchData();
  }, [userId, token]);

  // Open explorer for a transaction
  function openTxLink(txHash: string) {
    window.open(`https://celoscan.io/tx/${txHash}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-downy-600 to-downy-700 px-4  pb-8 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-start pt-4">
          <div>
            <p className="text-downy-100 text-sm">Signed in as</p>
            <p className="text-white font-semibold">
              {isGuest ? "Guest" : user?.userName || "Member"}
            </p>
          </div>
          {isAuthenticated && (
            <button
              onClick={handleSignOut}
              className="p-2 rounded-md bg-white bg-opacity-20 text-white"
              title="Sign out"
            >
              <FiLogOut />
            </button>
          )}
        </div>

        {/* Balance Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white bg-opacity-20 backdrop-blur-sm p-4 rounded-xl mt-4 shadow-md"
        >
          <div className="flex justify-between items-center">
            <p className="text-downy-100 text-sm">Available Balance</p>
            <button
              onClick={toggleBalanceVisibility}
              className="text-downy-100 bg-transparent"
            >
              {balanceVisible ? <FiEye /> : <FiEyeOff />}
            </button>
          </div>

          <div className="flex items-end mt-2">
            <h2 className="text-3xl font-bold text-white">
              {balanceVisible && address
                ? balance.toFixed(3)
                : !address
                  ? "---"
                  : "••••"}
            </h2>
            <span className="text-xl text-white ml-1">USDC</span>
          </div>

          {/* Address */}
          {address ? (
            <div className="mt-4 flex items-center justify-between bg-white bg-opacity-20 p-2 rounded-lg">
              <p className="text-white text-sm font-medium truncate">
                {truncatedAddress}
              </p>
              <button
                onClick={copyToClipboard}
                className="text-white bg-transparent"
              >
                <FiCopy />
              </button>
            </div>
          ) : (
            <Link
              href="/"
              className="block w-full mt-4 bg-white text-downy-600 font-bold py-3 px-4 rounded-lg shadow-md text-center"
            >
              Sign in to view wallet
            </Link>
          )}
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          {[
            {
              icon: <FiSend className="text-xl" />,
              label: "Send",
              action: () => openModal("send"),
            },
            {
              icon: <HiOutlineQrcode className="text-xl" />,
              label: "Receive",
              action: () => openModal("qr"),
            },
          ].map((action, index) => (
            <motion.button
              key={index}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={action.action}
              className="bg-white bg-opacity-20 backdrop-blur-sm p-4 rounded-xl flex flex-col items-center text-white"
            >
              {action.icon}
              <span className="text-xs mt-2 font-medium">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <div className="px-4 mt-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Recent Transactions
        </h2>

        {loadingUser || loadingPayments ? (
          <div className="flex flex-col items-center justify-center py-8">
            <DotLottieReact
              src="https://lottie.host/965b1986-c9d6-4db5-a74d-375f05d98f59/M8KKZyk0j4.json"
              loop
              autoplay
              className="w-32 h-32"
            />
            <p className="text-gray-500 mt-2">Loading transactions...</p>
          </div>
        ) : !isAuthenticated || !address ? (
          <div className="text-center">
            <p className="text-gray-600">
              Sign in to view transactions
            </p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-600">No transactions yet</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {payments.slice(0, 10).map((payment) => {
              const isPayout = payment.type === 'payout';
              const isContribution = payment.type === 'contribution' || payment.type === 'payment';
              const chamaName = payment.chama?.name || chamaNames[payment.chamaId || 0] || "Unknown Chama";

              return (
                <motion.div
                  key={payment.id}
                  whileHover={{ y: -2 }}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-all hover:shadow-md"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-2xl ${isPayout
                      ? 'bg-green-50 text-green-600'
                      : 'bg-downy-50 text-downy-600'
                      }`}>
                      {isPayout ? (
                        <FiArrowDownLeft size={20} className="transform rotate-12" />
                      ) : (
                        <FiArrowUpRight size={20} className="transform -rotate-12" />
                      )}
                    </div>

                    <div>
                      <h3 className="font-normal text-gray-800 ">
                        {isPayout ? "From " : "To "}
                        <button
                          onClick={() => {
                            const chamaSlug = payment.chama?.slug || chamaName.toLowerCase().replace(/\s+/g, "-");
                            router.push(`/Chama/${chamaSlug}`);
                          }}
                          className="text-downy-600 hover:underline font-semibold bg-transparent border-none p-0"
                        >
                          {chamaName}
                        </button>
                      </h3>
                      <p className="text-gray-400 text-[10px] mt-1 font-medium tracking-wide uppercase">
                        {new Date(payment.doneAt || payment.createdAt || "").toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        <span className="mx-1">•</span>
                        {new Date(payment.doneAt || payment.createdAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1">
                    <span className={`text-sm font-semibold tracking-tight ${isPayout ? 'text-green-600' : 'text-gray-700'
                      }`}>
                      {isPayout ? "+" : "-"}{Number(payment.amount).toFixed(3)} USDC
                    </span>

                    <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openTxLink(payment.txHash)}
                          className="text-gray-400 hover:text-downy-500 transition-colors"
                          type="button"
                        >
                          ↗
                        </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {payments.length > 10 && (
              <Link href="/transactions">
                <button className="w-full mt-4 text-downy-600 font-medium text-sm p-2">
                  View all transactions
                </button>
              </Link>
            )}
          </motion.div>
        )}
      </div>
      {activeModal === "send" && (
        <SendModal
          isOpen={true}
          onClose={closeModal}
          balance={balance}
        />
      )}
      {activeModal === "qr" && (
        <QRCodeModal
          isOpen={true}
          onClose={closeModal}
          address={address || ""}
        />
      )}
    </div>
  );
};

export default Wallet;
