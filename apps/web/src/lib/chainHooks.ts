export type ChainHookName = "BrokerRegistry" | "BrokerVault" | "BrokerRouter" | "BankerHook" | "ERC-6551 Identity";

export type ChainIntent = {
  hook: ChainHookName;
  method: string;
  gameEvent: string;
  status: "demo" | "configured" | "gated";
  payload: Record<string, string | number | boolean>;
};

export const chainHookCatalog: Array<{
  name: ChainHookName;
  role: string;
  method: string;
  regulated?: boolean;
}> = [
  { name: "ERC-6551 Identity", role: "Owns the persistent banker identity and token-bound account.", method: "resolveBrokerAccount(tokenId)" },
  { name: "BrokerRegistry", role: "Registers a playable brokerage against the connected banker identity.", method: "registerBroker(tokenId)" },
  { name: "BrokerVault", role: "Tracks test liquidity and future allowlisted capital allocations.", method: "deposit(asset, amount)" },
  { name: "BrokerRouter", role: "Routes crypto-test flow and isolates qualified Stock Token orders.", method: "routeTestSwap(brokerId, order)" },
  { name: "BankerHook", role: "Attributes volume, fees, commission, and reputation after a verified fill.", method: "recordDirectSwap(brokerId, fill)" },
];

export function createChainIntent(hook: ChainHookName, gameEvent: string, payload: ChainIntent["payload"] = {}): ChainIntent {
  const item = chainHookCatalog.find((entry) => entry.name === hook)!;
  return {
    hook,
    method: item.method,
    gameEvent,
    status: "demo",
    payload,
  };
}

export const regulatedMarketGate = {
  enabled: false,
  label: "Regulated tokenized-stock module",
  reason: "Optional integration boundary. Disabled until jurisdiction, eligibility, custody, and licensed execution requirements are satisfied.",
};
