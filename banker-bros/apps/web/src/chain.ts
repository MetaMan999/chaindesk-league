import { defineChain } from "viem";

const configuredId = Number(import.meta.env.VITE_CHAIN_ID ?? 46630);
const configuredRpc =
  import.meta.env.VITE_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";

export const gameChain = defineChain({
  id: configuredId,
  name: configuredId === 46630 ? "Robinhood Chain Testnet" : "Configured Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [configuredRpc] } },
  blockExplorers:
    configuredId === 46630
      ? {
          default: {
            name: "Robinhood Testnet Explorer",
            url: "https://explorer.testnet.chain.robinhood.com",
          },
        }
      : undefined,
  testnet: true,
});
