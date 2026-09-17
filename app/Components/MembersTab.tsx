"use client";

import React from "react";
import { FiCheck, FiDollarSign, FiLock, FiUser, FiAward } from "react-icons/fi";
import { formatUnits } from "viem";
import { Member } from "@/utils/typesUtils";
import { useFormattedBalance } from "@/lib/useFormattedBalance";
import { useAuth } from "@/app/context/AuthContext";
import { normalizeUsdcAmount } from "@/lib/normalizeUsdc";

type Props = {
  members: Member[];
  eachMemberBalances?:
    | Record<string, string>
    | [string[], string[][]]
    | null;
  isPublic: boolean;
  contributionAmount?: number;
};

function getInitials(name: string) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function MembersTab({
  members,
  eachMemberBalances,
  isPublic,
  contributionAmount = 0,
}: Props) {
  const { user } = useAuth();
  const { formatBalance } = useFormattedBalance();
  const totalMembers = members?.length || 0;

  const getMemberBalance = (memberAddress?: string) => {
    if (!memberAddress || !eachMemberBalances) {
      return { balance: 0, locked: 0 };
    }

    // Tuple form from backend: [addresses[], balances[][]]
    if (Array.isArray(eachMemberBalances)) {
      try {
        const [addresses, balances] = eachMemberBalances as [
          string[],
          string[][]
        ];
        const memberIndex = addresses.findIndex(
          (addr) => addr.toLowerCase() === memberAddress.toLowerCase()
        );
        if (memberIndex === -1 || !balances[memberIndex]) {
          return { balance: 0, locked: 0 };
        }
        const row = balances[memberIndex];
        return {
          balance: Number(formatUnits(BigInt(String(row[0] || 0)), 6)),
          locked: Number(formatUnits(BigInt(String(row[1] || 0)), 6)),
        };
      } catch {
        return { balance: 0, locked: 0 };
      }
    }

    // Record map fallback
    const raw = eachMemberBalances[memberAddress];
    if (raw == null) return { balance: 0, locked: 0 };
    return { balance: normalizeUsdcAmount(raw), locked: 0 };
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
              const memberBalance = getMemberBalance(addr);
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
                    <div className="w-11 h-11 rounded-full bg-downy-100 text-downy-700 flex items-center justify-center text-[12px] font-bold shrink-0 overflow-hidden">
                      {(member as Member & { profilePicture?: string })
                        .profilePicture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            (member as Member & { profilePicture?: string })
                              .profilePicture
                          }
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(member.name || "?")
                      )}
                    </div>
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
