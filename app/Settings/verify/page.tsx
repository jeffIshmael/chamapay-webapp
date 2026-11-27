"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBook,
  FiCamera,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { showToast } from "@/app/Components/Toast";
import { getKycStatus, type KycStatusResponse } from "@/lib/kycService";
import {
  getManualChallenge,
  getManualStatus,
  sendPhoneOtp,
  submitManualKyc,
  verifyPhoneOtp,
  type ManualSubmission,
} from "@/lib/kycManualService";
import { COUNTRIES, DEFAULT_COUNTRY, type CountryInfo } from "@/lib/countries";

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type Step = "details" | "identity" | "selfie" | "review" | "submitted" | "done";
type DocType = "id_card" | "passport";
type Img = { blob: Blob; url: string; warning: string | null };
type Challenge = { prompt: string; token: string; expiresAt: number };

const FORM_STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "identity", label: "ID" },
  { key: "selfie", label: "Selfie" },
  { key: "review", label: "Review" },
];

const NAME_RE = /^[\p{L}][\p{L}'’\- ]{0,59}$/u;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function maxDobDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

function docNumberError(iso3: string, docType: DocType, value: string): string | null {
  const n = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (n.length < 5 || n.length > 20) return "Enter the number exactly as printed on your document.";
  if (iso3 === "KEN" && docType === "id_card" && !/^\d{7,8}$/.test(n)) {
    return "Kenyan ID numbers have 7 or 8 digits.";
  }
  return null;
}

/**
 * Downscales to a sane size (keeps uploads small), re-encodes as JPEG and runs
 * cheap quality checks (resolution, brightness, blur) before upload.
 */
async function prepareImage(
  source: Blob,
  opts: { maxWidth: number; minWidth: number }
): Promise<Img> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(source);
  } catch {
    throw new Error("We couldn't read that image. Please use a JPG or PNG photo.");
  }
  if (bmp.width < opts.minWidth) {
    bmp.close();
    throw new Error("That image is too small. Move closer and retake it.");
  }

  const scale = Math.min(1, opts.maxWidth / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  // Quality analysis on a small grayscale copy
  const sw = 320;
  const sh = Math.max(1, Math.round((h * sw) / w));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const { data } = sctx.getImageData(0, 0, sw, sh);
  const gray = new Float32Array(sw * sh);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = g;
    sum += g;
  }
  const mean = sum / gray.length;
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - sw] - gray[i + sw];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const variance = lapSq / count - (lapSum / count) ** 2;

  let warning: string | null = null;
  if (mean < 50) warning = "This looks too dark. Move to better light and retake.";
  else if (mean > 225) warning = "This looks overexposed. Avoid glare and retake.";
  else if (variance < 50) warning = "This looks blurry. Hold steady and retake so all text is readable.";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88)
  );
  if (!blob) throw new Error("Could not process that image. Try again.");

  return { blob, url: URL.createObjectURL(blob), warning };
}

/* -------------------------------------------------------------------------- */
/* Small UI pieces                                                            */
/* -------------------------------------------------------------------------- */

function ProgressBar({ current }: { current: Step }) {
  const idx = FORM_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {FORM_STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= idx ? "bg-downy-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-semibold text-gray-500">
        {FORM_STEPS.map((s, i) => (
          <span key={s.key} className={i === idx ? "text-downy-700" : ""}>
            {i + 1}. {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:border-downy-500 focus:bg-white transition";
const labelCls = "block text-[11px] font-semibold text-gray-700 mb-1";
const primaryBtn =
  "w-full rounded-xl bg-downy-600 py-3.5 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-md shadow-downy-600/20 active:opacity-90 transition disabled:opacity-40";

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2.5 text-xs text-red-700">
      <FiAlertCircle className="mt-0.5 shrink-0 text-red-500" />
      <span>{message}</span>
    </div>
  );
}

function ImagePicker({
  label,
  hint,
  value,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  value: Img | null;
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className={labelCls}>{label}</p>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt={label} className="h-36 w-full bg-gray-100 object-cover" />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${label}`}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <FiX size={14} />
          </button>
          {value.warning && (
            <div className="flex items-start gap-1.5 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{value.warning}</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 transition active:bg-gray-100 disabled:opacity-60"
        >
          {busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-downy-600" />
          ) : (
            <FiUpload size={18} />
          )}
          <span className="text-xs font-semibold">{busy ? "Processing..." : "Tap to take or upload"}</span>
          <span className="text-[10px]">{hint}</span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SelfieCapture({
  prompt,
  value,
  onCapture,
  onClear,
}: {
  prompt: string | null;
  value: Img | null;
  onCapture: (img: Img) => void;
  onClear: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setCamError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch {
      setCamError(
        "We couldn't open your camera. Allow camera access in your browser settings and tap Retry. (Camera needs a secure https connection.)"
      );
    }
  }, []);

  useEffect(() => {
    if (!value) start();
    return stop;
  }, [value, start, stop]);

  const handleCapture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setProcessing(true);
    setLocalError(null);
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("Capture failed. Try again.");
      onCapture(await prepareImage(blob, { maxWidth: 960, minWidth: 320 }));
    } catch (e: any) {
      setLocalError(e?.message || "Capture failed. Try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleFallback = async (file: File) => {
    setProcessing(true);
    setLocalError(null);
    try {
      onCapture(await prepareImage(file, { maxWidth: 960, minWidth: 320 }));
    } catch (e: any) {
      setLocalError(e?.message || "Could not use that photo.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {prompt && (
        <div className="rounded-xl border border-downy-200 bg-downy-50 px-3.5 py-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-downy-700">
            While taking your selfie
          </p>
          <p className="text-[13px] font-bold text-gray-900">{prompt}</p>
        </div>
      )}

      {value ? (
        <div className="space-y-2">
          <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl border border-gray-200 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.url} alt="Your selfie" className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          </div>
          {value.warning && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{value.warning}</span>
            </div>
          )}
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-700 active:bg-gray-50"
          >
            Retake selfie
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {ready && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" />
            )}
            {!ready && !camError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            )}
          </div>

          {camError ? (
            <div className="space-y-2">
              <ErrorBox message={camError} />
              <button type="button" onClick={start} className={primaryBtn}>
                <FiRefreshCw /> Retry camera
              </button>
              <button
                type="button"
                onClick={() => fallbackRef.current?.click()}
                className="w-full py-2 text-xs font-semibold text-gray-600"
              >
                Use my phone's camera app instead
              </button>
              <input
                ref={fallbackRef}
                type="file"
                accept="image/*"
                capture="user"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFallback(f);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready || processing || !prompt}
              className={primaryBtn}
            >
              <FiCamera /> {processing ? "Processing..." : "Take selfie"}
            </button>
          )}
        </div>
      )}

      {localError && <ErrorBox message={localError} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function VerifyDetailsPage() {
  const router = useRouter();
  const { token, isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const { refreshUser } = useUser();

  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState<Step>("details");
  const [kycData, setKycData] = useState<KycStatusResponse | null>(null);

  // Step 1: details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Step 2: identity
  const [dob, setDob] = useState("");
  const [docType, setDocType] = useState<DocType>("id_card");
  const [docNumber, setDocNumber] = useState("");
  const [front, setFront] = useState<Img | null>(null);
  const [back, setBack] = useState<Img | null>(null);
  const [busyField, setBusyField] = useState<"front" | "back" | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Step 3: selfie
  const [selfie, setSelfie] = useState<Img | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  // Step 4 + result
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ManualSubmission | null>(null);
  const [rejectNote, setRejectNote] = useState<string | null>(null);

  /* ------------------------------ auth + boot ----------------------------- */

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || isGuest) router.replace("/Settings");
  }, [authLoading, isAuthenticated, isGuest, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [kyc, manual] = await Promise.all([getKycStatus(token), getManualStatus(token)]);
      if (cancelled) return;

      if (kyc && kyc.success) {
        setKycData(kyc);
        if (kyc.phoneE164) {
          setPhoneVerified(true);
          setVerifiedPhone(kyc.phoneE164);
        }
        if (kyc.kycTier >= 2 && kyc.kycStatus === "approved") {
          setStep("done");
          setBooting(false);
          return;
        }
      }

      const sub = manual?.submission;
      if (sub?.status === "processing") {
        setSubmission(sub);
        setStep("submitted");
      } else if (sub?.status === "rejected" && sub.rejectReason) {
        setRejectNote(sub.rejectReason);
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ---------------------------- OTP resend timer -------------------------- */

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ------------------------- status polling after submit ------------------ */

  useEffect(() => {
    if (step !== "submitted" || !token) return;
    if (submission && submission.status !== "processing") return;
    const id = setInterval(async () => {
      const r = await getManualStatus(token);
      const sub = r?.submission;
      if (!sub) return;
      setSubmission(sub);
      if (sub.status === "approved") {
        await refreshUser();
        const s = await getKycStatus(token);
        if (s) setKycData(s);
        setStep("done");
      } else if (sub.status === "rejected") {
        setRejectNote(sub.rejectReason || "We couldn't verify your documents.");
      }
    }, 20000);
    return () => clearInterval(id);
  }, [step, token, submission, refreshUser]);

  /* ------------------------------ challenge ------------------------------- */

  const loadChallenge = useCallback(async () => {
    if (!token) return;
    const r = await getManualChallenge(token);
    if (r.success) {
      setChallenge({ prompt: r.prompt, token: r.challenge, expiresAt: r.expiresAt });
    } else {
      showToast(r.error || "Could not start selfie check", "error");
    }
  }, [token]);

  useEffect(() => {
    if (step !== "selfie") return;
    if (!challenge || Date.now() > challenge.expiresAt - 60_000) {
      setSelfie(null);
      loadChallenge();
    }
  }, [step, challenge, loadChallenge]);

  /* ----------------------------- derived state ---------------------------- */

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

  const detailsValid =
    NAME_RE.test(firstName.trim()) && NAME_RE.test(lastName.trim()) && phoneVerified;

  const docNumErr = docNumber ? docNumberError(country.iso3, docType, docNumber) : null;
  const identityValid =
    !!dob &&
    dob <= maxDobDate() &&
    !!docNumber &&
    !docNumErr &&
    !!front &&
    (docType === "passport" || !!back);

  /* ------------------------------- handlers ------------------------------- */

  const leaveVerify = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.replace("/Settings");
  };

  const handleBack = () => {
    if (step === "identity") setStep("details");
    else if (step === "selfie") setStep("identity");
    else if (step === "review") setStep("selfie");
    else leaveVerify();
  };

  const handleSendOtp = async () => {
    if (!token) return;
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 7) {
      setPhoneError("Enter a valid phone number.");
      return;
    }
    setOtpBusy(true);
    setPhoneError(null);
    const r = await sendPhoneOtp(token, phoneInput, country.dialCode);
    setOtpBusy(false);
    if (!r.success) {
      setPhoneError(r.error || "Could not send the code.");
      return;
    }
    setOtpSent(true);
    setCooldown(45);
  };

  const handleVerifyOtp = async () => {
    if (!token || otpCode.trim().length < 6) return;
    setOtpBusy(true);
    setPhoneError(null);
    const r = await verifyPhoneOtp(token, otpCode.trim());
    setOtpBusy(false);
    if (!r.success) {
      setPhoneError(r.error || "Invalid code.");
      return;
    }
    setPhoneVerified(true);
    setVerifiedPhone(r.phoneE164 || null);
    setEditingPhone(false);
    setOtpSent(false);
    setOtpCode("");
    showToast("Phone number verified", "success");
  };

  const pickDoc = async (field: "front" | "back", file: File) => {
    setBusyField(field);
    setIdentityError(null);
    try {
      const img = await prepareImage(file, { maxWidth: 1600, minWidth: 640 });
      if (field === "front") {
        if (front) URL.revokeObjectURL(front.url);
        setFront(img);
      } else {
        if (back) URL.revokeObjectURL(back.url);
        setBack(img);
      }
    } catch (e: any) {
      setIdentityError(e?.message || "Could not use that image.");
    } finally {
      setBusyField(null);
    }
  };

  const clearDoc = (field: "front" | "back") => {
    if (field === "front" && front) {
      URL.revokeObjectURL(front.url);
      setFront(null);
    }
    if (field === "back" && back) {
      URL.revokeObjectURL(back.url);
      setBack(null);
    }
  };

  const handleSubmit = async () => {
    if (!token || submitting || !front || !selfie || !challenge) return;
    if (docType === "id_card" && !back) return;

    if (Date.now() > challenge.expiresAt) {
      setSelfie(null);
      await loadChallenge();
      setSubmitError("Your selfie session expired. Please retake your selfie.");
      setStep("selfie");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const form = new FormData();
    form.append("firstName", firstName.trim());
    form.append("lastName", lastName.trim());
    form.append("country", country.iso3);
    form.append("dateOfBirth", dob);
    form.append("docType", docType);
    form.append("documentNumber", docNumber.trim());
    form.append("challenge", challenge.token);
    form.append("front", front.blob, "front.jpg");
    if (docType === "id_card" && back) form.append("back", back.blob, "back.jpg");
    form.append("selfie", selfie.blob, "selfie.jpg");

    const r = await submitManualKyc(token, form);
    setSubmitting(false);

    if (r.alreadyVerified) {
      await refreshUser();
      setStep("done");
      return;
    }
    if (!r.success) {
      const msg = r.error || "Submission failed. Please try again.";
      setSubmitError(msg);
      if (/selfie session expired/i.test(msg)) {
        setSelfie(null);
        setChallenge(null);
        setStep("selfie");
      }
      return;
    }

    setRejectNote(null);
    setSubmission({
      reference: r.reference || "",
      status: "processing",
      submittedAt: new Date().toISOString(),
    });
    setStep("submitted");
  };

  const startOver = () => {
    clearDoc("front");
    clearDoc("back");
    if (selfie) URL.revokeObjectURL(selfie.url);
    setSelfie(null);
    setChallenge(null);
    setDocNumber("");
    setConsent(false);
    setSubmitError(null);
    setSubmission(null);
    setStep("identity");
  };

  /* --------------------------------- render ------------------------------- */

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Header */}
      <div
        className="safe-top shrink-0 rounded-b-2xl px-4 pb-5 pt-2 text-white shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex min-h-[32px] items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition active:bg-white/30"
          >
            <FiArrowLeft size={16} />
          </button>
          <h1 className="text-display text-[15px] font-bold">Verify Identity (Tier 2)</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="safe-bottom flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-sm space-y-4">
          {booting && (
            <div className="flex justify-center py-16">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-downy-600" />
            </div>
          )}

          {!booting && FORM_STEPS.some((s) => s.key === step) && (
            <ProgressBar current={step} />
          )}

          {/* ------------------------- STEP 1: DETAILS ------------------------- */}
          {!booting && step === "details" && (
            <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-downy-50 text-xl text-downy-600">
                  <FiShield />
                </div>
                <h2 className="text-[16px] font-bold text-gray-900">Confirm your details</h2>
                <p className="text-[12px] leading-relaxed text-gray-500">
                  Enter your name exactly as it appears on your ID. Verifying lifts your limit to
                  100,000 KES/month.
                </p>
              </div>

              {rejectNote && (
                <ErrorBox message={`Your last submission wasn't approved: ${rejectNote}`} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First name</label>
                  <input
                    className={inputCls}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <input
                    className={inputCls}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Country */}
              <div className="relative">
                <label className={labelCls}>Country that issued your ID</label>
                <button
                  type="button"
                  onClick={() => setCountryOpen(!countryOpen)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 transition active:bg-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{country.flag}</span>
                    <span className="font-medium">{country.name}</span>
                  </span>
                  <FiChevronDown
                    className={`text-gray-400 transition-transform ${countryOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {countryOpen && (
                  <div className="absolute z-30 mt-1 flex max-h-56 w-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
                    <div className="border-b border-gray-100 p-2">
                      <input
                        type="text"
                        placeholder="Search country..."
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-downy-500"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.iso2}
                          type="button"
                          onClick={() => {
                            setCountry(c);
                            setCountryOpen(false);
                            setCountrySearch("");
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                            c.iso2 === country.iso2
                              ? "bg-downy-50 font-bold text-downy-700"
                              : "text-gray-800"
                          }`}
                        >
                          <span>{c.flag}</span>
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className={labelCls}>WhatsApp phone number</label>

                {phoneVerified && !editingPhone ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-emerald-800">
                      <FiCheck /> {verifiedPhone || "Verified"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(true)}
                      className="text-[11px] font-semibold text-gray-600 underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition focus-within:border-downy-500 focus-within:bg-white">
                      <span className="border-r border-gray-200 bg-gray-100/80 px-3 py-2.5 text-xs font-semibold text-gray-500">
                        +{country.dialCode}
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder={country.placeholder || "712 345 678"}
                        className="flex-1 bg-transparent px-3 py-2.5 text-[13px] text-gray-900 outline-none"
                      />
                    </div>

                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpBusy || phoneInput.replace(/\D/g, "").length < 7}
                        className="w-full rounded-lg border border-downy-600 py-2.5 text-xs font-bold text-downy-700 transition active:bg-downy-50 disabled:opacity-40"
                      >
                        {otpBusy ? "Sending..." : "Send code on WhatsApp"}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          className={`${inputCls} text-center tracking-[0.4em]`}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otpBusy || otpCode.length < 6}
                          className={primaryBtn}
                        >
                          {otpBusy ? "Checking..." : "Verify code"}
                        </button>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={cooldown > 0 || otpBusy}
                          className="w-full py-1 text-[11px] font-semibold text-gray-600 disabled:opacity-50"
                        >
                          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {phoneError && <ErrorBox message={phoneError} />}
              </div>

              <button
                type="button"
                onClick={() => setStep("identity")}
                disabled={!detailsValid}
                className={primaryBtn}
              >
                Continue
              </button>
            </div>
          )}

          {/* ------------------------ STEP 2: IDENTITY ------------------------- */}
          {!booting && step === "identity" && (
            <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="space-y-1 text-center">
                <h2 className="text-[16px] font-bold text-gray-900">Your ID document</h2>
                <p className="text-[12px] leading-relaxed text-gray-500">
                  Use a valid, unexpired document. All four corners must be visible and the text
                  readable.
                </p>
              </div>

              <div>
                <label className={labelCls}>Date of birth</label>
                <input
                  type="date"
                  className={inputCls}
                  value={dob}
                  max={maxDobDate()}
                  onChange={(e) => setDob(e.target.value)}
                />
                {dob && dob > maxDobDate() && (
                  <p className="mt-1 text-[11px] text-red-600">You must be 18 or older.</p>
                )}
              </div>

              <div>
                <p className={labelCls}>Document type</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { key: "id_card", title: "ID card / Driver's license", sub: "Front and back", icon: <FiCreditCard /> },
                      { key: "passport", title: "Passport", sub: "Photo page", icon: <FiBook /> },
                    ] as { key: DocType; title: string; sub: string; icon: React.ReactNode }[]
                  ).map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        setDocType(d.key);
                        if (d.key === "passport") clearDoc("back");
                      }}
                      className={`rounded-xl border-2 p-3 text-left transition ${
                        docType === d.key
                          ? "border-downy-600 bg-downy-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <span className="text-lg text-downy-600">{d.icon}</span>
                      <p className="mt-1 text-[12px] font-bold leading-tight text-gray-900">{d.title}</p>
                      <p className="text-[10px] text-gray-500">{d.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  {docType === "passport" ? "Passport number" : "ID / license number"}
                </label>
                <input
                  className={inputCls}
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  autoCapitalize="characters"
                />
                {docNumErr && <p className="mt-1 text-[11px] text-red-600">{docNumErr}</p>}
              </div>

              <div className="space-y-3">
                <ImagePicker
                  label={docType === "passport" ? "Passport photo page" : "Front of document"}
                  hint="JPG or PNG, up to 5 MB"
                  value={front}
                  busy={busyField === "front"}
                  onPick={(f) => pickDoc("front", f)}
                  onClear={() => clearDoc("front")}
                />
                {docType === "id_card" && (
                  <ImagePicker
                    label="Back of document"
                    hint="JPG or PNG, up to 5 MB"
                    value={back}
                    busy={busyField === "back"}
                    onPick={(f) => pickDoc("back", f)}
                    onClear={() => clearDoc("back")}
                  />
                )}
              </div>

              {identityError && <ErrorBox message={identityError} />}

              <button
                type="button"
                onClick={() => setStep("selfie")}
                disabled={!identityValid}
                className={primaryBtn}
              >
                Continue
              </button>
            </div>
          )}

          {/* ------------------------- STEP 3: SELFIE -------------------------- */}
          {!booting && step === "selfie" && (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="space-y-1 text-center">
                <h2 className="text-[16px] font-bold text-gray-900">Take a live selfie</h2>
                <p className="text-[12px] leading-relaxed text-gray-500">
                  Face the camera in good light, remove glasses or a hat, and do the action shown
                  below.
                </p>
              </div>

              {submitError && <ErrorBox message={submitError} />}

              <SelfieCapture
                prompt={challenge?.prompt ?? null}
                value={selfie}
                onCapture={(img) => {
                  setSubmitError(null);
                  setSelfie(img);
                }}
                onClear={() => {
                  if (selfie) URL.revokeObjectURL(selfie.url);
                  setSelfie(null);
                }}
              />

              <button
                type="button"
                onClick={() => setStep("review")}
                disabled={!selfie}
                className={primaryBtn}
              >
                Continue
              </button>
            </div>
          )}

          {/* ------------------------- STEP 4: REVIEW -------------------------- */}
          {!booting && step === "review" && (
            <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="space-y-1 text-center">
                <h2 className="text-[16px] font-bold text-gray-900">Review and submit</h2>
                <p className="text-[12px] leading-relaxed text-gray-500">
                  Check that everything matches your document. Mismatches are the most common
                  reason for rejection.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs">
                {[
                  ["Name", `${firstName.trim()} ${lastName.trim()}`],
                  ["Country", `${country.flag} ${country.name}`],
                  ["Phone", verifiedPhone || "-"],
                  ["Date of birth", dob],
                  ["Document", docType === "passport" ? "Passport" : "ID card / Driver's license"],
                  ["Number", docNumber.toUpperCase()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-right font-semibold text-gray-800">{v}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[front, docType === "id_card" ? back : null, selfie].map(
                  (img, i) =>
                    img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={img.url}
                        alt=""
                        className="h-20 w-full rounded-lg border border-gray-200 object-cover"
                      />
                    )
                )}
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
                <FiLock className="mt-0.5 shrink-0 text-downy-600" />
                <span>
                  Your documents are stored in a private, access-controlled vault, are only seen
                  by our verification team, and are deleted from our servers 30 days after review.
                  Your ID number is stored encrypted.
                </span>
              </div>

              <label className="flex items-start gap-2.5 text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#1a6b6b]"
                />
                <span>
                  I confirm these details are mine and accurate, and I agree to the processing of my
                  documents for identity verification.
                </span>
              </label>

              {submitError && <ErrorBox message={submitError} />}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!consent || submitting}
                className={primaryBtn}
              >
                {submitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {submitting ? "Uploading securely..." : "Submit for verification"}
              </button>
            </div>
          )}

          {/* ----------------------- SUBMITTED / STATUS ------------------------ */}
          {!booting && step === "submitted" && submission && (
            <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              {submission.status === "rejected" ? (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-500">
                    <FiAlertCircle />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-[16px] font-bold text-gray-900">Verification not approved</h2>
                    <p className="text-[12px] leading-relaxed text-gray-600">
                      {submission.rejectReason || rejectNote || "We couldn't verify your documents."}
                    </p>
                  </div>
                  <button type="button" onClick={startOver} className={primaryBtn}>
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-downy-50 text-2xl text-downy-600">
                    <FiClock />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-[16px] font-bold text-gray-900">Submitted for review</h2>
                    <p className="text-[12px] leading-relaxed text-gray-500">
                      Our team is reviewing your documents. This usually takes under 24 hours and
                      you can safely leave this page.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-left text-xs">
                    {[
                      { label: "Submitted", state: "done" },
                      { label: "In review", state: "active" },
                      { label: "Decision", state: "todo" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                            s.state === "done"
                              ? "bg-emerald-500 text-white"
                              : s.state === "active"
                              ? "border-2 border-downy-600 bg-white"
                              : "border-2 border-gray-300 bg-white"
                          }`}
                        >
                          {s.state === "done" && <FiCheck size={11} />}
                          {s.state === "active" && (
                            <span className="h-2 w-2 animate-pulse rounded-full bg-downy-600" />
                          )}
                        </span>
                        <span
                          className={
                            s.state === "todo" ? "text-gray-400" : "font-semibold text-gray-800"
                          }
                        >
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {submission.reference && (
                    <p className="text-[11px] text-gray-500">
                      Reference: <span className="font-mono font-semibold text-gray-700">{submission.reference}</span>
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={leaveVerify}
                    className="w-full rounded-xl border border-gray-200 py-3 text-[13px] font-bold text-gray-700 active:bg-gray-50"
                  >
                    Back to app
                  </button>
                </>
              )}
            </div>
          )}

          {/* ------------------------------ DONE ------------------------------- */}
          {!booting && step === "done" && (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                <FiCheck />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-gray-900">Identity Verified 🎉</h2>
                <span className="mt-1 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  Tier 2 Verified
                </span>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-left text-xs">
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

              <button type="button" onClick={leaveVerify} className={primaryBtn}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}