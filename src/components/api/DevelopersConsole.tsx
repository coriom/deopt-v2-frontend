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
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useWallet } from "@/lib/wallet";
import { docsPath } from "@/lib/docs-url";

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

function MintTokensCard() {
  return (
    <Card testid="developers-console-mint">
      <CardHeader title="Mint Tokens" />
      <p className="text-[13px] text-zinc-400">
        Minting is not wired into the terminal. The faucet flow lands in a
        later milestone.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <DisabledButton testid="mint-tokens-action">
          Mint UI planned
        </DisabledButton>
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
  return (
    <Card testid="developers-console-subaccounts">
      <CardHeader title="Subaccounts" />
      <DisabledButton testid="subaccounts-create" leadingPlus>
        Create Subaccount
      </DisabledButton>
      <PlannedTable
        testid="subaccounts-table"
        headers={["Subaccount", "Purpose", "Margin Mode", "Status", ""]}
        emptyText="No subaccounts configured"
      />
    </Card>
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
