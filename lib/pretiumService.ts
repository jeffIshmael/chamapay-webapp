import { serverUrl } from "@/lib/serverUrl";
import { Console } from "console";

const useElementPay = process.env.NEXT_PUBLIC_USE_ELEMENTPAY === "true";
/** Exposed so the deposit screen only pre-fetches Element Pay quotes when Element Pay is in use. */
export const USE_ELEMENTPAY = useElementPay;

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
  goalId?: number,
  // Element Pay only: a quote from getOnrampQuote for this exact amount + number. The server
  // accepts it directly instead of creating (and waiting on) a new one. Ignored if invalid/expired.
  quoteId?: string
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
        quoteId,
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
  token: string,
  provider?: "elementpay" | "pretium" // default: follow NEXT_PUBLIC_USE_ELEMENTPAY (on-ramp behaviour unchanged)
) => {
  try {
    const viaElementPay = provider ? provider === "elementpay" : useElementPay;
    const url = viaElementPay ? `${serverUrl}/elementpay/status/${encodeURIComponent(transactionCode)}` : `${serverUrl}/pretium/status/${encodeURIComponent(transactionCode)}`;
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
  interval = 2000,
  provider?: "elementpay" | "pretium"
): Promise<unknown> => {
  let attempts = 0;
  let failures = 0;

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const result = await checkPretiumPaymentStatus(transactionCode, token, provider);

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
// Element Pay off-ramp (KES in, flat 2.5% transaction fee)
// ---------------------------------------------------------------------------

export interface OfframpQuote {
  success: boolean;
  quoteId: string | null;
  expiresAt: string;
  kes: {
    amount: number; // what the user typed (100%)
    fee: number; // the 2.5% transaction fee
    elementPayFee: number; // always 0 now (Element Pay removed its fee)
    elementPayReceive: number; // Element Pay's actual payout
    receive: number; // the amount shown to the user (typed amount minus 2.5%)
  };
  usdc: {
    gross: string; // typed amount at the platform rate (132); all of it leaves the wallet
    fee: string; // gross - net, kept by the treasury (can be 0 at break-even)
    net: string; // USDC sent to Element Pay
    elementPayFee: string; // Element Pay fee in USDC
  };
  rate: string;
  // Raw Element Pay amounts.rate for the actual binding quote.
  elementPayRate?: string;
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
    const result = await epPost("/quote", token, { type: "offramp" });
    return result;
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

// ---------------------------------------------------------------------------
// Element Pay on-ramp quote (pre-fetched on the deposit screen, reused on Deposit)
// ---------------------------------------------------------------------------

export interface OnrampQuote {
  success: boolean;
  quoteId: string;
  expiresAt: string; // ISO time after which the server will no longer accept this quote
  amountKes: number; // the whole-KES amount the quote was made for
  error?: string;
}

/**
 * Binding quote for a deposit. Nothing is charged: the quote is only accepted when the user taps
 * Deposit and pretiumOnramp sends this quoteId back. Only the fields the UI needs are kept.
 */
export async function getOnrampQuote(
  token: string,
  amount: number,
  phoneNo: string
): Promise<OnrampQuote> {
  try {
    const data = await epPost("/quote", token, { type: "onramp", amount, phoneNo });
    if (!data?.success || !data?.quoteId) {
      return { success: false, quoteId: "", expiresAt: "", amountKes: amount, error: data?.error };
    }
    return {
      success: true,
      quoteId: data.quoteId,
      expiresAt: data.expiresAt,
      amountKes: Number(data.amountKes ?? amount),
    };
  } catch {
    return { success: false, quoteId: "", expiresAt: "", amountKes: amount, error: "Could not get a quote" };
  }
}