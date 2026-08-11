import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { baseSepolia, sepolia } from "wagmi/chains";
import { defineChain } from "viem";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Anvil Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Robinhood Chain Testnet Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: "https://robinhoodchain.blockscout.com" },
  },
});

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
const connectors = [injected({ shimDisconnect: true })];

if (projectId) {
  connectors.push(
    walletConnect({
      projectId,
      metadata: {
        name: "Banker Bros",
        description: "An original Wall Street RPG with a testnet brokerage layer",
        url: window.location.origin,
        icons: [],
      },
      showQrModal: true,
    }),
  );
}

const rpc = import.meta.env.VITE_RPC_URL?.trim();
const preferredChainId = Number(import.meta.env.VITE_CHAIN_ID || baseSepolia.id);

export const wagmiConfig = createConfig({
  chains: [baseSepolia, sepolia, robinhoodMainnet, robinhoodTestnet, anvil],
  connectors,
  transports: {
    [baseSepolia.id]: http(preferredChainId === baseSepolia.id && rpc ? rpc : baseSepolia.rpcUrls.default.http[0]),
    [sepolia.id]: http(preferredChainId === sepolia.id && rpc ? rpc : sepolia.rpcUrls.default.http[0]),
    [robinhoodMainnet.id]: http(preferredChainId === robinhoodMainnet.id && rpc ? rpc : robinhoodMainnet.rpcUrls.default.http[0]),
    [robinhoodTestnet.id]: http(preferredChainId === robinhoodTestnet.id && rpc ? rpc : robinhoodTestnet.rpcUrls.default.http[0]),
    [anvil.id]: http(anvil.rpcUrls.default.http[0]),
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 8_000,
      refetchOnWindowFocus: false,
    },
  },
});
