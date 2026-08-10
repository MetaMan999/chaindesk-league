import { useState } from "react";

export function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="disclaimer-modal" role="dialog" aria-modal="true" aria-labelledby="notice-title">
        <div className="modal-icon">SIM</div>
        <div>
          <div className="eyebrow">Before entering the floor</div>
          <h2 id="notice-title">This is a testnet strategy game</h2>
        </div>
        <p>
          ChainDesk League uses fictional companies, non-transferable paper positions, and credits with no
          cash value. It does not offer securities, brokerage services, investment returns, or ownership in
          any real business.
        </p>
        <div className="notice-grid">
          <div><span>01</span><strong>Simulation only</strong><small>No real stocks or price feeds.</small></div>
          <div><span>02</span><strong>Testnet first</strong><small>Use faucet funds, never valuable assets.</small></div>
          <div><span>03</span><strong>Experimental</strong><small>Unaudited contracts can contain bugs.</small></div>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span>I understand that this experience has no financial value and is not investment advice.</span>
        </label>
        <button className="primary-action wide" disabled={!checked} onClick={onAccept}>
          Enter the simulation
        </button>
      </section>
    </div>
  );
}

