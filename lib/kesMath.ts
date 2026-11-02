// One place for USDC <-> KES conversion so the Wallet, Deposit, Withdraw and Send screens can never
// round differently again. All maths runs on integer micro-USDC (1 USDC = 1,000,000) and is cleaned
// of float noise (e.g. 14.999999999999998) before rounding.

const MICRO = 1e6;

export const toMicro = (usdc: number) => Math.round(usdc * MICRO);

/**
 * KES value of a USDC amount at `rate`, to whole cents.
 * "floor" (default) for anything the user HAS (balances, max): never shows more than exists.
 * "ceil" for anything the user PAYS (fees, totals, minimums): never shows less than it costs.
 */
export function usdcToKes(
  usdc: number,
  rate: number,
  mode: "floor" | "ceil" = "floor",
): number {
  if (!(usdc > 0) || !(rate > 0)) return 0;
  const cents = Math.round(((toMicro(usdc) * rate) / 1e4) * MICRO) / MICRO;
  return (mode === "floor" ? Math.floor(cents) : Math.ceil(cents)) / 100;
}

/** USDC needed for a KES amount, rounded UP to 6 decimals (same as the server's kesToUsdcCeil). */
export function kesToUsdcCeil(kes: number, rate: number): number {
  if (!(kes > 0) || !(rate > 0)) return 0;
  return Math.ceil(Number(((kes / rate) * MICRO).toFixed(3))) / MICRO;
}

export function floorUsdc(usdc: number, decimals = 3): number {
  const m = 10 ** decimals;
  return Math.floor(Number((Math.max(0, usdc) * m).toFixed(6))) / m;
}

export function ceilUsdc(usdc: number, decimals = 3): number {
  const m = 10 ** decimals;
  return Math.ceil(Number((Math.max(0, usdc) * m).toFixed(6))) / m;
}