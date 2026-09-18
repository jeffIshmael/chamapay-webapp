"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useCurrencyStore } from "@/store/useCurrencyStore";

/**
 * Default display currency to KES when the user (or their IP) is in Kenya,
 * unless they have already chosen a preference.
 */
export default function CurrencyLocationBootstrap() {
  const { user, isAuthenticated } = useAuth();
  const { hasSetCurrency, setCurrency } = useCurrencyStore();

  useEffect(() => {
    if (hasSetCurrency) return;

    const location = String(
      (user as { location?: string | null } | null)?.location ?? ""
    ).toUpperCase();

    if (isAuthenticated && (location === "KE" || location === "KENYA")) {
      setCurrency("KES");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", {
          signal: controller.signal,
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { country_code?: string };
        if (cancelled || hasSetCurrency) return;
        if (String(data?.country_code || "").toUpperCase() === "KE") {
          setCurrency("KES");
        }
      } catch {
        /* ignore geo failures */
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasSetCurrency, isAuthenticated, user, setCurrency]);

  return null;
}
