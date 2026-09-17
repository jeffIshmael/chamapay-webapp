/** Lightweight auth/home debug logs for prod triage (filter console by Chamapay:auth). */
export function authDebug(message: string, data?: unknown) {
  try {
    if (data !== undefined) {
      console.info(`[Chamapay:auth] ${message}`, data);
    } else {
      console.info(`[Chamapay:auth] ${message}`);
    }
  } catch {
    /* ignore */
  }
}

export function decodeJwtPayload(rawToken: string): Record<string, unknown> {
  const part = rawToken.split(".")[1] || "";
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const json = decodeURIComponent(
    Array.from(binary)
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("")
  );
  return JSON.parse(json) as Record<string, unknown>;
}
