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
  notice?: string;
};

function rowClass(tone: MpesaConfirmRow["tone"]) {
  switch (tone) {
    case "fee":
      return "text-sm font-bold text-amber-600";
    case "emphasis":
      return "text-lg font-black text-downy-800";
    case "muted":
      return "text-xs font-bold text-gray-800";
    default:
      return "text-sm font-bold text-gray-900";
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
  notice = "Funds will move instantly once you confirm.",
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
          <div className="bg-downy-50/90 py-6 px-5 border-b border-downy-100/60 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center">
              <Image
                src="/static/images/mpesa.png"
                alt="M-Pesa"
                width={56}
                height={56}
                className="object-contain"
              />
            </div>
            <Dialog.Title className="text-xl font-black text-downy-900 tracking-tight">
              {title}
            </Dialog.Title>
            <p className="text-[10px] text-downy-600 mt-1 uppercase tracking-widest font-black">
              {subtitle}
            </p>
          </div>

          <div className="p-5">
            {verifying ? (
              <div className="flex flex-col items-center py-10">
                <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin mb-3" />
                <p className="text-sm font-bold text-downy-800">
                  Verifying recipient information…
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Checking phone registration status
                </p>
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-200">
                  <span className="text-2xl" aria-hidden>
                    !
                  </span>
                </div>
                <p className="text-base font-bold text-red-600">
                  Verification Failed
                </p>
                <p className="text-sm text-gray-500 mt-2 px-2 leading-5">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 w-full py-3.5 rounded-2xl bg-gray-100 border border-gray-200 text-sm font-bold text-gray-800"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50/90 border border-gray-100 p-4 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                      Recipient account
                    </p>
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200/60">
                      <span className="text-sm text-gray-500">Name</span>
                      <span className="text-sm font-black text-gray-900 text-right max-w-[60%]">
                        {recipientName || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Phone Number</span>
                      <span className="text-sm font-black text-downy-700">
                        {phoneDisplay || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-downy-50/60 border border-downy-100/60 p-4 shadow-sm">
                    <p className="text-[10px] font-black text-downy-600/70 uppercase tracking-widest mb-3">
                      Transaction value
                    </p>
                    {rows.map((row, i) => {
                      const isLast = i === rows.length - 1;
                      const bordered =
                        row.tone === "emphasis" || row.tone === "muted";
                      return (
                        <div
                          key={`${row.label}-${i}`}
                          className={`flex items-center justify-between ${
                            bordered
                              ? "pt-2 mt-1 border-t border-downy-100/40"
                              : "mb-2"
                          } ${isLast ? "" : ""}`}
                        >
                          <span
                            className={
                              row.tone === "emphasis"
                                ? "text-sm text-gray-900 font-bold"
                                : row.tone === "muted"
                                  ? "text-xs text-gray-500 font-semibold"
                                  : "text-sm text-gray-600 font-medium"
                            }
                          >
                            {row.label}
                          </span>
                          <span className={rowClass(row.tone)}>
                            {row.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl bg-amber-50 border border-amber-100 px-3.5 py-3 flex gap-2.5 items-start mb-4">
                    <span className="text-base leading-none mt-0.5" aria-hidden>
                      ⚡
                    </span>
                    <p className="text-[11px] text-amber-800 font-medium leading-4 flex-1">
                      {notice}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3.5 rounded-2xl border border-gray-300 text-sm font-bold text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    className={`flex-[1.5] py-3.5 rounded-2xl text-sm font-bold shadow-md ${
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
