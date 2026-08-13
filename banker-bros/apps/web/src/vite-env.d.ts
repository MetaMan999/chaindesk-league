/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_REGISTRY_ADDRESS?: `0x${string}`;
  readonly VITE_ROUTER_ADDRESS?: `0x${string}`;
  readonly VITE_COLLECTION_ADDRESS?: `0x${string}`;
  readonly VITE_ACCOUNT_FACTORY_ADDRESS?: `0x${string}`;
  readonly VITE_DEAL_DESK_ADDRESS?: `0x${string}`;
  readonly VITE_REALTIME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
