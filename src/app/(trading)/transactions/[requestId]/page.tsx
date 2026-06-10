import { TxStatusTimeline } from "@/components/tx/TxStatusTimeline";

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function TxPage({ params }: PageProps) {
  const { requestId } = await params;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Transaction</h1>
      <TxStatusTimeline requestId={requestId} />
    </div>
  );
}
