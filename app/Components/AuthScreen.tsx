"use client";

import AccountSetupScreen from "@/app/Components/AccountSetupScreen";
import { showToast } from "@/app/Components/Toast";
import { useAuth } from "@/app/context/AuthContext";
import { authDebug } from "@/lib/authDebug";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiMail, FiX } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { HiChevronLeft } from "react-icons/hi";
import { toast } from "sonner";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const AUTH_PRIMARY = "#1c8584";

export default function AuthScreen() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading,
    loginWithGoogle,
    sendEmailCode,
    verifyEmailCode,
    pendingProfile,
    setPendingProfile,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [code, setCode] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageOrigin, setPageOrigin] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const verifyingRef = useRef(false);
  const googleToastId = useRef<string | number | null>(null);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "";

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  // Lock parent shell scroll on the auth form (not account setup)
  useEffect(() => {
    if (showSetup) return;
    const shell = document.querySelector(".app-shell-scroll") as HTMLElement | null;
    const prev = shell?.style.overflowY;
    if (shell) shell.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (shell) shell.style.overflowY = prev || "";
      document.body.style.overflow = "";
    };
  }, [showSetup]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      authDebug("AuthScreen already authenticated → /MyChamas");
      if (googleToastId.current != null) {
        toast.dismiss(googleToastId.current);
        googleToastId.current = null;
      }
      router.replace("/MyChamas");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (pendingProfile?.email) {
      setEmail(pendingProfile.email);
      setShowSetup(true);
      setShowVerifyModal(false);
      if (googleToastId.current != null) {
        toast.dismiss(googleToastId.current);
        googleToastId.current = null;
      }
    }
  }, [pendingProfile]);

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      authDebug("google credential received", {
        hasCredential: Boolean(response?.credential),
      });
      if (googleToastId.current != null) toast.dismiss(googleToastId.current);
      googleToastId.current = toast.loading("Signing in…", {
        position: "bottom-center",
      });
      setBusy(true);
      try {
        const result = await loginWithGoogle(response.credential, "id");
        authDebug("google login result", { result });
        if (result === "ok") {
          toast.dismiss(googleToastId.current);
          googleToastId.current = null;
          router.replace("/MyChamas");
          return;
        }
        if (result === "register") {
          toast.dismiss(googleToastId.current);
          googleToastId.current = null;
          setShowSetup(true);
          return;
        }
        toast.dismiss(googleToastId.current);
        googleToastId.current = null;
      } catch (e) {
        authDebug("google credential handler error", e);
        toast.dismiss(googleToastId.current);
        googleToastId.current = null;
        showToast("Google sign-in failed", "error");
      } finally {
        setBusy(false);
      }
    },
    [loginWithGoogle, router]
  );

  useEffect(() => {
    if (!clientId || showSetup || showVerifyModal) return;

    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: Math.min(320, window.innerWidth - 64),
          text: "continue_with",
          shape: "pill",
        });
      }
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [clientId, handleGoogleCredential, showSetup, showVerifyModal]);

  const onSendCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      showToast("Enter a valid email", "warning");
      return;
    }
    setSendingEmail(true);
    setVerifyError("");
    setCode("");
    setVerifySuccess(false);
    const ok = await sendEmailCode(email.trim());
    setSendingEmail(false);
    if (ok) {
      setShowVerifyModal(true);
      setTimeout(() => codeInputRef.current?.focus(), 250);
    }
  };

  const onVerifyCode = async (raw?: string) => {
    const value = (raw ?? code).replace(/\D/g, "").slice(0, 6);
    if (value.length < 6 || verifyingRef.current || verifySuccess) return;
    verifyingRef.current = true;
    setVerifying(true);
    setVerifyError("");
    setCode(value);
    const result = await verifyEmailCode(email.trim(), value);
    if (result === "ok") {
      setVerifySuccess(true);
      setTimeout(() => {
        setShowVerifyModal(false);
        router.replace("/MyChamas");
      }, 700);
    } else if (result === "register") {
      setVerifySuccess(true);
      setTimeout(() => {
        setShowVerifyModal(false);
        setShowSetup(true);
      }, 500);
    } else {
      setVerifyError("Invalid or expired code. Try again.");
      setCode("");
      setTimeout(() => codeInputRef.current?.focus(), 50);
    }
    setVerifying(false);
    verifyingRef.current = false;
  };

  const closeVerifyModal = () => {
    if (verifying || verifySuccess) return;
    setShowVerifyModal(false);
    setCode("");
    setVerifyError("");
  };

  if (showSetup && (pendingProfile?.email || email)) {
    return (
      <AccountSetupScreen
        email={pendingProfile?.email || email}
        picture={pendingProfile?.picture}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-downy-50">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-downy-800">Loading…</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-downy-800 via-downy-700 to-downy-950 overscroll-none">
      <div className="shrink-0 pt-8 pb-4 px-4 text-center">
        <div className="mx-auto mb-3 h-20 w-20 rounded-[1.15rem] bg-white shadow-lg shadow-black/15 overflow-hidden">
          <Image
            src="/images/chamapay-logo-white.png"
            alt="Chamapay"
            width={80}
            height={80}
            className="object-cover w-full h-full"
            priority
          />
        </div>
        <h1 className="text-display text-[1.65rem] font-extrabold text-white tracking-tight">
          Chamapay
        </h1>
        <p className="mt-1.5 text-[13px] text-downy-100/90 max-w-[16rem] mx-auto leading-snug">
          Save as a circle. Grow as one.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center px-4 pb-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[1.5rem] p-5 shadow-2xl shadow-black/20 w-full max-w-md mx-auto"
        >
          <h2 className="text-[1.15rem] font-bold text-gray-900 text-center leading-snug mb-1">
            Sign in to continue
          </h2>
          <p className="text-[12px] text-gray-500 text-center leading-relaxed mb-5 px-1">
            Use email for a one-time code. No password needed.
          </p>

          <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSendCode();
            }}
            placeholder="Enter your email"
            autoCapitalize="none"
            autoCorrect="off"
            disabled={sendingEmail || busy}
            className="w-full h-[48px] rounded-2xl px-4 text-[14px] font-medium text-gray-900 outline-none mb-3 bg-white"
            style={{
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: emailFocused ? AUTH_PRIMARY : "#e5e7eb",
            }}
          />

          <button
            type="button"
            disabled={!email.trim() || sendingEmail || busy}
            onClick={() => void onSendCode()}
            className="w-full h-[48px] rounded-2xl text-[14px] font-bold text-white mb-4 disabled:bg-gray-400"
            style={{
              backgroundColor:
                !email.trim() || sendingEmail || busy
                  ? undefined
                  : AUTH_PRIMARY,
            }}
          >
            {sendingEmail ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Sending…
              </span>
            ) : (
              "Continue with email"
            )}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[12px] text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {clientId ? (
            <div
              className={`space-y-2 mb-3 ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <div className="flex justify-center min-h-[44px]" ref={googleBtnRef} />
              {process.env.NODE_ENV === "development" && pageOrigin ? (
                <p className="text-[10px] text-center text-gray-400 leading-snug px-2">
                  If Google shows &quot;no registered origin&quot;, add{" "}
                  <span className="font-mono text-gray-500">{pageOrigin}</span>{" "}
                  as an Authorized JavaScript origin.
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                showToast(
                  "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in web/.env",
                  "warning"
                )
              }
              className="w-full h-[48px] flex items-center justify-center gap-2 border border-gray-200 rounded-2xl text-[14px] font-semibold text-gray-800 bg-white mb-3"
            >
              <FcGoogle size={20} />
              Continue with Google
            </button>
          )}

          <p className="text-[11px] text-gray-500 text-center leading-relaxed mt-4 px-1">
            By continuing, you agree to our{" "}
            <Link
              href="/info?type=terms&from=auth"
              className="font-semibold"
              style={{ color: AUTH_PRIMARY }}
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/info?type=privacy&from=auth"
              className="font-semibold"
              style={{ color: AUTH_PRIMARY }}
            >
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </div>

      {showVerifyModal ? (
        <div className="app-modal-layer">
          <button
            type="button"
            className="app-modal-backdrop"
            aria-label="Close"
            onClick={closeVerifyModal}
            disabled={verifying || verifySuccess}
          />
          <div className="app-modal-sheet bg-white px-5 pt-3 pb-7 max-h-[90%]">
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={closeVerifyModal}
                disabled={verifying || verifySuccess}
                className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-40"
                aria-label="Back"
              >
                <HiChevronLeft size={22} className="text-gray-600" />
              </button>
              <button
                type="button"
                onClick={closeVerifyModal}
                disabled={verifying || verifySuccess}
                className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-40"
                aria-label="Close"
              >
                <FiX size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                style={{
                  backgroundColor: verifySuccess ? "#dcfce7" : AUTH_PRIMARY,
                }}
              >
                {verifySuccess ? (
                  <FiCheck size={28} className="text-green-600" />
                ) : (
                  <FiMail size={26} className="text-white" />
                )}
              </div>
              <h3 className="text-[1.15rem] font-bold text-gray-900 mb-1.5 text-center">
                {verifySuccess ? "Verified!" : "Verify your account"}
              </h3>
              {!verifySuccess ? (
                <p className="text-[13px] text-gray-500 text-center leading-relaxed px-1">
                  Please enter the 6-digit verification code we sent to{" "}
                  <span className="font-bold text-gray-800">{email}</span> to
                  proceed securely.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              className="relative w-full flex justify-center gap-2 mb-2 bg-transparent p-0"
              onClick={() => {
                if (!verifying && !verifySuccess) codeInputRef.current?.focus();
              }}
            >
              <input
                ref={codeInputRef}
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(val);
                  setVerifyError("");
                  if (val.length === 6) void onVerifyCode(val);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={verifying || verifySuccess}
                className="absolute inset-0 opacity-[0.01] caret-transparent"
                aria-label="Verification code"
              />
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const filled = index < code.length;
                const isActive =
                  code.length === index && !verifying && !verifySuccess;
                return (
                  <div
                    key={index}
                    className="w-11 h-14 rounded-xl flex items-center justify-center bg-white"
                    style={{
                      borderWidth: isActive ? 2 : 1,
                      borderStyle: "solid",
                      borderColor: verifySuccess
                        ? "#16a34a"
                        : verifyError
                          ? "#ef4444"
                          : isActive || filled
                            ? AUTH_PRIMARY
                            : "#d1d5db",
                      backgroundColor: verifySuccess ? "#f0fdf4" : "white",
                      opacity: verifying ? 0.55 : 1,
                    }}
                  >
                    {verifySuccess && index === 5 ? (
                      <FiCheck size={18} className="text-green-600" />
                    ) : (
                      <span className="text-[1.35rem] font-bold text-gray-900">
                        {code[index] || ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </button>

            {verifying ? (
              <div className="flex items-center justify-center gap-2 mt-2 mb-2">
                <div
                  className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{
                    borderColor: AUTH_PRIMARY,
                    borderTopColor: "transparent",
                  }}
                />
                <p className="text-[11px] font-medium text-gray-500">
                  Verifying...
                </p>
              </div>
            ) : null}

            {verifyError && !verifySuccess ? (
              <p className="text-red-500 text-center text-[13px] font-medium mt-2 mb-1">
                {verifyError}
              </p>
            ) : null}

            {!verifySuccess ? (
              <button
                type="button"
                disabled={sendingEmail || verifying}
                onClick={() => void onSendCode()}
                className="w-full text-center pt-3 text-[13px] font-semibold bg-transparent disabled:text-gray-400"
                style={{
                  color: sendingEmail || verifying ? undefined : AUTH_PRIMARY,
                }}
              >
                {sendingEmail ? "Sending..." : "Didn't get a code? Resend now"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
