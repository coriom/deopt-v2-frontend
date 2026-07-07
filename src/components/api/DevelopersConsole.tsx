"use client";

// FRONTEND-DEVELOPERS-CONSOLE-V1 — minimal Developers landing.
//
// Sparser, action-oriented page modeled on a clean app-side Developers
// surface. Everything documentation-shaped lives in `deopt-v2-docs`;
// the WebSocket sandbox lives at `/api/sandbox`.
//
// Sections on this page:
//   1. Title + four icon links (Guides, API Reference, GitHub,
//      Testnet/env-aware)
//   2. Wallet / Signer compact row with copy-to-clipboard
//   3. Mint Tokens card (Planned — no live faucet wired)
//   4. Session Keys card (Planned — disabled button, honest empty)
//   5. Subaccounts card (Planned — disabled button, honest empty)
//   6. MM Gateway one-line footer note
//   7. Link to the WebSocket sandbox at `/api/sandbox`

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { encodeFunctionData, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useWallet } from "@/lib/wallet";
import { docsPath } from "@/lib/docs-url";
import { expectedChainId, BASE_SEPOLIA } from "@/lib/chains";

type Environment = "Local" | "Testnet" | "Production" | "Unknown";

function environmentFromEnv(): Environment {
  if (typeof process === "undefined") return "Testnet";
  const v = (process.env.NEXT_PUBLIC_DEOPT_ENV ?? "").toLowerCase();
  if (v === "local") return "Local";
  if (v === "production" || v === "prod") return "Production";
  if (v === "testnet") return "Testnet";
  // Until the operator sets the env explicitly, mainnet is disabled
  // so the only safe label is `Testnet`.
  return "Testnet";
}

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DevelopersConsole() {
  const { address } = useWallet();
  const env = useMemo(() => environmentFromEnv(), []);

  return (
    <div
      data-testid="developers-console"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 bg-black px-6 py-8 text-zinc-200"
    >
      <Header environment={env} />
      <Identity address={address} />
      <MintTokensCard />
      <SessionKeysCard />
      <SubaccountsCard />
      <Footer />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────

function Header({ environment }: { environment: Environment }) {
  return (
    <header
      data-testid="developers-console-header"
      className="flex flex-col gap-4 border-b border-zinc-900 pb-6"
    >
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
        Developers
      </h1>
      <nav
        aria-label="Developer quick links"
        data-testid="developers-console-quicklinks"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-zinc-300"
      >
        <IconLink
          testid="developers-quicklink-guides"
          href={docsPath("/quickstart")}
          external
          label="Guides"
          icon={<BookIcon />}
        />
        <IconLink
          testid="developers-quicklink-api-reference"
          href={docsPath("/developers")}
          external
          label="API Reference"
          icon={<CodeIcon />}
        />
        <IconLink
          testid="developers-quicklink-github"
          href="https://github.com/DeOpt"
          external
          label="GitHub"
          icon={<GithubIcon />}
        />
        <IconLink
          testid="developers-quicklink-environment"
          href={docsPath("/limitations")}
          external
          label={environment}
          icon={<FlaskIcon />}
        />
      </nav>
    </header>
  );
}

// ── Identity (Wallet / Signer) ────────────────────────────────────

function Identity({ address }: { address: string | null }) {
  const signer = address; // No session-key surface yet — signer = wallet.
  return (
    <section
      aria-label="Identity"
      data-testid="developers-console-identity"
      className="flex flex-wrap items-end gap-10 text-[13px]"
    >
      <IdentityCell
        testid="identity-wallet"
        label="Wallet"
        value={address ? shortAddr(address) : "Not connected"}
        copyValue={address ?? undefined}
      />
      <IdentityCell
        testid="identity-signer"
        label="Signer"
        value={signer ? shortAddr(signer) : "Not available"}
        copyValue={signer ?? undefined}
      />
    </section>
  );
}

function IdentityCell({
  label,
  value,
  copyValue,
  testid,
}: {
  label: string;
  value: string;
  copyValue?: string;
  testid: string;
}) {
  return (
    <div data-testid={testid} className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 underline decoration-zinc-700 underline-offset-4">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className="font-mono text-[15px] text-zinc-100"
          style={{ fontFamily: "var(--app-font-mono)" }}
        >
          {value}
        </span>
        {copyValue ? <CopyButton value={copyValue} testid={`${testid}-copy`} /> : null}
      </div>
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────

// TESTNET-SELF-SERVE-ONBOARDING-V1 — Case 2: the mock collateral
// tokens ARE deployed on Base Sepolia (see manifest at
// `deopt-v2-sol/deployments/base-sepolia.manifest.draft.json`) but
// their `mint(address,uint256)` is `external onlyOwner`. A true
// public faucet needs a different contract — that's
// TESTNET-PUBLIC-FAUCET-CONTRACT-V1. When the operator deploys
// `TestnetFaucet` and publishes its address via the env var
// `NEXT_PUBLIC_TESTNET_FAUCET_ADDRESS`, this card flips to
// claim-mode (calls `TestnetFaucet.claim()` from the user's
// wallet). Until then, it remains in request-mode (3 token tiles +
// Discord/feedback request path). NO fake mint button. NO fake
// balance. NO fake "claimed!" toast.
const TESTNET_FAUCET_TOKENS: ReadonlyArray<{
  symbol: string;
  address: string;
  decimals: number;
  blurb: string;
  claimAmountHuman: string;
}> = [
  {
    symbol: "mUSDC",
    address: "0x6eae407f5640b006fac9965182e238582a3b412e",
    decimals: 6,
    blurb: "settlement collateral — USDC mock",
    claimAmountHuman: "1,000",
  },
  {
    symbol: "mWETH",
    address: "0x4deebc5f537f3b8ba0e3393807b4d699d72bdd02",
    decimals: 18,
    blurb: "underlying — ETH mock",
    claimAmountHuman: "1",
  },
  {
    symbol: "mWBTC",
    address: "0x9d871ac7595e8da271e866608e5145252047967c",
    decimals: 8,
    blurb: "underlying — BTC mock",
    claimAmountHuman: "0.5",
  },
];

const TESTNET_FAUCET_REQUEST_DISCORD =
  "https://discord.gg/zaEMvWuxu";

// TESTNET-PUBLIC-FAUCET-CONTRACT-V1 — minimal ABI for the deployed
// `TestnetFaucet`. Only the two functions the card needs.
const TESTNET_FAUCET_ABI = [
  {
    type: "function",
    name: "claim",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const FAUCET_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Resolves the faucet address from (1) build-time env
 * `NEXT_PUBLIC_TESTNET_FAUCET_ADDRESS`, falling back to (2) the
 * runtime override `window.__deoptFaucetAddress` that Playwright
 * sets via `setMockFaucetAddress`. Returns `null` if neither
 * yields a valid 0x-address.
 */
function resolveFaucetAddress(): Address | null {
  const fromEnv =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_TESTNET_FAUCET_ADDRESS ?? "").trim()
      : "";
  if (FAUCET_ADDRESS_RE.test(fromEnv)) return fromEnv as Address;
  if (typeof window !== "undefined") {
    const override = (
      window as unknown as { __deoptFaucetAddress?: string | null }
    ).__deoptFaucetAddress;
    if (typeof override === "string" && FAUCET_ADDRESS_RE.test(override)) {
      return override as Address;
    }
  }
  return null;
}

function MintTokensCard() {
  // Faucet address is resolved in an effect so the initial server
  // render matches the initial client render (no hydration mismatch).
  // The runtime override `window.__deoptFaucetAddress` only exists
  // on the client, so the first paint always renders request-mode
  // and the post-mount effect upgrades to claim-mode if a faucet
  // address is available.
  const [faucetAddress, setFaucetAddress] = useState<Address | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFaucetAddress(resolveFaucetAddress());
  }, []);

  if (faucetAddress) {
    return <ClaimModeCard faucetAddress={faucetAddress} />;
  }
  return <RequestModeCard />;
}

type ClaimStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; txHash: `0x${string}` }
  | { kind: "wrong_network"; chainId: number | null }
  | { kind: "error"; message: string };

function ClaimModeCard({ faucetAddress }: { faucetAddress: Address }) {
  const { address, walletClient, chainId, isExpectedChain } = useWallet();
  const [status, setStatus] = useState<ClaimStatus>({ kind: "idle" });

  const baseSepoliaId = useMemo(
    () => (expectedChainId() === BASE_SEPOLIA.id ? BASE_SEPOLIA.id : null),
    [],
  );

  const onClaim = useCallback(async () => {
    if (!walletClient || !address) return;
    if (!isExpectedChain) {
      setStatus({ kind: "wrong_network", chainId });
      return;
    }
    setStatus({ kind: "pending" });
    try {
      const data = encodeFunctionData({
        abi: TESTNET_FAUCET_ABI,
        functionName: "claim",
      });
      const txHash = await walletClient.sendTransaction({
        account: address,
        chain: baseSepolia,
        to: faucetAddress,
        data,
      });
      setStatus({ kind: "success", txHash });
    } catch (err) {
      // Never log the wallet error verbatim — it can include
      // user-pasted strings. Show only the message field.
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Wallet rejected the claim.";
      setStatus({ kind: "error", message });
    }
  }, [address, chainId, faucetAddress, isExpectedChain, walletClient]);

  const canClick =
    !!address && !!walletClient && status.kind !== "pending";

  return (
    <Card testid="developers-console-mint">
      <CardHeader title="Claim Test Collateral" />
      <p
        data-testid="mint-tokens-status"
        className="text-[13px] text-zinc-400"
      >
        Click <span className="font-semibold text-zinc-100">Claim</span> to
        receive a fixed amount of each mock token from the public
        Base Sepolia faucet. There&apos;s a per-address cooldown
        enforced by the contract (default 6h); each call transfers
        the configured amounts atomically. You&apos;ll need a small
        amount of Base Sepolia ETH for gas.
      </p>

      <div
        data-testid="mint-tokens-tokens"
        className="grid gap-2 sm:grid-cols-3"
      >
        {TESTNET_FAUCET_TOKENS.map((t) => (
          <div
            key={t.symbol}
            data-testid={`mint-tokens-token-${t.symbol}`}
            data-token-symbol={t.symbol}
            data-token-address={t.address}
            data-token-claim-amount-human={t.claimAmountHuman}
            className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-[12px]"
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-zinc-100">
                {t.symbol}
              </span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                +{t.claimAmountHuman}
              </span>
            </div>
            <p className="mb-2 text-zinc-400">{t.blurb}</p>
            <div className="flex items-center gap-1.5">
              <code
                className="truncate font-mono text-[11px] text-zinc-300"
                title={t.address}
                style={{ fontFamily: "var(--app-font-mono)" }}
              >
                {t.address.slice(0, 8)}…{t.address.slice(-6)}
              </code>
              <CopyButton
                value={t.address}
                testid={`mint-tokens-token-${t.symbol}-copy`}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        data-testid="mint-tokens-claim"
        data-faucet-address={faucetAddress}
        className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] p-3 text-[12px] text-zinc-300"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Faucet
          </span>
          <code
            data-testid="mint-tokens-faucet-address"
            className="font-mono text-[12px] text-zinc-200"
            style={{ fontFamily: "var(--app-font-mono)" }}
          >
            {faucetAddress}
          </code>
          <CopyButton
            value={faucetAddress}
            testid="mint-tokens-faucet-address-copy"
          />
        </div>
        {!address ? (
          <p
            data-testid="mint-tokens-no-wallet"
            className="text-zinc-500"
          >
            Connect your wallet (top right) to enable the claim
            button.
          </p>
        ) : !isExpectedChain ? (
          <div className="flex flex-col gap-1">
            <p
              data-testid="mint-tokens-wrong-network"
              className="text-zinc-400"
            >
              Switch your wallet to Base Sepolia (chain id{" "}
              <span className="font-mono text-zinc-200">
                {baseSepoliaId ?? 84532}
              </span>
              ) to claim — the page banner has the switch button.
            </p>
          </div>
        ) : (
          <button
            type="button"
            data-testid="mint-tokens-claim-button"
            data-claim-status={status.kind}
            disabled={!canClick}
            onClick={onClaim}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[13px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.kind === "pending" ? "Claiming…" : "Claim"}
          </button>
        )}

        {status.kind === "success" ? (
          <p
            data-testid="mint-tokens-claim-success"
            className="text-zinc-300"
          >
            Claim broadcast — tx{" "}
            <a
              href={`https://sepolia.basescan.org/tx/${status.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mint-tokens-claim-tx-link"
              data-tx-hash={status.txHash}
              className="font-mono text-emerald-300 underline-offset-2 hover:underline"
              style={{ fontFamily: "var(--app-font-mono)" }}
            >
              {status.txHash.slice(0, 10)}…{status.txHash.slice(-8)}
            </a>
            . Wait for confirmation before you trade.
          </p>
        ) : null}

        {status.kind === "error" ? (
          <p
            data-testid="mint-tokens-claim-error"
            className="text-zinc-400"
          >
            Claim failed:{" "}
            <span className="text-zinc-200">{status.message}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function RequestModeCard() {
  const { address } = useWallet();
  return (
    <Card testid="developers-console-mint">
      <CardHeader title="Request Test Collateral" />
      <p
        data-testid="mint-tokens-status"
        className="text-[13px] text-zinc-400"
      >
        The Base Sepolia mock collateral / underlying tokens are{" "}
        <span className="text-zinc-200">deployed</span> but their
        <code className="mx-1 rounded bg-zinc-900 px-1 py-0.5 font-mono text-[12px] text-zinc-200">
          mint
        </code>
        function is{" "}
        <span className="font-semibold text-zinc-100">owner-only</span> in
        this beta. A public-callable faucet contract lands in
        {" "}
        <span className="text-zinc-200">TESTNET-PUBLIC-FAUCET-CONTRACT-V1</span>;
        until then, the operator mints on request.
      </p>

      <div
        data-testid="mint-tokens-tokens"
        className="grid gap-2 sm:grid-cols-3"
      >
        {TESTNET_FAUCET_TOKENS.map((t) => (
          <div
            key={t.symbol}
            data-testid={`mint-tokens-token-${t.symbol}`}
            data-token-symbol={t.symbol}
            data-token-address={t.address}
            className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-[12px]"
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-zinc-100">
                {t.symbol}
              </span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {t.decimals} dec
              </span>
            </div>
            <p className="mb-2 text-zinc-400">{t.blurb}</p>
            <div className="flex items-center gap-1.5">
              <code
                className="truncate font-mono text-[11px] text-zinc-300"
                title={t.address}
                style={{ fontFamily: "var(--app-font-mono)" }}
              >
                {t.address.slice(0, 8)}…{t.address.slice(-6)}
              </code>
              <CopyButton
                value={t.address}
                testid={`mint-tokens-token-${t.symbol}-copy`}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        data-testid="mint-tokens-request"
        className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] p-3 text-[12px] text-zinc-300"
      >
        <p>
          To request a top-up, send the operator your connected wallet
          address — either via{" "}
          <a
            href={TESTNET_FAUCET_REQUEST_DISCORD}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mint-tokens-discord-link"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            Discord
          </a>{" "}
          or the{" "}
          <Link
            href="/feedback"
            data-testid="mint-tokens-feedback-link"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            feedback page
          </Link>
          . You&apos;ll need Base Sepolia ETH for gas separately (any
          public Base Sepolia faucet — see the{" "}
          <Link
            href="/docs/quickstart"
            data-testid="mint-tokens-quickstart-link"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            5-minute tester quickstart
          </Link>
          ).
        </p>
        {address ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              Your address
            </span>
            <code
              data-testid="mint-tokens-connected-address"
              className="font-mono text-[12px] text-zinc-100"
              style={{ fontFamily: "var(--app-font-mono)" }}
            >
              {address}
            </code>
            <CopyButton value={address} testid="mint-tokens-address-copy" />
          </div>
        ) : (
          <p
            data-testid="mint-tokens-no-wallet"
            className="text-zinc-500"
          >
            Connect your wallet (top right) so you can copy your
            address into the request — the operator needs it to mint.
          </p>
        )}
      </div>
    </Card>
  );
}

function SessionKeysCard() {
  return (
    <Card testid="developers-console-session-keys">
      <CardHeader title="Session Keys" />
      <DisabledButton testid="session-keys-register" leadingPlus>
        Register Session Key
      </DisabledButton>
      <PlannedTable
        testid="session-keys-table"
        headers={[
          "Session Key",
          "Public Address",
          "Scope",
          "Status",
          "Registered At",
          "Expiry",
          "Expires In",
          "",
        ]}
        emptyText="No session keys registered"
      />
    </Card>
  );
}

function SubaccountsCard() {
  const {
    address,
    subaccounts,
    activeSubaccountId,
    isLoadingSubaccounts,
    subaccountsError,
    createSubaccount,
    refreshSubaccounts,
  } = useWallet();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!address || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createSubaccount(null);
    } catch (e) {
      setCreateError((e as Error).message || "Failed to create subaccount");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card testid="developers-console-subaccounts">
      <CardHeader title="Subaccounts" />
      <p className="text-[12px] leading-snug text-zinc-500">
        Subaccounts isolate Options orderbook activity per{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">
          (owner, subaccount_id)
        </code>
        . RFQ and Perps subaccount routing are not live yet.
      </p>
      {address ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            data-testid="subaccounts-create"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-[13px] text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-emerald-400">+</span>
            {creating ? "Creating…" : "Create Subaccount"}
          </button>
          <button
            type="button"
            onClick={() => void refreshSubaccounts()}
            data-testid="subaccounts-refresh"
            className="text-[12px] text-zinc-400 underline hover:text-zinc-200"
          >
            Refresh
          </button>
          <span
            data-testid="subaccounts-active-id"
            className="text-[12px] text-zinc-500"
          >
            Active: Account {activeSubaccountId}
          </span>
        </div>
      ) : (
        <DisabledButton testid="subaccounts-create" leadingPlus>
          Connect wallet to create
        </DisabledButton>
      )}
      {createError ? (
        <p
          data-testid="subaccounts-create-error"
          role="alert"
          className="rounded border border-red-500/40 bg-red-950/30 px-2 py-1 text-[12px] text-red-200"
        >
          {createError}
        </p>
      ) : null}
      {subaccountsError ? (
        <p
          data-testid="subaccounts-list-error"
          role="alert"
          className="rounded border border-red-500/40 bg-red-950/30 px-2 py-1 text-[12px] text-red-200"
        >
          {subaccountsError}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table
          data-testid="subaccounts-table"
          className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
        >
          <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              {["Id", "Display", "Custom name", "Created", ""].map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className="whitespace-nowrap border-b border-zinc-900 px-2 py-2 text-left font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!address ? (
              <tr>
                <td
                  colSpan={5}
                  data-testid="subaccounts-table-disconnected"
                  className="px-2 py-6 text-center text-[13px] text-zinc-500"
                >
                  Connect a wallet to see your subaccounts.
                </td>
              </tr>
            ) : isLoadingSubaccounts && subaccounts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  data-testid="subaccounts-table-loading"
                  className="px-2 py-6 text-center text-[13px] text-zinc-500"
                >
                  Loading…
                </td>
              </tr>
            ) : subaccounts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  data-testid="subaccounts-table-empty"
                  className="px-2 py-6 text-center text-[13px] text-zinc-500"
                >
                  No subaccounts yet.
                </td>
              </tr>
            ) : (
              subaccounts.map((s) => (
                <tr
                  key={s.subaccount_id}
                  data-testid={`subaccounts-row-${s.subaccount_id}`}
                  data-active={
                    s.subaccount_id === activeSubaccountId ? "true" : "false"
                  }
                  className="border-b border-zinc-900"
                >
                  <td className="px-2 py-2 font-mono text-zinc-300">
                    {s.subaccount_id}
                  </td>
                  <td className="px-2 py-2 text-zinc-300">
                    {s.display_name}
                  </td>
                  <td className="px-2 py-2 text-zinc-400">
                    {s.name ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-zinc-500">
                    {new Date(s.created_at_ms).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-2 py-2 text-right text-[11px]">
                    {s.subaccount_id === activeSubaccountId ? (
                      <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-emerald-300">
                        active
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <SubaccountsApiHints />
    </Card>
  );
}

function SubaccountsApiHints() {
  return (
    <div
      data-testid="subaccounts-api-hints"
      className="mt-2 rounded border border-zinc-900 bg-zinc-950 p-2 text-[11px] text-zinc-400"
    >
      <p className="mb-1 font-semibold text-zinc-300">
        Options API — subaccount usage
      </p>
      <ul className="space-y-1 leading-snug">
        <li>
          <code className="text-zinc-300">GET /options/orders?account=…&amp;subaccount_id=N</code>
          {" "}— reads default to subaccount 1 when the param is omitted.
        </li>
        <li>
          <code className="text-zinc-300">POST /options/orders</code> — mutation
          bodies include <code>subaccount_id</code>; non-default requires the
          write-auth envelope to carry <code>&quot;version&quot;: 2</code>.
        </li>
        <li>
          <code className="text-zinc-300">
            GET /accounts/:address/history/v2?subaccount_id=N&amp;all=false
          </code>{" "}
          — history filters trades + orders by subaccount; transactions tab is
          wallet-aggregate.
        </li>
        <li>
          RFQ and Perps do not accept <code>subaccount_id</code> yet.
        </li>
      </ul>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      data-testid="developers-console-footer"
      className="flex flex-col gap-2 border-t border-zinc-900 pt-4 text-[12px] text-zinc-500"
    >
      <p data-testid="developers-console-mm-note">
        MM Gateway is a separate, operator-whitelisted WebTransport surface —
        not exposed to public users or bots.{" "}
        <a
          href={docsPath("/developers/mm-gateway")}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="developers-console-mm-link"
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          Read more
        </a>
        .
      </p>
      <p>
        <Link
          href="/api/sandbox"
          data-testid="developers-console-sandbox-link"
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          Open the WebSocket sandbox →
        </Link>
      </p>
      <p>
        <Link
          href="/api/orderbook-sandbox"
          data-testid="developers-console-orderbook-sandbox-link"
          className="text-emerald-300 underline-offset-2 hover:underline"
        >
          Open the options orderbook sandbox (GTC / IOC / FOK / post-only) →
        </Link>
      </p>
    </footer>
  );
}

// ── Primitives ────────────────────────────────────────────────────

function Card({
  testid,
  children,
}: {
  testid: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testid}
      className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black p-5"
    >
      {children}
    </section>
  );
}

function CardHeader({ title }: { title: string }) {
  return <h2 className="text-[18px] font-semibold text-zinc-100">{title}</h2>;
}

function DisabledButton({
  children,
  testid,
  leadingPlus,
}: {
  children: ReactNode;
  testid: string;
  leadingPlus?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      data-testid={testid}
      title="Backend support ships in a later milestone."
      className="inline-flex w-fit cursor-not-allowed items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-[13px] text-zinc-300"
    >
      {leadingPlus ? <span className="text-zinc-500">+</span> : null}
      {children}
    </button>
  );
}

interface PlannedTableProps {
  testid: string;
  headers: string[];
  emptyText: string;
}

function PlannedTable({ testid, headers, emptyText }: PlannedTableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        data-testid={testid}
        className="w-full min-w-full border-separate border-spacing-0 text-[13px]"
      >
        <thead className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          <tr>
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className="whitespace-nowrap border-b border-zinc-900 px-2 py-2 text-left font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              colSpan={headers.length}
              data-testid={`${testid}-empty`}
              className="px-2 py-6 text-center text-[13px] text-zinc-500"
            >
              {emptyText}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function IconLink({
  href,
  label,
  icon,
  external,
  testid,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  external?: boolean;
  testid?: string;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      data-testid={testid}
      className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-emerald-200"
    >
      <span aria-hidden="true" className="text-zinc-500">
        {icon}
      </span>
      <span>{label}</span>
    </a>
  );
}

function CopyButton({ value, testid }: { value: string; testid: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => undefined);
  }, [value]);
  return (
    <button
      type="button"
      onClick={onCopy}
      data-testid={testid}
      aria-label="Copy address"
      className="rounded p-1 text-zinc-500 hover:text-emerald-200"
    >
      {copied ? (
        <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">
          Copied
        </span>
      ) : (
        <CopyIcon />
      )}
    </button>
  );
}

// ── Icons (inline, no dep) ────────────────────────────────────────

function svgProps(size = 14) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function BookIcon() {
  return (
    <svg {...svgProps()} aria-hidden="true">
      <path d="M2.5 3.5h7.5a2 2 0 0 1 2 2v7H4.5a2 2 0 0 1-2-2v-7Z" />
      <path d="M2.5 3.5h.5v9h-.5" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg {...svgProps()} aria-hidden="true">
      <path d="M5 4 2 8l3 4" />
      <path d="m11 4 3 4-3 4" />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg {...svgProps()} aria-hidden="true">
      <path d="M8 1.5a6.5 6.5 0 0 0-2.05 12.66c.32.06.44-.14.44-.31v-1.1c-1.78.39-2.16-.86-2.16-.86-.29-.74-.71-.94-.71-.94-.58-.4.04-.39.04-.39.64.05.98.66.98.66.57.98 1.5.7 1.87.53.06-.42.22-.7.4-.86-1.42-.16-2.91-.71-2.91-3.17 0-.7.25-1.27.66-1.72-.06-.16-.29-.82.06-1.71 0 0 .54-.17 1.78.66a6.13 6.13 0 0 1 3.24 0c1.24-.83 1.78-.66 1.78-.66.35.89.13 1.55.06 1.71.41.45.66 1.02.66 1.72 0 2.47-1.49 3-2.91 3.17.23.2.43.59.43 1.19v1.76c0 .17.12.37.45.31A6.5 6.5 0 0 0 8 1.5Z" />
    </svg>
  );
}
function FlaskIcon() {
  return (
    <svg {...svgProps()} aria-hidden="true">
      <path d="M6 2h4" />
      <path d="M6.5 2v4.5L3 12.5a1.5 1.5 0 0 0 1.3 2.25h7.4A1.5 1.5 0 0 0 13 12.5L9.5 6.5V2" />
      <path d="M5 10h6" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg {...svgProps(13)} aria-hidden="true">
      <rect x="5" y="5" width="8" height="9" rx="1.2" />
      <path d="M3 11V3a1 1 0 0 1 1-1h7" />
    </svg>
  );
}
