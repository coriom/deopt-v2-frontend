"use client";

import { NativeSelect } from "@/components/ui/NativeSelect";
import { SUPPORTED_LOCALES } from "@/lib/language";
import { useLanguage } from "@/lib/language-context";

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();
  return (
    <label
      data-testid="settings-language-field"
      className="flex items-center gap-3 text-[13px] text-zinc-300"
    >
      <span className="min-w-24 text-zinc-400">Language</span>
      <NativeSelect
        data-testid="settings-language-select"
        aria-label="Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        variant="bordered"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.labelNative}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
