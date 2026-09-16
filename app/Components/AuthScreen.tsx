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
          width: 320,
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
      <div className="min-h-screen bg-downy-100 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-downy-700 to-downy-900 px-5 py-10 flex flex-col">
      <div className="text-center mb-8">
        <Image
          src="/images/logo.png"
          alt="ChamaPay"
          width={64}
          height={64}
          className="mx-auto rounded-2xl mb-4"
        />
        <h1 className="text-3xl font-bold text-white">ChamaPay</h1>
        <p className="mt-2 text-downy-100 text-sm">
          Circular savings — sign in with Google or email
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 shadow-xl mt-auto mb-6"
      >
        {step === "home" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Welcome
            </h2>
            <p className="text-sm text-gray-500 text-center mb-2">
              No wallet connect — just Google or email to continue.
            </p>

            {clientId ? (
              <div className="flex justify-center py-2" ref={googleBtnRef} />
            ) : (
              <button
                type="button"
                onClick={() =>
                  showToast(
                    "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in web/.env",
                    "warning"
                  )
                }
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-full py-3 font-semibold text-gray-800"
              >
                <FcGoogle size={22} />
                Continue with Google
              </button>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full flex items-center justify-center gap-2 bg-downy-600 text-white rounded-full py-3.5 font-semibold"
            >
              <FiMail size={18} />
              Continue with email
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                continueAsGuest();
                router.replace("/MyChamas");
              }}
              className="w-full text-center text-sm font-semibold text-gray-500 py-2 hover:text-downy-700"
            >
              Proceed as guest (temporary)
            </button>
          </div>
        )}

        {step === "email" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("home")}
              className="text-sm text-downy-700 font-medium"
            >
              ← Back
            </button>
            <h2 className="text-xl font-bold text-gray-900">Email</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-downy-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={onSendCode}
              className="w-full flex items-center justify-center gap-2 bg-downy-600 text-white rounded-full py-3.5 font-semibold disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send code"}
              <FiArrowRight />
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-sm text-downy-700 font-medium"
            >
              ← Back
            </button>
            <h2 className="text-xl font-bold text-gray-900">Enter code</h2>
            <p className="text-sm text-gray-500">
              We sent a code to <span className="font-semibold">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 tracking-[0.3em] text-center text-lg outline-none focus:ring-2 focus:ring-downy-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={onVerifyCode}
              className="w-full bg-downy-600 text-white rounded-full py-3.5 font-semibold disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
          </div>
        )}

        {step === "username" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Pick a username</h2>
            <p className="text-sm text-gray-500">
              Almost done — choose how you appear in chamas.
            </p>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. mint"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-downy-500"
              autoFocus
            />
            <button
              type="button"
              disabled={busy}
              onClick={onRegister}
              className="w-full bg-downy-600 text-white rounded-full py-3.5 font-semibold disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingProfile(null);
                setStep("home");
              }}
              className="w-full text-sm text-gray-500"
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
