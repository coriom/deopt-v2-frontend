import { Workspace } from "@/components/workspace/Workspace";

export default function TradePage() {
  return (
    <div data-testid="trade-shell" className="flex h-full min-h-0 flex-col">
      <Workspace
        workspaceId="options"
        title="Options workspace"
        subtitle="modular · v2 · resizable"
      />
    </div>
  );
}
