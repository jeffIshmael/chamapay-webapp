"use client";

import { useAuth } from "@/app/context/AuthContext";

/** Authenticated smart wallet address from Google/email session (or guest). */
export function useSessionAddress() {
  const {
    address: authAddress,
    isAuthenticated,
    isLoading,
    user,
    token,
    isGuest,
  } = useAuth();

  const address = (authAddress || undefined) as `0x${string}` | undefined;

  return {
    address,
    isConnected: Boolean(isAuthenticated && (authAddress || isGuest)),
    user,
    token,
    isAuthenticated,
    isGuest,
    isLoading,
  };
}
