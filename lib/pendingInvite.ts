import { decryptChamaSlug, encryptChamaSlug } from "@/lib/encryption";

const PENDING_CHAMA_KEY = "chamapay_pending_chama";

/** Persist encrypted chama invite token through signup / login. */
export function setPendingChamaInvite(encryptedToken: string) {
  try {
    if (typeof window === "undefined") return;
    const t = (encryptedToken || "").trim();
    if (!t) return;
    sessionStorage.setItem(PENDING_CHAMA_KEY, t);
  } catch {
    /* ignore */
  }
}

/** Persist from a known plaintext slug (e.g. /Chama/[slug] while logged out). */
export function setPendingChamaFromSlug(slug: string) {
  const s = (slug || "").trim();
  if (!s) return;
  setPendingChamaInvite(encryptChamaSlug(s));
}

export function peekPendingChamaInvite(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(PENDING_CHAMA_KEY);
  } catch {
    return null;
  }
}

export function clearPendingChamaInvite() {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(PENDING_CHAMA_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Path to open after login/signup when an invite is pending.
 * Does not clear storage (safe if multiple redirects fire).
 */
export function getPostAuthRedirect(fallback = "/MyChamas"): string {
  const token = peekPendingChamaInvite();
  if (!token) return fallback;
  const slug = (decryptChamaSlug(token) || token).trim();
  if (!slug) return fallback;
  return `/Chama/${encodeURIComponent(slug)}`;
}
