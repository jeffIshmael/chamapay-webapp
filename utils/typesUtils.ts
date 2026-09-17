export interface Notification {
  id: string;
  type:
  | "contribution_due"
  | "payout_received"
  | "new_message"
  | "member_joined"
  | "payout_scheduled"
  | "join_request"
  | "invite_link"
  | "chama_started"
  | "other";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired: boolean;
  chama: string;
  chamaId?: number | null;
  chamaSlug?: string;
  requestId?: number;
  requestUserId?: number;
  requestUserName?: string;
  requestUserAddress?: string;
  chamaBlockchainId?: number;
  canAdd?: boolean;
}

export interface Member {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
  contributions: number;
  address?: string;
  smartAddress?: string;
  profilePicture?: string;
}

export interface Message {
  id: number;
  sender: string;
  text: string;
  timestamp: string;
  senderId: number;
  isAdmin?: boolean;
}

export type PayoutStatus = boolean | "next";

export interface PayoutScheduleItem {
  paid: boolean;
  payDate: Date;
  userAddress: string;
}

export interface Transaction {
  id: number | string;
  type: string;
  amount: number | null;
  date: string;
  status: string;
  description: string;
  txHash: string;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
    profileImageUrl: string;
    address: string;
  };
}

export interface RoundOutcome {
  id: number;
  disburse: boolean;
  chamaCycle: number;
  chamaRound: number;
  amountPaid: string;
  shownMembers: string | null; // Json string of people who have been shown an outcome modal.
  createdAt: Date;
}

export interface PayOut {
  id: number;
  amount: bigint;
  doneAt: Date;
  txHash: string | null;
  receiver: string;
  userId: number;
  chamaId: number;
}


export interface JoinedChama {
  id: number;
  blockchainId: string;
  slug: string;
  name: string;
  description: string;
  currency: string;
  totalMembers: number;
  startDate: Date;
  maxMembers: number;
  contribution: number;
  totalContributions: number;
  nextPayoutDate: string;
  nextPayoutAmount: number;
  currentTurnMember: string;
  currentTurnMemberPosition: number;
  currentTurnMemberAddress: string;
  myTurnDate: string;
  contributionDueDate: Date;
  hasOutstandingPayment: boolean;
  frequency: string;
  duration: number;
  rating: number;
  raterCount: number;
  category: string;
  canJoin: boolean;
  adminTerms: string[];
  collateralAmount: number;
  nextPayout: string | null;
  myTurn: boolean;
  myPosition: number | null;
  nextTurnMember: string;
  status: "not started" | "active";
  unreadMessages: number;
  isPublic: boolean;
  currentCycle: number;
  currentRound: number;
  messages: Message[];
  payoutSchedule: PayoutScheduleItem[];
  members: Member[];
  recentTransactions: Transaction[];
  roundOutcome: RoundOutcome[];
  payOuts: PayOut[];
  userBalance?: string | string[];
  eachMemberBalance?: Record<string, string> | [string[], string[][]];
}


export type PublicChama = {
  id: string;
  slug: string;
  name: string;
  description: string;
  members: number;
  maxMembers: number;
  contribution: number;
  frequency: string;
  duration: string;
  rating: number;
  raterCount: number;
  collateralAmount: number;
  nextPayout: string;
  currency: string;
  isPublic: boolean;
  startDate: string;
  adminTerms: string[];
};
