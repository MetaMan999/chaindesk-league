/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_GAME_ADDRESS?: `0x${string}`;
  readonly VITE_PROFILE_ADDRESS?: `0x${string}`;
  readonly VITE_PAPER_ASSET_ADDRESS?: `0x${string}`;
  readonly VITE_ACHIEVEMENT_ADDRESS?: `0x${string}`;
  readonly VITE_ELIGIBILITY_ADDRESS?: `0x${string}`;
  readonly VITE_CREW_ADDRESS?: `0x${string}`;
  readonly VITE_DEAL_ROOM_ADDRESS?: `0x${string}`;
  readonly VITE_WORK_FLOOR_ADDRESS?: `0x${string}`;
  readonly VITE_PROFILE_MINT_FEE_ETH?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
