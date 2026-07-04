import { RfqStrategyWorkspace } from "@/components/rfq-strategy/RfqStrategyWorkspace";

export const metadata = {
  title: "RFQ/Strategy — DeOpt public testnet beta",
};

export default function RfqStrategyPage() {
  return (
    <div data-testid="rfq-strategy-page" className="flex h-full min-h-0 flex-col">
      <RfqStrategyWorkspace />
    </div>
  );
}
