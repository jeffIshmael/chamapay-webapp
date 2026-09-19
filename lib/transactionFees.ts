const TRANSFER_FEE_BRACKETS = [
  { min: 0.01, max: 1.0, fee: 0.01 },
  { min: 1.01, max: 5.0, fee: 0.02 },
  { min: 5.01, max: 10.0, fee: 0.05 },
  { min: 10.01, max: 25.0, fee: 0.1 },
  { min: 25.01, max: 50.0, fee: 0.15 },
  { min: 50.01, max: 100.0, fee: 0.25 },
  { min: 100.01, max: 250.0, fee: 0.4 },
  { min: 250.01, max: 500.0, fee: 0.6 },
  { min: 500.01, max: 750.0, fee: 0.8 },
  { min: 750.01, max: 1000.0, fee: 1.0 },
] as const;

const MAX_TRANSFER_FEE = 1.0;
const MIN_TRANSFER_AMOUNT = 0.01;

export const internalTransferFee = (amount: number): number => {
  if (amount < MIN_TRANSFER_AMOUNT) return 0;
  const bracket = TRANSFER_FEE_BRACKETS.find(
    (b) => amount >= b.min && amount <= b.max
  );
  return bracket?.fee ?? MAX_TRANSFER_FEE;
};

/**
 * Largest USDC send amount such that amount + transferFee(amount) <= balance.
 * Floored to 3 decimals (USDC display precision).
 */
export const maxSendableWithTransferFee = (balance: number): number => {
  if (!Number.isFinite(balance) || balance < MIN_TRANSFER_AMOUNT) return 0;

  let best = 0;

  for (const b of TRANSFER_FEE_BRACKETS) {
    // Max we can send in this bracket while leaving room for this bracket's fee.
    const capped = Math.min(b.max, balance - b.fee);
    if (capped < b.min || capped < MIN_TRANSFER_AMOUNT) continue;
    if (capped + b.fee <= balance + 1e-9) {
      best = Math.max(best, capped);
    }
  }

  // Above the last bracket: flat MAX_TRANSFER_FEE.
  const above = balance - MAX_TRANSFER_FEE;
  if (above > 1000 && above + MAX_TRANSFER_FEE <= balance + 1e-9) {
    best = Math.max(best, above);
  }

  // Floor to 3dp, then verify fee still fits (bracket edges can shift).
  let sendable = Math.floor(best * 1000) / 1000;
  while (sendable >= MIN_TRANSFER_AMOUNT) {
    const fee = internalTransferFee(sendable);
    if (sendable + fee <= balance + 1e-9) break;
    sendable = Math.floor((sendable - 0.001) * 1000) / 1000;
  }

  return sendable >= MIN_TRANSFER_AMOUNT ? sendable : 0;
};

const WITHDRAWAL_FEE_BRACKETS = [
  { min: 100, max: 500, fee: 5 },
  { min: 501, max: 1000, fee: 10 },
  { min: 1001, max: 2500, fee: 20 },
  { min: 2501, max: 5000, fee: 35 },
  { min: 5001, max: 10000, fee: 55 },
  { min: 10001, max: 20000, fee: 80 },
  { min: 20001, max: 35000, fee: 110 },
  { min: 35001, max: 50000, fee: 145 },
  { min: 50001, max: 70000, fee: 180 },
  { min: 70001, max: 85000, fee: 215 },
  { min: 85001, max: 100000, fee: 250 },
] as const;

const MIN_WITHDRAWAL_FEE = 5;
const MAX_WITHDRAWAL_FEE = 250;

export const withdrawalToMpesaFee = (amount: number): number => {
  if (amount < 100) return MIN_WITHDRAWAL_FEE;
  if (amount > 100000) return MAX_WITHDRAWAL_FEE;
  const bracket = WITHDRAWAL_FEE_BRACKETS.find(
    (b) => amount >= b.min && amount <= b.max
  );
  return bracket?.fee ?? MAX_WITHDRAWAL_FEE;
};
