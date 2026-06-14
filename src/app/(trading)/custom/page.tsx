import { Workspace } from "@/components/workspace/Workspace";

export default function CustomPage() {
  return (
    <div data-testid="custom-shell" className="flex h-full min-h-0 flex-col">
      <Workspace
        workspaceId="custom-1"
        title="Custom workspace"
        subtitle="modular · v2 · resizable"
      />
    </div>
  );
}
