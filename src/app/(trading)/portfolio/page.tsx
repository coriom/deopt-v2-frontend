import { PortfolioSummary } from "@/components/trading/PortfolioSummary";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { BalancesCard } from "@/components/trading/BalancesCard";

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Portfolio</h1>
      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Summary</h2>
        <PortfolioSummary />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Positions</h2>
        <PositionsTable />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Balances</h2>
        <BalancesCard />
      </section>
    </div>
  );
}
