import { FundingsShell } from "@/components/fundings/FundingsShell";

export const metadata = {
  title: "Funding — DeOpt",
};

export default function FundingsPage() {
  return (
    <div
      data-testid="fundings-scroll"
      className="deopt-scroll-dark flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <FundingsShell />
    </div>
  );
}
