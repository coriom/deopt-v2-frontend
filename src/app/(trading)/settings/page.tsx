import { BrightnessSlider } from "@/components/settings/BrightnessSlider";
import { LanguageSelect } from "@/components/settings/LanguageSelect";

export const metadata = {
  title: "Settings — DeOpt public testnet beta",
};

export default function SettingsPage() {
  return (
    <div
      data-testid="settings-page"
      className="flex h-full min-h-0 w-full flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <section
          data-testid="settings-section-preferences"
          className="flex flex-col gap-3"
        >
          <LanguageSelect />
          <BrightnessSlider />
        </section>
      </div>

      <footer
        data-testid="settings-page-footer"
        className="flex h-10 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-500"
      >
        <span data-testid="settings-page-footer-status"></span>
        <div
          data-testid="settings-page-footer-actions"
          className="flex items-center gap-2"
        ></div>
      </footer>
    </div>
  );
}
