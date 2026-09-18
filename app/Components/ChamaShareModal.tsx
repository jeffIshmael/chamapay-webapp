"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiCheck, FiLink, FiShare2, FiUser, FiX } from "react-icons/fi";
import { searchUsers, shareChamaLink } from "@/lib/chamaService";
import { generateChamaShareUrl } from "@/lib/encryption";
import { useAuth } from "@/app/context/AuthContext";
import { showToast } from "./Toast";
import ProfileAvatar from "./ProfileAvatar";

type ShareUser = {
  id: number;
  userName: string;
  email: string;
  address?: string;
  profileImageUrl: string | null;
  isMember?: boolean;
};

export default function ChamaShareModal({
  open,
  onClose,
  chamaName,
  chamaSlug,
  memberIds = [],
}: {
  open: boolean;
  onClose: () => void;
  chamaName: string;
  chamaSlug: string;
  memberIds?: number[];
}) {
  const { user, token } = useAuth();
  const [shareUsername, setShareUsername] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState<ShareUser[]>([]);
  const [isShareSearching, setIsShareSearching] = useState(false);
  const [showShareSearchResults, setShowShareSearchResults] = useState(false);
  const [shareSearchDoneFor, setShareSearchDoneFor] = useState("");
  const [selectedShareUser, setSelectedShareUser] = useState<ShareUser | null>(
    null
  );
  const [sendingLink, setSendingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareSearchReqId = useRef(0);

  useEffect(() => {
    if (!open) {
      setShareUsername("");
      setShareSearchResults([]);
      setShowShareSearchResults(false);
      setSelectedShareUser(null);
      setShareSearchDoneFor("");
      setIsShareSearching(false);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = shareUsername.trim();

    if (q.length < 2) {
      shareSearchReqId.current += 1;
      setShareSearchResults([]);
      setShowShareSearchResults(false);
      setIsShareSearching(false);
      setShareSearchDoneFor("");
      return;
    }

    if (selectedShareUser && shareUsername === selectedShareUser.userName) {
      setIsShareSearching(false);
      return;
    }

    const reqId = ++shareSearchReqId.current;
    setIsShareSearching(true);
    setShareSearchDoneFor("");
    setShareSearchResults([]);
    setShowShareSearchResults(false);

    const timeoutId = setTimeout(async () => {
      try {
        const result = await searchUsers(q);
        if (reqId !== shareSearchReqId.current) return;
        if (result.success && result.users) {
          const filtered = result.users
            .filter((u) => u.id !== user?.id)
            .map((u) => ({
              ...u,
              isMember: memberIds.includes(u.id),
            }));
          setShareSearchResults(filtered);
          setShowShareSearchResults(filtered.length > 0);
        } else {
          setShareSearchResults([]);
          setShowShareSearchResults(false);
        }
        setShareSearchDoneFor(q);
      } catch {
        if (reqId !== shareSearchReqId.current) return;
        setShareSearchResults([]);
        setShowShareSearchResults(false);
        setShareSearchDoneFor(q);
      } finally {
        if (reqId === shareSearchReqId.current) setIsShareSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    shareUsername,
    selectedShareUser,
    user?.id,
    open,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by value
    memberIds.join(","),
  ]);

  const inviteUrl = generateChamaShareUrl(chamaSlug);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      showToast("Invite link copied", "success");
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1000);
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const shareToUser = async () => {
    if (!selectedShareUser || selectedShareUser.isMember) {
      showToast("Select a user from search results", "warning");
      return;
    }
    if (!user || !token || token === "guest") {
      showToast("Please sign in to share", "warning");
      return;
    }
    setSendingLink(true);
    try {
      const result = await shareChamaLink(
        user.userName || "Someone",
        selectedShareUser.id,
        chamaSlug,
        token
      );
      if (!result.success) {
        showToast("Unable to send the link", "error");
        return;
      }
      showToast(`Shared with @${selectedShareUser.userName}`, "success");
      onClose();
    } catch {
      showToast("Unable to send the link", "error");
    } finally {
      setSendingLink(false);
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
              <FiShare2 className="text-emerald-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[17px] font-bold text-gray-900 leading-tight">
                Share Chama
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Invite others to join{chamaName ? ` ${chamaName}` : ""}
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
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center rounded-2xl border-[1.5px] border-emerald-200 bg-white px-3 py-3 text-left"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <FiLink className="text-emerald-600" size={18} />
            </div>
            <div className="flex-1 ml-3 mr-3 min-w-0">
              <p className="font-semibold text-gray-900 text-[13px]">
                Copy invite link
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">Share anywhere</p>
            </div>
            <span className="bg-downy-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shrink-0">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>

          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="mx-2.5 text-[10px] font-semibold tracking-wide text-gray-400">
              OR SEND IN-APP
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <p className="text-[12px] font-semibold text-gray-600 mb-2">
            Share to a Chamapay user
          </p>

          <div className="relative mb-3">
            <div className="flex items-center h-[46px] rounded-xl border border-gray-200 bg-gray-50 px-3">
              <span className="text-[15px] font-semibold text-emerald-600 mr-1.5">
                @
              </span>
              <input
                type="text"
                value={shareUsername}
                onChange={(e) => {
                  setShareUsername(e.target.value);
                  setSelectedShareUser(null);
                  setShareSearchDoneFor("");
                }}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="flex-1 text-[14px] text-gray-900 border-0 outline-none bg-transparent"
              />
              {isShareSearching && (
                <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              )}
            </div>

            {isShareSearching && (
              <div className="mt-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 flex items-center justify-center gap-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <span className="text-[12px] text-gray-500 font-medium">
                  Searching…
                </span>
              </div>
            )}

            {!isShareSearching &&
              showShareSearchResults &&
              shareSearchResults.length > 0 && (
                <div className="mt-2 rounded-xl border border-gray-100 bg-white overflow-hidden max-h-40 overflow-y-auto">
                  {shareSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!!u.isMember}
                      onClick={() => {
                        if (u.isMember) return;
                        setSelectedShareUser(u);
                        setShareUsername(u.userName);
                        setShowShareSearchResults(false);
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

            {shareUsername.trim().length >= 2 &&
              !isShareSearching &&
              !selectedShareUser &&
              shareSearchResults.length === 0 &&
              shareSearchDoneFor === shareUsername.trim() && (
                <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                  <p className="text-red-600 text-[12px] font-medium text-center">
                    User not found
                  </p>
                </div>
              )}
          </div>

          {selectedShareUser && !selectedShareUser.isMember && (
            <div className="mb-3 flex items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
              <FiUser className="text-emerald-600 shrink-0" size={14} />
              <p className="ml-2 flex-1 font-semibold text-emerald-800 text-[13px] truncate">
                @{selectedShareUser.userName}
              </p>
              <FiCheck className="text-emerald-600 shrink-0" size={16} />
            </div>
          )}

          <button
            type="button"
            onClick={shareToUser}
            disabled={!selectedShareUser || sendingLink}
            className={`w-full h-11 rounded-xl text-[14px] font-bold ${
              selectedShareUser && !sendingLink
                ? "bg-downy-600 text-white"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            {sendingLink ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
