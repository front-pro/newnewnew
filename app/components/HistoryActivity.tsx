"use client";

import Icon, { type IconName } from "./Icon";
import { useLanguage } from "./LanguageProvider";
import type { HistoryRow } from "./workspace-context";

type Props = {
  row: HistoryRow;
  title: string;
  dateLabel: string;
  details: string;
  onOpen?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  deleteLabel?: string;
  opening?: boolean;
  disabled?: boolean;
};

export default function HistoryActivity({ row, title, dateLabel, details, onOpen, onDelete, onRestore, deleteLabel = "Тарихтан жою", opening = false, disabled = false }: Props) {
  const { tr } = useLanguage();
  const icon: IconName = row.type === "ЖИ талдауы" ? "compare" : row.type === "Құжат" ? "file" : "history";
  const tone = row.type === "ЖИ талдауы" ? "bg-blue-50 text-blue-700" : row.type === "Құжат" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  const content = <>
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon name={icon} className="size-5" /></span>
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm font-semibold text-slate-800 group-hover:text-blue-700">{title}</span>
      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className={`rounded-full px-2.5 py-1 font-medium ${tone}`}>{tr(row.type)}</span>
        {dateLabel && <span>{dateLabel}</span>}
      </span>
      {details && <span className="mt-2 block break-words text-xs leading-5 text-slate-500">{details}</span>}
    </span>
    {onOpen && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-600"><Icon name={opening ? "loader" : "arrow"} className={`size-4 ${opening ? "animate-spin" : ""}`} /></span>}
  </>;

  return <li className="list-none">
    <div className="flex items-center gap-2">
      {onOpen ? <button type="button" onClick={onOpen} disabled={disabled} aria-busy={opening} aria-label={`${tr(opening ? "Ашылуда…" : "Ашу")}: ${title}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-4 sm:p-5">{content}</button> : <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">{content}</div>}
      {onRestore && <button type="button" onClick={onRestore} disabled={disabled} aria-label={`${tr("Қалпына келтіру")}: ${title}`} title={tr("Қалпына келтіру")} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"><Icon name="undo" className="size-4"/></button>}
      {onDelete && <button type="button" onClick={onDelete} disabled={disabled} aria-label={`${tr(deleteLabel)}: ${title}`} title={tr(deleteLabel)} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"><Icon name="trash" className="size-4"/></button>}
    </div>
  </li>;
}
