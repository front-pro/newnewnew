"use client";

import Icon from "./Icon";
import { useLanguage } from "./LanguageProvider";

export type HistorySortOrder = "newest" | "oldest" | "title";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  typeOptions: string[];
  sortOrder: HistorySortOrder;
  onSortOrderChange: (value: HistorySortOrder) => void;
  count: number;
  total: number;
};

export default function HistoryToolbar({ query, onQueryChange, typeFilter, onTypeFilterChange, typeOptions, sortOrder, onSortOrderChange, count, total }: Props) {
  const { tr } = useLanguage();
  return <section aria-label={tr("Тарихты сүзу және сұрыптау")} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
      <label className="block space-y-2 text-xs font-medium text-slate-500">{tr("Тарихтан іздеу")}
        <span className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={tr("Атауы, әрекет түрі немесе күні бойынша іздеу…")} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          {query && <button type="button" onClick={() => onQueryChange("")} aria-label={tr("Іздеуді тазалау")} title={tr("Іздеуді тазалау")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="close" className="size-4" /></button>}
        </span>
      </label>
      <label className="block space-y-2 text-xs font-medium text-slate-500">{tr("Әрекет түрі")}
        <select value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
          <option value="all">{tr("Барлық әрекеттер")}</option>{typeOptions.map(type => <option key={type} value={type}>{tr(type)}</option>)}
        </select>
      </label>
      <label className="block space-y-2 text-xs font-medium text-slate-500">{tr("Сұрыптау")}
        <select value={sortOrder} onChange={event => onSortOrderChange(event.target.value as HistorySortOrder)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
          <option value="newest">{tr("Жаңалары алдымен")}</option><option value="oldest">{tr("Ескілері алдымен")}</option><option value="title">{tr("Атауы бойынша")}</option>
        </select>
      </label>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
      <p role="status" className="text-slate-500">{tr("Табылды: {count} / {total}", { count, total })}</p>
      {(query || typeFilter !== "all") && <button type="button" onClick={() => { onQueryChange(""); onTypeFilterChange("all"); }} className="font-semibold text-blue-600 hover:underline">{tr("Сүзгілерді тазалау ×")}</button>}
    </div>
  </section>;
}
