import { shortHash } from '../utils/api';

export default function TxHashDisplay({ hash, simulatedLabel = '0x... (simulated)' }) {
  const txHash = hash || simulatedLabel;
  const canCopy = Boolean(hash);

  const copyHash = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      // Ignore clipboard errors for demo mode.
    }
  };

  return (
    <div className="tx-row">
      <div className="tx-hash">{canCopy ? shortHash(txHash) : txHash}</div>
      <button className="btn btn-ghost btn-sm" type="button" onClick={copyHash} disabled={!canCopy}>
        Copy
      </button>
    </div>
  );
}
