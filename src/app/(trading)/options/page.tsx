import { Workspace } from "@/components/workspace/Workspace";

export default function OptionsPage() {
  return (
    <div data-testid="options-shell" className="flex h-full min-h-0 flex-col">
      <Workspace
        workspaceId="options"
        title="Options workspace"
        subtitle="modular · v2 · resizable"
      />
    </div>
  );
}
