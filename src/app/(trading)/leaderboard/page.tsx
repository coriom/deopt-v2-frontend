import { LeaderboardShell } from "@/components/leaderboard/LeaderboardShell";

export const metadata = {
  title: "Leaderboard — DeOpt public testnet beta",
};

export default function LeaderboardPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <LeaderboardShell />
    </div>
  );
}
