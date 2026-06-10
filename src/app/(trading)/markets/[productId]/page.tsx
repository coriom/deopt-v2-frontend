import { OptionChain } from "@/components/trading/OptionChain";
import { RfqPanel } from "@/components/trading/RfqPanel";

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { productId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <OptionChain productId={productId} />
      <section className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold">RFQ (request a quote)</h2>
        <RfqPanel seriesId={null} />
      </section>
    </div>
  );
}
