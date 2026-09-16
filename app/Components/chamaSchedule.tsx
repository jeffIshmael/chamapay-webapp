import React from "react";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import {
  FiClock,
  FiFileText,
  FiGift,
  FiUsers,
  FiCalendar,
  FiDollarSign,
} from "react-icons/fi";
import { formatEther } from "viem";

interface User {
  chamaId: number;
  id: number;
  payDate: Date;
  user: {
    id: number;
    smartAddress: string;
    name: string | null;
    isFarcaster: boolean;
    fid: number | null;
  };
  userId: number;
  isPaid: boolean;
  incognito: boolean;
}

interface Chama {
  adminId: number;
  amount: bigint;
  createdAt: Date;
  cycleTime: number;
  id: number;
  round: number;
  cycle: number;
  blockchainId: string;
  maxNo: number;
  members: User[];
  name: string;
  payDate: Date;
  slug: string;
  startDate: Date;
  started: boolean;
  type: string;
}

const ChamaSchedule = ({
  chama,
  payoutOrder,
  address,
}: {
  chama: Chama;
  payoutOrder: string | null;
  address: string;
}) => {
  const getMemberPayoutDate = (index: number): Date => {
    const payoutDate = new Date(chama.cycle > 1 ? chama.payDate : chama.startDate);
    payoutDate.setDate(payoutDate.getDate() + chama.cycleTime * (chama.cycle > 1 ? index : index + 1));
    return payoutDate;
  };

  const payoutOrderArray: User[] = payoutOrder
    ? JSON.parse(payoutOrder)
    : chama.members;

  const sortedMembers = payoutOrderArray
    .map((member, index) => ({
      ...member,
      payoutDate: getMemberPayoutDate(index),
    }))
    .sort((a, b) => a.payoutDate.getTime() - b.payoutDate.getTime());

  const nextMemberIndex = sortedMembers.findIndex((m) =>
    dayjs(m.payoutDate).isAfter(dayjs(), "day")
  );

  return (
    <div className="min-h-screen bg-downy-100 pb-24 py-8 px-4 font-sans">
      <div className="max-w-xl mx-auto">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Payout <span className="text-downy-600">Order</span>
            </h2>
            <div className="bg-downy-100 p-2 rounded-xl">
              <FiFileText className="text-downy-600 text-2xl" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-around">
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Chama Round</p>
              <div className="bg-blue-50 px-4 py-2 rounded-xl">
                <p className="font-bold text-blue-700 text-lg">{chama.round || 1}</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Chama Cycle</p>
              <div className="bg-green-50 px-4 py-2 rounded-xl">
                <p className="font-bold text-green-700 text-lg">{chama.cycle || 1}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Timeline Section */}
        <div className="relative space-y-4">
          {sortedMembers.map((member, index) => {
            const isPaid = member.isPaid;
            const isNext = index === nextMemberIndex;
            const isCurrentUser = address?.toLowerCase() === member.user.smartAddress.toLowerCase();
            const isCurrent = dayjs().isSame(member.payoutDate, "day") || (isNext && index === 0 && !isPaid);

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                {/* Timeline Connector */}
                {index !== sortedMembers.length - 1 && (
                  <div className="absolute left-[34px] top-12 w-0.5 h-full bg-gray-200 group-hover:bg-downy-200 transition-colors" />
                )}

                <div className={`
                  relative flex gap-4 p-4 rounded-3xl border transition-all duration-300
                  ${isCurrentUser ? "bg-white border-downy-500 shadow-lg ring-1 ring-downy-500/20" : "bg-white border-gray-100 shadow-sm hover:shadow-md"}
                  ${isPaid ? "opacity-75" : ""}
                `}>
                  {/* Position Circle */}
                  <div className={`
                    flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm
                    ${isPaid ? "bg-gray-100 text-gray-400" :
                      isNext ? "bg-amber-100 text-amber-600" :
                        isCurrentUser ? "bg-downy-100 text-downy-600" : "bg-gray-50 text-gray-600"}
                  `}>
                    #{index + 1}
                  </div>

                  {/* Content Area */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <h3 className="font-bold text-gray-900 truncate">
                          {isCurrentUser ? "You" : (member.user.name || "Member")}
                        </h3>
                        {isPaid && (
                          <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Received</span>
                        )}
                        {isNext && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase animate-pulse">Next Up</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-900">
                        {Number(chama.amount) * chama.members.length} <span className="text-[10px] text-gray-400">USDC</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <FiClock className={isNext ? "text-amber-500" : "text-gray-400"} />
                        <span>{dayjs(member.payoutDate).format("MMM D, YYYY")}</span>
                      </div>
                      {!isPaid && (
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${isNext ? "bg-amber-500" : "bg-gray-300"}`} />
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChamaSchedule;
