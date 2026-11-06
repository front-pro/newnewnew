"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createTranslator, isLocale, type Locale } from "../lib/i18n";

const key = "kt-agent-language";
let fallback: Locale = "kk";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("kt-language-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("kt-language-change", callback); };
};
function snapshot(): Locale {
  try { const saved = localStorage.getItem(key); return isLocale(saved) ? saved : fallback; } catch { return fallback; }
}
type LanguageValue = { locale: Locale; setLocale: (locale: Locale) => void; tr: ReturnType<typeof createTranslator> };
const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, snapshot, () => "kk" as Locale);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, tr: createTranslator(locale), setLocale: (next: Locale) => {
    fallback = next;
    try { localStorage.setItem(key, next); } catch {}
    window.dispatchEvent(new Event("kt-language-change"));
  } }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is required");
  return value;
}
