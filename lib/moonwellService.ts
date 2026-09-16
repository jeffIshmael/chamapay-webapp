import { serverUrl } from "@/lib/serverUrl";

const MOONWELL_API_BASE = "https://api.moonwell.fi/v1";
export const MOONWELL_USDC_MARKET_ADDRESS =
  "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22";

export interface MoonwellUsdcSnapshot {
  totalBalanceUsdc: number;
  principalUsdc: number;
  earnedUsdc: number;
  supplyApy: number | null;
  marketTotalSupplyUsd: number | null;
  liquidityUsd?: number | null;
}

const parseUsd = (value: unknown): number => {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const emptySnapshot = (principalUsdc = 0): MoonwellUsdcSnapshot => ({
  totalBalanceUsdc: 0,
  principalUsdc: Math.max(0, principalUsdc),
  earnedUsdc: 0,
  supplyApy: null,
  marketTotalSupplyUsd: null,
  liquidityUsd: null,
});

const splitPrincipalYield = (
  totalBalanceUsdc: number,
  principalUsdc: number,
  supplyApy: number | null,
  marketTotalSupplyUsd: number | null,
  liquidityUsd: number | null = null
): MoonwellUsdcSnapshot => {
  const tracked = Math.max(0, principalUsdc);
  if (tracked > 0) {
    return {
      totalBalanceUsdc,
      principalUsdc: Math.min(tracked, totalBalanceUsdc),
      earnedUsdc: Math.max(0, totalBalanceUsdc - tracked),
      supplyApy,
      marketTotalSupplyUsd,
      liquidityUsd,
    };
  }
  return {
    totalBalanceUsdc,
    principalUsdc: totalBalanceUsdc,
    earnedUsdc: 0,
    supplyApy,
    marketTotalSupplyUsd,
    liquidityUsd,
  };
};

export const computeMoonwellPrincipalUsdc = (
  transactions: Array<{
    amount?: string;
    description?: string;
    rawReceiver?: string;
    rawSender?: string;
  }>
): number => {
  let net = 0;
  for (const tx of transactions) {
    const amount = Math.abs(parseFloat(tx.amount || "0") || 0);
    if (!amount) continue;
    const desc = tx.description ?? "";
    const isWithdraw =
      desc === "Moonwell Withdrawal" ||
      desc.startsWith("Moonwell Withdrawal") ||
      tx.rawSender === "Moonwell";
    const isDeposit =
      desc === "Moonwell Deposit" ||
      desc === "Moonwell Deposit via M-Pesa" ||
      desc.startsWith("Moonwell Deposit") ||
      tx.rawReceiver === "Moonwell";
    if (isWithdraw) net -= amount;
    else if (isDeposit) net += amount;
  }
  return Math.max(0, net);
};

const fetchSnapshotFromMoonwellApi = async (
  address: string,
  principalUsdc: number
): Promise<MoonwellUsdcSnapshot | null> => {
  if (!address) return null;
  try {
    const headers = { Accept: "application/json" };
    const [posRes, marketRes, healthRes] = await Promise.all([
      fetch(
        `${MOONWELL_API_BASE}/positions/${address}?chain=base&active=true`,
        { headers }
      ),
      fetch(`${MOONWELL_API_BASE}/markets/USDC?chain=base`, { headers }),
      fetch(`${MOONWELL_API_BASE}/health/${address}?chain=base`, { headers }),
    ]);

    const posJson = posRes.ok ? await posRes.json() : null;
    const marketJson = marketRes.ok ? await marketRes.json() : null;
    const healthJson = healthRes.ok ? await healthRes.json() : null;

    const rows: any[] = posJson?.data ?? [];
    const target = MOONWELL_USDC_MARKET_ADDRESS.toLowerCase();
    const usdcRow = rows.find(
      (pos) => String(pos?.marketAddress ?? "").toLowerCase() === target
    );

    const fromPosition = usdcRow ? parseUsd(usdcRow.suppliedUsd) : null;
    const fromHealth = parseUsd(healthJson?.data?.totalSupplyUsd);
    const totalBalanceUsdc =
      fromPosition != null && fromPosition > 0 ? fromPosition : fromHealth;

    const market = marketJson?.data;
    const supplyApy =
      typeof market?.baseSupplyApy === "number" ? market.baseSupplyApy : null;
    const marketTotalSupplyUsd =
      typeof market?.totalSupplyUsd === "number"
        ? market.totalSupplyUsd
        : null;
    const liquidityUsd =
      typeof market?.liquidityUsd === "number" ? market.liquidityUsd : null;

    return splitPrincipalYield(
      totalBalanceUsdc,
      principalUsdc,
      supplyApy,
      marketTotalSupplyUsd,
      liquidityUsd
    );
  } catch {
    return null;
  }
};

const fetchSnapshotFromServer = async (
  principalUsdc: number,
  token: string
): Promise<MoonwellUsdcSnapshot | null> => {
  try {
    const response = await fetch(
      `${serverUrl}/moonwell/live-snapshot?principal=${encodeURIComponent(
        String(principalUsdc)
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const snapshot = data?.snapshot;
    if (!data?.success || !snapshot) return null;
    return {
      totalBalanceUsdc: parseUsd(snapshot.totalBalanceUsdc),
      principalUsdc: parseUsd(snapshot.principalUsdc),
      earnedUsdc: parseUsd(snapshot.earnedUsdc),
      supplyApy:
        typeof snapshot.supplyApy === "number" ? snapshot.supplyApy : null,
      marketTotalSupplyUsd:
        typeof snapshot.marketTotalSupplyUsd === "number"
          ? snapshot.marketTotalSupplyUsd
          : null,
      liquidityUsd:
        typeof snapshot.liquidityUsd === "number"
          ? snapshot.liquidityUsd
          : null,
    };
  } catch {
    return null;
  }
};

export const getMoonwellUsdcSnapshot = async (
  address: string,
  principalUsdc = 0,
  token?: string | null
): Promise<MoonwellUsdcSnapshot> => {
  if (token) {
    const fromServer = await fetchSnapshotFromServer(principalUsdc, token);
    if (fromServer) return fromServer;
  }
  const fromApi = await fetchSnapshotFromMoonwellApi(address, principalUsdc);
  if (fromApi) return fromApi;
  return emptySnapshot(principalUsdc);
};

export const depositToMoonwell = async (
  token: string,
  amount: string
): Promise<{ success: boolean; error?: string; txHash?: string }> => {
  try {
    const response = await fetch(`${serverUrl}/moonwell/deposit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Deposit failed" };
    }
    return { success: true, txHash: data.txHash };
  } catch {
    return { success: false, error: "Deposit failed" };
  }
};

export const withdrawFromMoonwell = async (
  token: string,
  amount: string
): Promise<{ success: boolean; error?: string; txHash?: string }> => {
  try {
    const response = await fetch(`${serverUrl}/moonwell/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Withdraw failed" };
    }
    return { success: true, txHash: data.txHash };
  } catch {
    return { success: false, error: "Withdraw failed" };
  }
};
