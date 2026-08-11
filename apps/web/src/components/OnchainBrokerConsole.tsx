import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, stringToHex, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  bankerHookAddress,
  brokerIdentityNftAddress,
  brokerLicenseAbi,
  brokerLicenseAddress,
  brokerRegistryAbi,
  brokerRegistryAddress,
  brokerRouterAbi,
  brokerRouterAddress,
  brokerVaultAbi,
  directTestTokenAAddress,
  directTestTokenBAddress,
  erc20ApprovalAbi,
  externalBrokerNftAbi,
  robinhoodAssetRegistryAddress,
  stonkBrokerTokenAddress,
} from "../lib/contracts";

type ConsoleAction = "enter-world" | "register" | "faucet-a" | "faucet-b" | "approve-deposit" | "deposit" | "approve-swap" | "swap";

export type ConfirmedRpgSwap = {
  brokerId: string;
  volume: number;
  retainedFee: number;
  commission: number;
  transactionHash: string;
};

export function OnchainBrokerConsole({ onSwapConfirmed }: {
  onSwapConfirmed: (result: ConfirmedRpgSwap) => void;
}) {
  const { address, chainId, isConnected } = useAccount();
  const [brokerIdInput, setBrokerIdInput] = useState("1139");
  const [amountInput, setAmountInput] = useState("100");
  const [pendingAction, setPendingAction] = useState<ConsoleAction>();
  const [handledHash, setHandledHash] = useState<string>();
  const [status, setStatus] = useState("Connect the external broker identity when the deployment is ready.");
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const brokerId = /^\d+$/.test(brokerIdInput) && brokerIdInput !== "0"
    ? BigInt(brokerIdInput)
    : 0n;
  const amount = useMemo(() => {
    try {
      return parseUnits(amountInput || "0", 6);
    } catch {
      return 0n;
    }
  }, [amountInput]);
  const contractsReady = [
    brokerIdentityNftAddress,
    brokerRegistryAddress,
    brokerRouterAddress,
    bankerHookAddress,
    robinhoodAssetRegistryAddress,
    directTestTokenAAddress,
    directTestTokenBAddress,
  ].every((value) => value !== zeroAddress);
  const readEnabled = contractsReady && isConnected && brokerId > 0n;
  const stonkTokenReadEnabled = isConnected && chainId === 4663
    && stonkBrokerTokenAddress !== zeroAddress;

  const stonkBalanceRead = useReadContract({
    address: stonkBrokerTokenAddress,
    abi: erc20ApprovalAbi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: stonkTokenReadEnabled && Boolean(address) },
  });
  const licenseRead = useReadContract({
    address: brokerLicenseAddress,
    abi: brokerLicenseAbi,
    functionName: "licenseOf",
    args: [address ?? zeroAddress],
    query: {
      enabled: isConnected && brokerLicenseAddress !== zeroAddress && Boolean(address),
    },
  });

  const ownerRead = useReadContract({
    address: brokerIdentityNftAddress,
    abi: externalBrokerNftAbi,
    functionName: "ownerOf",
    args: [brokerId],
    query: { enabled: readEnabled },
  });
  const vaultRead = useReadContract({
    address: brokerRegistryAddress,
    abi: brokerRegistryAbi,
    functionName: "vaultForBroker",
    args: [brokerId],
    query: { enabled: readEnabled },
  });
  const statsRead = useReadContract({
    address: brokerRegistryAddress,
    abi: brokerRegistryAbi,
    functionName: "brokers",
    args: [brokerId],
    query: { enabled: readEnabled },
  });
  const feeRead = useReadContract({
    address: brokerRouterAddress,
    abi: brokerRouterAbi,
    functionName: "testSwapFeeBps",
    query: { enabled: contractsReady },
  });
  const vaultAddress = typeof vaultRead.data === "string" ? vaultRead.data : zeroAddress;
  const registered = vaultAddress !== zeroAddress;
  const ownerMatches = Boolean(
    address && typeof ownerRead.data === "string"
      && address.toLowerCase() === ownerRead.data.toLowerCase(),
  );
  const allowanceToVault = useReadContract({
    address: directTestTokenBAddress,
    abi: erc20ApprovalAbi,
    functionName: "allowance",
    args: [address ?? zeroAddress, vaultAddress],
    query: { enabled: registered && Boolean(address) },
  });
  const walletInputBalance = useReadContract({
    address: directTestTokenAAddress,
    abi: erc20ApprovalAbi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: contractsReady && Boolean(address) },
  });
  const walletOutputBalance = useReadContract({
    address: directTestTokenBAddress,
    abi: erc20ApprovalAbi,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: contractsReady && Boolean(address) },
  });
  const allowanceToRouter = useReadContract({
    address: directTestTokenAAddress,
    abi: erc20ApprovalAbi,
    functionName: "allowance",
    args: [address ?? zeroAddress, brokerRouterAddress],
    query: { enabled: registered && Boolean(address) },
  });
  const vaultOutputBalance = useReadContract({
    address: directTestTokenBAddress,
    abi: erc20ApprovalAbi,
    functionName: "balanceOf",
    args: [vaultAddress],
    query: { enabled: registered },
  });
  const feeBps = Number(feeRead.data ?? 30);
  const expectedOut = amount * BigInt(10_000 - feeBps) / 10_000n;
  const needsVaultApproval = (allowanceToVault.data ?? 0n) < amount;
  const needsRouterApproval = (allowanceToRouter.data ?? 0n) < amount;
  const vaultFunded = (vaultOutputBalance.data ?? 0n) >= expectedOut && expectedOut > 0n;
  const stats = statsRead.data;

  useEffect(() => {
    if (licenseRead.data && licenseRead.data > 0n) {
      setBrokerIdInput(licenseRead.data.toString());
    }
  }, [licenseRead.data]);

  useEffect(() => {
    if (!hash || !receipt.isSuccess || handledHash === hash || !pendingAction) return;
    setHandledHash(hash);
    if (pendingAction === "enter-world") {
      setStatus("Welcome to Wall Street. Your Broker License, ERC-6551 account, and vault are live.");
      void licenseRead.refetch();
      void vaultRead.refetch();
      void statsRead.refetch();
    } else if (pendingAction === "register") {
      setStatus("Brokerage registered. ERC-6551 identity and BrokerVault are now linked.");
      void vaultRead.refetch();
      void statsRead.refetch();
    } else if (pendingAction === "faucet-a" || pendingAction === "faucet-b") {
      setStatus("Valueless test assets claimed. They exist only to exercise the game route.");
      void walletInputBalance.refetch();
      void walletOutputBalance.refetch();
    } else if (pendingAction === "approve-deposit") {
      setStatus("Vault allowance confirmed. Deposit the test output asset next.");
      void allowanceToVault.refetch();
    } else if (pendingAction === "deposit") {
      setStatus("BrokerVault funded with the test output asset.");
      void vaultOutputBalance.refetch();
      void statsRead.refetch();
    } else if (pendingAction === "approve-swap") {
      setStatus("Router allowance confirmed. The test order is ready.");
      void allowanceToRouter.refetch();
    } else if (pendingAction === "swap") {
      const volume = Number(formatUnits(amount, 6));
      const retainedFee = Number(formatUnits(amount - expectedOut, 6));
      setStatus("Order settled. BankerHook attributed volume, commission, reputation, and AUM.");
      void vaultOutputBalance.refetch();
      void statsRead.refetch();
      onSwapConfirmed({
        brokerId: brokerId.toString(),
        volume,
        retainedFee,
        commission: retainedFee * 0.7,
        transactionHash: hash,
      });
    }
    setPendingAction(undefined);
  }, [
    allowanceToRouter,
    allowanceToVault,
    amount,
    brokerId,
    expectedOut,
    handledHash,
    hash,
    licenseRead,
    onSwapConfirmed,
    pendingAction,
    receipt.isSuccess,
    statsRead,
    vaultOutputBalance,
    vaultRead,
    walletInputBalance,
    walletOutputBalance,
  ]);

  function register() {
    setPendingAction("register");
    setStatus("Confirm brokerage registration in your wallet…");
    writeContract({ address: brokerRegistryAddress, abi: brokerRegistryAbi, functionName: "registerBroker", args: [brokerId] });
  }

  function enterWorld() {
    setPendingAction("enter-world");
    setStatus("Confirm one transaction to mint your Broker License and open your brokerage…");
    writeContract({
      address: brokerLicenseAddress,
      abi: brokerLicenseAbi,
      functionName: "enterWallStreet",
      args: [stringToHex("LEDGER AND CO.", { size: 32 })],
    });
  }

  function approveDeposit() {
    setPendingAction("approve-deposit");
    setStatus("Confirm the test-asset vault allowance…");
    writeContract({ address: directTestTokenBAddress, abi: erc20ApprovalAbi, functionName: "approve", args: [vaultAddress, amount] });
  }

  function claimTestAsset(token: `0x${string}`, action: "faucet-a" | "faucet-b") {
    setPendingAction(action);
    setStatus("Confirm the valueless test-asset faucet claim…");
    writeContract({ address: token, abi: erc20ApprovalAbi, functionName: "faucet" });
  }

  function deposit() {
    setPendingAction("deposit");
    setStatus("Confirm the BrokerVault deposit…");
    writeContract({ address: vaultAddress, abi: brokerVaultAbi, functionName: "deposit", args: [directTestTokenBAddress, amount] });
  }

  function approveSwap() {
    setPendingAction("approve-swap");
    setStatus("Confirm the test-order router allowance…");
    writeContract({ address: directTestTokenAAddress, abi: erc20ApprovalAbi, functionName: "approve", args: [brokerRouterAddress, amount] });
  }

  function swap() {
    setPendingAction("swap");
    setStatus("Confirm the routed test order…");
    writeContract({
      address: brokerRouterAddress,
      abi: brokerRouterAbi,
      functionName: "routeTestSwap",
      args: [brokerId, directTestTokenAAddress, directTestTokenBAddress, amount, expectedOut, BigInt(Math.floor(Date.now() / 1000) + 900)],
    });
  }

  return (
    <section className="onchain-console">
      <div className="console-title"><span>JOIN THE DISTRICT</span><b>{contractsReady ? "READY" : "COMING ONLINE"}</b></div>
      <p>Your Broker License becomes your persistent Wall Street identity. After entry, fund its isolated test vault and service your first order.</p>
      <div className="stonk-token-card">
        <div><small>STONKBROKER ECOSYSTEM TOKEN</small><b>0xe934…BF50 · ROBINHOOD CHAIN 4663</b></div>
        <strong>{stonkTokenReadEnabled ? `${Number(formatUnits(stonkBalanceRead.data ?? 0n, 18)).toLocaleString()} STONKBROKER` : "SWITCH TO MAINNET TO READ"}</strong>
        <p>Verified ERC-20, not the ERC-721 identity. It is displayed read-only and is never passed to ERC-6551 or accepted by the test vault. <a href="https://robinhoodchain.blockscout.com/token/0xe934e36A439C94017B64a3FecE66AF12099aBF50" target="_blank" rel="noreferrer">View official explorer ↗</a></p>
      </div>
      {!contractsReady && <div className="console-warning">Add the NFT, ERC-6551 liquidity contracts, asset registry, and two allowlisted test-token addresses to the frontend environment.</div>}
      <div className="console-fields">
        <label>BROKER NFT ID<input value={brokerIdInput} inputMode="numeric" onChange={(event) => setBrokerIdInput(event.target.value)} /></label>
        <label>TEST ORDER SIZE<input value={amountInput} inputMode="decimal" onChange={(event) => setAmountInput(event.target.value)} /><small>six-decimal test units</small></label>
      </div>
      <div className="console-identity">
        <span><small>BROKER LICENSE</small><b>{licenseRead.data ? `#${licenseRead.data.toString()}` : "NOT MINTED"}</b></span>
        <span><small>NFT OWNER</small><b>{ownerMatches ? "CONNECTED WALLET" : readEnabled ? "NOT VERIFIED" : "WAITING"}</b></span>
        <span><small>BROKERAGE</small><b>{registered ? "REGISTERED" : "NOT REGISTERED"}</b></span>
        <span><small>VAULT OUTPUT</small><b>{registered ? formatUnits(vaultOutputBalance.data ?? 0n, 6) : "—"}</b></span>
        <span><small>WALLET TEST INPUT</small><b>{formatUnits(walletInputBalance.data ?? 0n, 6)}</b></span>
      </div>
      {registered && stats && <div className="console-ledger"><span>AUM {formatUnits(stats[4], 6)}</span><span>VOL {formatUnits(stats[5], 6)}</span><span>COMM {formatUnits(stats[6], 6)}</span><span>REP {stats[7].toString()}</span></div>}
      <div className="console-actions">
        {brokerLicenseAddress !== zeroAddress && <button className="enter-world-button" disabled={!contractsReady || !isConnected || Boolean(licenseRead.data) || isPending} onClick={enterWorld}>ENTER WALL STREET · MINT + BIND</button>}
        <button disabled={!contractsReady || !isConnected || !ownerMatches || registered || isPending} onClick={register}>1 · BIND ERC-6551 + REGISTER</button>
        <div className="console-faucets">
          <button disabled={!contractsReady || !isConnected || isPending} onClick={() => claimTestAsset(directTestTokenAAddress, "faucet-a")}>2A · CLAIM TEST INPUT</button>
          <button disabled={!contractsReady || !isConnected || isPending} onClick={() => claimTestAsset(directTestTokenBAddress, "faucet-b")}>2B · CLAIM TEST OUTPUT</button>
        </div>
        <button disabled={!registered || amount <= 0n || (walletOutputBalance.data ?? 0n) < amount || isPending} onClick={needsVaultApproval ? approveDeposit : deposit}>{needsVaultApproval ? "3 · APPROVE VAULT" : "3 · DEPOSIT TEST ASSET"}</button>
        <button disabled={!registered || !vaultFunded || amount <= 0n || (walletInputBalance.data ?? 0n) < amount || isPending} onClick={needsRouterApproval ? approveSwap : swap}>{needsRouterApproval ? "4 · APPROVE ROUTER" : "4 · ROUTE TEST ORDER"}</button>
      </div>
      <div className={`console-status ${receipt.isSuccess ? "success" : error || receipt.isError ? "error" : ""}`}><i />{error instanceof Error ? error.message : receipt.error instanceof Error ? receipt.error.message : status}</div>
      <small className="console-boundary">STOCK TOKEN ROUTE · QUALIFIED EXECUTION ADAPTER ONLY · ELIGIBILITY + HALT CHECKS REQUIRED</small>
    </section>
  );
}
