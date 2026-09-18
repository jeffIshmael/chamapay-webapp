"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiCheck, FiLink, FiUserPlus, FiX } from "react-icons/fi";
import { searchUsers } from "@/lib/chamaService";
import { addGoalMember } from "@/lib/goalService";
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

/**
 * Invite / add members — same idea as chama share + add:
 * search a username to add them, or copy an invite link.
 * Pay link (contribute without joining) lives separately on the goal page.
 */
export default function GoalAddMemberModal({
  open,
  onClose,
  onSuccess,
  goalId,
  goalName,
  inviteLink,
  memberIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  goalId: number;
  goalName: string;
  inviteLink: string;
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
  const [copied, setCopied] = useState(false);
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
      setCopied(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await addGoalMember(goalId, selected.id, token);
      if (!result.success) {
        showToast(result.error || "Failed to add member", "error");
        return;
      }
      showToast(`@${selected.userName} added to the goal`, "success");
      onSuccess?.();
      onClose();
    } catch {
      showToast("Failed to add member", "error");
    } finally {
      setAdding(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast("Invite link copied", "success");
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 900);
    } catch {
      showToast("Could not copy link", "error");
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
                Invite & add
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                {goalName}
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

        <div className="px-5 pt-4 pb-5">
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
                className="flex-1 bg-transparent outline-none text-[14px] text-gray-900"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {searching && (
                <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              )}
            </div>

            {showResults && (
              <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={u.isMember}
                      onClick={() => {
                        setSelected(u);
                        setUsername(u.userName);
                        setShowResults(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left ${
                        u.isMember ? "opacity-50" : "hover:bg-emerald-50"
                      }`}
                    >
                      <ProfileAvatar
                        src={u.profileImageUrl}
                        name={u.userName}
                        size={36}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-gray-900 truncate">
                          @{u.userName}
                        </span>
                        {u.isMember && (
                          <span className="text-[10px] text-emerald-600 font-medium">
                            Already a member
                          </span>
                        )}
                      </span>
                      {selected?.id === u.id && (
                        <FiCheck className="text-emerald-600" size={16} />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {searchDoneFor && !searching && results.length === 0 && (
            <p className="text-[11px] text-gray-500 mb-2">
              No users found for “{searchDoneFor}”
            </p>
          )}

          <button
            type="button"
            disabled={!selected || selected.isMember || adding}
            onClick={() => void handleAdd()}
            className="w-full py-3 rounded-xl bg-downy-600 text-white text-[13px] font-bold disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
          >
            {adding ? (
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              "Add member"
            )}
          </button>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-[12px] text-gray-500 mb-2 leading-relaxed">
              Or copy an invite link so someone can join this goal as a member.
            </p>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 bg-gray-50 text-[13px] font-bold text-gray-800"
            >
              {copied ? (
                <>
                  <FiCheck size={15} className="text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <FiLink size={15} />
                  Copy invite link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
