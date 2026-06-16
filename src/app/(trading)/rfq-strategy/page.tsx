import { PlaceholderPage } from "@/components/PlaceholderPage";

export const metadata = {
  title: "RFQ/Strategy — DeOpt public testnet beta",
};

export default function RfqStrategyPage() {
  return (
    <PlaceholderPage
      testid="rfq-strategy-page"
      title="RFQ / Strategy"
      summary={
        <>
          A request-for-quote workflow and multi-leg strategy builder are
          being prepared for the public testnet beta. There is no live RFQ
          executor yet — nothing on this page is wired to an order router,
          market-maker network, or any production system.
        </>
      }
      reliableNow={[
        "Every product traded today routes through the standard intent → sign → executor flow on Base Sepolia (chain 84532). No RFQ side-channel exists yet.",
        "Multi-leg strategies (spreads, condors, straddles) are not yet expressed as a single intent — they would need to be composed manually for now.",
        "There is no maker / liquidity-provider onboarding in this beta.",
      ]}
      landsLater={[
        "Quote-request submission against a registered set of testnet makers.",
        "Strategy builder with payoff preview for common option structures.",
        "Strategy-aware margining once the cross-margin path lands.",
      ]}
    />
  );
}
