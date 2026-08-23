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
      <div className="deopt-scroll-dark min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-10">
          <header
            data-testid="settings-header"
            className="flex flex-col gap-1"
          >
            <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
          </header>

          <section
            data-testid="settings-section-preferences"
            aria-labelledby="settings-section-preferences-title"
            className="flex flex-col gap-3"
          >
            <h2
              id="settings-section-preferences-title"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
            >
              Preferences
            </h2>
            <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2">
              <LanguageSelect />
              <BrightnessSlider />
            </div>
          </section>
        </div>
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
