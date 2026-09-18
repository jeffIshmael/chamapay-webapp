"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, celo } from "wagmi/chains";

/** Read-only wagmi config — no wallet connectors (auth is Google/email + CDP). */
export const config = createConfig({
  chains: [base, celo],
  transports: {
    [base.id]: http(),
    [celo.id]: http(),
  },
  connectors: [],
});

export function BlockchainProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
