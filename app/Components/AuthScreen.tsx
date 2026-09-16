"use client";

import { useAuth } from "@/app/context/AuthContext";
import { showToast } from "@/app/Components/Toast";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiMail } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (cb?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type Step = "home" | "email" | "code" | "username";

export default function AuthScreen() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading,
    loginWithGoogle,
    sendEmailCode,
    verifyEmailCode,
    register,
    continueAsGuest,
    pendingProfile,
    setPendingProfile,
  } = useAuth();

  const [step, setStep] = useState<Step>("home");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [userName, setUserName] = useState("");
  const [busy, setBusy] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/MyChamas");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (pendingProfile?.email) {
      setEmail(pendingProfile.email);
      setUserName(pendingProfile.name?.split(" ")[0] || "");
      setStep("username");
    }
  }, [pendingProfile]);

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setBusy(true);
      const result = await loginWithGoogle(response.credential, "id");
      setBusy(false);
      if (result === "ok") router.replace("/MyChamas");
      if (result === "register") setStep("username");
    },
    [loginWithGoogle, router]
  );

  useEffect(() => {
    if (!clientId || step !== "home") return;

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
          width: 300,
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
  }, [clientId, handleGoogleCredential, step]);

  const onSendCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      showToast("Enter a valid email", "warning");
      return;
    }
    setBusy(true);
    const ok = await sendEmailCode(email.trim());
    setBusy(false);
    if (ok) setStep("code");
  };

  const onVerifyCode = async () => {
    if (code.trim().length < 4) {
      showToast("Enter the verification code", "warning");
      return;
    }
    setBusy(true);
    const result = await verifyEmailCode(email.trim(), code.trim());
    setBusy(false);
    if (result === "ok") router.replace("/MyChamas");
    if (result === "register") setStep("username");
  };

  const onRegister = async () => {
    if (!userName.trim() || userName.trim().length < 3) {
      showToast("Username must be at least 3 characters", "warning");
      return;
    }
    setBusy(true);
    const ok = await register({
      email: pendingProfile?.email || email,
      userName: userName.trim(),
      profileImageUrl: pendingProfile?.picture,
    });
    setBusy(false);
    if (ok) router.replace("/MyChamas");
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-downy-50 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-downy-800 via-downy-700 to-downy-950 px-4 pt-8 pb-6">
      <div className="text-center shrink-0 mb-6">
        <Image
          src="/images/logo.png"
          alt="ChamaPay"
          width={52}
          height={52}
          className="mx-auto rounded-2xl mb-3 shadow-lg shadow-black/20"
          priority
        />
        <h1 className="text-display text-[1.65rem] font-extrabold text-white tracking-tight">
          ChamaPay
        </h1>
        <p className="mt-1.5 text-[12px] text-downy-100/85 max-w-[16rem] mx-auto leading-snug">
          Circular savings with email or Google — no wallet connect needed
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[1.5rem] p-5 shadow-2xl shadow-black/20 mt-auto"
      >
        {step === "home" && (
          <div className="space-y-3">
            <h2 className="text-[1.05rem] font-bold text-gray-900 text-center">
              Welcome back
            </h2>
            <p className="text-[12px] text-gray-500 text-center -mt-1 mb-1">
              Sign in to manage chamas, goals, and your wallet.
            </p>

            {clientId ? (
              <div className="flex justify-center py-1" ref={googleBtnRef} />
            ) : (
              <button
                type="button"
                onClick={() =>
                  showToast(
                    "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in web/.env",
                    "warning"
                  )
                }
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-2xl py-2.5 text-[13px] font-semibold text-gray-800 bg-white"
              >
                <FcGoogle size={20} />
                Continue with Google
              </button>
            )}

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-white px-2 text-gray-400">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full flex items-center justify-center gap-2 bg-downy-600 text-white rounded-2xl py-3 text-[13px] font-bold"
            >
              <FiMail size={16} />
              Continue with email
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                continueAsGuest();
                router.replace("/MyChamas");
              }}
              className="w-full text-center text-[12px] font-semibold text-gray-400 py-1.5 hover:text-downy-700 bg-transparent"
            >
              Browse as guest
            </button>
          </div>
        )}

        {step === "email" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setStep("home")}
              className="text-[12px] text-downy-700 font-semibold bg-transparent"
            >
              ← Back
            </button>
            <h2 className="text-[1.05rem] font-bold text-gray-900">Email</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={onSendCode}
              className="w-full flex items-center justify-center gap-2 bg-downy-600 text-white rounded-2xl py-3 text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send code"}
              <FiArrowRight size={16} />
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-[12px] text-downy-700 font-semibold bg-transparent"
            >
              ← Back
            </button>
            <h2 className="text-[1.05rem] font-bold text-gray-900">Enter code</h2>
            <p className="text-[12px] text-gray-500">
              Sent to <span className="font-semibold text-gray-700">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 tracking-[0.35em] text-center text-base outline-none focus:ring-2 focus:ring-downy-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={onVerifyCode}
              className="w-full bg-downy-600 text-white rounded-2xl py-3 text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
          </div>
        )}

        {step === "username" && (
          <div className="space-y-3">
            <h2 className="text-[1.05rem] font-bold text-gray-900">
              Pick a username
            </h2>
            <p className="text-[12px] text-gray-500">
              This is how you appear in chamas and goals.
            </p>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. mint"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
              autoFocus
            />
            <button
              type="button"
              disabled={busy}
              onClick={onRegister}
              className="w-full bg-downy-600 text-white rounded-2xl py-3 text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingProfile(null);
                setStep("home");
              }}
              className="w-full text-[12px] text-gray-400 bg-transparent"
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
