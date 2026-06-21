import Link from "next/link";
import { DirectOrderbookForm } from "@/components/trading/DirectOrderbookForm";

export const metadata = {
  title: "Options Orderbook Sandbox — DeOpt",
};

export default function OrderbookSandboxPage() {
  return (
    <div
      data-testid="orderbook-sandbox-scroll"
      className="deopt-scroll-dark flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <div
        data-testid="orderbook-sandbox-page"
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 bg-black px-6 py-8 text-zinc-200"
      >
        <header className="flex flex-col gap-2 border-b border-zinc-900 pb-4">
          <Link
            href="/api"
            data-testid="orderbook-sandbox-back"
            className="text-[12px] text-zinc-500 hover:text-emerald-200"
          >
            ← Developers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Options Orderbook Sandbox
          </h1>
          <p className="text-[13px] text-zinc-400">
            Submit a direct options order against the backend matching
            engine and observe the deterministic Time-In-Force /
            post-only semantics shipped in{" "}
            <code className="rounded bg-zinc-900 px-1 text-emerald-300">
              MATCHING-TIF-SEMANTICS-OPTIONS-V1
            </code>
            .
          </p>
          <ul className="ml-4 list-disc text-[12px] text-zinc-400">
            <li>
              <strong className="text-zinc-200">GTC</strong> — remainder
              rests (status <code>open</code> /{" "}
              <code>partially_filled</code>).
            </li>
            <li>
              <strong className="text-zinc-200">IOC</strong> — remainder
              is cancelled, status <code>cancelled</code>, never appears
              as resting liquidity.
            </li>
            <li>
              <strong className="text-zinc-200">FOK</strong> — atomic
              full fill or stable 400{" "}
              <code>fill-or-kill order is not fully fillable</code> with
              zero mutation.
            </li>
            <li>
              <strong className="text-zinc-200">Post-only</strong> —
              rejected with 400{" "}
              <code>post-only order would immediately match</code> when
              marketable.
            </li>
          </ul>
          <p className="text-[11px] text-zinc-500">
            Distinct from the paired RFQ execution-intent flow on the{" "}
            <Link
              href="/options"
              className="text-emerald-300 underline-offset-2 hover:underline"
            >
              /options
            </Link>{" "}
            trade ticket — that one always behaves as GTC and ignores
            post-only.
          </p>
        </header>
        <DirectOrderbookForm />
      </div>
    </div>
  );
}
