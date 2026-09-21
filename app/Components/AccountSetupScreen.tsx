"use client";

import { checkUsernameAvailability } from "@/lib/chamaService";
import { useAuth } from "@/app/context/AuthContext";
import { showToast } from "@/app/Components/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getPostAuthRedirect } from "@/lib/pendingInvite";
import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiCheckCircle, FiX } from "react-icons/fi";
import { HiOutlineWallet } from "react-icons/hi2";

/** Chamapay downy-600 */
const BRAND = "#1c8584";
const BRAND_SOFT = "#e6f7f6";

type SetupStep = "creating" | "features" | "profile";

type Props = {
  email: string;
  picture?: string;
};

export default function AccountSetupScreen({
  email,
  picture,
}: Props) {
  const router = useRouter();
  const { register } = useAuth();

  const [step, setStep] = useState<SetupStep>("creating");
  const [showUsernamePopup, setShowUsernamePopup] = useState(false);
  const [profileDone, setProfileDone] = useState(false);
  const [username, setUsername] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "unavailable" | "invalid"
  >("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  const isUsernameValid =
    username.trim().length > 2 && usernameStatus === "available";

  // Slow, staged progress so the journey feels intentional
  useEffect(() => {
    const t1 = setTimeout(() => setStep("features"), 2800);
    const t2 = setTimeout(() => setStep("profile"), 5600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Let “Personalizing…” become active briefly before the modal fades in
  useEffect(() => {
    if (step !== "profile" || profileDone || showUsernamePopup) return;
    const t = setTimeout(() => setShowUsernamePopup(true), 900);
    return () => clearTimeout(t);
  }, [step, profileDone, showUsernamePopup]);

  useEffect(() => {
    if (username.trim().length < 3) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }
    const timer = setTimeout(async () => {
      setUsernameStatus("checking");
      setUsernameMessage("Checking availability…");
      try {
        const res = await checkUsernameAvailability(username.trim());
        if (res.success && res.available) {
          setUsernameStatus("available");
          setUsernameMessage("Username is available");
        } else {
          setUsernameStatus("unavailable");
          setUsernameMessage(res.message || "Username is not available");
        }
      } catch {
        setUsernameStatus("invalid");
        setUsernameMessage("Error checking username");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const saveUsername = async () => {
    if (!isUsernameValid || !email) {
      showToast("Please enter a valid username", "warning");
      return;
    }
    setSavingName(true);
    try {
      const finalPicture =
        picture ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          username.trim()
        )}&background=1c8584&color=fff&size=256`;
      const ok = await register({
        email,
        userName: username.trim(),
        profileImageUrl: finalPicture,
      });
      if (ok) {
        setShowUsernamePopup(false);
        setProfileDone(true);
        setTimeout(() => router.replace(getPostAuthRedirect()), 700);
      }
    } finally {
      setSavingName(false);
    }
  };

  const steps = useMemo(
    () => [
      {
        key: "creating",
        title: "Creating Your Account",
        sub: "Setting up secure payment infrastructure",
        active: step === "creating",
        done: step !== "creating",
      },
      {
        key: "features",
        title: "Enabling Smart Features",
        sub: "Setting up automatic payments and contributions",
        active: step === "features",
        done: step === "profile" || profileDone,
      },
      {
        key: "profile",
        title: "Personalizing Your Profile",
        sub: "Choose your unique username",
        active: step === "profile" && !profileDone,
        done: profileDone,
      },
      {
        key: "done",
        title: "All Set!",
        sub: "Your account is ready for chama contributions",
        active: false,
        done: profileDone,
      },
    ],
    [step, profileDone]
  );

  const inputTone =
    usernameStatus === "available"
      ? {
          wrap: "bg-downy-50 ring-downy-500",
          msg: "text-downy-700",
          icon: "text-downy-600",
        }
      : usernameStatus === "unavailable" || usernameStatus === "invalid"
        ? {
            wrap: "bg-red-50 ring-red-400",
            msg: "text-red-600",
            icon: "text-red-500",
          }
        : usernameStatus === "checking"
          ? {
              wrap: "bg-amber-50 ring-amber-400",
              msg: "text-amber-700",
              icon: "text-amber-500",
            }
          : {
              wrap: "bg-gray-50 ring-gray-200 focus-within:ring-downy-500 focus-within:bg-white",
              msg: "text-gray-500",
              icon: "text-gray-400",
            };

  return (
    <div className="min-h-[100dvh] bg-downy-50 flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-9"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-md shadow-downy-900/10"
            style={{ backgroundColor: BRAND }}
          >
            <HiOutlineWallet size={32} className="text-white" />
          </div>
          <h1 className="text-[1.35rem] font-bold text-gray-900 text-center mb-1.5">
            Setting Up Your Account
          </h1>
          <p className="text-[13px] text-gray-600 text-center max-w-[16rem]">
            We&apos;re preparing everything for your chama journey
          </p>
        </motion.div>

        <div className="mb-8 max-w-sm mx-auto w-full">
          {steps.map((s, i) => {
            const isLast = i === steps.length - 1;
            const connectorFilled =
              i === 0
                ? step !== "creating"
                : i === 1
                  ? step === "profile" || profileDone
                  : profileDone;
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.35 }}
                className="flex items-start"
              >
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500"
                    style={{
                      backgroundColor: s.done || s.active ? BRAND : "#d1d5db",
                    }}
                  >
                    {s.done ? (
                      <FiCheck size={16} className="text-white" strokeWidth={3} />
                    ) : s.active ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  {!isLast ? (
                    <div
                      className="w-0.5 flex-1 min-h-[32px] my-1 rounded-full transition-colors duration-700"
                      style={{
                        backgroundColor: connectorFilled ? BRAND : "#e5e7eb",
                      }}
                    />
                  ) : null}
                </div>
                <div className={`ml-3.5 flex-1 ${isLast ? "pt-1" : "pb-7 pt-1"}`}>
                  <p
                    className={`text-[14px] font-semibold transition-colors ${
                      s.active || s.done ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {s.title}
                  </p>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
                    {s.sub}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showUsernamePopup && !profileDone ? (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-downy-950/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative z-10 bg-white rounded-[1.35rem] p-5 w-full max-w-sm shadow-2xl shadow-downy-950/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: BRAND_SOFT }}
                >
                  <span
                    className="font-bold text-[17px]"
                    style={{ color: BRAND }}
                  >
                    @
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-bold text-gray-900 leading-tight">
                    Choose your username
                  </h2>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    How should others find you?
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1 rounded-2xl px-3.5 ring-1 transition-all duration-200 ${inputTone.wrap}`}
              >
                <span
                  className="font-semibold text-[14px] select-none"
                  style={{ color: BRAND }}
                >
                  @
                </span>
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                    )
                  }
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                  name="chamapay-username"
                  disabled={savingName}
                  className="flex-1 min-w-0 bg-transparent py-3.5 text-[14px] text-gray-900 outline-none placeholder:text-gray-400 border-0 shadow-none ring-0 focus:ring-0"
                  style={{ WebkitAppearance: "none", appearance: "none" }}
                />
                {usernameStatus === "checking" ? (
                  <div className="h-4 w-4 rounded-full border-2 border-downy-500 border-t-transparent animate-spin shrink-0" />
                ) : null}
                {usernameStatus === "available" ? (
                  <FiCheckCircle
                    size={18}
                    className={`shrink-0 ${inputTone.icon}`}
                  />
                ) : null}
                {usernameStatus === "unavailable" ||
                usernameStatus === "invalid" ? (
                  <FiX size={18} className={`shrink-0 ${inputTone.icon}`} />
                ) : null}
              </div>

              <p
                className={`text-[11px] font-medium mt-2 mb-4 min-h-[1rem] ${inputTone.msg}`}
              >
                {usernameMessage ||
                  (username.length > 0 && username.length < 3
                    ? "At least 3 characters"
                    : "\u00a0")}
              </p>

              <button
                type="button"
                disabled={savingName || !isUsernameValid}
                onClick={() => void saveUsername()}
                className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                style={{
                  backgroundColor:
                    savingName || !isUsernameValid ? undefined : BRAND,
                }}
              >
                {savingName ? "Creating account…" : "Create account"}
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
