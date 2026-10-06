"use client";

import React, { useState } from "react";
import {
  FiCheck,
  FiDollarSign,
  FiLock,
  FiUser,
  FiAward,
  FiTrash2,
  FiAlertTriangle,
  FiLoader,
} from "react-icons/fi";
import { Member } from "@/utils/typesUtils";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useAuth } from "@/app/context/AuthContext";
import ProfileAvatar from "@/app/Components/ProfileAvatar";
import {
  getMemberChamaBalance,
  type EachMemberBalances,
} from "@/lib/memberBalances";

type Props = {
  members: Member[];
  eachMemberBalances?: EachMemberBalances;
  isPublic: boolean;
  /** Required contribution per cycle, in USDC */
  contributionAmount: number;
  canRemoveMember: boolean;
  /** Called after the admin confirms removal. Throw/reject to show an error in the modal. */
  onRemoveMember: (member: Member) => Promise<void> | void;
};

// Round to 6 decimals (USDC precision) so float noise doesn't break the comparison
const toUsdc = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6;
};

export default function MembersTab({
  members,
  eachMemberBalances,
  isPublic,
  contributionAmount,
  canRemoveMember,
  onRemoveMember,
}: Props) {
  const { user } = useAuth();
  const { formatBalance } = useFormattedBalance();
  const totalMembers = members?.length || 0;

  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // The current user is an admin if their own member entry has the Admin role
  const isCurrentUserAdmin = members?.some(
    (m) => m && m.id === user?.id && m.role === "Admin",
  );

  const closeModal = () => {
    if (isRemoving) return;
    setMemberToRemove(null);
    setRemoveError(null);
  };

  const confirmRemove = async () => {
    if (!memberToRemove || !onRemoveMember) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await onRemoveMember(memberToRemove);
      setMemberToRemove(null);
    } catch (err: any) {
      setRemoveError(
        err?.message || "Failed to remove member. Please try again.",
      );
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="pb-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-gray-900">Members</h3>
          <div className="flex items-center gap-1.5 text-gray-500">
            <FiUser size={14} />
            <span className="text-[12px]">{totalMembers} total</span>
          </div>
        </div>

        {totalMembers === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FiUser className="text-gray-400" size={22} />
            </div>
            <p className="text-gray-500 font-medium text-[14px]">
              No members yet
            </p>
            <p className="text-gray-400 text-[12px] mt-1">
              Members will appear here once they join
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {members.map((member) => {
              if (!member) return null;

              const isCurrentUser = member.id === user?.id;
              const addr = member.smartAddress || member.address || "";

              const memberBalance = getMemberChamaBalance(
                eachMemberBalances,
                addr,
              );

              // Compare in USDC: member's chama balance vs required contribution
              const balanceUsdc = toUsdc(memberBalance.balance);
              const requiredUsdc = toUsdc(contributionAmount);
              const hasPaid = requiredUsdc > 0 && balanceUsdc >= requiredUsdc;

              // Admin can remove anyone except themselves
              const canRemove = Boolean(
                member.role !== "Admin" && canRemoveMember,
              );

              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-xl border ${
                    isCurrentUser
                      ? "border-downy-600 bg-white"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <ProfileAvatar
                      src={member.profilePicture}
                      name={member.name}
                      size={44}
                      className="bg-downy-100 text-downy-700 flex-shrink-0"
                    />

                    {/* Member information */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <p
                          className={`text-[13px] font-semibold ${
                            isCurrentUser ? "text-emerald-600" : "text-gray-900"
                          }`}
                        >
                          {isCurrentUser ? "# You" : member.name || "Member"}
                        </p>

                        {member.role === "Admin" && (
                          <span className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                            <FiAward size={10} />
                            Admin
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[12px] text-gray-600">
                        <FiDollarSign size={12} className="text-gray-400" />
                        Balance: {formatBalance(memberBalance.balance || 0)}
                      </div>

                      {isPublic && (
                        <div className="flex items-center gap-1 text-[12px] text-amber-600 mt-0.5">
                          <FiLock size={12} />
                          Locked: {formatBalance(memberBalance.locked || 0)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {hasPaid && (
                        <div
                          className="bg-emerald-100 rounded-full p-1"
                          title={`Paid: ${balanceUsdc} / ${requiredUsdc} USDC`}
                        >
                          <FiCheck className="text-emerald-600" size={14} />
                        </div>
                      )}

                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveError(null);
                            setMemberToRemove(member);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                        >
                          <FiTrash2 size={11} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove confirmation modal */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FiAlertTriangle className="text-red-600" size={22} />
            </div>
            <h4 className="text-[16px] font-semibold text-gray-900 text-center">
              Remove member?
            </h4>
            <p className="text-[13px] text-gray-600 text-center mt-2">
              You are removing{" "}
              <span className="font-semibold text-gray-900">
                {memberToRemove.name || "this member"}
              </span>{" "}
              from this chama. Please confirm to continue.
            </p>

            {removeError && (
              <p className="text-[12px] text-red-600 text-center mt-3">
                {removeError}
              </p>
            )}

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={closeModal}
                disabled={isRemoving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={isRemoving}
                aria-label={isRemoving ? "Removing member" : "Confirm remove"}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center"
              >
                {isRemoving ? (
                  <FiLoader className="animate-spin" size={18} />
                ) : (
                  "Yes, remove"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
