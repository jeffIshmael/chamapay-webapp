"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useReadContract } from "wagmi";
import { celo } from "viem/chains";
import erc20Abi from "@/app/ChamaPayABI/ERC20.json";
import { usdcContractAddress } from "../ChamaPayABI/ChamaPayContract";
import { showToast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { serverUrl } from "@/lib/serverUrl";

const USDCPay = ({
  chamaId,
  chamaBlockchainId,
  name,
  onClose,
  isLoading,
  setIsLoading,
}: {
  chamaId: number;
  chamaBlockchainId: number;
  name: string;
  onClose: () => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}) => {
  const { address, isAuthenticated } = useSessionAddress();
  const [amount, setAmount] = useState("");
  const { token } = useAuth();

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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !address || !token) {
      showToast("Please sign in to pay", "warning");
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    const payAmount = parseFloat(data.amount as string);

    if (isNaN(payAmount) || payAmount <= 0) {
      showToast("Invalid amount", "warning");
      return;
    }

    const balance = Number(balanceData) / 10 ** 6;
    if (payAmount > balance) {
      showToast("Insufficient USDC balance", "error");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${serverUrl}/chama/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: payAmount.toString(),
          blockchainId: chamaBlockchainId,
          chamaId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.error) {
        showToast(result?.error || result?.message || "Payment failed", "error");
        return;
      }

      showToast(`${payAmount} USDC paid to ${name}`, "success");
      onClose();
    } catch (error) {
      console.error("Payment error:", error);
      showToast("A problem occurred. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined) => {
    if (isBalanceLoading) return "Loading...";
    if (isBalanceError || balance === undefined) return "---";
    return (Number(balance) / 10 ** 6).toFixed(3);
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
          <h3 className="text-lg font-semibold text-gray-800">Pay with USDC</h3>
          <p className="text-xs text-gray-500">Chama: {name}</p>
        </div>
      </div>

      <form onSubmit={handlePayment} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="amount" className="text-sm font-medium text-gray-700">
            Amount (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              id="amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.0001"
              min="0"
              className="w-full p-2 pl-8 border border-gray-300 rounded-md focus:ring focus:ring-downy-200 focus:border-blue-500"
              required
              disabled={isLoading}
            />
            <span className="absolute left-2 top-2.5 text-gray-500">$</span>
          </div>
        </div>

        <div className="text-sm space-y-1 ">
          <div className="flex justify-end text-gray-600 gap-1">
            <span>Available: </span>
            <span className="font-medium">
              {formatBalance(balanceData as bigint)} USDC
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            isLoading
              ? "bg-downy-300 text-gray-600 cursor-not-allowed"
              : "bg-downy-500 text-white hover:bg-downy-600"
          }`}
        >
          {isLoading ? "Processing..." : "make payment"}
        </button>
      </form>
    </div>
  );
};

export default USDCPay;
