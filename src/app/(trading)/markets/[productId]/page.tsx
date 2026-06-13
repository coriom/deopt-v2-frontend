import Link from "next/link";
import { OptionChain } from "@/components/trading/OptionChain";
import { RfqPanel } from "@/components/trading/RfqPanel";
import { TestnetReadinessHelper } from "@/components/trading/TestnetReadinessHelper";

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { productId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-[11px]">
        <Link
          href="/markets"
          className="text-emerald-300 hover:text-emerald-200"
        >
          ← Back to markets
        </Link>
      </nav>
      <TestnetReadinessHelper />
      <OptionChain productId={productId} />
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="mb-2 text-sm font-semibold tracking-tight text-emerald-200">
          RFQ (request a quote)
        </h2>
        <p className="mb-3 text-[11px] text-zinc-400">
          Optional: ask a counterparty for a quote. Testnet only — no real
          counterparties are guaranteed during the public beta. If you don&apos;t
          see a response, the orderbook path above remains the primary flow.
        </p>
        <RfqPanel seriesId={null} />
      </section>
    </div>
  );
}
