"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiInfo,
  FiLogOut,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { useAuth } from "@/app/context/AuthContext";
import { showToast } from "@/app/Components/Toast";
import { serverUrl } from "@/lib/serverUrl";
import {
  useCurrencyStore,
  type Currency,
} from "@/store/useCurrencyStore";

function formatWalletAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const CURRENCY_OPTIONS: {
  id: Currency;
  label: string;
  icon: string;
}[] = [
  {
    id: "KES",
    label: "Kenyan Shilling (KES)",
    icon: "/brand/kenya-flag.png",
  },
  {
    id: "USDC",
    label: "USD Coin (USDC)",
    icon: "/brand/usdclogo.png",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    isGuest,
    isLoading: authLoading,
    logout,
    refreshUser,
    updateLocalUser,
  } = useAuth();
  const { currency, setCurrency } = useCurrencyStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isGuest) void refreshUser();
  }, [isGuest, refreshUser]);

  useEffect(() => {
    if (!showCurrencyDropdown) return;
    const onDoc = (e: MouseEvent) => {
      if (!currencyMenuRef.current?.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showCurrencyDropdown]);

  const displayName = user?.userName?.trim() || "User";
  const wallet =
    (user?.smartAddress as string) || (user?.address as string) || "";
  const avatar = (user?.profileImageUrl as string) || "";

  const requireAccount = useCallback(() => {
    showToast("Sign in with Google or email to edit your profile", "warning");
    logout();
    router.replace("/");
  }, [logout, router]);

  const copyWalletAddress = useCallback(async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopiedAddress(true);
      showToast("Address copied", "success");
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      showToast("Could not copy address", "error");
    }
  }, [wallet]);

  const uploadImage = async (file: File) => {
    if (!token || token === "guest" || isGuest) {
      requireAccount();
      return;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`${serverUrl}/user/profile/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }
      const url = data.profileImageUrl as string;
      updateLocalUser({ profileImageUrl: url });
      await refreshUser();
      showToast("Profile photo updated", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setImageUploading(false);
    }
  };

  const handleCurrencySelect = (next: Currency) => {
    setCurrency(next);
    setShowCurrencyDropdown(false);
    showToast(
      next === "KES"
        ? "Display currency set to KES"
        : "Display currency set to USDC",
      "success"
    );
  };

  const handleEditProfile = () => {
    if (isGuest) {
      requireAccount();
      return;
    }
    router.push("/Settings/edit");
  };

  const handlePhotoClick = () => {
    if (isGuest) {
      requireAccount();
      return;
    }
    fileRef.current?.click();
  };

  const handleSignOut = () => {
    logout();
    router.replace("/");
  };

  const selectedCurrency =
    CURRENCY_OPTIONS.find((o) => o.id === currency) || CURRENCY_OPTIONS[1];

  if (authLoading || !isAuthenticated) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-downy-800">Loading…</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Fixed header — does not scroll */}
      <div
        className="shrink-0 px-4 pt-2 pb-3.5 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center justify-between mb-3 min-h-[32px]">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <FiArrowLeft size={16} />
          </button>
          <h1 className="text-display text-[14px] font-bold">
            Profile & Settings
          </h1>
          <div className="w-8" />
        </div>

        <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={imageUploading}
                onClick={handlePhotoClick}
                aria-label="Change profile photo"
                className="h-12 w-12 rounded-full overflow-hidden border-2 border-white/40 bg-white/20 flex items-center justify-center text-[11px] font-bold"
              >
                {avatar ? (
                  <Image
                    src={avatar}
                    alt=""
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials(displayName)
                )}
                {imageUploading && (
                  <span className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={imageUploading}
                onClick={handlePhotoClick}
                className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-downy-500 border-2 border-white text-white flex items-center justify-center shadow"
                aria-label="Upload photo"
              >
                <FiCamera size={11} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold truncate leading-tight">
                {displayName}
              </p>
              <p className="text-emerald-100 text-[11px] truncate mt-0.5">
                {isGuest ? "Guest session" : user?.email || "No email provided"}
              </p>
              <button
                type="button"
                onClick={handlePhotoClick}
                disabled={imageUploading}
                className="mt-1 text-[10px] font-semibold text-downy-200 underline underline-offset-2"
              >
                {imageUploading ? "Uploading…" : "Change profile photo"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-8 space-y-3 [-webkit-overflow-scrolling:touch]">
        <button
          type="button"
          onClick={handleEditProfile}
          className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-3"
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <FiEdit2 size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 leading-tight">
                  Edit Profile
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {isGuest
                    ? "Sign in to update your details"
                    : "Update phone number and profile photo"}
                </p>
              </div>
            </div>
            <FiChevronRight size={16} className="text-emerald-500 shrink-0" />
          </div>
        </button>

        <div
          ref={currencyMenuRef}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-3"
        >
          <div className="mb-2">
            <p className="text-[13px] font-bold text-gray-900 leading-tight">
              Currency Preference
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Choose your preferred display currency
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCurrencyDropdown((o) => !o)}
            className="w-full flex items-center justify-between gap-2.5 rounded-lg bg-gray-50 p-2.5 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white border border-gray-100">
                <Image
                  src={selectedCurrency.icon}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-900 truncate">
                  {selectedCurrency.label}
                </p>
                <p className="text-[10px] text-gray-500">
                  Current selection: {currency}
                </p>
              </div>
            </div>
            <FiChevronDown
              size={16}
              className={`text-gray-400 shrink-0 transition-transform ${
                showCurrencyDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {showCurrencyDropdown && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white overflow-hidden">
              {CURRENCY_OPTIONS.map((opt) => {
                const active = currency === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCurrencySelect(opt.id)}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2.5 text-left border-b border-gray-50 last:border-0 ${
                      active ? "bg-downy-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white border border-gray-100">
                        <Image
                          src={opt.icon}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </span>
                      <span
                        className={`text-[12px] font-semibold truncate ${
                          active ? "text-downy-700" : "text-gray-700"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </div>
                    {active && (
                      <FiCheck size={15} className="text-downy-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {wallet ? (
          <button
            type="button"
            onClick={copyWalletAddress}
            className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-3"
          >
            <div className="flex items-start justify-between gap-2.5 mb-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 leading-tight">
                  Wallet Information
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Your onchain wallet address
                </p>
              </div>
              <span className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                {copiedAddress ? <FiCheck size={14} /> : <FiCopy size={14} />}
              </span>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70 mb-0.5">
                Address
              </p>
              <p className="font-mono text-[12px] font-semibold text-gray-900">
                {formatWalletAddress(wallet)}
              </p>
              <p className="mt-1 text-[10px] font-medium text-emerald-700">
                {copiedAddress
                  ? "Copied to clipboard"
                  : "Tap card to copy full address"}
              </p>
            </div>
          </button>
        ) : null}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="mb-2">
            <p className="text-[13px] font-bold text-gray-900 leading-tight">
              Legal & Support
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Policies and help resources
            </p>
          </div>
          <div className="space-y-1.5">
            <Link
              href="/info?type=privacy"
              className="flex items-center justify-between gap-2.5 rounded-lg bg-gray-50 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FiFileText size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900">
                    Privacy Policy
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Read our privacy policy
                  </p>
                </div>
              </div>
              <FiChevronRight size={16} className="text-gray-400 shrink-0" />
            </Link>

            <Link
              href="/info?type=terms"
              className="flex items-center justify-between gap-2.5 rounded-lg bg-gray-50 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-md bg-green-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <FiFileText size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900">
                    Terms of Service
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Review our terms and conditions
                  </p>
                </div>
              </div>
              <FiChevronRight size={16} className="text-gray-400 shrink-0" />
            </Link>

            <a
              href="https://wa.me/2547571149628"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2.5 rounded-lg bg-gray-50 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-md bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                  <FaWhatsapp size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900">
                    Help & Support
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Message us on WhatsApp
                  </p>
                </div>
              </div>
              <FiExternalLink size={14} className="text-gray-400 shrink-0" />
            </a>

            <a
              href="https://x.com/Chama_pay"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2.5 rounded-lg bg-gray-50 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-md bg-black text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                  𝕏
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900">
                    Follow us on X
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Stay updated with the latest news
                  </p>
                </div>
              </div>
              <FiExternalLink size={14} className="text-gray-400 shrink-0" />
            </a>

            <Link
              href="/info?type=about"
              className="flex items-center justify-between gap-2.5 rounded-lg bg-gray-50 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <FiInfo size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900">
                    About Chamapay
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Learn more about what we do
                  </p>
                </div>
              </div>
              <FiChevronRight size={16} className="text-gray-400 shrink-0" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-red-500/90 p-1.5 shadow-sm">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-700 py-3 text-white font-bold text-[13px]"
          >
            <FiLogOut size={16} />
            {isGuest ? "Exit Guest" : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
