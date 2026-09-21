import { serverUrl } from "@/lib/serverUrl";

export type GoalType = "personal" | "invite" | "public";

export interface GoalCreator {
  id: number;
  userName: string;
  profileImageUrl?: string | null;
  smartAddress: string;
}

export interface GoalContribution {
  id: number;
  amount: string;
  contributorAddress?: string;
  payerAddress?: string;
  isGuest?: boolean;
  guestDisplayName?: string | null;
  txHash?: string;
  pretiumTxCode?: string | null;
  createdAt: string;
  contributorUser?: {
    id: number;
    userName: string;
    profileImageUrl?: string | null;
  } | null;
}

export interface GoalWithdrawal {
  id: number;
  amount: string;
  mode: string;
  txHash?: string;
  createdAt: string;
}

export interface GoalRecord {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  goalType: GoalType | string;
  targetAmount: string;
  endDate?: string | null;
  yieldEnabled: boolean;
  blockchainId: string;
  createTxHash?: string | null;
  status: string;
  notifyPhone?: string | null;
  coverImageUrl?: string | null;
  creatorId: number;
  createdAt: string;
  creator?: GoalCreator;
  members?: Array<{
    id: number;
    userId: number;
    user: GoalCreator;
  }>;
  contributions?: GoalContribution[];
  withdrawals?: GoalWithdrawal[];
  _count?: { members: number; contributions: number };
  /** Optional list enrichment from finance / my-goals */
  totalBalance?: string;
}

export interface GoalFinance {
  idleUsdc: string;
  moonwellUsdc: string;
  totalBalance: string;
  principalRemaining: string;
  yieldEarned: string;
  maxWithdrawable: string;
  yieldEnabled: boolean;
  active: boolean;
}

export async function createGoal(
  token: string,
  data: {
    name: string;
    description?: string;
    goalType: GoalType;
    targetAmount: string;
    endDate?: string | null;
    yieldEnabled: boolean;
    notifyPhone?: string;
  }
): Promise<{
  success: boolean;
  goal?: GoalRecord;
  payLink?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${serverUrl}/goal/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch {
    return { success: false, error: "Failed to create goal" };
  }
}

export async function getMyGoals(
  token: string
): Promise<{ success: boolean; goals?: GoalRecord[]; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/goal/my-goals`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    return { success: false, error: "Failed to fetch goals" };
  }
}

export async function getGoalBySlug(
  slug: string,
  token: string
): Promise<{
  success: boolean;
  goal?: GoalRecord;
  finance?: GoalFinance | null;
  isMember?: boolean;
  isCreator?: boolean;
  payLink?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${serverUrl}/goal/slug/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        error: (err as { error?: string }).error || "Goal not found",
      };
    }
    return await response.json();
  } catch {
    return { success: false, error: "Failed to fetch goal" };
  }
}

export async function uploadGoalCover(
  goalId: number,
  file: File,
  token: string
): Promise<{ success: boolean; coverImageUrl?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(`${serverUrl}/goal/${goalId}/cover`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error:
          (data as { error?: string }).error ||
          (data as { message?: string }).message ||
          "Upload failed",
      };
    }
    return {
      success: true,
      coverImageUrl: (data as { coverImageUrl?: string }).coverImageUrl,
    };
  } catch {
    return { success: false, error: "Upload failed" };
  }
}

export async function setGoalYieldEnabled(
  goalId: number,
  enabled: boolean,
  token: string
): Promise<{ success: boolean; yieldEnabled?: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/goal/${goalId}/yield`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Failed to toggle yield",
      };
    }
    return {
      success: true,
      yieldEnabled: Boolean((data as { yieldEnabled?: boolean }).yieldEnabled),
    };
  } catch {
    return { success: false, error: "Failed to toggle yield" };
  }
}

export async function addGoalMember(
  goalId: number,
  memberId: number,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/goal/${goalId}/members`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ memberId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Failed to add member",
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Failed to add member" };
  }
}

export async function withdrawFromGoal(
  goalId: number,
  token: string,
  opts: { mode: "all" | "yield" | "principal" | "amount"; amount?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/goal/${goalId}/withdraw`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opts),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Withdrawal failed",
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Withdrawal failed" };
  }
}

export async function contributeToGoal(
  goalId: number,
  amount: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/goal/${goalId}/contribute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Deposit failed",
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Deposit failed" };
  }
}

export function goalTypeLabel(type: string): string {
  if (type === "personal") return "Personal";
  if (type === "invite") return "Invite circle";
  if (type === "public") return "Public / Harambee";
  return type;
}

/** Badge styles for goal-type tags on home / lists */
export function goalTypeTagColors(type: string): {
  color: string;
  bg: string;
  border: string;
} {
  switch (type) {
    case "personal":
      return { color: "#6d28d9", bg: "#f5f3ff", border: "#ede9fe" }; // violet
    case "invite":
      return { color: "#0369a1", bg: "#f0f9ff", border: "#e0f2fe" }; // sky
    case "public":
      return { color: "#b45309", bg: "#fffbeb", border: "#fef3c7" }; // amber
    default:
      return { color: "#4b5563", bg: "#f3f4f6", border: "#e5e7eb" };
  }
}

/** Tailwind class string (bg + text). Prefer goalTypeTagColors + inline style if purge drops dynamic classes. */
export function goalTypeTagClass(type: string): string {
  switch (type) {
    case "personal":
      return "bg-violet-50 text-violet-700 border border-violet-100";
    case "invite":
      return "bg-sky-50 text-sky-700 border border-sky-100";
    case "public":
      return "bg-amber-50 text-amber-800 border border-amber-100";
    default:
      return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

export type PublicGoalContribution = {
  id: number;
  amount: string;
  displayName: string;
  isAnonymous: boolean;
  profileImageUrl?: string | null;
  createdAt: string;
};

export type PublicGoalPreview = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  goalType: string;
  targetAmount: string;
  endDate?: string | null;
  coverImageUrl?: string | null;
  status: string;
  creator?: { userName: string; profileImageUrl?: string | null } | null;
  totalBalance?: string;
  progress?: number;
  contributions?: PublicGoalContribution[];
  contributorCount?: number;
};

export async function getPublicGoalByPayToken(
  token: string
): Promise<{ success: boolean; goal?: PublicGoalPreview; error?: string }> {
  try {
    const response = await fetch(
      `${serverUrl}/goal/pay/${encodeURIComponent(token)}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Goal not found",
      };
    }
    return {
      success: true,
      goal: (data as { goal: PublicGoalPreview }).goal,
    };
  } catch {
    return { success: false, error: "Failed to load goal" };
  }
}

export async function initiateGoalPayOnramp(
  token: string,
  body: {
    amount: number;
    phoneNo: string;
    guestDisplayName?: string;
    exchangeRate?: number;
  }
): Promise<{
  success: boolean;
  transactionCode?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${serverUrl}/goal/pay/${encodeURIComponent(token)}/onramp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Payment failed to start",
      };
    }
    return {
      success: true,
      transactionCode: (data as { transactionCode?: string }).transactionCode,
    };
  } catch {
    return { success: false, error: "Payment failed to start" };
  }
}

export async function getGoalPayStatus(
  code: string
): Promise<{ success: boolean; complete?: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch(
      `${serverUrl}/goal/pay/status/${encodeURIComponent(code)}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Status check failed",
      };
    }
    return {
      success: true,
      complete: Boolean((data as { complete?: boolean }).complete),
      status: (data as { status?: string }).status,
    };
  } catch {
    return { success: false, error: "Status check failed" };
  }
}

/** After guest M-Pesa success: show name or stay anonymous on the supporters list. */
export async function setGoalPayIdentity(
  token: string,
  body: {
    transactionCode: string;
    anonymous: boolean;
    displayName?: string;
  }
): Promise<{ success: boolean; displayName?: string; error?: string }> {
  try {
    const response = await fetch(
      `${serverUrl}/goal/pay/${encodeURIComponent(token)}/identity`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string }).error || "Could not update",
      };
    }
    return {
      success: true,
      displayName: (data as { displayName?: string }).displayName,
    };
  } catch {
    return { success: false, error: "Could not update" };
  }
}
