"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiShield,
  FiCamera,
  FiSmartphone,
  FiLock,
  FiExternalLink,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { showToast } from "@/app/Components/Toast";
import {
  createKycSession,
  getKycJob,
  getKycStatus,
  reportKycClientResult,
  type KycStatusResponse,
} from "@/lib/kycService";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  type CountryInfo,
} from "@/lib/countries";

type Step = "setup" | "checking" | "done";

export default function VerifyDetailsPage() {
  const router = useRouter();
  const { token, isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const { user, isKycApproved, isKycPending, refreshUser } = useUser();

  const [step, setStep] = useState<Step>("setup");
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Didit State
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [launchingDidit, setLaunchingDidit] = useState(false);
  const [diditStarted, setDiditStarted] = useState(false);
  const [diditError, setDiditError] = useState<string | null>(null);

  // Status & Polling
  const [kycData, setKycData] = useState<KycStatusResponse | null>(null);
  const [checkingMessage, setCheckingMessage] = useState("Checking verification status...");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // -------------------------
  // Auth checks & Existing KYC
  // -------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || isGuest) {
      router.replace("/Settings");
    }
  }, [authLoading, isAuthenticated, isGuest, router]);

  useEffect(() => {
    if (!token) return;
    getKycStatus(token).then((res) => {
      if (res && res.success) {
        setKycData(res);
        if (res.kycTier >= 2 && res.kycStatus === "approved") {
          setStep("done");
        } else if (res.phoneE164) {
          setPhoneNumber(res.phoneE164);
        }
      }
    });
  }, [token]);

  // Filtered countries for dropdown
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso2.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // -------------------------
  // Launch Didit Verification directly (No OTP block)
  // -------------------------
  const handleStartDidit = async () => {
    if (!token) {
      showToast("Please sign in first", "warning");
      return;
    }

    setLaunchingDidit(true);
    setDiditError(null);

    try {
      const session = await createKycSession(token, {
        countryCode: selectedCountry.iso3,
        platform: "web",
      });

      if (session.alreadyVerified) {
        setStep("done");
        return;
      }

      if (!session.success || !session.jobId || !session.url) {
        throw new Error(session.error || session.details || "Could not start Didit verification");
      }

      const jobId = session.jobId;
      setActiveJobId(jobId);
      setSessionUrl(session.url);
      setDiditStarted(true);

      // Dynamically import and initialize DiditSdk
      const { DiditSdk } = await import("@didit-protocol/sdk-web");

      DiditSdk.shared.onComplete = async (result: any) => {
        console.log("[Didit Web SDK] onComplete:", result);
        if (result?.type === "completed") {
          await reportKycClientResult(token, jobId, JSON.stringify(result), result?.status || "Completed");
          setStep("checking");
          startPollingDecision(jobId);
        } else if (result?.type === "cancelled") {
          setDiditStarted(false);
          showToast("Verification was cancelled. You can retry anytime.", "warning");
        } else if (result?.type === "failed") {
          setDiditError(result?.error?.message || "Verification failed. Please try again.");
          setDiditStarted(false);
        }
      };

      DiditSdk.shared.startVerification({
        url: session.url,
      });
    } catch (err: any) {
      console.error("Start Didit error:", err);
      setDiditError(err.message || "Failed to launch verification");
      showToast(err.message || "Failed to start verification", "error");
    } finally {
      setLaunchingDidit(false);
    }
  };

  // -------------------------
  // Polling for Webhook / Approval Decision
  // -------------------------
  const startPollingDecision = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    let attempts = 0;

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setCheckingMessage("Verification is being processed. You will be notified when complete.");
        return;
      }

      if (!token) return;
      const job = await getKycJob(token, jobId);
      if (job?.status === "approved" || job?.kycTier >= 2) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        await refreshUser();
        const updatedStatus = await getKycStatus(token);
        if (updatedStatus) setKycData(updatedStatus);
        setStep("done");
      } else if (job?.status === "rejected" || job?.status === "failed") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setStep("setup");
        setDiditError("Verification was not approved. Please ensure clear photos of your document and face.");
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const leaveVerify = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace("/Settings");
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Header */}
      <div
        className="shrink-0 px-4 pt-2 pb-5 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center justify-between min-h-[32px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition"
          >
            <FiArrowLeft size={16} />
          </button>

          <h1 className="text-display text-[15px] font-bold">
            Verify Identity (Tier 2)
          </h1>

          <div className="w-8" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 safe-bottom">
        <div className="mx-auto max-w-sm space-y-4">
          {/* STEP: Setup & Start Verification */}
          {step === "setup" && (
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 space-y-5">
              <div className="text-center space-y-1">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-downy-50 text-downy-600 flex items-center justify-center text-xl mb-2">
                  <FiShield />
                </div>
                <h2 className="text-[16px] font-bold text-gray-900">Identity Verification</h2>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Verify your government-issued ID to upgrade your Chama account to Tier 2 (100,000 KES/month limit).
                </p>
              </div>

              {/* Country Selection */}
              <div className="relative">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Document Country
                </label>
                <button
                  type="button"
                  onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 active:bg-gray-100 transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{selectedCountry.flag}</span>
                    <span className="font-medium">{selectedCountry.name}</span>
                  </span>
                  <FiChevronDown className={`text-gray-400 transition-transform ${countryDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {countryDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full rounded-xl bg-white shadow-xl border border-gray-100 max-h-56 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        placeholder="Search country..."
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-downy-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 py-1">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.iso2}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c);
                            setCountryDropdownOpen(false);
                            setCountrySearch("");
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-gray-50 ${
                            c.iso2 === selectedCountry.iso2 ? "bg-downy-50 text-downy-700 font-bold" : "text-gray-800"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Phone Number */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-downy-500 focus-within:bg-white transition">
                  <span className="px-3 text-xs font-semibold text-gray-500 bg-gray-100/80 border-r border-gray-200 py-2.5">
                    +{selectedCountry.dialCode}
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder={selectedCountry.placeholder || "712 345 678"}
                    className="flex-1 bg-transparent px-3 py-2.5 text-[13px] text-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* What will be checked */}
              <div className="rounded-xl bg-gray-50 p-3.5 space-y-2.5 text-xs border border-gray-100">
                <div className="flex items-start gap-2.5">
                  <span className="text-downy-600 mt-0.5"><FiCamera /></span>
                  <div>
                    <span className="font-semibold text-gray-800">Government ID (Front & Back)</span>
                    <p className="text-gray-500 text-[11px]">Passport, National ID card, or Driver’s License from {selectedCountry.name} or worldwide.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-downy-600 mt-0.5"><FiCamera /></span>
                  <div>
                    <span className="font-semibold text-gray-800">Live 3D Face Scan</span>
                    <p className="text-gray-500 text-[11px]">Quick 3-second liveness check to confirm you are the true document owner.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-downy-600 mt-0.5"><FiLock /></span>
                  <div>
                    <span className="font-semibold text-gray-800">AES-256 Encryption</span>
                    <p className="text-gray-500 text-[11px]">Your ID number is securely encrypted and stored with full data protection.</p>
                  </div>
                </div>
              </div>

              {/* Error box if failed */}
              {diditError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-xs text-red-700">
                  <FiAlertCircle className="mt-0.5 shrink-0 text-red-500" />
                  <span>{diditError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleStartDidit}
                  disabled={launchingDidit}
                  className="w-full rounded-xl bg-downy-600 py-3.5 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-md shadow-downy-600/20 active:opacity-90 transition disabled:opacity-50"
                >
                  {launchingDidit && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {launchingDidit ? "Opening Didit..." : "Start Identity Verification"}
                </button>

                {/* Direct link fallback in case modal popup is blocked */}
                {sessionUrl && (
                  <a
                    href={sessionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full block text-center py-2.5 text-xs font-semibold text-gray-600 hover:text-downy-600 flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Open in new window</span>
                    <FiExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* STEP: Checking / Decision */}
          {step === "checking" && (
            <div className="rounded-2xl bg-white p-7 text-center shadow-sm border border-gray-100 space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-downy-50 text-downy-600 flex items-center justify-center text-2xl animate-spin">
                <FiRefreshCw />
              </div>
              <h2 className="text-[16px] font-bold text-gray-900">Verifying Documents...</h2>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                {checkingMessage}
              </p>
              <div className="pt-2">
                <span className="inline-block h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                  <span className="block h-full bg-downy-500 rounded-full animate-pulse" style={{ width: "70%" }} />
                </span>
              </div>
            </div>
          )}

          {/* STEP: Success / Done */}
          {step === "done" && (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm border border-gray-100 space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl">
                <FiCheck />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-gray-900">Identity Verified 🎉</h2>
                <span className="inline-block mt-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                  Tier 2 Verified
                </span>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 text-left text-xs space-y-2 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Limit:</span>
                  <span className="font-bold text-emerald-700">100,000 KES</span>
                </div>
                {kycData?.identity?.fullName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Legal Name:</span>
                    <span className="font-semibold text-gray-800">{kycData.identity.fullName}</span>
                  </div>
                )}
                {kycData?.identity?.dateOfBirth && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date of Birth:</span>
                    <span className="font-semibold text-gray-800">{kycData.identity.dateOfBirth}</span>
                  </div>
                )}
                {kycData?.identity?.documentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Document:</span>
                    <span className="font-semibold text-gray-800">{kycData.identity.documentType}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={leaveVerify}
                className="w-full rounded-xl bg-downy-600 py-3.5 text-white text-[13px] font-bold shadow-md shadow-downy-600/20 active:opacity-90 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
