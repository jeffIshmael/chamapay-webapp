"use client";

import { useEffect, useState } from "react";
import { getOfframpQuote, type OfframpQuote } from "@/lib/pretiumService";

/**
 * True while the quote has more than `marginMs` left before it expires,
 * so it is still safe to show and to send back to /elementpay/offramp.
 *
 * NOTE: OfframpQuote needs `expiresAt: string` (the backend already sends it).
 */
export const isQuoteFresh = (q: OfframpQuote | null, marginMs = 8_000) =>
  !!q && Date.parse(q.expiresAt) - Date.now() > marginMs;

interface Options {
  token: string | null | undefined;
  /** false = do not quote (modal closed, amount out of range, over balance...) */
  enabled: boolean;
  /** KES the user typed */
  kesAmount: number;
  /** "07XXXXXXXX" once the number is valid, otherwise "" */
  phoneLocal: string;
  debounceMs?: number;
}

/**
 * Real, binding Element Pay quote for the typed amount.
 * - waits `debounceMs` after the last change before calling the API
 * - clears the previous quote immediately, so a stale number is never shown
 * - ignores responses that arrive after the inputs changed
 */
export function useOfframpQuote({
  token,
  enabled,
  kesAmount,
  phoneLocal,
  debounceMs = 700,
}: Options) {
  const [quote, setQuote] = useState<OfframpQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuote(null);
    setError("");

    if (!enabled || !token || !(kesAmount > 0)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const q = await getOfframpQuote(token, kesAmount.toFixed(2), phoneLocal);
        if (cancelled) return;
        if (!q.success) setError(q.error || "Could not get a quote. Try again.");
        else setQuote(q);
      } catch {
        if (!cancelled) setError("Could not get a quote. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, token, kesAmount, phoneLocal, debounceMs]);

  // setQuote is exposed so the modal can replace the quote after a RATE_CHANGED response
  return { quote, setQuote, loading, error };
}