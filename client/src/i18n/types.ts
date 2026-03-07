export type Language = "ru" | "en" | "zh" | "fr";

export const languages: { code: Language; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

export const DEFAULT_LANGUAGE: Language = "ru";

export type TranslationKeys = Record<string, string | Record<string, string | Record<string, string>>>;
