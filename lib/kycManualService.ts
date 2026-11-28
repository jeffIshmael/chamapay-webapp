import { serverUrl } from "./serverUrl";


const API_BASE = serverUrl;

export type ManualSubmission = {
  reference: string;
  status: "processing" | "approved" | "rejected";
  docType?: string;
  submittedAt: string;
  reviewedAt?: string | null;
  rejectReason?: string | null;
};

type Base = { success: boolean; error?: string };

async function call<T extends Base>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const data = await res.json().catch(() => null);
    if (!data) {
      return { success: false, error: `Request failed (${res.status})` } as T;
    }
    if (!res.ok && data.success === undefined) {
      return { success: false, error: `Request failed (${res.status})` } as T;
    }
    return data as T;
  } catch {
    return {
      success: false,
      error: "Network error. Check your connection and try again.",
    } as T;
  }
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* ------------------------------ phone OTP ------------------------------- */

export const sendPhoneOtp = (token: string, phone: string, dialCode: string) =>
  call<Base & { phoneE164?: string }>(token, "/kyc/send-phone-otp", json({ phone, dialCode }));

export const verifyPhoneOtp = (token: string, code: string) =>
  call<Base & { phoneE164?: string }>(token, "/kyc/verify-phone-otp", json({ code }));

/* ------------------------------ manual KYC ------------------------------ */

export const getManualChallenge = (token: string) =>
  call<Base & { prompt: string; challenge: string; expiresAt: number }>(
    token,
    "/kyc/manual/challenge"
  );

export const getManualStatus = (token: string) =>
  call<Base & { submission: ManualSubmission | null }>(token, "/kyc/manual/status");

/** FormData is sent as multipart; do NOT set Content-Type manually. */
export const submitManualKyc = (token: string, form: FormData) =>
  call<Base & { reference?: string; alreadyVerified?: boolean }>(
    token,
    "/kyc/manual/submit",
    { method: "POST", body: form }
  );

/* -------------------------------- admin --------------------------------- */

export type AdminQueueItem = {
  id: number;
  jobId: string;
  docType: string;
  country: string;
  firstName: string;
  lastName: string;
  flags: string[] | null;
  createdAt: string;
  user: { id: number; userName: string | null };
};

export type AdminDetail = {
  id: number;
  reference: string;
  status: string;
  docType: string;
  country: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string | null;
  documentNumber: string | null;
  livenessPrompt: string;
  flags: string[] | null;
  submittedAt: string;
  user: { id: number; userName: string | null; email: string | null; phoneE164: string | null };
  images: { frontUrl: string | null; backUrl: string | null; selfieUrl: string | null };
};

export const adminKycQueue = (token: string) =>
  call<Base & { items: AdminQueueItem[] }>(token, "/admin/kyc/queue");

export const adminKycDetail = (token: string, id: number) =>
  call<Base & { submission: AdminDetail }>(token, `/admin/kyc/${id}`);

export const adminKycDecision = (
  token: string,
  id: number,
  decision: "approve" | "reject",
  reason?: string
) => call<Base & { status?: string }>(token, `/admin/kyc/${id}/decision`, json({ decision, reason }));