"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiCheck, FiSearch, FiUser, FiX } from "react-icons/fi";
import { isAddress } from "viem";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { useSessionAddress } from "@/lib/useSessionAddress";
import { serverUrl } from "@/lib/serverUrl";
import { internalTransferFee } from "@/lib/transactionFees";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { withCommas, stripCommas } from "@/utils/amountInputUtils";
import {
  usdcToKes,
  kesToUsdcCeil,
  floorUsdc,
  ceilUsdc,
  toMicro,
} from "@/lib/kesMath";

/** Smallest external send. internalTransferFee() charges nothing below this, so it is also enforced. */
const MIN_EXTERNAL_USDC = 0.01;

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
  /** "floor" for what the user has (balance, max); "ceil" for what they pay (fee, total, minimum). */
  round: "ceil" | "floor" = "ceil"
) {
  if (kesMode && platformRate > 0) {
    const kes = usdcToKes(usdcAmount, platformRate, round);
    return `${kes.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} KES`;
  }
  const usdc =
    round === "floor" ? floorUsdc(usdcAmount, 3) : ceilUsdc(usdcAmount, 3);
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
  const { address: myAddress } = useSessionAddress();
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
        const users: SearchUser[] = data.success && data.users ? data.users : [];
        // you can't send to yourself, so never list your own account
        const me = myAddress?.toLowerCase();
        setResults(
          me ? users.filter((u) => u.smartAddress?.toLowerCase() !== me) : users
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, mode, isOpen, myAddress]);

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
  // KES -> USDC rounds UP to 6 decimals so the recipient never receives less than the KES typed
  const parsedAmount =
    kesMode && platformRate > 0
      ? kesToUsdcCeil(parsedDisplay, platformRate)
      : Math.round(parsedDisplay * 1e6) / 1e6;
  const fee =
    mode === "external" && parsedAmount > 0
      ? internalTransferFee(parsedAmount)
      : 0;
  const total = Math.round((parsedAmount + fee) * 1e6) / 1e6;

  // Smallest wallet balance that can make an external send: the minimum amount plus its own fee
  const minWithFeeUsdc =
    MIN_EXTERNAL_USDC + internalTransferFee(MIN_EXTERNAL_USDC);
  const belowMin =
    mode === "external" &&
    parsedAmount > 0 &&
    toMicro(parsedAmount) < toMicro(MIN_EXTERNAL_USDC);

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
    !belowMin &&
    toMicro(total) <= toMicro(balance);

  /**
   * Largest amount that can be sent, in the unit the user is typing: KES to the cent in KES mode,
   * USDC (6 decimals) otherwise. Amount + fee always fits the wallet.
   */
  const maxAmount = useMemo(() => {
    const balMicro = toMicro(balance);
    const feeOf = (usdc: number) =>
      mode === "external" ? internalTransferFee(usdc) : 0;
    const fits = (usdc: number) => toMicro(usdc + feeOf(usdc)) <= balMicro;

    // amount + fee only ever grows with the amount, so a binary search finds the exact largest
    // amount that fits. (The old stepping loops gave up after a few thousand tiny steps and could
    // stop short of a fee-bracket boundary, which is why Max did nothing for external wallets.)
    let best: number;
    if (kesMode && platformRate > 0) {
      let lo = 0; // KES cents
      let hi = Math.round(usdcToKes(balance, platformRate, "floor") * 100);
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(kesToUsdcCeil(mid / 100, platformRate))) lo = mid;
        else hi = mid - 1;
      }
      best = lo / 100;
      // an external send below the minimum is not allowed, so there is no usable max
      if (mode === "external" && kesToUsdcCeil(best, platformRate) < MIN_EXTERNAL_USDC)
        best = 0;
    } else {
      let lo = 0; // micro-USDC
      let hi = balMicro;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(mid / 1e6)) lo = mid;
        else hi = mid - 1;
      }
      best = lo / 1e6;
      if (mode === "external" && best < MIN_EXTERNAL_USDC) best = 0;
    }
    return best;
  }, [kesMode, platformRate, mode, balance]);

  const applyMax = () => {
    if (maxAmount <= 0) {
      // tell the user why Max did nothing instead of silently leaving the field empty
      showToast(
        mode === "external"
          ? `Your balance is too low for an external send. You need at least ${minTotalLabel}.`
          : "Your balance is too low to send.",
        "warning",
      );
      return;
    }
    setAmount(
      maxAmount > 0
        ? kesMode
          ? String(Number(maxAmount.toFixed(2)))
          : String(Number(maxAmount.toFixed(6)))
        : "",
    );
  };

  // ---- feedback for the user -------------------------------------------------------------
  const overBalance = parsedAmount > 0 && toMicro(total) > toMicro(balance);
  // the amount ALONE is more than the wallet holds (vs. amount fits but amount + fee does not)
  const exceedsBalance = parsedAmount > 0 && toMicro(parsedAmount) > toMicro(balance);
  const maxLabel =
    kesMode && platformRate > 0
      ? `${maxAmount.toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} KES`
      : `${floorUsdc(maxAmount, 3).toLocaleString("en-US", {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })} USDC`;
  const feeLabel = formatInUnit(fee, kesMode, platformRate, "ceil");
  const minSendLabel = formatInUnit(
    MIN_EXTERNAL_USDC,
    kesMode,
    platformRate,
    "ceil",
  );
  // Total = what the user typed + the fee, added in the unit they are using. It must never be
  // re-converted from USDC and rounded up: that is what showed 0.16 under an amount of 0.15.
  const totalLabel =
    kesMode && platformRate > 0
      ? `${(
          (Math.round(parsedDisplay * 100) +
            Math.round(usdcToKes(fee, platformRate, "ceil") * 100)) /
          100
        ).toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} KES`
      : `${total.toLocaleString("en-US", {
          minimumFractionDigits: 3,
          maximumFractionDigits: 6,
        })} USDC`;
  const minTotalLabel = formatInUnit(
    minWithFeeUsdc,
    kesMode,
    platformRate,
    "ceil",
  );

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
    if (belowMin) {
      showToast("Below the minimum amount for external wallets", "warning");
      return;
    }
    if (toMicro(total) > toMicro(balance)) {
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
          // 6 decimals (USDC's real precision). 3 decimals cut up to 0.001 USDC (~0.13 KES) off
          // the balance. The /user/sendUSDC route must accept 6 decimals for amount and fee.
          amount: parsedAmount.toFixed(6),
          fee: fee.toFixed(6),
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
                Chamapay user
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
                External wallet
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
                  value={withCommas(amount)}
                  onChange={(e) => {
                    const v = stripCommas(e.target.value);
                    // decimals are allowed in both units: KES to the cent, USDC to 6 places
                    const ok = kesMode
                      ? /^\d*\.?\d{0,2}$/.test(v)
                      : /^\d*\.?\d{0,6}$/.test(v);
                    if (v === "" || ok) setAmount(v);
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
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                <p className="text-gray-500">
                  Available balance{" "}
                  <span className="font-semibold text-gray-800">
                    {formatInUnit(balance, kesMode, platformRate, "floor")}
                  </span>
                </p>
                {mode === "external" && (
                  <p
                    className={belowMin ? "text-red-600 font-medium" : "text-gray-500"}
                  >
                    Min{" "}
                    <span className="font-semibold">
                      {formatInUnit(minWithFeeUsdc, kesMode, platformRate, "ceil")}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {overBalance && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {exceedsBalance ? (
                  // the amount alone is already more than the wallet holds
                  "Amount exceeds your balance."
                ) : maxAmount > 0 ? (
                  // the amount fits the balance, but the network fee on top does not
                  <>
                    You have enough for this amount, but not for the {feeLabel}{" "}
                    network fee on top of it. Try {maxLabel} or less.{" "}
                    <button
                      type="button"
                      onClick={applyMax}
                      className="font-bold underline bg-transparent"
                    >
                      Use {maxLabel}
                    </button>
                  </>
                ) : (
                  `Your balance is too low to cover the network fee. You need at least ${minTotalLabel}.`
                )}
              </div>
            )}
            {!overBalance && belowMin && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                The minimum send to an external wallet is {minSendLabel} (
                {minTotalLabel} with the fee).
              </div>
            )}
            {!overBalance && !belowMin && parsedAmount > 0 && !recipientReady && (
              <p className="text-[11px] text-amber-700 font-medium">
                {mode === "chamapay"
                  ? "Select a Chamapay user to continue."
                  : "Enter a valid wallet address to continue."}
              </p>
            )}

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
                  <span>{totalLabel}</span>
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