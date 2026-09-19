"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiCheck, FiSearch, FiUser, FiX } from "react-icons/fi";
import { isAddress } from "viem";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { serverUrl } from "@/lib/serverUrl";
import { internalTransferFee, maxSendableWithTransferFee } from "@/lib/transactionFees";
import { useCurrencyStore } from "@/store/useCurrencyStore";

type SendMode = "chamapay" | "external";

type SearchUser = {
  id: number;
  userName: string;
  email: string;
  smartAddress: string;
  profileImageUrl: string | null;
};

/** Format a USDC amount using the modal’s KES/USDC toggle (not the app-wide preference). */
function formatInUnit(
  usdcAmount: number,
  kesMode: boolean,
  platformRate: number,
  /** Floor for withdrawable/max so reverse conversion never overshoots balance. */
  round: "ceil" | "floor" = "ceil"
) {
  if (kesMode && platformRate > 0) {
    const raw = usdcAmount * platformRate;
    const kes =
      round === "floor"
        ? Math.floor(raw * 100) / 100
        : Math.ceil(raw * 100) / 100;
    return `${kes.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} KES`;
  }
  const usdc = Math.round(usdcAmount * 1000) / 1000;
  return `${usdc.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} USDC`;
}

export default function SendModal({
  isOpen,
  onClose,
  balance,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onSuccess?: () => void;
}) {
  const { token, isAuthenticated } = useAuth();
  const { currency, platformRate } = useCurrencyStore();
  const [mode, setMode] = useState<SendMode>("chamapay");
  const [kesMode, setKesMode] = useState(currency === "KES");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKesMode(currency === "KES");
  }, [isOpen, currency]);

  useEffect(() => {
    if (!isOpen || mode !== "chamapay") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${serverUrl}/user/search?query=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setResults(data.success && data.users ? data.users : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, mode, isOpen]);

  const reset = () => {
    setMode("chamapay");
    setQuery("");
    setResults([]);
    setSelected(null);
    setRecipient("");
    setAmount("");
    setSending(false);
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const parsedDisplay = parseFloat(amount) || 0;
  const parsedAmount =
    kesMode && platformRate > 0
      ? parsedDisplay / platformRate
      : parsedDisplay;
  const fee =
    mode === "external" && parsedAmount > 0
      ? internalTransferFee(parsedAmount)
      : 0;
  const total = parsedAmount + fee;

  /** Max USDC the user can actually send (fee reserved for external). */
  const withdrawableUsdc = useMemo(() => {
    if (mode === "external") return maxSendableWithTransferFee(balance);
    return Math.floor(Math.max(0, balance) * 1000) / 1000;
  }, [mode, balance]);

  const reservedFeeUsdc =
    mode === "external" ? Math.max(0, balance - withdrawableUsdc) : 0;

  const externalAddressOk = useMemo(
    () => isAddress(recipient.trim() as `0x${string}`),
    [recipient]
  );
  const recipientReady =
    mode === "chamapay"
      ? Boolean(selected?.smartAddress && isAddress(selected.smartAddress))
      : externalAddressOk;
  const canSend =
    !sending &&
    recipientReady &&
    parsedAmount > 0 &&
    total <= balance + 0.0000001;

  const applyMax = () => {
    let maxUsdc = withdrawableUsdc;
    if (kesMode && platformRate > 0) {
      // Floor KES so amount/rate + fee never exceeds wallet after conversion.
      let kes = Math.floor(maxUsdc * platformRate * 100) / 100;
      // Nudge down if float reverse-conversion still overshoots.
      for (let i = 0; i < 5; i++) {
        const usdc = kes / platformRate;
        const f = mode === "external" ? internalTransferFee(usdc) : 0;
        if (usdc + f <= balance + 1e-9) break;
        kes = Math.floor((kes - 0.01) * 100) / 100;
      }
      setAmount(kes > 0 ? kes.toFixed(2) : "");
      return;
    }
    // Ensure Max still fits after fee (USDC mode).
    while (maxUsdc > 0) {
      const f = mode === "external" ? internalTransferFee(maxUsdc) : 0;
      if (maxUsdc + f <= balance + 1e-9) break;
      maxUsdc = Math.floor((maxUsdc - 0.001) * 1000) / 1000;
    }
    setAmount(maxUsdc > 0 ? maxUsdc.toFixed(3) : "");
  };

  const handleSend = async () => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in", "warning");
      return;
    }

    const to =
      mode === "chamapay" ? selected?.smartAddress : recipient.trim();

    if (!to || !isAddress(to as `0x${string}`)) {
      showToast(
        mode === "chamapay"
          ? "Select a Chamapay user"
          : "Enter a valid wallet address",
        "warning"
      );
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      showToast("Enter a valid amount", "warning");
      return;
    }
    if (total > balance) {
      showToast("Insufficient balance (including fee)", "error");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${serverUrl}/user/sendUSDC`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiver: to,
          amount: parsedAmount.toFixed(3),
          fee: fee.toFixed(3),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || "Send failed");
      }
      showToast("Sent successfully", "success");
      onSuccess?.();
      reset();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-[100]">
      <div className="app-modal-layer !pointer-events-auto">
        <div className="app-modal-backdrop" aria-hidden="true" />
        <Dialog.Panel className="app-modal-sheet bg-downy-50 max-h-[92%] flex flex-col overflow-hidden">
          <div
            className="shrink-0 text-white px-4 pt-3 pb-4 rounded-t-3xl"
            style={{ backgroundColor: "#1a6b6b" }}
          >
            <div className="flex items-center justify-between min-h-[40px]">
              <div className="w-8" />
              <Dialog.Title className="text-[15px] font-bold">Send</Dialog.Title>
              <button
                type="button"
                onClick={close}
                disabled={sending}
                className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-50"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
            <div className="flex bg-white rounded-xl p-0.5 border border-downy-100">
              <button
                type="button"
                onClick={() => {
                  setMode("chamapay");
                  setRecipient("");
                }}
                className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold ${
                  mode === "chamapay"
                    ? "bg-downy-600 text-white"
                    : "bg-transparent text-gray-500"
                }`}
              >
                Chamapay
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("external");
                  setSelected(null);
                  setQuery("");
                  setResults([]);
                }}
                className={`flex-1 py-2 rounded-[10px] text-[12px] font-semibold ${
                  mode === "external"
                    ? "bg-downy-600 text-white"
                    : "bg-transparent text-gray-500"
                }`}
              >
                External
              </button>
            </div>

            {mode === "chamapay" ? (
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                  Find user
                </label>
                {selected ? (
                  <div className="flex items-center justify-between bg-white border border-downy-100 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-8 w-8 rounded-full bg-downy-100 text-downy-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {selected.userName.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 truncate">
                          {selected.userName}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {selected.smartAddress.slice(0, 10)}…
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-gray-400 bg-transparent p-1"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <FiSearch
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={14}
                      />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Username"
                        className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
                      />
                    </div>
                    {searching && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Searching…
                      </p>
                    )}
                    {results.length > 0 && (
                      <div className="mt-1.5 bg-white border border-downy-100 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                        {results.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelected(u);
                              setQuery("");
                              setResults([]);
                            }}
                            className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-downy-50 border-b border-gray-50 last:border-0 bg-transparent"
                          >
                            <FiUser className="text-downy-600 shrink-0" size={14} />
                            <p className="text-[12px] font-bold text-gray-900 truncate">
                              @{u.userName}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className="text-[10px] text-emerald-700 mt-1.5 font-medium">
                  Transfers to Chamapay users are free
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                  Wallet address (Base / Binance / OKX / MetaMask…)
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  placeholder="0x…"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={`w-full rounded-xl border px-3 py-2.5 text-[13px] font-mono outline-none focus:ring-2 focus:ring-downy-500 ${
                    recipient.length > 0 && !externalAddressOk
                      ? "border-rose-300 bg-rose-50/40"
                      : externalAddressOk
                        ? "border-emerald-300 bg-emerald-50/30"
                        : "border-gray-200"
                  }`}
                />
                {recipient.length === 0 && (
                  <p className="text-[10px] text-amber-700 mt-1.5">
                    External sends include a small network fee
                  </p>
                )}
                {recipient.length > 0 && !externalAddressOk && (
                  <p className="text-[10px] text-rose-600 mt-1.5 font-medium">
                    Not a valid wallet address
                  </p>
                )}
                {externalAddressOk && (
                  <p className="text-[10px] text-emerald-700 mt-1.5 font-semibold inline-flex items-center gap-1">
                    <FiCheck size={12} />
                    Wallet verified — address looks good
                  </p>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-gray-600">
                  Amount ({kesMode ? "KES" : "USDC"})
                </label>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setKesMode(true)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                    }`}
                  >
                    KES
                  </button>
                  <button
                    type="button"
                    onClick={() => setKesMode(false)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      !kesMode ? "bg-downy-600 text-white" : "text-gray-500"
                    }`}
                  >
                    USDC
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                  }}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-14 text-[15px] font-bold outline-none focus:ring-2 focus:ring-downy-500"
                />
                <button
                  type="button"
                  onClick={applyMax}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-downy-700 bg-transparent"
                >
                  Max
                </button>
              </div>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-[11px] text-gray-500">
                  {mode === "external" ? "Withdrawable " : "Available "}
                  <span className="font-semibold text-gray-800">
                    {formatInUnit(
                      withdrawableUsdc,
                      kesMode,
                      platformRate,
                      "floor"
                    )}
                  </span>
                </p>
                {mode === "external" && (
                  <p className="text-[10px] text-gray-400">
                    Wallet{" "}
                    {formatInUnit(balance, kesMode, platformRate, "floor")}
                    {reservedFeeUsdc > 0
                      ? ` · fee reserved ≈ ${formatInUnit(
                          reservedFeeUsdc,
                          kesMode,
                          platformRate,
                          "ceil"
                        )}`
                      : withdrawableUsdc <= 0
                        ? " · balance too low after network fee"
                        : ""}
                  </p>
                )}
              </div>
            </div>

            {parsedAmount > 0 && (
              <div className="bg-white rounded-xl border border-downy-100 px-3 py-2.5 text-[11px] space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Fee</span>
                  <span className="font-semibold">
                    {fee === 0
                      ? "Free"
                      : formatInUnit(fee, kesMode, platformRate)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold">
                  <span>Total</span>
                  <span>{formatInUnit(total, kesMode, platformRate)}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 ${
                !canSend
                  ? "bg-gray-300"
                  : "bg-downy-600 shadow-md shadow-downy-600/25"
              }`}
            >
              {sending ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Sending…
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
