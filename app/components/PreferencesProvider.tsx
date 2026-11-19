"use client";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

type Preferences = { animations: boolean; autosave: boolean; fontSize: number };
const defaults: Preferences = { animations: true, autosave: true, fontSize: 16 };
let memory = JSON.stringify(defaults);
const key = "kt-workspace-preferences";
function snapshot() { try { return localStorage.getItem(key) || memory; } catch { return memory; } }
function parse(raw: string): Preferences {
  try { const p = JSON.parse(raw); return { animations: p.animations !== false, autosave: p.autosave !== false, fontSize: [14, 16, 18, 20].includes(p.fontSize) ? p.fontSize : 16 }; } catch { return defaults; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener("kt-preferences", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("kt-preferences", callback); };
}
const Context = createContext<{ preferences: Preferences; update: (patch: Partial<Preferences>) => void }>({ preferences: defaults, update: () => {} });
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => JSON.stringify(defaults));
  const preferences = useMemo(() => parse(raw), [raw]);
  useEffect(() => { document.documentElement.dataset.motion = preferences.animations ? "on" : "off"; }, [preferences.animations]);
  const update = (patch: Partial<Preferences>) => { memory = JSON.stringify(parse(JSON.stringify({ ...parse(snapshot()), ...patch }))); try { localStorage.setItem(key, memory); } catch {} window.dispatchEvent(new Event("kt-preferences")); };
  return <Context.Provider value={{ preferences, update }}>{children}</Context.Provider>;
}
export const usePreferences = () => useContext(Context);
