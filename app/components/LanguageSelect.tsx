"use client";

import { isLocale } from "../lib/i18n";
import { useLanguage } from "./LanguageProvider";

export default function LanguageSelect() {
  const { locale, setLocale, tr } = useLanguage();
  return <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
    <span>{tr("Тіл")}</span>
    <select aria-label={tr("Интерфейс тілі")} value={locale} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }} className="max-w-36 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
      <option value="kk" lang="kk">Қазақша</option><option value="ru" lang="ru">Русский</option><option value="en" lang="en">English</option>
    </select>
  </label>;
}
