"use client";

import { useWallet } from "@/lib/wallet";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnecting, hasProvider, connectError, connect, disconnect } =
    useWallet();

  if (!hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="wallet-connect-button"
        data-wallet-state="no-provider"
        className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Install a wallet
      </a>
    );
  }

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isConnecting}
          onClick={() => void connect()}
          data-testid="wallet-connect-button"
          data-wallet-state={connectError ? "error" : "disconnected"}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isConnecting
            ? "Approving…"
            : connectError
              ? "Retry connect"
              : "Connect wallet"}
        </button>
        {connectError ? (
          <p
            data-testid="wallet-connect-error"
            role="alert"
            className="max-w-[220px] text-right text-[10px] text-red-500"
          >
            {connectError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={disconnect}
      data-testid="wallet-connect-button"
      data-wallet-state="connected"
      className="flex items-center gap-2 rounded border border-zinc-300 px-3 py-1.5 text-xs font-mono font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      title="Click to disconnect"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {shortenAddress(address)}
    </button>
  );
}
