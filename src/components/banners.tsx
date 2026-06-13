"use client";

import { useWallet } from "@/lib/wallet";
import {
  expectedChain,
  findChain,
  isMainnetEnabled,
  BASE_MAINNET,
  BASE_SEPOLIA,
} from "@/lib/chains";

export function TestnetUnauditedBanner() {
  return (
    <div
      role="status"
      data-testid="testnet-unaudited-banner"
      className="border-b border-emerald-500/30 bg-zinc-950 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-emerald-100"
    >
      <span className="text-emerald-300">Public testnet beta</span>{" "}
      <span className="text-zinc-300">—</span>{" "}
      <strong className="text-emerald-200">UNAUDITED</strong>
      <span className="text-zinc-400">, experimental, Base Sepolia only.</span>{" "}
      Testnet beta — <strong className="text-emerald-200">NOT YET AUDITED</strong>.{" "}
      Do NOT deposit real funds. Mainnet trading is disabled. Addresses may change.
    </div>
  );
}

export function NetworkBadge() {
  const { chainId, isMainnet, isExpectedChain } = useWallet();
  if (chainId === null) {
    return (
      <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-400">
        no network
      </span>
    );
  }
  const chain = findChain(chainId);
  const label = chain ? chain.shortName : `chain ${chainId}`;
  if (isMainnet) {
    return (
      <span
        data-testid="network-badge-mainnet"
        className="rounded border border-red-500/60 bg-red-950/60 px-2 py-1 text-[10px] font-medium text-red-200"
      >
        {label} (mainnet DISABLED)
      </span>
    );
  }
  if (!isExpectedChain) {
    return (
      <span
        data-testid="network-badge-wrong-network"
        className="rounded border border-emerald-500/40 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-emerald-200"
      >
        wrong network — expected {expectedChain().shortName}
      </span>
    );
  }
  return (
    <span
      data-testid="network-badge-ok"
      className="rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200"
    >
      {label}
    </span>
  );
}

async function switchToBaseSepolia(): Promise<void> {
  if (typeof window === "undefined") return;
  const eth = (window as unknown as { ethereum?: { request?: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth?.request) return;
  const hex = "0x" + BASE_SEPOLIA.id.toString(16);
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  } catch (e) {
    console.warn("wallet_switchEthereumChain rejected/unsupported", e);
  }
}

export function MainnetDisabledBanner() {
  const { isMainnet } = useWallet();
  if (!isMainnet || isMainnetEnabled()) return null;
  return (
    <div
      role="alert"
      data-testid="mainnet-disabled-banner"
      className="flex items-center justify-center gap-3 border-y border-red-500/40 bg-red-950/80 px-4 py-2 text-center text-xs font-medium text-red-100"
    >
      <span>
        Mainnet is permanently disabled for this public testnet beta. Trading
        on Base mainnet (chain {BASE_MAINNET.id}) is DISABLED. Switch to Base
        Sepolia (testnet) to continue.
      </span>
      <button
        type="button"
        onClick={() => void switchToBaseSepolia()}
        data-testid="switch-to-base-sepolia-button"
        className="rounded border border-red-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-100 hover:bg-red-300 hover:text-red-900"
      >
        Switch to Base Sepolia
      </button>
    </div>
  );
}

export function WrongNetworkBanner() {
  const { chainId, isMainnet, isExpectedChain } = useWallet();
  if (chainId === null) return null;
  if (isMainnet) return null;
  if (isExpectedChain) return null;
  const expected = expectedChain();
  return (
    <div
      role="alert"
      data-testid="wrong-network-banner"
      className="flex items-center justify-center gap-3 border-y border-emerald-500/40 bg-zinc-950 px-4 py-2 text-center text-xs font-medium text-emerald-100"
    >
      <span>
        Wrong network — connected to chain {chainId}. DeOpt V2 testnet beta
        runs on {expected.name} (chain {expected.id}). Switch your wallet
        before signing.
      </span>
      <button
        type="button"
        onClick={() => void switchToBaseSepolia()}
        data-testid="switch-network-action"
        className="rounded border border-emerald-400 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/20"
      >
        Switch to {expected.shortName}
      </button>
    </div>
  );
}
