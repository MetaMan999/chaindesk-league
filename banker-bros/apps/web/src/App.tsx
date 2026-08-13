import { FormEvent, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, isAddress, zeroAddress } from "viem";
import { accountFactoryAbi, collectionAbi, registryAbi } from "./abi";
import { gameChain } from "./chain";
import { CityWorld } from "./CityWorld";

const registry = import.meta.env.VITE_REGISTRY_ADDRESS ?? zeroAddress;
const collection = import.meta.env.VITE_COLLECTION_ADDRESS ?? zeroAddress;
const accountFactory = import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS ?? zeroAddress;

const markets = [
  { pair: "ETH / TEST USD", district: "Neon Heights", pulse: "+12.4%", tone: "mint" },
  { pair: "WBTC / ETH", district: "Old Exchange", pulse: "+7.9%", tone: "amber" },
  { pair: "MEME / TEST USD", district: "Degen Wharf", pulse: "+31.2%", tone: "pink" },
];

const levels = ["Folding Desk", "Strip Mall", "Downtown", "Trading Floor", "Regional", "Glass Tower"];

function short(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

export function App() {
  const [brokerId, setBrokerId] = useState("7");
  const [tba, setTba] = useState("");
  const [mintQuantity, setMintQuantity] = useState(1);
  const [allowance, setAllowance] = useState("1");
  const [proofText, setProofText] = useState("");
  const [workTokenId, setWorkTokenId] = useState("1");
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending: registering, error } = useWriteContract();
  const { writeContract: mint, data: mintHash, isPending: minting, error: mintError } = useWriteContract();
  const { writeContract: createBroAccount, data: accountHash, isPending: creatingAccount, error: accountError } = useWriteContract();
  const { writeContract: registerBro, data: broRegistryHash, isPending: registeringBro, error: broRegistryError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });
  const mintReceipt = useWaitForTransactionReceipt({ hash: mintHash });
  const accountReceipt = useWaitForTransactionReceipt({ hash: accountHash });
  const broRegistryReceipt = useWaitForTransactionReceipt({ hash: broRegistryHash });
  const parsedBrokerId = useMemo(() => {
    try { return BigInt(brokerId || "0"); } catch { return 0n; }
  }, [brokerId]);

  const broker = useReadContract({
    abi: registryAbi,
    address: registry,
    functionName: "brokers",
    args: [parsedBrokerId],
    query: { enabled: registry !== zeroAddress && parsedBrokerId > 0n },
  });

  const brokerData = broker.data;
  const active = brokerData?.[3] ?? false;
  const minted = useReadContract({ abi: collectionAbi, address: collection, functionName: "totalMinted", query: { enabled: collection !== zeroAddress } });
  const mintPrice = useReadContract({ abi: collectionAbi, address: collection, functionName: "mintPrice", query: { enabled: collection !== zeroAddress } });
  const salePhase = useReadContract({ abi: collectionAbi, address: collection, functionName: "salePhase", query: { enabled: collection !== zeroAddress } });
  const workId = useMemo(() => {
    try { return BigInt(workTokenId || "0"); } catch { return 0n; }
  }, [workTokenId]);
  const predictedAccount = useReadContract({
    abi: accountFactoryAbi,
    address: accountFactory,
    functionName: "predictAccount",
    args: [workId],
    query: { enabled: accountFactory !== zeroAddress && workId > 0n && workId <= 222n },
  });

  function register(event: FormEvent) {
    event.preventDefault();
    if (registry === zeroAddress || !isAddress(tba) || parsedBrokerId <= 0n) return;
    writeContract({
      abi: registryAbi,
      address: registry,
      functionName: "registerBroker",
      args: [parsedBrokerId, tba],
      chainId: gameChain.id,
    });
  }

  function mintBro(event: FormEvent) {
    event.preventDefault();
    if (collection === zeroAddress || !mintPrice.data || mintQuantity < 1) return;
    const proof = proofText
      .split(/[\s,]+/)
      .filter(Boolean)
      .filter((item): item is `0x${string}` => /^0x[0-9a-fA-F]{64}$/.test(item));
    mint({
      abi: collectionAbi,
      address: collection,
      functionName: "mint",
      args: [mintQuantity, Number(allowance || mintQuantity), proof],
      value: mintPrice.data * BigInt(mintQuantity),
      chainId: gameChain.id,
    });
  }

  function activateBro() {
    if (accountFactory === zeroAddress || workId < 1n || workId > 222n) return;
    createBroAccount({
      abi: accountFactoryAbi,
      address: accountFactory,
      functionName: "createAccount",
      args: [workId],
      chainId: gameChain.id,
    });
  }

  function registerBroForWork() {
    if (registry === zeroAddress || !predictedAccount.data || workId < 1n) return;
    registerBro({
      abi: registryAbi,
      address: registry,
      functionName: "registerBroker",
      args: [workId, predictedAccount.data],
      chainId: gameChain.id,
    });
  }

  const wrongChain = isConnected && chainId !== gameChain.id;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Banker Bros home">
          <span className="brand-mark">BB</span>
          <span><strong>BANKER BROS</strong><small>LIQUIDITY CITY / SEASON 01</small></span>
        </a>
        <nav><a href="#world">Play</a><a href="#collection">Collection</a><a href="#desk">Desk</a><a href="#districts">Districts</a><a href="#progress">Progress</a></nav>
        {!isConnected ? (
          <button className="wallet" onClick={() => connect({ connector: connectors[0] })} disabled={connecting}>
            {connecting ? "CONNECTING…" : "CONNECT WALLET"}
          </button>
        ) : (
          <button className="wallet connected" onClick={() => disconnect()}>{short(address)} · EXIT</button>
        )}
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">THE ONCHAIN BROKERAGE GAME</p>
            <h1>YOUR BROKER.<br/><em>YOUR LIQUIDITY EMPIRE.</em></h1>
            <p className="lede">Connect an existing StonkBroker. Put its token-bound account to work. Route crypto liquidity, earn commissions, and build a reputation the city can verify.</p>
            <div className="hero-actions">
              <a className="primary" href="#world">ENTER THE CITY <span>↗</span></a>
              <span className="testnet-pill"><i/> TESTNET · NO REAL-WORLD ASSETS</span>
            </div>
          </div>
          <div className="tower" aria-label="Stylized skyline representing broker progression">
            <div className="sun"/><div className="building back"/><div className="building mid"/>
            <div className="building front"><span>BB</span>{Array.from({ length: 18 }, (_, i) => <i key={i}/>)}</div>
            <div className="ticker">ETH 3,842 ▲ &nbsp; TESTUSD 1.00 &nbsp; WBTC 118K ▲</div>
          </div>
        </section>

        <section className="metrics" aria-label="Season sample metrics">
          <div><span>SEASON VOLUME</span><strong>$24.8M</strong><small>TESTNET ACTIVITY</small></div>
          <div><span>WORLD CAPACITY</span><strong>222</strong><small>BANKER BROS LOADED</small></div>
          <div><span>CITY JOBS</span><strong>5</strong><small>PLAYABLE TRAINING LOOPS</small></div>
          <div><span>WORLD STATUS</span><strong>LIVE</strong><small>LOCAL PLAYABLE ALPHA</small></div>
        </section>

        <CityWorld activeTokenId={Number(workId || 1n)} />

        <section id="collection" className="collection-section">
          <div className="collection-art"><img src="/collection/banker-bros-222-lineup.png" alt="Nine diverse voxel-style Banker Bros characters in cinematic bank offices"/><span>MASTER LINEUP · 222 HUMAN VOXEL BANKERS</span></div>
          <div className="collection-copy">
            <p className="eyebrow">GENESIS COLLECTION / 222</p>
            <h2>MEET THE<br/><em>BANKER BROS.</em></h2>
            <p>Original human voxel bankers from every corner of Liquidity City. Different faces, skin tones, hairstyles, ages, builds, and power looks—one shared Banker Bros energy.</p>
            <div className="supply-line"><span>MINTED</span><strong>{minted.data?.toString() ?? "—"} / 222</strong><i style={{ width: `${Math.min(100, Number(minted.data ?? 0) / 2.22)}%` }}/></div>
            <form className="mint-panel" onSubmit={mintBro}>
              <div><label>QUANTITY<input type="number" min="1" max="20" value={mintQuantity} onChange={(event) => setMintQuantity(Math.max(1, Math.min(20, Number(event.target.value))))}/></label><label>PRICE<strong>{mintPrice.data !== undefined ? `${formatEther(mintPrice.data * BigInt(mintQuantity))} ETH` : "—"}</strong></label></div>
              {salePhase.data === 1 && <><label>ALLOWLIST ALLOWANCE<input value={allowance} onChange={(event) => setAllowance(event.target.value)} inputMode="numeric"/></label><label>MERKLE PROOF<input value={proofText} onChange={(event) => setProofText(event.target.value)} placeholder="0x… hashes separated by commas"/></label></>}
              <button className="mint-button" disabled={!isConnected || wrongChain || minting || collection === zeroAddress || salePhase.data === 0}>
                {collection === zeroAddress ? "ADD COLLECTION ADDRESS TO .ENV" : salePhase.data === 0 ? "SALE CLOSED" : minting ? "CONFIRMING MINT…" : "MINT BANKER BROS"}
              </button>
              {mintReceipt.isSuccess && <p className="success">Your Banker Bro is minted. Welcome to the city.</p>}
              {mintError && <p className="error">{mintError.message}</p>}
            </form>
            <div className="collection-notes"><span>✓ 222 FIXED</span><span>✓ 200 COMMUNITY</span><span>✓ 22 RESERVE</span><span>✓ FAIR REVEAL</span><span>✓ METADATA FREEZE</span></div>
            <div className="work-panel">
              <div><p className="eyebrow">ACTIVATE THE BROKER</p><strong>GIVE YOUR NFT A WALLET</strong></div>
              <p>Its token-bound account can hold crypto and collectibles, settle approved city deals, route swaps, and carry its history to the next owner.</p>
              <label>BANKER BRO TOKEN ID<input value={workTokenId} onChange={(event) => setWorkTokenId(event.target.value)} inputMode="numeric"/></label>
              <code>{predictedAccount.data ?? "Token-bound account address appears here"}</code>
              <div className="work-actions">
                <button type="button" onClick={activateBro} disabled={!isConnected || wrongChain || creatingAccount || accountFactory === zeroAddress}>{creatingAccount ? "CREATING…" : "1. CREATE ACCOUNT"}</button>
                <button type="button" onClick={registerBroForWork} disabled={!isConnected || wrongChain || registeringBro || !predictedAccount.data || !accountReceipt.isSuccess}>{registeringBro ? "REGISTERING…" : "2. REGISTER FOR WORK"}</button>
              </div>
              {accountReceipt.isSuccess && <p className="success">Account created. Register it to enter Liquidity City.</p>}
              {broRegistryReceipt.isSuccess && <p className="success">Broker active. This NFT can now work through its account.</p>}
              {accountError && <p className="error">{accountError.message}</p>}
              {broRegistryError && <p className="error">{broRegistryError.message}</p>}
            </div>
          </div>
        </section>

        <section id="desk" className="desk-section">
          <div className="section-heading"><div><p className="eyebrow">01 / IDENTITY</p><h2>OPEN THE FIRM</h2></div><p>Your StonkBroker remains the identity. Banker Bros verifies its ERC-6551 account and never mints a competing pass.</p></div>
          <div className="desk-grid">
            <form className="registration" onSubmit={register}>
              <div className="form-top"><span className={`status-dot ${active ? "live" : ""}`}/><span>{active ? "BROKER ACTIVE" : "AWAITING REGISTRATION"}</span><b>ERC-6551</b></div>
              <label>STONKBROKER TOKEN ID<input value={brokerId} onChange={(e) => setBrokerId(e.target.value)} inputMode="numeric" placeholder="e.g. 1139" /></label>
              <label>TOKEN-BOUND ACCOUNT<input value={tba} onChange={(e) => setTba(e.target.value)} placeholder="0x…" spellCheck={false} /></label>
              {wrongChain && <button type="button" className="warning" onClick={() => switchChain({ chainId: gameChain.id })}>SWITCH TO {gameChain.name}</button>}
              <button className="register" disabled={!isConnected || wrongChain || registering || registry === zeroAddress}>
                {registry === zeroAddress ? "ADD REGISTRY ADDRESS TO .ENV" : registering ? "CONFIRMING…" : active ? "BROKER ALREADY ACTIVE" : "REGISTER BROKER"}
              </button>
              {receipt.isSuccess && <p className="success">Firm opened. The city tape is indexing your registration.</p>}
              {error && <p className="error">{error.message}</p>}
              <p className="fineprint">The contract checks NFT ownership and the account’s chain, collection, token ID, and current owner.</p>
            </form>
            <div className="broker-card">
              <div className="card-no">BROKER #{brokerId || "—"}</div><div className="crest">B<span>B</span></div>
              <p>REGISTERED LIQUIDITY HOUSE</p><h3>{active ? "ONCHAIN & ACTIVE" : "YOUR NAME HERE"}</h3>
              <div className="signature">controlled by {short(address) || "wallet owner"}</div>
              <div className="card-stamp">SEASON<br/><b>01</b></div>
            </div>
          </div>
        </section>

        <section id="districts" className="districts">
          <div className="section-heading light"><div><p className="eyebrow">02 / MARKETS</p><h2>CHOOSE YOUR DISTRICT</h2></div><p>Each district is a seasonal competition around an approved crypto market. Returns are never promised; score is capped and diversified.</p></div>
          <div className="market-grid">{markets.map((market, index) => (
            <article className={`market ${market.tone}`} key={market.pair}>
              <span className="market-index">0{index + 1}</span><small>{market.district}</small><h3>{market.pair}</h3>
              <div className="spark">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ height: `${24 + ((i * 17 + index * 9) % 56)}%` }}/>)}</div>
              <div className="market-foot"><span>7D TEST VOLUME</span><strong>{market.pulse}</strong></div>
            </article>
          ))}</div>
        </section>

        <section id="progress" className="progress">
          <div className="section-heading"><div><p className="eyebrow">03 / PROGRESSION</p><h2>BUILD THE EMPIRE</h2></div><p>Progress reflects activity and reliability—not a promise of profit. The best offices are status, cosmetics, and community access.</p></div>
          <div className="level-track">{levels.map((level, index) => <div key={level} className={index < 2 ? "unlocked" : ""}><span>{index}</span><b>{level}</b><small>{index < 2 ? "UNLOCKED" : `${[0,100,500,3000,10000,30000][index]} XP`}</small></div>)}</div>
        </section>
      </main>

      <footer><div className="brand"><span className="brand-mark">BB</span><span><strong>BANKER BROS</strong><small>PROTOCOL TESTNET</small></span></div><p>Built for crypto/test assets. Tokenized stocks and RWAs are gated, optional, and disabled by default.</p><span>VERIFY EVERYTHING ONCHAIN ↗</span></footer>
    </div>
  );
}
