"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiCheck, FiChevronDown } from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { showToast } from "@/app/Components/Toast";
import {
  submitKycDetails,
  type KycDocumentType,
  type KycNetwork,
} from "@/lib/kycService";

const NETWORKS: { id: KycNetwork; label: string }[] = [
  { id: "safaricom", label: "Safaricom" },
  { id: "airtel", label: "Airtel" },
];

const DOCUMENT_TYPES: {
  id: KycDocumentType;
  label: string;
  numberLabel: string;
  placeholder: string;
}[] = [
  {
    id: "national_id",
    label: "National ID",
    numberLabel: "National ID number",
    placeholder: "e.g. 12345678",
  },
  {
    id: "passport",
    label: "Passport",
    numberLabel: "Passport number",
    placeholder: "e.g. A1234567",
  },
  {
    id: "driving_license",
    label: "Driving License",
    numberLabel: "Driving license number",
    placeholder: "e.g. ABC123456",
  },
];

/** 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX -> 2547XXXXXXXX */
function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  let normalized = digits;
  if (/^0[17]\d{8}$/.test(digits)) normalized = `254${digits.slice(1)}`;
  return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

function validateDocumentNumber(type: KycDocumentType, value: string) {
  const v = value.trim();
  if (!v) return "Enter your document number";
  if (type === "national_id" && !/^\d{7,8}$/.test(v)) {
    return "National ID must be 7–8 digits";
  }
  if (type === "passport" && !/^[A-Za-z0-9]{6,9}$/.test(v)) {
    return "Enter a valid passport number";
  }
  if (type === "driving_license" && !/^[A-Za-z0-9]{6,12}$/.test(v)) {
    return "Enter a valid license number";
  }
  return null;
}

const inputClass =
  "w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-downy-500 transition";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

export default function VerifyDetailsPage() {
  const router = useRouter();
  const { token, isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const { isKycApproved, isKycPending, refreshUser } = useUser();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [touched, setTouched] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<KycNetwork | "">("");

  // Step 2
  const [docType, setDocType] = useState<KycDocumentType | "">("");
  const [docNumber, setDocNumber] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || isGuest) router.replace("/Settings");
  }, [authLoading, isAuthenticated, isGuest, router]);

  // Already verified / under review: nothing to do here (but let the success modal show)
  useEffect(() => {
    if (showSuccess) return;
    if (isKycApproved || isKycPending) router.replace("/Settings");
  }, [isKycApproved, isKycPending, showSuccess, router]);

  const maxDob = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  }, []);

  const selectedDoc = DOCUMENT_TYPES.find((d) => d.id === docType);

  const step1Errors = {
    firstName: firstName.trim().length < 2 ? "Enter your first name" : "",
    lastName: lastName.trim().length < 2 ? "Enter your last name" : "",
    dob: !dob ? "Select your date of birth" : dob > maxDob ? "You must be 18 or older" : "",
    phone: normalizeKenyanPhone(phone) ? "" : "Enter a valid Safaricom/Airtel number",
    network: network ? "" : "Select your network",
  };
  const step1Valid = Object.values(step1Errors).every((e) => !e);

  const step2Errors = {
    docType: docType ? "" : "Select a document type",
    docNumber: docType
      ? validateDocumentNumber(docType, docNumber) ?? ""
      : "",
  };
  const step2Valid = !step2Errors.docType && !step2Errors.docNumber && !!docType;

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setTouched(false);
    } else {
      router.back();
    }
  };

  const handleContinue = () => {
    setTouched(true);
    if (!step1Valid) return;
    setStep(2);
    setTouched(false);
  };

  const handleSubmit = async () => {
    setTouched(true);
    if (!step2Valid || !step1Valid || !docType || !network) return;
    if (!token || token === "guest") {
      showToast("Please sign in again", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await submitKycDetails(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dob,
        phoneNumber: normalizeKenyanPhone(phone)!,
        network,
        documentType: docType,
        documentNumber: docNumber.trim().toUpperCase(),
      });
      setShowSuccess(true);
      void refreshUser(); // header/settings/deposit update everywhere
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Could not submit your details",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const show = (msg: string) => (touched && msg ? msg : undefined);
  const border = (msg: string) =>
    touched && msg ? "border-red-400" : "border-gray-200";

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Header + stepper */}
      <div
        className="shrink-0 px-4 pt-2 pb-4 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        <div className="flex items-center justify-between mb-4 min-h-[32px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <FiArrowLeft size={16} />
          </button>
          <h1 className="text-display text-[14px] font-bold">Verify Details</h1>
          <div className="w-8" />
        </div>

        <div className="flex items-center px-6">
          {[1, 2].map((n, i) => {
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition ${
                      done
                        ? "bg-emerald-400 border-emerald-400 text-white"
                        : active
                          ? "bg-white border-white text-downy-800"
                          : "bg-transparent border-white/40 text-white/60"
                    }`}
                  >
                    {done ? <FiCheck size={14} /> : n}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      active || done ? "text-white" : "text-white/60"
                    }`}
                  >
                    {n === 1 ? "Personal" : "Document"}
                  </span>
                </div>
                {i === 0 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mb-4 rounded ${
                      step > 1 ? "bg-emerald-400" : "bg-white/30"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-8 [-webkit-overflow-scrolling:touch]">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 space-y-3.5">
          {step === 1 ? (
            <>
              <div>
                <p className="text-[13px] font-bold text-gray-900">
                  Personal details
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Use your name exactly as it appears on your ID.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="First name" error={show(step1Errors.firstName)}>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    placeholder="Jane"
                    className={`${inputClass} ${border(step1Errors.firstName)}`}
                  />
                </Field>
                <Field label="Last name" error={show(step1Errors.lastName)}>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    placeholder="Wanjiku"
                    className={`${inputClass} ${border(step1Errors.lastName)}`}
                  />
                </Field>
              </div>

              <Field label="Date of birth" error={show(step1Errors.dob)}>
                <input
                  type="date"
                  value={dob}
                  max={maxDob}
                  onChange={(e) => setDob(e.target.value)}
                  className={`${inputClass} ${border(step1Errors.dob)}`}
                />
              </Field>

              <Field label="Phone number" error={show(step1Errors.phone)}>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  className={`${inputClass} ${border(step1Errors.phone)}`}
                />
              </Field>

              <Field label="Network" error={show(step1Errors.network)}>
                <div className="grid grid-cols-2 gap-2.5">
                  {NETWORKS.map((n) => {
                    const active = network === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNetwork(n.id)}
                        className={`rounded-lg border px-3 py-2.5 text-[12px] font-semibold flex items-center justify-between transition ${
                          active
                            ? "border-downy-600 bg-downy-50 text-downy-700"
                            : touched && step1Errors.network
                              ? "border-red-400 bg-gray-50 text-gray-700"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                        }`}
                      >
                        {n.label}
                        {active && <FiCheck size={14} />}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <button
                type="button"
                onClick={handleContinue}
                className="w-full rounded-lg bg-downy-600 py-3 text-white text-[13px] font-bold"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-[13px] font-bold text-gray-900">
                  Identity document
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Choose the document you want to verify with.
                </p>
              </div>

              <Field label="Document type" error={show(step2Errors.docType)}>
                <div className="relative">
                  <select
                    value={docType}
                    onChange={(e) => {
                      setDocType(e.target.value as KycDocumentType);
                      setDocNumber("");
                    }}
                    className={`${inputClass} ${border(step2Errors.docType)} appearance-none pr-9`}
                  >
                    <option value="" disabled>
                      Select document type
                    </option>
                    {DOCUMENT_TYPES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </Field>

              <Field
                label={selectedDoc?.numberLabel ?? "Document number"}
                error={show(step2Errors.docNumber)}
              >
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  disabled={!docType}
                  inputMode={docType === "national_id" ? "numeric" : "text"}
                  placeholder={selectedDoc?.placeholder ?? "Select a document type first"}
                  className={`${inputClass} ${border(step2Errors.docNumber)} disabled:opacity-60`}
                />
              </Field>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-lg bg-downy-600 py-3 text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {submitting && (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {submitting ? "Submitting…" : "Submit details"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success modal */}
      {showSuccess && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl"
          >
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FiCheck size={28} />
            </div>
            <h2 className="text-[16px] font-bold text-gray-900">
              Details submitted
            </h2>
            <p className="mt-1.5 text-[12px] text-gray-500 leading-relaxed">
              Thanks! We&apos;re reviewing your details. You&apos;ll be able to use
              all features once your verification is approved.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/Settings")}
              className="mt-4 w-full rounded-lg bg-downy-600 py-3 text-white text-[13px] font-bold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}