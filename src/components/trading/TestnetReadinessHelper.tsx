"use client";

import { useWallet } from "@/lib/wallet";
import { useBalances } from "@/hooks/trading";
import { expectedChain, BASE_SEPOLIA } from "@/lib/chains";
import { findPublicBetaLink, isPlaceholderHref } from "@/lib/public-beta-links";
import type { BalancesData, NotReadyData } from "@/lib/trading-types";

function isBalances(x: BalancesData | NotReadyData): x is BalancesData {
  return !("not_ready" in x);
}

type CheckStatus = "ok" | "pending" | "blocked";

interface Check {
  id: string;
  title: string;
  status: CheckStatus;
  hint: string;
}

function statusBadge(s: CheckStatus): { label: string; className: string } {
  switch (s) {
    case "ok":
      return {
        label: "Ready",
        className:
          "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
      };
    case "pending":
      return {
        label: "Pending",
        className:
          "border border-emerald-500/30 bg-zinc-900 text-emerald-200",
      };
    case "blocked":
      return {
        label: "Blocked",
        className: "border border-red-500/40 bg-red-950/40 text-red-200",
      };
  }
}

/**
 * Compact "Before you trade" pre-flight checklist for external testers.
 *
 * Surfaces:
 *   1. Wallet connection
 *   2. Network = Base Sepolia (84532)
 *   3. Testnet ETH for gas (informational — we don't have a faucet link)
 *   4. Testnet mUSDC collateral (best-effort via /accounts/.../balances)
 *   5. Where to ask for help (Discord, live)
 *
 * Posture: testnet only, unaudited. NEVER mints tokens. NEVER calls a
 * faucet from the browser. NEVER adds an RPC URL. NEVER triggers a
 * chain tx. All checks are read-only against the wallet + backend.
 */
export function TestnetReadinessHelper() {
  const { address, chainId, isMainnet, isExpectedChain } = useWallet();
  const { data: balances } = useBalances(address);

  // Check 1 — wallet connected.
  const walletConnected = !!address;
  // Check 3 — testnet ETH: we cannot inspect native balance via this
  // backend, so we surface this as informational. Pending if wallet is
  // not connected, otherwise show as informational "ok-by-default".
  const ethReady = walletConnected;
  // Check 4 — testnet mUSDC: look for any non-zero balance row in the
  // backend's accounts/{address}/balances response. NotReady payload
  // and missing data are treated as "Pending" rather than "Blocked".
  let mUsdcReady: CheckStatus = "pending";
  if (walletConnected && balances?.data) {
    const b = balances.data;
    if (isBalances(b)) {
      const ZERO = BigInt(0);
      const anyPositive = b.balances.some((row) => {
        try {
          return BigInt(row.balance) > ZERO;
        } catch {
          return false;
        }
      });
      mUsdcReady = anyPositive ? "ok" : "pending";
    }
  }

  const discord = findPublicBetaLink("discord");
  const discordLive =
    !!discord?.href && !isPlaceholderHref(discord.href);

  const expectedNetworkStatus: CheckStatus = !walletConnected
    ? "pending"
    : isMainnet
      ? "blocked"
      : isExpectedChain
        ? "ok"
        : "blocked";

  const checks: Check[] = [
    {
      id: "wallet",
      title: "Connect your wallet",
      status: walletConnected ? "ok" : "pending",
      hint: walletConnected
        ? `Connected — ${address!.slice(0, 6)}…${address!.slice(-4)} (public address only; never paste your private key anywhere).`
        : "Use any EVM wallet that supports EIP-712 typed-data signing.",
    },
    {
      id: "network",
      title: `Switch to ${BASE_SEPOLIA.name} (chain ${BASE_SEPOLIA.id})`,
      status: expectedNetworkStatus,
      hint: !walletConnected
        ? "Connect your wallet first."
        : isMainnet
          ? "Mainnet is permanently disabled in this build. Switch to Base Sepolia testnet."
          : !isExpectedChain
            ? `Connected to chain ${chainId}; expected ${expectedChain().name}. Use the banner's switch button.`
            : "Network OK.",
    },
    {
      id: "eth",
      title: "Get a tiny amount of testnet ETH (for gas)",
      status: ethReady ? "ok" : "pending",
      hint: "Any reputable Base Sepolia faucet (Alchemy, QuickNode, Coinbase Wallet's built-in testnet faucet). 0.01 ETH is plenty. Tokens are testnet mocks — zero real-world value.",
    },
    {
      id: "musdc",
      title: "Get testnet mUSDC collateral",
      status: mUsdcReady,
      hint:
        mUsdcReady === "ok"
          ? "Detected a positive balance in your vault-eligible mUSDC. Ready to trade testnet positions."
          : "Ask the operator in Discord to mint testnet mUSDC to your wallet, or watch for the public mUSDC faucet (in the roadmap).",
    },
  ];

  return (
    <section
      data-testid="testnet-readiness-helper"
      aria-labelledby="testnet-readiness-heading"
      className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-zinc-950 p-4 text-zinc-100"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="testnet-readiness-heading"
          className="text-sm font-semibold tracking-tight text-emerald-200"
        >
          Before you trade
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Public testnet beta · no real funds
        </span>
      </header>
      <ol
        data-testid="testnet-readiness-checklist"
        className="flex flex-col gap-2"
      >
        {checks.map((c) => {
          const badge = statusBadge(c.status);
          return (
            <li
              key={c.id}
              data-testid={`readiness-check-${c.id}`}
              data-status={c.status}
              className="flex flex-col gap-1 rounded border border-zinc-800 bg-black/40 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-100">
                  {c.title}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                {c.hint}
              </p>
            </li>
          );
        })}
      </ol>
      <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span>
          Need help? Ask in the testnet community channel — operator is
          typically responsive.
        </span>
        {discordLive ? (
          <a
            href={discord!.href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="readiness-discord-link"
            className="rounded border border-emerald-500/50 px-2 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/10"
          >
            Open Discord
          </a>
        ) : (
          <span
            data-testid="readiness-discord-link"
            data-placeholder="true"
            className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500"
          >
            Discord (coming soon)
          </span>
        )}
      </footer>
    </section>
  );
}
