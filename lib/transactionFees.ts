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

export const internalTransferFee = (amount: number): number => {
  if (amount < 0.01) return 0;
  const bracket = TRANSFER_FEE_BRACKETS.find(
    (b) => amount >= b.min && amount <= b.max
  );
  return bracket?.fee ?? MAX_TRANSFER_FEE;
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
