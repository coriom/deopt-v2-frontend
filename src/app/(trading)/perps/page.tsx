import { Workspace } from "@/components/workspace/Workspace";

export default function PerpsPage() {
  return (
    <div
      data-testid="perps-terminal-shell"
      className="flex h-full min-h-0 flex-col"
    >
      <Workspace
        workspaceId="perps"
        title="Perps workspace"
        subtitle="modular · v2 · resizable · placeholder · perps not live"
      />
    </div>
  );
}
