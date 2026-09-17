"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiArrowLeft, FiSearch, FiUser, FiX } from "react-icons/fi";
import { showToast } from "./Toast";
import { useAuth } from "@/app/context/AuthContext";
import { serverUrl } from "@/lib/serverUrl";
import { internalTransferFee } from "@/lib/transactionFees";

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
  const [mode, setMode] = useState<SendMode>("chamapay");
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

  const parsedAmount = parseFloat(amount) || 0;
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
      mode === "chamapay"
        ? selected?.smartAddress
        : recipient.trim();

    if (!to || !to.startsWith("0x") || to.length !== 42) {
      showToast(
        mode === "chamapay"
          ? "Select a ChamaPay user"
          : "Enter a valid wallet address",
        "warning"
      );
      return;
    }
    if (parsedAmount <= 0) {
      showToast("Enter a valid amount", "warning");
      return;
    }
    if (total > balance) {
      showToast("Insufficient balance (including fee)", "warning");
      return;
    }

    try {
      setSending(true);
      const response = await fetch(`${serverUrl}/user/sendUSDC`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiver: to,
          amount: parsedAmount.toFixed(3),
          fee,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        showToast(data?.message || data?.error || "Unable to send", "error");
        return;
      }
      showToast(`${parsedAmount.toFixed(3)} USDC sent`, "success");
      onSuccess?.();
      reset();
      onClose();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Send failed",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={close} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center">
        <Dialog.Panel className="w-full max-w-[var(--app-max)] max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-downy-50 shadow-xl">
          <div className="sticky top-0 z-10 bg-gradient-to-br from-downy-800 to-emerald-900 text-white px-4 pt-3 pb-4 rounded-t-3xl">
            <div className="flex items-center gap-3 min-h-[40px]">
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"
              >
                <FiArrowLeft size={16} />
              </button>
              <Dialog.Title className="text-[15px] font-bold flex-1 text-center pr-8">
                Send
              </Dialog.Title>
            </div>
            <p className="text-[11px] text-white/75 text-center mt-1">
              Balance {balance.toFixed(3)} USDC
            </p>
          </div>

          <div className="px-4 py-4 space-y-3">
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
                ChamaPay
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
                        placeholder="Username or email"
                        className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-downy-500"
                      />
                    </div>
                    {searching && (
                      <p className="text-[11px] text-gray-400 mt-1.5">Searching…</p>
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
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-gray-900 truncate">
                                {u.userName}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate">
                                {u.email}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className="text-[10px] text-emerald-700 mt-1.5 font-medium">
                  Transfers to ChamaPay users are free
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                  Wallet address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] font-mono outline-none focus:ring-2 focus:ring-downy-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                Amount (USDC)
              </label>
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
                    const max =
                      mode === "external"
                        ? Math.max(0, balance - internalTransferFee(balance))
                        : balance;
                    setAmount(max.toFixed(3));
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
                    {fee === 0 ? "Free" : `${fee.toFixed(2)} USDC`}
                  </span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold">
                  <span>Total</span>
                  <span>{total.toFixed(3)} USDC</span>
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
              {sending ? "Sending…" : "Send USDC"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
