import Link from "next/link";
import { WsQuickTest } from "@/components/api/WsQuickTest";

export const metadata = {
  title: "WebSocket Sandbox — DeOpt",
};

export default function ApiSandboxPage() {
  return (
    <div
      data-testid="api-sandbox-scroll"
      className="deopt-scroll-dark flex h-full min-h-0 flex-col overflow-y-auto"
    >
      <div
        data-testid="api-sandbox-page"
        className="mx-auto flex w-full max-w-4xl flex-col gap-4 bg-black px-6 py-8 text-zinc-200"
      >
        <header className="flex flex-col gap-2 border-b border-zinc-900 pb-4">
          <Link
            href="/api"
            data-testid="api-sandbox-back"
            className="text-[12px] text-zinc-500 hover:text-emerald-200"
          >
            ← Developers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            WebSocket Sandbox
          </h1>
          <p className="text-[13px] text-zinc-400">
            Connect, ping, and subscribe to public channels. Never auto-connects.
          </p>
        </header>
        <WsQuickTest />
      </div>
    </div>
  );
}
