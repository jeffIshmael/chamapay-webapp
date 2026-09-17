"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Currency = "USDC" | "KES";

const STORAGE_KEY = "web_currency_storage";

type CurrencyState = {
  currency: Currency;
  platformRate: number;
  hasSetCurrency: boolean;
};

const DEFAULT_STATE: CurrencyState = {
  currency: "USDC",
  platformRate: 132,
  hasSetCurrency: false,
};

let memoryState: CurrencyState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function readStorage(): CurrencyState {
  if (typeof window === "undefined") return memoryState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryState;
    const parsed = JSON.parse(raw) as Partial<CurrencyState>;
    return {
      currency: parsed.currency === "KES" ? "KES" : "USDC",
      platformRate:
        typeof parsed.platformRate === "number" && parsed.platformRate > 0
          ? parsed.platformRate
          : DEFAULT_STATE.platformRate,
      hasSetCurrency: Boolean(parsed.hasSetCurrency),
    };
  } catch {
    return memoryState;
  }
}

function writeStorage(next: CurrencyState) {
  memoryState = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CurrencyState {
  return memoryState;
}

function getServerSnapshot(): CurrencyState {
  return DEFAULT_STATE;
}

/** Hydrate once on the client */
if (typeof window !== "undefined") {
  memoryState = readStorage();
}

export function useCurrencyStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCurrency = useCallback((currency: Currency) => {
    writeStorage({ ...memoryState, currency, hasSetCurrency: true });
  }, []);

  const setPlatformRate = useCallback((platformRate: number) => {
    writeStorage({ ...memoryState, platformRate });
  }, []);

  return {
    ...state,
    setCurrency,
    setPlatformRate,
  };
}
