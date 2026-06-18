import { DevelopersConsole } from "@/components/api/DevelopersConsole";

export const metadata = {
  title: "Developers — DeOpt",
};

export default function ApiPage() {
  return (
    <div
      data-testid="api-scroll"
      className="deopt-scroll-dark flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <DevelopersConsole />
    </div>
  );
}
