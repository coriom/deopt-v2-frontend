import { FeesShell } from "@/components/fees/FeesShell";

export const metadata = {
  title: "Fees — DeOpt",
};

export default function FeesPage() {
  return (
    <div
      data-testid="fees-scroll"
      className="deopt-scroll-dark flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <FeesShell />
    </div>
  );
}
