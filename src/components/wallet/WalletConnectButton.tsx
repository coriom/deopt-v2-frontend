"use client";

import { useWallet } from "@/lib/wallet";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnecting, hasProvider, connect, disconnect } = useWallet();

  if (!hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Install a wallet
      </a>
    );
  }

  if (!address) {
    return (
      <button
        type="button"
        disabled={isConnecting}
        onClick={() => void connect()}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isConnecting ? "Approving…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={disconnect}
      className="flex items-center gap-2 rounded border border-zinc-300 px-3 py-1.5 text-xs font-mono font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      title="Click to disconnect"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {shortenAddress(address)}
    </button>
  );
}
