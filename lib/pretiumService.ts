import { serverUrl } from "@/lib/serverUrl";

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
    const response = await fetch(`${serverUrl}/pretium/onramp`, {
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
    const response = await fetch(
      `${serverUrl}/pretium/status/${encodeURIComponent(transactionCode)}`,
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
  maxAttempts = 30,
  interval = 2000
): Promise<unknown> => {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const result = await checkPretiumPaymentStatus(transactionCode, token);
        if (!result.success) {
          clearInterval(pollInterval);
          reject(result);
          return;
        }

        const transactionStatus =
          result.details?.status?.toLowerCase() || "";
        onStatusUpdate(transactionStatus, result);

        if (
          transactionStatus === "completed" ||
          transactionStatus === "complete"
        ) {
          clearInterval(pollInterval);
          resolve(result);
          return;
        }

        if (
          ["failed", "cancelled", "timeout", "expired"].includes(
            transactionStatus
          )
        ) {
          clearInterval(pollInterval);
          reject(result);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          reject({
            success: false,
            status: "timeout",
            error: "Payment verification timed out",
          });
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, interval);
  });
};

export async function validatePhoneNumber(
  currencyCode: CurrencyCode,
  type: string,
  mobileNetwork: string,
  shortcode: string,
  token: string,
  accountNumber?: string
) {
  try {
    const response = await fetch(`${serverUrl}/pretium/verify/mobileNetwork`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currencyCode,
        mobileNetwork,
        type,
        shortcode,
        accountNumber,
      }),
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
