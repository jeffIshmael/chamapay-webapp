import { formatUnits } from "viem";
import { normalizeUsdcAmount } from "@/lib/normalizeUsdc";

export type EachMemberBalances =
  | Record<string, string>
  | [string[], string[][]]
  | null
  | undefined;

export function getMemberChamaBalance(
  eachMemberBalances: EachMemberBalances,
  memberAddress?: string | null
): { balance: number; locked: number } {
  if (!memberAddress || !eachMemberBalances) {
    return { balance: 0, locked: 0 };
  }

  if (Array.isArray(eachMemberBalances)) {
    try {
      const [addresses, balances] = eachMemberBalances as [
        string[],
        string[][],
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

  const key = Object.keys(eachMemberBalances).find(
    (k) => k.toLowerCase() === memberAddress.toLowerCase()
  );
  if (!key) return { balance: 0, locked: 0 };
  return {
    balance: normalizeUsdcAmount(eachMemberBalances[key]),
    locked: 0,
  };
}

export function getMemberRemainingAmount(
  contribution: number,
  eachMemberBalances: EachMemberBalances,
  memberAddress?: string | null
): number {
  const { balance } = getMemberChamaBalance(eachMemberBalances, memberAddress);
  return Math.max(0, (Number(contribution) || 0) - balance);
}
