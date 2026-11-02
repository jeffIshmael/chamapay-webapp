"use client";

import { useEffect, useRef, useState } from "react";
import { getOnrampQuote, type OnrampQuote } from "@/lib/pretiumService";

/** True while the quote has more than `marginMs` left, so the server can still accept it. */
export const isOnrampQuoteFresh = (q: OnrampQuote | null, marginMs = 8_000) =>
  !!q && Date.parse(q.expiresAt) - Date.now() > marginMs;

interface Options {
  token: string | null | undefined;
  /** false = do not quote (modal closed, amount out of range, phone invalid...) */
  enabled: boolean;
  /** whole KES that will actually be sent (Math.ceil of what the user typed) */
  kesAmount: number;
  /** "07XXXXXXXX" once the number is valid, otherwise "" */
  phoneLocal: string;
  debounceMs?: number;
  /** how many times an unused quote is silently renewed before it is left to expire */
  maxRenewals?: number;
}

/**
 * Pre-fetches the real Element Pay quote while the user is still filling the form, so that
 * tapping Deposit can accept it straight away instead of quoting (and waiting ~2s) first.
 * - the quote is kept only for the SAME amount and phone: any change clears it immediately
 * - an unused quote is renewed shortly before it expires (a few times at most)
 * - it never blocks the Deposit button: with no fresh quote the server simply quotes as before
 */
export function useOnrampQuote({
  token,
  enabled,
  kesAmount,
  phoneLocal,
  debounceMs = 600,
  maxRenewals = 3,
}: Options) {
  const [quote, setQuote] = useState<OnrampQuote | null>(null);
  const [renewTick, setRenewTick] = useState(0);
  const renewals = useRef(0);
  const lastKey = useRef("");

  useEffect(() => {
    const key = `${kesAmount}|${phoneLocal}`;
    const inputsChanged = key !== lastKey.current;
    lastKey.current = key;
    if (inputsChanged) {
      renewals.current = 0;
      setQuote(null); // a quote for another amount/number must never be reused
    }

    if (!enabled || !token || !(kesAmount > 0) || !phoneLocal) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    // a renewal fires right away; a typing change waits for the user to stop typing
    const timer = setTimeout(
      async () => {
        try {
          const q = await getOnrampQuote(token, kesAmount, phoneLocal);
          if (!cancelled && q?.success && q.quoteId) setQuote(q);
        } catch {
          /* no quote is fine: the server will create one when the user taps Deposit */
        }
      },
      inputsChanged ? debounceMs : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, token, kesAmount, phoneLocal, debounceMs, renewTick]);

  // renew an unused quote ~10s before it expires
  useEffect(() => {
    if (!quote || renewals.current >= maxRenewals) return;
    const ms = Date.parse(quote.expiresAt) - Date.now() - 10_000;
    const t = setTimeout(() => {
      renewals.current += 1;
      setRenewTick((n) => n + 1);
    }, Math.max(ms, 1_000));
    return () => clearTimeout(t);
  }, [quote, maxRenewals]);

  return { quote, setQuote };
}