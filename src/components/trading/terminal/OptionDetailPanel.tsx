"use client";

import { useState } from "react";
import Link from "next/link";
import type { OptionLeg, OptionsChainRow } from "@/lib/options-chain-model";
import { PayoffSvg } from "./PayoffSvg";

type Tab = "trade" | "payoff" | "greeks" | "details" | "risk";

interface OptionDetailPanelProps {
  leg: OptionLeg | null;
  row: OptionsChainRow | null;
  productId: string | null;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "trade", label: "Trade" },
  { id: "payoff", label: "Payoff" },
  { id: "greeks", label: "Greeks" },
  { id: "details", label: "Details" },
  { id: "risk", label: "Risk" },
];

function shortHash(s: string | null): string {
  if (!s) return "—";
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export function OptionDetailPanel({
  leg,
  row,
  productId,
}: OptionDetailPanelProps) {
  const [tab, setTab] = useState<Tab>("trade");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("1");

  if (!leg || !row) {
    return (
      <aside
        data-testid="detail-panel-empty"
        className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-[12px] text-zinc-400"
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          Detail panel
        </span>
        <p className="text-center">
          Click a Call or Put cell in the chain to load its details, preview a
          quote, and exercise the testnet trade flow.
        </p>
      </aside>
    );
  }

  const typeLabel = leg.isCall ? "CALL" : "PUT";

  return (
    <aside
      data-testid="detail-panel"
      data-series-id={leg.seriesId ?? ""}
      data-is-call={leg.isCall ? "true" : "false"}
      className="flex h-full flex-col gap-3 rounded-lg border border-emerald-500/30 bg-zinc-950 p-4"
    >
      <header className="flex flex-col gap-1 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span
            data-testid="detail-type-badge"
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              leg.isCall
                ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                : "border border-zinc-600 bg-zinc-900 text-zinc-200"
            }`}
          >
            {typeLabel}
          </span>
          <span
            data-testid="detail-strike-label"
            className="text-lg font-semibold tracking-tight text-zinc-100"
          >
            K = {row.strikeLabel}
          </span>
          <span className="text-[11px] text-zinc-500">· exp {row.expiryLabel}</span>
        </div>
        <span
          data-testid="detail-series-id"
          className="font-mono text-[10px] text-zinc-500"
        >
          {shortHash(leg.seriesId)}
        </span>
      </header>

      <nav
        role="tablist"
        aria-label="Detail panel tabs"
        data-testid="detail-tabs"
        className="flex flex-wrap gap-1 border-b border-zinc-800 pb-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            data-testid={`detail-tab-${t.id}`}
            data-selected={tab === t.id ? "true" : "false"}
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              tab === t.id
                ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                : "border border-transparent text-zinc-400 hover:text-emerald-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        aria-label={tab}
        data-testid={`detail-panel-content-${tab}`}
        className="flex flex-col gap-3 overflow-y-auto"
      >
        {tab === "trade" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2" role="group" aria-label="Trade side">
              <button
                type="button"
                onClick={() => setSide("buy")}
                data-testid="detail-side-buy"
                data-selected={side === "buy" ? "true" : "false"}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
                  side === "buy"
                    ? "border border-emerald-500/60 bg-emerald-500 text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-200 hover:border-emerald-500/40"
                }`}
              >
                Buy (long)
              </button>
              <button
                type="button"
                onClick={() => setSide("sell")}
                data-testid="detail-side-sell"
                data-selected={side === "sell" ? "true" : "false"}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
                  side === "sell"
                    ? "border border-red-500/60 bg-red-950/60 text-red-100"
                    : "border border-zinc-800 bg-black/40 text-zinc-200 hover:border-red-500/40"
                }`}
              >
                Sell (short)
              </button>
            </div>
            <label className="text-[11px] text-zinc-300">
              Quantity
              <input
                type="text"
                inputMode="numeric"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                data-testid="detail-quantity-input"
                className="mt-1 w-full rounded border border-zinc-800 bg-black/40 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <dl
              data-testid="detail-quote-grid"
              className="grid grid-cols-2 gap-1 rounded border border-zinc-800 bg-black/40 p-2 text-[11px]"
            >
              <dt className="text-zinc-500">Premium</dt>
              <dd className="text-right font-mono text-zinc-400">
                — <NaTag />
              </dd>
              <dt className="text-zinc-500">Buyer fee</dt>
              <dd className="text-right font-mono text-zinc-400">
                — <NaTag />
              </dd>
              <dt className="text-zinc-500">Seller fee</dt>
              <dd className="text-right font-mono text-zinc-400">
                — <NaTag />
              </dd>
              <dt className="text-zinc-500">Collateral required</dt>
              <dd className="text-right font-mono text-zinc-400">
                — <NaTag />
              </dd>
            </dl>
            <p className="text-[10px] leading-relaxed text-zinc-400">
              Live premium / fee / collateral preview is wired in
              <code className="mx-1 rounded border border-emerald-500/30 bg-black/40 px-1 text-emerald-200">
                /markets/[productId]
              </code>
              via{" "}
              <code className="mx-1 rounded border border-emerald-500/30 bg-black/40 px-1 text-emerald-200">
                QuotePreviewCard
              </code>{" "}
              + the create-intent + sign flow. Open the underlying product
              page to actually sign and submit a testnet trade.
            </p>
            {productId && leg.seriesId && (
              <Link
                href={`/markets/${productId}`}
                data-testid="detail-open-trade-ticket-cta"
                className="rounded bg-emerald-500 px-3 py-1.5 text-center text-xs font-semibold text-black hover:bg-emerald-400"
              >
                Open trade ticket for this product →
              </Link>
            )}
            <p className="text-[10px] text-zinc-500">
              Your wallet signs typed data. Nothing is broadcast from your
              wallet — the operator-side executor submits the testnet tx on
              Base Sepolia (chain 84532). No real funds.
            </p>
          </div>
        )}

        {tab === "payoff" && (
          <PayoffSvg
            isCall={leg.isCall}
            isBuy={side === "buy"}
            strikeLabel={row.strikeLabel}
          />
        )}

        {tab === "greeks" && (
          <div
            data-testid="detail-greeks"
            className="rounded border border-emerald-500/30 bg-black/40 p-3 text-[11px] text-emerald-200"
          >
            <div className="font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Greeks — coming soon in the testnet beta
            </div>
            <p className="mt-2 text-zinc-400">
              IV, Δ, Γ, ν, Θ are not exposed by the current backend. We will
              add them as the testnet matures. In the meantime, the chain is
              honest about it — every Greek cell renders &ldquo;—&rdquo;
              rather than inventing values.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-1 font-mono text-zinc-400">
              <dt>IV</dt>
              <dd className="text-right">
                — <NaTag />
              </dd>
              <dt>Δ (Delta)</dt>
              <dd className="text-right">
                — <NaTag />
              </dd>
              <dt>Γ (Gamma)</dt>
              <dd className="text-right">
                — <NaTag />
              </dd>
              <dt>ν (Vega)</dt>
              <dd className="text-right">
                — <NaTag />
              </dd>
              <dt>Θ (Theta)</dt>
              <dd className="text-right">
                — <NaTag />
              </dd>
            </dl>
          </div>
        )}

        {tab === "details" && (
          <dl
            data-testid="detail-details"
            className="grid grid-cols-[8rem_1fr] gap-1 rounded border border-zinc-800 bg-black/40 p-3 text-[11px]"
          >
            <dt className="text-zinc-500">Series id</dt>
            <dd className="break-all font-mono text-zinc-200">
              {leg.seriesId ?? "—"}
            </dd>
            <dt className="text-zinc-500">Product id</dt>
            <dd className="break-all font-mono text-zinc-200">
              {leg.productId ?? "—"}
            </dd>
            <dt className="text-zinc-500">Option type</dt>
            <dd className="font-mono text-zinc-200">{typeLabel}</dd>
            <dt className="text-zinc-500">Strike (1e8)</dt>
            <dd className="font-mono text-zinc-200">{row.strike1e8}</dd>
            <dt className="text-zinc-500">Expiry</dt>
            <dd className="font-mono text-zinc-200">
              {row.expiryLabel} ({row.expiryMs}ms)
            </dd>
            <dt className="text-zinc-500">Matching engine</dt>
            <dd className="break-all font-mono text-zinc-200">
              0x5a5EBF9A…2670f6
            </dd>
            <dt className="text-zinc-500">Margin engine</dt>
            <dd className="break-all font-mono text-zinc-200">
              0x506cD65a…fE00D30
            </dd>
            <dt className="text-zinc-500">Settlement</dt>
            <dd className="text-zinc-200">mUSDC (testnet mock, 6 decimals)</dd>
            <dt className="text-zinc-500">Oracle status</dt>
            <dd className="text-emerald-200">
              checked at quote time (60 s maxDelay)
            </dd>
            <dt className="text-zinc-500">Network</dt>
            <dd className="text-emerald-200">Base Sepolia · chain 84532</dd>
          </dl>
        )}

        {tab === "risk" && (
          <div
            data-testid="detail-risk"
            className="rounded border border-red-500/40 bg-red-950/30 p-3 text-[11px] text-red-100"
          >
            <div className="font-semibold uppercase tracking-[0.18em] text-red-200">
              Risk disclosures
            </div>
            <ul className="ml-4 mt-2 list-disc text-red-100">
              <li>
                <strong>Testnet only.</strong> All tokens are testnet mocks
                with zero real-world value.
              </li>
              <li>
                <strong>Unaudited.</strong> No external audit has been
                completed. A security-review packet is being prepared
                internally — that packet itself is not an audit.
              </li>
              <li>
                <strong>No real funds.</strong> Do not deposit real assets.
                Real-funds operations are not supported.
              </li>
              <li>
                <strong>Mock oracle.</strong> Testnet uses a 60 s{" "}
                <code>maxDelay</code> mock oracle; stale prices reject the
                trade rather than settling stale.
              </li>
              <li>
                <strong>Operator-controlled.</strong> Indexer, signer, backend
                are operator-controlled. Database may be reset.
              </li>
              <li>
                <strong>No financial advice.</strong> Nothing on this page is
                advice; this is an experimental sandbox.
              </li>
            </ul>
            <p className="mt-2 text-[10px] text-red-200">
              More detail in{" "}
              <Link
                href="/docs/limitations"
                className="underline decoration-red-300/40 underline-offset-4 hover:decoration-red-300"
              >
                /docs/limitations
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function NaTag() {
  return (
    <span className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0 text-[9px] uppercase tracking-wide text-zinc-500">
      n/a testnet
    </span>
  );
}
