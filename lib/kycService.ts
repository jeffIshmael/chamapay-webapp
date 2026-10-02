import { serverUrl } from "@/lib/serverUrl";

export type KycNetwork = "safaricom" | "airtel";
export type KycDocumentType = "national_id" | "passport" | "driving_license";

export interface KycPayload {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phoneNumber: string; // normalized, e.g. 2547XXXXXXXX
  network: KycNetwork;
  documentType: KycDocumentType;
  documentNumber: string;
}

/**
 * TODO: replace the endpoint + body with the real verification route(s).
 * Throw an Error with a readable message on failure; the page shows it in a toast.
 */
export async function submitKycDetails(
  token: string,
  payload: KycPayload
): Promise<void> {
  const response = await fetch(`${serverUrl}/user/updateKyc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Verification failed");
  }
}