"use client";

import { useLanguage } from "./LanguageProvider";

type Props = { value: string; onChange: (value: string) => void; label: string; placeholder: string; count: number; total: number };

export default function SearchField({ value, onChange, label, placeholder, count, total }: Props) {
  const { tr } = useLanguage();
  return <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <label className="block text-xs font-medium text-slate-500">{label}
      <input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={label} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
    <div className="flex items-center justify-between gap-3 text-xs"><p role="status" className="text-slate-500">{tr("Табылды: {count} / {total}", { count, total })}</p>{value && <button onClick={() => onChange("")} className="font-semibold text-blue-600 hover:underline">{tr("Іздеуді тазалау")}</button>}</div>
  </section>;
}
