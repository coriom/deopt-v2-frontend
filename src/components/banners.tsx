"use client";

import { useWallet } from "@/lib/wallet";
import { expectedChain, findChain, isMainnetEnabled, BASE_MAINNET } from "@/lib/chains";

export function TestnetUnauditedBanner() {
  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-xs font-medium text-amber-950">
      ⚠ Testnet beta — <strong>NOT YET AUDITED</strong>. Do NOT deposit real
      funds. Mainnet trading is disabled.
    </div>
  );
}

export function NetworkBadge() {
  const { chainId, isMainnet, isExpectedChain } = useWallet();
  if (chainId === null) {
    return (
      <span className="rounded bg-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        no network
      </span>
    );
  }
  const chain = findChain(chainId);
  const label = chain ? chain.shortName : `chain ${chainId}`;
  if (isMainnet) {
    return (
      <span className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white">
        {label} (mainnet DISABLED)
      </span>
    );
  }
  if (!isExpectedChain) {
    return (
      <span className="rounded bg-amber-500 px-2 py-1 text-[10px] font-medium text-amber-950">
        wrong network — expected {expectedChain().shortName}
      </span>
    );
  }
  return (
    <span className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-medium text-white">
      {label}
    </span>
  );
}

export function MainnetDisabledBanner() {
  const { isMainnet } = useWallet();
  if (!isMainnet || isMainnetEnabled()) return null;
  return (
    <div className="bg-red-600 px-4 py-2 text-center text-xs font-medium text-white">
      ❌ Mainnet detected — Trading on Base mainnet (chain {BASE_MAINNET.id}) is
      DISABLED until external audit completes (post-M-P7). Switch to Base
      Sepolia (testnet) to continue.
    </div>
  );
}
