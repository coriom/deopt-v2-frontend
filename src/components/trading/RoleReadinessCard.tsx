"use client";

import { useWallet } from "@/lib/wallet";
import { expectedChain } from "@/lib/chains";

/**
 * Compact "ready to trade?" readiness card rendered above the trade
 * ticket's signature step. Shows: role (buyer/seller), wallet status,
 * network status. Balance and allowance are surfaced separately by the
 * `BalancesCard` on the portfolio page — this card is only a one-glance
 * "am I ready?" indicator above the trade ticket.
 *
 * Public-safe: surfaces only the wallet's PUBLIC address (truncated)
 * and the chain id. Never the private key.
 */
export function RoleReadinessCard({ side }: { side: "buy" | "sell" }) {
  const { address, chainId, isMainnet, isExpectedChain } = useWallet();

  const role = side === "buy" ? "Buyer (long)" : "Seller (short)";
  const roleHint =
    side === "buy"
      ? "You'll pay the premium up front. No mUSDC collateral required to open a long."
      : "You'll post mUSDC as collateral to cover the short.  Receive premium on settlement.";

  let netLabel: string;
  let netClass: string;
  if (chainId === null) {
    netLabel = "Not connected";
    netClass = "border border-zinc-700 bg-zinc-900 text-zinc-400";
  } else if (isMainnet) {
    netLabel = "Mainnet — DISABLED";
    netClass = "border border-red-500/60 bg-red-950/60 text-red-200";
  } else if (!isExpectedChain) {
    netLabel = `Wrong network (${chainId}); expected ${expectedChain().shortName}`;
    netClass = "border border-emerald-500/40 bg-zinc-900 text-emerald-200";
  } else {
    netLabel = `Base Sepolia (${chainId})`;
    netClass = "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
  }

  const walletLabel = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "Not connected";
  const walletClass = address
    ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
    : "border border-zinc-700 bg-zinc-900 text-zinc-400";

  return (
    <div
      data-testid="role-readiness-card"
      className="flex flex-col gap-2 rounded border border-zinc-800 bg-black/40 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          Your role
        </span>
        <span
          data-testid="role-readiness-role"
          className="rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200"
        >
          {role}
        </span>
        <span
          data-testid="role-readiness-wallet"
          className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium ${walletClass}`}
        >
          {walletLabel}
        </span>
        <span
          data-testid="role-readiness-network"
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${netClass}`}
        >
          {netLabel}
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-zinc-400">
        {roleHint}{" "}
        Testnet only — all tokens are mocks; mUSDC has zero real-world value.
      </p>
    </div>
  );
}
