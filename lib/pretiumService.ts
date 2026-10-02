import { serverUrl } from "@/lib/serverUrl";
import { Console } from "console";

const useElementPay = process.env.NEXT_PUBLIC_USE_ELEMENTPAY === "true";

export type CurrencyCode =
  | "KES"
  | "UGX"
  | "CDF"
  | "MWK"
  | "ETB"
  | "GHS"
  | "NGN";

export async function pretiumOnramp(
  phoneNo: string,
  amount: number,
  exchangeRate: number,
  usdcAmount: number,
  isDeposit: boolean,
  token: string,
  chamaId?: number,
  memberForId?: number,
  isMoonwellDeposit?: boolean,
  goalId?: number
) {
  try {
    const url = useElementPay ? `${serverUrl}/elementpay/onramp` : `${serverUrl}/pretium/onramp`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        phoneNo,
        exchangeRate,
        usdcAmount,
        isDeposit,
        chamaId,
        memberForId,
        isMoonwellDeposit,
        goalId,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data?.error || "Failed to initiate onramp",
        code: data?.code,
        mtdKes: data?.mtdKes,
        limitKes: data?.limitKes,
        remainingKes: data?.remainingKes,
        kycTier: data?.kycTier,
      };
    }
    return data;
  } catch {
    return { success: false, error: "Failed to initiate onramp" };
  }
}

export async function getExchangeRate(currencyCode: CurrencyCode = "KES") {
  try {
    const response = await fetch(`${serverUrl}/pretium/quote/${currencyCode}`);
    return await response.json();
  } catch {
    return { success: false, error: "Failed to get the exchange rate" };
  }
}

export const checkPretiumPaymentStatus = async (
  transactionCode: string,
  token: string
) => {
  try {
    const url = useElementPay ? `${serverUrl}/elementpay/status/${encodeURIComponent(transactionCode)}` : `${serverUrl}/pretium/status/${encodeURIComponent(transactionCode)}`;
    const response = await fetch(
      url,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return await response.json();
  } catch {
    return { success: false, error: "Failed to check payment status" };
  }
};

export const pollPretiumPaymentStatus = async (
  transactionCode: string,
  token: string,
  onStatusUpdate: (status: string, result?: unknown) => void,
  maxAttempts = 90, // ~3 minutes
  interval = 2000
): Promise<unknown> => {
  let attempts = 0;
  let failures = 0;

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const result = await checkPretiumPaymentStatus(transactionCode, token);

        if (!result.success) {
          // tolerate occasional bad responses instead of aborting a payment that may still complete
          if (++failures >= 5) {
            clearInterval(pollInterval);
            reject(result);
          }
          return;
        }
        failures = 0;

        const transactionStatus = result.details?.status?.toLowerCase() || "";
        onStatusUpdate(transactionStatus, result);

        if (transactionStatus === "completed" || transactionStatus === "complete") {
          clearInterval(pollInterval);
          resolve(result);
          return;
        }

        if (["failed", "cancelled", "timeout", "expired"].includes(transactionStatus)) {
          clearInterval(pollInterval);
          reject(result);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          reject({ success: false, status: "timeout", error: "Payment verification timed out" });
        }
      } catch (error) {
        if (++failures >= 5) {
          clearInterval(pollInterval);
          reject(error);
        }
      }
    }, interval);
  });
};

export async function validatePhoneNumber(
  shortcode: string,
  token: string,
) {
  try {
    const response = await fetch(`${serverUrl}/pretium/verify?phoneNo=${shortcode}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    });
    console.log("Getting the value of verifying number.");
    return await response.json();
  } catch {
    return { success: false, error: "Failed to verify mobile network" };
  }
}

export function extractTransactionCode(response: {
  transactionCode?: string;
  result?: { transaction_code?: string; transactionCode?: string };
}): string | undefined {
  return (
    response.transactionCode ||
    response.result?.transaction_code ||
    response.result?.transactionCode
  );
}

export async function disburseToMobileNumber(
  currencyCode: CurrencyCode,
  mobileNetwork: string,
  shortCode: string,
  amount: string,
  usdcAmount: string,
  exchangeRate: string,
  amountFee: string,
  token: string
) {
  try {
    const response = await fetch(`${serverUrl}/pretium/mobileOfframp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currencyCode,
        mobileNetwork,
        shortCode,
        usdcAmount,
        exchangeRate,
        amount,
        amountFee,
      }),
    });
    return await response.json();
  } catch {
    return { success: false, error: "Failed to transfer to mobile network" };
  }
}

// ---------------------------------------------------------------------------
// Element Pay off-ramp (KES in, fee from our bracket table)
// ---------------------------------------------------------------------------

export interface OfframpQuote {
  success: boolean;
  quoteId: string | null;
  expiresAt: string;
  kes: { amount: number; fee: number; receive: number };
  usdc: { gross: string; fee: string; net: string };
  rate: string;
  error?: string;
  code?: string;
}

async function epPost(path: string, token: string, body: unknown) {
  const response = await fetch(`${serverUrl}/elementpay${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  // keep the server's fields (code, kes, usdc...) so the UI can react to RATE_CHANGED
  return response.ok ? data : { ...data, success: false };
}

/** Page rate: effectiveRate = KES per 1 USDC after Element Pay's fees (shared, cached ~30s on the server). */
export async function getOfframpRate(token: string) {
  try {
    return await epPost("/quote", token, { type: "offramp" });
  } catch {
    return { success: false, error: "Failed to get the withdrawal rate" };
  }
}

/** Binding quote: our fee, what lands in M-Pesa, and the exact USDC that leaves the wallet. */
export async function getOfframpQuote(
  token: string,
  kesAmount: number | string,
  phoneNo: string
): Promise<OfframpQuote> {
  try {
    const data = await epPost("/quote", token, {
      type: "offramp",
      kesAmount,
      phoneNo,
    });
    if (!data?.success) {
      return { ...data, success: false, error: data?.error || "Could not get a quote" };
    }
    return data;
  } catch {
    return { success: false, error: "Could not get a quote" } as OfframpQuote;
  }
}

/** Start the withdrawal. On code === "RATE_CHANGED" the response carries the new kes/usdc to re-confirm. */
export async function elementPayOfframp(
  token: string,
  params: {
    kesAmount: number | string;
    phoneNo: string;
    quoteId?: string | null;
    expectedUsdc?: string;
  }
) {
  try {
    const data = await epPost("/offramp", token, params);
    if (!data?.success) {
      return { ...data, success: false, error: data?.error || "Failed to start withdrawal" };
    }
    return data;
  } catch {
    return { success: false, error: "Failed to start withdrawal" };
  }
}