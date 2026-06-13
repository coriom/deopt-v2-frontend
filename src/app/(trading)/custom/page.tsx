import { Workspace } from "@/components/workspace/Workspace";

export default function CustomPage() {
  return (
    <div data-testid="custom-shell" className="flex flex-col gap-2">
      <Workspace
        workspaceId="custom-1"
        title="Custom workspace"
        subtitle="modular · v1"
      />
    </div>
  );
}
