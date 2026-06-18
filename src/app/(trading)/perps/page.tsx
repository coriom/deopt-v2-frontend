import { Workspace } from "@/components/workspace/Workspace";
import { PerpsSymbolProvider } from "@/lib/perps-symbol";

export default function PerpsPage() {
  return (
    <div
      data-testid="perps-terminal-shell"
      className="flex h-full min-h-0 flex-col"
    >
      <PerpsSymbolProvider>
        <Workspace
          workspaceId="perps"
          title="Perps workspace"
          subtitle="modular · v2 · resizable"
        />
      </PerpsSymbolProvider>
    </div>
  );
}
