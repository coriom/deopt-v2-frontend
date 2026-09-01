import type { ReactNode } from "react";
import { WalletProvider } from "@/lib/wallet";
import { WorkspaceBridgeProvider } from "@/lib/workspace-bridge";

/**
 * Detached-window layout used by `/window`. Deliberately barebones —
 * no navbar, no beta banners, no PublicBetaFooter, no route indicator.
 * The parent shell just supplies the two providers the workspace + the
 * widgets rely on (`WalletProvider` for balances / addresses, and
 * `WorkspaceBridgeProvider` so the floating Widget button can locate
 * the mounted workspace).
 *
 * Opened from the navbar `+` button (`NewWindowButton`), typically in
 * a PWA standalone frame so the browser chrome is stripped too.
 */
export default function WindowLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <WorkspaceBridgeProvider>
        <div
          data-testid="window-shell-root"
          className="flex h-dvh min-h-0 flex-col overflow-hidden bg-black text-zinc-100"
        >
          {children}
        </div>
      </WorkspaceBridgeProvider>
    </WalletProvider>
  );
}
