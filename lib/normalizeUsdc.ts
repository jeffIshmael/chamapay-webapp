import { formatUnits } from "viem";

/**
 * Normalize a USDC amount from API / chain into human units.
 * USDC uses 6 decimals (not 18).
 */
export function normalizeUsdcAmount(raw: unknown): number {
  try {
    if (raw == null) return 0;

    if (Array.isArray(raw)) {
      if (raw[0] == null) return 0;
      return fromMicroUnits(String(raw[0]));
    }

    if (typeof raw === "bigint") {
      return fromMicroUnits(raw.toString());
    }

    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return 0;
      if (Number.isInteger(raw) && Math.abs(raw) >= 1_000_000) {
        return raw / 1e6;
      }
      return raw;
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return 0;
      if (trimmed.startsWith("[")) {
        return normalizeUsdcAmount(JSON.parse(trimmed));
      }
      // Miniapp bug: balance.toString() on [micro, locked] → "967956,0"
      if (trimmed.includes(",") && !trimmed.includes(".")) {
        return normalizeUsdcAmount(trimmed.split(",").map((s) => s.trim()));
      }
      return fromMicroOrHuman(trimmed);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/**
 * Always decode chama/wallet on-chain balances as 6-decimal micro-units.
 * Use this for userBalance / eachMemberBalance — never treat as human USDC.
 */
export function normalizeChamaBalance(raw: unknown): number {
  try {
    if (raw == null) return 0;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return 0;
      if (trimmed.startsWith("[")) {
        return normalizeChamaBalance(JSON.parse(trimmed));
      }
      if (trimmed.includes(",")) {
        return normalizeChamaBalance(trimmed.split(",").map((s) => s.trim()));
      }
      return fromMicroUnits(trimmed);
    }

    if (Array.isArray(raw)) {
      if (raw[0] == null) return 0;
      return fromMicroUnits(String(raw[0]));
    }

    if (typeof raw === "bigint") {
      return fromMicroUnits(raw.toString());
    }

    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return 0;
      // Integers from chain serialization are micro-units
      if (Number.isInteger(raw)) return raw / 1e6;
      return raw;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

function fromMicroUnits(value: string): number {
  try {
    const cleaned = value.replace(/[^\d-]/g, "");
    if (!cleaned || cleaned === "-") return 0;
    const as6 = Number(formatUnits(BigInt(cleaned), 6));
    if (!Number.isFinite(as6)) return 0;
    // Legacy 18-dec rows: if 6-dec decode is absurd, retry 18
    if (as6 > 1_000_000) {
      const as18 = Number(formatUnits(BigInt(cleaned), 18));
      if (Number.isFinite(as18) && as18 < as6) return as18;
    }
    return as6;
  } catch {
    return 0;
  }
}

function fromMicroOrHuman(value: string): number {
  if (value.includes(".")) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  try {
    const bi = BigInt(value);
    // Small integers are already human USDC (contribution fields from API)
    if (bi < 1_000_000n) return Number(bi);
    return fromMicroUnits(value);
  } catch {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
}
