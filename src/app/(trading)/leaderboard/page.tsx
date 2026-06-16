import { PlaceholderPage } from "@/components/PlaceholderPage";

export const metadata = {
  title: "Leaderboard — DeOpt public testnet beta",
};

export default function LeaderboardPage() {
  return (
    <PlaceholderPage
      testid="leaderboard-page"
      title="Leaderboard"
      summary={
        <>
          The testnet leaderboard is being prepared. There is no scoring
          rubric, no rewards program, and no real value attached to any
          ranking on Base Sepolia. Nothing here implies a future mainnet
          payout.
        </>
      }
      reliableNow={[
        "Per-wallet trade history is already reachable on the /history route — that is the only authoritative per-wallet record today.",
        "There is no public ranking endpoint, no points balance, and no rewards token in this build.",
        "Scoring criteria are not yet defined; treat anything you see as illustrative only.",
      ]}
      landsLater={[
        "Public testnet leaderboard with documented scoring criteria.",
        "Volume / PnL / activity breakdowns per wallet, opt-in.",
        "Cross-workspace highlights (top options strategies, top perps, etc.) once perps go live.",
      ]}
    />
  );
}
