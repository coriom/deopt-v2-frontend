"use client";

import { useEffect, useRef, useState } from "react";
import { fetchCanonicalPerpFees, issueWalletReadChallenge, verifyWalletReadChallenge,
  walletReadSessionMatches, walletReadAuthEnabled, WalletReadAuthRequired,
  type CanonicalPerpFeeHistory } from "@/lib/trading-api";
import { useWallet } from "@/lib/wallet";

function musdc(native: string): string {
  const amount = BigInt(native);
  const scale = BigInt(1_000_000);
  return `${amount / scale}.${(amount % scale).toString().padStart(6, "0")}`;
}

export function PerpsFeeHistory() {
  const { address, chainId, signReadAuthMessage } = useWallet();
  const currentWallet = useRef({ address, chainId });
  useEffect(() => { currentWallet.current = { address, chainId }; }, [address, chainId]);
  const [history, setHistory] = useState<CanonicalPerpFeeHistory | null>(null);
  const [loadedWallet, setLoadedWallet] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "auth_required" | "unavailable">("idle");

  useEffect(() => {
    if (!address || chainId !== 84532) return;
    const controller = new AbortController();
    const load = async () => {
      if (walletReadAuthEnabled() && !await walletReadSessionMatches(address)) {
        throw new WalletReadAuthRequired("Wallet sign-in required");
      }
      return fetchCanonicalPerpFees(address, controller.signal);
    };
    load()
      .then((data) => { setHistory(data); setLoadedWallet(address.toLowerCase()); setStatus("ready"); })
      .catch((error: unknown) => { if (!controller.signal.aborted) { setHistory(null); setLoadedWallet(address.toLowerCase()); setStatus(error instanceof WalletReadAuthRequired ? "auth_required" : "unavailable"); } });
    return () => controller.abort();
  }, [address, chainId]);

  const signIn = async () => {
    if (!address || chainId !== 84532) return;
    const wallet = address.toLowerCase();
    setStatus("loading");
    try {
      const challenge = await issueWalletReadChallenge(address);
      const signature = await signReadAuthMessage(challenge.message);
      if (!signature.ok) { setStatus("auth_required"); return; }
      await verifyWalletReadChallenge(challenge.nonce, signature.signature);
      const data = await fetchCanonicalPerpFees(address);
      if (currentWallet.current.address?.toLowerCase() !== wallet || currentWallet.current.chainId !== 84532) return;
      setHistory(data); setLoadedWallet(wallet); setStatus("ready");
    } catch {
      if (currentWallet.current.address?.toLowerCase() === wallet && currentWallet.current.chainId === 84532) setStatus("unavailable");
    }
  };

  if (!address) return <p data-testid="perps-fees-disconnected" className="p-3 text-xs text-zinc-400">Connect a wallet to view its receipt fee history.</p>;
  if (chainId !== 84532) return <p data-testid="perps-fees-wrong-chain" className="p-3 text-xs text-zinc-400">Switch to Base Sepolia to view wallet fees.</p>;
  if (loadedWallet !== address.toLowerCase() || status === "idle" || status === "loading") return <p className="p-3 text-xs text-zinc-400">Loading wallet fees…</p>;
  if (status === "auth_required") return <div className="p-3 text-xs text-zinc-400" data-testid="perps-fees-auth-required"><p>Sign in with this wallet to view its private fee history.</p><button type="button" onClick={signIn} className="mt-2 rounded border border-zinc-600 px-2 py-1 text-zinc-200">Sign in to view fees</button></div>;
  if (status === "unavailable" || !history) return <p data-testid="perps-fees-unavailable" className="p-3 text-xs text-zinc-400">Fee history unavailable. No settled amount can be confirmed here.</p>;
  if (history.fees.length === 0) return <p data-testid="perps-fees-empty" className="p-3 text-xs text-zinc-400">No indexed D2 settlement fees for this wallet.</p>;
  return (
    <div data-testid="perps-fees-history" className="h-full overflow-auto p-2 text-xs">
      <p className="mb-2 text-zinc-400">Wallet-level D2 receipts · mUSDC · current chain status: {history.current_chain_canonicality.replaceAll("_", " ")}</p>
      <table className="w-full text-left">
        <thead className="text-zinc-500"><tr><th>Block</th><th>Market</th><th>Side</th><th>Role</th><th className="text-right">Receipt fee</th></tr></thead>
        <tbody>{history.fees.map((fee) => (
          <tr key={`${fee.tx_hash}:${fee.trade_log_index}`} className="border-t border-zinc-800" data-testid="perps-fee-row">
            <td>{fee.block_number}</td><td>{fee.market_id}</td><td>{fee.side}</td><td>{fee.role}</td>
            <td className="text-right font-mono">{musdc(fee.fee_native)} mUSDC</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="mt-2 text-zinc-500">Subaccount settlement attribution is unverified. These fees belong to the wallet. Local estimates and projected fills are excluded.</p>
    </div>
  );
}
