"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import USDCPay from "./USDCPay";
import ChamaMpesaPay from "./ChamaMpesaPay";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowLeft, FiArrowRight, FiX } from "react-icons/fi";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { useReadContract } from "wagmi";
import { celo } from "viem/chains";
import erc20Abi from "@/app/ChamaPayABI/ERC20.json";
import { usdcContractAddress } from "@/app/ChamaPayABI/ChamaPayContract";

type Method = "" | "account" | "mpesa";

const Pay = ({
  openModal,
  closeModal,
  chamaId,
  chamaName,
  chamaBlockchainId,
  recipient,
  remainingAmount = 0,
  contributionAmount = 0,
}: {
  openModal: boolean;
  closeModal: () => void;
  chamaId: number;
  chamaName: string;
  chamaBlockchainId: number;
  recipient?: { userId: number; userName: string } | null;
  remainingAmount?: number;
  contributionAmount?: number;
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethod] = useState<Method>("");
  const { formatBalance } = useFormattedBalance();
  const { address } = useSessionAddress();

  const { data: balanceData } = useReadContract({
    chainId: celo.id,
    address: usdcContractAddress,
    functionName: "balanceOf",
    abi: erc20Abi,
    args: [address],
  });
  const walletUsdc = balanceData ? Number(balanceData) / 1e6 : 0;

  const handleClose = () => {
    if (isLoading) return;
    setIsClosing(true);
    setTimeout(() => {
      closeModal();
      setMethod("");
      setIsClosing(false);
    }, 300);
  };

  useEffect(() => {
    if (openModal) {
      document.body.style.overflow = "hidden";
      setMethod("");
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [openModal]);

  const payLabel = recipient
    ? `Pay for ${recipient.userName}`
    : `Pay to ${chamaName}`;

  return (
    <AnimatePresence>
      {openModal && (
        <div className={`app-modal-layer ${isLoading ? "pointer-events-none" : ""}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isClosing ? 0 : 1 }}
            exit={{ opacity: 0 }}
            className="app-modal-backdrop"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: isClosing ? "100%" : 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="app-modal-sheet relative bg-white shadow-xl max-h-[92%] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {!method && (
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 z-10"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 text-gray-600" />
              </button>
            )}

            <div className="p-5 pt-5 pb-8">
              {!method ? (
                <>
                  <div className="flex items-center mb-5 relative min-h-[28px]">
                    <h1 className="text-[17px] font-semibold text-center w-full pr-6">
                      Choose method
                    </h1>
                  </div>
                  {recipient && (
                    <p className="text-center text-[11px] text-gray-500 -mt-3 mb-3">
                      Paying on behalf of @{recipient.userName}
                    </p>
                  )}
                  {!recipient && (
                    <p className="text-center text-[11px] text-gray-500 -mt-3 mb-3">
                      {payLabel}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setMethod("account")}
                    className="w-full flex items-center justify-between gap-3 py-3.5 px-4 bg-gray-50 rounded-xl mb-2.5 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Image
                        src="/icon.png"
                        alt="Chamapay"
                        width={40}
                        height={40}
                        className="rounded-full shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-gray-900">
                          Pay from account
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {formatBalance(walletUsdc)} available
                        </p>
                      </div>
                    </div>
                    <FiArrowRight className="text-gray-400 shrink-0" size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("mpesa")}
                    className="w-full flex items-center justify-between gap-3 py-3.5 px-4 bg-gray-50 rounded-xl text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Image
                        src="/static/images/mpesa.png"
                        alt="M-Pesa"
                        width={40}
                        height={40}
                        className="rounded-lg shrink-0"
                      />
                      <p className="text-[15px] font-medium text-gray-900">
                        Pay with M-Pesa
                      </p>
                    </div>
                    <FiArrowRight className="text-gray-400 shrink-0" size={18} />
                  </button>
                </>
              ) : method === "account" ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setMethod("")}
                      disabled={isLoading}
                      className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
                      aria-label="Back"
                    >
                      <FiArrowLeft size={16} />
                    </button>
                    <h1 className="text-[15px] font-bold flex-1 text-center pr-8">
                      {payLabel}
                    </h1>
                  </div>
                  {recipient && (
                    <p className="text-center text-[11px] text-gray-500 mb-3">
                      Depositing on behalf of @{recipient.userName}
                    </p>
                  )}
                  <USDCPay
                    chamaId={chamaId}
                    chamaBlockchainId={chamaBlockchainId}
                    name={chamaName}
                    onClose={handleClose}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                    memberForId={recipient?.userId}
                    remainingAmount={remainingAmount}
                  />
                </div>
              ) : (
                <ChamaMpesaPay
                  chamaId={chamaId}
                  chamaName={chamaName}
                  remainingAmount={remainingAmount}
                  contributionAmount={contributionAmount}
                  memberForId={recipient?.userId}
                  recipientName={recipient?.userName}
                  onBack={() => setMethod("")}
                  onClose={handleClose}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Pay;
