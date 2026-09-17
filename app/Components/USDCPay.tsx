"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { celo } from "viem/chains";
import erc20Abi from "@/app/ChamaPayABI/ERC20.json";
import { usdcContractAddress } from "../ChamaPayABI/ChamaPayContract";
import { showToast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { serverUrl } from "@/lib/serverUrl";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useCurrencyStore } from "@/store/useCurrencyStore";

const USDCPay = ({
  chamaId,
  chamaBlockchainId,
  name,
  onClose,
  isLoading,
  setIsLoading,
  memberForId,
  remainingAmount = 0,
}: {
  chamaId: number;
  chamaBlockchainId: number;
  name: string;
  onClose: () => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  memberForId?: number;
  remainingAmount?: number;
}) => {
  const { address, isAuthenticated } = useSessionAddress();
  const [amount, setAmount] = useState("");
  const { token } = useAuth();
  const { formatBalance, platformRate } = useFormattedBalance();
  const { currency } = useCurrencyStore();
  const [kesMode, setKesMode] = useState(currency === "KES");
  const isKES = kesMode && platformRate > 0;

  useEffect(() => {
    if (remainingAmount <= 0) return;
    setAmount(
      isKES
        ? (remainingAmount * platformRate).toFixed(2)
        : remainingAmount.toFixed(3)
    );
  }, [remainingAmount, isKES, platformRate]);

  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
  } = useReadContract({
    chainId: celo.id,
    address: usdcContractAddress,
    functionName: "balanceOf",
    abi: erc20Abi,
    args: [address],
  });

  const walletUsdc = balanceData ? Number(balanceData) / 1e6 : 0;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !address || !token) {
      showToast("Please sign in to pay", "warning");
      return;
    }

    const entered = parseFloat(amount);
    if (isNaN(entered) || entered <= 0) {
      showToast("Invalid amount", "warning");
      return;
    }

    const payAmountUsdc = isKES ? entered / platformRate : entered;
    if (payAmountUsdc > walletUsdc) {
      showToast("Insufficient USDC balance", "error");
      return;
    }

    try {
      setIsLoading(true);
      const body: Record<string, unknown> = {
        amount: payAmountUsdc.toFixed(6),
        blockchainId: chamaBlockchainId,
        chamaId,
      };
      if (memberForId) body.memberForId = memberForId;

      const response = await fetch(`${serverUrl}/chama/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.error) {
        showToast(result?.error || result?.message || "Payment failed", "error");
        return;
      }

      showToast(
        `${formatBalance(payAmountUsdc)} paid to ${name}${
          memberForId ? " (on behalf)" : ""
        }`,
        "success"
      );
      onClose();
    } catch (error) {
      console.error("Payment error:", error);
      showToast("A problem occurred. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-3 mb-4">
        <Image
          src={"/static/images/usdclogo.png"}
          alt="USDC logo"
          width={40}
          height={40}
          className="rounded-full"
        />
        <div>
          <h3 className="text-[15px] font-semibold text-gray-800">
            Pay from account
          </h3>
          <p className="text-[11px] text-gray-500">Chama: {name}</p>
        </div>
      </div>

      {remainingAmount > 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
          Outstanding: {formatBalance(remainingAmount)}
        </p>
      )}

      <form onSubmit={handlePayment} className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="amount" className="text-[12px] font-medium text-gray-700">
              Amount ({isKES ? "KES" : "USDC"})
            </label>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setKesMode(true)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                }`}
              >
                KES
              </button>
              <button
                type="button"
                onClick={() => setKesMode(false)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  !kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                }`}
              >
                USDC
              </button>
            </div>
          </div>
          <input
            type="text"
            inputMode="decimal"
            id="amount"
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
            }}
            placeholder="0.00"
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-downy-200 text-[14px] font-semibold"
            required
            disabled={isLoading}
          />
        </div>

        <div className="flex justify-end text-[12px] text-gray-600">
          <span>
            Available:{" "}
            <span className="font-medium">
              {isBalanceLoading
                ? "…"
                : isBalanceError
                  ? "—"
                  : formatBalance(walletUsdc)}
            </span>
          </span>
        </div>

        <button
          type="submit"
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-3 px-4 rounded-xl font-bold text-[13px] transition-colors ${
            isLoading
              ? "bg-downy-300 text-gray-600 cursor-not-allowed"
              : "bg-downy-600 text-white hover:bg-downy-700"
          }`}
        >
          {isLoading ? "Processing…" : "Make payment"}
        </button>
      </form>
    </div>
  );
};

export default USDCPay;
