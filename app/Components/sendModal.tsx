"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiSearch, FiUser, FiX } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { serverUrl } from "@/lib/serverUrl";
import { internalTransferFee } from "@/lib/transactionFees";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { useFormattedBalance } from "@/lib/useFormattedBalance";

type SendMode = "chamapay" | "external";

type SearchUser = {
  id: number;
  userName: string;
  email: string;
  smartAddress: string;
  profileImageUrl: string | null;
};

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
  const { formatBalance } = useFormattedBalance();
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

  const handleSend = async () => {
    if (!isAuthenticated || !token) {
      showToast("Please sign in", "warning");
      return;
    }

    const to =
      mode === "chamapay" ? selected?.smartAddress : recipient.trim();

    if (!to || !to.startsWith("0x") || to.length !== 42) {
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
                className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
            <p className="text-[11px] text-white/75 text-center mt-1">
              Balance {formatBalance(balance)}
            </p>
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
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] font-mono outline-none focus:ring-2 focus:ring-downy-500"
                />
                <p className="text-[10px] text-amber-700 mt-1.5">
                  External sends include a small network fee
                </p>
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
                  onClick={() => {
                    const maxUsdc =
                      mode === "external"
                        ? Math.max(0, balance - internalTransferFee(balance))
                        : balance;
                    setAmount(
                      kesMode
                        ? (maxUsdc * platformRate).toFixed(2)
                        : maxUsdc.toFixed(3)
                    );
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-downy-700 bg-transparent"
                >
                  Max
                </button>
              </div>
            </div>

            {parsedAmount > 0 && (
              <div className="bg-white rounded-xl border border-downy-100 px-3 py-2.5 text-[11px] space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Fee</span>
                  <span className="font-semibold">
                    {fee === 0 ? "Free" : formatBalance(fee)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold">
                  <span>Total</span>
                  <span>{formatBalance(total)}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !amount}
              className={`w-full py-3 rounded-xl text-[13px] font-bold text-white ${
                sending || !amount
                  ? "bg-gray-300"
                  : "bg-downy-600 shadow-md shadow-downy-600/25"
              }`}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
