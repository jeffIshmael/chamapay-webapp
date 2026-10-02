"use client";

import { Dialog } from "@headlessui/react";
import Image from "next/image";

export type MpesaConfirmRow = {
  label: string;
  value: string;
  tone?: "default" | "fee" | "emphasis" | "muted";
};

type Props = {
  open: boolean;
  onClose: () => void;
  verifying: boolean;
  error?: string;
  title?: string;
  subtitle?: string;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  recipientName?: string;
  phoneDisplay?: string;
  rows: MpesaConfirmRow[];
  /** Optional footnote. Nothing is shown unless a caller passes one. */
  notice?: string;
};

function labelClass(tone: MpesaConfirmRow["tone"]) {
  switch (tone) {
    case "emphasis":
      return "text-[13px] font-semibold text-gray-900";
    case "muted":
      return "text-[11px] text-gray-400";
    default:
      return "text-xs text-gray-500";
  }
}

function valueClass(tone: MpesaConfirmRow["tone"]) {
  switch (tone) {
    case "fee":
      return "text-[13px] font-semibold text-amber-600";
    case "emphasis":
      return "text-base font-bold text-downy-800";
    case "muted":
      return "text-[11px] font-medium text-gray-600";
    default:
      return "text-[13px] font-semibold text-gray-900";
  }
}

export default function MpesaConfirmDialog({
  open,
  onClose,
  verifying,
  error,
  title = "Confirm Details",
  subtitle = "M-Pesa Verification",
  confirmLabel,
  onConfirm,
  confirmDisabled,
  recipientName,
  phoneDisplay,
  rows,
  notice,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (verifying) return;
        onClose();
      }}
      className="relative z-[110]"
    >
      <div className="app-modal-layer !pointer-events-auto !justify-center">
        <div className="app-modal-backdrop" aria-hidden="true" />
        <Dialog.Panel className="relative w-[calc(100%-2rem)] max-w-[400px] mx-4 rounded-[28px] bg-white shadow-2xl overflow-hidden border border-downy-100">
          <div className="bg-downy-50/90 pt-4 pb-3.5 px-5 border-b border-downy-100/60 text-center">
            <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center">
              <Image
                src="/static/images/mpesa.png"
                alt="M-Pesa"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <Dialog.Title className="text-base font-bold text-downy-900">
              {title}
            </Dialog.Title>
            <p className="text-[9px] text-downy-600 mt-0.5 uppercase tracking-widest font-bold">
              {subtitle}
            </p>
          </div>

          <div className="p-4">
            {verifying ? (
              <div className="flex flex-col items-center py-8">
                <div className="h-7 w-7 rounded-full border-2 border-downy-600 border-t-transparent animate-spin mb-2.5" />
                <p className="text-[13px] font-semibold text-downy-800">
                  Verifying recipient information…
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Checking phone registration status
                </p>
              </div>
            ) : error ? (
              <div className="text-center py-2">
                <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 border border-red-200">
                  <span className="text-xl text-red-500" aria-hidden>
                    !
                  </span>
                </div>
                <p className="text-sm font-bold text-red-600">
                  Verification Failed
                </p>
                <p className="text-xs text-gray-500 mt-1.5 px-2 leading-5">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 w-full py-3 rounded-2xl bg-gray-100 border border-gray-200 text-[13px] font-bold text-gray-800"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  <div className="rounded-2xl bg-gray-50/90 border border-gray-100 px-3.5 py-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Recipient account
                    </p>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200/60">
                      <span className="text-xs text-gray-500">Name</span>
                      <span className="text-[13px] font-semibold text-gray-900 text-right max-w-[60%] truncate">
                        {recipientName || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Phone number</span>
                      <span className="text-[13px] font-semibold text-downy-700">
                        {phoneDisplay || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-downy-50/60 border border-downy-100/60 px-3.5 py-3">
                    <p className="text-[9px] font-bold text-downy-600/70 uppercase tracking-widest mb-2">
                      Transaction value
                    </p>
                    <div className="space-y-1.5">
                      {rows.map((row, i) => {
                        // One divider where the summary starts (the first emphasis/muted row),
                        // not a line above every muted row.
                        const grouped =
                          row.tone === "emphasis" || row.tone === "muted";
                        const prev = rows[i - 1];
                        const prevGrouped =
                          prev?.tone === "emphasis" || prev?.tone === "muted";
                        const startsGroup = grouped && !prevGrouped;
                        return (
                          <div
                            key={`${row.label}-${i}`}
                            className={`flex items-center justify-between ${
                              startsGroup
                                ? "pt-2 mt-2 border-t border-downy-100/60"
                                : ""
                            }`}
                          >
                            <span className={labelClass(row.tone)}>
                              {row.label}
                            </span>
                            <span className={valueClass(row.tone)}>
                              {row.value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {notice && (
                    <p className="px-1 text-[11px] text-gray-400 leading-4">
                      {notice}
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5 mt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-2xl border border-gray-300 text-[13px] font-semibold text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    className={`flex-[1.5] py-3 rounded-2xl text-[13px] font-bold shadow-md ${
                      confirmDisabled
                        ? "bg-gray-200 text-gray-400"
                        : "bg-downy-600 text-white shadow-downy-100"
                    }`}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}