"use client";

import { NativeSelect } from "@/components/ui/NativeSelect";
import { SUPPORTED_LOCALES } from "@/lib/language";
import { useLanguage } from "@/lib/language-context";
import { SettingRow } from "./SettingRow";

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();
  return (
    <SettingRow testid="settings-language-field" label="Language">
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
    </SettingRow>
  );
}
