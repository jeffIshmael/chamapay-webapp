import { serverUrl } from "@/lib/serverUrl";

export type KycStatusResponse = {
  success: boolean;
  kycTier: number;
  kycStatus: string;
  kycVerifiedAt?: string | null;
  limitKes: number;
  mtdKes: number;
  remainingKes: number;
  tier1LimitKes: number;
  tier2LimitKes: number;
  sandbox: boolean;
  localMock?: boolean;
  provider?: string;
  phoneE164?: string | null;
  identity?: {
    documentType: string | null;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    dateOfBirth: string | null;
    documentNumber: string | null;
    nationality: string | null;
    phoneE164: string | null;
  };
  latestJob?: {
    jobId: string;
    documentType: string;
    status: string;
    createdAt: string;
  } | null;
  error?: string;
};

export type KycSessionResponse = {
  success: boolean;
  alreadyVerified?: boolean;
  jobId?: string;
  sessionId?: string;
  sessionToken?: string | null;
  url?: string;
  sandbox?: boolean;
  localMock?: boolean;
  sandboxScenario?: string | null;
  provider?: string;
  status?: string;
  message?: string;
  kycTier?: number;
  error?: string;
  details?: string;
};

export async function getKycStatus(token: string): Promise<KycStatusResponse | null> {
  try {
    const response = await fetch(`${serverUrl}/kyc/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await response.json();
  } catch {
    return null;
  }
}

/** Create Didit KYC session. Pass optional countryCode (ISO 3-letter, e.g. "KEN", "USA", "GBR") */
export async function createKycSession(
  token: string,
  options?: { countryCode?: string; platform?: string }
): Promise<KycSessionResponse> {
  try {
    const response = await fetch(`${serverUrl}/kyc/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        countryCode: options?.countryCode,
        platform: options?.platform || "web",
      }),
    });
    return await response.json();
  } catch {
    return { success: false, error: "Failed to start verification session" };
  }
}

export async function reportKycClientResult(
  token: string,
  jobId: string,
  resultRef?: string,
  status?: string
) {
  try {
    const response = await fetch(`${serverUrl}/kyc/jobs/${jobId}/client-result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ resultRef, status }),
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

export async function getKycJob(token: string, jobId: string) {
  try {
    const response = await fetch(`${serverUrl}/kyc/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await response.json();
  } catch {
    return null;
  }
}

/** Send phone verification OTP via WhatsApp */
export async function sendKycPhoneOtp(
  token: string,
  phone: string,
  dialCode: string
): Promise<{ success: boolean; phoneE164?: string; otp?: string; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/kyc/send-phone-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone, dialCode }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Failed to send code" };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || "Network error sending code" };
  }
}

/** Verify phone OTP code */
export async function verifyKycPhoneOtp(
  token: string,
  code: string
): Promise<{ success: boolean; phoneE164?: string; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/kyc/verify-phone-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Invalid code" };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || "Network error verifying code" };
  }
}
