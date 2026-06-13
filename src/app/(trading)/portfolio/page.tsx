import { PortfolioSummary } from "@/components/trading/PortfolioSummary";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { BalancesCard } from "@/components/trading/BalancesCard";

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <p
          data-testid="portfolio-testnet-only-banner"
          className="text-xs text-zinc-600 dark:text-zinc-400"
        >
          Testnet only — Base Sepolia (chain 84532). All balances and
          positions are denominated in mock tokens with zero real-world
          value. Refresh manually if data looks out of date; the backend
          indexer reconciles on its own ticker.
        </p>
      </header>
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
