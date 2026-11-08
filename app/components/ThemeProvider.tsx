"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type Theme = "light" | "dark";
const storageKey = "kt-agent-theme";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("kt-theme-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("kt-theme-change", callback); };
};
const snapshot = (): Theme => {
  try { return localStorage.getItem(storageKey) === "dark" ? "dark" : "light"; } catch { return "light"; }
};
type ThemeValue = { theme: Theme; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light" as Theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme: (next: Theme) => {
    try { localStorage.setItem(storageKey, next); } catch {}
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    window.dispatchEvent(new Event("kt-theme-change"));
  } }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is required");
  return value;
}
