"use client";

import React from "react";
import { FiCheck, FiDollarSign, FiLock, FiUser, FiAward } from "react-icons/fi";
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
  contributionAmount?: number;
};

export default function MembersTab({
  members,
  eachMemberBalances,
  isPublic,
  contributionAmount = 0,
}: Props) {
  const { user } = useAuth();
  const { formatBalance } = useFormattedBalance();
  const totalMembers = members?.length || 0;

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
            <p className="text-gray-500 font-medium text-[14px]">No members yet</p>
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
                addr
              );
              const hasPaid =
                contributionAmount > 0 &&
                memberBalance.balance >= contributionAmount;

              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-xl border relative ${
                    isCurrentUser
                      ? "border-downy-600 bg-white"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {hasPaid && (
                    <div className="absolute top-3 right-3 bg-emerald-100 rounded-full p-1">
                      <FiCheck className="text-emerald-600" size={14} />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      src={member.profilePicture}
                      name={member.name}
                      size={44}
                      className="bg-downy-100 text-downy-700"
                    />
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
