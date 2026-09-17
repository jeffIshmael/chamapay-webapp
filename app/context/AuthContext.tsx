"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { serverUrl } from "@/lib/serverUrl";
import { showToast } from "@/app/Components/Toast";
import { authDebug, decodeJwtPayload } from "@/lib/authDebug";

export interface AuthUser {
  id: number;
  email: string;
  userName: string;
  profileImageUrl?: string | null;
  smartAddress?: string | null;
  address?: string | null;
  phoneNo?: string | number | null;
  isGuest?: boolean;
  [key: string]: unknown;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  /** Wallet address for app features (smart wallet from profile) */
  address: string | null;
  loginWithGoogle: (idTokenOrAccessToken: string, tokenType?: "id" | "access") => Promise<"ok" | "register" | "error">;
  sendEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<"ok" | "register" | "error">;
  register: (data: {
    email: string;
    userName: string;
    profileImageUrl?: string;
  }) => Promise<boolean>;
  /** Temporary browse-only session while Google auth is fixed */
  continueAsGuest: () => void;
  setPendingProfile: (profile: { email: string; name?: string; picture?: string } | null) => void;
  pendingProfile: { email: string; name?: string; picture?: string } | null;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateLocalUser: (patch: Partial<AuthUser>) => void;
  /** @deprecated wallet signature login — kept as no-op for legacy callers */
  login: (address: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "web_token";
const REFRESH_KEY = "web_refresh_token";
const USER_KEY = "web_user";
export const GUEST_TOKEN = "guest";

async function checkUserExists(email: string): Promise<boolean> {
  const response = await fetch(`${serverUrl}/user/checkUserExists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.toLowerCase().trim() }),
  });
  const data = await response.json().catch(() => ({}));
  return Boolean(data?.success || data?.exists);
}

async function authenticateEmail(email: string, provider: string) {
  const response = await fetch(`${serverUrl}/auth/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.toLowerCase().trim(), provider }),
  });
  return { ok: response.ok, data: await response.json().catch(() => ({})) };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProfile, setPendingProfile] = useState<{
    email: string;
    name?: string;
    picture?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      authDebug("hydrate", {
        hasToken: Boolean(storedToken),
        hasUser: Boolean(storedUser),
      });
      if (storedToken) setToken(storedToken);
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch (e) {
      authDebug("hydrate failed", e);
    }
    setIsLoading(false);
  }, []);

  const persistSession = useCallback(
    (nextToken: string, nextUser: AuthUser, refreshToken?: string | null) => {
      authDebug("persistSession", {
        userId: nextUser?.id,
        email: nextUser?.email,
        hasSmartAddress: Boolean(nextUser?.smartAddress || nextUser?.address),
      });
      setToken(nextToken);
      setUser(nextUser);
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPendingProfile(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const updateLocalUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken || storedToken === GUEST_TOKEN) return;
    try {
      const response = await fetch(`${serverUrl}/user`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const nextUser = (data?.user ?? data) as AuthUser;
      if (nextUser?.id != null) {
        setUser(nextUser);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loginWithGoogle = useCallback(
    async (
      rawToken: string,
      tokenType: "id" | "access" = "id"
    ): Promise<"ok" | "register" | "error"> => {
      try {
        let email = "";
        let name = "";
        let picture = "";

        if (tokenType === "id") {
          const payload = decodeJwtPayload(rawToken);
          email = String(payload.email || "");
          name = String(payload.name || "");
          picture = String(payload.picture || "");
          authDebug("google id token decoded", { email, hasName: Boolean(name) });
        } else {
          const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
            headers: { Authorization: `Bearer ${rawToken}` },
          });
          const info = await res.json();
          email = info.email || "";
          name = info.name || "";
          picture = info.picture || "";
          authDebug("google access token profile", { email });
        }

        if (!email) {
          showToast("Could not get email from Google", "error");
          return "error";
        }

        const exists = await checkUserExists(email);
        authDebug("checkUserExists", { email, exists });
        if (!exists) {
          setPendingProfile({ email, name, picture });
          return "register";
        }

        const { ok, data } = await authenticateEmail(email, "google");
        authDebug("authenticateEmail", {
          ok,
          hasToken: Boolean(data?.token),
          hasUser: Boolean(data?.user),
          message: data?.message,
        });
        if (ok && data?.token && data?.user) {
          persistSession(data.token, data.user, data.refreshToken);
          showToast("Signed in with Google", "success");
          return "ok";
        }
        showToast(data?.message || "Google sign-in failed", "error");
        return "error";
      } catch (error) {
        authDebug("loginWithGoogle error", error);
        console.error(error);
        showToast("Google sign-in failed", "error");
        return "error";
      }
    },
    [persistSession]
  );

  const sendEmailCode = useCallback(async (email: string) => {
    try {
      const response = await fetch(`${serverUrl}/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(data?.message || "Failed to send code", "error");
        return false;
      }
      showToast("Verification code sent", "success");
      return true;
    } catch {
      showToast("Failed to send code", "error");
      return false;
    }
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string): Promise<"ok" | "register" | "error"> => {
      try {
        const response = await fetch(`${serverUrl}/auth/verify-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.toLowerCase().trim(),
            code: code.trim(),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showToast(data?.message || "Invalid code", "error");
          return "error";
        }

        // Existing user may already get tokens from verify-code
        if (data?.token && data?.user) {
          persistSession(data.token, data.user, data.refreshToken);
          showToast("Signed in", "success");
          return "ok";
        }

        const exists = await checkUserExists(email);
        if (!exists) {
          setPendingProfile({ email });
          return "register";
        }

        const { ok, data: authData } = await authenticateEmail(email, "email");
        if (ok && authData?.token && authData?.user) {
          persistSession(authData.token, authData.user, authData.refreshToken);
          showToast("Signed in", "success");
          return "ok";
        }

        showToast(authData?.message || "Authentication failed", "error");
        return "error";
      } catch {
        showToast("Verification failed", "error");
        return "error";
      }
    },
    [persistSession]
  );

  const register = useCallback(
    async (data: {
      email: string;
      userName: string;
      profileImageUrl?: string;
    }) => {
      try {
        const response = await fetch(`${serverUrl}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email.toLowerCase().trim(),
            userName: data.userName.trim(),
            profileImageUrl: data.profileImageUrl || "",
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.token || !result?.user) {
          showToast(result?.message || "Registration failed", "error");
          return false;
        }
        persistSession(result.token, result.user, result.refreshToken);
        setPendingProfile(null);
        showToast("Welcome to ChamaPay!", "success");
        return true;
      } catch {
        showToast("Registration failed", "error");
        return false;
      }
    },
    [persistSession]
  );

  /** Legacy wallet login — unused; kept so old imports don't crash */
  const login = useCallback(async (_address: string) => {
    showToast("Please sign in with Google or email", "warning");
    return false;
  }, []);

  const continueAsGuest = useCallback(() => {
    const guestUser: AuthUser = {
      id: 0,
      email: "guest@chamapay.local",
      userName: "Guest",
      smartAddress: null,
      address: null,
      isGuest: true,
    };
    persistSession(GUEST_TOKEN, guestUser);
    showToast("Browsing as guest — some actions are disabled", "success");
  }, [persistSession]);

  const address = useMemo(() => {
    if (!user) return null;
    return (
      (user.smartAddress as string) ||
      (user.address as string) ||
      null
    );
  }, [user]);

  const isGuest = Boolean(user?.isGuest) || token === GUEST_TOKEN;

  const value: AuthContextType = {
    token,
    user,
    isAuthenticated: !!token && !!user,
    isGuest,
    isLoading,
    address,
    loginWithGoogle,
    sendEmailCode,
    verifyEmailCode,
    register,
    continueAsGuest,
    pendingProfile,
    setPendingProfile,
    logout,
    refreshUser,
    updateLocalUser,
    login,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
