import { useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { shortenAddress } from "../lib/game";

const preferredChainId = Number(import.meta.env.VITE_CHAIN_ID || 84532);

type WalletButtonProps = {
  floor?: number;
  rank?: number;
};

export function WalletButton({ floor, rank }: WalletButtonProps) {
  const [open, setOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (isConnected && address) {
    if (chainId !== preferredChainId) {
      return (
        <button className="wallet-button warning" onClick={() => switchChain({ chainId: preferredChainId })}>
          Switch network
        </button>
      );
    }
    return (
      <button className="wallet-button connected" onClick={() => disconnect()} title="Disconnect wallet">
        <span className="status-dot" />
        <span className="wallet-identity">
          <b>{floor ? `F${String(floor).padStart(2, "0")}` : "LOBBY"}{rank ? ` · #${String(rank).padStart(2, "0")}` : ""}</b>
          <small>{shortenAddress(address)}</small>
        </span>
      </button>
    );
  }

  return (
    <div className="wallet-wrap">
      <button className="wallet-button" onClick={() => setOpen((value) => !value)}>
        Connect wallet
      </button>
      {open && (
        <div className="wallet-menu">
          <div className="eyebrow">Choose a connection</div>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              disabled={isPending}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
            >
              <span>{connector.name}</span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
          {!import.meta.env.VITE_WALLETCONNECT_PROJECT_ID && (
            <p>Add a WalletConnect project ID to enable QR-based mobile wallets.</p>
          )}
        </div>
      )}
    </div>
  );
}
