"use client";

import { useCurrencyStore } from "@/store/useCurrencyStore";

/**
 * Format a raw USDC amount using the user's preferred display currency.
 */
export function useFormattedBalance() {
  const { currency, platformRate } = useCurrencyStore();

  const formatBalance = (
    usdcBalance: number | string | undefined | null,
    noDecimals?: boolean
  ) => {
    if (usdcBalance === undefined || usdcBalance === null) {
      return currency === "KES"
        ? noDecimals
          ? "Ksh 0"
          : "Ksh 0.00"
        : noDecimals
          ? "0 USDC"
          : "0.00 USDC";
    }

    const numericBalance =
      typeof usdcBalance === "string" ? parseFloat(usdcBalance) : usdcBalance;

    if (isNaN(numericBalance)) {
      return currency === "KES"
        ? noDecimals
          ? "Ksh 0"
          : "Ksh 0.00"
        : noDecimals
          ? "0 USDC"
          : "0.00 USDC";
    }

    if (currency === "KES") {
      const minFrac = noDecimals ? 0 : 2;
      const maxFrac = noDecimals ? 0 : 2;
      const kesValue = noDecimals
        ? Math.ceil(numericBalance * platformRate)
        : Math.ceil(numericBalance * platformRate * 100) / 100;
      return ` ${kesValue.toLocaleString("en-KE", {
        minimumFractionDigits: minFrac,
        maximumFractionDigits: maxFrac,
      })} KES`;
    }

    const usdcValue = Math.round(numericBalance * 1000) / 1000;
    return `${usdcValue.toLocaleString("en-US", {
      minimumFractionDigits: noDecimals ? 0 : 3,
      maximumFractionDigits: 3,
    })} USDC`;
  };

  const formatBalanceParts = (
    usdcBalance: number | string | undefined | null,
    noDecimals?: boolean
  ) => {
    if (usdcBalance === undefined || usdcBalance === null || isNaN(Number(usdcBalance))) {
      return { whole: "0", decimal: "00", symbol: currency === "KES" ? "KES" : "USDC" };
    }

    const numericBalance =
      typeof usdcBalance === "string" ? parseFloat(usdcBalance) : usdcBalance;

    let value: number;
    let minFrac: number;
    let maxFrac: number;

    if (currency === "KES") {
      value = noDecimals
        ? Math.ceil(numericBalance * platformRate)
        : Math.ceil(numericBalance * platformRate * 100) / 100;
      minFrac = noDecimals ? 0 : 2;
      maxFrac = noDecimals ? 0 : 2;
    } else {
      value = Math.round(numericBalance * 1000) / 1000;
      minFrac = noDecimals ? 0 : 3;
      maxFrac = 3;
    }

    const formattedString = value.toLocaleString("en-US", {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    });
    const [whole, decimal] = formattedString.split(".");

    return {
      whole,
      decimal: decimal || "00",
      symbol: currency === "KES" ? "KES" : "USDC",
    };
  };

  /** Always format as USDC (for secondary “peek” under preferred currency). */
  const formatUsdc = (
    usdcBalance: number | string | undefined | null,
    noDecimals?: boolean
  ) => {
    if (usdcBalance === undefined || usdcBalance === null) {
      return noDecimals ? "0 USDC" : "0.000 USDC";
    }
    const numericBalance =
      typeof usdcBalance === "string" ? parseFloat(usdcBalance) : usdcBalance;
    if (isNaN(numericBalance)) {
      return noDecimals ? "0 USDC" : "0.000 USDC";
    }
    const usdcValue = Math.round(numericBalance * 1000) / 1000;
    return `${usdcValue.toLocaleString("en-US", {
      minimumFractionDigits: noDecimals ? 0 : 3,
      maximumFractionDigits: 3,
    })} USDC`;
  };

  return {
    formatBalance,
    formatBalanceParts,
    formatUsdc,
    /** Show a gray USDC line under amounts when display currency is not USDC. */
    showUsdcPeek: currency === "KES",
    currency,
    platformRate,
  };
}
