import { ApiShell } from "@/components/api/ApiShell";

export const metadata = {
  title: "API — DeOpt public testnet beta",
};

export default function ApiPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ApiShell />
    </div>
  );
}
