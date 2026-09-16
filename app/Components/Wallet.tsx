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
import { motion } from "framer-motion";
import {
  FiEye,
  FiEyeOff,
  FiCopy,
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
  type: "payment" | "payout" | "deposit" | "withdrawal" | "contribution";
  doneAt?: string;
  createdAt?: string;
  chama?: {
    id: number;
    name: string;
    slug: string;
  };
}

const Wallet = () => {
  const { address, token, isAuthenticated } = useSessionAddress();
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
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

  const [activeModal, setActiveModal] = useState<"send" | "qr" | null>(null);
  const openModal = (modal: "send" | "qr") => setActiveModal(modal);
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

  useEffect(() => {
    const fetchUserId = async () => {
      if (!address) return;
      setLoadingUser(true);
      try {
        const userData = await getUser(address);
        setUserId(userData?.id || null);
      } catch {
        toast.error("Failed to load user data");
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUserId();
  }, [address]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId || !token) return;
      setLoadingPayments(true);
      try {
        const activityData = await getRecentActivity(userId, token);
        setPayments(activityData);
        const names: { [key: number]: string } = { ...chamaNames };
        activityData.forEach((item: Payment & { chamaId?: number }) => {
          if (item.chama?.name) {
            names[item.chamaId || item.id] = item.chama.name;
          }
        });
        setChamaNames(names);
      } catch {
        toast.error("Failed to load activity history");
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  function openTxLink(txHash: string) {
    window.open(`https://celoscan.io/tx/${txHash}`, "_blank");
  }

  return (
    <div className="min-h-[100dvh] bg-downy-50 pb-nav">
      <div className="px-4 pt-4 safe-top">
        <div className="bg-gradient-to-br from-downy-600 to-downy-800 rounded-2xl p-3.5 text-white shadow-md shadow-downy-700/20">
          <div className="flex justify-between items-center">
            <p className="text-downy-100 text-[11px] font-medium">
              Available balance
            </p>
            <button
              type="button"
              onClick={() => setBalanceVisible((v) => !v)}
              className="text-downy-100 bg-transparent p-1"
            >
              {balanceVisible ? <FiEye size={14} /> : <FiEyeOff size={14} />}
            </button>
          </div>

          <div className="flex items-end mt-1.5 gap-1">
            <h2 className="text-[1.65rem] font-extrabold text-white leading-none tracking-tight">
              {balanceVisible && address
                ? balance.toFixed(3)
                : !address
                  ? "---"
                  : "••••"}
            </h2>
            <span className="text-[13px] text-white/90 mb-0.5 font-semibold">
              USDC
            </span>
          </div>

          {address ? (
            <div className="mt-3 flex items-center justify-between bg-white/15 px-2.5 py-1.5 rounded-xl">
              <p className="text-white text-[11px] font-medium truncate">
                {truncatedAddress}
              </p>
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-white bg-transparent p-1"
              >
                <FiCopy size={13} />
              </button>
            </div>
          ) : (
            <Link
              href="/"
              className="block w-full mt-3 bg-white text-downy-700 font-bold text-[12px] py-2.5 px-3 rounded-xl text-center"
            >
              Sign in to view wallet
            </Link>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              {
                icon: <FiSend size={16} />,
                label: "Send",
                action: () => openModal("send"),
              },
              {
                icon: <HiOutlineQrcode size={18} />,
                label: "Receive",
                action: () => openModal("qr"),
              },
            ].map((action) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={action.action}
                className="bg-white/15 backdrop-blur-sm py-2.5 rounded-xl flex items-center justify-center gap-2 text-white text-[12px] font-semibold"
              >
                {action.icon}
                {action.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        <h2 className="text-[15px] font-bold text-gray-900 mb-2.5">
          Recent activity
        </h2>

        {loadingUser || loadingPayments ? (
          <div className="flex flex-col items-center justify-center py-8">
            <DotLottieReact
              src="https://lottie.host/965b1986-c9d6-4db5-a74d-375f05d98f59/M8KKZyk0j4.json"
              loop
              autoplay
              className="w-24 h-24"
            />
            <p className="text-gray-500 text-[12px] mt-1">Loading…</p>
          </div>
        ) : !isAuthenticated || !address ? (
          <p className="text-center text-[12px] text-gray-500 py-6">
            Sign in to view transactions
          </p>
        ) : payments.length === 0 ? (
          <p className="text-center text-[12px] text-gray-500 py-6">
            No transactions yet
          </p>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {payments.slice(0, 10).map((payment) => {
              const isPayout = payment.type === "payout";
              const chamaName =
                payment.chama?.name ||
                chamaNames[payment.chamaId || 0] ||
                "Unknown Chama";

              return (
                <div
                  key={payment.id}
                  className="bg-white p-3 rounded-2xl shadow-sm border border-downy-100/70 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isPayout
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-downy-50 text-downy-600"
                      }`}
                    >
                      {isPayout ? (
                        <FiArrowDownLeft size={16} />
                      ) : (
                        <FiArrowUpRight size={16} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-[12px] text-gray-800 truncate">
                        {isPayout ? "From " : "To "}
                        <button
                          type="button"
                          onClick={() => {
                            const chamaSlug =
                              payment.chama?.slug ||
                              chamaName.toLowerCase().replace(/\s+/g, "-");
                            router.push(`/Chama/${chamaSlug}`);
                          }}
                          className="text-downy-600 font-semibold bg-transparent border-none p-0"
                        >
                          {chamaName}
                        </button>
                      </h3>
                      <p className="text-gray-400 text-[10px] mt-0.5 font-medium uppercase tracking-wide">
                        {new Date(
                          payment.doneAt || payment.createdAt || ""
                        ).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                        <span className="mx-1">•</span>
                        {new Date(
                          payment.doneAt || payment.createdAt || ""
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span
                      className={`text-[12px] font-bold ${
                        isPayout ? "text-emerald-600" : "text-gray-700"
                      }`}
                    >
                      {isPayout ? "+" : "-"}
                      {Number(payment.amount).toFixed(3)}
                    </span>
                    <button
                      onClick={() => openTxLink(payment.txHash)}
                      className="text-gray-400 text-[11px] bg-transparent"
                      type="button"
                    >
                      ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>

      {activeModal === "send" && (
        <SendModal isOpen={true} onClose={closeModal} balance={balance} />
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
