"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiCheck, FiUser, FiUserPlus, FiX } from "react-icons/fi";
import { addMemberToChama, searchUsers } from "@/lib/chamaService";
import { useAuth } from "@/app/context/AuthContext";
import { showToast } from "./Toast";
import ProfileAvatar from "./ProfileAvatar";

type SearchUser = {
  id: number;
  userName: string;
  email: string;
  address?: string;
  profileImageUrl: string | null;
  isMember?: boolean;
};

export default function ChamaAddMemberModal({
  open,
  onClose,
  onSuccess,
  chamaId,
  isPublic,
  contribution,
  memberIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  chamaId: number;
  isPublic: boolean;
  contribution: number | string;
  memberIds?: number[];
}) {
  const { user, token } = useAuth();
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchDoneFor, setSearchDoneFor] = useState("");
  const [selected, setSelected] = useState<SearchUser | null>(null);
  const [adding, setAdding] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setResults([]);
      setShowResults(false);
      setSelected(null);
      setSearchDoneFor("");
      setSearching(false);
      setAdding(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = username.trim();

    if (q.length < 2) {
      reqId.current += 1;
      setResults([]);
      setShowResults(false);
      setSearching(false);
      setSearchDoneFor("");
      return;
    }

    if (selected && username === selected.userName) {
      setSearching(false);
      return;
    }

    const id = ++reqId.current;
    setSearching(true);
    setSearchDoneFor("");
    setResults([]);
    setShowResults(false);

    const timeoutId = setTimeout(async () => {
      try {
        const result = await searchUsers(q);
        if (id !== reqId.current) return;
        if (result.success && result.users) {
          const filtered = result.users
            .filter((u) => u.id !== user?.id)
            .map((u) => ({
              ...u,
              isMember: memberIds.includes(u.id),
            }));
          setResults(filtered);
          setShowResults(filtered.length > 0);
        } else {
          setResults([]);
          setShowResults(false);
        }
        setSearchDoneFor(q);
      } catch {
        if (id !== reqId.current) return;
        setResults([]);
        setShowResults(false);
        setSearchDoneFor(q);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare memberIds by value
  }, [username, selected, user?.id, open, memberIds.join(",")]);

  const handleAdd = async () => {
    if (!selected || selected.isMember) {
      showToast("Select a user from search results", "warning");
      return;
    }
    if (!token || token === "guest") {
      showToast("Please sign in", "warning");
      return;
    }
    setAdding(true);
    try {
      const result = await addMemberToChama(
        chamaId,
        isPublic,
        selected.id,
        String(contribution),
        token
      );
      if (!result.success) {
        showToast(result.error || "Failed to add member", "error");
        return;
      }
      showToast(`@${selected.userName} added successfully`, "success");
      onSuccess?.();
      onClose();
    } catch {
      showToast("Failed to add member", "error");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <div className="app-modal-layer">
      <div className="app-modal-backdrop" onClick={onClose} />
      <div className="app-modal-sheet bg-white max-h-[90%] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="bg-emerald-50 border-b border-emerald-100 px-5 pt-3.5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-11 w-11 rounded-full bg-white border border-emerald-100 flex items-center justify-center shrink-0">
              <FiUserPlus className="text-emerald-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[17px] font-bold text-gray-900 leading-tight">
                Add Member
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Already on Chamapay
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white border border-emerald-100 flex items-center justify-center shrink-0"
              aria-label="Close"
            >
              <FiX size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-4 pb-1">
          <p className="text-[12px] font-semibold text-gray-600 mb-2">
            Search by username
          </p>

          <div className="relative mb-3">
            <div className="flex items-center h-[46px] rounded-xl border border-gray-200 bg-gray-50 px-3">
              <span className="text-[15px] font-semibold text-emerald-600 mr-1.5">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSelected(null);
                  setSearchDoneFor("");
                }}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="flex-1 text-[14px] text-gray-900 border-0 outline-none bg-transparent"
              />
              {searching && (
                <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              )}
            </div>

            {searching && (
              <div className="mt-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 flex items-center justify-center gap-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <span className="text-[12px] text-gray-500 font-medium">
                  Searching…
                </span>
              </div>
            )}

            {!searching && showResults && results.length > 0 && (
              <div className="mt-2 rounded-xl border border-gray-100 bg-white overflow-hidden max-h-40 overflow-y-auto">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!!u.isMember}
                    onClick={() => {
                      if (u.isMember) return;
                      setSelected(u);
                      setUsername(u.userName);
                      setShowResults(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-50 last:border-0 text-left ${
                      u.isMember
                        ? "bg-slate-50 opacity-70 cursor-not-allowed"
                        : "hover:bg-emerald-50"
                    }`}
                  >
                    <ProfileAvatar
                      src={u.profileImageUrl}
                      name={u.userName}
                      size={36}
                      className={
                        u.isMember
                          ? "bg-slate-200 text-slate-400"
                          : "bg-emerald-100 text-emerald-600"
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-[13px] truncate ${
                          u.isMember ? "text-slate-400" : "text-gray-900"
                        }`}
                      >
                        @{u.userName}
                      </p>
                      {u.isMember && (
                        <p className="text-[11px] text-slate-400">
                          Already a member
                        </p>
                      )}
                    </div>
                    {u.isMember && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 uppercase shrink-0">
                        Member
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {username.trim().length >= 2 &&
              !searching &&
              !selected &&
              results.length === 0 &&
              searchDoneFor === username.trim() && (
                <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                  <p className="text-red-600 text-[12px] font-medium text-center">
                    User not found
                  </p>
                </div>
              )}
          </div>

          {selected && !selected.isMember && (
            <div className="mb-3 flex items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
              <FiUser className="text-emerald-600 shrink-0" size={14} />
              <p className="ml-2 flex-1 font-semibold text-emerald-800 text-[13px] truncate">
                @{selected.userName}
              </p>
              <FiCheck className="text-emerald-600 shrink-0" size={16} />
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={!selected || adding}
            className={`w-full h-11 rounded-xl text-[14px] font-bold ${
              selected && !adding
                ? "bg-downy-600 text-white"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            {adding ? "Adding…" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}
