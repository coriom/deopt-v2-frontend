import { HistoryShell } from "@/components/history/HistoryShell";

export const metadata = {
  title: "History — DeOpt public testnet beta",
};

export default function HistoryPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <HistoryShell />
    </div>
  );
}
