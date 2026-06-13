import { Workspace } from "@/components/workspace/Workspace";

export default function TradePage() {
  return (
    <div data-testid="trade-shell" className="flex flex-col gap-2">
      <Workspace
        workspaceId="options"
        title="Options workspace"
        subtitle="modular · v1"
      />
    </div>
  );
}
