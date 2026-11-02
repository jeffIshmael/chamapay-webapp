"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { serverUrl } from "@/lib/serverUrl";
import { showToast } from "@/app/Components/Toast";
import { authDebug } from "@/lib/authDebug";

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

/** A verified email that still has to create its account. */
export interface PendingProfile {
  email: string;
  name?: string;
  picture?: string;
  /** proof from the server that this email was verified; /auth/register requires it */
  registrationToken?: string;
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
  setPendingProfile: (profile: PendingProfile | null) => void;
  pendingProfile: PendingProfile | null;
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

/** Refresh the session when the access token has less than this left. */
const REFRESH_WINDOW_SECONDS = 24 * 60 * 60;

/** `exp` (seconds) of a JWT, or null. Only used to decide WHEN to refresh, never to trust a token. */
function jwtExpSeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/** The Bearer token a request was sent with. */
function bearerFrom(init?: RequestInit): string | null {
  const h = init?.headers;
  if (!h) return null;
  let v: string | null | undefined;
  if (typeof Headers !== "undefined" && h instanceof Headers) {
    v = h.get("Authorization");
  } else if (Array.isArray(h)) {
    v = h.find(([k]) => k.toLowerCase() === "authorization")?.[1];
  } else {
    const rec = h as Record<string, string>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === "authorization");
    v = key ? rec[key] : null;
  }
  return v ? v.replace(/^Bearer\s+/i, "") : null;
}

function withBearer(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProfile, setPendingProfile] = useState<PendingProfile | null>(null);

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

  // --- keeping the session alive -------------------------------------------------------------
  const nativeFetchRef = useRef<typeof fetch | null>(null);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  /** The refresh token is dead too: sign out cleanly and say why. */
  const expireSession = useCallback(() => {
    logout();
    showToast("Your session expired. Please sign in again.", "warning");
  }, [logout]);

  /**
   * Swap the refresh token for fresh tokens. One request at a time: callers that arrive while a
   * refresh is running share its result. Returns true when new tokens are stored. A network error
   * or a server error keeps the session (it may work again shortly); only a rejected refresh
   * token signs the user out.
   */
  const refreshSession = useCallback((): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const run = (async () => {
      const f = nativeFetchRef.current ?? fetch;
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) {
        // nothing to refresh with: only an already-expired access token is a dead session
        const t = localStorage.getItem(TOKEN_KEY);
        const exp = t ? jwtExpSeconds(t) : null;
        if (exp && exp * 1000 <= Date.now()) expireSession();
        return false;
      }
      try {
        const res = await f(`${serverUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.token && data?.user) {
          persistSession(data.token, data.user, data.refreshToken);
          authDebug("session refreshed", { userId: data.user?.id });
          return true;
        }
        if (res.status >= 500) return false; // server trouble: keep the session, try later
        expireSession(); // 400/401/404: the refresh token is invalid or expired
        return false;
      } catch {
        return false; // offline: keep the session
      }
    })();
    refreshInFlight.current = run.finally(() => {
      refreshInFlight.current = null;
    });
    return refreshInFlight.current;
  }, [persistSession, expireSession]);

  // Any API call that comes back 401 gets ONE refresh and ONE retry before the user ever sees an
  // error. This covers every screen that calls fetch with the token, without editing each one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __chamapayNativeFetch?: typeof fetch };
    const original = w.__chamapayNativeFetch ?? window.fetch.bind(window);
    w.__chamapayNativeFetch = original;
    nativeFetchRef.current = original;

    const patched: typeof fetch = async (input, init) => {
      const res = await original(input, init);
      if (res.status !== 401 || typeof input !== "string") return res;
      // only our own API, and never the auth endpoints themselves
      if (!input.startsWith(serverUrl) || input.startsWith(`${serverUrl}/auth/`)) return res;

      const used = bearerFrom(init);
      if (!used || used === GUEST_TOKEN) return res;

      // another request may already have refreshed: reuse the newer token instead of refreshing again
      const stored = localStorage.getItem(TOKEN_KEY);
      let next = stored && stored !== used ? stored : null;
      if (!next) {
        const ok = await refreshSession();
        if (!ok) return res;
        next = localStorage.getItem(TOKEN_KEY);
      }
      if (!next) return res;
      return original(input, withBearer(init, next));
    };

    window.fetch = patched;
    return () => {
      if (window.fetch === patched) window.fetch = original;
    };
  }, [refreshSession]);

  // Renew before the token runs out: on load, whenever the tab comes back, on regaining network,
  // and every few minutes. A user who returns after days finds a fresh session, not a dead one.
  useEffect(() => {
    if (isLoading) return;
    const check = () => {
      const t = localStorage.getItem(TOKEN_KEY);
      if (!t || t === GUEST_TOKEN) return;
      const exp = jwtExpSeconds(t);
      if (exp && exp - Date.now() / 1000 < REFRESH_WINDOW_SECONDS) {
        void refreshSession();
      }
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    const id = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      window.clearInterval(id);
    };
  }, [isLoading, refreshSession]);

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
        // Send Google's token itself. The server verifies it with Google and works out the email;
        // the client no longer decides who is signing in.
        const response = await fetch(`${serverUrl}/auth/authenticate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            tokenType === "id"
              ? { provider: "google", idToken: rawToken }
              : { provider: "google", accessToken: rawToken }
          ),
        });
        const data = await response.json().catch(() => ({}));
        authDebug("google authenticate", {
          ok: response.ok,
          hasToken: Boolean(data?.token),
          isNewUser: Boolean(data?.isNewUser),
          message: data?.message,
        });

        if (response.ok && data?.isNewUser && data?.email) {
          setPendingProfile({
            email: data.email,
            name: data.name,
            picture: data.picture,
            registrationToken: data.registrationToken,
          });
          return "register";
        }
        if (response.ok && data?.token && data?.user) {
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

        // Existing user: the server already issued tokens
        if (data?.token && data?.user) {
          persistSession(data.token, data.user, data.refreshToken);
          showToast("Signed in", "success");
          return "ok";
        }

        // New user: the server verified the code and gave a registration token
        if (data?.isNewUser && data?.registrationToken) {
          setPendingProfile({
            email: email.toLowerCase().trim(),
            registrationToken: data.registrationToken,
          });
          return "register";
        }

        showToast(data?.message || "Authentication failed", "error");
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
            registrationToken: pendingProfile?.registrationToken,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.token || !result?.user) {
          showToast(result?.message || "Registration failed", "error");
          return false;
        }
        persistSession(result.token, result.user, result.refreshToken);
        setPendingProfile(null);
        showToast("Welcome to Chamapay!", "success");
        return true;
      } catch {
        showToast("Registration failed", "error");
        return false;
      }
    },
    [persistSession, pendingProfile]
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