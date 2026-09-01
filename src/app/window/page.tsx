import { Workspace } from "@/components/workspace/Workspace";
import { WidgetMenuButton } from "@/components/workspace/WidgetMenuButton";

export const metadata = {
  title: "DeOpt — window",
};

/**
 * Bare "detached window" workspace surface. Renders a full-viewport
 * Custom workspace with a single floating Widget menu button in the
 * top-right corner. No navbar, no wallet, no beta strip — the whole
 * canvas is customisable.
 *
 * Widget state persists to the same localStorage bucket as
 * `/custom` (workspaceId = `custom-1`), so the popup effectively
 * mirrors / shares the main window's Custom board. This is intentional
 * — it lets operators pin the same working set on a second monitor.
 */
export default function WindowPage() {
  return (
    <div
      data-testid="window-page"
      className="relative flex h-full min-h-0 flex-col"
    >
      <div
        data-testid="window-widget-menu-slot"
        // Sits above the workspace so the popover opens over widgets
        // instead of behind them. Bottom-left keeps it clear of the
        // per-widget kebab menus (top-1 right-1.5) and the corner
        // resize handles (bottom-right).
        className="pointer-events-none absolute bottom-3 left-3 z-40"
      >
        <div className="pointer-events-auto">
          <WidgetMenuButton placement="above-left" />
        </div>
      </div>
      <Workspace workspaceId="custom-1" title="" />
    </div>
  );
}
