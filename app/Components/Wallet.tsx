"use client";

import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { celo } from "viem/chains";
import { usdcContractAddress } from "@/app/ChamaPayABI/ChamaPayContract";
import erc20Abi from "@/app/ChamaPayABI/ERC20.json";
import { toast } from "sonner";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  getTheUserTx,
  getMoonwellActivitySubtitle,
  getMoonwellActivityTitle,
  isMoonwellTx,
  WalletTransaction,
} from "@/lib/walletServices";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { motion } from "framer-motion";
import {
  FiEye,
  FiEyeOff,
  FiCopy,
  FiSend,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiDownload,
  FiUpload,
  FiExternalLink,
  FiX,
} from "react-icons/fi";
import { HiOutlineQrcode } from "react-icons/hi";
import SendModal from "./sendModal";
import QRCodeModal from "./QRCodeModal";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import Link from "next/link";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { getRelativeTime } from "@/utils/duration";

const shortAddress = (value?: string) => {
  if (!value) return "Unknown";
  if (value.startsWith("0x") && value.length > 10) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }
  return value;
};

const Wallet = () => {
  const { address, token, isAuthenticated } = useSessionAddress();
  const { formatBalance, formatBalanceParts, currency } = useFormattedBalance();
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const { data: balanceData } = useReadContract({
    chainId: celo.id,
    address: usdcContractAddress,
    functionName: "balanceOf",
    abi: erc20Abi,
    args: [address],
  });

  const [activeModal, setActiveModal] = useState<
    "send" | "qr" | "deposit" | "withdraw" | null
  >(null);
  const openModal = (modal: "send" | "qr" | "deposit" | "withdraw") =>
    setActiveModal(modal);
  const closeModal = () => setActiveModal(null);

  const refreshActivity = () => {
    if (!token) return;
    getTheUserTx(token, { limit: 20 })
      .then((data) => setTransactions(data?.transactions || []))
      .catch(() => {});
  };

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
    const fetchData = async () => {
      if (!token || !isAuthenticated) {
        setTransactions([]);
        return;
      }
      setLoadingPayments(true);
      try {
        const data = await getTheUserTx(token, { limit: 20 });
        setTransactions(data?.transactions || []);
      } catch {
        toast.error("Failed to load activity history");
        setTransactions([]);
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchData();
  }, [token, isAuthenticated]);

  const getIconColor = (type: WalletTransaction["type"]) => {
    switch (type) {
      case "sent":
        return "#f56c6c";
      case "received":
        return "#10b981";
      case "deposited":
        return "#3b82f6";
      case "withdrew":
        return "#f97316";
      default:
        return "#6b7280";
    }
  };

  const getTextColor = (type: WalletTransaction["type"]) => {
    switch (type) {
      case "sent":
      case "withdrew":
        return "text-red-500";
      case "received":
      case "deposited":
        return "text-emerald-600";
      default:
        return "text-gray-700";
    }
  };

  const subtitleFor = (tx: WalletTransaction) => {
    if (isMoonwellTx(tx)) return getMoonwellActivitySubtitle(tx);
    if (tx.isPretiumTx) {
      return tx.type === "deposited"
        ? `From: ${tx.sender || "M-PESA"}`
        : `To: ${tx.recipient || "M-PESA"}`;
    }
    if (tx.type === "sent" || tx.type === "withdrew") {
      return `To: ${shortAddress(tx.recipient)}`;
    }
    return `From: ${shortAddress(tx.sender)}`;
  };

  const titleFor = (tx: WalletTransaction) =>
    isMoonwellTx(tx) ? getMoonwellActivityTitle(tx) : tx.type;

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
                ? (() => {
                    const p = formatBalanceParts(balance);
                    return p.decimal ? `${p.whole}.${p.decimal}` : p.whole;
                  })()
                : !address
                  ? "---"
                  : "••••"}
            </h2>
            <span className="text-[13px] text-white/90 mb-0.5 font-semibold">
              {currency}
            </span>
          </div>

          {address ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 bg-white/15 px-2.5 py-1.5 rounded-xl">
                <p className="text-white text-[11px] font-medium truncate font-mono tracking-wide">
                  {truncatedAddress}
                </p>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="text-white/80 bg-transparent p-0.5 shrink-0"
                  aria-label="Copy address"
                >
                  <FiCopy size={13} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openModal("qr")}
                disabled={!address}
                aria-label="Receive via QR"
                className="h-9 w-9 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0"
              >
                <HiOutlineQrcode size={18} />
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
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            {
              icon: <FiDownload size={18} className="text-downy-700" />,
              label: "Deposit",
              action: () => openModal("deposit"),
            },
            {
              icon: <FiSend size={17} className="text-downy-700" />,
              label: "Send",
              action: () => openModal("send"),
            },
            {
              icon: <FiUpload size={18} className="text-downy-700" />,
              label: "Withdraw",
              action: () => openModal("withdraw"),
            },
          ].map((action) => (
            <motion.button
              key={action.label}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={action.action}
              disabled={!address}
              className="bg-white py-3 rounded-xl shadow-sm flex flex-col items-center justify-center gap-1 text-downy-800 text-[11px] font-semibold disabled:opacity-50"
            >
              {action.icon}
              {action.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[15px] font-bold text-gray-900">
            Recent activity
          </h2>
          {transactions.length > 0 && (
            <Link
              href="/Wallet/activity"
              className="text-[11px] font-bold text-downy-700 bg-downy-50 px-2.5 py-1 rounded-full"
            >
              See all
            </Link>
          )}
        </div>

        {loadingPayments ? (
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
        ) : transactions.length === 0 ? (
          <p className="text-center text-[12px] text-gray-500 py-6">
            No transactions yet
          </p>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {transactions.slice(0, 6).map((tx) => {
              const color = getIconColor(tx.type);
              const isOut = tx.type === "sent" || tx.type === "withdrew";
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => setSelectedTx(tx)}
                  className="w-full bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      {isOut ? (
                        <FiArrowUpRight size={18} style={{ color }} />
                      ) : (
                        <FiArrowDownLeft size={18} style={{ color }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          className={`text-[13px] font-semibold text-gray-900 ${
                            isMoonwellTx(tx) ? "" : "capitalize"
                          }`}
                        >
                          {titleFor(tx)}
                        </h3>
                        {tx.isPretiumTx && (
                          <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            M-PESA
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {subtitleFor(tx)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-[13px] font-bold ${getTextColor(tx.type)}`}>
                      {isOut ? "-" : "+"}
                      {currency === "KES" && tx.fiatAmount
                        ? ` ${tx.fiatAmount.toLocaleString("en-KE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} KES`
                        : ` ${formatBalance(tx.amount)}`}
                    </p>
                    {currency === "KES" && (
                      <p className="text-[10px] text-gray-400">
                        (
                        {parseFloat(tx.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}{" "}
                        USDC)
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {getRelativeTime(tx.date)}
                    </p>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </div>

      {selectedTx && (
        <div className="app-modal-layer">
          <div className="app-modal-backdrop" />
          <div className="app-modal-sheet bg-white p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8" />
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <FiX size={14} />
              </button>
            </div>

            <div className="flex flex-col items-center text-center mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{
                  backgroundColor: `${getIconColor(selectedTx.type)}20`,
                }}
              >
                {selectedTx.type === "sent" || selectedTx.type === "withdrew" ? (
                  <FiArrowUpRight
                    size={24}
                    style={{ color: getIconColor(selectedTx.type) }}
                  />
                ) : (
                  <FiArrowDownLeft
                    size={24}
                    style={{ color: getIconColor(selectedTx.type) }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p
                  className={`text-[15px] font-bold capitalize ${
                    isMoonwellTx(selectedTx) ? "normal-case" : ""
                  }`}
                >
                  {titleFor(selectedTx)}
                </p>
                {selectedTx.isPretiumTx && (
                  <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    M-PESA
                  </span>
                )}
              </div>
              <p className="text-[12px] text-gray-500 mt-1">
                {subtitleFor(selectedTx)}
              </p>
              <p
                className={`text-[1.75rem] font-extrabold mt-3 ${getTextColor(
                  selectedTx.type
                )}`}
              >
                {selectedTx.type === "sent" || selectedTx.type === "withdrew"
                  ? "-"
                  : "+"}
                {currency === "KES" && selectedTx.fiatAmount
                  ? ` ${selectedTx.fiatAmount.toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} KES`
                  : ` ${formatBalance(selectedTx.amount)}`}
              </p>
              {currency === "KES" && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  (
                  {parseFloat(selectedTx.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}{" "}
                  USDC)
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">
                {getRelativeTime(selectedTx.date)}
              </p>
            </div>

            {selectedTx.hash && selectedTx.hash !== "N/A" ? (
              <a
                href={`https://basescan.org/tx/${selectedTx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-downy-600 text-white text-[12px] font-bold"
              >
                View on BaseScan <FiExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      )}

      {activeModal === "deposit" && (
        <DepositModal
          isOpen={true}
          onClose={closeModal}
          onSuccess={refreshActivity}
        />
      )}
      {activeModal === "send" && (
        <SendModal
          isOpen={true}
          onClose={closeModal}
          balance={balance}
          onSuccess={refreshActivity}
        />
      )}
      {activeModal === "withdraw" && (
        <WithdrawModal
          isOpen={true}
          onClose={closeModal}
          balance={balance}
          onSuccess={refreshActivity}
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
