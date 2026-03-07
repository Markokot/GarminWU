import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Language } from "./types";
import { DEFAULT_LANGUAGE } from "./types";

import ru from "./locales/ru.json";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import fr from "./locales/fr.json";

const translations: Record<Language, Record<string, any>> = { ru, en, zh, fr };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key: string) => key,
});

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("garmincoach_language");
    if (stored && ["ru", "en", "zh", "fr"].includes(stored)) {
      return stored as Language;
    }
    return DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    localStorage.setItem("garmincoach_language", language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(translations[language], key);
      if (value === undefined) {
        value = getNestedValue(translations[DEFAULT_LANGUAGE], key);
      }
      if (value === undefined) {
        return key;
      }
      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
          params[k] !== undefined ? String(params[k]) : `{{${k}}}`
        );
      }
      return value;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export function useLanguage() {
  const { language, setLanguage } = useContext(I18nContext);
  return { language, setLanguage };
}
