"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiArrowRight,
} from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { showToast } from "@/app/Components/Toast";
import {
  submitKycDetails,
  type KycDocumentType,
  type KycNetwork,
} from "@/lib/kycService";

const NETWORKS: {
  id: KycNetwork;
  label: string;
  logo: string;
}[] = [
  {
    id: "safaricom",
    label: "Safaricom",
    logo: "/images/safaricom.jpeg",
  },
  {
    id: "airtel",
    label: "Airtel",
    logo: "/images/Airtel-logo.jpg",
  },
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

/**
 * Normalizes Kenyan phone numbers into:
 * 2547XXXXXXXX
 *
 * Accepts:
 * 0712 345 678
 * 0712345678
 * 712 345 678
 * 712345678
 * +254712345678
 * 254712345678
 */
function normalizeKenyanPhone(raw: string): string | null {
  // Keep digits only
  let digits = raw.replace(/\D/g, "");

  // Full international format
  if (digits.startsWith("254")) {
    digits = digits.slice(3);
  }

  // Local format with leading zero
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Kenyan mobile numbers supported here:
  // 7XXXXXXXX
  // 1XXXXXXXX
  if (!/^[17]\d{8}$/.test(digits)) {
    return null;
  }

  return `254${digits}`;
}

function validateDocumentNumber(
  type: KycDocumentType,
  value: string,
): string | null {
  const v = value.trim();

  if (!v) {
    return "Enter your document number";
  }

  if (type === "national_id" && !/^\d{7,8}$/.test(v)) {
    return "National ID must be 7–8 digits";
  }

  if (type === "passport" && !/^[A-Za-z0-9]{6,9}$/.test(v)) {
    return "Enter a valid passport number";
  }

  if (
    type === "driving_license" &&
    !/^[A-Za-z0-9]{6,12}$/.test(v)
  ) {
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

      {error && (
        <p className="mt-1 text-[10px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function VerifyDetailsPage() {
  const router = useRouter();

  const {
    token,
    isAuthenticated,
    isGuest,
    isLoading: authLoading,
  } = useAuth();

  const {
    isKycApproved,
    isKycPending,
    refreshUser,
  } = useUser();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [touchedFields, setTouchedFields] = useState<
    Record<string, boolean>
  >({});

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<KycNetwork | "">("");

  // Step 2
  const [docType, setDocType] = useState<KycDocumentType | "">("");
  const [docNumber, setDocNumber] = useState("");

  // -------------------------
  // Authentication redirects
  // -------------------------

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || isGuest) {
      router.replace("/Settings");
    }
  }, [authLoading, isAuthenticated, isGuest, router]);

  // -------------------------
  // Existing KYC redirects
  // -------------------------

  useEffect(() => {
    if (showSuccess) return;

    if (isKycApproved || isKycPending) {
      router.replace("/Settings");
    }
  }, [
    isKycApproved,
    isKycPending,
    showSuccess,
    router,
  ]);

  // -------------------------
  // Date validation
  // -------------------------

  const maxDob = useMemo(() => {
    const d = new Date();

    d.setFullYear(d.getFullYear() - 18);

    return d.toISOString().split("T")[0];
  }, []);

  const selectedDoc = DOCUMENT_TYPES.find(
    (d) => d.id === docType,
  );

  const selectedNetwork = NETWORKS.find(
    (n) => n.id === network,
  );

  // -------------------------
  // Validation
  // -------------------------

  const step1Errors = {
    firstName:
      firstName.trim().length < 2
        ? "Enter your first name"
        : "",

    lastName:
      lastName.trim().length < 2
        ? "Enter your last name"
        : "",

    dob: !dob
      ? "Select your date of birth"
      : dob > maxDob
        ? "You must be 18 or older"
        : "",

    network: network
      ? ""
      : "Select your mobile network",

    phone: normalizeKenyanPhone(phone)
      ? ""
      : "Enter a valid Kenyan phone number",
  };

  const step1Valid = Object.values(step1Errors).every(
    (error) => !error,
  );

  const step2Errors = {
    docType: docType
      ? ""
      : "Select a document type",

    docNumber: docType
      ? (validateDocumentNumber(
          docType,
          docNumber,
        ) ?? "")
      : "",
  };

  const step2Valid =
    !step2Errors.docType &&
    !step2Errors.docNumber &&
    !!docType;

  // -------------------------
  // Field helpers
  // -------------------------

  const touch = (field: string) => {
    setTouchedFields((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const showError = (
    field: string,
    message: string,
  ) =>
    touchedFields[field]
      ? message || undefined
      : undefined;

  const border = (
    field: string,
    message: string,
  ) =>
    touchedFields[field] && message
      ? "border-red-400"
      : "border-gray-200";

  // -------------------------
  // Navigation
  // -------------------------

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setTouchedFields({});
    } else {
      router.back();
    }
  };

  const handleContinue = () => {
    setTouchedFields({
      firstName: true,
      lastName: true,
      dob: true,
      phone: true,
      network: true,
    });

    if (!step1Valid) return;

    setStep(2);
    setTouchedFields({});
  };

  // -------------------------
  // Submit
  // -------------------------

  const handleSubmit = async () => {
    setTouchedFields({
      docType: true,
      docNumber: true,
    });

    if (
      !step2Valid ||
      !step1Valid ||
      !docType ||
      !network
    ) {
      return;
    }

    if (!token || token === "guest") {
      showToast("Please sign in again", "warning");
      return;
    }

    const normalizedPhone = normalizeKenyanPhone(phone);

    if (!normalizedPhone) {
      showToast(
        "Please enter a valid Kenyan phone number",
        "warning",
      );
      return;
    }

    setSubmitting(true);

    try {
      await submitKycDetails(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dob,

        // Always submitted as:
        // 2547XXXXXXXX
        phoneNumber: normalizedPhone,

        network,
        documentType: docType,
        documentNumber: docNumber
          .trim()
          .toUpperCase(),
      });

      setShowSuccess(true);

      void refreshUser();
    } catch (e) {
      showToast(
        e instanceof Error
          ? e.message
          : "Could not submit your information",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-50">
      {/* Header + stepper */}
      <div
        className="shrink-0 px-4 pt-2 pb-4 rounded-b-2xl text-white safe-top shadow-md shadow-downy-900/20"
        style={{ backgroundColor: "#1a6b6b" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 min-h-[32px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition"
          >
            <FiArrowLeft size={16} />
          </button>

          <h1 className="text-display text-[14px] font-bold">
            Verify Details
          </h1>

          <div className="w-8" />
        </div>

        {/* Stepper */}
        <div className="flex items-center px-6">
          {[1, 2].map((n, i) => {
            const done = step > n;
            const active = step === n;

            return (
              <div
                key={n}
                className="flex items-center flex-1 last:flex-none"
              >
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
                    {done ? (
                      <FiCheck size={14} />
                    ) : (
                      n
                    )}
                  </span>

                  <span
                    className={`text-[10px] font-semibold ${
                      active || done
                        ? "text-white"
                        : "text-white/60"
                    }`}
                  >
                    {n === 1
                      ? "Personal"
                      : "Identity"}
                  </span>
                </div>

                {i === 0 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mb-4 rounded ${
                      step > 1
                        ? "bg-emerald-400"
                        : "bg-white/30"
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
              {/* Personal information */}
              <div>
                <p className="text-[13px] font-bold text-gray-900">
                  Personal information
                </p>

                <p className="text-[11px] text-gray-500 mt-0.5">
                  Use your name exactly as it appears on
                  your ID.
                </p>
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-2.5">
                <Field
                  label="First name"
                  error={showError(
                    "firstName",
                    step1Errors.firstName,
                  )}
                >
                  <input
                    value={firstName}
                    onChange={(e) =>
                      setFirstName(e.target.value)
                    }
                    onBlur={() => touch("firstName")}
                    autoComplete="given-name"
                    placeholder="Jane"
                    className={`${inputClass} ${border(
                      "firstName",
                      step1Errors.firstName,
                    )}`}
                  />
                </Field>

                <Field
                  label="Last name"
                  error={showError(
                    "lastName",
                    step1Errors.lastName,
                  )}
                >
                  <input
                    value={lastName}
                    onChange={(e) =>
                      setLastName(e.target.value)
                    }
                    onBlur={() => touch("lastName")}
                    autoComplete="family-name"
                    placeholder="Wanjiku"
                    className={`${inputClass} ${border(
                      "lastName",
                      step1Errors.lastName,
                    )}`}
                  />
                </Field>
              </div>

              {/* Date of birth */}
              <Field
                label="Date of birth"
                error={showError(
                  "dob",
                  step1Errors.dob,
                )}
              >
                <input
                  type="date"
                  value={dob}
                  max={maxDob}
                  onChange={(e) =>
                    setDob(e.target.value)
                  }
                  onBlur={() => touch("dob")}
                  className={`${inputClass} ${border(
                    "dob",
                    step1Errors.dob,
                  )}`}
                />
              </Field>

              {/* Mobile network */}
              <Field
                label="Mobile network"
                error={showError(
                  "network",
                  step1Errors.network,
                )}
              >
                <div className="relative">
                  <select
                    value={network}
                    onChange={(e) => {
                      setNetwork(
                        e.target.value as KycNetwork,
                      );
                      touch("network");
                    }}
                    className={`${inputClass} ${border(
                      "network",
                      step1Errors.network,
                    )} appearance-none pr-10 ${
                      !network
                        ? "text-gray-400"
                        : "text-gray-900"
                    }`}
                  >
                    <option value="" disabled>
                      Select your network
                    </option>

                    {NETWORKS.map((n) => (
                      <option
                        key={n.id}
                        value={n.id}
                      >
                        {n.label}
                      </option>
                    ))}
                  </select>

                  {selectedNetwork && (
                    <img
                      src={selectedNetwork.logo}
                      alt=""
                      className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 h-5 w-5 object-contain"
                    />
                  )}

                  <FiChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </Field>

              {/* Phone number */}
              <Field
                label="Phone number"
                error={showError(
                  "phone",
                  step1Errors.phone,
                )}
              >
                <div
                  className={`flex rounded-lg border bg-gray-50 overflow-hidden focus-within:bg-white focus-within:border-downy-500 transition ${
                    touchedFields.phone &&
                    step1Errors.phone
                      ? "border-red-400"
                      : "border-gray-200"
                  }`}
                >
                  {/* Fixed Kenya country code */}
                  <div className="shrink-0 flex items-center gap-1.5 px-3 border-r border-gray-200 text-[13px] text-gray-800">
                    <span className="text-[16px] leading-none">
                      🇰🇪
                    </span>

                    <span className="font-medium">
                      +254
                    </span>
                  </div>

                  {/* Editable local number */}
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      // Allow digits, spaces and + while typing.
                      // Normalization happens during validation/submission.
                      const value =
                        e.target.value.replace(
                          /[^\d\s+]/g,
                          "",
                        );

                      setPhone(value);
                    }}
                    onBlur={() => touch("phone")}
                    autoComplete="tel-national"
                    placeholder="712 345 678"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
                  />
                </div>
              </Field>

              {/* Continue */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full rounded-lg bg-downy-600 py-3 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-md shadow-downy-600/20 active:opacity-90 transition"
                >
                  Continue
                  <FiArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Identity */}
              <div>
                <p className="text-[13px] font-bold text-gray-900">
                  Identity verification
                </p>

                <p className="text-[11px] text-gray-500 mt-0.5">
                  Choose a document to verify your
                  identity.
                </p>
              </div>

              {/* Document type */}
              <Field
                label="Document type"
                error={showError(
                  "docType",
                  step2Errors.docType,
                )}
              >
                <div className="relative">
                  <select
                    value={docType}
                    onChange={(e) => {
                      setDocType(
                        e.target.value as KycDocumentType,
                      );
                      setDocNumber("");
                      touch("docType");
                    }}
                    className={`${inputClass} ${border(
                      "docType",
                      step2Errors.docType,
                    )} appearance-none pr-9`}
                  >
                    <option value="" disabled>
                      Select document type
                    </option>

                    {DOCUMENT_TYPES.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                      >
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

              {/* Document number */}
              <Field
                label={
                  selectedDoc?.numberLabel ??
                  "Document number"
                }
                error={showError(
                  "docNumber",
                  step2Errors.docNumber,
                )}
              >
                <input
                  value={docNumber}
                  onChange={(e) =>
                    setDocNumber(e.target.value)
                  }
                  onBlur={() => touch("docNumber")}
                  disabled={!docType}
                  inputMode={
                    docType === "national_id"
                      ? "numeric"
                      : "text"
                  }
                  placeholder={
                    selectedDoc?.placeholder ??
                    "Select a document type first"
                  }
                  className={`${inputClass} ${border(
                    "docNumber",
                    step2Errors.docNumber,
                  )} disabled:opacity-60`}
                />
              </Field>

              {/* Back + Submit */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="rounded-lg border border-gray-200 bg-white py-3 text-gray-700 text-[13px] font-bold flex items-center justify-center gap-1.5 active:bg-gray-50 transition disabled:opacity-50"
                >
                  <FiArrowLeft size={15} />
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-lg bg-downy-600 py-3 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-md shadow-downy-600/20 active:opacity-90 transition disabled:opacity-70"
                >
                  {submitting && (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}

                  {submitting
                    ? "Submitting…"
                    : "Submit"}
                </button>
              </div>
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
              Thanks! We&apos;re reviewing your information.
              You&apos;ll be able to use all features once
              your verification is approved.
            </p>

            <button
              type="button"
              onClick={() =>
                router.replace("/Settings")
              }
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