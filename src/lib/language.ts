// Language / locale primitive — pure config (no React).
//
// SCALABILITY: adding a new language means appending one entry to the
// `SUPPORTED_LOCALES` array below — every consumer (dropdown menu,
// future translation lookup, etc.) reads from this single source.
// No other file needs to change to introduce a new locale.

export interface LocaleConfig {
  /** BCP-47 code stored in localStorage and used as React key. */
  code: string;
  /** Display name in English, for admin / debug / a11y contexts. */
  labelEn: string;
  /** Display name in the language itself (what the user sees in the picker). */
  labelNative: string;
}

export const SUPPORTED_LOCALES: readonly LocaleConfig[] = [
  { code: "en", labelEn: "English", labelNative: "English" },
  { code: "fr", labelEn: "French", labelNative: "Français" },
] as const;

export const DEFAULT_LOCALE = "en";
export const LANGUAGE_STORAGE_KEY = "deopt:language";

export function isSupportedLocale(code: string): boolean {
  return SUPPORTED_LOCALES.some((l) => l.code === code);
}
