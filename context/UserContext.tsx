"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { getUserDetails, allUserDetails } from "@/lib/chamaService";
import { useSessionAddress } from "@/lib/useSessionAddress";

export type KycStatus = "not_started" | "pending" | "approved" | "rejected";
type User = allUserDetails["user"];

// Map whatever the backend sends to our union. Adjust the values to match your API.
function normalizeKyc(raw?: string | null): KycStatus | null {
  switch ((raw ?? "").toLowerCase()) {
    case "approved":
    case "verified":
      return "approved";
    case "pending":
    case "under_review":
      return "pending";
    case "rejected":
    case "failed":
      return "rejected";
    case "not_started":
    case "none":
      return "not_started";
    default:
      return "not_started";
  }
}

interface UserContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  kycStatus: KycStatus | null;
  isKycApproved: boolean;
  isKycPending: boolean;
  isKycRejected: boolean;
  needsKyc: boolean; // not started or rejected
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthenticated, isGuest, isLoading: authLoading } =
    useSessionAddress();

  const refreshUser = useCallback(async () => {
    if (!token || !isAuthenticated || isGuest) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const details = await getUserDetails(token);
      if (!details?.user || !details.user.id) {
        throw new Error("Failed to fetch user");
      }
      setUser(details.user);
    } catch (e: any) {
      setError(e.message ?? "Failed to fetch user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, isGuest]);

  useEffect(() => {
    if (authLoading) return; // wait until auth is resolved
    refreshUser();
  }, [authLoading, refreshUser]);

  const value = useMemo<UserContextValue>(() => {
    const kycStatus = normalizeKyc(user?.kycStatus);
    return {
      user,
      loading: loading || authLoading,
      error,
      kycStatus,
      isKycApproved: kycStatus === "approved",
      isKycPending: kycStatus === "pending",
      isKycRejected: kycStatus === "rejected",
      needsKyc: kycStatus === "not_started" || kycStatus === "rejected",
      refreshUser,
    };
  }, [user, loading, authLoading, error, refreshUser]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
}